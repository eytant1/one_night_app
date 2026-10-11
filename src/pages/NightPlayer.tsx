import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { MediaImage, NotFound } from '../components/common';
import { db, type Character, type Game, type Lineup } from '../db';
import { formatSeconds } from '../media';
import { ClipPlayer, beep, buildNightSteps, silentCharacters, type NightStep } from '../night';
import { t } from '../strings';

type Phase = 'ready' | 'playing' | 'countdown' | 'waiting' | 'done';

interface NightData {
  game: Game;
  lineup: Lineup;
  steps: NightStep[];
  silent: Character[];
}

export function NightPlayer() {
  const { gameId = '', lineupId = '' } = useParams();
  const navigate = useNavigate();
  const exitTo = `/game/${gameId}/lineups`;

  const [data, setData] = useState<NightData | null>(null);
  const [missing, setMissing] = useState(false);
  const [phase, setPhase] = useState<Phase>('ready');
  const [index, setIndex] = useState(0);
  const [runKey, setRunKey] = useState(0); // bumps every time a step (re)starts
  const [paused, setPaused] = useState(false);
  const [remaining, setRemaining] = useState(0);

  const playerRef = useRef<ClipPlayer>();
  playerRef.current ??= new ClipPlayer();
  const player = playerRef.current;

  // The script is built once when the screen opens, so edits elsewhere can't change a night in progress.
  useEffect(() => {
    (async () => {
      const [game, lineup, characters] = await Promise.all([
        db.games.get(gameId),
        db.lineups.get(lineupId),
        db.characters.where('gameId').equals(gameId).toArray(),
      ]);
      if (!game || !lineup) return setMissing(true);
      setData({
        game,
        lineup,
        steps: buildNightSteps(game, lineup, characters),
        silent: silentCharacters(lineup, characters),
      });
    })();
  }, [gameId, lineupId]);

  useEffect(() => () => player.stop(), [player]);
  useWakeLock(phase !== 'ready' && phase !== 'done');

  const steps = data?.steps ?? [];
  const step = steps[index];
  const isLast = index === steps.length - 1;

  const goTo = (i: number) => {
    player.stop();
    player.resume();
    setPaused(false);
    if (i >= steps.length) {
      setPhase('done');
      return;
    }
    setIndex(Math.max(0, i));
    setRunKey((k) => k + 1);
  };

  // Run the current step: play its clips, then count down / wait for a tap.
  useEffect(() => {
    if (runKey === 0 || !data) return;
    const current = data.steps[index];
    if (current.kind === 'discussion') {
      setRemaining(data.game.discussionMinutes * 60);
      setPhase('countdown');
      return;
    }
    let cancelled = false;
    setPhase('playing');
    player.playAll(current.clips).then(() => {
      if (cancelled) return;
      if (index === data.steps.length - 1) setPhase('done');
      else if (data.game.autoAdvance) {
        setRemaining(data.game.pauseBetweenSteps);
        setPhase('countdown');
      } else setPhase('waiting');
    });
    return () => {
      cancelled = true;
    };
  }, [runKey]);

  // Countdown tick.
  useEffect(() => {
    if (phase !== 'countdown' || paused) return;
    if (remaining <= 0) {
      if (step?.kind === 'discussion') beep();
      if (isLast) setPhase('done');
      else goTo(index + 1);
      return;
    }
    const timer = setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => clearTimeout(timer);
  }, [phase, paused, remaining]);

  if (missing) return <NotFound />;
  if (!data) return <div className="night" />;

  const exit = () => {
    player.stop();
    navigate(exitTo);
  };

  const togglePause = () => {
    if (paused) player.resume();
    else player.pause();
    setPaused(!paused);
  };

  if (phase === 'ready') {
    return (
      <div className="night">
        <div className="night-center">
          <p className="night-sub">{data.lineup.name}</p>
          <h1 className="night-title">{t.readyTitle}</h1>
          <p className="night-text">{t.readyHint}</p>
          {data.steps.every((s) => s.kind !== 'character') && <p className="night-warn">{t.noWakingCharacters}</p>}
          {data.silent.length > 0 && (
            <p className="night-warn">
              ⚠️ {t.missingWarning} {data.silent.map((c) => c.name).join(', ')}
            </p>
          )}
          <button
            className="btn btn-primary btn-huge"
            disabled={steps.length === 0}
            onClick={() => {
              player.unlock();
              goTo(0);
            }}
          >
            ▶ {t.start}
          </button>
        </div>
        <button className="btn night-exit" onClick={exit}>
          {t.exit}
        </button>
      </div>
    );
  }

  if (phase === 'done') {
    return (
      <div className="night">
        <div className="night-center">
          <h1 className="night-title">☀️ {t.nightOver}</h1>
          <button className="btn btn-primary btn-huge" onClick={() => goTo(0)}>
            ↻ {t.playAgain}
          </button>
          <button className="btn" onClick={exit}>
            {t.exit}
          </button>
        </div>
      </div>
    );
  }

  const isDiscussion = step.kind === 'discussion';
  const total = isDiscussion ? data.game.discussionMinutes * 60 : data.game.pauseBetweenSteps;

  return (
    <div className="night">
      <div className="night-top">
        <button className="btn night-exit-inline" onClick={exit}>
          ✕
        </button>
        <span className="night-sub">{t.step(index + 1, steps.length)}</span>
      </div>

      <div className="night-center">
        {step.kind === 'character' && <MediaImage mediaId={step.imageId} className="night-image" fallback="🌙" />}
        <h1 className="night-title">
          {step.title}
          {step.count && step.count > 1 ? ` ×${step.count}` : ''}
        </h1>
        {step.text && <p className="night-text">{step.text}</p>}

        <div className="night-status">
          {phase === 'playing' && <span className="pulse">🔊</span>}
          {phase === 'countdown' &&
            (isDiscussion ? (
              <>
                <span className="night-sub">{t.discussionLeft}</span>
                <span className="night-timer">{formatSeconds(remaining)}</span>
              </>
            ) : (
              <span className="night-sub">{t.nextIn(remaining)}</span>
            ))}
          {phase === 'countdown' && total > 0 && (
            <div className="progress">
              <div className="progress-bar" style={{ width: `${(1 - remaining / total) * 100}%` }} />
            </div>
          )}
          {phase === 'waiting' && <span className="night-sub">{t.tapNext}</span>}
        </div>
      </div>

      <div className="night-controls">
        {/* Media controls stay left-to-right, as in most Hebrew players. */}
        <button className="btn btn-round" aria-label={t.prev} onClick={() => goTo(index - 1)} disabled={index === 0}>
          ⏮
        </button>
        <button className="btn btn-round btn-round-lg" aria-label={paused ? t.resume : t.pause} onClick={togglePause}>
          {paused ? '▶' : '⏸'}
        </button>
        <button className="btn btn-round" aria-label={t.next} onClick={() => goTo(index + 1)}>
          ⏭
        </button>
      </div>
    </div>
  );
}

/** Keeps the screen on while the night is running. */
function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return;
    let lock: WakeLockSentinel | undefined;
    let released = false;
    const request = async () => {
      try {
        lock = await navigator.wakeLock.request('screen');
        if (released) lock.release();
      } catch {
        // Not allowed (e.g. battery saver); the night still works.
      }
    };
    const onVisible = () => document.visibilityState === 'visible' && request();
    request();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      released = true;
      document.removeEventListener('visibilitychange', onVisible);
      lock?.release();
    };
  }, [active]);
}
