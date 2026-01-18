import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import * as path from "path";

const execAsync = promisify(exec);
const unlink = promisify(fs.unlink);

export async function convertOggToMp3(
  inputPath: string,
  outputPath: string
): Promise<void> {
  try {
    const command = `ffmpeg -i "${inputPath}" -acodec libmp3lame -ab 128k "${outputPath}" -y`;
    await execAsync(command);
  } catch (error) {
    throw new Error(`FFmpeg conversion failed: ${error}`);
  }
}

export async function cleanupAudioFiles(...paths: string[]): Promise<void> {
  for (const filePath of paths) {
    try {
      if (fs.existsSync(filePath)) {
        await unlink(filePath);
      }
    } catch (error) {
      // Silent fail for cleanup
    }
  }
}
