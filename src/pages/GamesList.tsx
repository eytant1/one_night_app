import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ConfirmDialog, Modal, TextPromptDialog } from '../components/Dialogs';
import { TopBar } from '../components/common';
import { createGame, db, deleteGame, duplicateGame, updateGame, type Game } from '../db';
import { t } from '../strings';

type DialogState =
  | { kind: 'create' }
  | { kind: 'menu'; game: Game }
  | { kind: 'rename'; game: Game }
  | { kind: 'duplicate'; game: Game }
  | { kind: 'delete'; game: Game };

export function GamesList() {
  const navigate = useNavigate();
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const close = () => setDialog(null);

  const games = useLiveQuery(async () => {
    const all = await db.games.orderBy('createdAt').reverse().toArray();
    return Promise.all(
      all.map(async (game) => ({
        game,
        characters: await db.characters.where('gameId').equals(game.id).count(),
        lineups: await db.lineups.where('gameId').equals(game.id).count(),
      })),
    );
  });

  return (
    <div className="page">
      <TopBar
        title={`🌙 ${t.myGames}`}
        actions={
          <button className="btn btn-primary" onClick={() => setDialog({ kind: 'create' })}>
            + {t.newGame}
          </button>
        }
      />
      <main className="content">
        {games?.length === 0 && <p className="empty">{t.noGames}</p>}
        <ul className="list">
          {games?.map(({ game, characters, lineups }) => (
            <li key={game.id} className="list-item">
              <Link to={`/game/${game.id}/characters`} className="list-main">
                <span className="list-title">{game.name}</span>
                <span className="list-sub">
                  {t.charactersCount(characters)} · {t.lineupsCount(lineups)}
                </span>
              </Link>
              <button
                className="btn btn-icon"
                aria-label="⋮"
                onClick={() => setDialog({ kind: 'menu', game })}
              >
                ⋮
              </button>
            </li>
          ))}
        </ul>
      </main>

      {dialog?.kind === 'create' && (
        <TextPromptDialog
          title={t.newGame}
          label={t.gameName}
          confirmLabel={t.create}
          onConfirm={async (name) => navigate(`/game/${await createGame(name)}/details`)}
          onClose={close}
        />
      )}
      {dialog?.kind === 'menu' && (
        <Modal onClose={close}>
          <h2>{dialog.game.name}</h2>
          <div className="menu">
            <button className="btn" onClick={() => setDialog({ ...dialog, kind: 'rename' })}>
              {t.rename}
            </button>
            <button className="btn" onClick={() => setDialog({ ...dialog, kind: 'duplicate' })}>
              {t.duplicate}
            </button>
            <button className="btn btn-danger" onClick={() => setDialog({ ...dialog, kind: 'delete' })}>
              {t.delete}
            </button>
          </div>
        </Modal>
      )}
      {dialog?.kind === 'rename' && (
        <TextPromptDialog
          title={t.rename}
          label={t.gameName}
          initialValue={dialog.game.name}
          onConfirm={(name) => updateGame(dialog.game.id, { name })}
          onClose={close}
        />
      )}
      {dialog?.kind === 'duplicate' && (
        <TextPromptDialog
          title={t.duplicate}
          label={t.gameName}
          initialValue={`${dialog.game.name} ${t.copySuffix}`}
          confirmLabel={t.duplicate}
          onConfirm={(name) => duplicateGame(dialog.game.id, name)}
          onClose={close}
        />
      )}
      {dialog?.kind === 'delete' && (
        <ConfirmDialog
          title={t.confirmDeleteTitle}
          message={`${t.deleteGameQ(dialog.game.name)} ${t.cannotUndo}`}
          onConfirm={() => deleteGame(dialog.game.id)}
          onClose={close}
        />
      )}
    </div>
  );
}
