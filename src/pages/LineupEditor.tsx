import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ConfirmDialog, Modal, TextPromptDialog } from '../components/Dialogs';
import { MediaImage, NotFound, NumberInput, TopBar } from '../components/common';
import { db, duplicateLineup, type Character, type Lineup, type LineupEntry } from '../db';
import { t } from '../strings';

export function LineupEditor() {
  const { gameId = '', lineupId = '' } = useParams();
  const navigate = useNavigate();
  const backTo = `/game/${gameId}/lineups`;

  // The lineup is edited locally (so dragging feels instant) and every change is saved right away.
  const [lineup, setLineup] = useState<Lineup | null>(null);
  const [missing, setMissing] = useState(false);
  const [dialog, setDialog] = useState<'add' | 'duplicate' | 'delete' | null>(null);

  const characters = useLiveQuery(() => db.characters.where('gameId').equals(gameId).sortBy('createdAt'), [gameId]);
  const byId = new Map(characters?.map((c) => [c.id, c]));

  useEffect(() => {
    db.lineups.get(lineupId).then((l) => (l ? setLineup(l) : setMissing(true)));
  }, [lineupId]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  if (missing) return <NotFound />;
  if (!lineup || !characters) return <div className="page" />;

  const change = (changes: Partial<Lineup>) => {
    const next = { ...lineup, ...changes };
    setLineup(next);
    db.lineups.update(lineup.id, changes);
  };

  // Entries whose character was deleted are ignored.
  const entries = lineup.entries.filter((e) => byId.has(e.characterId));
  const waking = entries.filter((e) => byId.get(e.characterId)!.wakesAtNight);
  const sleeping = entries.filter((e) => !byId.get(e.characterId)!.wakesAtNight);
  const totalCards = entries.reduce((sum, e) => sum + e.count, 0);

  const setEntries = (newWaking: LineupEntry[], newSleeping: LineupEntry[]) =>
    change({ entries: [...newWaking, ...newSleeping] });

  const setCount = (characterId: string, count: number) => {
    const map = (list: LineupEntry[]) =>
      count <= 0
        ? list.filter((e) => e.characterId !== characterId)
        : list.map((e) => (e.characterId === characterId ? { ...e, count } : e));
    setEntries(map(waking), map(sleeping));
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = waking.findIndex((e) => e.characterId === active.id);
    const to = waking.findIndex((e) => e.characterId === over.id);
    setEntries(arrayMove(waking, from, to), sleeping);
  };

  const available = characters.filter((c) => !entries.some((e) => e.characterId === c.id));

  return (
    <div className="page">
      <TopBar
        title={lineup.name}
        backTo={backTo}
        actions={
          <Link to={`/game/${gameId}/night/${lineup.id}`} className="btn btn-primary">
            ▶ {t.startNight}
          </Link>
        }
      />
      <main className="content stack">
        <NameField value={lineup.name} onSave={(name) => change({ name })} />

        <div className="counts">
          <label className="field field-row">
            <span>{t.players}</span>
            <NumberInput value={lineup.playerCount} min={1} max={99} onChange={(playerCount) => change({ playerCount })} />
          </label>
          <div className="count-pill">
            {t.cards}: <strong>{totalCards}</strong>
          </div>
        </div>

        {entries.length === 0 && <p className="empty">{t.emptyLineup}</p>}

        {waking.length > 0 && (
          <section>
            <h2 className="section-title">🌙 {t.nightOrder}</h2>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext items={waking.map((e) => e.characterId)} strategy={verticalListSortingStrategy}>
                <ol className="list">
                  {waking.map((entry, i) => (
                    <SortableEntry
                      key={entry.characterId}
                      index={i + 1}
                      entry={entry}
                      character={byId.get(entry.characterId)!}
                      onCount={(n) => setCount(entry.characterId, n)}
                    />
                  ))}
                </ol>
              </SortableContext>
            </DndContext>
          </section>
        )}

        {sleeping.length > 0 && (
          <section>
            <h2 className="section-title">{t.doesntWake}</h2>
            <ul className="list">
              {sleeping.map((entry) => (
                <EntryRow
                  key={entry.characterId}
                  entry={entry}
                  character={byId.get(entry.characterId)!}
                  onCount={(n) => setCount(entry.characterId, n)}
                />
              ))}
            </ul>
          </section>
        )}

        <button className="btn btn-block" onClick={() => setDialog('add')}>
          + {t.addCharacters}
        </button>

        <div className="row-actions">
          <button className="btn" onClick={() => setDialog('duplicate')}>
            {t.duplicate}
          </button>
          <button className="btn btn-danger" onClick={() => setDialog('delete')}>
            {t.delete}
          </button>
        </div>
      </main>

      {dialog === 'add' && (
        <AddCharactersDialog
          gameId={gameId}
          hasAnyCharacters={characters.length > 0}
          available={available}
          onAdd={(ids) => change({ entries: [...entries, ...ids.map((characterId) => ({ characterId, count: 1 }))] })}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === 'duplicate' && (
        <TextPromptDialog
          title={t.duplicate}
          label={t.name}
          initialValue={`${lineup.name} ${t.copySuffix}`}
          confirmLabel={t.duplicate}
          onConfirm={async (name) => navigate(`/game/${gameId}/lineup/${await duplicateLineup(lineup.id, name)}`)}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === 'delete' && (
        <ConfirmDialog
          title={t.confirmDeleteTitle}
          message={t.deleteLineupQ(lineup.name)}
          onConfirm={async () => {
            await db.lineups.delete(lineup.id);
            navigate(backTo);
          }}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  );
}

function NameField({ value, onSave }: { value: string; onSave: (name: string) => void }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return (
    <label className="field">
      <span>{t.name}</span>
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => (draft.trim() && draft.trim() !== value ? onSave(draft.trim()) : setDraft(value))}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      />
    </label>
  );
}

function Stepper({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="stepper">
      <button className="btn btn-icon" aria-label="−" onClick={() => onChange(value - 1)}>
        {value <= 1 ? '🗑' : '−'}
      </button>
      <span className="stepper-value">{value}</span>
      <button className="btn btn-icon" aria-label="+" onClick={() => onChange(value + 1)}>
        +
      </button>
    </div>
  );
}

function EntryRow({
  entry,
  character,
  onCount,
}: {
  entry: LineupEntry;
  character: Character;
  onCount: (n: number) => void;
}) {
  return (
    <li className="list-item entry-row">
      <MediaImage mediaId={character.imageId} />
      <span className="list-title entry-name">{character.name}</span>
      <Stepper value={entry.count} onChange={onCount} />
    </li>
  );
}

function SortableEntry({
  index,
  entry,
  character,
  onCount,
}: {
  index: number;
  entry: LineupEntry;
  character: Character;
  onCount: (n: number) => void;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: entry.characterId,
  });
  return (
    <li
      ref={setNodeRef}
      className={`list-item entry-row ${isDragging ? 'dragging' : ''}`}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <button
        ref={setActivatorNodeRef}
        className="drag-handle"
        aria-label={t.dragToReorder}
        {...attributes}
        {...listeners}
      >
        ≡
      </button>
      <span className="order-num">{index}.</span>
      <MediaImage mediaId={character.imageId} />
      <span className="list-title entry-name">
        {character.name} {!character.instruction.audioId && <span title={t.noRecording}>⚠️</span>}
      </span>
      <Stepper value={entry.count} onChange={onCount} />
    </li>
  );
}

function AddCharactersDialog({
  gameId,
  hasAnyCharacters,
  available,
  onAdd,
  onClose,
}: {
  gameId: string;
  hasAnyCharacters: boolean;
  available: Character[];
  onAdd: (ids: string[]) => void;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <Modal onClose={onClose}>
      <h2>{t.addCharacters}</h2>
      {!hasAnyCharacters ? (
        <p className="muted">
          {t.noCharactersYet} <Link to={`/game/${gameId}/character/new`}>+ {t.newCharacter}</Link>
        </p>
      ) : available.length === 0 ? (
        <p className="muted">{t.allCharactersAdded}</p>
      ) : (
        <ul className="list pick-list">
          {available.map((c) => (
            <li key={c.id}>
              <label className="list-item pick-item">
                <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} />
                <MediaImage mediaId={c.imageId} />
                <span className="list-title">{c.name}</span>
                {c.wakesAtNight && <span>🌙</span>}
              </label>
            </li>
          ))}
        </ul>
      )}
      <div className="modal-actions">
        <button className="btn" onClick={onClose}>
          {t.cancel}
        </button>
        <button
          className="btn btn-primary"
          disabled={selected.size === 0}
          onClick={() => {
            // Keep the pool's order for the newly added characters.
            onAdd(available.filter((c) => selected.has(c.id)).map((c) => c.id));
            onClose();
          }}
        >
          {t.add}
        </button>
      </div>
    </Modal>
  );
}
