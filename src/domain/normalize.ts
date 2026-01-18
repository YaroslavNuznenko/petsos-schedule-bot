export function getCurrentKyivDate(): Date {
  const tz = process.env.TZ || "Europe/Kyiv";
  const now = new Date();
  return new Date(now.toLocaleString("en-US", { timeZone: tz }));
}

export function normalizeDate(dateStr: string): string | null {
  const kyivDate = getCurrentKyivDate();
  const lower = dateStr.toLowerCase().trim();
  
  if (lower === "сьогодні" || lower === "today" || lower === "сегодня") {
    return formatDate(kyivDate);
  }
  
  if (lower === "завтра" || lower === "tomorrow") {
    const tomorrow = new Date(kyivDate);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return formatDate(tomorrow);
  }
  
  if (lower === "післязавтра" || lower === "після завтра" || lower === "after tomorrow") {
    const dayAfter = new Date(kyivDate);
    dayAfter.setDate(dayAfter.getDate() + 2);
    return formatDate(dayAfter);
  }
  const ukrainianDayNames: Record<string, number> = {
    "понеділок": 1,
    "у понеділок": 1,
    "в понеділок": 1,
    "вівторок": 2,
    "у вівторок": 2,
    "в вівторок": 2,
    "середа": 3,
    "у середу": 3,
    "в середу": 3,
    "четвер": 4,
    "у четвер": 4,
    "в четвер": 4,
    "п'ятниця": 5,
    "пятниця": 5,
    "у п'ятницю": 5,
    "у пятницю": 5,
    "в п'ятницю": 5,
    "в пятницю": 5,
    "субота": 6,
    "у суботу": 6,
    "в суботу": 6,
    "неділя": 0,
    "у неділю": 0,
    "в неділю": 0,
  };
  
  // Handle English weekday names
  const englishDayNames: Record<string, number> = {
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6,
    sunday: 0,
  };
  
  // Handle Russian weekday names
  const russianDayNames: Record<string, number> = {
    понедельник: 1,
    вторник: 2,
    среда: 3,
    четверг: 4,
    пятница: 5,
    суббота: 6,
    воскресенье: 0,
  };
  
  const allDayNames = { ...ukrainianDayNames, ...englishDayNames, ...russianDayNames };
  
  if (allDayNames[lower]) {
    const targetDay = allDayNames[lower];
    const currentDay = kyivDate.getDay();
    let daysToAdd = targetDay - currentDay;
    
    if (daysToAdd <= 0) {
      daysToAdd += 7;
    }
    
    const targetDate = new Date(kyivDate);
    targetDate.setDate(kyivDate.getDate() + daysToAdd);
    return formatDate(targetDate);
  }
  
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr;
  }
  
  const parsed = new Date(dateStr);
  if (!isNaN(parsed.getTime())) {
    return formatDate(parsed);
  }
  
  return null;
}

export function normalizeTime(timeStr: string): string | null {
  const trimmed = timeStr.trim();
  
  if (/^\d{2}:\d{2}$/.test(trimmed)) {
    return trimmed;
  }
  
  if (/^\d{1,2}:\d{2}$/.test(trimmed)) {
    const [hours, minutes] = trimmed.split(":");
    return `${hours.padStart(2, "0")}:${minutes}`;
  }
  
  if (/^\d{1,2}$/.test(trimmed)) {
    const hours = parseInt(trimmed, 10);
    if (hours >= 0 && hours <= 23) {
      return `${hours.toString().padStart(2, "0")}:00`;
    }
  }
  
  return null;
}

export function roundStartTimeDown(timeStr: string): string {
  const [hours] = timeStr.split(":").map(Number);
  return `${hours.toString().padStart(2, "0")}:00`;
}

export function roundEndTimeUp(timeStr: string): string {
  const [hours, minutes] = timeStr.split(":").map(Number);
  const roundedHours = minutes > 0 ? hours + 1 : hours;
  const finalHours = roundedHours >= 24 ? 23 : roundedHours;
  return `${finalHours.toString().padStart(2, "0")}:00`;
}

export function isWithinPlanningWindow(dateStr: string): boolean {
  const kyivDate = getCurrentKyivDate();
  const today = formatDate(kyivDate);
  
  const [year, month, day] = dateStr.split("-").map(Number);
  const inputDate = new Date(year, month - 1, day);
  const todayDate = new Date(kyivDate.getFullYear(), kyivDate.getMonth(), kyivDate.getDate());
  
  if (inputDate < todayDate) {
    return false;
  }
  
  const maxDate = new Date(todayDate);
  maxDate.setDate(maxDate.getDate() + 31);
  
  return inputDate <= maxDate;
}

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Validates that endTime is after startTime
 */
export function validateTimeRange(startTime: string, endTime: string): boolean {
  const [startHours, startMinutes] = startTime.split(":").map(Number);
  const [endHours, endMinutes] = endTime.split(":").map(Number);
  
  const startTotal = startHours * 60 + startMinutes;
  const endTotal = endHours * 60 + endMinutes;
  
  return endTotal > startTotal;
}
