import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ClipEditor } from '../components/ClipEditor';
import { ConfirmDialog } from '../components/Dialogs';
import { MediaImage, NotFound, TopBar } from '../components/common';
import { db, deleteCharacter, lineupsUsingCharacter, newId, saveMedia, type Character } from '../db';
import { resizeImage } from '../media';
import { t } from '../strings';

type Draft = Pick<Character, 'name' | 'description' | 'imageId' | 'wakesAtNight' | 'instruction'>;

const emptyDraft: Draft = { name: '', description: '', wakesAtNight: true, instruction: {} };

export function CharacterEditor() {
  const { gameId = '', characterId = 'new' } = useParams();
  const isNew = characterId === 'new';
  const navigate = useNavigate();
  const backTo = `/game/${gameId}/characters`;

  const [draft, setDraft] = useState<Draft | null>(isNew ? emptyDraft : null);
  const [original, setOriginal] = useState<Draft | null>(isNew ? emptyDraft : null);
  const [missing, setMissing] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [dialog, setDialog] = useState<'discard' | 'delete' | null>(null);
  const [usedIn, setUsedIn] = useState<string[]>([]);
  const imageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isNew) return;
    db.characters.get(characterId).then((c) => {
      if (!c) return setMissing(true);
      const loaded: Draft = {
        name: c.name,
        description: c.description,
        imageId: c.imageId,
        wakesAtNight: c.wakesAtNight,
        instruction: c.instruction,
      };
      setDraft(loaded);
      setOriginal(loaded);
    });
  }, [characterId, isNew]);

  if (missing) return <NotFound />;
  if (!draft) return <div className="page" />;

  const update = (changes: Partial<Draft>) => setDraft((d) => ({ ...d!, ...changes }));
  const dirty = JSON.stringify(draft) !== JSON.stringify(original);
  const nameMissing = !draft.name.trim();

  const save = async () => {
    if (nameMissing) {
      setShowErrors(true);
      return;
    }
    const data = { ...draft, name: draft.name.trim(), description: draft.description.trim() };
    if (isNew) {
      await db.characters.add({ ...data, id: newId(), gameId, createdAt: Date.now() });
    } else {
      await db.characters.update(characterId, data);
    }
    navigate(backTo);
  };

  const askDelete = async () => {
    setUsedIn((await lineupsUsingCharacter(characterId)).map((l) => l.name));
    setDialog('delete');
  };

  const onImage = async (file: File | undefined) => {
    if (!file) return;
    update({ imageId: await saveMedia(await resizeImage(file)) });
  };

  return (
    <div className="page">
      <TopBar
        title={isNew ? t.newCharacter : t.editCharacter}
        onBack={() => (dirty ? setDialog('discard') : navigate(backTo))}
        actions={
          <button className="btn btn-primary" onClick={save}>
            {t.save}
          </button>
        }
      />
      <main className="content stack">
        <label className="field">
          <span>{t.name}</span>
          <input
            value={draft.name}
            onChange={(e) => update({ name: e.target.value })}
            autoFocus={isNew}
            aria-invalid={showErrors && nameMissing}
          />
          {showErrors && nameMissing && <span className="error">{t.nameRequired}</span>}
        </label>

        <label className="field">
          <span>{t.description}</span>
          <textarea rows={3} value={draft.description} onChange={(e) => update({ description: e.target.value })} />
        </label>

        <div className="field">
          <span>{t.image}</span>
          <div className="image-row">
            <MediaImage mediaId={draft.imageId} className="thumb-lg" />
            <button type="button" className="btn" onClick={() => imageInputRef.current?.click()}>
              {t.chooseImage}
            </button>
            {draft.imageId && (
              <button type="button" className="btn" onClick={() => update({ imageId: undefined })}>
                {t.removeImage}
              </button>
            )}
          </div>
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              onImage(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </div>

        <label className="field field-row">
          <span>{t.wakesAtNight}</span>
          <input
            type="checkbox"
            checked={draft.wakesAtNight}
            onChange={(e) => update({ wakesAtNight: e.target.checked })}
          />
        </label>

        <section className="card">
          <h2>{t.nightInstruction}</h2>
          <ClipEditor
            value={draft.instruction}
            onChange={(instruction) => update({ instruction })}
            textLabel={t.instructionText}
          />
        </section>

        {!isNew && (
          <button className="btn btn-danger btn-block" onClick={askDelete}>
            {t.delete}
          </button>
        )}
      </main>

      {dialog === 'discard' && (
        <ConfirmDialog
          title={t.discardChangesQ}
          confirmLabel={t.discard}
          onConfirm={() => navigate(backTo)}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === 'delete' && (
        <ConfirmDialog
          title={t.confirmDeleteTitle}
          message={
            <>
              {t.deleteCharacterQ(original?.name ?? '')} {usedIn.length > 0 && t.usedInLineups(usedIn)}
            </>
          }
          onConfirm={async () => {
            await deleteCharacter(characterId);
            navigate(backTo);
          }}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  );
}
