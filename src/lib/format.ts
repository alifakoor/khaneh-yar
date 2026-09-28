export const toman = (n: number) => new Intl.NumberFormat("fa-IR").format(n) + " تومان";
export const numberFa = (n: number) => new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 0 }).format(n);
export const statusLabels = {
  saved: "ذخیره‌شده",
  visited: "بازدیدشده",
  finalist: "فهرست نهایی",
  rejected: "ردشده",
} as const;
export const ratingLabels = { poor: "ضعیف", average: "متوسط", good: "خوب" } as const;
