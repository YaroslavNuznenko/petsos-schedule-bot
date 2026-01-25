import { Slot } from "../../domain/schema";

export const pendingSlots = new Map<number, { slots: Slot[]; source: string; sourceType: "voice" | "text" }>();
export const pendingClearConfirmations = new Map<number, string>();
