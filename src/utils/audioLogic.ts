export interface WavMetadata {
  sampleRate: number;
  numChannels: number;
  bitsPerSample: number;
  dataOffset: number;
  dataByteLength: number;
  durationSec: number;
}

function readAscii(bytes: Uint8Array, offset: number, length: number): string {
  let out = '';
  for (let i = 0; i < length; i++) {
    out += String.fromCharCode(bytes[offset + i] ?? 0);
  }
  return out;
}

function writeAscii(view: DataView, offset: number, str: string): void {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

/**
 * Parses a standard RIFF/WAVE PCM header (including extended headers with extra chunks).
 */
export function parseWavHeader(bytes: Uint8Array): WavMetadata {
  if (bytes.byteLength < 44) {
    throw new Error('Invalid WAV buffer: shorter than 44-byte header.');
  }
  if (readAscii(bytes, 0, 4) !== 'RIFF' || readAscii(bytes, 8, 4) !== 'WAVE') {
    throw new Error('Invalid WAV buffer: missing RIFF/WAVE signature.');
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 12;
  let sampleRate = 24000;
  let numChannels = 1;
  let bitsPerSample = 16;
  let dataOffset = -1;
  let dataByteLength = 0;

  while (offset + 8 <= bytes.byteLength) {
    const chunkId = readAscii(bytes, offset, 4);
    const chunkSize = view.getUint32(offset + 4, true);
    const chunkBodyStart = offset + 8;

    if (chunkId === 'fmt ' && chunkBodyStart + 16 <= bytes.byteLength) {
      numChannels = view.getUint16(chunkBodyStart + 2, true);
      sampleRate = view.getUint32(chunkBodyStart + 4, true);
      bitsPerSample = view.getUint16(chunkBodyStart + 14, true);
    } else if (chunkId === 'data') {
      dataOffset = chunkBodyStart;
      dataByteLength = Math.min(chunkSize, bytes.byteLength - chunkBodyStart);
      break;
    }

    offset = chunkBodyStart + chunkSize + (chunkSize % 2);
  }

  if (dataOffset < 0) {
    throw new Error('Invalid WAV buffer: missing data chunk.');
  }

  const bytesPerSecond = sampleRate * numChannels * (bitsPerSample / 8);
  const durationSec = bytesPerSecond > 0 ? dataByteLength / bytesPerSecond : 0;

  return {
    sampleRate,
    numChannels,
    bitsPerSample,
    dataOffset,
    dataByteLength,
    durationSec,
  };
}

/**
 * Encodes normalized Float32 mono samples (-1..1) into a standard 16-bit PCM WAV byte array.
 */
export function encodeMonoFloat32ToWav(samples: Float32Array, sampleRate = 24000): Uint8Array {
  const numSamples = samples.length;
  const dataByteLength = numSamples * 2;
  const buffer = new ArrayBuffer(44 + dataByteLength);
  const view = new DataView(buffer);

  writeAscii(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataByteLength, true);
  writeAscii(view, 8, 'WAVE');
  writeAscii(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, 1, true); // Mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // Byte rate
  view.setUint16(32, 2, true); // Block align
  view.setUint16(34, 16, true); // Bits per sample
  writeAscii(view, 36, 'data');
  view.setUint32(40, dataByteLength, true);

  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    const int16 = clamped < 0 ? Math.round(clamped * 32768) : Math.round(clamped * 32767);
    view.setInt16(offset, int16, true);
    offset += 2;
  }

  return new Uint8Array(buffer);
}

/**
 * Stitches multiple WAV clips (same sample rate, channel count, bit depth) into a single WAV
 * with an optional silence gap in seconds between consecutive clips.
 */
export function stitchWavBuffers(wavBuffers: Uint8Array[], gapSeconds = 0.4): Uint8Array {
  if (wavBuffers.length === 0) {
    throw new Error('Provide at least one WAV clip to stitch.');
  }

  const parsed = wavBuffers.map((buf) => ({
    buf,
    meta: parseWavHeader(buf),
  }));

  const first = parsed[0].meta;
  const bytesPerSampleFrame = first.numChannels * (first.bitsPerSample / 8);
  const safeGap = Math.max(0, Math.min(5, Number.isFinite(gapSeconds) ? gapSeconds : 0));
  const gapFrames = Math.round(first.sampleRate * safeGap);
  const gapByteLength = gapFrames * bytesPerSampleFrame;

  let totalDataBytes = 0;
  for (let i = 0; i < parsed.length; i++) {
    const { meta } = parsed[i];
    if (
      meta.sampleRate !== first.sampleRate ||
      meta.numChannels !== first.numChannels ||
      meta.bitsPerSample !== first.bitsPerSample
    ) {
      throw new Error(
        `Incompatible WAV format at clip ${i + 1}: expected ${first.sampleRate}Hz ${first.numChannels}ch ${first.bitsPerSample}-bit.`,
      );
    }
    totalDataBytes += meta.dataByteLength;
    if (i < parsed.length - 1) {
      totalDataBytes += gapByteLength;
    }
  }

  const out = new Uint8Array(44 + totalDataBytes);
  const view = new DataView(out.buffer);

  writeAscii(view, 0, 'RIFF');
  view.setUint32(4, 36 + totalDataBytes, true);
  writeAscii(view, 8, 'WAVE');
  writeAscii(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, first.numChannels, true);
  view.setUint32(24, first.sampleRate, true);
  view.setUint32(28, first.sampleRate * bytesPerSampleFrame, true);
  view.setUint16(32, bytesPerSampleFrame, true);
  view.setUint16(34, first.bitsPerSample, true);
  writeAscii(view, 36, 'data');
  view.setUint32(40, totalDataBytes, true);

  let writePos = 44;
  for (let i = 0; i < parsed.length; i++) {
    const { buf, meta } = parsed[i];
    const pcmSlice = buf.subarray(meta.dataOffset, meta.dataOffset + meta.dataByteLength);
    out.set(pcmSlice, writePos);
    writePos += pcmSlice.byteLength;
    if (i < parsed.length - 1 && gapByteLength > 0) {
      // Uint8Array is zero-initialized, so advancing writePos inserts clean PCM silence
      writePos += gapByteLength;
    }
  }

  return out;
}

/**
 * Extracts normalized waveform peak bars (0.04..1.0) directly from a 16-bit PCM WAV byte array.
 */
export function extractWaveformPeaksFromWav(bytes: Uint8Array, barCount = 96): number[] {
  const safeBars = Math.max(8, Math.min(256, barCount));
  const meta = parseWavHeader(bytes);
  const totalSamples = Math.floor(meta.dataByteLength / 2);
  if (totalSamples <= 0) {
    return Array.from({ length: safeBars }, () => 0.08);
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset + meta.dataOffset, meta.dataByteLength);
  const samplesPerBar = Math.max(1, Math.floor(totalSamples / safeBars));
  const rawPeaks: number[] = [];
  let maxPeak = 0.001;

  for (let b = 0; b < safeBars; b++) {
    const start = b * samplesPerBar;
    const end = b === safeBars - 1 ? totalSamples : Math.min(totalSamples, start + samplesPerBar);
    const stride = Math.max(1, Math.floor((end - start) / 64));
    let peak = 0;
    for (let s = start; s < end; s += stride) {
      const val = Math.abs(view.getInt16(s * 2, true)) / 32768;
      if (val > peak) peak = val;
    }
    if (peak > maxPeak) maxPeak = peak;
    rawPeaks.push(peak);
  }

  return rawPeaks.map((p) => {
    const normalized = p / maxPeak;
    return Math.round(Math.max(0.06, Math.min(1, normalized)) * 1000) / 1000;
  });
}

/**
 * Creates a deterministic, pleasant studio acoustic reference tone WAV (24kHz mono 16-bit)
 * used for initial seeded sample takes so waveform, trim, mastering EQ, and stitching
 * can be demonstrated immediately before API generation.
 */
export function synthesizeStudioReferenceWav(
  durationSec: number,
  rootFreqHz = 220,
  sampleRate = 24000,
): Uint8Array {
  const totalSamples = Math.max(1, Math.round(durationSec * sampleRate));
  const samples = new Float32Array(totalSamples);

  const chord = [rootFreqHz, rootFreqHz * 1.25, rootFreqHz * 1.5, rootFreqHz * 2];
  for (let i = 0; i < totalSamples; i++) {
    const t = i / sampleRate;
    const progress = t / durationSec;
    // Syllable-like amplitude modulation envelope so waveform looks organic & speech-cadenced
    const cadence =
      0.55 +
      0.45 *
        Math.abs(
          Math.sin(Math.PI * 2 * 1.8 * t) * Math.cos(Math.PI * 2 * 0.45 * t + 0.4),
        );
    const fadeIn = Math.min(1, t / 0.08);
    const fadeOut = Math.min(1, (durationSec - t) / 0.14);
    const env = Math.max(0, fadeIn * fadeOut * cadence);

    let wave = 0;
    for (let h = 0; h < chord.length; h++) {
      const weight = 1 / (h + 1);
      wave += Math.sin(2 * Math.PI * chord[h] * t + progress * 0.5) * weight;
    }
    samples[i] = (wave / 2.2) * env * 0.65;
  }

  return encodeMonoFloat32ToWav(samples, sampleRate);
}

export function base64ToUint8Array(base64: string): Uint8Array {
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(base64, 'base64'));
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function uint8ArrayToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const slice = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
    binary += String.fromCharCode(...slice);
  }
  return btoa(binary);
}
