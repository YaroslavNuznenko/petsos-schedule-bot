import { z } from "zod";

export const SlotSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Time must be in HH:mm format"),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "Time must be in HH:mm format"),
  type: z.enum(["URGENT", "VP"]),
});

export type Slot = z.infer<typeof SlotSchema>;
export const SlotsArraySchema = z.array(SlotSchema);
