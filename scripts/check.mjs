import fs from 'node:fs';
import path from 'node:path';
import { ROOT, loadAllWriting, validateWriting } from './content.mjs';

const writing = validateWriting(loadAllWriting());
const personal = writing.filter((item) => item.kind === 'personal');
const offscript = writing.filter((item) => item.kind === 'offscript');
const errors = [];
const htmlToText = (html) => html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replaceAll('&amp;', '&').replaceAll('&#39;', "'").replaceAll('&quot;', '"').replace(/\s+/g, ' ').trim();
const sourceToText = (body) => body.replace(/^#{1,6}\s+/gm, '').replace(/^>\s?/gm, '').replace(/^\s*[-*]\s+/gm, '').replace(/\*\*|_/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/\s+/g, ' ').trim();
const readOutput = (relativePath) => {
  const output = path.join(ROOT, 'dist', relativePath);
  if (!fs.existsSync(output)) { errors.push(`Missing generated route: ${relativePath}`); return ''; }
  return fs.readFileSync(output, 'utf8');
};

if (personal.length !== 4) errors.push(`Expected 4 personal pieces, found ${personal.length}`);
if (offscript.length !== 7) errors.push(`Expected 7 OffScript issues, found ${offscript.length}`);
if (writing.length !== personal.length + offscript.length) errors.push('Total collection differs from category totals');
const issueNumbers = offscript.map((item) => item.issueNumber).sort();
if (new Set(issueNumbers).size !== offscript.length) errors.push('An OffScript issue number is duplicated');

const homepage = readOutput('index.html');
const personalPage = readOutput(path.join('personal', 'index.html'));
const offscriptPage = readOutput(path.join('offscript', 'index.html'));
const explorePage = readOutput(path.join('explore', 'index.html'));

if (!homepage.includes(`Personal writing · ${personal.length} pieces`)) errors.push('Homepage personal count differs from the validated collection');
if (!homepage.includes(`The OffScript · ${offscript.length} issues`)) errors.push('Homepage OffScript count differs from the validated collection');
if ((homepage.match(/href="\/writing\//g) || []).length !== 2) errors.push('Homepage should link only the two featured pieces, not render the complete archive');
if (!personalPage.includes(`Personal writing · ${personal.length} pieces`)) errors.push('Personal shelf count differs from collection');
if (!offscriptPage.includes(`The OffScript · ${offscript.length} issues`)) errors.push('OffScript shelf count differs from collection');
if ((personalPage.match(/data-slide="/g) || []).length !== personal.length) errors.push('Personal shelf does not contain every personal piece');
if ((offscriptPage.match(/class="issue-cover/g) || []).length !== offscript.length) errors.push('OffScript shelf does not contain every issue');
if (!explorePage.includes('data-thought-map') || !explorePage.includes('data-thought-node')) errors.push('Explore route is not interactive');
if ((explorePage.match(/data-thought-node/g) || []).length !== writing.length) errors.push('Explore route does not contain every piece');

for (const item of writing) {
  const html = readOutput(path.join('writing', item.slug, 'index.html'));
  if (!html) continue;
  if (!htmlToText(html).includes(sourceToText(item.body))) errors.push(`${item.slug}: complete article body is not present`);
  if (item.originalUrl && !html.includes(`href="${item.originalUrl.replaceAll('&', '&amp;')}"`)) errors.push(`${item.slug}: original publication link is absent`);
  const hasNotes = Boolean(item.behindThePiece.note || item.behindThePiece.process || item.behindThePiece.extras.length);
  if (hasNotes !== html.includes('class="behind-piece"')) errors.push(`${item.slug}: Behind the Piece visibility does not match author-written content`);
  if (!html.includes('Follow this thought')) errors.push(`${item.slug}: related-writing section is absent`);
  if ((html.match(/class="is-personal"/g) || []).length < 1 || (html.match(/class="is-offscript"/g) || []).length < 1) errors.push(`${item.slug}: related writing must include one personal and one OffScript piece`);
  if (!html.includes('application/ld+json')) errors.push(`${item.slug}: structured article data is absent`);
}

const generated = [homepage, personalPage, offscriptPage, explorePage, ...writing.map((item) => readOutput(path.join('writing', item.slug, 'index.html')))].join('\n');
const forbidden = [
  'Personal, reflective and conversational',
  'The piece builds its perspective',
  'Type of writing',
  'What sparked it',
  'Coming soon',
  'TODO',
  'placeholder prose'
];
for (const phrase of forbidden) if (generated.toLowerCase().includes(phrase.toLowerCase())) errors.push(`Forbidden generated or placeholder Behind the Piece text remains: ${phrase}`);
if (generated.includes('class="behind-piece"')) errors.push('No author-written Behind the Piece notes exist, so all sections must be hidden');
if (!generated.includes('prefers-reduced-motion') && !fs.readFileSync(path.join(ROOT, 'public', 'styles.css'), 'utf8').includes('prefers-reduced-motion')) errors.push('Reduced-motion support is absent');
if (!fs.readFileSync(path.join(ROOT, 'public', 'site.js'), 'utf8').includes("event.key === 'ArrowRight'")) errors.push('Keyboard arrow navigation is absent');
const clientScript = fs.readFileSync(path.join(ROOT, 'public', 'site.js'), 'utf8');
if (!clientScript.includes("addEventListener('touchstart'") || !clientScript.includes("addEventListener('touchend'")) errors.push('Touch shelf navigation is absent');
if (!clientScript.includes('route-leaving')) errors.push('Route transition handling is absent');
if (!fs.existsSync(path.join(ROOT, 'dist', 'sitemap.xml'))) errors.push('Sitemap was not built');

if (errors.length) {
  console.error(`Checks failed (${errors.length}):\n${errors.map((error) => `- ${error}`).join('\n')}`);
  process.exit(1);
}
console.log(`Checks passed: ${personal.length} personal + ${offscript.length} OffScript = ${writing.length} unique pieces; 4 collection routes; ${writing.length} complete article routes; dynamic counts; shelves; Explore map; author-only hidden notes; schema; sitemap; keyboard and reduced-motion hooks.`);
