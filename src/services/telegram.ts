import { Telegram } from "telegraf";
import * as fs from "fs";
import * as path from "path";
import { promisify } from "util";

const writeFile = promisify(fs.writeFile);
const mkdir = promisify(fs.mkdir);

export async function downloadTelegramFile(
  telegram: Telegram,
  fileId: string,
  outputPath: string
): Promise<void> {
  const file = await telegram.getFile(fileId);
  const fileUrl = `https://api.telegram.org/file/bot${telegram.token}/${file.file_path}`;

  const response = await fetch(fileUrl);
  if (!response.ok) {
    throw new Error(`Failed to download file: ${response.statusText}`);
  }

  const buffer = await response.arrayBuffer();
  const dir = path.dirname(outputPath);
  await mkdir(dir, { recursive: true });
  await writeFile(outputPath, Buffer.from(buffer));
}
