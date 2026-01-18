import { Context, Markup } from "telegraf";
import { Message, Update } from "telegraf/types";
import * as path from "path";
import * as fs from "fs";
import * as XLSX from "xlsx";
import { downloadTelegramFile } from "../services/telegram";
import { convertOggToMp3, cleanupAudioFiles } from "../services/audio";
import { transcribeAudio } from "../services/whisper";
import { extractSlots } from "../services/extract";
import { 
  getOrCreateVet, 
  saveSlots, 
  getVetSlots, 
  getVetSlotsForMonth,
  getAllSlotsForMonth,
  deleteVetSlotsForMonth
} from "../services/db";
import { 
  getOrCreateVetFromContext,
  vetHasPhone,
  updateVetPhone
} from "../services/vet";
import { Slot } from "../domain/schema";
import { getCurrentKyivDate } from "../domain/normalize";
import {
  getUserState,
  setUserState,
  clearUserState,
  isUserInState
} from "./state";

const pendingSlots = new Map<number, { slots: Slot[]; source: string; sourceType: "voice" | "text" }>();
const pendingClearConfirmations = new Map<number, string>();

function formatSlots(slots: Slot[]): string {
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

function getCurrentMonth(): string {
  const kyivDate = getCurrentKyivDate();
  const year = kyivDate.getFullYear();
  const month = String(kyivDate.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function parseYearMonth(input: string | undefined): string {
  if (!input) {
    return getCurrentMonth();
  }
  
  if (/^\d{4}-\d{2}$/.test(input)) {
    return input;
  }
  
  return getCurrentMonth();
}

export async function handleStart(ctx: Context) {
  const user = ctx.from;
  if (!user) return;

  await getOrCreateVet(String(user.id), `${user.first_name} ${user.last_name || ""}`.trim());

  await ctx.reply(
    `Ласкаво просимо до PetSOS Schedule Bot! 🐾\n\n` +
      `Я допомагаю вам керувати вашими слотами доступності.\n\n` +
      `Команди:\n` +
      `/start - Інструкції з використання\n` +
      `/add_slots - Додати нові слоти доступності\n` +
      `/my_slots [YYYY-MM] - Переглянути ваші слоти (за замовчуванням поточний місяць)\n` +
      `/clear_month [YYYY-MM] - Очистити всі слоти за місяць (з підтвердженням)\n` +
      `/export_month [YYYY-MM] - Експортувати розклад за місяць у CSV/XLSX\n\n` +
      `Надішліть мені голосове повідомлення або текст з вашою доступністю українською мовою, наприклад:\n` +
      `"Завтра я доступний з 10 до 13 ургент, і з 15 до 17 ВП"` +
      `\n"Сьогодні з 9 до 12 тільки ургент"` +
      `\n"У понеділок з 14 до 18 ВП, у середу з 10 до 15 ургент"`
  );
}

export async function handleAddSlots(ctx: Context) {
  const user = ctx.from;
  if (!user) return;

  try {
    const vet = await getOrCreateVetFromContext(ctx);
    const hasPhone = await vetHasPhone(BigInt(user.id));
    
    if (!hasPhone) {
      await ctx.reply(
        `📱 Для повної реєстрації, будь ласка, поділіться вашим номером телефону:`,
        Markup.keyboard([
          Markup.button.contactRequest("📱 Поділитися номером")
        ]).oneTime().resize()
      );
    }

    setUserState(user.id, "awaiting_slots_input");

    await ctx.reply(
      `✅ Готово! Тепер надішли голосове або текстом свої вільні години.\n\n` +
        `Приклади:\n` +
        `• «Завтра ургент з 10 до 13. ВП не беру.»\n` +
        `• «У понеділок: ургент 9–12, ВП 16–18.»\n\n` +
        `Після цього я покажу слоти — ти зможеш їх підтвердити ✅`
    );
  } catch (error) {
    await ctx.reply(
      `❌ Помилка: ${error instanceof Error ? error.message : "Невідома помилка"}`
    );
  }
}

export async function handleContact(ctx: Context) {
  const user = ctx.from;
  if (!user) return;

  const message = ctx.message as Message.ContactMessage;
  if (!message.contact) return;

  try {
    const phone = message.contact.phone_number;
    await updateVetPhone(BigInt(user.id), phone);
    
    await ctx.reply(
      `✅ Номер телефону збережено: ${phone}\n\n` +
        `Тепер ви можете додавати слоти доступності через /add_slots`
    );
  } catch (error) {
    await ctx.reply("❌ Помилка збереження номера телефону.");
  }
}

export async function handleMySlots(ctx: Context) {
  const user = ctx.from;
  if (!user) return;

  const message = ctx.message as Message.TextMessage;
  const args = message.text?.split(" ").slice(1);
  const yearMonth = parseYearMonth(args?.[0]);

  const vet = await getOrCreateVet(String(user.id));
  const slots = await getVetSlotsForMonth(vet.id, yearMonth);

  if (slots.length === 0) {
    await ctx.reply(
      `У вас немає слотів за ${yearMonth}. ` +
      `Надішліть мені голосове повідомлення або текст з вашою доступністю!`
    );
    return;
  }

  const formatted = slots
    .map(
      (slot) =>
        `📅 ${slot.date} ${slot.startTime}-${slot.endTime} (${slot.type})`
    )
    .join("\n");

  await ctx.reply(`Ваші слоти доступності за ${yearMonth}:\n\n${formatted}`);
}

export async function handleClearMonth(ctx: Context) {
  const user = ctx.from;
  if (!user) return;

  const message = ctx.message as Message.TextMessage;
  const args = message.text?.split(" ").slice(1);
  const yearMonth = parseYearMonth(args?.[0]);

  const vet = await getOrCreateVet(String(user.id));
  const slots = await getVetSlotsForMonth(vet.id, yearMonth);

  if (slots.length === 0) {
    await ctx.reply(`У вас немає слотів за ${yearMonth} для видалення.`);
    return;
  }

  pendingClearConfirmations.set(user.id, yearMonth);

  await ctx.reply(
    `⚠️ Ви впевнені, що хочете видалити всі ${slots.length} слотів за ${yearMonth}?\n\n` +
      `Цю дію неможливо скасувати!`,
    Markup.inlineKeyboard([
      [Markup.button.callback("✅ Так, видалити", `clear_confirm_${user.id}`)],
      [Markup.button.callback("❌ Скасувати", `clear_cancel_${user.id}`)],
    ])
  );
}

export async function handleExportMonth(ctx: Context) {
  const user = ctx.from;
  if (!user) return;

  const message = ctx.message as Message.TextMessage;
  const args = message.text?.split(" ").slice(1);
  const yearMonth = parseYearMonth(args?.[0]);

  const vet = await getOrCreateVet(String(user.id));
  const slots = await getVetSlotsForMonth(vet.id, yearMonth);

  if (slots.length === 0) {
    await ctx.reply(`У вас немає слотів за ${yearMonth} для експорту.`);
    return;
  }

  await ctx.reply("📊 Генерую файли експорту...");

  const tempDir = path.join(process.cwd(), "temp");
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  try {
    const csvLines = ["Дата,Час початку,Час закінчення,Тип"];
    for (const slot of slots) {
      csvLines.push(
        `${slot.date},${slot.startTime},${slot.endTime},${slot.type}`
      );
    }
    const csv = csvLines.join("\n");
    const csvFilename = `schedule_${yearMonth}.csv`;
    const csvFilepath = path.join(tempDir, csvFilename);
    fs.writeFileSync(csvFilepath, csv, "utf-8");

    const worksheet = XLSX.utils.aoa_to_sheet([
      ["Дата", "Час початку", "Час закінчення", "Тип"],
      ...slots.map(slot => [slot.date, slot.startTime, slot.endTime, slot.type])
    ]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Розклад");
    
    const xlsxFilename = `schedule_${yearMonth}.xlsx`;
    const xlsxFilepath = path.join(tempDir, xlsxFilename);
    XLSX.writeFile(workbook, xlsxFilepath);

    await ctx.replyWithDocument({
      source: csvFilepath,
      filename: csvFilename,
    });

    await ctx.replyWithDocument({
      source: xlsxFilepath,
      filename: xlsxFilename,
    });

    fs.unlinkSync(csvFilepath);
    fs.unlinkSync(xlsxFilepath);
  } catch (error) {
    await ctx.reply(
      `❌ Помилка при експорті: ${error instanceof Error ? error.message : "Невідома помилка"}`
    );
  }
}

export async function handleVoice(ctx: Context) {
  const user = ctx.from;
  if (!user) return;

  const message = ctx.message as Message.VoiceMessage;
  if (!message.voice) return;

  const state = getUserState(user.id);
  if (state !== "awaiting_slots_input" && state !== "awaiting_slots_text_edit") {
    await ctx.reply(
      `ℹ️ Для додавання слотів спочатку використайте команду /add_slots`
    );
    return;
  }

  await ctx.reply("🎤 Обробляю ваше голосове повідомлення...");

  const tempDir = path.join(process.cwd(), "temp");
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const oggPath = path.join(tempDir, `voice_${user.id}_${Date.now()}.ogg`);
  const mp3Path = path.join(tempDir, `voice_${user.id}_${Date.now()}.mp3`);

  try {
    await downloadTelegramFile(ctx.telegram, message.voice.file_id, oggPath);
    await convertOggToMp3(oggPath, mp3Path);
    const transcript = await transcribeAudio(mp3Path);

    if (!transcript || transcript.trim().length === 0) {
      await ctx.reply(
        "❌ Не вдалося розпізнати голосове повідомлення. " +
        "Будь ласка, спробуйте ще раз або надішліть текст."
      );
      return;
    }

    const slots = await extractSlots(transcript);

    if (slots.length === 0) {
      await ctx.reply(
        `📝 Транскрипт: "${transcript}"\n\n` +
          `❌ Валідних слотів доступності не знайдено. ` +
          `Будь ласка, спробуйте ще раз з більш чітким повідомленням.`
      );
      return;
    }

    pendingSlots.set(user.id, { slots, source: transcript, sourceType: "voice" });
    const formatted = formatSlots(slots);
    await ctx.reply(
      `📝 Транскрипт: "${transcript}"\n\n` +
        `✅ Витягнуті слоти:\n${formatted}\n\n` +
        `Будь ласка, підтвердіть або відредагуйте:`,
      Markup.inlineKeyboard([
        [Markup.button.callback("✅ Підтвердити", `confirm_${user.id}`)],
        [Markup.button.callback("✏️ Відредагувати", `edit_${user.id}`)],
        [Markup.button.callback("❌ Скасувати", `cancel_${user.id}`)],
      ])
    );
  } catch (error) {
    await ctx.reply(
      `❌ Помилка обробки голосового повідомлення: ${
        error instanceof Error ? error.message : "Невідома помилка"
      }. Будь ласка, спробуйте ще раз.`
    );
  } finally {
    await cleanupAudioFiles(oggPath, mp3Path);
  }
}

export async function handleText(ctx: Context) {
  const user = ctx.from;
  if (!user) return;

  const message = ctx.message as Message.TextMessage;
  const text = message.text?.trim();

  if (!text) return;

  const state = getUserState(user.id);
  const pending = pendingSlots.get(user.id);
  
  if (pending && state === "awaiting_slots_text_edit") {
    await ctx.reply("🔄 Обробляю ваш відредагований текст...");

    try {
      const slots = await extractSlots(text);

      if (slots.length === 0) {
        await ctx.reply(
          `❌ Валідних слотів доступності не знайдено в: "${text}"\n\n` +
            `Будь ласка, спробуйте ще раз з більш чітким повідомленням.`
        );
        return;
      }

      pendingSlots.set(user.id, { slots, source: text, sourceType: "text" });
      setUserState(user.id, "awaiting_slots_input");

      const formatted = formatSlots(slots);
      await ctx.reply(
        `✅ Витягнуті слоти:\n${formatted}\n\n` +
          `Будь ласка, підтвердіть або відредагуйте:`,
        Markup.inlineKeyboard([
          [Markup.button.callback("✅ Підтвердити", `confirm_${user.id}`)],
          [Markup.button.callback("✏️ Відредагувати", `edit_${user.id}`)],
          [Markup.button.callback("❌ Скасувати", `cancel_${user.id}`)],
        ])
      );
    } catch (error) {
      await ctx.reply(
        `❌ Помилка обробки тексту: ${
          error instanceof Error ? error.message : "Невідома помилка"
        }. Будь ласка, спробуйте ще раз.`
      );
    }
    return;
  }

  if (state === "awaiting_slots_input") {
    await ctx.reply("🔄 Обробляю ваше повідомлення...");

    try {
      const slots = await extractSlots(text);

      if (slots.length === 0) {
        await ctx.reply(
          `❌ Валідних слотів доступності не знайдено в: "${text}"\n\n` +
            `Будь ласка, спробуйте ще раз з більш чітким повідомленням, наприклад:\n` +
            `"Завтра я доступний з 10 до 13 ургент, і з 15 до 17 ВП"`
        );
        return;
      }

      pendingSlots.set(user.id, { slots, source: text, sourceType: "text" });

      const formatted = formatSlots(slots);
      await ctx.reply(
        `✅ Витягнуті слоти:\n${formatted}\n\n` +
          `Будь ласка, підтвердіть або відредагуйте:`,
        Markup.inlineKeyboard([
          [Markup.button.callback("✅ Підтвердити", `confirm_${user.id}`)],
          [Markup.button.callback("✏️ Відредагувати", `edit_${user.id}`)],
          [Markup.button.callback("❌ Скасувати", `cancel_${user.id}`)],
        ])
      );
    } catch (error) {
      await ctx.reply(
        `❌ Помилка обробки тексту: ${
          error instanceof Error ? error.message : "Невідома помилка"
        }. Будь ласка, спробуйте ще раз.`
      );
    }
    return;
  }

  await ctx.reply(
    `ℹ️ Для додавання слотів спочатку використайте команду /add_slots`
  );
}

export async function handleCallback(ctx: Context) {
  const query = (ctx.update as Update.CallbackQueryUpdate).callback_query;
  if (!query || query.message === undefined) return;
  
  if (!("data" in query) || !query.data) return;

  const user = query.from;
  const data = query.data;

  if (data.startsWith("confirm_") || data.startsWith("edit_") || data.startsWith("cancel_")) {
    const [action, userId] = data.split("_");

    if (String(user.id) !== userId) {
      await ctx.answerCbQuery("Це не ваше повідомлення.");
      return;
    }

    const pending = pendingSlots.get(user.id);

    if (action === "confirm") {
      if (!pending) {
        await ctx.answerCbQuery("Слотів для підтвердження не знайдено.");
        return;
      }

      try {
        const vet = await getOrCreateVetFromContext(ctx);
        await saveSlots(vet.id, pending.slots, pending.sourceType);
        pendingSlots.delete(user.id);
        clearUserState(user.id);

        await ctx.editMessageText(
          `✅ Слоти підтверджено та збережено!\n\n${formatSlots(pending.slots)}`
        );
        await ctx.answerCbQuery("Слоти успішно збережено!");
      } catch (error) {
        await ctx.answerCbQuery("Помилка збереження слотів. Будь ласка, спробуйте ще раз.");
      }
    } else if (action === "edit") {
      if (!pending) {
        await ctx.answerCbQuery("Слотів для редагування не знайдено.");
        return;
      }

      setUserState(user.id, "awaiting_slots_text_edit");

      await ctx.editMessageText(
        `✏️ Будь ласка, надішліть ваш виправлений текст з доступністю.\n\n` +
          `Поточні слоти:\n${formatSlots(pending.slots)}\n\n` +
          `Надішліть виправлену версію зараз.`
      );
      await ctx.answerCbQuery();
    } else if (action === "cancel") {
      pendingSlots.delete(user.id);
      clearUserState(user.id);
      await ctx.editMessageText("❌ Скасовано. Слоти не збережено.");
      await ctx.answerCbQuery("Скасовано");
    }
  } else if (data.startsWith("clear_confirm_") || data.startsWith("clear_cancel_")) {
    const parts = data.split("_");
    const action = parts[1]; // "confirm" or "cancel"
    const userId = parts[2];

    if (String(user.id) !== userId) {
      await ctx.answerCbQuery("Це не ваше повідомлення.");
      return;
    }

    const yearMonth = pendingClearConfirmations.get(user.id);

    if (action === "confirm") {
      if (!yearMonth) {
        await ctx.answerCbQuery("Підтвердження не знайдено.");
        return;
      }

      try {
        const vet = await getOrCreateVet(String(user.id));
        const result = await deleteVetSlotsForMonth(vet.id, yearMonth);
        pendingClearConfirmations.delete(user.id);

        await ctx.editMessageText(
          `✅ Видалено ${result.count} слотів за ${yearMonth}.`
        );
        await ctx.answerCbQuery("Слоти видалено!");
      } catch (error) {
        await ctx.answerCbQuery("Помилка видалення слотів. Будь ласка, спробуйте ще раз.");
      }
    } else if (action === "cancel") {
      pendingClearConfirmations.delete(user.id);
      await ctx.editMessageText("❌ Скасовано. Слоти не видалено.");
      await ctx.answerCbQuery("Скасовано");
    }
  }
}
