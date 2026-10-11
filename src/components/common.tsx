import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMediaUrl } from '../media';
import { t } from '../strings';

export function TopBar({
  title,
  backTo,
  onBack,
  actions,
}: {
  title: ReactNode;
  backTo?: string;
  onBack?: () => void;
  actions?: ReactNode;
}) {
  const navigate = useNavigate();
  const showBack = !!backTo || !!onBack;
  return (
    <header className="topbar">
      {showBack && (
        <button
          className="btn btn-icon topbar-back"
          aria-label={t.back}
          onClick={() => (onBack ? onBack() : navigate(backTo!))}
        >
          →
        </button>
      )}
      <h1 className="topbar-title">{title}</h1>
      <div className="topbar-actions">{actions}</div>
    </header>
  );
}

export function MediaImage({
  mediaId,
  className,
  fallback = '🂠',
}: {
  mediaId?: string;
  className?: string;
  fallback?: string;
}) {
  const url = useMediaUrl(mediaId);
  return (
    <div className={`thumb ${className ?? ''}`}>
      {url ? <img src={url} alt="" /> : <span aria-hidden="true">{fallback}</span>}
    </div>
  );
}

export function NotFound() {
  return (
    <div className="page">
      <TopBar title={t.notFound} backTo="/" />
    </div>
  );
}

export function NumberInput({
  value,
  min,
  max,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const commit = () => {
    const n = Math.min(max, Math.max(min, Math.round(Number(draft))));
    if (Number.isFinite(n) && n !== value) onChange(n);
    else setDraft(String(value));
  };
  return (
    <input
      type="number"
      inputMode="numeric"
      className="number-input"
      min={min}
      max={max}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
    />
  );
}
