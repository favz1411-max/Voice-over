import {
  CheckSquare,
  Download,
  Layers,
  Play,
  Search,
  Square,
  Star,
  Trash2,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import type { VoiceoverTake } from '../types/voiceover';
import { base64ToUint8Array } from '../utils/audioLogic';
import { triggerFileDownload } from '../utils/audioMastering';
import { formatTimecode } from '../utils/scriptLogic';
import { WaveformDeck } from './WaveformDeck';

interface TakesLibraryViewProps {
  takes: VoiceoverTake[];
  activeTake: VoiceoverTake | null;
  onSelectTake: (take: VoiceoverTake) => void;
  onToggleFavorite: (id: string) => void;
  onDeleteTake: (id: string) => void;
  onStitchTakes: (takeIds: string[], gapSeconds: number) => void;
  onNewScript: () => void;
}

type FilterMode = 'all' | 'single' | 'dialogue' | 'stitched' | 'favorites';

const MODE_LABELS: Record<VoiceoverTake['mode'], string> = {
  single: 'Single',
  dialogue: 'Dialogue',
  stitched: 'Stitched',
  sample: 'Sample',
};

export function TakesLibraryView({
  takes,
  activeTake,
  onSelectTake,
  onToggleFavorite,
  onDeleteTake,
  onStitchTakes,
  onNewScript,
}: TakesLibraryViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [gapSeconds, setGapSeconds] = useState(0.5);
  const [stitchFeedback, setStitchFeedback] = useState<string | null>(null);

  const filteredTakes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return takes.filter((take) => {
      if (filterMode === 'favorites' && !take.favorite) return false;
      if (filterMode !== 'all' && filterMode !== 'favorites' && take.mode !== filterMode) {
        return false;
      }
      if (!q) return true;
      return (
        take.title.toLowerCase().includes(q) ||
        take.script.toLowerCase().includes(q) ||
        take.voiceSummary.toLowerCase().includes(q)
      );
    });
  }, [takes, searchQuery, filterMode]);

  const toggleSelectForStitch = (id: string) => {
    setStitchFeedback(null);
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const handleRunStitch = () => {
    if (selectedIds.length < 2) return;
    onStitchTakes(selectedIds, gapSeconds);
    setStitchFeedback(`Stitched ${selectedIds.length} takes with ${gapSeconds.toFixed(1)}s gaps.`);
    setSelectedIds([]);
  };

  const handleDirectDownload = (take: VoiceoverTake) => {
    const bytes = base64ToUint8Array(take.audioBase64);
    const blob = new Blob([bytes.buffer as ArrayBuffer], { type: 'audio/wav' });
    const slug = take.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 48);
    triggerFileDownload(blob, `${slug || 'take'}.wav`);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-xl font-semibold text-slate-900">Saved Takes</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Stored locally in your browser. Select two or more takes to stitch them into one continuous master WAV.
          </p>
        </div>

        {/* Stitcher Toolbar */}
        <div className="flex flex-wrap items-center gap-2.5">
          <label className="flex items-center gap-1.5 text-xs text-slate-600">
            <span>Gap</span>
            <select
              aria-label="Silence gap between stitched takes"
              value={gapSeconds}
              onChange={(e) => setGapSeconds(Number(e.target.value))}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-mono text-xs tabular-nums text-slate-900 focus:border-[#1D4ED8] focus:outline-none"
            >
              <option value={0}>0.0s</option>
              <option value={0.3}>0.3s</option>
              <option value={0.5}>0.5s</option>
              <option value={1.0}>1.0s</option>
              <option value={1.5}>1.5s</option>
            </select>
          </label>

          <button
            type="button"
            onClick={handleRunStitch}
            disabled={selectedIds.length < 2}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium bg-[#1D4ED8] text-white hover:bg-[#1E40AF] disabled:bg-slate-200 disabled:text-slate-500 disabled:cursor-not-allowed transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D4ED8]"
          >
            <Layers className="h-3.5 w-3.5" aria-hidden="true" />
            <span>
              Stitch Selected{selectedIds.length > 0 ? ` (${selectedIds.length})` : ''}
            </span>
          </button>
        </div>
      </div>

      {stitchFeedback && (
        <p className="text-xs font-medium text-[#16A34A]" role="status">
          {stitchFeedback}
        </p>
      )}

      {/* Search & Filter Row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search
            className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          />
          <label htmlFor="takes-search-input" className="sr-only">
            Search saved takes
          </label>
          <input
            id="takes-search-input"
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by title, script, or voice..."
            className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#1D4ED8] focus:outline-none"
          />
        </div>

        <div
          className="flex flex-wrap items-center gap-1 p-1 bg-slate-200/70 rounded-lg"
          role="group"
          aria-label="Filter saved takes"
        >
          {(
            [
              ['all', 'All'],
              ['single', 'Single'],
              ['dialogue', 'Dialogue'],
              ['stitched', 'Stitched'],
              ['favorites', 'Favorites'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setFilterMode(id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D4ED8] ${
                filterMode === id
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Takes Table / List */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {filteredTakes.length === 0 ? (
          <div className="p-10 text-center space-y-3">
            <p className="text-sm font-medium text-slate-900">
              {takes.length === 0 ? 'No saved takes yet' : 'No takes match your filter'}
            </p>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {takes.length === 0
                ? 'Generate your first narration or dialogue in Studio and it will be saved here automatically.'
                : 'Clear your search query or switch the filter tab to view all takes.'}
            </p>
            {takes.length === 0 ? (
              <button
                type="button"
                onClick={onNewScript}
                className="inline-flex items-center px-4 py-2 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors"
              >
                Open Studio
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setFilterMode('all');
                }}
                className="inline-flex items-center px-3.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
              >
                Reset Filters
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredTakes.map((take) => {
              const isSelectedForStitch = selectedIds.includes(take.id);
              const isActive = activeTake?.id === take.id;

              return (
                <div
                  key={take.id}
                  className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3.5 transition-colors ${
                    isActive ? 'bg-[#1D4ED8]/[0.05]' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() => toggleSelectForStitch(take.id)}
                      aria-pressed={isSelectedForStitch}
                      aria-label={`Select "${take.title}" for stitching`}
                      className="mt-0.5 sm:mt-0 text-slate-400 hover:text-[#1D4ED8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D4ED8] rounded"
                    >
                      {isSelectedForStitch ? (
                        <CheckSquare className="h-4 w-4 text-[#1D4ED8]" aria-hidden="true" />
                      ) : (
                        <Square className="h-4 w-4" aria-hidden="true" />
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => onSelectTake(take)}
                      aria-label={`Load "${take.title}" into audio monitor`}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 hover:border-[#1D4ED8] hover:text-[#1D4ED8] shrink-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D4ED8]"
                    >
                      <Play className="h-3.5 w-3.5 ml-0.5" aria-hidden="true" />
                    </button>

                    <div className="min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={() => onSelectTake(take)}
                        className="text-left block w-full focus-visible:outline-none focus-visible:underline"
                      >
                        <span className="text-sm font-semibold text-slate-900 truncate block">
                          {take.title}
                        </span>
                      </button>
                      <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 mt-0.5">
                        <span>{MODE_LABELS[take.mode]}</span>
                        <span aria-hidden="true">·</span>
                        <span>{take.voiceSummary}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums text-slate-700">
                          {formatTimecode(take.durationSec)}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>
                          {new Date(take.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 pl-10 sm:pl-0">
                    <button
                      type="button"
                      onClick={() => onToggleFavorite(take.id)}
                      aria-pressed={take.favorite}
                      aria-label={
                        take.favorite
                          ? `Remove "${take.title}" from favorites`
                          : `Favorite "${take.title}"`
                      }
                      className={`inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D4ED8] ${
                        take.favorite
                          ? 'text-[#D97706] hover:bg-amber-50'
                          : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700'
                      }`}
                    >
                      <Star
                        className={`h-4 w-4 ${take.favorite ? 'fill-current' : ''}`}
                        aria-hidden="true"
                      />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDirectDownload(take)}
                      aria-label={`Download WAV for "${take.title}"`}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D4ED8]"
                    >
                      <Download className="h-4 w-4" aria-hidden="true" />
                    </button>

                    <button
                      type="button"
                      onClick={() => onDeleteTake(take.id)}
                      aria-label={`Delete "${take.title}"`}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-red-50 hover:text-[#DC2626] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D4ED8]"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <WaveformDeck take={activeTake} />
    </div>
  );
}
