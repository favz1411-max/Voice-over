import { ArrowRight, Loader2, Play, Square } from 'lucide-react';
import { useMemo, useState } from 'react';
import { STUDIO_VOICES } from '../data/studioCatalog';
import type { VoiceName } from '../types/voiceover';

interface VoicesDirectoryViewProps {
  selectedStudioVoice: VoiceName;
  auditioningVoice: VoiceName | null;
  auditionLoadingVoice: VoiceName | null;
  auditionError: string | null;
  onAuditionVoice: (voice: VoiceName) => void;
  onUseInStudio: (voice: VoiceName, defaultStyle: string) => void;
}

const REGISTER_FILTERS = ['All', 'Alto', 'Mezzo-Soprano', 'Tenor', 'Baritone', 'Bass-Baritone'] as const;

export function VoicesDirectoryView({
  selectedStudioVoice,
  auditioningVoice,
  auditionLoadingVoice,
  auditionError,
  onAuditionVoice,
  onUseInStudio,
}: VoicesDirectoryViewProps) {
  const [registerFilter, setRegisterFilter] = useState<(typeof REGISTER_FILTERS)[number]>('All');

  const filtered = useMemo(() => {
    if (registerFilter === 'All') return STUDIO_VOICES;
    return STUDIO_VOICES.filter((v) => v.register === registerFilter);
  }, [registerFilter]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-xl font-semibold text-slate-900">Studio Voice Casting</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Audition each studio voice at 24 kHz and cast it directly into your active script.
          </p>
        </div>

        <div
          className="flex flex-wrap items-center gap-1 p-1 bg-slate-200/70 rounded-lg"
          role="group"
          aria-label="Filter voices by vocal register"
        >
          {REGISTER_FILTERS.map((reg) => (
            <button
              key={reg}
              type="button"
              onClick={() => setRegisterFilter(reg)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D4ED8] ${
                registerFilter === reg
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {reg}
            </button>
          ))}
        </div>
      </div>

      {auditionError && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-[#DC2626]"
        >
          {auditionError}
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-200 overflow-hidden">
        {filtered.map((voice) => {
          const isCurrent = selectedStudioVoice === voice.id;
          const isAuditioning = auditioningVoice === voice.id;
          const isLoading = auditionLoadingVoice === voice.id;

          return (
            <article
              key={voice.id}
              className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-5 hover:bg-slate-50/70 transition-colors"
            >
              <div className="space-y-1.5 min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-2">
                  <h2 className="font-display text-base font-semibold text-slate-900">
                    {voice.name}
                  </h2>
                  <span className="text-xs text-slate-400" aria-hidden="true">
                    ·
                  </span>
                  <span className="text-xs font-medium text-slate-600">{voice.register}</span>
                  <span className="text-xs text-slate-400" aria-hidden="true">
                    ·
                  </span>
                  <span className="text-xs text-slate-500">{voice.tone}</span>
                  {isCurrent && (
                    <>
                      <span className="text-xs text-slate-400" aria-hidden="true">
                        ·
                      </span>
                      <span className="text-xs font-medium text-[#1D4ED8]">Active in Studio</span>
                    </>
                  )}
                </div>

                <p className="text-sm text-slate-600 max-w-2xl">{voice.description}</p>
                <p className="text-xs text-slate-500">Best for: {voice.bestFor}</p>
                <p className="text-xs text-slate-500 italic pt-0.5">“{voice.sampleLine}”</p>
              </div>

              <div className="flex items-center gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={() => onAuditionVoice(voice.id)}
                  disabled={isLoading}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D4ED8] ${
                    isAuditioning
                      ? 'border-[#1D4ED8] bg-[#1D4ED8] text-white'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {isLoading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  ) : isAuditioning ? (
                    <Square className="h-3 w-3 fill-current" aria-hidden="true" />
                  ) : (
                    <Play className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  <span>{isAuditioning ? 'Stop Sample' : 'Audition'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => onUseInStudio(voice.id, voice.defaultStyle)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium bg-slate-900 text-white hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D4ED8]"
                >
                  <span>Use in Studio</span>
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
