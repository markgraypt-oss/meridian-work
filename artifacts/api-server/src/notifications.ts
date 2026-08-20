import webpush from "web-push";
import { Resend } from "resend";
import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "./db";
import { storage } from "./storage";
import {
  notifications,
  pushSubscriptions,
  userPushTokens,
  users,
  type NotificationCategory,
  type Notification,
} from "@workspace/db";

// ---------------------------------------------------------------------------
// Email (Resend) and Web Push (VAPID) setup. Both are optional — if env vars
// are missing the helper falls back to in-app delivery only.
// ---------------------------------------------------------------------------

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY || "";
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || "";
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:no-reply@meridian.work";

let vapidConfigured = false;
if (VAPID_PUBLIC && VAPID_PRIVATE) {
  try {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
    vapidConfigured = true;
  } catch (e) {
    console.error("[notify] Failed to configure VAPID:", e);
  }
}

export function getVapidPublicKey(): string | null {
  return vapidConfigured ? VAPID_PUBLIC : null;
}

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface NotifyOptions {
  userId: string;
  category: NotificationCategory;
  title: string;
  body: string;
  data?: Record<string, any>;
  // Force-send overrides preference + quiet-hours + cap (used by "test" buttons)
  force?: boolean;
  // Schedulers set this to true — automated sends never email, only in-app + push
  disableEmail?: boolean;
  // Per-type toggle key from notification_preferences (e.g. 'habitReminders',
  // 'badgeAlerts'). When set, the toggle is checked as the authoritative gate
  // before any channel logic runs. null/undefined pref value = default on.
  // force=true bypasses this gate.
  prefKey?: string;
}

export interface NotifyResult {
  notification: Notification | null;
  channels: { inApp: boolean; email: boolean; push: boolean };
  reason?: string;
}

// ---------------------------------------------------------------------------
// notify() — central fan-out helper. Always idempotently writes the in-app
// row first (so the bell shows it), then routes to email + push respecting
// per-category × per-channel preferences, quiet hours, and the daily cap.
// ---------------------------------------------------------------------------

export async function notify(opts: NotifyOptions): Promise<NotifyResult> {
  const { userId, category, title, body, data, force, disableEmail } = opts;
  const result: NotifyResult = {
    notification: null,
    channels: { inApp: false, email: false, push: false },
  };

  // 1. Look up the user + their preferences (lazily create defaults).
  const user = await storage.getUser(userId);
  if (!user) {
    return { ...result, reason: "user_not_found" };
  }

  let prefs = await storage.getNotificationPreferences(userId);
  if (!prefs) {
    prefs = await storage.upsertNotificationPreferences(userId, {});
  }

  // Per-type toggle gate — authoritative opt-out. Only bypassed by force=true.
  // A null/undefined column value means the default (on) applies.
  if (!force && opts.prefKey !== undefined) {
    const val = (prefs as any)[opts.prefKey];
    if (val === false) {
      return { ...result, reason: 'pref_disabled' };
    }
  }

  const channelToggles = getChannelToggles(prefs, category);

  // 2. Quiet hours + daily cap (skipped when force=true).
  const inQuiet = !force && isWithinQuietHours(prefs);
  const overCap = !force && (await isOverDailyCap(userId, prefs.dailyCap ?? 8));

  // 3. In-app: always written if the user has the in-app toggle on for this
  //    category (or force). The bell + panel rely on this row existing.
  if (force || channelToggles.inApp) {
    try {
      const [row] = await db
        .insert(notifications)
        .values({ userId, category, title, body, data: data ?? null })
        .returning();
      result.notification = row;
      result.channels.inApp = true;
    } catch (e) {
      console.error("[notify] failed to write in-app row:", e);
    }
  }

  // 4. Email fan-out — permanently disabled.
  // The emailWorkoutSummary / emailWeeklyProgress / emailProgramReminders toggles
  // are no longer active and are treated as false. Auth emails (reset, invite)
  // from replitAuth.ts are unaffected.
  const wantEmail = false;
  if (wantEmail && user.email && resend) {
    const ok = await sendCategoryEmail(user.email, user.firstName ?? null, category, title, body, data);
    result.channels.email = ok;
    if (ok && result.notification) {
      try {
        await db
          .update(notifications)
          .set({ emailDeliveredAt: new Date() })
          .where(eq(notifications.id, result.notification.id));
      } catch {}
    }
  }

  // 5. Web push fan-out (VAPID/browser).
  const wantPush = force || (channelToggles.push && !inQuiet && !overCap);
  if (wantPush && vapidConfigured) {
    const subs = await db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.userId, userId));

    if (subs.length > 0) {
      const payload = JSON.stringify({
        title,
        body,
        data: data ?? null,
        category,
        notificationId: result.notification?.id ?? null,
      });
      let anyDelivered = false;
      await Promise.all(
        subs.map(async (sub) => {
          try {
            await webpush.sendNotification(
              { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
              payload,
            );
            anyDelivered = true;
          } catch (err: any) {
            // Stale subscription — clean up so we don't keep retrying.
            if (err?.statusCode === 404 || err?.statusCode === 410) {
              try {
                await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, sub.id));
              } catch {}
            } else {
              console.error("[notify] push send failed:", err?.statusCode, err?.body || err?.message);
            }
          }
        }),
      );
      result.channels.push = anyDelivered;
      if (anyDelivered && result.notification) {
        try {
          await db
            .update(notifications)
            .set({ pushDeliveredAt: new Date() })
            .where(eq(notifications.id, result.notification.id));
        } catch {}
      }
    }
  }

  // 6. Expo push fan-out (mobile).
  if (wantPush) {
    const expoTokens = await db
      .select()
      .from(userPushTokens)
      .where(eq(userPushTokens.userId, userId));

    if (expoTokens.length > 0) {
      const messages = expoTokens.map((t) => ({
        to: t.token,
        title,
        body,
        sound: "default" as const,
        data: { ...(data ?? {}), category, notificationId: result.notification?.id ?? null },
      }));

      try {
        const expoRes = await fetch("https://exp.host/--/api/v2/push/send", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify(messages),
        });
        const expoBody = (await expoRes.json()) as { data?: { status: string; details?: { error?: string } }[] };
        console.log("[notify] expo push response:", JSON.stringify(expoBody));
        const statuses = expoBody.data ?? [];
        let anyExpoDelivered = false;
        await Promise.all(
          statuses.map(async (s, i) => {
            if (s.status === "ok") {
              anyExpoDelivered = true;
            } else if (s.details?.error === "DeviceNotRegistered") {
              // Stale token — remove it.
              try {
                await db
                  .delete(userPushTokens)
                  .where(eq(userPushTokens.id, expoTokens[i].id));
              } catch {}
            } else {
              // InvalidCredentials / MessageTooBig / MessageRateExceeded / etc.
              // are NOT token-level problems — keep the row, just log.
              console.error("[notify] expo push error:", s.details?.error, s.message);
            }
          }),
        );
        if (anyExpoDelivered) {
          result.channels.push = true;
          if (result.notification) {
            try {
              await db
                .update(notifications)
                .set({ pushDeliveredAt: new Date() })
                .where(eq(notifications.id, result.notification.id));
            } catch {}
          }
        }
      } catch (err) {
        console.error("[notify] expo push request failed:", err);
      }
    }
  }

  if (inQuiet) result.reason = "quiet_hours";
  else if (overCap) result.reason = "daily_cap";
  return result;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getChannelToggles(prefs: any, category: NotificationCategory) {
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  const c = cap(category);
  return {
    inApp: !!prefs[`inApp${c}`],
    email: !!prefs[`email${c}`],
    push: !!prefs[`push${c}`],
  };
}

function isWithinQuietHours(prefs: any): boolean {
  if (!prefs?.quietHoursEnabled) return false;
  const start = parseTime(prefs.quietHoursStart || "22:00");
  const end = parseTime(prefs.quietHoursEnd || "07:00");
  if (start === null || end === null) return false;
  const now = new Date();
  const minutes = now.getHours() * 60 + now.getMinutes();
  // Wraps midnight
  if (start > end) return minutes >= start || minutes < end;
  return minutes >= start && minutes < end;
}

function parseTime(t: string): number | null {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(t);
  if (!m) return null;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

async function isOverDailyCap(userId: string, cap: number): Promise<boolean> {
  if (!cap || cap <= 0) return false;
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  // Cap applies to *delivered* email/push only — in-app rows are uncapped.
  const [row] = await db
    .select({ c: sql<number>`count(*)` })
    .from(notifications)
    .where(
      and(
        eq(notifications.userId, userId),
        gte(notifications.createdAt, since),
        sql`(${notifications.emailDeliveredAt} IS NOT NULL OR ${notifications.pushDeliveredAt} IS NOT NULL)`,
      ),
    );
  return Number(row?.c || 0) >= cap;
}

// ---------------------------------------------------------------------------
// Email rendering. One simple template per category.
// ---------------------------------------------------------------------------

const CATEGORY_LABEL: Record<NotificationCategory, string> = {
  training: "Training",
  recovery: "Recovery",
  nutrition: "Nutrition",
  coach: "Your AI Coach",
  admin: "Account",
  community: "Community",
};

async function sendCategoryEmail(
  to: string,
  firstName: string | null,
  category: NotificationCategory,
  title: string,
  body: string,
  data?: Record<string, any>,
): Promise<boolean> {
  if (!resend) return false;
  const greeting = firstName ? `Hi ${firstName},` : "Hi,";
  const ctaUrl = data?.url || "https://meridian.work";
  const label = CATEGORY_LABEL[category] || "MeridianWork";
  try {
    const { error } = await resend.emails.send({
      from: "MeridianWork <no-reply@meridian.work>",
      to,
      subject: `${label}: ${title}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background:#fff;">
          <div style="padding: 24px; color: #222;">
            <p style="font-size:14px; color:#888; text-transform:uppercase; letter-spacing:.05em; margin:0 0 8px;">${label}</p>
            <h2 style="font-size:24px; margin:0 0 12px;">${escapeHtml(title)}</h2>
            <p style="font-size:16px; line-height:1.5; color:#444; white-space:pre-wrap;">${greeting}\n\n${escapeHtml(body)}</p>
            <p style="margin-top:24px;">
              <a href="${ctaUrl}" style="display:inline-block; background:#09b5f9; color:#fff !important; padding:12px 22px; border-radius:6px; text-decoration:none; font-weight:600;">Open MeridianWork</a>
            </p>
            <p style="margin-top:32px; color:#999; font-size:12px;">You can change which notifications you get in Profile → Notifications.</p>
          </div>
        </div>
      `,
    });
    if (error) {
      console.error("[notify] email error:", error);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[notify] email exception:", e);
    return false;
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ─── Wellbeing contact requests ──────────────────────────────────────────────
// Burnout Index → Talk to Your Manager → "Ask someone to check in with me".
// Deliberately NOT routed through sendCategoryEmail: this needs a Reply-To of
// the employee, no "Open MeridianWork" CTA, and none of the notification-
// settings footer. It should read like a person asking, not a product ping.
//
// HARD RULE: this email must never contain a burnout score, band, trajectory,
// check-in data or any other health datum. The user consented to their NAME
// being passed on, nothing more.

export interface WellbeingContactEmailInput {
  contactEmail: string;
  contactName: string;
  contactRole?: string | null;
  employeeName: string;
  employeeEmail: string;
  companyName?: string | null;
}

const WELLBEING_FOOTER =
  "Sent at the employee's request through MeridianWork. No health data, scores or app activity have been shared with you.";

function wellbeingEmailHtml(paragraphs: string[], footer: string): string {
  const body = paragraphs
    .map(p => `<p style="font-size:16px; line-height:1.6; color:#222; margin:0 0 16px;">${p}</p>`)
    .join("\n");
  return `
    <div style="font-family: Arial, Helvetica, sans-serif; max-width: 560px; margin: 0 auto; background:#fff;">
      <div style="padding: 28px 24px; color:#222;">
        ${body}
        <hr style="border:none; border-top:1px solid #e5e5e5; margin:28px 0 14px;" />
        <p style="color:#888; font-size:12px; line-height:1.5; margin:0;">${footer}</p>
      </div>
    </div>
  `;
}

/** Email the nominated company contact. Returns false if it did not send. */
export async function sendWellbeingContactEmail(input: WellbeingContactEmailInput): Promise<boolean> {
  if (!resend) {
    console.warn("[wellbeing] RESEND_API_KEY not set — contact request not sent");
    return false;
  }
  const employee = escapeHtml(input.employeeName);
  const contactFirst = escapeHtml((input.contactName || "").split(" ")[0] || "there");
  try {
    const { error } = await resend.emails.send({
      from: "MeridianWork <no-reply@meridian.work>",
      to: input.contactEmail,
      replyTo: input.employeeEmail,
      subject: "A team member has asked you to check in with them",
      html: wellbeingEmailHtml(
        [
          `Hi ${contactFirst},`,
          `<strong>${employee}</strong> has used MeridianWork to ask you to get in touch with them about workload and wellbeing.`,
          `They've taken the first step. The next one is yours — reach out to them directly over the next day or two.`,
          `Just reply to this email to reach ${employee} (${escapeHtml(input.employeeEmail)}).`,
        ],
        WELLBEING_FOOTER,
      ),
      text: [
        `Hi ${input.contactName.split(" ")[0] || "there"},`,
        "",
        `${input.employeeName} has used MeridianWork to ask you to get in touch with them about workload and wellbeing.`,
        "",
        "They've taken the first step. The next one is yours — reach out to them directly over the next day or two.",
        "",
        `Just reply to this email to reach ${input.employeeName} (${input.employeeEmail}).`,
        "",
        "---",
        WELLBEING_FOOTER,
      ].join("\n"),
    });
    if (error) {
      console.error("[wellbeing] contact email error:", error);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[wellbeing] contact email exception:", e);
    return false;
  }
}

/**
 * Copy to the employee, so they always have a dated record of exactly what was
 * sent and to whom. Best-effort — a failure here never fails the request.
 */
export async function sendWellbeingRequestCopyToEmployee(input: WellbeingContactEmailInput): Promise<boolean> {
  if (!resend) return false;
  const who = escapeHtml(input.contactName) + (input.contactRole ? ` (${escapeHtml(input.contactRole)})` : "");
  try {
    const { error } = await resend.emails.send({
      from: "MeridianWork <no-reply@meridian.work>",
      to: input.employeeEmail,
      subject: "Your request has been sent",
      html: wellbeingEmailHtml(
        [
          `We've asked <strong>${who}</strong> to get in touch with you about workload and wellbeing.`,
          `Here's exactly what they were told: that you'd like them to reach out. Nothing else — your Burnout Index, check-ins and any other health data stayed private.`,
          `If you don't hear anything in a few days, you can send another request from the app.`,
        ],
        "This is your own copy, for your records.",
      ),
      text: [
        `We've asked ${input.contactName}${input.contactRole ? ` (${input.contactRole})` : ""} to get in touch with you about workload and wellbeing.`,
        "",
        "Here's exactly what they were told: that you'd like them to reach out. Nothing else — your Burnout Index, check-ins and any other health data stayed private.",
        "",
        "If you don't hear anything in a few days, you can send another request from the app.",
        "",
        "---",
        "This is your own copy, for your records.",
      ].join("\n"),
    });
    if (error) {
      console.error("[wellbeing] employee copy error:", error);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[wellbeing] employee copy exception:", e);
    return false;
  }
}

/** Admin-only: prove a configured contact address actually works. */
export async function sendWellbeingTestEmail(to: string, companyName: string): Promise<boolean> {
  if (!resend) return false;
  try {
    const { error } = await resend.emails.send({
      from: "MeridianWork <no-reply@meridian.work>",
      to,
      subject: "Test: you're set up as a wellbeing contact",
      html: wellbeingEmailHtml(
        [
          `This is a test message — no one has requested anything.`,
          `You've been set up as a wellbeing contact for <strong>${escapeHtml(companyName)}</strong> on MeridianWork. If a team member asks for a check-in, the request will arrive at this address and you can reply to it directly to reach them.`,
          `Nothing further is needed from you right now.`,
        ],
        "Sent by a MeridianWork administrator to verify this address.",
      ),
    });
    if (error) {
      console.error("[wellbeing] test email error:", error);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[wellbeing] test email exception:", e);
    return false;
  }
}
