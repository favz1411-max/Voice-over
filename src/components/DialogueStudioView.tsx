import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  Loader2,
  Plus,
  Trash2,
  Users,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  DIALOGUE_CUES,
  DIALOGUE_TEMPLATES,
  STUDIO_VOICES,
} from '../data/studioCatalog';
import type {
  DialogueSpeakerConfig,
  DialogueTurn,
  VoiceName,
  VoiceoverTake,
} from '../types/voiceover';
import { MAX_DIALOGUE_TURNS, analyzeScript, formatTimecode } from '../utils/scriptLogic';
import { WaveformDeck } from './WaveformDeck';

interface DialogueStudioViewProps {
  title: string;
  onChangeTitle: (val: string) => void;
  speakerA: DialogueSpeakerConfig;
  onChangeSpeakerA: (next: DialogueSpeakerConfig) => void;
  speakerB: DialogueSpeakerConfig;
  onChangeSpeakerB: (next: DialogueSpeakerConfig) => void;
  turns: DialogueTurn[];
  onChangeTurns: (next: DialogueTurn[]) => void;
  activeTake: VoiceoverTake | null;
  isGenerating: boolean;
  errorMessage: string | null;
  onGenerate: () => void;
}

export function DialogueStudioView({
  title,
  onChangeTitle,
  speakerA,
  onChangeSpeakerA,
  speakerB,
  onChangeSpeakerB,
  turns,
  onChangeTurns,
  activeTake,
  isGenerating,
  errorMessage,
  onGenerate,
}: DialogueStudioViewProps) {
  const [focusedTurnId, setFocusedTurnId] = useState<string | null>(turns[0]?.id ?? null);

  const combinedScript = useMemo(
    () => turns.map((t) => t.text).join(' '),
    [turns],
  );
  const stats = useMemo(() => analyzeScript(combinedScript, 152), [combinedScript]);

  const handleLoadTemplate = (templateId: string) => {
    const tpl = DIALOGUE_TEMPLATES.find((t) => t.id === templateId);
    if (!tpl) return;
    onChangeTitle(tpl.title);
    onChangeSpeakerA({ ...tpl.speakerA });
    onChangeSpeakerB({ ...tpl.speakerB });
    const nextTurns = tpl.turns.map((turn, idx) => ({
      id: `turn-${Date.now()}-${idx}`,
      speakerSlot: turn.speakerSlot,
      text: turn.text,
    }));
    onChangeTurns(nextTurns);
    setFocusedTurnId(nextTurns[0]?.id ?? null);
  };

  const handleAddTurn = () => {
    if (turns.length >= MAX_DIALOGUE_TURNS) return;
    const lastSlot = turns[turns.length - 1]?.speakerSlot ?? 'B';
    const nextTurn: DialogueTurn = {
      id: `turn-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      speakerSlot: lastSlot === 'A' ? 'B' : 'A',
      text: '',
    };
    onChangeTurns([...turns, nextTurn]);
    setFocusedTurnId(nextTurn.id);
  };

  const handleUpdateTurnText = (id: string, text: string) => {
    onChangeTurns(turns.map((t) => (t.id === id ? { ...t, text } : t)));
  };

  const handleToggleSpeaker = (id: string) => {
    onChangeTurns(
      turns.map((t) =>
        t.id === id ? { ...t, speakerSlot: t.speakerSlot === 'A' ? 'B' : 'A' } : t,
      ),
    );
  };

  const handleMoveTurn = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= turns.length) return;
    const copy = [...turns];
    const [moved] = copy.splice(index, 1);
    copy.splice(target, 0, moved);
    onChangeTurns(copy);
  };

  const handleDeleteTurn = (id: string) => {
    if (turns.length <= 1) {
      onChangeTurns([{ ...turns[0], text: '' }]);
      return;
    }
    onChangeTurns(turns.filter((t) => t.id !== id));
  };

  const handleInsertCueIntoFocused = (token: string) => {
    const targetId = focusedTurnId ?? turns[turns.length - 1]?.id;
    if (!targetId) return;
    onChangeTurns(
      turns.map((t) => {
        if (t.id !== targetId) return t;
        const spacer = t.text.length > 0 && !/\s$/.test(t.text) ? ' ' : '';
        return { ...t, text: `${t.text}${spacer}${token} ` };
      }),
    );
  };

  return (
    <div className="space-y-6">
      {/* Two-Speaker Casting Bar */}
      <section
        aria-label="Dual-speaker voice casting"
        className="bg-white border border-slate-200 rounded-xl p-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div>
            <h2 className="font-display text-sm font-semibold text-slate-900">
              Dual-Speaker Casting
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Powered by Expressive Pro multi-speaker synthesis with natural backchanneling and vocal cues.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="dialogue-template-select" className="sr-only">
              Load dialogue template
            </label>
            <select
              id="dialogue-template-select"
              defaultValue=""
              onChange={(e) => {
                if (e.target.value) {
                  handleLoadTemplate(e.target.value);
                  e.target.value = '';
                }
              }}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-slate-300 focus:border-[#1D4ED8] focus:outline-none"
            >
              <option value="" disabled>
                Load scene template...
              </option>
              {DIALOGUE_TEMPLATES.map((tpl) => (
                <option key={tpl.id} value={tpl.id}>
                  {tpl.title} ({tpl.category})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-4">
          {/* Speaker A */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#1D4ED8]">Speaker A</span>
              <span className="text-xs text-slate-400">Primary host / role</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="block space-y-1">
                <span className="text-xs text-slate-600">Name</span>
                <input
                  type="text"
                  value={speakerA.name}
                  onChange={(e) => onChangeSpeakerA({ ...speakerA, name: e.target.value })}
                  placeholder="Maya"
                  className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-900 focus:border-[#1D4ED8] focus:outline-none"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs text-slate-600">Voice</span>
                <select
                  value={speakerA.voiceName}
                  onChange={(e) =>
                    onChangeSpeakerA({ ...speakerA, voiceName: e.target.value as VoiceName })
                  }
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 focus:border-[#1D4ED8] focus:outline-none"
                >
                  {STUDIO_VOICES.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name} ({v.register})
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="block space-y-1">
              <span className="text-xs text-slate-600">Direction</span>
              <input
                type="text"
                value={speakerA.style}
                onChange={(e) => onChangeSpeakerA({ ...speakerA, style: e.target.value })}
                placeholder="Warm, articulate host"
                className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-800 focus:border-[#1D4ED8] focus:outline-none"
              />
            </label>
          </div>

          {/* Speaker B */}
          <div className="space-y-3 md:border-l md:border-slate-100 md:pl-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#0F766E]">Speaker B</span>
              <span className="text-xs text-slate-400">Co-host / scene partner</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="block space-y-1">
                <span className="text-xs text-slate-600">Name</span>
                <input
                  type="text"
                  value={speakerB.name}
                  onChange={(e) => onChangeSpeakerB({ ...speakerB, name: e.target.value })}
                  placeholder="Devon"
                  className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-900 focus:border-[#1D4ED8] focus:outline-none"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs text-slate-600">Voice</span>
                <select
                  value={speakerB.voiceName}
                  onChange={(e) =>
                    onChangeSpeakerB({ ...speakerB, voiceName: e.target.value as VoiceName })
                  }
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 focus:border-[#1D4ED8] focus:outline-none"
                >
                  {STUDIO_VOICES.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name} ({v.register})
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="block space-y-1">
              <span className="text-xs text-slate-600">Direction</span>
              <input
                type="text"
                value={speakerB.style}
                onChange={(e) => onChangeSpeakerB({ ...speakerB, style: e.target.value })}
                placeholder="Curious, energetic co-host"
                className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-800 focus:border-[#1D4ED8] focus:outline-none"
              />
            </label>
          </div>
        </div>
      </section>

      {/* Turn-by-Turn Screenplay Builder */}
      <section
        aria-label="Dialogue turns script"
        className="bg-white border border-slate-200 rounded-xl p-5 space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex-1 min-w-[200px]">
            <label htmlFor="dialogue-title-input" className="sr-only">
              Dialogue take title
            </label>
            <input
              id="dialogue-title-input"
              type="text"
              value={title}
              onChange={(e) => onChangeTitle(e.target.value)}
              placeholder="Untitled Dialogue Scene"
              className="w-full font-display text-base font-semibold text-slate-900 placeholder:text-slate-400 bg-transparent border-0 border-b border-transparent focus:border-slate-300 focus:outline-none pb-0.5"
            />
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500 font-mono tabular-nums">
            <span>{turns.length} turns</span>
            <span aria-hidden="true">·</span>
            <span>{stats.words} words</span>
            <span aria-hidden="true">·</span>
            <span className="text-slate-800 font-medium">
              Est. {formatTimecode(stats.estimatedSeconds)}
            </span>
          </div>
        </div>

        <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg">
          {turns.map((turn, index) => {
            const isA = turn.speakerSlot === 'A';
            const speaker = isA ? speakerA : speakerB;
            return (
              <div
                key={turn.id}
                className="flex flex-col sm:flex-row sm:items-start gap-3 p-3.5 bg-white hover:bg-slate-50/60 transition-colors"
              >
                <div className="flex items-center gap-2 sm:w-40 shrink-0">
                  <span className="font-mono text-xs text-slate-400 tabular-nums w-5">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleToggleSpeaker(turn.id)}
                    aria-label={`Switch speaker for line ${index + 1}, currently ${speaker.name}`}
                    className={`flex-1 px-2.5 py-1.5 rounded-md text-xs font-medium text-left truncate border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D4ED8] ${
                      isA
                        ? 'border-[#1D4ED8]/25 bg-[#1D4ED8]/[0.06] text-[#1D4ED8]'
                        : 'border-[#0F766E]/25 bg-[#0F766E]/[0.06] text-[#0F766E]'
                    }`}
                  >
                    {speaker.name || (isA ? 'Speaker A' : 'Speaker B')}
                  </button>
                </div>

                <div className="flex-1 min-w-0">
                  <label htmlFor={`turn-input-${turn.id}`} className="sr-only">
                    Dialogue line {index + 1} for {speaker.name}
                  </label>
                  <textarea
                    id={`turn-input-${turn.id}`}
                    rows={2}
                    value={turn.text}
                    onFocus={() => setFocusedTurnId(turn.id)}
                    onChange={(e) => handleUpdateTurnText(turn.id, e.target.value)}
                    placeholder={`Enter ${speaker.name || 'speaker'}'s line...`}
                    className="w-full resize-none rounded-lg border border-slate-200 bg-slate-50/40 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#1D4ED8] focus:bg-white focus:outline-none"
                  />
                </div>

                <div className="flex sm:flex-col items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleMoveTurn(index, -1)}
                    disabled={index === 0}
                    aria-label={`Move line ${index + 1} up`}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:bg-slate-200/70 hover:text-slate-900 disabled:opacity-30"
                  >
                    <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMoveTurn(index, 1)}
                    disabled={index === turns.length - 1}
                    aria-label={`Move line ${index + 1} down`}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:bg-slate-200/70 hover:text-slate-900 disabled:opacity-30"
                  >
                    <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteTurn(turn.id)}
                    aria-label={`Delete line ${index + 1}`}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:bg-red-50 hover:text-[#DC2626]"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom Dialogue Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={handleAddTurn}
              disabled={turns.length >= MAX_DIALOGUE_TURNS}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-800 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-40 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D4ED8]"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Add Dialogue Line</span>
            </button>

            <span className="text-xs text-slate-400 mx-1" aria-hidden="true">
              |
            </span>

            {DIALOGUE_CUES.map((cue) => (
              <button
                key={cue.token}
                type="button"
                onClick={() => handleInsertCueIntoFocused(cue.token)}
                className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200/80 rounded-md transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D4ED8]"
              >
                {cue.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={onGenerate}
            disabled={isGenerating}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#1D4ED8] px-4 py-2 text-sm font-medium text-white hover:bg-[#1E40AF] disabled:opacity-60 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D4ED8] focus-visible:ring-offset-2"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                <span>Generating Dialogue...</span>
              </>
            ) : (
              <>
                <Users className="h-4 w-4" aria-hidden="true" />
                <span>Generate Dialogue</span>
              </>
            )}
          </button>
        </div>

        {errorMessage && (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-[#DC2626]"
          >
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
            <span>{errorMessage}</span>
          </div>
        )}
      </section>

      <WaveformDeck take={activeTake} isGenerating={isGenerating} />
    </div>
  );
}
