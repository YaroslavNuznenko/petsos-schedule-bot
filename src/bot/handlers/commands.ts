import { Context } from "telegraf";
import { getOrCreateVet } from "../../services/db";
import { getVetSlotsForMonth, deleteVetSlotsForMonth } from "../../services/db";
import { isVetAdmin } from "../../services/vet";
import { parseYearMonth, formatSlots } from "./utils";
import { pendingClearConfirmations } from "./shared";
import { Markup } from "telegraf";
import { Message } from "telegraf/types";
import * as path from "path";
import * as fs from "fs";
import * as XLSX from "xlsx";

export async function handleStart(ctx: Context) {
  const user = ctx.from;
  if (!user) return;

  await getOrCreateVet(String(user.id), `${user.first_name} ${user.last_name || ""}`.trim());

  const isAdmin = await isVetAdmin(BigInt(user.id));
  
  let commandsText = `Команди:\n` +
    `/start - Інструкції з використання\n` +
    `/add_slots - Додати нові слоти доступності\n` +
    `/my_slots [YYYY-MM] - Переглянути ваші слоти (за замовчуванням поточний місяць)\n` +
    `/clear_month [YYYY-MM] - Очистити всі слоти за місяць (з підтвердженням)\n` +
    `/export_month [YYYY-MM] - Експортувати розклад за місяць у CSV/XLSX`;
  
  if (isAdmin) {
    commandsText += `\n/admin_schedule [0-2] - Адмін: переглянути розклад усіх лікарів (0=поточний місяць, 1=наступний, 2=через два)`;
  }

  await ctx.reply(
    `Ласкаво просимо до PetSOS Schedule Bot! 🐾\n\n` +
      `Я допомагаю вам керувати вашими слотами доступності.\n\n` +
      commandsText + `\n\n` +
      `Надішліть мені голосове повідомлення або текст з вашою доступністю українською мовою, наприклад:\n` +
      `"Завтра я доступний з 10 до 13 ургент, і з 15 до 17 ВП"` +
      `\n"Сьогодні з 9 до 12 тільки ургент"` +
      `\n"У понеділок з 14 до 18 ВП, у середу з 10 до 15 ургент"`
  );
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
