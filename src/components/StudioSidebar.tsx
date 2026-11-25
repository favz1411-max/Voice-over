import { AudioLines, FileAudio, Mic2, Users, X } from 'lucide-react';
import type { WorkspaceTab } from '../types/voiceover';
import { formatTimecode } from '../utils/scriptLogic';

interface StudioSidebarProps {
  activeTab: WorkspaceTab;
  onSelectTab: (tab: WorkspaceTab) => void;
  takesCount: number;
  totalDurationSec: number;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

const NAV_ITEMS: Array<{
  id: WorkspaceTab;
  label: string;
  icon: typeof Mic2;
}> = [
  { id: 'studio', label: 'Studio', icon: Mic2 },
  { id: 'dialogue', label: 'Dialogue', icon: Users },
  { id: 'voices', label: 'Voices', icon: AudioLines },
  { id: 'takes', label: 'Takes', icon: FileAudio },
];

export function StudioSidebar({
  activeTab,
  onSelectTab,
  takesCount,
  totalDurationSec,
  mobileOpen,
  onCloseMobile,
}: StudioSidebarProps) {
  const sidebarBody = (
    <div className="flex h-full flex-col bg-white border-r border-slate-200">
      <div className="flex h-14 items-center justify-between px-5 border-b border-slate-200">
        <span className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0">
          Cadence
        </span>
        <button
          type="button"
          onClick={onCloseMobile}
          aria-label="Close navigation menu"
          className="lg:hidden inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D4ED8]"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <nav aria-label="Workspace navigation" className="flex-1 px-3 py-4 space-y-1">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                onSelectTab(item.id);
                onCloseMobile();
              }}
              aria-current={active ? 'page' : undefined}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D4ED8] ${
                active
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <span className="flex items-center gap-2.5">
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{item.label}</span>
              </span>
              {item.id === 'takes' && (
                <span
                  className={`font-mono text-xs tabular-nums ${
                    active ? 'text-slate-300' : 'text-slate-400'
                  }`}
                >
                  {takesCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="px-5 py-4 border-t border-slate-200 space-y-2">
        <p className="text-xs font-medium text-slate-500">Session Library</p>
        <div className="flex items-baseline justify-between text-xs text-slate-600">
          <span>Saved Takes</span>
          <span className="font-mono font-medium text-slate-900 tabular-nums">{takesCount}</span>
        </div>
        <div className="flex items-baseline justify-between text-xs text-slate-600">
          <span>Total Runtime</span>
          <span className="font-mono font-medium text-slate-900 tabular-nums">
            {formatTimecode(totalDurationSec)}
          </span>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden lg:block w-60 shrink-0 h-screen sticky top-0">{sidebarBody}</aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden flex">
          <button
            type="button"
            aria-label="Dismiss navigation backdrop"
            onClick={onCloseMobile}
            className="fixed inset-0 bg-slate-900/35"
          />
          <div className="relative z-10 w-64 max-w-[80vw] h-full shadow-xl">{sidebarBody}</div>
        </div>
      )}
    </>
  );
}
