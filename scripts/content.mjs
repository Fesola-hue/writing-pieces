import fs from 'node:fs';
import path from 'node:path';

export const ROOT = path.resolve(import.meta.dirname, '..');
export const SITE_URL = 'https://read.aishaonola.me';
export const EMPTY_BEHIND = Object.freeze({ note: '', process: '', extras: [] });

export function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function slugify(value) {
  return String(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function stripMarkdown(value = '') {
  return String(value).replace(/^['"]|['"]$/g, '').replace(/^\*\*|\*\*$/g, '').trim();
}

function parseScalar(raw = '') {
  const value = raw.trim();
  if (/^(true|false)$/i.test(value)) return value.toLowerCase() === 'true';
  if (/^\[.*\]$/.test(value)) {
    return value.slice(1, -1).split(',').map((item) => stripMarkdown(item.trim())).filter(Boolean);
  }
  return stripMarkdown(value);
}

export function parsePersonalMarkdown(filePath) {
  const source = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
  let metaBlock = '';
  let body = '';
  if (source.startsWith('---')) {
    const end = source.indexOf('\n---', 3);
    if (end < 0) throw new Error(`Unclosed frontmatter in ${filePath}`);
    metaBlock = source.slice(3, end);
    body = source.slice(end + 4).replace(/^\r?\n/, '');
  } else {
    const split = source.search(/\r?\n\s*\r?\n/);
    if (split < 0) throw new Error(`Missing metadata block in ${filePath}`);
    metaBlock = source.slice(0, split);
    body = source.slice(split).replace(/^\s+/, '');
  }

  const meta = {};
  let parent = '';
  for (const line of metaBlock.split(/\r?\n/)) {
    const top = line.match(/^([A-Za-z][A-Za-z0-9]*):\s*(.*)$/);
    const child = line.match(/^\s{2,}([A-Za-z][A-Za-z0-9]*):\s*(.*)$/);
    const arrayItem = line.match(/^\s{2,}-\s*(.+)$/);
    if (top) {
      const key = top[1].toLowerCase();
      if (!top[2].trim()) { meta[key] = key === 'topics' ? [] : {}; parent = key; }
      else { meta[key] = parseScalar(top[2]); parent = ''; }
    } else if (child && parent && !Array.isArray(meta[parent])) {
      meta[parent][child[1]] = parseScalar(child[2]);
    } else if (arrayItem && parent && Array.isArray(meta[parent])) {
      meta[parent].push(parseScalar(arrayItem[1]));
    }
  }
  const filename = path.basename(filePath, '.md');
  return { source, body, meta, filename };
}

export function renderInline(value = '') {
  let text = escapeHtml(value);
  text = text.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" rel="noopener noreferrer">$1</a>');
  text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/_([^_]+)_/g, '<em>$1</em>');
  return text;
}

export function renderMarkdown(markdown = '') {
  const lines = markdown.replaceAll('\r\n', '\n').split('\n');
  const out = [];
  let paragraph = [];
  let list = [];
  let listType = '';
  const flushParagraph = () => {
    if (!paragraph.length) return;
    out.push(`<p>${renderInline(paragraph.join(' '))}</p>`);
    paragraph = [];
  };
  const flushList = () => {
    if (!list.length) return;
    out.push(`<${listType}>${list.map((item) => `<li>${renderInline(item)}</li>`).join('')}</${listType}>`);
    list = [];
    listType = '';
  };
  for (const line of lines) {
    const heading = line.match(/^(#{1,4})\s+(.+)$/);
    const bullet = line.match(/^\s*[-*]\s+(.+)$/);
    const ordered = line.match(/^\s*\d+\.\s+(.+)$/);
    const quote = line.match(/^>\s?(.+)$/);
    if (heading) {
      flushParagraph(); flushList();
      const level = Math.min(4, heading[1].length + 1);
      out.push(`<h${level}>${renderInline(heading[2])}</h${level}>`);
    } else if (bullet || ordered) {
      flushParagraph();
      const nextType = bullet ? 'ul' : 'ol';
      if (listType && listType !== nextType) flushList();
      listType = nextType;
      list.push((bullet || ordered)[1]);
    } else if (quote) {
      flushParagraph(); flushList();
      out.push(`<blockquote><p>${renderInline(quote[1])}</p></blockquote>`);
    } else if (!line.trim()) {
      flushParagraph(); flushList();
    } else {
      paragraph.push(line.trim());
    }
  }
  flushParagraph(); flushList();
  return out.join('\n');
}

export function paragraphsToHtml(body = '') {
  return body.split(/\n\s*\n/).filter(Boolean).map((paragraph) => `<p>${renderInline(paragraph.replaceAll('\n', ' '))}</p>`).join('\n');
}

export function formatDate(value) {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`));
}

export function readJson(relativePath, fallback = {}) {
  const fullPath = path.join(ROOT, relativePath);
  return fs.existsSync(fullPath) ? JSON.parse(fs.readFileSync(fullPath, 'utf8')) : fallback;
}

function normalizeBehind(value) {
  if (!value || typeof value !== 'object') return { ...EMPTY_BEHIND, extras: [] };
  const unsupported = Object.keys(value).filter((key) => !['note', 'process', 'extras'].includes(key));
  if (unsupported.length) throw new Error(`Behind the Piece accepts only author-written note, process, and extras fields. Remove: ${unsupported.join(', ')}`);
  return {
    note: typeof value.note === 'string' ? value.note : '',
    process: typeof value.process === 'string' ? value.process : '',
    extras: Array.isArray(value.extras) ? value.extras.filter((item) => typeof item === 'string' && item.trim()) : []
  };
}

export function loadAllWriting() {
  const overrides = readJson('content/personal-metadata.json', {});
  const legacy = Object.keys(overrides).map((slug) => path.join(ROOT, `${slug}.md`)).filter((filePath) => fs.existsSync(filePath));
  const personalDir = path.join(ROOT, 'content', 'personal');
  const managed = fs.existsSync(personalDir) ? fs.readdirSync(personalDir).filter((name) => name.endsWith('.md')).map((name) => path.join(personalDir, name)) : [];
  const personal = [...legacy, ...managed].map((filePath) => {
    const parsed = parsePersonalMarkdown(filePath);
    const extra = overrides[parsed.filename] || {};
    const m = parsed.meta;
    const slug = m.slug || parsed.filename;
    const publication = m.publication || m.publishedon || '';
    return {
      title: m.title,
      subtitle: m.subtitle || '',
      slug,
      date: m.date,
      category: 'Personal',
      publication,
      issueNumber: '',
      cover: m.cover,
      originalUrl: Object.hasOwn(extra, 'originalUrl') ? extra.originalUrl : (m.originalurl || ''),
      subscribeUrl: m.subscribeurl || extra.subscribeUrl || '',
      featured: Boolean(m.featured),
      topics: Array.isArray(m.topics) ? m.topics : (extra.topics || []),
      behindThePiece: normalizeBehind(m.behindthepiece || extra.behindThePiece),
      body: parsed.body,
      bodyHtml: renderMarkdown(parsed.body),
      kind: 'personal',
      sourcePath: path.relative(ROOT, filePath)
    };
  });

  const imported = readJson('content/offscript/issues.json', { issues: [] });
  const notes = readJson('content/offscript/behind-the-piece.json', {});
  const offscript = imported.issues.map((issue) => ({
    ...issue,
    category: 'The OffScript',
    publication: 'The OffScript',
    featured: false,
    subscribeUrl: 'https://theoffscript.page/#join',
    behindThePiece: normalizeBehind(notes[issue.slug]),
    bodyHtml: paragraphsToHtml(issue.body),
    kind: 'offscript'
  }));
  return [...personal, ...offscript].sort((a, b) => b.date.localeCompare(a.date));
}

export function validateWriting(writing) {
  const errors = [];
  const required = ['title', 'subtitle', 'slug', 'date', 'category', 'publication', 'cover', 'featured', 'topics', 'behindThePiece', 'body'];
  const seenSlugs = new Set();
  const seenIssues = new Set();
  const placeholderPattern = /\b(?:todo|coming soon|placeholder|write (?:this|something) here)\b/i;
  const aiPattern = /(?:the piece (?:builds|moves|starts|names)|personal, reflective and conversational|voice:|writing type)/i;
  for (const item of writing) {
    for (const field of required) if (item[field] === undefined || item[field] === null || item[field] === '') errors.push(`${item.slug || item.sourcePath || 'unknown'}: missing ${field}`);
    if (seenSlugs.has(item.slug)) errors.push(`Duplicate slug: ${item.slug}`);
    seenSlugs.add(item.slug);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(item.date || '')) errors.push(`${item.slug}: date must be YYYY-MM-DD`);
    if (!Array.isArray(item.topics) || !item.topics.length) errors.push(`${item.slug}: topics must be a non-empty array`);
    if (!item.cover?.startsWith('/writing/') || !fs.existsSync(path.join(ROOT, 'public', item.cover))) errors.push(`${item.slug}: cover image is missing (${item.cover || 'none'})`);
    if (item.kind === 'offscript') {
      if (!item.issueNumber) errors.push(`${item.slug}: imported OffScript issue has no issue number`);
      if (!item.body?.trim()) errors.push(`${item.slug}: imported OffScript issue has no body`);
      if (!Array.isArray(item.sources) || !item.sources.length) errors.push(`${item.slug}: OffScript issue has no sources`);
      for (const [index, source] of (item.sources || []).entries()) {
        if (!source?.publication?.trim()) errors.push(`${item.slug}: source ${index + 1} has no publication`);
        if (!source?.title?.trim()) errors.push(`${item.slug}: source ${index + 1} has no title`);
        try {
          const url = new URL(source?.url || '');
          if (!['http:', 'https:'].includes(url.protocol)) throw new Error('unsupported protocol');
        } catch {
          errors.push(`${item.slug}: source ${index + 1} has an invalid URL`);
        }
        if (source?.date !== undefined && typeof source.date !== 'string') errors.push(`${item.slug}: source ${index + 1} has an invalid date`);
      }
      if (seenIssues.has(item.issueNumber)) errors.push(`Duplicate OffScript issue: ${item.issueNumber}`);
      seenIssues.add(item.issueNumber);
    }
    const notes = [item.behindThePiece?.note, item.behindThePiece?.process, ...(item.behindThePiece?.extras || [])].filter(Boolean);
    for (const note of notes) {
      if (placeholderPattern.test(note)) errors.push(`${item.slug}: placeholder Behind the Piece content is not allowed`);
      if (aiPattern.test(note)) errors.push(`${item.slug}: possible generated/review-style Behind the Piece content is not allowed`);
    }
  }
  if (errors.length) throw new Error(`Content validation failed:\n${errors.map((error) => `- ${error}`).join('\n')}`);
  return writing;
}
