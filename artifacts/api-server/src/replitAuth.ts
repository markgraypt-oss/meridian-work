import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import connectPg from "connect-pg-simple";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { Resend } from "resend";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { storage } from "./storage";
import { renderBrandedEmail, emailParagraph, emailNote } from "./emailBrand";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

export function generateResetToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function sendPasswordResetEmail(email: string, token: string, baseUrl: string): Promise<boolean> {
  if (!resend) {
    console.error("Resend not configured - RESEND_API_KEY missing");
    return false;
  }

  const resetUrl = `${baseUrl}/reset-password?token=${token}`;

  try {
    const { error } = await resend.emails.send({
      from: "MeridianWork <no-reply@meridian.work>",
      to: email,
      subject: "Reset Your Password",
      html: renderBrandedEmail({
        eyebrow: "Security",
        heading: "Reset your password",
        bodyHtml:
          emailParagraph("You asked to reset the password on your MeridianWork account. Set a new one here:") +
          emailNote("This link expires in 1 hour. If you didn't request this, you can safely ignore this email and nothing will change."),
        cta: { label: "Reset password", url: resetUrl },
        signature: true,
        preheader: "Reset your MeridianWork password",
      }),
    });

    if (error) {
      console.error("Failed to send password reset email:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Error sending password reset email:", err);
    return false;
  }
}

export async function sendUserInviteEmail(email: string, token: string, baseUrl: string, firstName?: string): Promise<boolean> {
  if (!resend) {
    console.error("Resend not configured - RESEND_API_KEY missing");
    return false;
  }

  const setupUrl = `${baseUrl}/reset-password?token=${token}&invite=true`;
  const greeting = firstName ? `Hi ${firstName},` : "Hi,";

  try {
    const { error } = await resend.emails.send({
      from: "MeridianWork <no-reply@meridian.work>",
      to: email,
      subject: "Welcome to MeridianWork - Set Up Your Account",
      html: renderBrandedEmail({
        eyebrow: "Welcome",
        heading: "Peak performance at work starts here",
        bodyHtml:
          emailParagraph(greeting) +
          emailParagraph("You've been invited to join MeridianWork. Set up your password and you're in, with movement, nutrition, recovery and your AI coach all in one place.") +
          emailNote("This link expires in 24 hours. Any questions, just contact your administrator."),
        cta: { label: "Set up your account", url: setupUrl },
        signature: true,
        preheader: "Set up your MeridianWork account",
      }),
    });

    if (error) {
      console.error("Failed to send invite email:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Error sending invite email:", err);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Public tester sign-up (website /test form), 4 Oct 2026.
// One email: set-password link + the install links. Reply-To is Mark so
// "reply to this email" on the page is true.
// ---------------------------------------------------------------------------
export const TESTER_REPLY_TO = process.env.TESTER_REPLY_TO || "mark@meridian.work";
export const TESTFLIGHT_URL = process.env.TESTFLIGHT_URL || "https://testflight.apple.com/join/awdTzCjX";
export const PLAY_TESTING_URL = process.env.PLAY_TESTING_URL || "";

function installLinksHtml(phone?: string | null): string {
  const ios = `<strong>iPhone:</strong> <a href="${TESTFLIGHT_URL}" style="color:#a9743f;">${TESTFLIGHT_URL}</a>`;
  const android = PLAY_TESTING_URL
    ? `<strong>Android:</strong> <a href="${PLAY_TESTING_URL}" style="color:#a9743f;">${PLAY_TESTING_URL}</a>`
    : `<strong>Android:</strong> the Google Play link is a few days away. I'll email it to you the moment it's live.`;
  const lines = phone === "android" ? [android, ios] : [ios, android];
  return lines.join("<br>");
}

export async function sendTesterWelcomeEmail(
  email: string,
  token: string,
  baseUrl: string,
  firstName?: string | null,
  phone?: string | null,
): Promise<boolean> {
  if (!resend) {
    console.error("Resend not configured - RESEND_API_KEY missing");
    return false;
  }
  const setupUrl = `${baseUrl}/reset-password?token=${token}&invite=true`;
  const greeting = firstName ? `Hi ${firstName},` : "Hi,";
  try {
    const { error } = await resend.emails.send({
      from: "MeridianWork <no-reply@meridian.work>",
      to: email,
      replyTo: TESTER_REPLY_TO,
      subject: "You're in. Here's your link.",
      html: renderBrandedEmail({
        eyebrow: "Testers",
        heading: "Use it. Shape it. Keep it.",
        preheader: "Set your password, install the app, do a check-in.",
        bodyHtml:
          emailParagraph(greeting) +
          emailParagraph("Thanks for putting your hand up. Three things and you're in.") +
          emailParagraph("<strong>1. Set your password</strong><br>Tap the button below. The link lasts 3 days.") +
          emailParagraph(`<strong>2. Install the app</strong><br>${installLinksHtml(phone)}`) +
          emailParagraph("<strong>3. Log in and do your first check-in</strong><br>Thirty seconds. Mood, energy, stress, sleep. The coach can't help until it knows something about you.") +
          emailParagraph("<strong>What happens next</strong><br>Use it as you would any health app. Connect your watch or ring if you have one. At day 7 and day 21 the app will ask you two questions. Answer them honestly. If something breaks, confuses you or is missing, reply to this email. I read every one.") +
          emailParagraph("Free until the end of January. Testers keep it free after that.") +
          emailNote("If the set-up link has expired, reply to this email and I'll send another."),
        cta: { label: "Set up your account", url: setupUrl },
        signature: true,
      }),
    });
    if (error) {
      console.error("[TESTER] Failed to send welcome email:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[TESTER] Error sending welcome email:", err);
    return false;
  }
}

// Adds the tester to the Resend "Testers" list so broadcasts (day-7/21 nudges,
// updates) go from the same place as the transactional mail. Resend has moved
// from Audiences to Segments: set RESEND_TESTERS_SEGMENT_ID (new dashboards)
// or RESEND_TESTERS_AUDIENCE_ID (older ones). Unset = skipped; never blocks sign-up.
export async function addTesterToAudience(email: string, firstName?: string | null): Promise<void> {
  const segmentId = process.env.RESEND_TESTERS_SEGMENT_ID;
  const audienceId = process.env.RESEND_TESTERS_AUDIENCE_ID;
  if (!resend || (!segmentId && !audienceId)) return;
  try {
    const payload: any = segmentId
      ? { email, firstName: firstName || undefined, unsubscribed: false, segments: [{ id: segmentId }] }
      : { audienceId, email, firstName: firstName || undefined, unsubscribed: false };
    const { error } = await resend.contacts.create(payload);
    if (error && !/already exists/i.test(String((error as any).message || ""))) {
      console.error("[TESTER] Failed to add contact to Resend list:", error);
    }
  } catch (err) {
    console.error("[TESTER] Error adding contact to Resend list:", err);
  }
}

export async function sendTesterSignupNotification(input: { firstName: string; email: string; phone: string; existing: boolean; likelyBot?: boolean }): Promise<void> {
  if (!resend) { console.error("[TESTER] Admin ping skipped: RESEND_API_KEY missing"); return; }
  if (process.env.TESTER_ADMIN_PING === "off") return;
  try {
    const { error } = await resend.emails.send({
      from: "MeridianWork <no-reply@meridian.work>",
      to: ADMIN_NOTIFICATION_EMAIL,
      subject: `${input.likelyBot ? "Likely bot, blocked. " : ""}New tester: ${input.firstName} (${input.phone === "ios" ? "iPhone" : "Android"})${input.existing ? " - existing account" : ""}`,
      html: renderBrandedEmail({
        eyebrow: "Internal",
        heading: "New tester sign-up",
        bodyHtml:
          emailParagraph(`<strong>${input.firstName}</strong> &lt;${input.email}&gt; signed up on /test (${input.phone}).`) +
          emailParagraph(input.likelyBot
            ? "Blocked as a likely bot: random-letter details that don't match the email. No account created and no email sent to this address. If this is a real person, add them by hand."
            : input.existing ? "This email already had an account; a fresh set-up link was sent instead of creating a duplicate." : "Account created in the Testers company and the welcome email sent.") +
          emailParagraph(new Date().toLocaleString("en-GB", { timeZone: "Europe/Madrid", timeZoneName: "short" })),
        footerNote: "Set TESTER_ADMIN_PING=off in Secrets to stop these.",
      }),
    });
    if (error) console.error("[TESTER] Failed to send admin ping:", error);
  } catch (err) {
    console.error("[TESTER] Error sending admin ping:", err);
  }
}

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  const isProduction = process.env.NODE_ENV === "production";
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: isProduction,
      // Lax, not None: the admin portal is same-origin, so the cookie never
      // needs to ride along on cross-site requests. None made every logged-in
      // browser session usable by any other website (CSRF).
      sameSite: "lax",
      maxAge: sessionTtl,
    },
  });
}

const ADMIN_NOTIFICATION_EMAIL = process.env.ADMIN_NOTIFICATION_EMAIL || "no-reply@meridian.work";

const escapeHtml = (v: string) => String(v)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * Support, bug report and feature request from the app: one email to the
 * admin inbox, with the person's name and email so they can be answered.
 * Returns false when it could not be sent (no Resend key) so the route can say
 * so instead of pretending.
 */
export async function sendSupportMessageToAdmin(input: {
  kind: "support" | "bug" | "feature";
  user: { id: string; email?: string | null; firstName?: string | null; lastName?: string | null; companyName?: string | null };
  subject: string;
  body: string;
  extra?: string;
}): Promise<boolean> {
  if (!resend) {
    console.error(`[SUPPORT] ${input.kind} message from user ${input.user.id} not sent: RESEND_API_KEY missing`);
    return false;
  }
  const label = input.kind === "bug" ? "Bug report" : input.kind === "feature" ? "Feature request" : "Support request";
  const name = [input.user.firstName, input.user.lastName].filter(Boolean).join(" ") || "Unknown";
  try {
    const { error } = await resend.emails.send({
      from: "MeridianWork <no-reply@meridian.work>",
      to: ADMIN_NOTIFICATION_EMAIL,
      replyTo: input.user.email || undefined,
      subject: `${label}: ${input.subject.slice(0, 120)}`,
      html: renderBrandedEmail({
        eyebrow: "From the app",
        heading: label,
        bodyHtml:
          emailParagraph(`<strong>${escapeHtml(name)}</strong> &lt;${escapeHtml(input.user.email || "no email")}&gt;${input.user.companyName ? `, ${escapeHtml(input.user.companyName)}` : ""}`) +
          emailParagraph(`<strong>${escapeHtml(input.subject)}</strong>`) +
          emailParagraph(escapeHtml(input.body).replace(/\n/g, "<br>")) +
          (input.extra ? emailParagraph(escapeHtml(input.extra).replace(/\n/g, "<br>")) : "") +
          emailParagraph(`User id ${input.user.id}. ${new Date().toLocaleString("en-GB", { timeZone: "Europe/Madrid", timeZoneName: "short" })}`),
        footerNote: "Reply to this email to answer them directly.",
      }),
    });
    if (error) { console.error(`[SUPPORT] Resend error for ${input.kind}:`, error); return false; }
    return true;
  } catch (err) {
    console.error(`[SUPPORT] Failed to send ${input.kind} message:`, err);
    return false;
  }
}

async function sendFirstLoginNotification(user: { id: string; email?: string | null; firstName?: string | null; lastName?: string | null; companyName?: string | null }): Promise<void> {
  if (!resend) {
    console.error("[FIRST-LOGIN] Resend not configured - skipping notification");
    return;
  }

  const name = [user.firstName, user.lastName].filter(Boolean).join(" ") || "Unknown";
  const email = user.email || "No email";
  const company = user.companyName || "Not assigned";

  try {
    const { error } = await resend.emails.send({
      from: "MeridianWork <no-reply@meridian.work>",
      to: ADMIN_NOTIFICATION_EMAIL,
      subject: `New User Login: ${name}`,
      html: renderBrandedEmail({
        eyebrow: "Internal",
        heading: "New user first login",
        bodyHtml:
          emailParagraph("A new user has successfully logged in for the first time:") +
          `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:4px 0 8px;font-family:Arial,Helvetica,sans-serif;">
             <tr><td style="padding:8px 0;color:#5a6478;font-size:13px;width:120px;">Name</td><td style="padding:8px 0;color:#1a2233;font-size:14px;font-weight:bold;">${name}</td></tr>
             <tr><td style="padding:8px 0;color:#5a6478;font-size:13px;border-top:1px solid #e6e9ee;">Email</td><td style="padding:8px 0;color:#1a2233;font-size:14px;border-top:1px solid #e6e9ee;">${email}</td></tr>
             <tr><td style="padding:8px 0;color:#5a6478;font-size:13px;border-top:1px solid #e6e9ee;">Company</td><td style="padding:8px 0;color:#1a2233;font-size:14px;border-top:1px solid #e6e9ee;">${company}</td></tr>
             <tr><td style="padding:8px 0;color:#5a6478;font-size:13px;border-top:1px solid #e6e9ee;">Time</td><td style="padding:8px 0;color:#1a2233;font-size:14px;border-top:1px solid #e6e9ee;">${new Date().toLocaleString("en-GB", { timeZone: "Europe/Madrid", timeZoneName: "short" })}</td></tr>
           </table>`,
        footerNote: "Automated notification from MeridianWork.",
      }),
    });

    if (error) {
      console.error("[FIRST-LOGIN] Failed to send notification:", error);
    } else {
      console.log(`[FIRST-LOGIN] Notification sent for user ${user.id}`);
    }
  } catch (err) {
    console.error("[FIRST-LOGIN] Error sending notification:", err);
  }
}

async function handleFirstLoginCheck(userId: string): Promise<void> {
  const user = await storage.getUser(userId);
  if (!user || user.firstLoginAt || user.isAdmin) return;

  const updated = await storage.markFirstLogin(userId);
  if (updated) {
    sendFirstLoginNotification(user);
  }
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  passport.serializeUser((user: Express.User, cb) => cb(null, user));
  passport.deserializeUser((user: Express.User, cb) => cb(null, user));

  // Brute-force and credential-stuffing limit: 10 attempts per email per
  // 15 minutes, and 60 per IP per 15 minutes (shared Wi-Fi at a company).
  // No email or outcome is logged any more; the old lines wrote every
  // attempt's address and "Password valid: false" to the deployment log.
  const loginByEmailLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: any) => "email:" + (String(req.body?.email || "").trim().toLowerCase() || ipKeyGenerator(req.ip)),
    message: { message: "Too many sign-in attempts. Please wait 15 minutes and try again." },
  });
  const loginByIpLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 60,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: any) => "ip:" + ipKeyGenerator(req.ip),
    message: { message: "Too many sign-in attempts. Please wait 15 minutes and try again." },
  });

  app.post("/api/login", loginByIpLimit, loginByEmailLimit, async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }

      const user = await storage.getUserByIdentifierWithPassword(email);

      if (!user) {
        // Burn the same time as a real comparison so a missing account is not
        // distinguishable from a wrong password by timing.
        await bcrypt.compare(String(password), "$2a$10$CwTycUXWue0Thq9StjUM0uJ8e3Dq4q5Rk4Ir0f9G1iQ0W0sX1Fq7K");
        return res.status(401).json({ message: "Invalid email or password" });
      }

      const isValidPassword = await bcrypt.compare(password, user.password!);

      if (!isValidPassword) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      const sessionUser = {
        claims: {
          sub: user.id,
          email: user.email,
          first_name: user.firstName,
          last_name: user.lastName,
        },
        expires_at: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60),
        authType: "local",
      };

      req.login(sessionUser, (err) => {
        if (err) {
          console.error("Login error:", err);
          return res.status(500).json({ message: "Login failed" });
        }
        handleFirstLoginCheck(user.id).catch(e => console.error("[FIRST-LOGIN] Check failed:", e));
        res.json({ success: true, sessionId: req.sessionID, user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, isAdmin: user.isAdmin } });
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Login failed" });
    }
  });

  // Logout must end the session the caller is actually using. The mobile app
  // authenticates with an x-session-id header, which passport's req.logout()
  // never touched, so a phone session stayed valid for its full 7 days after
  // "Log out". Now the header session is destroyed in the store as well.
  const destroyCallerSessions = (req: any): Promise<void> =>
    new Promise((resolve) => {
      const mobileSessionId = req.headers?.["x-session-id"] as string | undefined;
      const finish = () => {
        if (typeof req.logout === "function") {
          req.logout(() => {
            if (req.session && typeof req.session.destroy === "function") req.session.destroy(() => resolve());
            else resolve();
          });
        } else resolve();
      };
      if (mobileSessionId && req.sessionStore?.destroy) {
        req.sessionStore.destroy(mobileSessionId, () => finish());
      } else finish();
    });

  app.get("/api/logout", async (req: any, res) => {
    await destroyCallerSessions(req);
    res.redirect("/");
  });

  app.post("/api/logout", async (req: any, res) => {
    await destroyCallerSessions(req);
    res.json({ success: true });
  });

  // Rate-limited (4 Oct 2026): something was requesting resets for one address
  // once a minute with no cap. Keyed by email so one address can't be spammed,
  // falling back to IP when the body has no email.
  const forgotPasswordLimit = rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 5,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: any) => String(req.body?.email || "").trim().toLowerCase() || ipKeyGenerator(req.ip),
    message: { success: true, message: "If an account exists with this email, a reset link has been sent." },
  });

  app.post("/api/forgot-password", forgotPasswordLimit, async (req, res) => {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }
      // Count the request without writing the address, IP or browser to the log.
      console.log(`[FORGOT-PASSWORD] request received (${String(email).includes("@") ? "email" : "identifier"})`);

      const user = await storage.getUserByEmail(email);

      if (!user) {
        return res.json({ success: true, message: "If an account exists with this email, a reset link has been sent." });
      }

      const token = generateResetToken();
      const hashedToken = hashToken(token);
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

      await storage.createPasswordResetToken({
        userId: user.id,
        token: hashedToken,
        expiresAt,
      });

      const protocol = req.secure || req.headers["x-forwarded-proto"] === "https" ? "https" : "http";
      const baseUrl = `${protocol}://${req.headers.host}`;

      const emailSent = await sendPasswordResetEmail(email, token, baseUrl);
      if (!emailSent) {
        console.error("Failed to send password reset email to:", email);
      }

      res.json({ success: true, message: "If an account exists with this email, a reset link has been sent." });
    } catch (error) {
      console.error("Forgot password error:", error);
      res.status(500).json({ message: "Failed to process request" });
    }
  });

  app.get("/api/verify-reset-token", async (req, res) => {
    try {
      const { token } = req.query;

      if (!token || typeof token !== "string") {
        return res.status(400).json({ valid: false, message: "Token is required" });
      }

      const hashedToken = hashToken(token);
      const resetToken = await storage.getPasswordResetToken(hashedToken);

      if (!resetToken) {
        return res.json({ valid: false, message: "Invalid or expired reset link" });
      }

      if (resetToken.usedAt) {
        return res.json({ valid: false, message: "This reset link has already been used" });
      }

      if (new Date() > resetToken.expiresAt) {
        return res.json({ valid: false, message: "This reset link has expired" });
      }

      res.json({ valid: true });
    } catch (error) {
      console.error("Verify reset token error:", error);
      res.status(500).json({ valid: false, message: "Failed to verify token" });
    }
  });

  app.post("/api/reset-password", async (req: any, res) => {
    try {
      const { token, password, isInvite } = req.body;

      if (!token || !password) {
        return res.status(400).json({ message: "Token and password are required" });
      }

      if (password.length < 12) {
        return res.status(400).json({ message: "Password must be at least 12 characters" });
      }

      const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>]).{12,}$/;
      if (!passwordRegex.test(password)) {
        return res.status(400).json({ message: "Password must include uppercase, lowercase, number, and special character" });
      }

      const hashedToken = hashToken(token);
      const resetToken = await storage.getPasswordResetToken(hashedToken);

      if (!resetToken) {
        return res.status(400).json({ message: "Invalid or expired reset link" });
      }

      if (resetToken.usedAt) {
        return res.status(400).json({ message: "This reset link has already been used" });
      }

      if (new Date() > resetToken.expiresAt) {
        return res.status(400).json({ message: "This reset link has expired" });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      await storage.updateUser(resetToken.userId, { password: hashedPassword });
      // A reset means the old password may be in someone else's hands: end
      // every existing session for the account.
      await storage.destroyAllSessionsForUser(resetToken.userId).catch(() => 0);
      await storage.markPasswordResetTokenUsed(hashedToken);

      // Never auto-login after invite setup — account setup must not open the web app.
      if (isInvite) {
        return res.json({ success: true, message: "Account created successfully" });
      }

      res.json({ success: true, message: "Password has been reset successfully" });
    } catch (error) {
      console.error("Reset password error:", error);
      res.status(500).json({ message: "Failed to reset password" });
    }
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  const mobileSessionId = req.headers['x-session-id'] as string;
  if (mobileSessionId) {
    (req as any).sessionStore.get(mobileSessionId, (err: any, session: any) => {
      if (err || !session) return res.status(401).json({ message: "Unauthorized" });
      const sessionUser = session?.passport?.user;
      if (!sessionUser?.expires_at) return res.status(401).json({ message: "Unauthorized" });
      const now = Math.floor(Date.now() / 1000);
      if (now > sessionUser.expires_at) return res.status(401).json({ message: "Session expired" });
      (req as any).user = sessionUser;
      return next();
    });
    return;
  }
  const user = req.user as any;
  if (!req.isAuthenticated() || !user?.expires_at) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  const now = Math.floor(Date.now() / 1000);
  if (now <= user.expires_at) {
    return next();
  }
  return res.status(401).json({ message: "Session expired" });
};