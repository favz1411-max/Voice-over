import {
  Download,
  FileText,
  Pause,
  Play,
  Repeat,
  RotateCcw,
  Scissors,
  SlidersHorizontal,
  Volume2,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { MASTERING_PRESETS } from '../data/studioCatalog';
import type { MasteringPresetId, MasteringSettings, VoiceoverTake } from '../types/voiceover';
import {
  decodeBase64Wav,
  renderMasteredWavBlob,
  triggerFileDownload,
  wireMasteringChain,
} from '../utils/audioMastering';
import { buildSrtFromScript, formatTimecode } from '../utils/scriptLogic';

interface WaveformDeckProps {
  take: VoiceoverTake | null;
  isGenerating?: boolean;
}

const SPEED_OPTIONS = [0.85, 1.0, 1.15, 1.25] as const;

export function WaveformDeck({ take, isGenerating = false }: WaveformDeckProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const [exportNotice, setExportNotice] = useState<string | null>(null);
  const [settings, setSettings] = useState<MasteringSettings>({
    preset: 'clean',
    playbackRate: 1.0,
    volume: 1.0,
    trimStartSec: 0,
    trimEndSec: 0,
    loop: false,
  });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const playStartCtxTimeRef = useRef(0);
  const playOffsetRef = useRef(0);
  const isPlayingRef = useRef(false);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const stopPlayback = useCallback((resetPosition = false) => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.onended = null;
        sourceNodeRef.current.stop();
        sourceNodeRef.current.disconnect();
      } catch {
        // Already stopped
      }
      sourceNodeRef.current = null;
    }
    isPlayingRef.current = false;
    setIsPlaying(false);
    if (resetPosition) {
      const startSec = settingsRef.current.trimStartSec;
      playOffsetRef.current = startSec;
      setCurrentTime(startSec);
    }
  }, []);

  // Load new take buffer whenever take changes
  useEffect(() => {
    stopPlayback(false);
    setExportNotice(null);

    if (!take) {
      audioBufferRef.current = null;
      setDuration(0);
      setCurrentTime(0);
      setSettings((prev) => ({ ...prev, trimStartSec: 0, trimEndSec: 0 }));
      return;
    }

    const dur = Math.max(0.1, take.durationSec);
    setDuration(dur);
    setCurrentTime(0);
    playOffsetRef.current = 0;
    setSettings((prev) => ({
      ...prev,
      trimStartSec: 0,
      trimEndSec: dur,
    }));

    let cancelled = false;
    (async () => {
      try {
        if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
          audioCtxRef.current = new AudioContext();
        }
        const decoded = await decodeBase64Wav(audioCtxRef.current, take.audioBase64);
        if (!cancelled) {
          audioBufferRef.current = decoded;
          setDuration(decoded.duration);
          setSettings((prev) => ({
            ...prev,
            trimStartSec: 0,
            trimEndSec: Math.round(decoded.duration * 100) / 100,
          }));
        }
      } catch {
        // Fallback to metadata duration if headless audio decode is unavailable
        if (!cancelled) {
          audioBufferRef.current = null;
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [take, stopPlayback]);

  // Clean up audio context on unmount
  useEffect(() => {
    return () => {
      stopPlayback(false);
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        audioCtxRef.current.close().catch(() => {});
      }
    };
  }, [stopPlayback]);

  const startPlaybackFrom = useCallback(
    async (offsetSec: number) => {
      if (!take) return;
      if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
        audioCtxRef.current = new AudioContext();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }
      if (!audioBufferRef.current) {
        audioBufferRef.current = await decodeBase64Wav(ctx, take.audioBase64);
      }
      const buffer = audioBufferRef.current;
      if (!buffer) return;

      stopPlayback(false);

      const { trimStartSec, trimEndSec, playbackRate, preset, volume, loop } = settingsRef.current;
      const safeEnd = Math.max(trimStartSec + 0.1, Math.min(buffer.duration, trimEndSec || buffer.duration));
      const clampedStart =
        offsetSec < trimStartSec || offsetSec >= safeEnd - 0.05 ? trimStartSec : offsetSec;
      const remaining = Math.max(0.05, safeEnd - clampedStart);

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.playbackRate.value = playbackRate;

      wireMasteringChain(ctx, source, ctx.destination, preset, volume);

      sourceNodeRef.current = source;
      playStartCtxTimeRef.current = ctx.currentTime;
      playOffsetRef.current = clampedStart;
      isPlayingRef.current = true;
      setIsPlaying(true);

      source.onended = () => {
        if (!isPlayingRef.current) return;
        if (loop) {
          void startPlaybackFrom(settingsRef.current.trimStartSec);
        } else {
          stopPlayback(true);
        }
      };

      source.start(0, clampedStart, remaining);

      const tick = () => {
        if (!isPlayingRef.current || !audioCtxRef.current) return;
        const elapsed =
          (audioCtxRef.current.currentTime - playStartCtxTimeRef.current) *
          settingsRef.current.playbackRate;
        const nextTime = Math.min(safeEnd, playOffsetRef.current + elapsed);
        setCurrentTime(nextTime);
        if (nextTime < safeEnd) {
          rafRef.current = requestAnimationFrame(tick);
        }
      };
      rafRef.current = requestAnimationFrame(tick);
    },
    [take, stopPlayback],
  );

  const togglePlay = () => {
    if (!take) return;
    if (isPlaying) {
      const elapsed =
        audioCtxRef.current && isPlayingRef.current
          ? (audioCtxRef.current.currentTime - playStartCtxTimeRef.current) * settings.playbackRate
          : 0;
      const pausedAt = Math.min(duration, playOffsetRef.current + elapsed);
      stopPlayback(false);
      playOffsetRef.current = pausedAt;
      setCurrentTime(pausedAt);
    } else {
      void startPlaybackFrom(currentTime);
    }
  };

  // Re-trigger playback smoothly if preset or speed changes while playing
  const updateSetting = <K extends keyof MasteringSettings>(key: K, value: MasteringSettings[K]) => {
    setSettings((prev) => {
      const next = { ...prev, [key]: value };
      settingsRef.current = next;
      return next;
    });
    if (isPlayingRef.current && (key === 'preset' || key === 'playbackRate' || key === 'volume')) {
      void startPlaybackFrom(currentTime);
    }
  };

  // Render crisp canvas waveform
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth || 640;
    const height = canvas.clientHeight || 88;
    if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const peaks = take?.peaks ?? [];
    if (peaks.length === 0) {
      // Quiet neutral studio grid baseline
      ctx.strokeStyle = '#E2E8F0';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, height / 2);
      ctx.lineTo(width, height / 2);
      ctx.stroke();
      return;
    }

    const totalDur = Math.max(0.1, duration || take?.durationSec || 1);
    const playRatio = Math.max(0, Math.min(1, currentTime / totalDur));
    const trimStartRatio = Math.max(0, Math.min(1, settings.trimStartSec / totalDur));
    const trimEndRatio = Math.max(trimStartRatio, Math.min(1, (settings.trimEndSec || totalDur) / totalDur));

    // Subtle shaded regions outside trim bounds
    if (trimStartRatio > 0) {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.05)';
      ctx.fillRect(0, 0, width * trimStartRatio, height);
    }
    if (trimEndRatio < 1) {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.05)';
      ctx.fillRect(width * trimEndRatio, 0, width * (1 - trimEndRatio), height);
    }

    // Center reference hairline
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();

    const barCount = peaks.length;
    const step = width / barCount;
    const barWidth = Math.max(2, step * 0.62);

    for (let i = 0; i < barCount; i++) {
      const ratio = (i + 0.5) / barCount;
      const amp = peaks[i];
      const barHeight = Math.max(4, amp * (height - 18));
      const x = i * step + (step - barWidth) / 2;
      const y = (height - barHeight) / 2;

      const outsideTrim = ratio < trimStartRatio || ratio > trimEndRatio;
      if (outsideTrim) {
        ctx.fillStyle = '#CBD5E1';
      } else if (ratio <= playRatio) {
        ctx.fillStyle = '#1D4ED8';
      } else {
        ctx.fillStyle = '#64748B';
      }

      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, barHeight, 1.5);
      ctx.fill();
    }

    // Trim markers
    if (trimStartRatio > 0) {
      ctx.strokeStyle = '#0F172A';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(width * trimStartRatio, 4);
      ctx.lineTo(width * trimStartRatio, height - 4);
      ctx.stroke();
    }
    if (trimEndRatio < 1) {
      ctx.strokeStyle = '#0F172A';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(width * trimEndRatio, 4);
      ctx.lineTo(width * trimEndRatio, height - 4);
      ctx.stroke();
    }

    // Active playhead
    const playX = Math.max(1, Math.min(width - 1, playRatio * width));
    ctx.strokeStyle = '#1D4ED8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(playX, 0);
    ctx.lineTo(playX, height);
    ctx.stroke();
  }, [take, currentTime, duration, settings.trimStartSec, settings.trimEndSec]);

  const handleWaveformClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!take || duration <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const targetSec = ratio * duration;
    setCurrentTime(targetSec);
    playOffsetRef.current = targetSec;
    if (isPlaying) {
      void startPlaybackFrom(targetSec);
    }
  };

  const handleExportWav = async () => {
    if (!take) return;
    setIsExporting(true);
    setExportNotice(null);
    try {
      const blob = await renderMasteredWavBlob(take.audioBase64, settings);
      const slug = take.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 48);
      triggerFileDownload(blob, `${slug || 'voiceover'}.wav`);
      setExportNotice('Exported mastered 24 kHz WAV');
    } catch {
      // Fallback: download raw WAV bytes if OfflineAudioContext is unavailable
      const rawBytes = Uint8Array.from(atob(take.audioBase64), (c) => c.charCodeAt(0));
      const blob = new Blob([rawBytes], { type: 'audio/wav' });
      triggerFileDownload(blob, 'voiceover.wav');
      setExportNotice('Exported original WAV');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportSrt = () => {
    if (!take) return;
    const effectiveDur = Math.max(0.5, (settings.trimEndSec - settings.trimStartSec) / settings.playbackRate);
    const srtContent = buildSrtFromScript(take.script, effectiveDur);
    if (!srtContent) return;
    const blob = new Blob([srtContent], { type: 'text/plain;charset=utf-8' });
    const slug = take.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 48);
    triggerFileDownload(blob, `${slug || 'voiceover'}.srt`);
    setExportNotice('Exported SRT caption file');
  };

  const trimmedDuration = Math.max(
    0,
    ((settings.trimEndSec || duration) - settings.trimStartSec) / settings.playbackRate,
  );

  return (
    <section
      aria-label="Audio monitor and mastering deck"
      className="bg-white border border-slate-200 rounded-xl p-5 space-y-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-sm font-semibold text-slate-900 truncate">
            {isGenerating
              ? 'Rendering voiceover audio...'
              : take
                ? take.title
                : 'Audio Monitor'}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5 flex flex-wrap items-center gap-1.5">
            {take ? (
              <>
                <span>{take.voiceSummary}</span>
                <span aria-hidden="true">·</span>
                <span>{take.engineLabel}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">
                  {Math.round(take.sampleRate / 1000)} kHz WAV
                </span>
              </>
            ) : (
              <span>Generate a take or select one from Takes to audition and master.</span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleExportSrt}
            disabled={!take || isGenerating}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-45 disabled:cursor-not-allowed transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D4ED8]"
          >
            <FileText className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Export SRT</span>
          </button>
          <button
            type="button"
            onClick={() => void handleExportWav()}
            disabled={!take || isGenerating || isExporting}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-45 disabled:cursor-not-allowed transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D4ED8]"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{isExporting ? 'Rendering...' : 'Export WAV'}</span>
          </button>
        </div>
      </div>

      {/* Interactive Waveform Canvas */}
      <div className="relative rounded-lg bg-slate-50 border border-slate-200/80 px-3 py-2">
        {isGenerating && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-white/80 backdrop-blur-[1px]">
            <span className="text-xs font-medium text-slate-700">
              Synthesizing 24 kHz studio master...
            </span>
          </div>
        )}
        <canvas
          ref={canvasRef}
          data-testid="waveform-canvas"
          onClick={handleWaveformClick}
          className={`w-full h-[88px] block ${take ? 'cursor-pointer' : 'cursor-default'}`}
        />
      </div>

      {/* Transport & Timecode Row */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={togglePlay}
            disabled={!take || isGenerating}
            aria-label={isPlaying ? 'Pause playback' : 'Play voiceover'}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-[#1D4ED8] text-white hover:bg-[#1E40AF] disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D4ED8] focus-visible:ring-offset-2"
          >
            {isPlaying ? (
              <Pause className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Play className="h-4 w-4 ml-0.5" aria-hidden="true" />
            )}
          </button>

          <button
            type="button"
            onClick={() => stopPlayback(true)}
            disabled={!take}
            aria-label="Rewind to trim start"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D4ED8]"
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={() => updateSetting('loop', !settings.loop)}
            disabled={!take}
            aria-pressed={settings.loop}
            aria-label="Toggle loop playback"
            className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border transition-colors disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D4ED8] ${
              settings.loop
                ? 'border-[#1D4ED8] bg-[#1D4ED8]/10 text-[#1D4ED8]'
                : 'border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <Repeat className="h-4 w-4" aria-hidden="true" />
          </button>

          <div className="pl-2 font-mono text-xs text-slate-700 tabular-nums">
            <span className="font-semibold text-slate-900">{formatTimecode(currentTime)}</span>
            <span className="text-slate-400 mx-1">/</span>
            <span>{formatTimecode(duration)}</span>
          </div>
        </div>

        {/* Speed & Volume */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg" role="group" aria-label="Playback speed">
            {SPEED_OPTIONS.map((rate) => (
              <button
                key={rate}
                type="button"
                onClick={() => updateSetting('playbackRate', rate)}
                className={`px-2 py-1 text-xs font-mono tabular-nums rounded-md transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D4ED8] ${
                  settings.playbackRate === rate
                    ? 'bg-white text-slate-900 font-medium shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {rate === 1 ? '1.0x' : `${rate}x`}
              </button>
            ))}
          </div>

          <label className="flex items-center gap-2 text-xs text-slate-600">
            <Volume2 className="h-4 w-4 text-slate-500 shrink-0" aria-hidden="true" />
            <span className="sr-only">Monitor volume</span>
            <input
              type="range"
              min={0}
              max={1.25}
              step={0.05}
              value={settings.volume}
              onChange={(e) => updateSetting('volume', Number(e.target.value))}
              className="studio-slider w-20"
            />
          </label>
        </div>
      </div>

      {/* Mastering Chain & Trim Controls */}
      <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <div className="flex items-center gap-2 overflow-x-auto max-w-full">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 shrink-0">
            <SlidersHorizontal className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
            <span>Mastering</span>
          </span>
          <div
            className="inline-flex items-center gap-1 bg-slate-100 p-1 rounded-lg shrink-0"
            role="group"
            aria-label="Mastering EQ preset"
          >
            {MASTERING_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                title={preset.summary}
                onClick={() => updateSetting('preset', preset.id as MasteringPresetId)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D4ED8] ${
                  settings.preset === preset.id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 text-xs text-slate-600">
          <span className="inline-flex items-center gap-1 text-slate-500">
            <Scissors className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Trim</span>
          </span>
          <label className="flex items-center gap-1.5">
            <span className="text-slate-500">In</span>
            <input
              type="number"
              min={0}
              max={Math.max(0, Number((settings.trimEndSec - 0.1).toFixed(1)))}
              step={0.1}
              disabled={!take}
              value={Number(settings.trimStartSec.toFixed(1))}
              onChange={(e) => {
                const val = Math.max(0, Math.min(settings.trimEndSec - 0.1, Number(e.target.value) || 0));
                updateSetting('trimStartSec', val);
              }}
              className="w-14 rounded-md border border-slate-200 px-2 py-1 font-mono text-xs tabular-nums text-slate-900 disabled:bg-slate-50 focus:border-[#1D4ED8] focus:outline-none"
            />
          </label>
          <label className="flex items-center gap-1.5">
            <span className="text-slate-500">Out</span>
            <input
              type="number"
              min={Number((settings.trimStartSec + 0.1).toFixed(1))}
              max={Number(duration.toFixed(1))}
              step={0.1}
              disabled={!take}
              value={Number((settings.trimEndSec || duration).toFixed(1))}
              onChange={(e) => {
                const val = Math.max(
                  settings.trimStartSec + 0.1,
                  Math.min(duration, Number(e.target.value) || duration),
                );
                updateSetting('trimEndSec', val);
              }}
              className="w-14 rounded-md border border-slate-200 px-2 py-1 font-mono text-xs tabular-nums text-slate-900 disabled:bg-slate-50 focus:border-[#1D4ED8] focus:outline-none"
            />
          </label>
          {take && (
            <span className="font-mono text-slate-500 tabular-nums whitespace-nowrap">
              ({formatTimecode(trimmedDuration)})
            </span>
          )}
        </div>
      </div>

      {exportNotice && (
        <p className="text-xs text-[#16A34A] font-medium" role="status">
          {exportNotice}
        </p>
      )}
    </section>
  );
}
