import { useEffect, useRef, useState } from 'react';
import { saveMedia, type Clip } from '../db';
import { formatSeconds, pickRecorderMimeType, useMediaUrl } from '../media';
import { t } from '../strings';

/**
 * Record (microphone), upload, play or remove the audio of a clip,
 * and optionally edit its text.
 */
export function ClipEditor({
  value,
  onChange,
  textLabel,
  textPlaceholder,
}: {
  value: Clip;
  onChange: (clip: Clip) => void;
  textLabel?: string;
  textPlaceholder?: string;
}) {
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string>();
  const [playing, setPlaying] = useState(false);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  // Keep the latest value so async callbacks don't overwrite newer edits.
  const valueRef = useRef(value);
  valueRef.current = value;

  const audioUrl = useMediaUrl(value.audioId);
  const canRecord = !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined';

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  };

  useEffect(
    () => () => {
      if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
      stopStream();
    },
    [],
  );

  useEffect(() => {
    if (!recording) return;
    const started = Date.now();
    const timer = setInterval(() => setElapsed((Date.now() - started) / 1000), 200);
    return () => clearInterval(timer);
  }, [recording]);

  const startRecording = async () => {
    setError(undefined);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = pickRecorderMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data);
      recorder.onstop = async () => {
        stopStream();
        setRecording(false);
        if (chunks.length === 0) return;
        const blob = new Blob(chunks, { type: recorder.mimeType || mimeType || 'audio/webm' });
        const audioId = await saveMedia(blob);
        onChange({ ...valueRef.current, audioId });
      };
      recorderRef.current = recorder;
      recorder.start();
      setElapsed(0);
      setRecording(true);
    } catch {
      stopStream();
      setError(t.micError);
    }
  };

  const stopRecording = () => recorderRef.current?.stop();

  const onUpload = async (file: File | undefined) => {
    if (!file) return;
    const audioId = await saveMedia(file);
    onChange({ ...valueRef.current, audioId });
  };

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      audio.currentTime = 0;
      setPlaying(false);
    } else {
      audio.currentTime = 0;
      audio.play().then(() => setPlaying(true), () => setPlaying(false));
    }
  };

  return (
    <div className="clip-editor">
      <div className="clip-buttons">
        {recording ? (
          <button type="button" className="btn btn-danger recording" onClick={stopRecording}>
            ■ {t.stop} {formatSeconds(elapsed)}
          </button>
        ) : (
          <>
            {canRecord && (
              <button type="button" className="btn btn-record" onClick={startRecording}>
                ● {t.record}
              </button>
            )}
            {value.audioId && (
              <>
                <button type="button" className="btn" onClick={togglePlay} disabled={!audioUrl}>
                  {playing ? `■ ${t.stop}` : `▶ ${t.play}`}
                </button>
                <button
                  type="button"
                  className="btn btn-icon"
                  title={t.removeRecording}
                  aria-label={t.removeRecording}
                  onClick={() => onChange({ ...value, audioId: undefined })}
                >
                  🗑
                </button>
              </>
            )}
            <button type="button" className="btn" onClick={() => fileRef.current?.click()}>
              ⤒ {t.upload}
            </button>
          </>
        )}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="audio/*"
        hidden
        onChange={(e) => {
          onUpload(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      {audioUrl && <audio ref={audioRef} src={audioUrl} onEnded={() => setPlaying(false)} preload="auto" />}
      {!canRecord && <p className="hint">{t.recordingNotSupported}</p>}
      {error && <p className="error">{error}</p>}
      {textLabel !== undefined && (
        <label className="field">
          <span>{textLabel}</span>
          <textarea
            rows={2}
            value={value.text ?? ''}
            placeholder={textPlaceholder}
            onChange={(e) => onChange({ ...value, text: e.target.value })}
          />
        </label>
      )}
    </div>
  );
}
