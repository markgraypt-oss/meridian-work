import webpush from "web-push";
import { Resend } from "resend";
import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "./db";
import { storage } from "./storage";
import {
  notifications,
  pushSubscriptions,
  users,
  type NotificationCategory,
  type Notification,
} from "@shared/schema";

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
  const { userId, category, title, body, data, force } = opts;
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

  // 4. Email fan-out.
  const wantEmail = force || (channelToggles.email && !inQuiet && !overCap);
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

  // 5. Web push fan-out.
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
  const label = CATEGORY_LABEL[category] || "Meridian";
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
              <a href="${ctaUrl}" style="display:inline-block; background:#09b5f9; color:#fff !important; padding:12px 22px; border-radius:6px; text-decoration:none; font-weight:600;">Open Meridian</a>
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
