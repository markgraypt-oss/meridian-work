// Spam-bot check for the public tester and waitlist forms (27 Oct 2026).
//
// The pattern: a bot puts random letters in the name fields ("Kunuyp Zxnjg",
// "Cjohfk") next to a real, scraped first.last work email. Both have to be
// true to flag a sign-up, so a real person with an unusual name is only caught
// if their email also looks like someone else's name.
//
// Flagged sign-ups are NOT silently dropped: the routes skip every email to the
// address and skip creating the account/row, but still send Mark the admin ping
// marked "Likely bot" with the full details, so a real person can be added by hand.

function letters(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z]/g, "");
}

const VOWELS = new Set(["a", "e", "i", "o", "u", "y"]);

/** True when a single name token reads like random letters. */
export function nameTokenLooksRandom(raw: string): boolean {
  const t = letters(raw);
  if (t.length < 4) return false;
  let run = 0;
  let maxRun = 0;
  let vowels = 0;
  for (const ch of t) {
    if (VOWELS.has(ch)) { vowels++; run = 0; } else { run++; if (run > maxRun) maxRun = run; }
  }
  if (maxRun >= 4) return true;
  if (t.length >= 5 && vowels / t.length < 0.25) return true;
  return false;
}

/** True when the email is first.last style and no part of it matches any submitted name. */
export function emailNameMismatch(email: string, names: string[]): boolean {
  const local = email.split("@")[0].split("+")[0];
  const parts = local.split(/[._-]+/).map(letters).filter((p) => p.length >= 2);
  if (parts.length < 2) return false;
  const tokens = names.flatMap((n) => String(n || "").split(/\s+/)).map(letters).filter((t) => t.length >= 2);
  if (tokens.length === 0) return false;
  const matches = tokens.some((t) =>
    parts.some((p) => p.startsWith(t.slice(0, 3)) || t.startsWith(p.slice(0, 3))),
  );
  return !matches;
}

export function looksLikeBotSignup(input: { names: Array<string | null | undefined>; email: string }): boolean {
  const names = input.names.filter((n): n is string => !!n && !!String(n).trim());
  const anyRandom = names.flatMap((n) => n.split(/\s+/)).some(nameTokenLooksRandom);
  return anyRandom && emailNameMismatch(input.email, names);
}
