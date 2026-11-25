import 'dotenv/config';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI } from '@google/genai';
import { STUDIO_VOICES } from './src/data/studioCatalog';
import type { DialogueTtsPayload, SingleTtsPayload, VoiceName } from './src/types/voiceover';
import {
  base64ToUint8Array,
  extractWaveformPeaksFromWav,
  parseWavHeader,
} from './src/utils/audioLogic';
import {
  VALID_VOICES,
  validateDialogueTtsPayload,
  validateSingleTtsPayload,
} from './src/utils/scriptLogic';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    const err = new Error(
      'GEMINI_API_KEY is not configured on the server. Add your API key in Settings > Secrets to generate voiceovers.',
    ) as Error & { statusCode?: number };
    err.statusCode = 503;
    throw err;
  }
  return new GoogleGenAI({
    apiKey,
    apiVersion: 'v1beta',
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 2): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      lastError = err;
      const status =
        typeof err === 'object' && err !== null && 'status' in err
          ? Number((err as { status?: number }).status)
          : 0;
      // Do not retry client errors (4xx) except 429 rate limits
      if (status >= 400 && status < 500 && status !== 429) {
        throw err;
      }
      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 650 * attempt));
      }
    }
  }
  throw lastError;
}

function formatGeminiError(err: unknown): { status: number; message: string } {
  const statusRaw =
    typeof err === 'object' && err !== null
      ? Number(
          (err as { statusCode?: number; status?: number }).statusCode ??
            (err as { status?: number }).status ??
            500,
        )
      : 500;
  let rawMessage = err instanceof Error ? err.message : 'Unexpected voiceover generation error.';
  try {
    const parsed = JSON.parse(rawMessage) as { error?: { message?: string } };
    if (parsed?.error?.message) {
      rawMessage = parsed.error.message;
    }
  } catch {
    // Not a JSON string
  }

  if (statusRaw === 403 || rawMessage.includes('PERMISSION_DENIED') || rawMessage.includes('API_KEY_INVALID')) {
    return {
      status: 403,
      message:
        'Voice generation was rejected due to API key permissions. Please verify your key in Settings > Secrets.',
    };
  }
  if (statusRaw === 429 || rawMessage.includes('RESOURCE_EXHAUSTED')) {
    return {
      status: 429,
      message:
        'Rate limit reached for speech generation. Wait a moment and try again, or check your quota in Settings > Secrets.',
    };
  }
  const safeStatus = statusRaw >= 400 && statusRaw < 600 ? statusRaw : 500;
  return { status: safeStatus, message: rawMessage };
}

function extractAudioFromResponse(response: {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        inlineData?: { data?: string; mimeType?: string };
      }>;
    };
  }>;
}): { audioBase64: string; durationSec: number; sampleRate: number; peaks: number[] } {
  const parts = response.candidates?.[0]?.content?.parts ?? [];
  const audioPart = parts.find((p) => p.inlineData?.data);
  const audioBase64 = audioPart?.inlineData?.data;
  if (!audioBase64) {
    throw new Error('The speech model returned an empty audio payload. Try adjusting your script or direction.');
  }

  const bytes = base64ToUint8Array(audioBase64);
  const meta = parseWavHeader(bytes);
  const peaks = extractWaveformPeaksFromWav(bytes, 96);

  return {
    audioBase64,
    durationSec: Math.round(meta.durationSec * 100) / 100,
    sampleRate: meta.sampleRate,
    peaks,
  };
}

interface CachedPreview {
  audioBase64: string;
  durationSec: number;
  sampleRate: number;
  peaks: number[];
}

const previewCache = new Map<VoiceName, CachedPreview>();

async function createServer() {
  const app = express();
  app.use(express.json({ limit: '4mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, hasApiKey: Boolean(process.env.GEMINI_API_KEY?.trim()) });
  });

  app.post('/api/tts/single', async (req, res) => {
    const body = (req.body ?? {}) as Partial<SingleTtsPayload>;
    const validation = validateSingleTtsPayload(body);
    if (!validation.valid) {
      res.status(400).json({ error: validation.error });
      return;
    }

    const text = body.text!.trim();
    const voiceName = body.voiceName!;
    const style = typeof body.style === 'string' ? body.style.trim() : '';
    const engine = body.engine === 'expressive' ? 'expressive' : 'standard';
    const model = engine === 'expressive' ? 'gemini-3.8-flash-tts' : 'gemini-3.8-flash-lite-tts';

    try {
      const ai = getGeminiClient();
      const response = await withRetry(() =>
        ai.models.generateContent({
          model,
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text,
                  ...(style ? { speechMetadata: { style } } : {}),
                },
              ],
            },
          ],
          config: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName },
              },
            },
          },
        }),
      );

      const audio = extractAudioFromResponse(response);
      res.json({
        ...audio,
        mimeType: 'audio/wav',
        model,
      });
    } catch (err) {
      const formatted = formatGeminiError(err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  app.post('/api/tts/dialogue', async (req, res) => {
    const body = (req.body ?? {}) as Partial<DialogueTtsPayload>;
    const validation = validateDialogueTtsPayload(body);
    if (!validation.valid) {
      res.status(400).json({ error: validation.error });
      return;
    }

    const speakerA = {
      name: body.speakerA!.name.trim(),
      voiceName: body.speakerA!.voiceName,
      style: body.speakerA!.style?.trim() || 'Natural conversational speaker',
    };
    const speakerB = {
      name: body.speakerB!.name.trim(),
      voiceName: body.speakerB!.voiceName,
      style: body.speakerB!.style?.trim() || 'Natural conversational speaker',
    };

    const validTurns = body.turns!.filter((t) => t.text.trim().length > 0);

    try {
      const ai = getGeminiClient();
      const response = await withRetry(() =>
        ai.models.generateContent({
          model: 'gemini-3.8-flash-tts',
          contents: [
            {
              role: 'user',
              parts: validTurns.map((turn) => {
                const speaker = turn.speakerSlot === 'A' ? speakerA : speakerB;
                return {
                  text: `${speaker.name}: ${turn.text.trim()}`,
                  speechMetadata: {
                    speaker: speaker.name,
                    style: speaker.style,
                  },
                };
              }),
            },
          ],
          config: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              multiSpeakerVoiceConfig: {
                speakerVoiceConfigs: [
                  {
                    speaker: speakerA.name,
                    voiceConfig: {
                      prebuiltVoiceConfig: { voiceName: speakerA.voiceName },
                    },
                  },
                  {
                    speaker: speakerB.name,
                    voiceConfig: {
                      prebuiltVoiceConfig: { voiceName: speakerB.voiceName },
                    },
                  },
                ],
              },
            },
          },
        }),
      );

      const audio = extractAudioFromResponse(response);
      res.json({
        ...audio,
        mimeType: 'audio/wav',
        model: 'gemini-3.8-flash-tts',
      });
    } catch (err) {
      const formatted = formatGeminiError(err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  app.post('/api/tts/preview', async (req, res) => {
    const voiceName = req.body?.voiceName as VoiceName | undefined;
    if (!voiceName || !VALID_VOICES.has(voiceName)) {
      res.status(400).json({ error: 'Select a valid studio voice to audition.' });
      return;
    }

    const cached = previewCache.get(voiceName);
    if (cached) {
      res.json({ ...cached, mimeType: 'audio/wav', cached: true });
      return;
    }

    const profile = STUDIO_VOICES.find((v) => v.id === voiceName)!;
    try {
      const ai = getGeminiClient();
      const response = await withRetry(() =>
        ai.models.generateContent({
          model: 'gemini-3.8-flash-lite-tts',
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: profile.sampleLine,
                  speechMetadata: { style: profile.defaultStyle },
                },
              ],
            },
          ],
          config: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: profile.id },
              },
            },
          },
        }),
      );

      const audio = extractAudioFromResponse(response);
      previewCache.set(voiceName, audio);
      res.json({ ...audio, mimeType: 'audio/wav', cached: false });
    } catch (err) {
      const formatted = formatGeminiError(err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  if (!IS_PROD) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      const indexPath = path.join(distDir, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).send('Build output not found. Run npm run build first.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Cadence Studio listening on http://localhost:${PORT}`);
  });
}

createServer().catch((err) => {
  console.error('Failed to start Cadence Studio server:', err);
  process.exit(1);
});
