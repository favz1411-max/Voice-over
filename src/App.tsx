import { Menu } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DialogueStudioView } from './components/DialogueStudioView';
import { SingleStudioView } from './components/SingleStudioView';
import { StudioSidebar } from './components/StudioSidebar';
import { TakesLibraryView } from './components/TakesLibraryView';
import { VoicesDirectoryView } from './components/VoicesDirectoryView';
import {
  DELIVERY_PRESETS,
  DIALOGUE_TEMPLATES,
  SCRIPT_TEMPLATES,
} from './data/studioCatalog';
import type {
  DialogueSpeakerConfig,
  DialogueTurn,
  TtsEngine,
  VoiceName,
  VoiceoverTake,
  WorkspaceTab,
} from './types/voiceover';
import {
  base64ToUint8Array,
  extractWaveformPeaksFromWav,
  parseWavHeader,
  stitchWavBuffers,
  uint8ArrayToBase64,
} from './utils/audioLogic';
import {
  validateDialogueTtsPayload,
  validateSingleTtsPayload,
} from './utils/scriptLogic';
import { deleteTakeById, loadAllTakes, saveTake } from './utils/takesStorage';

const TAB_TITLES: Record<WorkspaceTab, string> = {
  studio: 'Studio',
  dialogue: 'Dialogue',
  voices: 'Voices',
  takes: 'Takes',
};

export default function App() {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('studio');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Single-speaker Studio state
  const [singleTitle, setSingleTitle] = useState(SCRIPT_TEMPLATES[0].title);
  const [singleScript, setSingleScript] = useState(SCRIPT_TEMPLATES[0].script);
  const [selectedVoice, setSelectedVoice] = useState<VoiceName>(SCRIPT_TEMPLATES[0].recommendedVoice);
  const [deliveryStyle, setDeliveryStyle] = useState(DELIVERY_PRESETS[2].direction);
  const [engine, setEngine] = useState<TtsEngine>('standard');
  const [singleError, setSingleError] = useState<string | null>(null);
  const [isGeneratingSingle, setIsGeneratingSingle] = useState(false);

  // Dialogue Studio state
  const [dialogueTitle, setDialogueTitle] = useState(DIALOGUE_TEMPLATES[0].title);
  const [speakerA, setSpeakerA] = useState<DialogueSpeakerConfig>({
    ...DIALOGUE_TEMPLATES[0].speakerA,
  });
  const [speakerB, setSpeakerB] = useState<DialogueSpeakerConfig>({
    ...DIALOGUE_TEMPLATES[0].speakerB,
  });
  const [dialogueTurns, setDialogueTurns] = useState<DialogueTurn[]>(() =>
    DIALOGUE_TEMPLATES[0].turns.map((turn, idx) => ({
      id: `init-turn-${idx}`,
      speakerSlot: turn.speakerSlot,
      text: turn.text,
    })),
  );
  const [dialogueError, setDialogueError] = useState<string | null>(null);
  const [isGeneratingDialogue, setIsGeneratingDialogue] = useState(false);

  // Takes Library state
  const [takes, setTakes] = useState<VoiceoverTake[]>([]);
  const [activeTakeId, setActiveTakeId] = useState<string | null>(null);

  // Voice audition audio state
  const [auditioningVoice, setAuditioningVoice] = useState<VoiceName | null>(null);
  const [auditionLoadingVoice, setAuditionLoadingVoice] = useState<VoiceName | null>(null);
  const [auditionError, setAuditionError] = useState<string | null>(null);
  const auditionAudioRef = useRef<HTMLAudioElement | null>(null);
  const previewCacheRef = useRef<Map<VoiceName, string>>(new Map());

  // Load persisted takes on mount
  useEffect(() => {
    let mounted = true;
    void loadAllTakes().then((loaded) => {
      if (!mounted) return;
      setTakes(loaded);
      if (loaded.length > 0) {
        setActiveTakeId(loaded[0].id);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  // Stop audition preview on unmount
  useEffect(() => {
    return () => {
      if (auditionAudioRef.current) {
        auditionAudioRef.current.pause();
        auditionAudioRef.current = null;
      }
    };
  }, []);

  const activeTake = useMemo(
    () => takes.find((t) => t.id === activeTakeId) ?? takes[0] ?? null,
    [takes, activeTakeId],
  );

  const totalDurationSec = useMemo(
    () => takes.reduce((sum, t) => sum + (t.durationSec || 0), 0),
    [takes],
  );

  const stopAudition = useCallback(() => {
    if (auditionAudioRef.current) {
      auditionAudioRef.current.pause();
      auditionAudioRef.current = null;
    }
    setAuditioningVoice(null);
  }, []);

  const handleAuditionVoice = useCallback(
    async (voice: VoiceName) => {
      setAuditionError(null);
      if (auditioningVoice === voice) {
        stopAudition();
        return;
      }
      stopAudition();

      try {
        let base64 = previewCacheRef.current.get(voice);
        if (!base64) {
          setAuditionLoadingVoice(voice);
          const response = await fetch('/api/tts/preview', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ voiceName: voice }),
          });
          const data = (await response.json()) as { audioBase64?: string; error?: string };
          if (!response.ok || !data.audioBase64) {
            throw new Error(data.error || 'Could not load voice sample.');
          }
          base64 = data.audioBase64;
          previewCacheRef.current.set(voice, base64);
        }

        const audio = new Audio(`data:audio/wav;base64,${base64}`);
        auditionAudioRef.current = audio;
        setAuditioningVoice(voice);
        audio.onended = () => {
          setAuditioningVoice((cur) => (cur === voice ? null : cur));
        };
        audio.onerror = () => {
          setAuditioningVoice(null);
          setAuditionError('Audio playback failed in this browser session.');
        };
        await audio.play();
      } catch (err) {
        setAuditioningVoice(null);
        setAuditionError(
          err instanceof Error ? err.message : 'Unable to audition voice right now.',
        );
      } finally {
        setAuditionLoadingVoice(null);
      }
    },
    [auditioningVoice, stopAudition],
  );

  const handleGenerateSingle = useCallback(async () => {
    setSingleError(null);
    const validation = validateSingleTtsPayload({
      text: singleScript,
      voiceName: selectedVoice,
      style: deliveryStyle,
      engine,
    });
    if (!validation.valid) {
      setSingleError(validation.error ?? 'Invalid script.');
      return;
    }

    setIsGeneratingSingle(true);
    try {
      const response = await fetch('/api/tts/single', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: singleScript.trim(),
          voiceName: selectedVoice,
          style: deliveryStyle.trim(),
          engine,
        }),
      });

      const data = (await response.json()) as {
        audioBase64?: string;
        durationSec?: number;
        sampleRate?: number;
        peaks?: number[];
        error?: string;
      };

      if (!response.ok || !data.audioBase64) {
        throw new Error(data.error || 'Voiceover generation failed.');
      }

      const newTake: VoiceoverTake = {
        id: `take-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        title: singleTitle.trim() || `${selectedVoice} Take`,
        mode: 'single',
        script: singleScript.trim(),
        voiceSummary: selectedVoice,
        styleSummary: deliveryStyle.trim() || 'Studio Neutral',
        engineLabel: engine === 'expressive' ? 'Expressive Pro' : 'Standard Fast',
        durationSec: data.durationSec ?? 1,
        sampleRate: data.sampleRate ?? 24000,
        createdAt: Date.now(),
        favorite: false,
        audioBase64: data.audioBase64,
        peaks: data.peaks ?? [],
      };

      await saveTake(newTake);
      setTakes((prev) => [newTake, ...prev]);
      setActiveTakeId(newTake.id);
    } catch (err) {
      setSingleError(
        err instanceof Error ? err.message : 'Voiceover generation failed. Please try again.',
      );
    } finally {
      setIsGeneratingSingle(false);
    }
  }, [singleScript, selectedVoice, deliveryStyle, engine, singleTitle]);

  const handleGenerateDialogue = useCallback(async () => {
    setDialogueError(null);
    const payload = {
      speakerA,
      speakerB,
      turns: dialogueTurns.map((t) => ({ speakerSlot: t.speakerSlot, text: t.text })),
    };
    const validation = validateDialogueTtsPayload(payload);
    if (!validation.valid) {
      setDialogueError(validation.error ?? 'Invalid dialogue configuration.');
      return;
    }

    setIsGeneratingDialogue(true);
    try {
      const response = await fetch('/api/tts/dialogue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as {
        audioBase64?: string;
        durationSec?: number;
        sampleRate?: number;
        peaks?: number[];
        error?: string;
      };

      if (!response.ok || !data.audioBase64) {
        throw new Error(data.error || 'Dialogue generation failed.');
      }

      const scriptText = dialogueTurns
        .filter((t) => t.text.trim())
        .map((t) => `${t.speakerSlot === 'A' ? speakerA.name : speakerB.name}: ${t.text.trim()}`)
        .join('\n');

      const newTake: VoiceoverTake = {
        id: `dialogue-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        title: dialogueTitle.trim() || `${speakerA.name} & ${speakerB.name}`,
        mode: 'dialogue',
        script: scriptText,
        voiceSummary: `${speakerA.name} (${speakerA.voiceName}) + ${speakerB.name} (${speakerB.voiceName})`,
        styleSummary: 'Dual-speaker screenplay',
        engineLabel: 'Expressive Pro',
        durationSec: data.durationSec ?? 1,
        sampleRate: data.sampleRate ?? 24000,
        createdAt: Date.now(),
        favorite: false,
        audioBase64: data.audioBase64,
        peaks: data.peaks ?? [],
      };

      await saveTake(newTake);
      setTakes((prev) => [newTake, ...prev]);
      setActiveTakeId(newTake.id);
    } catch (err) {
      setDialogueError(
        err instanceof Error ? err.message : 'Dialogue generation failed. Please try again.',
      );
    } finally {
      setIsGeneratingDialogue(false);
    }
  }, [speakerA, speakerB, dialogueTurns, dialogueTitle]);

  const handleToggleFavorite = useCallback(
    async (id: string) => {
      const target = takes.find((t) => t.id === id);
      if (!target) return;
      const updated = { ...target, favorite: !target.favorite };
      await saveTake(updated);
      setTakes((prev) => prev.map((t) => (t.id === id ? updated : t)));
    },
    [takes],
  );

  const handleDeleteTake = useCallback(
    async (id: string) => {
      await deleteTakeById(id);
      setTakes((prev) => {
        const next = prev.filter((t) => t.id !== id);
        if (activeTakeId === id) {
          setActiveTakeId(next[0]?.id ?? null);
        }
        return next;
      });
    },
    [activeTakeId],
  );

  const handleStitchTakes = useCallback(
    async (takeIds: string[], gapSeconds: number) => {
      const ordered = takeIds
        .map((id) => takes.find((t) => t.id === id))
        .filter((t): t is VoiceoverTake => Boolean(t));
      if (ordered.length < 2) return;

      const buffers = ordered.map((t) => base64ToUint8Array(t.audioBase64));
      const stitchedBytes = stitchWavBuffers(buffers, gapSeconds);
      const meta = parseWavHeader(stitchedBytes);
      const peaks = extractWaveformPeaksFromWav(stitchedBytes, 96);

      const newTake: VoiceoverTake = {
        id: `stitched-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        title: `Stitched Master (${ordered.length} clips)`,
        mode: 'stitched',
        script: ordered.map((t) => t.script).join('\n\n'),
        voiceSummary: `${ordered.length} stitched takes`,
        styleSummary: `${gapSeconds.toFixed(1)}s silence gap`,
        engineLabel: 'WAV Stitcher',
        durationSec: Math.round(meta.durationSec * 100) / 100,
        sampleRate: meta.sampleRate,
        createdAt: Date.now(),
        favorite: false,
        audioBase64: uint8ArrayToBase64(stitchedBytes),
        peaks,
      };

      await saveTake(newTake);
      setTakes((prev) => [newTake, ...prev]);
      setActiveTakeId(newTake.id);
    },
    [takes],
  );

  const handleUseVoiceInStudio = (voice: VoiceName, defaultStyle: string) => {
    setSelectedVoice(voice);
    setDeliveryStyle(defaultStyle);
    setActiveTab('studio');
  };

  const topBarActionLabel =
    activeTab === 'studio'
      ? 'New Blank Script'
      : activeTab === 'dialogue'
        ? 'New Scene'
        : 'Open Studio';

  const handleTopBarPrimaryAction = () => {
    if (activeTab === 'studio') {
      setSingleTitle('');
      setSingleScript('');
      setSingleError(null);
    } else if (activeTab === 'dialogue') {
      setDialogueTitle('');
      setDialogueTurns([
        { id: `turn-${Date.now()}-a`, speakerSlot: 'A', text: '' },
        { id: `turn-${Date.now()}-b`, speakerSlot: 'B', text: '' },
      ]);
      setDialogueError(null);
    } else {
      setActiveTab('studio');
    }
  };

  return (
    <div className="min-h-screen flex bg-[#F5F7FA] text-slate-900">
      <StudioSidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        takesCount={takes.length}
        totalDurationSec={totalDurationSec}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Bar Contract: Breadcrumb on left, 1 contextual action on right */}
        <header className="sticky top-0 z-20 h-14 bg-white/95 backdrop-blur-xs border-b border-slate-200 px-4 lg:px-7 flex items-center justify-between gap-6">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation menu"
              className="lg:hidden inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D4ED8]"
            >
              <Menu className="h-5 w-5" aria-hidden="true" />
            </button>

            <div className="flex items-center gap-2 text-sm min-w-0">
              <span className="font-display font-semibold text-slate-500 whitespace-nowrap shrink-0">
                Cadence
              </span>
              <span className="text-slate-300" aria-hidden="true">
                /
              </span>
              <span className="font-medium text-slate-900 truncate">
                {TAB_TITLES[activeTab]}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleTopBarPrimaryAction}
            className="px-3.5 py-1.5 rounded-lg text-xs font-medium border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D4ED8] focus-visible:ring-offset-1"
          >
            {topBarActionLabel}
          </button>
        </header>

        <main className="flex-1 w-full max-w-[1280px] mx-auto px-4 lg:px-7 py-6">
          {activeTab === 'studio' && (
            <SingleStudioView
              script={singleScript}
              onChangeScript={(val) => {
                setSingleScript(val);
                if (singleError) setSingleError(null);
              }}
              title={singleTitle}
              onChangeTitle={setSingleTitle}
              selectedVoice={selectedVoice}
              onSelectVoice={setSelectedVoice}
              deliveryStyle={deliveryStyle}
              onChangeDeliveryStyle={setDeliveryStyle}
              engine={engine}
              onChangeEngine={setEngine}
              activeTake={activeTake}
              isGenerating={isGeneratingSingle}
              errorMessage={singleError}
              onGenerate={() => void handleGenerateSingle()}
              auditioningVoice={auditioningVoice}
              auditionLoadingVoice={auditionLoadingVoice}
              onAuditionVoice={(v) => void handleAuditionVoice(v)}
            />
          )}

          {activeTab === 'dialogue' && (
            <DialogueStudioView
              title={dialogueTitle}
              onChangeTitle={setDialogueTitle}
              speakerA={speakerA}
              onChangeSpeakerA={setSpeakerA}
              speakerB={speakerB}
              onChangeSpeakerB={setSpeakerB}
              turns={dialogueTurns}
              onChangeTurns={(next) => {
                setDialogueTurns(next);
                if (dialogueError) setDialogueError(null);
              }}
              activeTake={activeTake}
              isGenerating={isGeneratingDialogue}
              errorMessage={dialogueError}
              onGenerate={() => void handleGenerateDialogue()}
            />
          )}

          {activeTab === 'voices' && (
            <VoicesDirectoryView
              selectedStudioVoice={selectedVoice}
              auditioningVoice={auditioningVoice}
              auditionLoadingVoice={auditionLoadingVoice}
              auditionError={auditionError}
              onAuditionVoice={(v) => void handleAuditionVoice(v)}
              onUseInStudio={handleUseVoiceInStudio}
            />
          )}

          {activeTab === 'takes' && (
            <TakesLibraryView
              takes={takes}
              activeTake={activeTake}
              onSelectTake={(take) => setActiveTakeId(take.id)}
              onToggleFavorite={(id) => void handleToggleFavorite(id)}
              onDeleteTake={(id) => void handleDeleteTake(id)}
              onStitchTakes={(ids, gap) => void handleStitchTakes(ids, gap)}
              onNewScript={() => setActiveTab('studio')}
            />
          )}
        </main>
      </div>
    </div>
  );
}
