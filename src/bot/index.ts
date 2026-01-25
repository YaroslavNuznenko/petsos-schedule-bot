import "dotenv/config";
import { Telegraf } from "telegraf";
import {
  handleStart,
  handleAddSlots,
  handleMySlots,
  handleClearMonth,
  handleExportMonth,
  handleAdminSchedule,
  handleVoice,
  handleText,
  handleContact,
  handleCallback,
} from "./handlers";

if (!process.env.BOT_TOKEN) {
  throw new Error("BOT_TOKEN is required in .env file");
}

if (!process.env.OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY is required in .env file");
}

const bot = new Telegraf(process.env.BOT_TOKEN);

bot.command("start", handleStart);
bot.command("add_slots", handleAddSlots);
bot.command("my_slots", handleMySlots);
bot.command("clear_month", handleClearMonth);
bot.command("export_month", handleExportMonth);
bot.command("admin_schedule", handleAdminSchedule);

bot.on("voice", handleVoice);
bot.on("text", handleText);
bot.on("contact", handleContact);
bot.on("callback_query", handleCallback);

bot.catch((err, ctx) => {
  console.error("Bot error:", err);
  ctx.reply("❌ Сталася помилка. Будь ласка, спробуйте ще раз пізніше.");
});

async function start() {
  try {
    await bot.launch();
  } catch (error) {
    console.error("Помилка запуску бота:", error);
    process.exit(1);
  }
}

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));

start();
