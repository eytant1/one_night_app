# One Night App: Design

## 1. Goal

This is a narrator app for **One Night**-style games such as One Night Ultimate Werewolf. It is Hebrew-first and fully customizable.
The existing app's Hebrew version is weak, so this app makes no assumptions about the rules. **The user defines everything:** the characters, their wording, their recordings and the order they wake up.

- **"Open":** nothing is pre-loaded or hard-coded. Every game starts blank.
- **Single device:** one phone acts as the narrator and sits in the middle of the table.
- **Fully offline:** no accounts, no server, and all data stays on the phone.

---

## 2. Core concepts

| Concept | What it is |
|---|---|
| **Game** | A workspace the user creates, such as "Friday group" or "Family version". Everything below lives inside a game. |
| **Game details** | Game-wide settings: name, rules notes, timing, and the **general clips** shared by all characters (opening, close-eyes, closing). |
| **Character** | A card the user creates from blank. It has a name, description, image and a **recorded instruction**. All characters together form the game's **Pool**. |
| **Lineup** | A saved, named selection of characters from the pool, with counts and a **night order**, for example "5 players" or "8 players - chaos". A game can have several. |
| **Night** | Playback mode for one lineup. It plays the general clips and the character clips in order. |

```
Game details (general clips, timing)
        │
Blank card ──fill in──► Pool (characters)
                          │
                          ├──► Lineup "5 players"  ──► Night ▶
                          ├──► Lineup "8 players"  ──► Night ▶
                          └──► Lineup "Chaos"      ──► Night ▶
```

---

## 3. Main user flow

1. **Create a game.** Give it a name. It starts empty.
2. **Set the game details.** Record the general clips (see §6), such as "Everyone close your eyes", and set the pause length.
3. **Create characters.** Tap **+ New character** and fill in the name, description and image. Record the instruction with the microphone and choose whether the character wakes at night. Save it, and it joins the Pool.
4. **Create a lineup.** Give it a name and the number of players, choose characters from the pool and set a count for each (for example 2 × Werewolf). Then drag the waking characters into night order. You can save as many lineups as you want.
5. **Start the night** from a lineup. The app plays:
   `Opening` → `Character 1` → `After-character clip` → *pause* → `Character 2` → … → `Closing` → optional discussion timer.

---

## 4. Screens

The UI is Hebrew, right-to-left (RTL), and designed for phones first. The wireframes below use English labels for readability.

### 4.1 Games list (home)
```
┌─────────────────────────────┐
│  My games              [+]  │
├─────────────────────────────┤
│  🐺 Friday group            │
│     12 characters · 3 lineups │
│  🐺 Family version          │
│     5 characters · 1 lineup   │
└─────────────────────────────┘
```
Actions: create, rename, duplicate, delete.

### 4.2 Game screen (3 tabs)
```
┌───────────────────────────────────┐
│ ← Friday group                ⋮   │
│ [ Details ] [ Characters ] [ Lineups ] │
├───────────────────────────────────┤
│  (tab content)                    │
└───────────────────────────────────┘
```

#### Details tab
```
│ Name:        [ Friday group  ]      │
│ Rules notes: [ free text...  ]      │
│                                     │
│ ── General clips ─────────────────  │
│ Opening        🔊 ▶  [● Re-record]  │
│   "Everyone close your eyes"        │
│ After each character  ⚠️ [● Record] │
│   "...close your eyes"              │
│ Closing        🔊 ▶  [● Re-record]  │
│   "Everyone wake up"                │
│                                     │
│ ── Timing ────────────────────────  │
│ Pause between characters: [ 5 ] s   │
│ Auto-advance:             [✓]       │
│ Discussion timer:         [ 5 ] min │
```

#### Characters tab (the Pool)
```
│                  [ + New character ] │
│  🖼 Werewolf        🔊  🌙           │
│  🖼 Seer            🔊  🌙           │
│  🖼 Troublemaker    ⚠️  🌙           │
│  🖼 Villager            —            │
```
- 🔊 means the character has a recording, and ⚠️ means it wakes at night but has no recording.
- 🌙 means it wakes at night.
- Tapping a row opens the editor. A long press can duplicate or delete the character.

#### Lineups tab
```
│                     [ + New lineup ] │
│  5 players          8 cards   [ ▶ ]  │
│  8 players         11 cards   [ ▶ ]  │
│  Chaos             10 cards   [ ▶ ]  │
```

### 4.3 Character editor
```
┌─────────────────────────────┐
│ ← New character     [Save]  │
├─────────────────────────────┤
│ Name:        [            ] │
│ Description: [            ] │
│ Image:       [ choose ]     │
│ Wakes at night: [✓]         │
│                             │
│ Night instruction           │
│   [ ● Record ]  00:12       │
│   [ ▶ Play ] [ 🗑 ] [ ⤒ Upload file ] │
│ Instruction text (optional) │
│   [ "Seer, wake up..." ]    │
└─────────────────────────────┘
```
- Audio can be recorded with the microphone or uploaded from a file.
- The instruction text is shown on screen during the night, and it is used as text-to-speech fallback when there is no recording.

### 4.4 Lineup editor
```
┌─────────────────────────────┐
│ ← 5 players         [Save]  │
├─────────────────────────────┤
│ Name:    [ 5 players ]      │
│ Players: [ 5 ]   Cards: 8   │
│                             │
│ ── Night order ───────────  │
│ ≡ 1. Werewolf    [−] 2 [+]  │
│ ≡ 2. Seer        [−] 1 [+]  │
│ ≡ 3. Robber      [−] 1 [+]  │
│ ≡ 4. Troublemaker[−] 1 [+]  │
│ ── Doesn't wake ──────────  │
│      Villager    [−] 3 [+]  │
│                             │
│ [ + Add from characters ]   │
└─────────────────────────────┘
```
- `≡` is a drag handle for reordering.
- The app shows the player and card counts but **does not enforce any rule**. The user decides what is valid.
- A lineup can be duplicated, so a variation is easy to make.

### 4.5 Night playback
```
┌─────────────────────────────┐
│          Step 3 / 6         │
│                             │
│          [ image ]          │
│           ROBBER            │
│  "Robber, wake up. You may  │
│   swap your card with..."   │
│                             │
│   ▓▓▓▓▓▓▓░░░░  next in 8s   │
│                             │
│   [⏮]   [⏸]   [⏭]          │
└─────────────────────────────┘
```
- A dark screen with large text, so the narrator can follow along.
- The screen is kept awake during playback (Wake Lock API).
- Each step can either advance automatically after the pause or wait for a tap. This follows the game's Auto-advance setting.
- Before the night starts, the app warns about any waking character that has neither a recording nor instruction text.

---

## 5. Data model

```ts
Game {
  id, name, rulesNotes, createdAt, updatedAt
  pauseBetweenSteps: number       // seconds, default 5
  autoAdvance: boolean
  discussionMinutes?: number
  generalClips: {
    opening?:        Clip          // "Everyone close your eyes"
    afterCharacter?: Clip          // played after every character's clip
    closing?:        Clip          // "Everyone wake up"
  }
}

Clip { audioId?: string, text?: string }   // recording and/or text (TTS fallback)

Character {                        // the Pool
  id, gameId
  name, description
  imageId?: string
  wakesAtNight: boolean
  instruction: Clip
}

Lineup {
  id, gameId, name
  playerCount: number
  entries: LineupEntry[]           // array order = night order
}

LineupEntry {
  characterId
  count: number                    // e.g. 2 werewolves → still one wake-up step
}

MediaBlob { id, blob, mimeType, durationMs? }   // audio + images
```

Deleting a character that is used in a lineup asks for confirmation, then removes the character from those lineups as well.

---

## 6. Audio and night playback

- **Recording:** `MediaRecorder` plus `getUserMedia({audio:true})`. The app asks for microphone permission the first time.
- **Storage:** audio is saved as a Blob in IndexedDB on the phone.
- **Playback:** a single `<audio>` element plays the clips one after another. The playlist is built from the lineup:
  ```
  opening
  for each waking entry in lineup order:
      entry.character.instruction
      afterCharacter            (if defined)
      pause(pauseBetweenSteps)
  closing
  discussion timer             (if set)
  ```
- **Sleep clip:** the game-level `afterCharacter` clip handles "close your eyes" once for all characters. If one character needs special wording, the user can include it in that character's own recording and leave the general clip empty.
- **Fallback:** a clip with no recording is read aloud from its text using `speechSynthesis` (`he-IL`). Offline TTS depends on the phone having a Hebrew voice installed, so recordings remain the reliable option.

---

## 7. Technology

| Area | Choice | Why |
|---|---|---|
| App type | **PWA** (installable web app) | Works fully offline once installed. One codebase for Android and iPhone. |
| Framework | React + TypeScript + Vite | Common, fast, and many component libraries support RTL. |
| Storage | IndexedDB (via Dexie) | Stores audio and image blobs on the device. Works offline. |
| Drag & drop | dnd-kit | Touch-friendly reordering. |
| Language | Hebrew, RTL (`dir="rtl"`) | English can be added later. |

**Installing:** the app is opened once from a static host (for example GitHub Pages) and added to the home screen. After that it runs with no internet connection.
If a real Android app is preferred later, the same code can be wrapped with Capacitor to produce an APK.

**Backup:** because the data lives only on the phone, the app offers *Export game to file* (a `.zip` of JSON plus audio) and *Import from file*. This also lets the user move games to a new phone.

---

## 8. Scope

**MVP (v1)**
- Create, rename, duplicate and delete games; each game starts empty
- Game details: general clips (opening, after-character, closing) and timing
- Character editor with recording, playback and file upload
- Several lineups per game, with counts, drag-to-reorder and duplication
- Night playback with pause/skip/back, auto-advance and a discussion timer
- Hebrew RTL UI, offline, installable

**Later**
- Export/import of a game to a file (backup, or moving to a new phone)
- Text-to-speech fallback
- Background music or ambient sound during the night
- English UI
