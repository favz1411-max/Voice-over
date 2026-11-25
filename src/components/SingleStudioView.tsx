import { AlertCircle, Check, Copy, Loader2, Play, Square, Trash2, Volume2 } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import {
  DELIVERY_PRESETS,
  SCRIPT_TEMPLATES,
  STUDIO_VOICES,
  VOCAL_CUES,
} from '../data/studioCatalog';
import type { TtsEngine, VoiceName, VoiceoverTake } from '../types/voiceover';
import {
  MAX_SCRIPT_CHARS,
  analyzeScript,
  formatTimecode,
  insertCueAtCursor,
} from '../utils/scriptLogic';
import { WaveformDeck } from './WaveformDeck';

interface SingleStudioViewProps {
  script: string;
  onChangeScript: (val: string) => void;
  title: string;
  onChangeTitle: (val: string) => void;
  selectedVoice: VoiceName;
  onSelectVoice: (voice: VoiceName) => void;
  deliveryStyle: string;
  onChangeDeliveryStyle: (val: string) => void;
  engine: TtsEngine;
  onChangeEngine: (engine: TtsEngine) => void;
  activeTake: VoiceoverTake | null;
  isGenerating: boolean;
  errorMessage: string | null;
  onGenerate: () => void;
  auditioningVoice: VoiceName | null;
  auditionLoadingVoice: VoiceName | null;
  onAuditionVoice: (voice: VoiceName) => void;
}

export function SingleStudioView({
  script,
  onChangeScript,
  title,
  onChangeTitle,
  selectedVoice,
  onSelectVoice,
  deliveryStyle,
  onChangeDeliveryStyle,
  engine,
  onChangeEngine,
  activeTake,
  isGenerating,
  errorMessage,
  onGenerate,
  auditioningVoice,
  auditionLoadingVoice,
  onAuditionVoice,
}: SingleStudioViewProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [copied, setCopied] = useState(false);

  const activePreset = useMemo(
    () => DELIVERY_PRESETS.find((p) => p.direction === deliveryStyle),
    [deliveryStyle],
  );

  const stats = useMemo(
    () => analyzeScript(script, activePreset?.wpm ?? 148),
    [script, activePreset],
  );

  const handleInsertCue = (cue: string) => {
    const el = textareaRef.current;
    const start = el ? el.selectionStart : script.length;
    const end = el ? el.selectionEnd : script.length;
    const { nextText, nextCursor } = insertCueAtCursor(script, cue, start, end);
    onChangeScript(nextText);
    if (cue.startsWith('<') && engine !== 'expressive') {
      onChangeEngine('expressive');
    }
    requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(nextCursor, nextCursor);
      }
    });
  };

  const handleApplyTemplate = (templateId: string) => {
    const tpl = SCRIPT_TEMPLATES.find((t) => t.id === templateId);
    if (!tpl) return;
    onChangeTitle(tpl.title);
    onChangeScript(tpl.script);
    onSelectVoice(tpl.recommendedVoice);
    onChangeDeliveryStyle(tpl.recommendedStyle);
    if (tpl.script.includes('<breath>')) {
      onChangeEngine('expressive');
    }
  };

  const handleCopyScript = async () => {
    if (!script.trim()) return;
    try {
      await navigator.clipboard.writeText(script);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard API unavailable
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left Column: Script Editor + Waveform Monitor */}
      <div className="lg:col-span-7 space-y-5">
        <section
          aria-label="Voiceover script editor"
          className="bg-white border border-slate-200 rounded-xl p-5 space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex-1 min-w-[200px]">
              <label htmlFor="take-title-input" className="sr-only">
                Take title
              </label>
              <input
                id="take-title-input"
                type="text"
                value={title}
                onChange={(e) => onChangeTitle(e.target.value)}
                placeholder="Untitled Voiceover Take"
                className="w-full font-display text-base font-semibold text-slate-900 placeholder:text-slate-400 bg-transparent border-0 border-b border-transparent focus:border-slate-300 focus:outline-none pb-0.5"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto min-w-0">
              <label htmlFor="script-template-select" className="sr-only">
                Load script template
              </label>
              <select
                id="script-template-select"
                defaultValue=""
                onChange={(e) => {
                  if (e.target.value) {
                    handleApplyTemplate(e.target.value);
                    e.target.value = '';
                  }
                }}
                className="flex-1 sm:flex-none min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-slate-300 focus:border-[#1D4ED8] focus:outline-none truncate"
              >
                <option value="" disabled>
                  Load template...
                </option>
                {SCRIPT_TEMPLATES.map((tpl) => (
                  <option key={tpl.id} value={tpl.id}>
                    {tpl.title} ({tpl.category})
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => void handleCopyScript()}
                disabled={!script.trim()}
                aria-label="Copy script to clipboard"
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D4ED8]"
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-[#16A34A]" aria-hidden="true" />
                ) : (
                  <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                )}
              </button>

              <button
                type="button"
                onClick={() => onChangeScript('')}
                disabled={!script}
                aria-label="Clear script"
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-[#DC2626] disabled:opacity-40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D4ED8]"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="voiceover-script-textarea" className="sr-only">
              Voiceover script text
            </label>
            <textarea
              ref={textareaRef}
              id="voiceover-script-textarea"
              rows={9}
              value={script}
              onChange={(e) => onChangeScript(e.target.value)}
              placeholder="Write or paste your narration script here. Use punctuation and vocal cues to shape rhythm and breathing."
              className="w-full resize-y rounded-lg border border-slate-200 bg-slate-50/50 p-3.5 text-[15px] leading-relaxed text-slate-900 placeholder:text-slate-400 focus:border-[#1D4ED8] focus:bg-white focus:outline-none transition-colors"
            />
          </div>

          {/* Cue Insert Bar & Live Timing Metrics */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Insert vocal cue">
              <span className="text-xs text-slate-500 mr-1">Insert cue:</span>
              {VOCAL_CUES.map((cue) => (
                <button
                  key={cue.token}
                  type="button"
                  title={cue.hint}
                  onClick={() => handleInsertCue(cue.token)}
                  className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200/80 rounded-md transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D4ED8]"
                >
                  {cue.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-500 font-mono tabular-nums">
              <span>{stats.words} words</span>
              <span aria-hidden="true">·</span>
              <span className={stats.characters > MAX_SCRIPT_CHARS ? 'text-[#DC2626] font-semibold' : ''}>
                {stats.characters}/{MAX_SCRIPT_CHARS} chars
              </span>
              <span aria-hidden="true">·</span>
              <span className="text-slate-800 font-medium">
                Est. {formatTimecode(stats.estimatedSeconds)}
              </span>
            </div>
          </div>
        </section>

        <WaveformDeck take={activeTake} isGenerating={isGenerating} />
      </div>

      {/* Right Column: Voice Casting & Direction Inspector */}
      <aside
        aria-label="Voice and delivery inspector"
        className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 space-y-5"
      >
        {/* Voice Selection */}
        <div className="space-y-2.5">
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-sm font-semibold text-slate-900">Studio Voice</h2>
            <span className="text-xs text-slate-500">5 studio voices</span>
          </div>

          <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden">
            {STUDIO_VOICES.map((voice) => {
              const isSelected = selectedVoice === voice.id;
              const isAuditioning = auditioningVoice === voice.id;
              const isLoadingPreview = auditionLoadingVoice === voice.id;

              return (
                <div
                  key={voice.id}
                  className={`flex items-center justify-between gap-3 px-3.5 py-2.5 transition-colors ${
                    isSelected ? 'bg-[#1D4ED8]/[0.06]' : 'bg-white hover:bg-slate-50'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onSelectVoice(voice.id)}
                    aria-pressed={isSelected}
                    className="flex-1 min-w-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D4ED8] rounded"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-sm font-semibold ${
                          isSelected ? 'text-[#1D4ED8]' : 'text-slate-900'
                        }`}
                      >
                        {voice.name}
                      </span>
                      <span className="text-xs text-slate-400" aria-hidden="true">
                        ·
                      </span>
                      <span className="text-xs text-slate-500 truncate">
                        {voice.register} · {voice.tone}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 truncate mt-0.5">{voice.bestFor}</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => onAuditionVoice(voice.id)}
                    disabled={isLoadingPreview}
                    aria-label={isAuditioning ? `Stop ${voice.name} preview` : `Audition ${voice.name} voice`}
                    className={`inline-flex h-8 w-8 items-center justify-center rounded-md border transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D4ED8] ${
                      isAuditioning
                        ? 'border-[#1D4ED8] bg-[#1D4ED8] text-white'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    {isLoadingPreview ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                    ) : isAuditioning ? (
                      <Square className="h-3 w-3 fill-current" aria-hidden="true" />
                    ) : (
                      <Play className="h-3.5 w-3.5 ml-0.5" aria-hidden="true" />
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Delivery Direction */}
        <div className="space-y-2.5 pt-1 border-t border-slate-100">
          <div className="flex items-baseline justify-between">
            <label htmlFor="delivery-direction-input" className="font-display text-sm font-semibold text-slate-900">
              Delivery Direction
            </label>
            <span className="text-xs text-slate-500">Style prompt</span>
          </div>

          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Delivery style presets">
            {DELIVERY_PRESETS.map((preset) => {
              const active = deliveryStyle === preset.direction;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => onChangeDeliveryStyle(preset.direction)}
                  className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D4ED8] ${
                    active
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200/80'
                  }`}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>

          <textarea
            id="delivery-direction-input"
            rows={2}
            value={deliveryStyle}
            onChange={(e) => onChangeDeliveryStyle(e.target.value)}
            placeholder="Describe pacing, warmth, projection, or character direction..."
            className="w-full resize-none rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs leading-relaxed text-slate-800 placeholder:text-slate-400 focus:border-[#1D4ED8] focus:bg-white focus:outline-none"
          />
        </div>

        {/* Synthesis Engine Selector */}
        <div className="space-y-2 pt-1 border-t border-slate-100">
          <div className="flex items-baseline justify-between">
            <span className="font-display text-sm font-semibold text-slate-900">Speech Engine</span>
            <span className="text-xs text-slate-500">
              {engine === 'expressive' ? 'Best for cues & direction' : 'Fast studio reads'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-lg" role="group" aria-label="Speech engine">
            <button
              type="button"
              onClick={() => onChangeEngine('standard')}
              aria-pressed={engine === 'standard'}
              className={`py-1.5 px-3 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D4ED8] ${
                engine === 'standard'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Standard Fast
            </button>
            <button
              type="button"
              onClick={() => onChangeEngine('expressive')}
              aria-pressed={engine === 'expressive'}
              className={`py-1.5 px-3 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D4ED8] ${
                engine === 'expressive'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Expressive Pro
            </button>
          </div>
        </div>

        {/* Validation / API Error Banner */}
        {errorMessage && (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-[#DC2626]"
          >
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Primary Generate CTA */}
        <button
          type="button"
          onClick={onGenerate}
          disabled={isGenerating}
          className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-[#1D4ED8] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#1E40AF] disabled:opacity-60 disabled:cursor-not-allowed transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D4ED8] focus-visible:ring-offset-2"
        >
          {isGenerating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              <span>Generating Voiceover...</span>
            </>
          ) : (
            <>
              <Volume2 className="h-4 w-4" aria-hidden="true" />
              <span>Generate Voiceover</span>
            </>
          )}
        </button>
      </aside>
    </div>
  );
}
