import { z } from "zod";
import { GIG_CATEGORIES } from "../src/types";

export const VerificationSchema = z.object({
  decision: z.enum(["verified", "rejected"]),
  by: z.string().min(1),
  note: z.string().optional(),
});

export const GigSchema = z.object({
  role: z.string().min(1),
  organisation: z.string().min(1),
  category: z.enum(GIG_CATEGORIES),
  sources: z
    .array(z.url())
    .min(1)
    .refine((urls) => new Set(urls).size === urls.length, {
      message: "sources must not contain duplicate URLs",
    }),
  verification: VerificationSchema.optional(),
  pollie_slug: z.string().min(1),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
});

export const GigsArraySchema = z.array(GigSchema);

export type GigFromSchema = z.infer<typeof GigSchema>;
