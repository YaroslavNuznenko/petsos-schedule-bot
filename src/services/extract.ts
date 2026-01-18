import OpenAI from "openai";
import { Slot, SlotsArraySchema } from "../domain/schema";
import { 
  normalizeDate, 
  normalizeTime, 
  validateTimeRange,
  roundStartTimeDown,
  roundEndTimeUp,
  isWithinPlanningWindow,
  getCurrentKyivDate
} from "../domain/normalize";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function extractSlots(transcript: string): Promise<Slot[]> {
  const tz = process.env.TZ || "Europe/Kyiv";
  const now = getCurrentKyivDate();
  const nowStr = formatDate(now);

  const systemPrompt = `You are a data extraction engine.
You output ONLY valid JSON.
No explanations. No markdown.`;

  const userPrompt = `Extract veterinarian availability slots from the Ukrainian transcript.

Context:
- Language: Ukrainian
- Timezone: ${tz}
- Today is ${nowStr} in timezone ${tz}
- Planning window: from today up to 31 days ahead
- Slot types:
  - URGENT = короткі / термінові консультації
  - VP = вузькопрофільні / розгорнуті консультації

Output format:
Return a JSON array. Each item MUST match EXACTLY:

{
  "date": "YYYY-MM-DD",
  "startTime": "HH:mm",
  "endTime": "HH:mm",
  "type": "URGENT" | "VP"
}

Rules:
1. Output JSON ONLY.
2. Parse Ukrainian date expressions:
   - "сьогодні", "завтра", "післязавтра"
   - weekdays: "понеділок", "вівторок", etc.
3. Parse Ukrainian time expressions:
   - "з 10 до 13"
   - "з десятої до тринадцятої"
4. Default slot type is URGENT unless VP is clearly stated.
5. If transcript says VP is unavailable (e.g. "ВП не беру", "тільки ургент"), DO NOT create VP slots.
6. Round time:
   - startTime → down to HH:00
   - endTime → up to HH:00
7. If endTime ≤ startTime, discard slot.
8. If information is ambiguous or missing, return [].

Transcript:
${transcript}`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: userPrompt,
        },
      ],
      temperature: 0.1,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("Empty response from LLM");
    }

    let cleanContent = content.trim();
    if (cleanContent.startsWith("```")) {
      cleanContent = cleanContent.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }

    let parsed: any;
    try {
      parsed = JSON.parse(cleanContent);
      
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        if (parsed.slots) parsed = parsed.slots;
        else if (parsed.items) parsed = parsed.items;
        else if (parsed.result) parsed = parsed.result;
        else {
          const values = Object.values(parsed);
          const arrayValue = values.find(v => Array.isArray(v));
          if (arrayValue) parsed = arrayValue;
        }
      }
    } catch {
      const jsonMatch = cleanContent.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        try {
          parsed = JSON.parse(jsonMatch[0]);
        } catch {
          throw new Error("No valid JSON array found in response");
        }
      } else {
        throw new Error("No valid JSON found in response");
      }
    }

    if (!Array.isArray(parsed)) {
      throw new Error("Response is not an array");
    }

    const validSlots: Slot[] = [];

    for (const item of parsed) {
      try {
        const normalizedDate = normalizeDate(item.date);
        if (!normalizedDate || !isWithinPlanningWindow(normalizedDate)) {
          continue;
        }

        const normalizedStartTime = normalizeTime(item.startTime);
        const normalizedEndTime = normalizeTime(item.endTime);

        if (!normalizedStartTime || !normalizedEndTime) {
          continue;
        }

        const roundedStartTime = roundStartTimeDown(normalizedStartTime);
        const roundedEndTime = roundEndTimeUp(normalizedEndTime);

        if (!validateTimeRange(roundedStartTime, roundedEndTime)) {
          continue;
        }

        if (item.type !== "URGENT" && item.type !== "VP") {
          continue;
        }

        const slot = SlotsArraySchema.element.parse({
          date: normalizedDate,
          startTime: roundedStartTime,
          endTime: roundedEndTime,
          type: item.type,
        });

        validSlots.push(slot);
      } catch (error) {
        continue;
      }
    }

    return validSlots;
  } catch (error) {
    throw new Error(`Slot extraction failed: ${error}`);
  }
}

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
