import type { MasteringPresetId, MasteringSettings } from '../types/voiceover';
import { base64ToUint8Array, encodeMonoFloat32ToWav } from './audioLogic';

/**
 * Connects a source node through our selected studio EQ & dynamics chain into a destination node.
 * Works identically for live AudioContext playback and OfflineAudioContext WAV export.
 */
export function wireMasteringChain(
  ctx: BaseAudioContext,
  source: AudioNode,
  destination: AudioNode,
  preset: MasteringPresetId,
  volume: number,
): void {
  const gainNode = ctx.createGain();
  gainNode.gain.value = Math.max(0, Math.min(1.5, volume));

  if (preset === 'clean') {
    source.connect(gainNode);
    gainNode.connect(destination);
    return;
  }

  const highpass = ctx.createBiquadFilter();
  highpass.type = 'highpass';

  const lowShelf = ctx.createBiquadFilter();
  lowShelf.type = 'lowshelf';

  const presencePeak = ctx.createBiquadFilter();
  presencePeak.type = 'peaking';

  const highShelf = ctx.createBiquadFilter();
  highShelf.type = 'highshelf';

  const compressor = ctx.createDynamicsCompressor();

  if (preset === 'broadcast') {
    highpass.frequency.value = 65;
    lowShelf.frequency.value = 180;
    lowShelf.gain.value = 3.2;
    presencePeak.frequency.value = 2800;
    presencePeak.Q.value = 1.1;
    presencePeak.gain.value = 2.0;
    highShelf.frequency.value = 7500;
    highShelf.gain.value = 1.2;
    compressor.threshold.value = -18;
    compressor.ratio.value = 3.5;
    compressor.attack.value = 0.006;
    compressor.release.value = 0.14;
  } else if (preset === 'podcast') {
    highpass.frequency.value = 95;
    lowShelf.frequency.value = 200;
    lowShelf.gain.value = -1.2;
    presencePeak.frequency.value = 3500;
    presencePeak.Q.value = 1.3;
    presencePeak.gain.value = 3.6;
    highShelf.frequency.value = 8200;
    highShelf.gain.value = 2.2;
    compressor.threshold.value = -16;
    compressor.ratio.value = 4.2;
    compressor.attack.value = 0.004;
    compressor.release.value = 0.12;
  } else {
    // intimate / close-mic
    highpass.frequency.value = 55;
    lowShelf.frequency.value = 150;
    lowShelf.gain.value = 2.4;
    presencePeak.frequency.value = 2200;
    presencePeak.Q.value = 0.9;
    presencePeak.gain.value = 0.8;
    highShelf.frequency.value = 6500;
    highShelf.gain.value = -2.0;
    compressor.threshold.value = -20;
    compressor.ratio.value = 2.6;
    compressor.attack.value = 0.012;
    compressor.release.value = 0.18;
  }

  source.connect(highpass);
  highpass.connect(lowShelf);
  lowShelf.connect(presencePeak);
  presencePeak.connect(highShelf);
  highShelf.connect(compressor);
  compressor.connect(gainNode);
  gainNode.connect(destination);
}

/**
 * Decodes a base64 WAV into an AudioBuffer.
 */
export async function decodeBase64Wav(
  ctx: AudioContext,
  audioBase64: string,
): Promise<AudioBuffer> {
  const bytes = base64ToUint8Array(audioBase64);
  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);
  return ctx.decodeAudioData(copy);
}

/**
 * Renders trimmed, rate-adjusted, and EQ-mastered audio offline into a fresh 24kHz WAV Blob.
 */
export async function renderMasteredWavBlob(
  audioBase64: string,
  settings: MasteringSettings,
): Promise<Blob> {
  const bytes = base64ToUint8Array(audioBase64);
  const tempCtx = new AudioContext();
  try {
    const copy = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(copy).set(bytes);
    const decoded = await tempCtx.decodeAudioData(copy);

    const safeStart = Math.max(0, Math.min(decoded.duration - 0.1, settings.trimStartSec));
    const safeEnd = Math.max(safeStart + 0.1, Math.min(decoded.duration, settings.trimEndSec));
    const regionDuration = safeEnd - safeStart;
    const safeRate = Math.max(0.5, Math.min(2.0, settings.playbackRate));
    const outputDuration = regionDuration / safeRate;
    const targetSampleRate = 24000;
    const frameCount = Math.max(1, Math.ceil(outputDuration * targetSampleRate));

    const offlineCtx = new OfflineAudioContext(1, frameCount, targetSampleRate);
    const source = offlineCtx.createBufferSource();
    source.buffer = decoded;
    source.playbackRate.value = safeRate;

    wireMasteringChain(offlineCtx, source, offlineCtx.destination, settings.preset, settings.volume);
    source.start(0, safeStart, regionDuration);

    const rendered = await offlineCtx.startRendering();
    const channelData = rendered.getChannelData(0);
    const wavBytes = encodeMonoFloat32ToWav(channelData, targetSampleRate);
    return new Blob([wavBytes.buffer as ArrayBuffer], { type: 'audio/wav' });
  } finally {
    await tempCtx.close().catch(() => {});
  }
}

export function triggerFileDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
