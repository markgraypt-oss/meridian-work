// Shared branded HTML shell for all transactional emails.
// Navy header + brass accents + light, readable body. Built table-first with
// inline styles only so it survives Gmail, Outlook and Apple Mail. The header
// is real HTML (no external banner image), so it never renders a broken box.

type Cta = { label: string; url: string };

// The real hosted MeridianWork email banner (the logo). api.meridian.work
// serves it; the marketing domain's copy 404s, so default to the API host and
// allow an env override.
const LOGO_URL = process.env.EMAIL_BANNER_URL || "https://api.meridian.work/email-banner.png";

export interface BrandedEmailOptions {
  eyebrow?: string;        // small gold label above the heading
  heading?: string;        // main heading (already HTML-safe)
  bodyHtml: string;        // inner content, use emailParagraph()/emailNote()
  cta?: Cta;               // optional brass call-to-action button
  signature?: boolean;     // show the "Mark Gray, Owner" sign-off
  footerNote?: string;     // extra line above the brand footer
  preheader?: string;      // hidden inbox-preview text
}

/** A standard body paragraph. */
export function emailParagraph(html: string): string {
  return `<p style="margin:0 0 13px;color:#1a2233;font-size:15px;line-height:1.6;font-family:Arial,Helvetica,sans-serif;">${html}</p>`;
}

/** A muted secondary note (expiry lines, reassurance, etc). */
export function emailNote(html: string): string {
  return `<p style="margin:0 0 6px;color:#5a6478;font-size:13px;line-height:1.5;font-family:Arial,Helvetica,sans-serif;">${html}</p>`;
}

export function renderBrandedEmail(opts: BrandedEmailOptions): string {
  const { eyebrow, heading, bodyHtml, cta, signature, footerNote, preheader } = opts;

  const eyebrowHtml = eyebrow
    ? `<p style="margin:0 0 10px;color:#a9743f;font-size:12px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;font-family:Arial,Helvetica,sans-serif;">${eyebrow}</p>`
    : "";

  const headingHtml = heading
    ? `<h1 style="margin:0 0 16px;color:#1a2233;font-size:23px;line-height:1.25;font-weight:bold;font-family:Arial,Helvetica,sans-serif;">${heading}</h1>`
    : "";

  const ctaHtml = cta
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:6px 0 20px;"><tr>
         <td bgcolor="#d4a574" style="border-radius:10px;background-color:#d4a574;">
           <a href="${cta.url}" style="display:inline-block;padding:14px 30px;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:bold;color:#0a1628;text-decoration:none;border-radius:10px;">${cta.label}</a>
         </td>
       </tr></table>`
    : "";

  const signatureHtml = signature
    ? `<div style="border-top:1px solid #e6e9ee;margin-top:14px;padding-top:16px;font-family:Arial,Helvetica,sans-serif;">
         <p style="margin:0;font-size:14px;color:#1a2233;"><strong>Mark Gray</strong></p>
         <p style="margin:2px 0 0;font-size:13px;color:#5a6478;">Owner, MeridianWork</p>
       </div>`
    : "";

  const footerNoteHtml = footerNote
    ? `<p style="margin:0 0 8px;color:#8a94a6;font-size:12px;line-height:1.5;font-family:Arial,Helvetica,sans-serif;">${footerNote}</p>`
    : "";

  const preheaderHtml = preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${preheader}</div>`
    : "";

  return `
  <div style="margin:0;padding:0;background-color:#eef1f5;">
    ${preheaderHtml}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#eef1f5" style="background-color:#eef1f5;">
      <tr><td align="center" style="padding:24px 12px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" bgcolor="#ffffff" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e6e9ee;">
          <tr><td bgcolor="#ffffff" style="background-color:#ffffff;padding:0;font-size:0;line-height:0;text-align:center;">
            <img src="${LOGO_URL}" alt="MeridianWork" width="600" style="display:block;width:100%;max-width:600px;height:auto;border:0;margin:0;" />
          </td></tr>
          <tr><td bgcolor="#ffffff" style="background-color:#ffffff;padding:28px 26px 8px;">
            ${eyebrowHtml}
            ${headingHtml}
            ${bodyHtml}
            ${ctaHtml}
            ${signatureHtml}
          </td></tr>
          <tr><td bgcolor="#f4f6f9" style="background-color:#f4f6f9;padding:18px 24px;text-align:center;">
            ${footerNoteHtml}
            <p style="margin:0;color:#8a94a6;font-size:12px;line-height:1.5;font-family:Arial,Helvetica,sans-serif;">
              MeridianWork &middot; <a href="https://meridian.work" style="color:#a9743f;text-decoration:none;font-weight:bold;">meridian.work</a> &middot; <a href="mailto:support@meridian.work" style="color:#a9743f;text-decoration:none;font-weight:bold;">support@meridian.work</a>
            </p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </div>`;
}
