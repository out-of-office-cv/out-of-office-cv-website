import { z } from "zod";
import { GIG_CATEGORIES } from "../.vitepress/types";

export const GigSchema = z.object({
  role: z.string().min(1),
  organisation: z.string().min(1),
  category: z.enum(GIG_CATEGORIES),
  sources: z.array(z.string().url()).min(1),
  verified_by: z.string().optional(),
  pollie_slug: z.string().min(1),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
});

export const GigsArraySchema = z.array(GigSchema);

export type GigFromSchema = z.infer<typeof GigSchema>;
