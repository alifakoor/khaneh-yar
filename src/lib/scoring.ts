import { CriterionKey, Property, Rating, ScoreResult, Settings } from "./types";

export const ratingScore = (value?: Rating) => value === "good" ? 100 : value === "average" ? 50 : value === "poor" ? 0 : undefined;
export const effectiveCost = (p: Property) => Object.values(p.costs).reduce((sum, n) => sum + (Number(n) || 0), 0);
const clamp = (n: number) => Math.max(0, Math.min(100, n));

function criterionValue(key: CriterionKey, p: Property, s: Settings): number | undefined {
  if (key === "neighborhood") return ratingScore(s.neighborhoods[p.neighborhood]);
  if (["light","layout","condition","noise","access","document","liquidity"].includes(key)) return ratingScore(p.ratings[key as keyof typeof p.ratings]);
  if (["elevator","parking","storage"].includes(key)) {
    const value = p[key as "elevator"|"parking"|"storage"];
    return value === undefined ? undefined : value ? 100 : 0;
  }
  const value = p[key as "area"|"age"|"rooms"|"floor"];
  if (value === undefined) return undefined;
  const setting = s.criteria.find(c => c.key === key);
  if (!setting?.target) return 100;
  if (key === "age" || key === "floor") return clamp(100 - Math.max(0, value - setting.target) / Math.max(setting.target, 1) * 50);
  return clamp(value / setting.target * 100);
}

export function scoreProperty(p: Property, s: Settings): ScoreResult {
  const cost = effectiveCost(p); const reasons: string[] = [];
  if (p.status === "rejected") reasons.push(p.rejectionReason ? `ردشده: ${p.rejectionReason}` : "این گزینه به‌صورت دستی رد شده است");
  if (cost > s.maxBudget) reasons.push("هزینه مؤثر بیشتر از سقف بودجه است");
  const active = s.criteria.filter(c => c.active);
  const parts = active.flatMap(c => { const score = criterionValue(c.key, p, s); if (score === undefined) return []; if (c.hardMin !== undefined && score < c.hardMin) reasons.push(`${c.label} پایین‌تر از حد قطعی است`); if (c.required && score === 0) reasons.push(`${c.label} الزامی است`); return [{ key:c.key, label:c.label, score, weight:c.weight }]; });
  const knownWeight = parts.reduce((n,p) => n+p.weight,0); const allWeight = active.reduce((n,c)=>n+c.weight,0);
  const fit = knownWeight ? parts.reduce((n,p)=>n+p.score*p.weight,0)/knownWeight : 0;
  const costFactor = cost <= s.targetBudget ? 1 : cost >= s.maxBudget ? 0 : 1-(cost-s.targetBudget)/(s.maxBudget-s.targetBudget);
  const value = fit * costFactor; const totalWeight = s.fitWeight+s.valueWeight || 1;
  return { fit:clamp(fit), value:clamp(value), total:clamp((fit*s.fitWeight+value*s.valueWeight)/totalWeight), completeness:allWeight ? knownWeight/allWeight*100 : 100, effectiveCost:cost, rejected:reasons.length>0, reasons, parts };
}
