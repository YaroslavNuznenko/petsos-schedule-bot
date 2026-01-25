import { Context, Markup } from "telegraf";
import { Message } from "telegraf/types";
import * as path from "path";
import * as fs from "fs";
import { downloadTelegramFile } from "../../services/telegram";
import { convertOggToMp3, cleanupAudioFiles } from "../../services/audio";
import { transcribeAudio } from "../../services/whisper";
import { extractSlots } from "../../services/extract";
import { getUserState, setUserState, clearUserState } from "../state";
import { pendingSlots } from "./shared";
import { formatSlots } from "./utils";

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
