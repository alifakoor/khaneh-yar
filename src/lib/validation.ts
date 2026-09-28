import { z } from "zod";

const rating = z.enum(["poor", "average", "good"]);
const optionalNumber = z.number().finite().nonnegative().optional();

export const propertySchema = z
  .object({
    id: z.string().min(1).max(100),
    title: z.string().trim().min(1).max(200),
    type: z.enum(["apartment", "villa"]),
    status: z.enum(["saved", "visited", "finalist", "rejected"]),
    neighborhood: z.string().trim().min(1).max(100),
    address: z.string().max(500).optional(),
    listingUrl: z.string().url().max(2000).optional().or(z.literal("")),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    area: optionalNumber,
    rooms: optionalNumber,
    age: optionalNumber,
    floor: optionalNumber,
    floors: optionalNumber,
    units: optionalNumber,
    elevator: z.boolean().optional(),
    parking: z.boolean().optional(),
    storage: z.boolean().optional(),
    charge: optionalNumber,
    landArea: optionalNumber,
    buildingArea: optionalNumber,
    yard: z.boolean().optional(),
    costs: z.object({
      price: z.number().finite().nonnegative(),
      renovation: z.number().finite().nonnegative(),
      commission: z.number().finite().nonnegative(),
      legal: z.number().finite().nonnegative(),
      other: z.number().finite().nonnegative(),
    }),
    ratings: z.object({
      light: rating.optional(),
      layout: rating.optional(),
      condition: rating.optional(),
      noise: rating.optional(),
      access: rating.optional(),
      document: rating.optional(),
      liquidity: rating.optional(),
    }),
    notes: z.string().max(10000).optional(),
    followUps: z.string().max(10000).optional(),
    checklist: z.array(z.string().max(500)).max(100),
    rejectionReason: z.string().max(2000).optional(),
    createdAt: z.string().datetime(),
  })
  .strict();

const criterionKeys = z.enum([
  "neighborhood",
  "area",
  "age",
  "rooms",
  "floor",
  "elevator",
  "parking",
  "storage",
  "light",
  "layout",
  "condition",
  "noise",
  "access",
  "document",
  "liquidity",
]);
export const settingsSchema = z
  .object({
    targetBudget: z.number().finite().nonnegative(),
    maxBudget: z.number().finite().nonnegative(),
    fitWeight: z.number().finite().min(0).max(100),
    valueWeight: z.number().finite().min(0).max(100),
    criteria: z
      .array(
        z
          .object({
            key: criterionKeys,
            label: z.string().min(1).max(100),
            weight: z.number().finite().nonnegative(),
            active: z.boolean(),
            target: optionalNumber,
            hardMin: optionalNumber,
            required: z.boolean().optional(),
          })
          .strict(),
      )
      .max(100),
    neighborhoods: z.record(z.string().min(1).max(100), rating),
  })
  .strict()
  .refine((v) => Math.abs(v.fitWeight + v.valueWeight - 100) < 0.001, "مجموع وزن‌ها باید ۱۰۰ باشد");

export const loginSchema = z
  .object({ username: z.string().trim().min(1).max(100), password: z.string().min(1).max(1000) })
  .strict();
export const changePasswordSchema = z
  .object({ currentPassword: z.string().min(1).max(1000), newPassword: z.string().min(12).max(1000) })
  .strict();
