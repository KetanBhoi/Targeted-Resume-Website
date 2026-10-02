import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link } from 'wouter';
import { BookMarked } from 'lucide-react';
import { getListWorkspaceRecordsQueryKey, useCreateWorkspaceRecord } from '@workspace/api-client-react';
import { PRACTICE_KIND } from '@/lib/simulation-scenarios';
import '@/styles/practice-tools.css';

type Props = { question: string | null; category: string; limit: number; answer: string; checks: boolean[] };

/** Optional, explicit save of WRITTEN practice only. Audio is never passed to this component. */
export function PracticeJournal({ question, category, limit, answer, checks }: Props) {
  const qc = useQueryClient();
  const create = useCreateWorkspaceRecord();
  const [reflection, setReflection] = useState('');
  const [agree, setAgree] = useState(false);
  const [state, setState] = useState<'idle' | 'saved' | 'error'>('idle');

  const rev = useRef(0);
  useEffect(() => { rev.current++; setState('idle'); setReflection(''); setAgree(false); }, [question]);
  useEffect(() => { rev.current++; setState('idle'); }, [answer, category, limit, checks]);

  const canSave = Boolean(question) && answer.trim().length > 0 && agree && !create.isPending;
  const save = () => {
    if (!question) return;
    const mine = ++rev.current;
    create.mutate(
      {
        data: {
          kind: PRACTICE_KIND,
          title: question.slice(0, 160),
          content: answer,
          metadata: { question, category, duration: limit, checks: checks.slice(0, 4), reflection },
        },
      },
      {
        onSuccess: () => { void qc.invalidateQueries({ queryKey: getListWorkspaceRecordsQueryKey() }); if (mine === rev.current) setState('saved'); },
        onError: () => { if (mine === rev.current) setState('error'); },
      },
    );
  };

  return (
    <section className="pt-journal" aria-label="Save written practice">
      <h3><BookMarked size={16} style={{ display: 'inline', marginRight: 6 }} />Save written practice (optional)</h3>
      <p className="studio-note">Nothing is saved unless you press the button. Saving uploads only your written answer, reflection, question, STAR checks and answer length to your private account. Audio never leaves this device.</p>
      <label className="pt-field"><span>Reflection</span>
        <textarea rows={3} value={reflection} disabled={create.isPending} onChange={(e) => { rev.current++; setReflection(e.target.value); setState('idle'); }} placeholder="What would you change next time?" data-testid="input-journal-reflection" />
      </label>
      <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13 }}>
        <input type="checkbox" checked={agree} disabled={create.isPending} onChange={(e) => setAgree(e.target.checked)} data-testid="input-journal-consent" />
        <span>I understand my written text will be saved privately to my account.</span>
      </label>
      <div className="pt-actions">
        <button type="button" onClick={save} disabled={!canSave} data-testid="button-journal-save">{create.isPending ? 'Saving…' : 'Save written practice'}</button>
        <Link href="/workspace/practice" className="studio-link" data-testid="link-practice-history">Practice history</Link>
        {answer.trim().length === 0 && <span className="pt-feedback">Write a draft first.</span>}
        {state === 'saved' && <span role="status" className="pt-feedback">Saved. Your draft stays here until you move on.</span>}
        {state === 'error' && <span role="alert" className="pt-feedback is-error">Could not save. Try again.</span>}
      </div>
    </section>
  );
}
