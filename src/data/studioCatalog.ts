import type {
  DeliveryPreset,
  DialogueTemplate,
  MasteringPresetId,
  ScriptTemplate,
  VoiceProfile,
} from '../types/voiceover';

export const STUDIO_VOICES: VoiceProfile[] = [
  {
    id: 'Kore',
    name: 'Kore',
    register: 'Alto',
    tone: 'Clear & Composed',
    bestFor: 'Product explainers, newsroom reads, calm narration',
    description:
      'Balanced studio clarity with crisp diction and natural cadence across technical or editorial scripts.',
    sampleLine:
      'Welcome to Cadence Studio. Every take is rendered at twenty-four kilohertz for broadcast-ready clarity.',
    defaultStyle: 'Clear, composed, modern studio narrator',
    accentColor: '#1D4ED8',
  },
  {
    id: 'Puck',
    name: 'Puck',
    register: 'Tenor',
    tone: 'Bright & Agile',
    bestFor: 'Commercial spots, upbeat podcast hosts, trailers',
    description:
      'Energetic delivery with brisk timing, warm inflections, and nimble comedic or commercial pacing.',
    sampleLine:
      'Stop spending hours hunting for the right read. Write your script, set the tone, and roll tape in seconds.',
    defaultStyle: 'Upbeat, conversational, confident commercial host',
    accentColor: '#0F766E',
  },
  {
    id: 'Charon',
    name: 'Charon',
    register: 'Baritone',
    tone: 'Measured & Grounded',
    bestFor: 'Documentaries, brand anthems, authoritative narration',
    description:
      'Deep chest resonance and deliberate pacing suited to long-form documentaries and serious storytelling.',
    sampleLine:
      'Beneath the surface of the North Atlantic, sound travels four times faster than it ever could through open air.',
    defaultStyle: 'Grounded, measured documentary narrator with calm authority',
    accentColor: '#334155',
  },
  {
    id: 'Fenrir',
    name: 'Fenrir',
    register: 'Bass-Baritone',
    tone: 'Bold & Cinematic',
    bestFor: 'Film trailers, dramatic fiction, high-impact launches',
    description:
      'Commanding projection with dramatic weight and strong consonant attack for trailers and bold openings.',
    sampleLine:
      'When the power grid went silent at midnight, only one relay station on the ridge stayed online.',
    defaultStyle: 'Bold, cinematic trailer narrator with controlled intensity',
    accentColor: '#9A3412',
  },
  {
    id: 'Zephyr',
    name: 'Zephyr',
    register: 'Mezzo-Soprano',
    tone: 'Warm & Intimate',
    bestFor: 'Audiobooks, guided wellness, intimate storytelling',
    description:
      'Soft close-mic warmth and gentle phrasing that holds listener attention across quiet, reflective reads.',
    sampleLine:
      'Rain tapped lightly against the conservatory glass as the kettle began to hum in the next room.',
    defaultStyle: 'Warm, intimate close-mic audiobook storyteller',
    accentColor: '#6D28D9',
  },
];

export const DELIVERY_PRESETS: DeliveryPreset[] = [
  {
    id: 'neutral',
    label: 'Studio Neutral',
    direction: 'Clear, well-paced studio announcer with clean articulation',
    wpm: 150,
  },
  {
    id: 'documentary',
    label: 'Documentary',
    direction: 'Calm, thoughtful documentary narrator with deliberate pauses and subtle gravitas',
    wpm: 132,
  },
  {
    id: 'commercial',
    label: 'Commercial',
    direction: 'Energetic, persuasive commercial voiceover with warm smile and crisp punch',
    wpm: 162,
  },
  {
    id: 'conversational',
    label: 'Podcast Host',
    direction: 'Natural, relaxed, friendly conversational host speaking directly to one listener',
    wpm: 156,
  },
  {
    id: 'audiobook',
    label: 'Storyteller',
    direction: 'Expressive, intimate audiobook narrator with gentle emotional shading',
    wpm: 138,
  },
  {
    id: 'dramatic',
    label: 'Trailer',
    direction: 'Low, suspenseful, cinematic voiceover with impactful pauses between phrases',
    wpm: 118,
  },
];

export const VOCAL_CUES = [
  { token: '<breath>', label: 'Breath', hint: 'Natural inhale before a phrase (Expressive engine)' },
  { token: '<laugh>', label: 'Laugh', hint: 'Brief scripted laugh (Expressive engine)' },
  { token: '<gasp>', label: 'Gasp', hint: 'Quick surprised intake (Expressive engine)' },
  { token: '...', label: 'Beat Pause', hint: 'Short rhythmic pause in narration' },
] as const;

export const DIALOGUE_CUES = [
  { token: '<breath>', label: 'Breath' },
  { token: '<laugh>', label: 'Laugh' },
  { token: '<gasp>', label: 'Gasp' },
  { token: '|mhm|', label: 'Backchannel |mhm|' },
  { token: '|yeah|', label: 'Backchannel |yeah|' },
] as const;

export const SCRIPT_TEMPLATES: ScriptTemplate[] = [
  {
    id: 'commercial-30',
    title: 'Product Launch (30s)',
    category: 'Commercial',
    recommendedVoice: 'Puck',
    recommendedStyle: 'Energetic, modern commercial voiceover with crisp timing and warm confidence',
    script:
      'Most morning routines start with noise. Alarms, notifications, and half-brewed coffee. Meet Solis One — the precision espresso machine engineered to heat in twelve seconds flat, with whisper-quiet extraction and café-grade microfoam at the press of a single dial. Less clutter on your counter. More calm in your cup. Solis One. Brewed for quiet mornings.',
  },
  {
    id: 'doc-ocean',
    title: 'Documentary Opening',
    category: 'Documentary',
    recommendedVoice: 'Charon',
    recommendedStyle: 'Measured, authoritative documentary narrator with unhurried pacing',
    script:
      'Three thousand meters below the sunlit canopy of the Pacific, the ocean keeps its own calendar. Here, volcanic vents warm the freezing dark... and ecosystems thrive without ever seeing a single ray of sunlight. For decades, marine biologists believed nothing complex could survive this pressure. They were wrong.',
  },
  {
    id: 'explainer-app',
    title: 'Software Walkthrough',
    category: 'Explainer',
    recommendedVoice: 'Kore',
    recommendedStyle: 'Clear, helpful, polished product specialist with approachable cadence',
    script:
      'Importing your team roadmap takes less than a minute. Start by selecting your active milestone in the sidebar, then drag any sprint block onto the timeline to forecast delivery dates automatically. Whenever priorities shift, every dependent task adjusts in real time so nobody works from an outdated plan.',
  },
  {
    id: 'audiobook-ch1',
    title: 'Audiobook Chapter 1',
    category: 'Audiobook',
    recommendedVoice: 'Zephyr',
    recommendedStyle: 'Warm, intimate literary audiobook narrator with gentle rhythmic phrasing',
    script:
      'The lighthouse keeper kept two ledgers on his desk. The blue one recorded tide heights, barometer drops, and passing freighters. The red one — bound in salt-stiffened linen — recorded every promise the harbor made and forgot by morning. <breath> On the night the foghorn finally failed, he opened the red ledger to a blank page.',
  },
];

export const DIALOGUE_TEMPLATES: DialogueTemplate[] = [
  {
    id: 'podcast-cold-open',
    title: 'Tech Podcast Cold Open',
    category: 'Podcast',
    speakerA: {
      name: 'Maya',
      voiceName: 'Kore',
      style: 'Warm, sharp podcast host with lively conversational rhythm',
    },
    speakerB: {
      name: 'Devon',
      voiceName: 'Puck',
      style: 'Curious, enthusiastic co-host with quick comedic timing',
    },
    turns: [
      {
        speakerSlot: 'A',
        text: 'Welcome back to Signal Path. <breath> Today we are testing whether acoustic design actually changes how long listeners stay with a show.',
      },
      {
        speakerSlot: 'B',
        text: 'Oh, |yeah| completely. Most people think it is just about buying an expensive microphone, <laugh> and then they record inside a tiled kitchen.',
      },
      {
        speakerSlot: 'A',
        text: 'Exactly. Room tone and pacing do eighty percent of the work before you ever touch an equalizer.',
      },
      {
        speakerSlot: 'B',
        text: '|mhm| And once you hear a clean, well-paced dialogue track side by side with a rushed one, you cannot unhear the difference.',
      },
    ],
  },
  {
    id: 'audio-drama',
    title: 'Observatory Dispatch',
    category: 'Audio Drama',
    speakerA: {
      name: 'Elena',
      voiceName: 'Zephyr',
      style: 'Focused, slightly tense lead astronomer speaking in a hushed control room',
    },
    speakerB: {
      name: 'Marcus',
      voiceName: 'Charon',
      style: 'Calm, steady senior engineer keeping his composure',
    },
    turns: [
      {
        speakerSlot: 'A',
        text: 'Marcus, look at array four. <gasp> That repeating pulse is not terrestrial interference.',
      },
      {
        speakerSlot: 'B',
        text: 'Hold on, let me isolate the narrowband filter. |mhm| The interval is holding steady at four point two seconds.',
      },
      {
        speakerSlot: 'A',
        text: 'We have tracked this sector for six winters and never logged a drift like that. <breath> Start the full-spectrum archive now.',
      },
      {
        speakerSlot: 'B',
        text: 'Recording is live. Whatever is out past the outer ridge, we just caught it on tape.',
      },
    ],
  },
];

export const MASTERING_PRESETS: Array<{
  id: MasteringPresetId;
  label: string;
  summary: string;
}> = [
  {
    id: 'clean',
    label: 'Raw',
    summary: 'Uncolored 24 kHz studio output',
  },
  {
    id: 'broadcast',
    label: 'Broadcast',
    summary: 'Low-mid chest warmth + gentle limiting',
  },
  {
    id: 'podcast',
    label: 'Podcast',
    summary: 'High-pass rumble cut + 3.5 kHz presence',
  },
  {
    id: 'intimate',
    label: 'Close-Mic',
    summary: 'Smooth top roll-off + warm compression',
  },
];
