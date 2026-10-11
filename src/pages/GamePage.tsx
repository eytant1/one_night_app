import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { Link, NavLink, useNavigate, useParams } from 'react-router-dom';
import { ClipEditor } from '../components/ClipEditor';
import { MediaImage, NotFound, NumberInput, TopBar } from '../components/common';
import { createLineup, db, hasClipContent, updateGame, type Clip, type Game } from '../db';
import { t } from '../strings';

const TABS = [
  { key: 'details', label: t.tabDetails },
  { key: 'characters', label: t.tabCharacters },
  { key: 'lineups', label: t.tabLineups },
] as const;

export function GamePage() {
  const { gameId = '', tab = 'characters' } = useParams();
  const game = useLiveQuery(() => db.games.get(gameId), [gameId], null);

  if (game === null) return <div className="page" />; // loading
  if (!game) return <NotFound />;

  return (
    <div className="page">
      <TopBar title={game.name} backTo="/" />
      <nav className="tabs" role="tablist">
        {TABS.map(({ key, label }) => (
          <NavLink key={key} to={`/game/${gameId}/${key}`} replace className="tab" role="tab">
            {label}
          </NavLink>
        ))}
      </nav>
      <main className="content">
        {tab === 'details' && <DetailsTab game={game} />}
        {tab === 'characters' && <CharactersTab gameId={gameId} />}
        {tab === 'lineups' && <LineupsTab gameId={gameId} />}
      </main>
    </div>
  );
}

function DetailsTab({ game }: { game: Game }) {
  // Text fields are edited locally and saved on blur, so typing stays smooth.
  const [rulesNotes, setRulesNotes] = useState(game.rulesNotes);
  useEffect(() => setRulesNotes(game.rulesNotes), [game.id]);

  const setClip = (key: keyof Game['generalClips'], clip: Clip) =>
    updateGame(game.id, { generalClips: { ...game.generalClips, [key]: clip } });

  const clips: { key: keyof Game['generalClips']; label: string; hint: string }[] = [
    { key: 'opening', label: t.clipOpening, hint: t.clipOpeningHint },
    { key: 'afterCharacter', label: t.clipAfterCharacter, hint: t.clipAfterCharacterHint },
    { key: 'closing', label: t.clipClosing, hint: t.clipClosingHint },
  ];

  return (
    <div className="stack">
      <label className="field">
        <span>{t.rulesNotes}</span>
        <textarea
          rows={4}
          value={rulesNotes}
          placeholder={t.rulesNotesPlaceholder}
          onChange={(e) => setRulesNotes(e.target.value)}
          onBlur={() => rulesNotes !== game.rulesNotes && updateGame(game.id, { rulesNotes })}
        />
      </label>

      <section className="card">
        <h2>{t.generalClips}</h2>
        {clips.map(({ key, label, hint }) => (
          <div key={key} className="clip-block">
            <div className="clip-head">
              <strong>{label}</strong>
              <span className="badge">{hasClipContent(game.generalClips[key]) ? '🔊' : '—'}</span>
            </div>
            <ClipEditor
              value={game.generalClips[key]}
              onChange={(clip) => setClip(key, clip)}
              textLabel=""
              textPlaceholder={hint}
            />
          </div>
        ))}
      </section>

      <section className="card">
        <h2>{t.timing}</h2>
        <label className="field field-row">
          <span>{t.pauseBetween}</span>
          <NumberInput
            value={game.pauseBetweenSteps}
            min={0}
            max={120}
            onChange={(pauseBetweenSteps) => updateGame(game.id, { pauseBetweenSteps })}
          />
        </label>
        <label className="field field-row">
          <span>{t.autoAdvance}</span>
          <input
            type="checkbox"
            checked={game.autoAdvance}
            onChange={(e) => updateGame(game.id, { autoAdvance: e.target.checked })}
          />
        </label>
        <label className="field field-row">
          <span>{t.discussionMinutes}</span>
          <NumberInput
            value={game.discussionMinutes}
            min={0}
            max={60}
            onChange={(discussionMinutes) => updateGame(game.id, { discussionMinutes })}
          />
        </label>
      </section>
    </div>
  );
}

function CharactersTab({ gameId }: { gameId: string }) {
  const characters = useLiveQuery(
    () => db.characters.where('gameId').equals(gameId).sortBy('createdAt'),
    [gameId],
  );

  return (
    <div className="stack">
      <Link to={`/game/${gameId}/character/new`} className="btn btn-primary btn-block">
        + {t.newCharacter}
      </Link>
      {characters?.length === 0 && <p className="empty">{t.noCharacters}</p>}
      <ul className="list">
        {characters?.map((c) => (
          <li key={c.id} className="list-item">
            <Link to={`/game/${gameId}/character/${c.id}`} className="list-main list-with-thumb">
              <MediaImage mediaId={c.imageId} />
              <span className="list-text">
                <span className="list-title">{c.name}</span>
                {c.description && <span className="list-sub">{c.description}</span>}
              </span>
              <span className="badges">
                {c.wakesAtNight && <span title={t.wakes}>🌙</span>}
                {c.instruction.audioId ? (
                  <span title={t.hasRecording}>🔊</span>
                ) : (
                  c.wakesAtNight && <span title={t.noRecording}>⚠️</span>
                )}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function LineupsTab({ gameId }: { gameId: string }) {
  const navigate = useNavigate();
  const lineups = useLiveQuery(
    () => db.lineups.where('gameId').equals(gameId).sortBy('createdAt'),
    [gameId],
  );

  return (
    <div className="stack">
      <button
        className="btn btn-primary btn-block"
        onClick={async () => navigate(`/game/${gameId}/lineup/${await createLineup(gameId, t.newLineup)}`)}
      >
        + {t.newLineup}
      </button>
      {lineups?.length === 0 && <p className="empty">{t.noLineups}</p>}
      <ul className="list">
        {lineups?.map((l) => (
          <li key={l.id} className="list-item">
            <Link to={`/game/${gameId}/lineup/${l.id}`} className="list-main">
              <span className="list-title">{l.name}</span>
              <span className="list-sub">
                {l.playerCount} {t.players} · {t.cardsCount(l.entries.reduce((sum, e) => sum + e.count, 0))}
              </span>
            </Link>
            <Link
              to={`/game/${gameId}/night/${l.id}`}
              className="btn btn-primary btn-icon"
              aria-label={t.startNight}
              title={t.startNight}
            >
              ▶
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
