/**
 * Outbound dial policy. Block lists are typed constants in code (not env vars)
 * so changes show in review diffs, are covered by tests, and cannot drift per
 * environment. Defense in depth only: the lists fail open for codes not on
 * them. Twilio Voice Geo Permissions (US/CA only) is the authoritative control.
 */

const PREMIUM_RATE = [900];

const NON_GEOGRAPHIC_OR_SPECIAL = [
  456, 500, 533, 544, 566, 577, 588, 600, 622, 633, 644, 655, 677, 688, 700,
  710, 880, 881, 882,
];

// Caribbean and Bermuda, charged at international rates (wangiri / "809" scam range).
const CARIBBEAN_AND_BERMUDA = [
  242, 246, 264, 268, 284, 345, 441, 473, 649, 658, 664, 721, 758, 767, 784,
  809, 829, 849, 868, 869, 876,
];

const US_TERRITORIES = [340, 670, 671, 684, 787, 939];

export const BLOCKED_NANP_AREA_CODES: ReadonlySet<string> = new Set(
  [
    ...PREMIUM_RATE,
    ...NON_GEOGRAPHIC_OR_SPECIAL,
    ...CARIBBEAN_AND_BERMUDA,
    ...US_TERRITORIES,
  ].map(String),
);

/** Legacy premium exchange. */
export const BLOCKED_NANP_EXCHANGES: ReadonlySet<string> = new Set(["976"]);

const NANP_E164_RE = /^\+1[2-9]\d{2}[2-9]\d{6}$/;

/** Normalizes US/Canada (NANP) input to E.164, or null if it is not a valid NANP number. */
export function normalizeNanp(raw: string): string | null {
  const cleaned = raw.replace(/[^\d+]/g, "");
  let candidate: string;
  if (/^\+1\d{10}$/.test(cleaned)) {
    candidate = cleaned;
  } else if (/^\d{10}$/.test(cleaned)) {
    candidate = `+1${cleaned}`;
  } else if (/^1\d{10}$/.test(cleaned)) {
    candidate = `+${cleaned}`;
  } else {
    return null;
  }
  return NANP_E164_RE.test(candidate) ? candidate : null;
}

export type DialCheck =
  | { ok: true; e164: string }
  | { ok: false; reason: "invalid" | "blocked" };

export function checkDialable(raw: string): DialCheck {
  const e164 = normalizeNanp(raw);
  if (!e164) return { ok: false, reason: "invalid" };
  const npa = e164.slice(2, 5);
  const nxx = e164.slice(5, 8);
  if (BLOCKED_NANP_AREA_CODES.has(npa) || BLOCKED_NANP_EXCHANGES.has(nxx)) {
    return { ok: false, reason: "blocked" };
  }
  return { ok: true, e164 };
}
