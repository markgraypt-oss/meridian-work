import type { User } from "@workspace/db";

// What the client is allowed to see of a users row. The row itself carries
// the bcrypt password hash and internal bookkeeping; `/api/auth/user` used to
// send the whole row to the app on every launch.
const HIDDEN_FIELDS = new Set([
  "password",
  "resetToken",
  "resetTokenExpiry",
  "passwordResetToken",
  "passwordResetExpires",
  "stripeCustomerId",
]);

export function publicUser<T extends Partial<User> | null | undefined>(user: T): T {
  if (!user || typeof user !== "object") return user;
  const out: any = {};
  for (const [k, v] of Object.entries(user as any)) {
    if (HIDDEN_FIELDS.has(k)) continue;
    out[k] = v;
  }
  return out;
}
