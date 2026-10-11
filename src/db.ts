import Dexie, { type EntityTable } from 'dexie';

/** A piece of narration: a recording, and/or text shown on screen (and read aloud as a fallback). */
export interface Clip {
  audioId?: string;
  text?: string;
}

export interface Game {
  id: string;
  name: string;
  rulesNotes: string;
  createdAt: number;
  updatedAt: number;
  pauseBetweenSteps: number; // seconds
  autoAdvance: boolean;
  discussionMinutes: number; // 0 = no discussion timer
  generalClips: {
    opening: Clip;
    afterCharacter: Clip;
    closing: Clip;
  };
}

export interface Character {
  id: string;
  gameId: string;
  name: string;
  description: string;
  imageId?: string;
  wakesAtNight: boolean;
  instruction: Clip;
  createdAt: number;
}

export interface LineupEntry {
  characterId: string;
  count: number;
}

export interface Lineup {
  id: string;
  gameId: string;
  name: string;
  playerCount: number;
  entries: LineupEntry[]; // array order = night order
  createdAt: number;
}

export interface MediaBlob {
  id: string;
  blob: Blob;
  mimeType: string;
}

export const db = new Dexie('one-night-app') as Dexie & {
  games: EntityTable<Game, 'id'>;
  characters: EntityTable<Character, 'id'>;
  lineups: EntityTable<Lineup, 'id'>;
  media: EntityTable<MediaBlob, 'id'>;
};

db.version(1).stores({
  games: 'id, createdAt',
  characters: 'id, gameId',
  lineups: 'id, gameId',
  media: 'id',
});

export const newId = () => crypto.randomUUID();

export function emptyClip(): Clip {
  return {};
}

export function hasClipContent(clip: Clip | undefined): boolean {
  return !!clip && (!!clip.audioId || !!clip.text?.trim());
}

export async function createGame(name: string): Promise<string> {
  const now = Date.now();
  const game: Game = {
    id: newId(),
    name,
    rulesNotes: '',
    createdAt: now,
    updatedAt: now,
    pauseBetweenSteps: 5,
    autoAdvance: true,
    discussionMinutes: 5,
    generalClips: { opening: {}, afterCharacter: {}, closing: {} },
  };
  await db.games.add(game);
  return game.id;
}

export async function updateGame(id: string, changes: Partial<Game>) {
  await db.games.update(id, { ...changes, updatedAt: Date.now() });
}

export async function saveMedia(blob: Blob): Promise<string> {
  const id = newId();
  await db.media.add({ id, blob, mimeType: blob.type });
  return id;
}

export async function deleteGame(gameId: string) {
  await db.transaction('rw', db.games, db.characters, db.lineups, async () => {
    await db.characters.where('gameId').equals(gameId).delete();
    await db.lineups.where('gameId').equals(gameId).delete();
    await db.games.delete(gameId);
  });
  await collectUnusedMedia();
}

/** Deletes a character and removes it from every lineup that uses it. */
export async function deleteCharacter(characterId: string) {
  await db.transaction('rw', db.characters, db.lineups, async () => {
    const character = await db.characters.get(characterId);
    if (!character) return;
    const lineups = await db.lineups.where('gameId').equals(character.gameId).toArray();
    for (const lineup of lineups) {
      if (lineup.entries.some((e) => e.characterId === characterId)) {
        await db.lineups.update(lineup.id, {
          entries: lineup.entries.filter((e) => e.characterId !== characterId),
        });
      }
    }
    await db.characters.delete(characterId);
  });
  await collectUnusedMedia();
}

export async function lineupsUsingCharacter(characterId: string): Promise<Lineup[]> {
  const character = await db.characters.get(characterId);
  if (!character) return [];
  const lineups = await db.lineups.where('gameId').equals(character.gameId).toArray();
  return lineups.filter((l) => l.entries.some((e) => e.characterId === characterId));
}

/** Copies a game with all its characters, lineups and media. */
export async function duplicateGame(gameId: string, name: string): Promise<string> {
  return db.transaction('rw', db.games, db.characters, db.lineups, db.media, async () => {
    const game = await db.games.get(gameId);
    if (!game) throw new Error('Game not found');

    const mediaMap = new Map<string, string>();
    const copyMedia = async (id?: string) => {
      if (!id) return undefined;
      if (!mediaMap.has(id)) {
        const media = await db.media.get(id);
        if (!media) return undefined;
        const copyId = newId();
        await db.media.add({ ...media, id: copyId });
        mediaMap.set(id, copyId);
      }
      return mediaMap.get(id);
    };
    const copyClip = async (clip: Clip): Promise<Clip> => ({
      ...clip,
      audioId: await copyMedia(clip.audioId),
    });

    const now = Date.now();
    const newGameId = newId();
    await db.games.add({
      ...game,
      id: newGameId,
      name,
      createdAt: now,
      updatedAt: now,
      generalClips: {
        opening: await copyClip(game.generalClips.opening),
        afterCharacter: await copyClip(game.generalClips.afterCharacter),
        closing: await copyClip(game.generalClips.closing),
      },
    });

    const charMap = new Map<string, string>();
    for (const c of await db.characters.where('gameId').equals(gameId).toArray()) {
      const copyId = newId();
      charMap.set(c.id, copyId);
      await db.characters.add({
        ...c,
        id: copyId,
        gameId: newGameId,
        imageId: await copyMedia(c.imageId),
        instruction: await copyClip(c.instruction),
      });
    }

    for (const l of await db.lineups.where('gameId').equals(gameId).toArray()) {
      await db.lineups.add({
        ...l,
        id: newId(),
        gameId: newGameId,
        entries: l.entries
          .filter((e) => charMap.has(e.characterId))
          .map((e) => ({ ...e, characterId: charMap.get(e.characterId)! })),
      });
    }
    return newGameId;
  });
}

/**
 * Removes media blobs no longer referenced by any game or character.
 * Editors never delete media directly (so cancelling an edit is always safe);
 * this cleans up replaced recordings and images instead.
 */
export async function collectUnusedMedia() {
  await db.transaction('rw', db.games, db.characters, db.media, async () => {
    const used = new Set<string>();
    const addClip = (clip?: Clip) => clip?.audioId && used.add(clip.audioId);
    for (const g of await db.games.toArray()) {
      addClip(g.generalClips.opening);
      addClip(g.generalClips.afterCharacter);
      addClip(g.generalClips.closing);
    }
    for (const c of await db.characters.toArray()) {
      addClip(c.instruction);
      if (c.imageId) used.add(c.imageId);
    }
    const unused = (await db.media.toCollection().primaryKeys()).filter((id) => !used.has(id));
    await db.media.bulkDelete(unused);
  });
}

export async function createLineup(gameId: string, name: string): Promise<string> {
  const id = newId();
  await db.lineups.add({ id, gameId, name, playerCount: 5, entries: [], createdAt: Date.now() });
  return id;
}

export async function duplicateLineup(lineupId: string, name: string): Promise<string> {
  const lineup = await db.lineups.get(lineupId);
  if (!lineup) throw new Error('Lineup not found');
  const id = newId();
  await db.lineups.add({ ...lineup, id, name, createdAt: Date.now() });
  return id;
}
