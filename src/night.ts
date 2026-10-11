import { db, hasClipContent, type Character, type Clip, type Game, type Lineup } from './db';
import { t } from './strings';

export type StepKind = 'opening' | 'character' | 'closing' | 'discussion';

export interface NightStep {
  kind: StepKind;
  title: string;
  text?: string;
  imageId?: string;
  count?: number;
  clips: Clip[]; // played one after another
}

/**
 * Builds the night script from a lineup:
 * opening → (character instruction + after-character clip) per waking character → closing → discussion.
 */
export function buildNightSteps(game: Game, lineup: Lineup, characters: Character[]): NightStep[] {
  const byId = new Map(characters.map((c) => [c.id, c]));
  const { opening, afterCharacter, closing } = game.generalClips;
  const steps: NightStep[] = [];

  if (hasClipContent(opening)) {
    steps.push({ kind: 'opening', title: t.clipOpening, text: opening.text, clips: [opening] });
  }
  for (const entry of lineup.entries) {
    const character = byId.get(entry.characterId);
    if (!character?.wakesAtNight) continue;
    steps.push({
      kind: 'character',
      title: character.name,
      text: character.instruction.text,
      imageId: character.imageId,
      count: entry.count,
      clips: [character.instruction, afterCharacter].filter(hasClipContent),
    });
  }
  if (hasClipContent(closing)) {
    steps.push({ kind: 'closing', title: t.clipClosing, text: closing.text, clips: [closing] });
  }
  if (game.discussionMinutes > 0) {
    steps.push({ kind: 'discussion', title: t.discussion, clips: [] });
  }
  return steps;
}

/** Waking characters with neither a recording nor text. */
export function silentCharacters(lineup: Lineup, characters: Character[]): Character[] {
  const byId = new Map(characters.map((c) => [c.id, c]));
  return lineup.entries
    .map((e) => byId.get(e.characterId))
    .filter((c): c is Character => !!c && c.wakesAtNight && !hasClipContent(c.instruction));
}

/**
 * Plays clips one after another on a single <audio> element (reusing one element keeps
 * mobile browsers from blocking autoplay after the first tap). Clips without a recording
 * are read aloud with the device's text-to-speech.
 */
export class ClipPlayer {
  private audio: HTMLAudioElement;
  private objectUrl?: string;
  private runId = 0;
  private resolveCurrent?: () => void;
  private paused = false;
  private audioActive = false; // an audio clip is loaded and not yet finished

  constructor() {
    this.audio = new Audio();
    this.audio.preload = 'auto';
  }

  /** Must be called from a user tap so later playback is allowed. */
  unlock() {
    this.audio.src = SILENT_WAV;
    this.audio.play().catch(() => {});
    if ('speechSynthesis' in window) {
      const u = new SpeechSynthesisUtterance('');
      u.volume = 0;
      speechSynthesis.speak(u);
    }
  }

  /** Plays all clips in order. Resolves when finished or when stopped. */
  async playAll(clips: Clip[]): Promise<void> {
    this.stop();
    const id = ++this.runId;
    for (const clip of clips) {
      if (id !== this.runId) return;
      await this.playOne(clip, id);
    }
  }

  private async playOne(clip: Clip, id: number): Promise<void> {
    if (clip.audioId) {
      const media = await db.media.get(clip.audioId);
      if (media && id === this.runId) {
        this.objectUrl = URL.createObjectURL(media.blob);
        this.audio.src = this.objectUrl;
        this.audioActive = true;
        await new Promise<void>((resolve) => {
          this.resolveCurrent = resolve;
          this.audio.onended = () => resolve();
          this.audio.onerror = () => resolve();
          if (!this.paused) this.audio.play().catch(() => resolve());
        });
        if (id === this.runId) {
          this.audioActive = false;
          this.releaseUrl();
        }
        return;
      }
    }
    if (clip.text?.trim() && 'speechSynthesis' in window && id === this.runId) {
      await new Promise<void>((resolve) => {
        this.resolveCurrent = resolve;
        const u = new SpeechSynthesisUtterance(clip.text);
        u.lang = 'he-IL';
        const voice = speechSynthesis.getVoices().find((v) => v.lang.startsWith('he'));
        if (voice) u.voice = voice;
        // Some devices never fire onend (e.g. no voice installed), so don't wait forever.
        const timeout = setTimeout(resolve, 3000 + clip.text!.length * 200);
        u.onend = u.onerror = () => {
          clearTimeout(timeout);
          resolve();
        };
        speechSynthesis.speak(u);
        if (this.paused) speechSynthesis.pause();
      });
    }
  }

  pause() {
    this.paused = true;
    this.audio.pause();
    if ('speechSynthesis' in window) speechSynthesis.pause();
  }

  resume() {
    this.paused = false;
    if (this.audioActive) this.audio.play().catch(() => {});
    if ('speechSynthesis' in window) speechSynthesis.resume();
  }

  stop() {
    this.runId++;
    this.audio.pause();
    this.audio.onended = null;
    this.audio.onerror = null;
    if ('speechSynthesis' in window) speechSynthesis.cancel();
    this.resolveCurrent?.();
    this.resolveCurrent = undefined;
    this.audioActive = false;
    this.releaseUrl();
  }

  private releaseUrl() {
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
    this.objectUrl = undefined;
  }
}

/** A short beep, used when the discussion timer ends. */
export function beep() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 1.2);
    osc.onended = () => ctx.close();
  } catch {
    // Audio not available; the screen still shows the timer ended.
  }
}

// 0.1s of silence, used to unlock audio playback on mobile browsers.
const SILENT_WAV = (() => {
  const samples = 800;
  const buf = new ArrayBuffer(44 + samples);
  const v = new DataView(buf);
  const str = (o: number, s: string) => [...s].forEach((ch, i) => v.setUint8(o + i, ch.charCodeAt(0)));
  str(0, 'RIFF');
  v.setUint32(4, 36 + samples, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, 8000, true);
  v.setUint32(28, 8000, true);
  v.setUint16(32, 1, true);
  v.setUint16(34, 8, true);
  str(36, 'data');
  v.setUint32(40, samples, true);
  for (let i = 0; i < samples; i++) v.setUint8(44 + i, 128);
  let bin = '';
  new Uint8Array(buf).forEach((b) => (bin += String.fromCharCode(b)));
  return `data:audio/wav;base64,${btoa(bin)}`;
})();
