import type { Express } from "express";
import { z } from "zod";
import { isAuthenticated } from "./replitAuth";
import { storage } from "./storage";
import { notify, getVapidPublicKey } from "./notifications";
import { NOTIFICATION_CATEGORIES, type NotificationCategory } from "@shared/schema";

const subscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
  userAgent: z.string().optional(),
});

const testSchema = z.object({
  category: z.enum(NOTIFICATION_CATEGORIES as readonly [NotificationCategory, ...NotificationCategory[]]).optional(),
});

export function registerNotificationRoutes(app: Express): void {
  app.get("/api/notifications/vapid-public-key", (_req, res) => {
    res.json({ publicKey: getVapidPublicKey() });
  });

  app.get("/api/notifications", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const limit = Math.min(parseInt(String(req.query.limit ?? "30"), 10) || 30, 100);
      const unreadOnly = req.query.unreadOnly === "true";
      const items = await storage.listUserNotifications(userId, { limit, unreadOnly });
      res.json(items);
    } catch (e) {
      console.error("[notifications] list error:", e);
      res.status(500).json({ message: "Failed to list notifications" });
    }
  });

  app.get("/api/notifications/unread-count", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const count = await storage.countUnreadNotifications(userId);
      res.json({ count });
    } catch (e) {
      console.error("[notifications] count error:", e);
      res.status(500).json({ message: "Failed to count notifications" });
    }
  });

  app.post("/api/notifications/:id/read", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const id = parseInt(req.params.id, 10);
      if (Number.isNaN(id)) return res.status(400).json({ message: "Invalid id" });
      await storage.markNotificationRead(id, userId);
      res.json({ ok: true });
    } catch (e) {
      console.error("[notifications] mark read error:", e);
      res.status(500).json({ message: "Failed to mark read" });
    }
  });

  app.post("/api/notifications/read-all", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      await storage.markAllNotificationsRead(userId);
      res.json({ ok: true });
    } catch (e) {
      console.error("[notifications] mark all read error:", e);
      res.status(500).json({ message: "Failed to mark all read" });
    }
  });

  app.post("/api/push/subscribe", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const parsed = subscribeSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid subscription", errors: parsed.error.flatten() });
      }
      const sub = parsed.data;
      const saved = await storage.upsertPushSubscription({
        userId,
        endpoint: sub.endpoint,
        p256dh: sub.keys.p256dh,
        auth: sub.keys.auth,
        userAgent: sub.userAgent ?? req.headers["user-agent"]?.toString().slice(0, 255) ?? null,
      });
      res.json({ ok: true, id: saved.id });
    } catch (e) {
      console.error("[push] subscribe error:", e);
      res.status(500).json({ message: "Failed to save push subscription" });
    }
  });

  app.post("/api/push/unsubscribe", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const endpoint = String(req.body?.endpoint || "");
      if (!endpoint) return res.status(400).json({ message: "endpoint required" });
      await storage.deletePushSubscriptionByEndpoint(userId, endpoint);
      res.json({ ok: true });
    } catch (e) {
      console.error("[push] unsubscribe error:", e);
      res.status(500).json({ message: "Failed to unsubscribe" });
    }
  });

  app.post("/api/notifications/test", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const parsed = testSchema.safeParse(req.body || {});
      const category = (parsed.success && parsed.data.category) || "admin";
      const result = await notify({
        userId,
        category,
        title: "Test notification",
        body: "If you can see this, your notifications are wired up correctly.",
        data: { url: "/profile/notifications" },
        force: true,
        disableEmail: true,
      });
      res.json(result);
    } catch (e) {
      console.error("[notifications] test error:", e);
      res.status(500).json({ message: "Failed to send test" });
    }
  });
}
