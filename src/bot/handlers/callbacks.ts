import { Context, Markup } from "telegraf";
import { Update } from "telegraf/types";
import { getOrCreateVetFromContext } from "../../services/vet";
import { saveSlots, getOrCreateVet, deleteVetSlotsForMonth } from "../../services/db";
import { getUserState, setUserState, clearUserState } from "../state";
import { pendingSlots, pendingClearConfirmations } from "./shared";
import { formatSlots } from "./utils";

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
    const action = parts[1];
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
        const vet = await getOrCreateVet("telegram", String(user.id));
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
