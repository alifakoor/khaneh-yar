import { Property, Settings } from "@/lib/types";
import { scoreProperty } from "@/lib/scoring";
import { numberFa, toman } from "@/lib/format";
import { ArrowRight } from "lucide-react";
export function Compare({ items, settings, back }: { items: Property[]; settings: Settings; back: () => void }) {
  const rows = [
    ["نوع", (p: Property) => (p.type === "apartment" ? "آپارتمان" : "ویلایی")],
    ["محله", (p: Property) => p.neighborhood],
    ["متراژ", (p: Property) => numberFa(p.area || 0) + " متر"],
    ["اتاق", (p: Property) => numberFa(p.rooms || 0)],
    ["سن بنا", (p: Property) => numberFa(p.age || 0)],
    ["هزینه مؤثر", (p: Property) => toman(scoreProperty(p, settings).effectiveCost)],
    ["تناسب", (p: Property) => numberFa(scoreProperty(p, settings).fit)],
    ["ارزش خرید", (p: Property) => numberFa(scoreProperty(p, settings).value)],
    ["رتبه کل", (p: Property) => numberFa(scoreProperty(p, settings).total)],
  ] as [string, (p: Property) => string][];
  return (
    <div>
      <header className="mb-7 flex items-center gap-3">
        <button onClick={back} className="btn-ghost p-3">
          <ArrowRight />
        </button>
        <div>
          <h1 className="text-3xl font-black">مقایسه کنار هم</h1>
          <p className="text-sm text-ink/45">تفاوت‌ها را یک‌جا ببینید</p>
        </div>
      </header>
      {items.length < 2 ? (
        <div className="card p-12 text-center text-ink/50">برای مقایسه، دست‌کم دو گزینه را از داشبورد انتخاب کنید.</div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[650px] text-right">
            <thead>
              <tr className="bg-moss text-white">
                <th className="p-4">معیار</th>
                {items.map((p) => (
                  <th className="p-4" key={p.id}>
                    {p.title}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(([l, get], i) => (
                <tr className={i % 2 ? "bg-cream/70" : ""} key={l}>
                  <th className="p-4 text-sm text-ink/45">{l}</th>
                  {items.map((p) => (
                    <td className="p-4 font-bold" key={p.id}>
                      {get(p)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
