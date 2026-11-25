import type { VoiceoverTake } from '../types/voiceover';
import {
  extractWaveformPeaksFromWav,
  synthesizeStudioReferenceWav,
  uint8ArrayToBase64,
} from './audioLogic';

const DB_NAME = 'cadence_studio_db';
const DB_VERSION = 1;
const STORE_NAME = 'takes';
const SEEDED_FLAG = 'cadence_studio_seeded_v1';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Failed to open IndexedDB.'));
  });
}

function buildSeededSampleTakes(): VoiceoverTake[] {
  const now = Date.now();

  const refA = synthesizeStudioReferenceWav(4.2, 220, 24000);
  const refB = synthesizeStudioReferenceWav(3.6, 261.63, 24000);

  return [
    {
      id: 'sample-calibration-intro',
      title: 'Studio Reference — Intro Cadence (Sample)',
      mode: 'sample',
      script:
        'Sample reference track for testing waveform scrubbing, trim handles, Broadcast Warm EQ, and multi-take WAV stitching.',
      voiceSummary: 'Studio Reference',
      styleSummary: 'Acoustic studio reference',
      engineLabel: 'Local Reference',
      durationSec: 4.2,
      sampleRate: 24000,
      createdAt: now - 1000 * 60 * 18,
      favorite: true,
      audioBase64: uint8ArrayToBase64(refA),
      peaks: extractWaveformPeaksFromWav(refA, 96),
    },
    {
      id: 'sample-calibration-outro',
      title: 'Studio Reference — Outro Bed (Sample)',
      mode: 'sample',
      script:
        'Second sample reference clip so you can test multi-select stitching and timed gap export right out of the box.',
      voiceSummary: 'Studio Reference',
      styleSummary: 'Acoustic studio reference',
      engineLabel: 'Local Reference',
      durationSec: 3.6,
      sampleRate: 24000,
      createdAt: now - 1000 * 60 * 6,
      favorite: false,
      audioBase64: uint8ArrayToBase64(refB),
      peaks: extractWaveformPeaksFromWav(refB, 96),
    },
  ];
}

export async function loadAllTakes(): Promise<VoiceoverTake[]> {
  try {
    const db = await openDatabase();
    const existing = await new Promise<VoiceoverTake[]>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => resolve((req.result as VoiceoverTake[]) ?? []);
      req.onerror = () => reject(req.error);
    });

    if (existing.length === 0 && !localStorage.getItem(SEEDED_FLAG)) {
      const seeded = buildSeededSampleTakes();
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      for (const take of seeded) {
        store.put(take);
      }
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      localStorage.setItem(SEEDED_FLAG, '1');
      db.close();
      return seeded.sort((a, b) => b.createdAt - a.createdAt);
    }

    db.close();
    return existing.sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return buildSeededSampleTakes();
  }
}

export async function saveTake(take: VoiceoverTake): Promise<void> {
  const db = await openDatabase();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  tx.objectStore(STORE_NAME).put(take);
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function deleteTakeById(id: string): Promise<void> {
  const db = await openDatabase();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  tx.objectStore(STORE_NAME).delete(id);
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}
