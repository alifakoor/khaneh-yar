import { describe, expect, it } from "vitest";
import { demoProperties, defaultSettings } from "./defaults";
import { effectiveCost, ratingScore, scoreProperty } from "./scoring";
describe("scoring", () => {
  it("maps subjective ratings", () => {
    expect(ratingScore("poor")).toBe(0);
    expect(ratingScore("average")).toBe(50);
    expect(ratingScore("good")).toBe(100);
  });
  it("sums every cost", () => expect(effectiveCost(demoProperties[0])).toBe(2666000000));
  it("does not penalize cost at target", () => {
    const p = { ...demoProperties[0], costs: { price: 2700000000, renovation: 0, commission: 0, legal: 0, other: 0 } };
    const r = scoreProperty(p, defaultSettings);
    expect(r.value).toBeCloseTo(r.fit);
  });
  it("rejects over max", () => {
    const p = { ...demoProperties[0], costs: { ...demoProperties[0].costs, price: 3000000001 } };
    expect(scoreProperty(p, defaultSettings).rejected).toBe(true);
  });
  it("rejects manual rejected status", () =>
    expect(scoreProperty({ ...demoProperties[0], status: "rejected" }, defaultSettings).rejected).toBe(true));
  it("marks missing data incomplete", () => {
    const r = scoreProperty({ ...demoProperties[0], area: undefined }, defaultSettings);
    expect(r.completeness).toBeLessThan(100);
  });
});

describe("scoring details", () => {
  const base = demoProperties[0];
  const part = (p: typeof base, key: string, s = defaultSettings) =>
    scoreProperty(p, s).parts.find((x) => x.key === key);

  it("scales value linearly between target and max budget", () => {
    const halfway = (defaultSettings.targetBudget + defaultSettings.maxBudget) / 2;
    const p = { ...base, costs: { price: halfway, renovation: 0, commission: 0, legal: 0, other: 0 } };
    const r = scoreProperty(p, defaultSettings);
    expect(r.value).toBeCloseTo(r.fit * 0.5);
    expect(r.rejected).toBe(false);
  });

  it("gives zero value at exactly the max budget without rejecting", () => {
    const p = {
      ...base,
      costs: { price: defaultSettings.maxBudget, renovation: 0, commission: 0, legal: 0, other: 0 },
    };
    const r = scoreProperty(p, defaultSettings);
    expect(r.value).toBe(0);
    expect(r.rejected).toBe(false);
  });

  it("rejects when a required feature is missing but not when it is unknown", () => {
    const missing = scoreProperty({ ...base, parking: false }, defaultSettings);
    expect(missing.rejected).toBe(true);
    expect(missing.reasons).toContain("پارکینگ الزامی است");
    expect(scoreProperty({ ...base, parking: undefined }, defaultSettings).rejected).toBe(false);
  });

  it("penalizes age and floor above target and caps size scores at 100", () => {
    expect(part({ ...base, age: 20 }, "age")?.score).toBe(50);
    expect(part({ ...base, age: 5 }, "age")?.score).toBe(100);
    expect(part({ ...base, area: 180 }, "area")?.score).toBe(100);
    expect(part({ ...base, area: 45 }, "area")?.score).toBe(50);
  });

  it("scores neighborhoods from settings and treats unknown ones as missing data", () => {
    expect(part(base, "neighborhood")?.score).toBe(100);
    const r = scoreProperty({ ...base, neighborhood: "محله ناشناخته" }, defaultSettings);
    expect(r.parts.find((x) => x.key === "neighborhood")).toBeUndefined();
    expect(r.completeness).toBeLessThan(100);
  });

  it("ignores inactive criteria", () => {
    const settings = {
      ...defaultSettings,
      criteria: defaultSettings.criteria.map((c) => (c.key === "parking" ? { ...c, active: false } : c)),
    };
    const r = scoreProperty({ ...base, parking: false }, settings);
    expect(r.parts.find((x) => x.key === "parking")).toBeUndefined();
    expect(r.rejected).toBe(false);
  });

  it("combines fit and value by their weights and stays within 0-100", () => {
    const r = scoreProperty(base, defaultSettings);
    expect(r.total).toBeCloseTo((r.fit * 60 + r.value * 40) / 100);
    for (const p of demoProperties) {
      const s = scoreProperty(p, defaultSettings);
      for (const n of [s.fit, s.value, s.total, s.completeness]) {
        expect(n).toBeGreaterThanOrEqual(0);
        expect(n).toBeLessThanOrEqual(100);
      }
    }
  });

  it("handles settings with no active criteria", () => {
    const r = scoreProperty(base, { ...defaultSettings, criteria: [] });
    expect(r.fit).toBe(0);
    expect(r.completeness).toBe(100);
  });
});

describe("hard minimums", () => {
  const base = demoProperties[0];
  const withMin = (key: string, hardMin: number) => ({
    ...defaultSettings,
    criteria: defaultSettings.criteria.map((c) => (c.key === key ? { ...c, hardMin } : c)),
  });

  it("compares area against square metres, not the score", () => {
    // Default: area hardMin 40 m², target 90 m².
    expect(scoreProperty({ ...base, area: 38 }, defaultSettings).reasons).toContain("متراژ پایین‌تر از حد قطعی است");
    expect(scoreProperty({ ...base, area: 40 }, defaultSettings).rejected).toBe(false);
    expect(scoreProperty({ ...base, area: 41 }, defaultSettings).rejected).toBe(false);
  });

  it("works for numeric criteria without a target", () => {
    const settings = withMin("floor", 1);
    expect(scoreProperty({ ...base, floor: 0 }, settings).reasons).toContain("طبقه پایین‌تر از حد قطعی است");
    expect(scoreProperty({ ...base, floor: 1 }, settings).rejected).toBe(false);
  });

  it("does not reject when the measurement is unknown", () => {
    expect(scoreProperty({ ...base, area: undefined }, defaultSettings).rejected).toBe(false);
  });

  it("still uses the 0-100 score for rating criteria", () => {
    const settings = withMin("light", 50);
    expect(scoreProperty({ ...base, ratings: { ...base.ratings, light: "poor" } }, settings).rejected).toBe(true);
    expect(scoreProperty({ ...base, ratings: { ...base.ratings, light: "average" } }, settings).rejected).toBe(false);
  });
});
