import { Context } from "telegraf";
import { Message } from "telegraf/types";
import * as path from "path";
import * as fs from "fs";
import * as XLSX from "xlsx";
import { getAllSlotsForMonthByType } from "../../services/db";
import { isVetAdmin } from "../../services/vet";
import { getMonthOffset, generateScheduleTable } from "./utils";

export async function handleAdminSchedule(ctx: Context) {
  const user = ctx.from;
  if (!user) return;

  const isAdmin = await isVetAdmin(BigInt(user.id));
  if (!isAdmin) {
    await ctx.reply("❌ У вас немає прав адміністратора.");
    return;
  }

  const message = ctx.message as Message.TextMessage;
  const args = message.text?.split(" ").slice(1);
  
  let monthOffset = 0;
  if (args?.[0]) {
    const offset = parseInt(args[0]);
    if (!isNaN(offset) && offset >= 0 && offset <= 2) {
      monthOffset = offset;
    }
  }

  const yearMonth = getMonthOffset(monthOffset);
  const monthNames = ["поточний", "наступний", "через два"];
  const monthLabel = monthNames[monthOffset] || yearMonth;

  await ctx.reply(`📊 Генерую таблиці розкладу за ${monthLabel} місяць (${yearMonth})...`);

  const tempDir = path.join(process.cwd(), "temp");
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  try {
    const urgentSlots = await getAllSlotsForMonthByType(yearMonth, "URGENT");
    const vpSlots = await getAllSlotsForMonthByType(yearMonth, "VP");

    const workbook = XLSX.utils.book_new();

    if (urgentSlots.length > 0) {
      const urgentTable = generateScheduleTable(urgentSlots, yearMonth, "URGENT");
      const urgentWorksheet = XLSX.utils.aoa_to_sheet(urgentTable);
      
      const yellowFill = { patternType: "solid", fgColor: { rgb: "FFFF00" } };
      const range = XLSX.utils.decode_range(urgentWorksheet["!ref"] || "A1");
      
      for (let row = 1; row <= range.e.r; row++) {
        for (let col = 1; col <= range.e.c; col++) {
          const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
          const cell = urgentWorksheet[cellAddress];
          if (!cell || !cell.v || cell.v === "") {
            if (!cell) {
              urgentWorksheet[cellAddress] = { t: "s", v: "", s: { fill: yellowFill } };
            } else {
              if (!cell.s) cell.s = {};
              cell.s.fill = yellowFill;
            }
          }
        }
      }
      
      urgentWorksheet["!cols"] = Array.from({ length: range.e.c + 1 }, () => ({ wch: 20 }));
      XLSX.utils.book_append_sheet(workbook, urgentWorksheet, "URGENT");
    }

    if (vpSlots.length > 0) {
      const vpTable = generateScheduleTable(vpSlots, yearMonth, "VP");
      const vpWorksheet = XLSX.utils.aoa_to_sheet(vpTable);
      
      const yellowFill = { patternType: "solid", fgColor: { rgb: "FFFF00" } };
      const range = XLSX.utils.decode_range(vpWorksheet["!ref"] || "A1");
      
      for (let row = 1; row <= range.e.r; row++) {
        for (let col = 1; col <= range.e.c; col++) {
          const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
          const cell = vpWorksheet[cellAddress];
          if (!cell || !cell.v || cell.v === "") {
            if (!cell) {
              vpWorksheet[cellAddress] = { t: "s", v: "", s: { fill: yellowFill } };
            } else {
              if (!cell.s) cell.s = {};
              cell.s.fill = yellowFill;
            }
          }
        }
      }
      
      vpWorksheet["!cols"] = Array.from({ length: range.e.c + 1 }, () => ({ wch: 20 }));
      XLSX.utils.book_append_sheet(workbook, vpWorksheet, "VP");
    }

    if (urgentSlots.length === 0 && vpSlots.length === 0) {
      await ctx.reply(`Немає слотів за ${yearMonth}.`);
      return;
    }

    const filename = `admin_schedule_${yearMonth}.xlsx`;
    const filepath = path.join(tempDir, filename);
    XLSX.writeFile(workbook, filepath);

    await ctx.replyWithDocument({
      source: filepath,
      filename: filename,
    });

    fs.unlinkSync(filepath);
  } catch (error) {
    await ctx.reply(
      `❌ Помилка: ${error instanceof Error ? error.message : "Невідома помилка"}`
    );
  }
}
