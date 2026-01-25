import { Context, Markup } from "telegraf";
import { Message } from "telegraf/types";
import { getOrCreateVetFromContext, vetHasPhone, updateVetPhone } from "../../services/vet";
import { setUserState } from "../state";

export async function handleAddSlots(ctx: Context) {
  const user = ctx.from;
  if (!user) return;

  try {
    const vet = await getOrCreateVetFromContext(ctx);
    const hasPhone = await vetHasPhone("telegram", BigInt(user.id));
    
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
    await updateVetPhone("telegram", BigInt(user.id), phone);
    
    await ctx.reply(
      `✅ Номер телефону збережено: ${phone}\n\n` +
        `Тепер ви можете додавати слоти доступності через /add_slots`
    );
  } catch (error) {
    await ctx.reply("❌ Помилка збереження номера телефону.");
  }
}
