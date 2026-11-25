import test from 'node:test';
import assert from 'node:assert/strict';
import {
  analyzeScript,
  buildSrtFromScript,
  formatSrtTimestamp,
  formatTimecode,
  insertCueAtCursor,
  validateDialogueTtsPayload,
  validateSingleTtsPayload,
} from './scriptLogic';
import {
  base64ToUint8Array,
  encodeMonoFloat32ToWav,
  extractWaveformPeaksFromWav,
  parseWavHeader,
  stitchWavBuffers,
  synthesizeStudioReferenceWav,
  uint8ArrayToBase64,
} from './audioLogic';

test('analyzeScript computes word count, cues, and spoken duration', () => {
  const empty = analyzeScript('   ');
  assert.equal(empty.words, 0);
  assert.equal(empty.estimatedSeconds, 0);

  const sample = analyzeScript(
    'Welcome back to the studio. <breath> Today we explore sound design... and pacing.',
    150,
  );
  assert.equal(sample.words, 12);
  assert.equal(sample.cueCount, 2);
  assert.ok(sample.estimatedSeconds > 5 && sample.estimatedSeconds < 7);
});

test('formatTimecode and formatSrtTimestamp format cleanly and guard bad inputs', () => {
  assert.equal(formatTimecode(0), '00:00.0');
  assert.equal(formatTimecode(-5), '00:00.0');
  assert.equal(formatTimecode(65.44), '01:05.4');
  assert.equal(formatSrtTimestamp(3661.25), '01:01:01,250');
});

test('buildSrtFromScript produces sequential timestamped SRT cues covering total duration', () => {
  const srt = buildSrtFromScript(
    'First line of narration. <breath> Second line has more words here!',
    10,
  );
  assert.match(srt, /^1\n00:00:00,000 --> /);
  assert.match(srt, /--> 00:00:10,000\nSecond line has more words here!/);
  assert.ok(!srt.includes('<breath>'));
});

test('insertCueAtCursor inserts spaces cleanly without double whitespace', () => {
  const res = insertCueAtCursor('Hello world', '<breath>', 5, 5);
  assert.equal(res.nextText, 'Hello <breath> world');
  assert.equal(res.nextCursor, 'Hello <breath>'.length);
});

test('validateSingleTtsPayload rejects empty text and invalid voices', () => {
  assert.equal(validateSingleTtsPayload({ text: '   ', voiceName: 'Kore' }).valid, false);
  assert.equal(
    validateSingleTtsPayload({ text: 'Hello', voiceName: 'Unknown' as never }).valid,
    false,
  );
  assert.equal(
    validateSingleTtsPayload({ text: 'Hello studio', voiceName: 'Fenrir', engine: 'expressive' })
      .valid,
    true,
  );
});

test('validateDialogueTtsPayload enforces two distinct speakers and non-empty turns', () => {
  assert.equal(
    validateDialogueTtsPayload({
      speakerA: { name: 'Alex', voiceName: 'Kore', style: 'Warm' },
      speakerB: { name: 'alex', voiceName: 'Puck', style: 'Bright' },
      turns: [{ speakerSlot: 'A', text: 'Hi' }],
    }).valid,
    false,
  );
  assert.equal(
    validateDialogueTtsPayload({
      speakerA: { name: 'Alex', voiceName: 'Kore', style: 'Warm' },
      speakerB: { name: 'Sam', voiceName: 'Puck', style: 'Bright' },
      turns: [{ speakerSlot: 'A', text: '   ' }],
    }).valid,
    false,
  );
  assert.equal(
    validateDialogueTtsPayload({
      speakerA: { name: 'Alex', voiceName: 'Kore', style: 'Warm' },
      speakerB: { name: 'Sam', voiceName: 'Puck', style: 'Bright' },
      turns: [
        { speakerSlot: 'A', text: 'Welcome back.' },
        { speakerSlot: 'B', text: '|yeah| Great to be here.' },
      ],
    }).valid,
    true,
  );
});

test('encodeMonoFloat32ToWav and parseWavHeader round-trip accurately', () => {
  const sampleRate = 24000;
  const samples = new Float32Array(sampleRate); // 1.0s
  for (let i = 0; i < samples.length; i++) {
    samples[i] = Math.sin((2 * Math.PI * 440 * i) / sampleRate) * 0.5;
  }
  const wav = encodeMonoFloat32ToWav(samples, sampleRate);
  const meta = parseWavHeader(wav);
  assert.equal(meta.sampleRate, 24000);
  assert.equal(meta.numChannels, 1);
  assert.equal(meta.bitsPerSample, 16);
  assert.equal(meta.durationSec, 1);
  assert.equal(meta.dataByteLength, 48000);
});

test('stitchWavBuffers combines clips with exact silence gap duration', () => {
  const clipA = synthesizeStudioReferenceWav(1.0, 220, 24000);
  const clipB = synthesizeStudioReferenceWav(1.5, 293.66, 24000);
  const stitched = stitchWavBuffers([clipA, clipB], 0.5);
  const meta = parseWavHeader(stitched);
  assert.equal(meta.sampleRate, 24000);
  assert.ok(Math.abs(meta.durationSec - 3.0) < 0.001);

  const peaks = extractWaveformPeaksFromWav(stitched, 48);
  assert.equal(peaks.length, 48);
  assert.ok(peaks.every((p) => p >= 0.06 && p <= 1));

  // Verify base64 round-trip
  const b64 = uint8ArrayToBase64(stitched);
  const roundTripped = base64ToUint8Array(b64);
  assert.equal(roundTripped.byteLength, stitched.byteLength);
});
