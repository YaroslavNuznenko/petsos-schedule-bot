import { getCurrentKyivDate } from "../../domain/normalize";
import { Slot } from "../../domain/schema";

export function formatSlots(slots: Slot[]): string {
  if (slots.length === 0) {
    return "Слотів не знайдено.";
  }

  return slots
    .map(
      (slot, idx) =>
        `${idx + 1}. ${slot.date} ${slot.startTime}-${slot.endTime} (${slot.type})`
    )
    .join("\n");
}

export function getCurrentMonth(): string {
  const kyivDate = getCurrentKyivDate();
  const year = kyivDate.getFullYear();
  const month = String(kyivDate.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export function parseYearMonth(input: string | undefined): string {
  if (!input) {
    return getCurrentMonth();
  }
  
  if (/^\d{4}-\d{2}$/.test(input)) {
    return input;
  }
  
  return getCurrentMonth();
}

export function getMonthOffset(offset: number): string {
  const kyivDate = getCurrentKyivDate();
  const targetDate = new Date(kyivDate);
  targetDate.setMonth(targetDate.getMonth() + offset);
  const year = targetDate.getFullYear();
  const month = String(targetDate.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export function getDaysInMonth(yearMonth: string): string[] {
  const [year, month] = yearMonth.split("-").map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  const days: string[] = [];
  for (let day = 1; day <= lastDay; day++) {
    days.push(`${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`);
  }
  return days;
}

export function generateScheduleTable(slots: any[], yearMonth: string, type: "URGENT" | "VP"): any[][] {
  const days = getDaysInMonth(yearMonth);
  const hours = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, "0")}:00`);
  
  const slotMap = new Map<string, Map<string, Set<string>>>();
  
  for (const slot of slots) {
    const doctorName = slot.vet.name || `ID${slot.vet.id}`;
    
    const startHour = parseInt(slot.startTime.split(":")[0]);
    const endHour = parseInt(slot.endTime.split(":")[0]);
    
    for (let hour = startHour; hour < endHour; hour++) {
      const hourKey = `${String(hour).padStart(2, "0")}:00`;
      if (!slotMap.has(slot.date)) {
        slotMap.set(slot.date, new Map());
      }
      const dayMap = slotMap.get(slot.date)!;
      if (!dayMap.has(hourKey)) {
        dayMap.set(hourKey, new Set());
      }
      dayMap.get(hourKey)!.add(doctorName);
    }
  }
  
  const headerRow: any[] = ["Година"];
  
  for (const day of days) {
    const dayNum = parseInt(day.split("-")[2]);
    headerRow.push(`День ${dayNum}`);
  }
  
  const dataRows: any[][] = [];
  for (const hour of hours) {
    const row: any[] = [hour];
    
    for (const day of days) {
      const hourSlots = slotMap.get(day)?.get(hour) || new Set();
      if (hourSlots.size > 0) {
        row.push(Array.from(hourSlots).join("\n"));
      } else {
        row.push("");
      }
    }
    
    dataRows.push(row);
  }
  
  return [headerRow, ...dataRows];
}
