import { CareerRecordEditor, Field } from '@/components/career-record-editor';
import { NETWORK_STATUSES, blankNetwork, buildNetwork, networkSummary, networkToDraft, type NetworkStatus } from '@/lib/career-tools';

export default function Networking() {
  return (
    <CareerRecordEditor
      kind="network"
      prefix="network"
      eyebrow="Networking"
      heading="People, and when to write back."
      intro="Contacts you enter by hand, with notes from your conversations and the date you plan to follow up."
      privacy="Contacts and notes are private to your account and are not used for analytics. Nothing is sent from here: follow-up dates are reminders for you, and no message is ever sent automatically."
      newLabel="New contact"
      noun="Contacts"
      emptyTitle="No contacts yet"
      emptyBody="Add someone you have spoken with or plan to reach out to. Everything stays as you typed it."
      blank={blankNetwork}
      toDraft={networkToDraft}
      build={buildNetwork}
      summary={networkSummary}
      renderForm={(d, patch) => (
        <>
          <div className="ct-grid">
            <Field label="Name"><input value={d.name} maxLength={200} required onChange={(e) => patch({ name: e.target.value })} data-testid="input-network-name" /></Field>
            <Field label="Status">
              <select value={d.status} onChange={(e) => patch({ status: e.target.value as NetworkStatus })} data-testid="select-network-status">
                {NETWORK_STATUSES.map((s) => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}
              </select>
            </Field>
            <Field label="Organization"><input value={d.organization} maxLength={200} onChange={(e) => patch({ organization: e.target.value })} data-testid="input-network-org" /></Field>
            <Field label="Their role"><input value={d.role} maxLength={200} onChange={(e) => patch({ role: e.target.value })} data-testid="input-network-role" /></Field>
            <Field label="Email (optional)"><input type="email" value={d.email} maxLength={320} onChange={(e) => patch({ email: e.target.value })} data-testid="input-network-email" /></Field>
            <Field label="Profile link (https only)"><input type="url" inputMode="url" value={d.profileUrl} maxLength={2048} placeholder="https://" onChange={(e) => patch({ profileUrl: e.target.value })} data-testid="input-network-profile" /></Field>
            <Field label="Last contact"><input type="date" value={d.lastContact} onChange={(e) => patch({ lastContact: e.target.value })} data-testid="input-network-last" /></Field>
            <Field label="Next follow-up" hint="A reminder only. Nothing is sent."><input type="date" value={d.nextFollowUp} onChange={(e) => patch({ nextFollowUp: e.target.value })} data-testid="input-network-next" /></Field>
          </div>
          <Field label="Conversation notes"><textarea rows={8} maxLength={50000} value={d.notes} onChange={(e) => patch({ notes: e.target.value })} data-testid="input-network-notes" /></Field>
        </>
      )}
    />
  );
}
