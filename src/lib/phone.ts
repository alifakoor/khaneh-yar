/** Converts Persian (۰-۹) and Arabic-Indic (٠-٩) digits to ASCII digits. */
export function toLatinDigits(value: string) {
  return value
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));
}

/** Normalizes an Iranian mobile number to `09XXXXXXXXX`, or returns null if it is not one. */
export function normalizePhone(input: string): string | null {
  let s = toLatinDigits(input).replace(/[\s\-()]/g, "");
  if (s.startsWith("+98")) s = s.slice(3);
  else if (s.startsWith("0098")) s = s.slice(4);
  else if (s.startsWith("98") && s.length === 12) s = s.slice(2);
  else if (s.startsWith("0")) s = s.slice(1);
  return /^9\d{9}$/.test(s) ? `0${s}` : null;
}
