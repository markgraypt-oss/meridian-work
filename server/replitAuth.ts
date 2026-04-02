import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import connectPg from "connect-pg-simple";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { Resend } from "resend";
import { storage } from "./storage";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

export function generateResetToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

async function sendPasswordResetEmail(email: string, token: string, baseUrl: string): Promise<boolean> {
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
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff;">
          <img src="${baseUrl}/email-banner.png" alt="MeridianWork" style="width: 100%; max-height: 120px; object-fit: cover; display: block;" />
          <div style="padding: 20px;">
            <h2 style="color: #333; font-size: 28px; margin: 0 0 16px 0;">Password Reset Request</h2>
            <p style="font-size: 18px; line-height: 1.6; color: #333; margin-bottom: 16px;">You requested to reset your password for the MeridianWork Platform.</p>
            <p style="font-size: 18px; line-height: 1.6; color: #333; margin-bottom: 24px;">Click the button below to set a new password:</p>
            <a href="${resetUrl}" style="display: inline-block; background-color: #09b5f9; color: #ffffff !important; padding: 14px 28px; text-decoration: none; border-radius: 6px; margin: 16px 0; font-size: 18px; font-weight: 600;">Reset Password</a>
            <p style="color: #666; font-size: 15px; margin-top: 24px;">This link will expire in 1 hour.</p>
            <p style="color: #666; font-size: 15px;">If you didn't request this, you can safely ignore this email.</p>
          </div>
        </div>
      `,
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
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff;">
          <img src="${baseUrl}/email-banner.png" alt="MeridianWork" style="width: 100%; max-height: 120px; object-fit: cover; display: block;" />
          <div style="padding: 20px;">
            <h2 style="color: #333; font-size: 28px; margin: 0 0 16px 0;">Welcome to Meridian - Peak performance at work!</h2>
            <p style="font-size: 18px; line-height: 1.6; color: #333; margin-bottom: 16px;">${greeting}</p>
            <p style="font-size: 18px; line-height: 1.6; color: #333; margin-bottom: 16px;">You've been invited to join the MeridianWork platform.</p>
            <p style="font-size: 18px; line-height: 1.6; color: #333; margin-bottom: 24px;">Click the button below to set up your password and get started:</p>
            <a href="${setupUrl}" style="display: inline-block; background-color: #09b5f9; color: #ffffff !important; padding: 14px 28px; text-decoration: none; border-radius: 6px; margin: 16px 0; font-size: 18px; font-weight: 600;">Set Up Your Account</a>
            <p style="color: #666; font-size: 15px; margin-top: 24px;">This link will expire in 24 hours.</p>
            <p style="color: #666; font-size: 15px;">If you have any questions, please contact your administrator.</p>
          </div>
        </div>
      `,
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
      sameSite: isProduction ? "none" : "lax",
      maxAge: sessionTtl,
    },
  });
}

const ADMIN_NOTIFICATION_EMAIL = process.env.ADMIN_NOTIFICATION_EMAIL || "no-reply@meridian.work";

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
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 32px;">
          <h2 style="color: #1a1a2e; margin-bottom: 24px;">New User First Login</h2>
          <p style="color: #333; font-size: 16px; margin-bottom: 16px;">A new user has successfully logged in for the first time:</p>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
            <tr><td style="padding: 8px 12px; color: #666; font-weight: bold;">Name</td><td style="padding: 8px 12px; color: #333;">${name}</td></tr>
            <tr style="background-color: #f9f9f9;"><td style="padding: 8px 12px; color: #666; font-weight: bold;">Email</td><td style="padding: 8px 12px; color: #333;">${email}</td></tr>
            <tr><td style="padding: 8px 12px; color: #666; font-weight: bold;">Company</td><td style="padding: 8px 12px; color: #333;">${company}</td></tr>
            <tr style="background-color: #f9f9f9;"><td style="padding: 8px 12px; color: #666; font-weight: bold;">Time</td><td style="padding: 8px 12px; color: #333;">${new Date().toLocaleString("en-GB", { timeZone: "Europe/Madrid", timeZoneName: "short" })}</td></tr>
          </table>
          <p style="color: #999; font-size: 12px;">This is an automated notification from MeridianWork.</p>
        </div>
      `,
    });

    if (error) {
      console.error("[FIRST-LOGIN] Failed to send notification:", error);
    } else {
      console.log(`[FIRST-LOGIN] Notification sent for user: ${email}`);
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

  app.post("/api/login", async (req, res) => {
    console.log("[LOGIN] Attempt received:", { email: req.body?.email });
    try {
      const { email, password } = req.body;
      
      if (!email || !password) {
        console.log("[LOGIN] Missing email or password");
        return res.status(400).json({ message: "Email and password are required" });
      }

      const user = await storage.getUserByEmailWithPassword(email);
      console.log("[LOGIN] User found:", user ? { id: user.id, email: user.email, hasPassword: !!user.password } : null);
      
      if (!user) {
        console.log("[LOGIN] No user with password found for email:", email);
        return res.status(401).json({ message: "Invalid email or password" });
      }

      const isValidPassword = await bcrypt.compare(password, user.password!);
      console.log("[LOGIN] Password valid:", isValidPassword);
      
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
        res.json({ success: true, user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, isAdmin: user.isAdmin } });
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Login failed" });
    }
  });


  app.get("/api/logout", (req, res) => {
    req.logout(() => {
      res.redirect("/");
    });
  });

  app.post("/api/logout", (req, res) => {
    req.logout(() => {
      res.json({ success: true });
    });
  });

  app.post("/api/forgot-password", async (req, res) => {
    try {
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }

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

      if (password.length < 8) {
        return res.status(400).json({ message: "Password must be at least 8 characters" });
      }

      const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>]).{8,}$/;
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
      await storage.markPasswordResetTokenUsed(hashedToken);

      if (isInvite) {
        const user = await storage.getUser(resetToken.userId);
        if (user) {
          req.session.user = {
            claims: {
              sub: user.id,
              email: user.email,
              first_name: user.firstName,
              last_name: user.lastName,
            },
            expires_at: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60),
          };
          await new Promise<void>((resolve, reject) => {
            req.session.save((err: any) => {
              if (err) reject(err);
              else resolve();
            });
          });
          return res.json({ success: true, autoLogin: true, message: "Account created and logged in" });
        }
      }

      res.json({ success: true, message: "Password has been reset successfully" });
    } catch (error) {
      console.error("Reset password error:", error);
      res.status(500).json({ message: "Failed to reset password" });
    }
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
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
