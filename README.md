# PetSOS Schedule Bot

Telegram бот для PetSOS, який дозволяє ветеринарам додавати свої доступні часові слоти голосом або текстом українською мовою.

## Вимоги

- Node.js 20+
- SQLite
- ffmpeg
- Telegram Bot Token
- OpenAI API Key

## Встановлення

```bash
npm install
```

Встановіть ffmpeg:

- macOS: `brew install ffmpeg`
- Linux: `sudo apt-get install ffmpeg`
- Windows: завантажте з [ffmpeg.org](https://ffmpeg.org/download.html)

Створіть файл `.env`:

```env
BOT_TOKEN=your_telegram_bot_token_here
OPENAI_API_KEY=your_openai_api_key_here
DATABASE_URL="file:./prisma/dev.db"
TZ=Europe/Kyiv
```

Налаштуйте базу даних:

```bash
npm run prisma:generate
npm run prisma:migrate
```

## Запуск

```bash
npm run dev
```

## Команди

- `/start` - Інструкції з використання
- `/add_slots` - Додати нові слоти доступності
- `/my_slots [YYYY-MM]` - Переглянути ваші слоти за місяць
- `/clear_month [YYYY-MM]` - Очистити всі слоти за місяць
- `/export_month [YYYY-MM]` - Експортувати розклад у CSV/XLSX

## Приклади

- "Завтра я доступний з 10 до 13 ургент, і з 15 до 17 ВП"
- "Сьогодні з 9 до 12 тільки ургент"
- "У понеділок з 14 до 18 ВП"

Детальні приклади: [EXAMPLES_UA.md](./EXAMPLES_UA.md)
