export type Rating = "poor" | "average" | "good";
export type PropertyType = "apartment" | "villa";
export type PropertyStatus = "saved" | "visited" | "finalist" | "rejected";

export interface Costs { price: number; renovation: number; commission: number; legal: number; other: number }
export interface Ratings { light?: Rating; layout?: Rating; condition?: Rating; noise?: Rating; access?: Rating; document?: Rating; liquidity?: Rating }
export interface Property {
  id: string; title: string; type: PropertyType; status: PropertyStatus; neighborhood: string; address?: string; listingUrl?: string;
  latitude?: number; longitude?: number; area?: number; rooms?: number; age?: number; floor?: number; floors?: number; units?: number;
  elevator?: boolean; parking?: boolean; storage?: boolean; charge?: number; landArea?: number; buildingArea?: number; yard?: boolean;
  costs: Costs; ratings: Ratings; notes?: string; followUps?: string; checklist: string[]; rejectionReason?: string; createdAt: string;
}
export type CriterionKey = "neighborhood"|"area"|"age"|"rooms"|"floor"|"elevator"|"parking"|"storage"|keyof Ratings;
export interface CriterionSetting { key: CriterionKey; label: string; weight: number; active: boolean; target?: number; hardMin?: number; required?: boolean }
export interface Settings { targetBudget: number; maxBudget: number; fitWeight: number; valueWeight: number; criteria: CriterionSetting[]; neighborhoods: Record<string, Rating> }
export interface ScorePart { key: string; label: string; score: number; weight: number }
export interface ScoreResult { fit: number; value: number; total: number; completeness: number; effectiveCost: number; rejected: boolean; reasons: string[]; parts: ScorePart[] }
