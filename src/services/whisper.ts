import OpenAI from "openai";
import * as fs from "fs";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Transcribe audio file using OpenAI Whisper
 */
export async function transcribeAudio(audioPath: string): Promise<string> {
  try {
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(audioPath),
      model: "whisper-1",
      language: "uk", // Ukrainian/Russian/English support
    });

    return transcription.text;
  } catch (error) {
    throw new Error(`Whisper transcription failed: ${error}`);
  }
}
