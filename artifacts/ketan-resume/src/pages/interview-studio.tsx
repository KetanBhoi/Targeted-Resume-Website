import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Download, Mic, Pause, Play, RotateCcw, SkipForward, Square, Trash2 } from 'lucide-react';
import { useListWorkspaceRecords } from '@workspace/api-client-react';
import { portfolio } from '@/data/portfolio';
import { readInterviewQuestions } from '@/lib/workspace-features';
import { PracticeJournal } from '@/components/practice-journal';
import '@/styles/interview-studio.css';

type Category = 'HR' | 'Technical' | 'Resume' | 'STAR' | 'Saved';
type Q = { id: string; category: Category; text: string };
type MicState = 'idle' | 'requesting' | 'recording' | 'denied' | 'error' | 'unsupported';

const bank: Q[] = [
  { id: 'hr1', category: 'HR', text: 'Why recruiting, given your background is in IT and software?' },
  { id: 'hr2', category: 'HR', text: 'How would you describe your limited recruiting experience honestly to a hiring manager?' },
  { id: 'hr3', category: 'HR', text: 'How do you manage your time when several tasks compete for attention?' },
  { id: 't1', category: 'Technical', text: 'How would you review two candidate profiles consistently and reduce bias?' },
  { id: 't2', category: 'Technical', text: 'Explain a REST API to a non-technical hiring manager.' },
  { id: 't3', category: 'Technical', text: 'How would you structure feedback so it is specific and comparable?' },
  { id: 'r1', category: 'Resume', text: 'Walk me through MetroMart and what you personally built.' },
  { id: 'r2', category: 'Resume', text: 'What did you do at Jinarth Infotech, and what did it teach you about operations?' },
  { id: 'r3', category: 'Resume', text: 'Which listed skill is most transferable to recruiting, and what is the evidence?' },
  { id: 's1', category: 'STAR', text: 'Tell me about a time you had to learn something quickly.' },
  { id: 's2', category: 'STAR', text: 'Describe a time you kept detailed work accurate under a deadline.' },
  { id: 's3', category: 'STAR', text: 'Tell me about a time you worked with others to finish something.' },
];

const cats: Category[] = ['HR', 'Technical', 'Resume', 'STAR', 'Saved'];
const star = ['Situation: set the scene briefly', 'Task: what you were responsible for', 'Action: what you personally did', 'Result: honest outcome, no invented metrics'];

function pickMime(): string {
  const MR = typeof MediaRecorder !== 'undefined' ? MediaRecorder : null;
  if (!MR || typeof MR.isTypeSupported !== 'function') return '';
  return ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'].find((m) => MR.isTypeSupported(m)) ?? '';
}
function extFor(mime: string): string {
  if (mime.includes('mp4')) return 'm4a';
  if (mime.includes('ogg')) return 'ogg';
  if (mime.includes('wav')) return 'wav';
  return 'webm';
}
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

export default function InterviewStudio() {
  const { data: records } = useListWorkspaceRecords({ kind: 'interview' });
  const saved = useMemo<Q[]>(() => {
    const out: Q[] = [];
    (records ?? []).forEach((r) =>
      readInterviewQuestions(r.metadata?.questions).forEach((p, i) =>
        out.push({ id: `saved-${r.id}-${i}`, category: 'Saved', text: p.question })));
    return out;
  }, [records]);

  const [cat, setCat] = useState<Category>('HR');
  const [idx, setIdx] = useState(0);
  const [limit, setLimit] = useState(90);
  const [left, setLeft] = useState(90);
  const [running, setRunning] = useState(false);
  const [draft, setDraft] = useState('');
  const [checks, setChecks] = useState<boolean[]>([false, false, false, false]);
  const [mic, setMic] = useState<MicState>('idle');
  const [audio, setAudio] = useState<{ url: string; mime: string } | null>(null);

  const list = cat === 'Saved' ? saved : bank.filter((q) => q.category === cat);
  const q = list.length ? list[idx % list.length] : null;

  const recRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const urlRef = useRef<string | null>(null);
  const aliveRef = useRef(true);
  const reqRef = useRef(0);
  const answerRef = useRef(0);

  const stopTracks = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);
  const stopRec = useCallback(() => {
    const r = recRef.current;
    if (r && r.state !== 'inactive') { try { r.stop(); } catch { /* ignore */ } } else stopTracks();
  }, [stopTracks]);
  const clearAudio = useCallback(() => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = null;
    setAudio(null);
  }, []);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      reqRef.current++;
      const r = recRef.current;
      if (r) { r.ondataavailable = null; r.onstop = null; r.onerror = null; if (r.state !== 'inactive') { try { r.stop(); } catch { /* ignore */ } } }
      recRef.current = null;
      stopTracks();
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    };
  }, [stopTracks]);

  useEffect(() => {
    if (!running) return;
    const t = window.setInterval(() => setLeft((v) => Math.max(0, v - 1)), 1000);
    return () => window.clearInterval(t);
  }, [running]);

  useEffect(() => {
    if (running && left === 0) { setRunning(false); stopRec(); }
  }, [left, running, stopRec]);

  const startMic = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') { setMic('unsupported'); return; }
    clearAudio();
    const token = ++reqRef.current;
    setMic('requesting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!aliveRef.current || token !== reqRef.current) { stream.getTracks().forEach((t) => t.stop()); return; }
      streamRef.current = stream;
      const mime = pickMime();
      const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      const chunks: Blob[] = [];
      const answerToken = answerRef.current;
      rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
      rec.onstop = () => {
        stopTracks();
        recRef.current = null;
        if (!aliveRef.current) return;
        const type = rec.mimeType || mime || 'audio/webm';
        if (chunks.length && answerToken === answerRef.current) {
          const url = URL.createObjectURL(new Blob(chunks, { type }));
          if (urlRef.current) URL.revokeObjectURL(urlRef.current);
          urlRef.current = url;
          setAudio({ url, mime: type });
        }
        setMic('idle');
      };
      rec.onerror = () => { stopRec(); if (aliveRef.current) setMic('error'); };
      recRef.current = rec;
      rec.start();
      setMic('recording');
      if (left === 0) setLeft(limit);
      setRunning(true);
    } catch (e) {
      stopTracks();
      if (!aliveRef.current || token !== reqRef.current) return;
      const n = (e as DOMException)?.name;
      setMic(n === 'NotAllowedError' || n === 'SecurityError' ? 'denied' : 'error');
    }
  };

  const cancelMicRequest = () => { reqRef.current++; };
  const reset = () => { setRunning(false); setLeft(limit); stopRec(); cancelMicRequest(); if (mic === 'requesting') setMic('idle'); };
  const next = () => { answerRef.current++; reset(); setIdx((i) => i + 1); setDraft(''); setChecks([false, false, false, false]); clearAudio(); };
  const chooseLimit = (s: number) => { cancelMicRequest(); if (mic === 'requesting') setMic('idle'); setLimit(s); setLeft(s); setRunning(false); stopRec(); };
  const chooseCat = (c: Category) => { answerRef.current++; setCat(c); setIdx(0); reset(); setDraft(''); setChecks([false, false, false, false]); clearAudio(); };
  const toggleRun = () => {
    if (running) { setRunning(false); if (recRef.current?.state === 'recording') recRef.current.pause(); }
    else {
      if (left === 0) setLeft(limit);
      setRunning(true);
      if (recRef.current?.state === 'paused') recRef.current.resume();
    }
  };

  return (
    <section className="studio">
      <header className="studio-head">
        <p className="workspace-eyebrow">Interview studio</p>
        <h1>Practice out loud, in your own words.</h1>
        <p>
          {portfolio.context} Nothing here is scored or judged by software. Your draft and any recording stay
          in this browser tab unless you explicitly save written practice below. Audio is never uploaded.
        </p>
        <p className="studio-warning" role="note">Leaving or refreshing erases the draft and recording unless you save the written text. Download audio first if you want to keep it.</p>
      </header>

      <div className="studio-tabs" role="tablist">
        {cats.map((c) => (
          <button key={c} type="button" role="tab" aria-selected={cat === c} className={cat === c ? 'is-on' : ''} onClick={() => chooseCat(c)}>
            {c === 'Saved' ? `Saved (${saved.length})` : c}
          </button>
        ))}
      </div>

      <section className="studio-card">
        {q ? <h2>{q.text}</h2> : <h2>No saved interview questions yet. Generate some from the Prepare page.</h2>}
        <div className="studio-timer">
          <output aria-live="off" className={left === 0 ? 'is-done' : ''}>{fmt(left)}</output>
          <div className="studio-limits" role="group" aria-label="Answer length">
            {[60, 90, 120].map((s) => (
              <button key={s} type="button" data-testid={`button-studio-limit-${s}`} aria-pressed={limit === s} className={limit === s ? 'is-on' : ''} onClick={() => chooseLimit(s)}>{s}s</button>
            ))}
          </div>
        </div>
        <div className="studio-actions">
          <button type="button" data-testid="button-studio-timer" onClick={toggleRun} disabled={!q}>{running ? <Pause size={14} /> : <Play size={14} />}{running ? 'Pause' : left < limit && left > 0 ? 'Resume' : 'Start'}</button>
          <button type="button" data-testid="button-studio-reset" onClick={reset}><RotateCcw size={14} /> Reset</button>
          <button type="button" data-testid="button-studio-next" onClick={next} disabled={!list.length}><SkipForward size={14} /> Next</button>
        </div>
        {left === 0 && <p role="status">Time is up. Recording, if any, was stopped.</p>}
      </section>

      <section className="studio-grid">
        <div className="studio-card">
          <h3><label htmlFor="studio-draft">Written draft</label></h3>
          <textarea id="studio-draft" data-testid="input-studio-draft" value={draft} onChange={(e) => setDraft(e.target.value)} rows={8} placeholder="Draft your answer. Stay with what the resume documents." />
          <h3>STAR reflection</h3>
          <ul className="studio-checks">
            {star.map((s, i) => (
              <li key={s}><label><input type="checkbox" data-testid={`input-studio-star-${i}`} checked={checks[i]} onChange={() => setChecks((c) => c.map((v, j) => (j === i ? !v : v)))} /> {s}</label></li>
            ))}
          </ul>
          <p className="studio-note">Self-check only. It reflects your own judgment.</p>
        </div>

        <div className="studio-card">
          <h3>Voice recording (optional)</h3>
          <div className="studio-actions">
            <button type="button" data-testid="button-studio-record" onClick={() => void startMic()} disabled={mic === 'recording' || mic === 'requesting' || mic === 'unsupported'}><Mic size={14} /> Record</button>
            <button type="button" data-testid="button-studio-stop" onClick={stopRec} disabled={mic !== 'recording'}><Square size={14} /> Stop</button>
          </div>
          <p role="status" className="studio-note">
            {mic === 'idle' && 'Microphone is off. Recording starts only when you press Record.'}
            {mic === 'requesting' && 'Waiting for microphone permission.'}
            {mic === 'recording' && 'Recording on this device. Stops automatically when the timer ends.'}
            {mic === 'denied' && 'Microphone permission was denied. Allow it in browser settings to record, or practice with the draft only.'}
            {mic === 'error' && 'The microphone could not be used. Check that a device is connected and not in use elsewhere.'}
            {mic === 'unsupported' && 'This browser does not support microphone recording.'}
          </p>
          {audio && (
            <div className="studio-playback">
              <audio controls src={audio.url} aria-label="Practice answer recording" data-testid="audio-studio-playback" />
              <div className="studio-actions">
                <a className="studio-link" data-testid="link-studio-download" href={audio.url} download={`practice-answer.${extFor(audio.mime)}`}><Download size={14} /> Download .{extFor(audio.mime)}</a>
                <button type="button" data-testid="button-studio-discard" onClick={clearAudio}><Trash2 size={14} /> Discard</button>
              </div>
            </div>
          )}
        </div>
      </section>
      <PracticeJournal question={q?.text ?? null} category={q?.category ?? cat} limit={limit} answer={draft} checks={checks} />
    </section>
  );
}
