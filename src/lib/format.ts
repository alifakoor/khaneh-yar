export const toman = (n: number) => new Intl.NumberFormat("fa-IR").format(n) + " تومان";
export const numberFa = (n: number) => new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 0 }).format(n);
export const statusLabels = {
  saved: "ذخیره‌شده",
  visited: "بازدیدشده",
  finalist: "فهرست نهایی",
  rejected: "ردشده",
} as const;
export const ratingLabels = { poor: "ضعیف", average: "متوسط", good: "خوب" } as const;
/** True only for absolute http(s) URLs; blocks `javascript:` and other schemes in rendered links. */
export function isHttpUrl(value: string) {
  try {
    const { protocol } = new URL(value);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}
