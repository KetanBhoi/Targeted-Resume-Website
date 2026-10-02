import type { WorkspaceRecord } from '@workspace/api-client-react';

export type BuildResult =
  | { ok: false; error: string }
  | { ok: true; title: string; content: string; metadata: Record<string, unknown> };

export function errorText(e: unknown): string {
  const x = e as { data?: { error?: unknown }; message?: unknown } | null;
  if (x && x.data && typeof x.data.error === 'string' && x.data.error) return x.data.error;
  if (x && typeof x.message === 'string' && x.message) return x.message;
  return 'The server rejected the request and gave no reason.';
}

const str = (v: unknown) => (typeof v === 'string' ? v : '');
const meta = (r: WorkspaceRecord): Record<string, unknown> => (r.metadata ?? {}) as Record<string, unknown>;
const strList = (v: unknown) => (Array.isArray(v) ? v.filter((i): i is string => typeof i === 'string') : []);

export function isHttps(v: string): boolean {
  try {
    const u = new URL(v);
    return u.protocol === 'https:' && u.username === '' && u.password === '';
  } catch { return false; }
}
export function isValidDate(v: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}
const clip = (s: string) => s.trim().slice(0, 160);
const lines = (s: string) => s.split('\n').map((l) => l.trim()).filter(Boolean);

/* ---------- research ---------- */
export interface SourceDraft { label: string; url: string; checkedOn: string }
export interface ResearchDraft { companyName: string; role: string; sources: SourceDraft[]; questions: string; reasons: string; notes: string }
export const blankResearch = (): ResearchDraft => ({ companyName: '', role: '', sources: [], questions: '', reasons: '', notes: '' });
export function researchToDraft(r: WorkspaceRecord): ResearchDraft {
  const m = meta(r);
  const sources = Array.isArray(m.sources)
    ? m.sources.map((s) => { const o = (s ?? {}) as Record<string, unknown>; return { label: str(o.label), url: str(o.url), checkedOn: str(o.checkedOn) }; })
    : [];
  return { companyName: str(m.companyName), role: str(m.role), sources, questions: strList(m.questions).join('\n'), reasons: strList(m.reasons).join('\n'), notes: r.content };
}
export function buildResearch(d: ResearchDraft): BuildResult {
  const companyName = d.companyName.trim();
  if (!companyName) return { ok: false, error: 'Company name is required.' };
  const sources: SourceDraft[] = [];
  for (let i = 0; i < d.sources.length; i++) {
    const s = d.sources[i];
    const label = s.label.trim(), url = s.url.trim(), checkedOn = s.checkedOn.trim();
    if (!label && !url && !checkedOn) continue;
    if (url && !isHttps(url)) return { ok: false, error: `Source ${i + 1}: link must start with https://.` };
    if (checkedOn && !isValidDate(checkedOn)) return { ok: false, error: `Source ${i + 1}: checked-on date is not a valid date.` };
    sources.push({ label, url, checkedOn });
  }
  if (sources.length > 30) return { ok: false, error: 'At most 30 sources.' };
  const questions = lines(d.questions), reasons = lines(d.reasons);
  if (questions.length > 30 || reasons.length > 30) return { ok: false, error: 'At most 30 questions and 30 reasons.' };
  if ([...questions, ...reasons].some((l) => l.length > 2000)) return { ok: false, error: 'Each question or reason must be 2000 characters or fewer.' };
  const role = d.role.trim();
  return { ok: true, title: clip(role ? `${companyName} - ${role}` : companyName), content: d.notes, metadata: { companyName, role, sources, questions, reasons } };
}
export function researchSummary(r: WorkspaceRecord) {
  const m = meta(r);
  const n = Array.isArray(m.sources) ? m.sources.length : 0;
  return { primary: str(m.companyName) || r.title, secondary: str(m.role) || 'Role not set', tag: `${n} source${n === 1 ? '' : 's'}` };
}

/* ---------- network ---------- */
export const NETWORK_STATUSES = ['planned', 'contacted', 'replied', 'paused'] as const;
export type NetworkStatus = (typeof NETWORK_STATUSES)[number];
export interface NetworkDraft { name: string; organization: string; role: string; email: string; profileUrl: string; lastContact: string; nextFollowUp: string; status: NetworkStatus; notes: string }
export const blankNetwork = (): NetworkDraft => ({ name: '', organization: '', role: '', email: '', profileUrl: '', lastContact: '', nextFollowUp: '', status: 'planned', notes: '' });
export function networkToDraft(r: WorkspaceRecord): NetworkDraft {
  const m = meta(r);
  const status = NETWORK_STATUSES.find((s) => s === m.status) ?? 'planned';
  return { name: str(m.name), organization: str(m.organization), role: str(m.role), email: str(m.email), profileUrl: str(m.profileUrl), lastContact: str(m.lastContact), nextFollowUp: str(m.nextFollowUp), status, notes: r.content };
}
export function buildNetwork(d: NetworkDraft): BuildResult {
  const name = d.name.trim();
  if (!name) return { ok: false, error: 'Contact name is required.' };
  const email = d.email.trim(), profileUrl = d.profileUrl.trim();
  if (email && !/^[^\s@]+@[^\s@]+$/.test(email)) return { ok: false, error: 'Email does not look like an address.' };
  if (profileUrl && !isHttps(profileUrl)) return { ok: false, error: 'Profile link must start with https://.' };
  if (d.lastContact && !isValidDate(d.lastContact)) return { ok: false, error: 'Last contact is not a valid date.' };
  if (d.nextFollowUp && !isValidDate(d.nextFollowUp)) return { ok: false, error: 'Next follow-up is not a valid date.' };
  return { ok: true, title: clip(name), content: d.notes, metadata: { name, organization: d.organization.trim(), role: d.role.trim(), email, profileUrl, lastContact: d.lastContact, nextFollowUp: d.nextFollowUp, status: d.status } };
}
export function networkSummary(r: WorkspaceRecord) {
  const m = meta(r);
  const bits = [str(m.role), str(m.organization)].filter(Boolean).join(' at ');
  const next = str(m.nextFollowUp);
  return { primary: str(m.name) || r.title, secondary: bits || 'No role or organization', tag: next ? `${str(m.status) || 'planned'} - follow up ${next}` : str(m.status) || 'planned' };
}

/* ---------- offers ---------- */
export const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'CAD', 'AUD'] as const;
export type Currency = (typeof CURRENCIES)[number];
export const RATING_KEYS = ['salary', 'benefits', 'location', 'hours', 'growth'] as const;
export type RatingKey = (typeof RATING_KEYS)[number];
export type Ratings = Record<RatingKey, number>;
export interface OfferDraft { company: string; role: string; currency: Currency; annualSalary: string; annualBonus: string; hoursPerWeek: string; location: string; arrangement: string; benefits: string; ratings: Ratings; notes: string }
export const blankOffer = (): OfferDraft => ({ company: '', role: '', currency: 'INR', annualSalary: '', annualBonus: '', hoursPerWeek: '', location: '', arrangement: '', benefits: '', ratings: { salary: 3, benefits: 3, location: 3, hours: 3, growth: 3 }, notes: '' });

export interface OfferView { id: number; company: string; role: string; currency: Currency; annualSalary: number | null; annualBonus: number | null; hoursPerWeek: number | null; location: string; arrangement: string; benefits: string; ratings: Ratings }
const numOrNull = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const rating = (v: unknown) => (typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 5 ? v : 3);
export function readOffer(r: WorkspaceRecord): OfferView {
  const m = meta(r);
  const rt = (m.ratings ?? {}) as Record<string, unknown>;
  return {
    id: r.id, company: str(m.company) || r.title, role: str(m.role),
    currency: CURRENCIES.find((c) => c === m.currency) ?? 'INR',
    annualSalary: numOrNull(m.annualSalary), annualBonus: numOrNull(m.annualBonus), hoursPerWeek: numOrNull(m.hoursPerWeek),
    location: str(m.location), arrangement: str(m.arrangement), benefits: str(m.benefits),
    ratings: { salary: rating(rt.salary), benefits: rating(rt.benefits), location: rating(rt.location), hours: rating(rt.hours), growth: rating(rt.growth) },
  };
}
export function offerToDraft(r: WorkspaceRecord): OfferDraft {
  const o = readOffer(r);
  const s = (n: number | null) => (n === null ? '' : String(n));
  return { company: o.company, role: o.role, currency: o.currency, annualSalary: s(o.annualSalary), annualBonus: s(o.annualBonus), hoursPerWeek: s(o.hoursPerWeek), location: o.location, arrangement: o.arrangement, benefits: o.benefits, ratings: o.ratings, notes: r.content };
}
function parseAmount(label: string, v: string, positive: boolean): { v: number | null; error?: string } {
  const t = v.trim();
  if (!t) return { v: null };
  const n = Number(t);
  if (!Number.isFinite(n) || (positive ? n <= 0 : n < 0)) return { v: null, error: positive ? `${label} must be a number greater than zero, or left blank.` : `${label} must be zero or more, or left blank if unknown.` };
  return { v: n };
}
export function buildOffer(d: OfferDraft): BuildResult {
  const company = d.company.trim();
  if (!company) return { ok: false, error: 'Company is required.' };
  const s = parseAmount('Annual salary', d.annualSalary, false); if (s.error) return { ok: false, error: s.error };
  const b = parseAmount('Annual bonus', d.annualBonus, false); if (b.error) return { ok: false, error: b.error };
  const h = parseAmount('Hours per week', d.hoursPerWeek, true); if (h.error) return { ok: false, error: h.error };
  const role = d.role.trim();
  return { ok: true, title: clip(role ? `${company} - ${role}` : company), content: d.notes, metadata: { company, role, currency: d.currency, annualSalary: s.v, annualBonus: b.v, hoursPerWeek: h.v, location: d.location.trim(), arrangement: d.arrangement.trim(), benefits: d.benefits.trim(), ratings: d.ratings } };
}
export function offerSummary(r: WorkspaceRecord) {
  const o = readOffer(r);
  return { primary: o.company, secondary: o.role || 'Role not set', tag: o.annualSalary === null ? `${o.currency} salary not entered` : `${o.currency} ${o.annualSalary.toLocaleString('en-US')}` };
}

export type Weights = Record<RatingKey, string>;
export const DEFAULT_WEIGHTS: Weights = { salary: '1', benefits: '1', location: '1', hours: '1', growth: '1' };
/** Returns null when weights are invalid or total zero. Score is on the same 1-5 scale as the ratings. */
export function weightedScore(r: Ratings, w: Weights): number | null {
  let total = 0, sum = 0;
  for (const k of RATING_KEYS) {
    const n = Number(w[k].trim() === '' ? 0 : w[k]);
    if (!Number.isFinite(n) || n < 0) return null;
    total += n; sum += n * r[k];
  }
  return total > 0 ? sum / total : null;
}
export const weightsValid = (w: Weights) => RATING_KEYS.every((k) => { const n = Number(w[k].trim() === '' ? 0 : w[k]); return Number.isFinite(n) && n >= 0; });
export const weightsTotal = (w: Weights) => RATING_KEYS.reduce((a, k) => a + (Number(w[k]) || 0), 0);
