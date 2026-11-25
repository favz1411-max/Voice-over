export type VoiceName = 'Kore' | 'Puck' | 'Charon' | 'Fenrir' | 'Zephyr';

export type TtsEngine = 'standard' | 'expressive';

export type WorkspaceTab = 'studio' | 'dialogue' | 'voices' | 'takes';

export type MasteringPresetId = 'clean' | 'broadcast' | 'podcast' | 'intimate';

export interface VoiceProfile {
  id: VoiceName;
  name: string;
  register: string;
  tone: string;
  bestFor: string;
  description: string;
  sampleLine: string;
  defaultStyle: string;
  accentColor: string;
}

export interface DeliveryPreset {
  id: string;
  label: string;
  direction: string;
  wpm: number;
}

export interface ScriptTemplate {
  id: string;
  title: string;
  category: string;
  recommendedVoice: VoiceName;
  recommendedStyle: string;
  script: string;
}

export interface DialogueTurn {
  id: string;
  speakerSlot: 'A' | 'B';
  text: string;
}

export interface DialogueSpeakerConfig {
  name: string;
  voiceName: VoiceName;
  style: string;
}

export interface DialogueTemplate {
  id: string;
  title: string;
  category: string;
  speakerA: DialogueSpeakerConfig;
  speakerB: DialogueSpeakerConfig;
  turns: Array<{ speakerSlot: 'A' | 'B'; text: string }>;
}

export interface MasteringSettings {
  preset: MasteringPresetId;
  playbackRate: number;
  volume: number;
  trimStartSec: number;
  trimEndSec: number;
  loop: boolean;
}

export interface VoiceoverTake {
  id: string;
  title: string;
  mode: 'single' | 'dialogue' | 'stitched' | 'sample';
  script: string;
  voiceSummary: string;
  styleSummary: string;
  engineLabel: string;
  durationSec: number;
  sampleRate: number;
  createdAt: number;
  favorite: boolean;
  audioBase64: string;
  peaks: number[];
}

export interface SingleTtsPayload {
  text: string;
  voiceName: VoiceName;
  style: string;
  engine: TtsEngine;
}

export interface DialogueTtsPayload {
  speakerA: DialogueSpeakerConfig;
  speakerB: DialogueSpeakerConfig;
  turns: Array<{ speakerSlot: 'A' | 'B'; text: string }>;
}
