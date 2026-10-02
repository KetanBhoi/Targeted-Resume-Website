import type { ApplicationPackSnapshot } from '@workspace/api-client-react';

const isObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === 'object' && !Array.isArray(value));

export function safeSupportingUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch { return false; }
}

/** Select known snapshot fields only, never workspace metadata or private notes. */
export function parseApplicationPack(content: string): ApplicationPackSnapshot | null {
  if (content.length > 250_000) return null;
  try {
    const value: unknown = JSON.parse(content);
    if (!isObject(value) || typeof value.title !== 'string' || !value.title.trim()
      || typeof value.brief !== 'string' || typeof value.createdAt !== 'string'
      || !Number.isFinite(Date.parse(value.createdAt))) return null;
    const document = (entry: unknown) => isObject(entry)
      && typeof entry.title === 'string' && typeof entry.content === 'string'
      && entry.content.trim().length > 0;
    if (!document(value.resume) || (value.coverLetter !== null && !document(value.coverLetter))
      || !Array.isArray(value.links) || value.links.length > 30) return null;
    const links: ApplicationPackSnapshot['links'] = [];
    for (const link of value.links) {
      if (!isObject(link) || typeof link.label !== 'string' || !link.label.trim()
        || typeof link.url !== 'string' || !safeSupportingUrl(link.url)) return null;
      links.push({ label: link.label, url: link.url });
    }
    const resume = value.resume as { title: string; content: string };
    const cover = value.coverLetter as { title: string; content: string } | null;
    return {
      title: value.title,
      resume: { title: resume.title, content: resume.content },
      coverLetter: cover ? { title: cover.title, content: cover.content } : null,
      brief: value.brief,
      links,
      createdAt: value.createdAt,
    };
  } catch { return null; }
}

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (char) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!));

export function buildApplicationPackFiles(pack: ApplicationPackSnapshot): Record<string, Uint8Array> {
  const encoder = new TextEncoder();
  const files: Record<string, Uint8Array> = {
    'resume.txt': encoder.encode(pack.resume.content),
    'recruiter-brief.txt': encoder.encode(pack.brief),
    'README.txt': encoder.encode([
      pack.title,
      `Snapshot created: ${pack.createdAt}`,
      '',
      'Documents are UTF-8 text, not PDF files. Their original wording is preserved.',
      'Fact review is the applicant’s confirmation, not independent verification.',
      'This archive contains selected application documents only, not private workspace notes.',
      'Revoking a share link cannot erase copies that recipients already downloaded.',
    ].join('\n')),
    'supporting-links.html': encoder.encode(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex,nofollow,noarchive">
<meta name="referrer" content="no-referrer"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(pack.title)} — Supporting links</title>
<style>body{font-family:system-ui,sans-serif;max-width:50rem;margin:3rem auto;padding:0 1.2rem;background:#f5f2e8;color:#1d2536}li{margin:1rem 0;overflow-wrap:anywhere}a{color:#244d84}</style></head>
<body><h1>${escapeHtml(pack.title)}</h1><h2>Supporting links</h2>
${pack.links.length ? `<ul>${pack.links.map((link) => `<li><a href="${escapeHtml(link.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(link.label)}</a></li>`).join('')}</ul>` : '<p>No supporting links were included.</p>'}
</body></html>`),
    'manifest.json': encoder.encode(JSON.stringify({
      title: pack.title,
      createdAt: pack.createdAt,
      format: 'UTF-8 application documents',
      resume: pack.resume.title,
      coverLetter: pack.coverLetter?.title ?? null,
      links: pack.links,
    }, null, 2)),
  };
  if (pack.coverLetter) files['cover-letter.txt'] = encoder.encode(pack.coverLetter.content);
  return files;
}

export async function downloadApplicationPack(pack: ApplicationPackSnapshot): Promise<void> {
  const { zipSync } = await import('fflate');
  const bytes = zipSync(buildApplicationPackFiles(pack), { level: 6 });
  const url = URL.createObjectURL(new Blob([new Uint8Array(bytes).buffer], { type: 'application/zip' }));
  const anchor = document.createElement('a');
  const name = pack.title.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
  anchor.href = url;
  anchor.download = `${name || 'application-pack'}.zip`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}