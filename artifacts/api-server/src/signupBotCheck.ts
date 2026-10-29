// Spam-bot check for the public tester and waitlist forms.
// 27 Oct 2026, v2: v1 let "Unfcez" through on the tester form. v2 scores how
// name-like each word is and remembers bot emails across both forms.
// 29 Oct 2026, v3: v2 let "Dghyigr Qfwvo" <garysgreen@...> through because the
// email check only worked on first.last addresses, and the company and role
// fields ("Lpghomuklg LLC", "DeFliTNAVOjEMpGibJ") were never checked.
//
// The pattern: a bot puts random letters in the name, company and role fields
// next to a real, scraped email. A sign-up is blocked when
//   (a) any name, company or role word is a jumble of upper and lower case
//       ("DeFliTNAVOjEMpGibJ"), or
//   (b) any name, company or role word looks like random letters AND the email
//       (any style, dotted or not) matches none of the person's names, or
//   (c) the same email was blocked on either form in the last 24 hours and the
//       name doesn't match it (so the real owner of the address still gets in).
//
// Blocked sign-ups are NOT silently dropped: the routes skip every email to the
// address and skip creating the account/row, but still send Mark the admin ping
// marked "Likely bot", so a real person can be added by hand.

function letters(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z]/g, "");
}

// Average log-probability of each letter following the one before it, learned
// from ~100,000 real first names and surnames (US, UK, Irish, Polish, German,
// Spanish, Italian, French, Indian, Chinese, Nigerian and more).
// Rows: previous letter ("^" = start of word, then a-z). Columns: next letter (a-z, then "$" = end of word).
const PREV = "^abcdefghijklmnopqrstuvwxyz";
const NEXT = "abcdefghijklmnopqrstuvwxyz$";
const PAIR_LOGP: number[][] = [
  [-2.65,-2.6,-2.92,-3.27,-3.41,-3.47,-2.93,-2.97,-3.91,-3.42,-3.12,-2.97,-2.58,-3.59,-3.79,-3.08,-5.38,-3.04,-2.52,-3.22,-4.68,-3.56,-3.6,-5.76,-4.33,-3.93,-13.81],
  [-5.3,-3.55,-3.59,-3.5,-4.57,-4.98,-3.68,-4.13,-3.5,-5.22,-4.11,-2.49,-3.23,-1.8,-4.94,-4.82,-6.47,-2.01,-2.89,-3.23,-3.4,-4.17,-5.14,-6.44,-4.09,-4.39,-1.72],
  [-1.44,-4.28,-7.79,-4.37,-1.37,-8.34,-7.79,-4.7,-2.46,-6.31,-6.19,-3.52,-7.18,-6.28,-2.1,-12.05,-12.05,-2.13,-4.97,-6.61,-2.67,-6.65,-9.01,-12.05,-4.41,-7.1,-4.07],
  [-1.9,-9.24,-4.29,-8.02,-2.8,-9.24,-6.05,-0.86,-2.79,-8.85,-2.35,-4.13,-8.85,-8.02,-2.26,-6.8,-5.57,-4.36,-6.34,-5.66,-3.78,-8.85,-8.57,-12.28,-5.4,-4.82,-4.27],
  [-1.86,-6.29,-6.98,-3.99,-1.53,-7.16,-5.38,-4.46,-2.03,-5.1,-5.38,-4.36,-4.88,-5.5,-1.99,-8.74,-9.78,-2.79,-4.16,-3.38,-3.27,-6.65,-4.89,-9.78,-4.01,-4.94,-2.26],
  [-4.16,-4.15,-3.89,-3.69,-4.34,-4.97,-3.91,-4.59,-2.86,-5.51,-4.54,-2.3,-3.95,-1.97,-5.09,-4.94,-7.17,-1.49,-2.81,-3.16,-4.45,-3.6,-4.87,-6.2,-4.15,-4.26,-2.11],
  [-2.22,-7.26,-7.43,-6.57,-1.52,-2.08,-5.11,-5.97,-2.38,-11.37,-5.97,-3.21,-4.66,-4.98,-2.56,-8.32,-11.37,-2.2,-4.15,-4.04,-3.39,-11.37,-8.32,-11.37,-7.1,-7.26,-2.07],
  [-1.73,-6.24,-7.36,-5.53,-1.71,-6.08,-3.77,-3.4,-2.79,-7.06,-6.3,-3.5,-4.75,-4.09,-2.26,-7.81,-8.64,-2.38,-4.4,-5.16,-2.13,-9.67,-6.27,-8.36,-5.92,-7.46,-2.15],
  [-1.44,-5.54,-7.2,-6.12,-1.74,-7.07,-6.01,-5.68,-2.35,-7.2,-4.6,-3.34,-3.41,-3.47,-2.13,-7.54,-12.55,-3.63,-4.3,-3.97,-2.8,-6.26,-4.81,-12.55,-4.93,-8.04,-2.19],
  [-2.6,-4.11,-2.88,-3.4,-2.49,-4.85,-3.55,-4.96,-7.56,-5.14,-3.68,-2.62,-3.46,-1.64,-3.54,-4.96,-5.8,-3.0,-2.67,-2.95,-4.79,-4.43,-7.56,-5.55,-5.4,-3.92,-2.26],
  [-1.09,-6.98,-4.7,-5.18,-1.74,-8.52,-6.81,-5.61,-2.44,-5.72,-5.43,-6.3,-5.9,-4.83,-1.61,-6.81,-10.92,-6.81,-5.66,-6.41,-1.98,-6.3,-6.98,-10.92,-6.52,-8.52,-4.39],
  [-2.0,-6.34,-9.65,-7.17,-1.78,-7.53,-7.53,-2.8,-2.17,-6.34,-5.57,-3.45,-4.92,-4.72,-1.82,-7.78,-9.65,-3.19,-3.76,-5.85,-3.3,-7.43,-5.0,-7.78,-2.88,-9.65,-2.01],
  [-1.81,-4.16,-4.73,-3.31,-1.88,-4.82,-4.93,-4.42,-2.06,-7.15,-4.44,-2.11,-3.99,-5.74,-2.5,-5.62,-7.49,-6.32,-3.81,-3.86,-3.46,-4.67,-6.42,-8.96,-3.97,-4.81,-2.19],
  [-1.08,-3.44,-4.78,-6.4,-1.83,-6.43,-6.07,-4.71,-2.02,-7.18,-5.4,-5.53,-3.72,-6.22,-2.23,-3.63,-12.26,-5.54,-4.31,-6.74,-2.92,-8.33,-8.0,-12.26,-4.61,-7.65,-2.86],
  [-2.34,-4.44,-3.63,-2.66,-2.32,-5.63,-2.84,-4.05,-2.58,-5.53,-3.53,-5.65,-5.85,-2.92,-2.82,-6.67,-6.89,-5.33,-3.02,-3.06,-4.75,-7.13,-6.22,-7.58,-4.77,-4.29,-1.38],
  [-4.6,-3.85,-3.9,-3.96,-3.93,-3.64,-4.36,-3.78,-4.09,-5.36,-4.63,-2.48,-3.5,-2.09,-4.08,-4.13,-6.74,-2.17,-2.82,-3.37,-3.18,-2.59,-3.92,-6.16,-4.74,-4.67,-1.72],
  [-1.59,-6.06,-5.75,-7.07,-1.49,-3.24,-6.67,-3.01,-2.27,-8.42,-4.84,-3.64,-5.31,-6.44,-2.21,-2.93,-11.46,-2.78,-4.27,-4.25,-3.41,-11.46,-7.75,-11.46,-4.97,-9.06,-3.3],
  [-4.52,-6.43,-9.47,-9.47,-7.07,-9.47,-9.47,-9.47,-3.01,-9.47,-9.47,-7.07,-7.07,-9.47,-9.47,-9.47,-9.47,-7.07,-9.47,-7.07,-0.11,-9.47,-6.04,-9.47,-9.47,-9.47,-3.36],
  [-1.97,-4.42,-4.13,-3.53,-2.24,-5.02,-3.59,-5.23,-2.14,-5.67,-4.35,-4.11,-4.03,-3.66,-2.35,-5.59,-6.47,-2.97,-3.53,-2.94,-3.26,-5.52,-6.15,-8.45,-4.11,-4.54,-1.86],
  [-2.39,-5.41,-2.29,-6.11,-2.32,-6.98,-6.33,-2.89,-3.0,-7.7,-2.93,-4.48,-4.46,-5.12,-2.75,-4.22,-6.0,-5.63,-2.8,-2.31,-3.84,-5.59,-5.85,-12.84,-5.27,-4.71,-1.49],
  [-2.13,-6.47,-4.7,-6.8,-1.75,-6.83,-5.2,-2.41,-2.47,-5.87,-4.78,-4.65,-4.82,-5.26,-2.39,-7.98,-10.2,-3.01,-3.19,-2.75,-3.52,-7.12,-5.51,-5.05,-4.51,-3.17,-1.96],
  [-3.29,-3.3,-3.15,-3.35,-2.36,-4.27,-3.61,-3.71,-2.77,-4.96,-3.74,-2.72,-3.13,-2.44,-5.16,-4.05,-6.22,-2.11,-2.26,-3.03,-7.88,-5.3,-5.58,-5.59,-5.09,-4.0,-2.8],
  [-1.72,-7.7,-6.23,-5.92,-1.69,-11.63,-6.06,-7.91,-1.63,-7.7,-5.54,-4.65,-7.7,-6.14,-2.79,-11.63,-11.63,-4.5,-3.38,-5.54,-5.21,-8.19,-11.63,-11.63,-4.18,-7.91,-1.26],
  [-1.44,-7.27,-5.46,-5.28,-1.48,-7.55,-8.59,-4.92,-1.55,-10.99,-5.12,-4.97,-5.59,-4.54,-2.4,-10.99,-10.99,-3.61,-2.48,-4.97,-3.9,-8.59,-10.99,-10.99,-5.1,-7.27,-3.18],
  [-1.75,-5.73,-5.51,-7.04,-1.93,-9.44,-9.44,-5.73,-1.3,-9.44,-6.4,-3.95,-5.33,-5.18,-2.4,-4.82,-7.04,-6.4,-5.73,-4.09,-2.75,-4.82,-7.04,-3.8,-5.05,-9.44,-1.95],
  [-1.71,-4.48,-4.53,-4.26,-2.59,-6.55,-5.14,-5.39,-4.27,-5.73,-4.24,-3.19,-3.99,-2.98,-3.18,-5.94,-11.5,-3.75,-3.44,-4.7,-2.98,-5.51,-7.11,-11.5,-6.79,-4.95,-0.96],
  [-1.6,-4.79,-4.51,-5.6,-2.14,-7.38,-5.19,-2.63,-2.5,-8.05,-3.84,-4.26,-4.41,-4.4,-2.69,-5.12,-5.21,-5.68,-3.89,-4.72,-2.97,-6.47,-5.37,-9.09,-3.61,-3.98,-1.51],
];

// Tested 27 Oct 2026: catches all 9 bot names seen so far and ~80% of random
// letter strings; flags ~0.1% of real names (before the email check is applied).
const RANDOM_THRESHOLD = -3.75;

export function nameScore(raw: string): number {
  const s = "^" + letters(raw) + "$";
  let total = 0;
  for (let i = 1; i < s.length; i++) {
    total += PAIR_LOGP[PREV.indexOf(s[i - 1])][NEXT.indexOf(s[i])];
  }
  return total / (s.length - 1);
}

/** True when a single name word reads like random letters. */
export function nameTokenLooksRandom(raw: string): boolean {
  const t = letters(raw);
  if (t.length < 5) return false;
  return nameScore(t) < RANDOM_THRESHOLD;
}

/** True when a word is a jumble of upper and lower case, e.g. "DeFliTNAVOjEMpGibJ".
 *  Real names and brands ("McDonald", "OpenAI", "LinkedIn") switch case a few times at most. */
export function tokenIsCaseJumble(raw: string): boolean {
  const t = String(raw || "").replace(/[^A-Za-z]/g, "");
  if (t.length < 10) return false;
  let switches = 0;
  for (let i = 1; i < t.length; i++) {
    const a = t[i - 1] === t[i - 1].toUpperCase();
    const b = t[i] === t[i].toUpperCase();
    if (a !== b) switches++;
  }
  return switches >= 6;
}

/** True when no part of the email matches any submitted name. Works on any email
 *  style: first.last, firstlast, jsmith, john. */
export function emailNameMismatch(email: string, names: string[]): boolean {
  const local = email.split("@")[0].split("+")[0];
  const parts = local.split(/[._-]+/).map(letters).filter((p) => p.length >= 2);
  if (parts.length === 0) return false;
  const whole = letters(local);
  const tokens = names.flatMap((n) => String(n || "").split(/\s+/)).map(letters).filter((t) => t.length >= 2);
  if (tokens.length === 0) return false;
  const matches = tokens.some((t) =>
    parts.some((p) =>
      p.startsWith(t.slice(0, 3)) || t.startsWith(p.slice(0, 3)) ||
      // Short names are often nicknames (Tom for thomas., Liz for elizabeth.):
      // a shared first letter counts. Bot names are 5+ letters, so this doesn't weaken the check.
      (t.length <= 4 && p[0] === t[0])) ||
    // Undotted emails: "jsmith" or "garysgreen" contain the name without a separator.
    (t.length >= 3 && whole.includes(t.slice(0, 3))),
  );
  return !matches;
}

// Emails blocked in the last 24 hours, on either form. In memory, so it resets
// on Republish; that only loses the cross-form memory, not the name check.
const BOT_EMAIL_TTL_MS = 24 * 60 * 60 * 1000;
const recentBotEmails = new Map<string, number>();

function rememberBotEmail(email: string): void {
  const now = Date.now();
  for (const [e, until] of recentBotEmails) if (until < now) recentBotEmails.delete(e);
  recentBotEmails.set(email.toLowerCase(), now + BOT_EMAIL_TTL_MS);
}

function isRecentBotEmail(email: string): boolean {
  const until = recentBotEmails.get(email.toLowerCase());
  return !!until && until > Date.now();
}

export function looksLikeBotSignup(input: {
  names: Array<string | null | undefined>;
  /** Other free-text fields (company, role). Checked for random letters, not matched against the email. */
  extra?: Array<string | null | undefined>;
  email: string;
}): boolean {
  const clean = (arr: Array<string | null | undefined>) => arr.filter((n): n is string => !!n && !!String(n).trim());
  const names = clean(input.names);
  const extra = clean(input.extra || []);
  const words = [...names, ...extra].flatMap((n) => n.split(/\s+/));
  const mismatch = emailNameMismatch(input.email, names);
  // A bot's email is a real person's scraped address, so the 24-hour memory only
  // blocks when the name doesn't match it; the real owner still gets through.
  if (mismatch && isRecentBotEmail(input.email)) return true;
  const caseJumble = words.some(tokenIsCaseJumble);
  const anyRandom = words.some(nameTokenLooksRandom);
  const bot = caseJumble || (anyRandom && mismatch);
  if (bot) rememberBotEmail(input.email);
  return bot;
}
