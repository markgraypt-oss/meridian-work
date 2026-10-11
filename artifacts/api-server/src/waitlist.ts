// Founding Five waitlist: website form → DB row → Resend "Waitlist" segment →
// confirmation to the MD (Reply-To Mark) → admin ping.
// Spec: claude/waitlist-endpoint-spec-10oct.md
import { Resend } from "resend";
import { sql } from "drizzle-orm";
import { db } from "./db";
import { waitlistSignups } from "@workspace/db";
import { renderBrandedEmail, emailParagraph } from "./emailBrand";
import { TESTER_REPLY_TO } from "./replitAuth";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const ADMIN_EMAIL = process.env.ADMIN_NOTIFICATION_EMAIL || "no-reply@meridian.work";

export const STAFF_BANDS = ["under50", "50-99", "100-249", "250plus"] as const;
export type StaffBand = (typeof STAFF_BANDS)[number];
const BAND_LABEL: Record<StaffBand, string> = { under50: "Under 50", "50-99": "50 to 99", "100-249": "100 to 249", "250plus": "250 or more" };

export interface WaitlistInput {
  firstName: string;
  lastName?: string | null;
  email: string;
  company: string;
  role?: string | null;
  staffBand?: StaffBand | null;
}

/** Insert or refresh the row. Returns whether this email was already on the list. */
export async function saveWaitlistSignup(input: WaitlistInput): Promise<{ existing: boolean }> {
  const email = input.email.toLowerCase();
  const [found] = await db.select({ id: waitlistSignups.id }).from(waitlistSignups).where(sql`lower(${waitlistSignups.email}) = ${email}`);
  if (found) {
    await db.update(waitlistSignups).set({
      firstName: input.firstName, lastName: input.lastName || null, company: input.company,
      role: input.role || null, staffBand: input.staffBand || null,
    }).where(sql`${waitlistSignups.id} = ${found.id}`);
    return { existing: true };
  }
  await db.insert(waitlistSignups).values({
    firstName: input.firstName, lastName: input.lastName || null, email, company: input.company,
    role: input.role || null, staffBand: input.staffBand || null, source: "website",
  });
  return { existing: false };
}

export async function addToWaitlistSegment(email: string, firstName: string, lastName?: string | null): Promise<void> {
  const segmentId = process.env.RESEND_WAITLIST_SEGMENT_ID;
  if (!resend || !segmentId) return;
  try {
    const { error } = await resend.contacts.create({ email, firstName, lastName: lastName || undefined, unsubscribed: false, segments: [{ id: segmentId }] } as any);
    if (error && !/already exists/i.test(String((error as any).message || ""))) console.error("[WAITLIST] Resend contact error:", error);
  } catch (err) {
    console.error("[WAITLIST] Resend contact error:", err);
  }
}

export async function sendWaitlistConfirmation(input: WaitlistInput): Promise<boolean> {
  if (!resend) return false;
  try {
    const { error } = await resend.emails.send({
      from: "MeridianWork <no-reply@meridian.work>",
      to: input.email,
      replyTo: TESTER_REPLY_TO,
      subject: "You're on the list.",
      html: renderBrandedEmail({
        eyebrow: "The Founding Five",
        heading: "You're on the list.",
        preheader: "Five places. A live webinar on 20 January. You hear first.",
        bodyHtml:
          emailParagraph(`Hi ${input.firstName},`) +
          emailParagraph("Thanks for putting your company's name down. Here's what happens next.") +
          emailParagraph("In December you'll get an invitation to a live webinar on <strong>Wednesday 20 January</strong> (Zoom, 45 minutes, lunchtime), where I show the index on real data and open the five places. Applications open during the webinar and close on <strong>Friday 5 February</strong>, or the moment the fifth place is taken. The waitlist hears before anyone else.") +
          emailParagraph("Until then: £5 / €6 per employee a month, half the standard price, locked for life. No trial, no free months.") +
          emailParagraph("If you want to see the app before then, reply to this email. I read every one."),
        signature: true,
      }),
    });
    if (error) { console.error("[WAITLIST] confirmation email error:", error); return false; }
    return true;
  } catch (err) {
    console.error("[WAITLIST] confirmation email error:", err);
    return false;
  }
}

export async function sendWaitlistAdminPing(input: WaitlistInput, existing: boolean): Promise<void> {
  if (!resend || process.env.TESTER_ADMIN_PING === "off") return;
  try {
    const name = [input.firstName, input.lastName].filter(Boolean).join(" ");
    await resend.emails.send({
      from: "MeridianWork <no-reply@meridian.work>",
      to: ADMIN_EMAIL,
      replyTo: input.email,
      subject: `Waitlist: ${input.company} (${name})${existing ? " — updated" : ""}`,
      html: renderBrandedEmail({
        eyebrow: "Internal",
        heading: "Founding Five waitlist",
        bodyHtml:
          emailParagraph(`<strong>${name}</strong> &lt;${input.email}&gt;`) +
          emailParagraph(`${input.company}${input.role ? ` · ${input.role}` : ""}${input.staffBand ? ` · ${BAND_LABEL[input.staffBand]} staff` : ""}`) +
          emailParagraph(existing ? "Already on the list; details refreshed." : "New. Add to the Outreach Pipeline.") +
          emailParagraph(new Date().toLocaleString("en-GB", { timeZone: "Europe/Madrid", timeZoneName: "short" })),
        footerNote: "Reply goes to the MD. Set TESTER_ADMIN_PING=off to stop these.",
      }),
    });
  } catch (err) {
    console.error("[WAITLIST] admin ping error:", err);
  }
}

export async function countWaitlist(): Promise<number> {
  const [r] = await db.select({ n: sql<number>`count(*)` }).from(waitlistSignups);
  return Number(r?.n || 0);
}
