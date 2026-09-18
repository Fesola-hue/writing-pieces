import fs from 'node:fs';
import path from 'node:path';
import { ROOT, loadAllWriting, validateWriting } from './content.mjs';

const writing = validateWriting(loadAllWriting());
const personal = writing.filter((item) => item.kind === 'personal');
const offscript = writing.filter((item) => item.kind === 'offscript');
const featuredOffscript = offscript.filter((item) => ['001', '002', '003', '004', '005'].includes(item.issueNumber));
const exploreCount = personal.length + featuredOffscript.length;
const errors = [];
const htmlToText = (html) => html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replaceAll('&amp;', '&').replaceAll('&#39;', "'").replaceAll('&quot;', '"').replace(/\s+/g, ' ').trim();
const sourceToText = (body) => body.replace(/^#{1,6}\s+/gm, '').replace(/^>\s?/gm, '').replace(/^\s*[-*]\s+/gm, '').replace(/\*\*|_/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/\s+/g, ' ').trim();
const readOutput = (relativePath) => {
  const output = path.join(ROOT, 'dist', relativePath);
  if (!fs.existsSync(output)) { errors.push(`Missing generated route: ${relativePath}`); return ''; }
  return fs.readFileSync(output, 'utf8');
};

if (personal.length !== 4) errors.push('The Personal collection does not match the approved restored set');
for (const title of ['People Who Made My World a Little Bigger', 'It’s Kinda Chic to Stay Informed', 'So, I Started Dating Myself', 'Hear Me Out: That’s Not What Decentering Men Means']) {
  if (!personal.some((item) => item.title === title)) errors.push(`Personal collection is missing: ${title}`);
}
if (offscript.length !== 5) errors.push('The OffScript collection does not match the approved restored set');
if (writing.length !== personal.length + offscript.length) errors.push('Total collection differs from category totals');
const issueNumbers = offscript.map((item) => item.issueNumber).sort();
if (new Set(issueNumbers).size !== offscript.length) errors.push('An OffScript issue number is duplicated');
if (issueNumbers.join(',') !== '001,002,003,004,005') errors.push(`OffScript must contain exactly Issues 001 to 005, found: ${issueNumbers.join(', ')}`);
const approvedFollowTitles = {
  '001': 'The NYSC Reform Everyone Missed',
  '002': 'The US Visa Squeeze',
  '003': 'The Boom Nobody Can Feel',
  '004': 'Nigeria Uses AI but doesn’t own any of it',
  '005': 'Why Cement Costs So Much'
};
for (const [issueNumber, title] of Object.entries(approvedFollowTitles)) {
  const item = featuredOffscript.find((candidate) => candidate.issueNumber === issueNumber);
  if (item?.followTitle !== title) errors.push(`Issue ${issueNumber} has an incorrect Follow this thought title`);
}

const homepage = readOutput('index.html');
const personalPage = readOutput(path.join('personal', 'index.html'));
const offscriptPage = readOutput(path.join('offscript', 'index.html'));
const explorePage = readOutput(path.join('explore', 'index.html'));

if (!homepage.includes('Personal writing</p>')) errors.push('Homepage Personal gateway label is missing');
if (!homepage.includes('The OffScript</p>') && !homepage.includes('>The OffScript<')) errors.push('Homepage OffScript teaser is missing its label');
if (homepage.includes(`The OffScript · ${offscript.length} issues`)) errors.push('Homepage OffScript teaser should not state a total issue count');
if ((homepage.match(/data-feature-card=/g) || []).length !== 2) errors.push('Homepage should contain exactly two featured cards');
if ((homepage.match(/class="feature-detail"/g) || []).length !== 2) errors.push('Homepage should contain exactly two featured detail panels');
if (!homepage.includes('Two places to begin')) errors.push('Homepage featured label should say “Two places to begin”');
if (!homepage.includes('<span data-feature-current>1</span> of 2')) errors.push('Homepage featured counter should start at 1 of 2');
if (homepage.includes('Select So, I Started Dating Myself')) errors.push('Dating Myself must not remain in the homepage featured stack');
if (!homepage.includes('People Who Made My World a Little Bigger')) errors.push('The featured People Who Made My World title is incorrect');
if (!homepage.includes('Why Cement Costs So Much')) errors.push('Issue 005 must be the OffScript homepage feature');
if (!homepage.includes('Nigeria produces more cement than it needs. So why does buying a bag here cost more than it does in countries that import theirs?')) errors.push('Issue 005 homepage feature description is incorrect');
if (personalPage.toLowerCase().includes(`4 ${'pieces'}`)) errors.push('Personal promotional copy must not include a numeric piece count');
if (offscriptPage.includes(`${offscript.length} issues`)) errors.push('OffScript shelf should not state a total issue count');
if ((personalPage.match(/data-slide="/g) || []).length !== personal.length) errors.push('Personal shelf does not contain every personal piece');
if ((offscriptPage.match(/class="spine"/g) || []).length !== Math.min(5, offscript.length)) errors.push('OffScript shelf should feature exactly 5 curated issues (or fewer if there are under 5)');
for (const issueNumber of ['001', '002', '003', '004', '005']) if (!offscriptPage.includes(`class="spine-num">${issueNumber}</span>`)) errors.push(`OffScript shelf is missing issue ${issueNumber}`);
if (!offscriptPage.includes('I report and explain the stories shaping everyday life in Nigeria, from politics and money to technology and culture.')) errors.push('OffScript introduction is incorrect');
if (offscriptPage.includes('The OffScript is where I ' + 'write about')) errors.push('The old OffScript introduction remains');
if (!explorePage.includes('Choose an idea. Follow the connections between personal observations and reported stories.')) errors.push('Explore introduction is incorrect');
if (!explorePage.includes('data-thought-map') || !explorePage.includes('data-thought-node')) errors.push('Explore route is not interactive');
if ((explorePage.match(/data-thought-node/g) || []).length !== exploreCount) errors.push(`Explore route should contain the ${exploreCount} selected pieces`);

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
  const hasReportingTrail = html.includes('class="reporting-trail');
  if (item.kind === 'offscript' && !hasReportingTrail) errors.push(`${item.slug}: sources and further reading section is absent`);
  if (item.kind === 'personal' && hasReportingTrail) errors.push(`${item.slug}: personal writing must not render a sources section`);
  if (hasReportingTrail && (!html.includes('The reporting, data and documents behind this story.') || html.includes('Undated'))) errors.push(`${item.slug}: reporting trail copy or optional date handling is incorrect`);
  for (const source of item.sources || []) {
    const safeUrl = source.url.replaceAll('&', '&amp;');
    if (!html.includes(`href="${safeUrl}" target="_blank" rel="noopener noreferrer"`)) errors.push(`${item.slug}: source link is absent or unsafe (${source.url})`);
  }
  const relatedSection = html.match(/<section class="related"[\s\S]*?<\/section>/)?.[0] || '';
  const approvedRelated = featuredOffscript.filter((candidate) => relatedSection.includes(`href="/writing/${candidate.slug}/"`) && relatedSection.includes(`>${candidate.followTitle}</a>`));
  if (approvedRelated.length !== 1) errors.push(`${item.slug}: Follow this thought must contain one correctly titled and linked OffScript card`);
}

for (const item of featuredOffscript) {
  const html = readOutput(path.join('writing', item.slug, 'index.html'));
  const relatedSection = html.match(/<section class="related"[\s\S]*?<\/section>/)?.[0] || '';
  const recommended = featuredOffscript.filter((candidate) => relatedSection.includes(`href="/writing/${candidate.slug}/"`) && relatedSection.includes(`>${candidate.followTitle}</a>`));
  if (recommended.length !== 1) errors.push(`${item.slug}: Follow this thought must contain one correctly titled and linked Issue 001-005 card`);
}

const stylesheet = fs.readFileSync(path.join(ROOT, 'public', 'styles.css'), 'utf8');
if (!stylesheet.includes(".article-subtitle { max-width: 36rem") || !stylesheet.includes("clamp(1.05rem, 1.45vw, 1.3rem)/1.5")) errors.push('Article subtitle sizing is not using the approved responsive treatment');
if (!stylesheet.includes(".article-page.is-offscript .article-hero figure { padding: .8rem .8rem 2.8rem; color: var(--ink); background: transparent; box-shadow: none;")) errors.push('OffScript hero image frame removal is missing');
if (!stylesheet.includes(".article-page.is-offscript .article-body p:first-child::first-letter { color: var(--gold); }")) errors.push('OffScript drop cap is not brand gold');
if (!stylesheet.includes(".article-page.is-offscript .article-subscribe { color: var(--ink); background: var(--gold); }")) errors.push('OffScript subscription section is not brand gold');
if (!stylesheet.includes(".site-footer") || !stylesheet.includes("background: var(--ink);")) errors.push('Global footer is not dark');

const generated = [homepage, personalPage, offscriptPage, explorePage, ...writing.map((item) => readOutput(path.join('writing', item.slug, 'index.html')))].join('\n');
const generatedPages = [homepage, personalPage, offscriptPage, explorePage, ...writing.map((item) => readOutput(path.join('writing', item.slug, 'index.html')))];
for (const html of generatedPages) {
  if (!html.includes('href="mailto:contact@aishaonola.me"')) errors.push('A generated page is missing the footer email link');
  if (!html.includes('href="https://www.linkedin.com/in/aishaonola" target="_blank" rel="noopener noreferrer">LinkedIn</a>')) errors.push('A generated page is missing the secure footer LinkedIn link');
  if (!html.includes('href="/Aisha_Onola_Resume.pdf" target="_blank" rel="noopener noreferrer">Résumé</a>')) errors.push('A generated page is missing the secure footer Résumé link');
  if (!html.includes('data-contact-experience') || !html.includes('role="dialog" aria-modal="true"')) errors.push('A generated page is missing the contact room');
  if (!html.includes('action="https://formspree.io/f/mzeblevj" method="post"')) errors.push('A generated page has an incorrect contact endpoint');
  if (!html.includes('name="source" value="read.aishaonola.me"')) errors.push('A generated page is missing the writing-site source field');
  for (const field of ['name', 'email', 'project_type', 'message']) if (!html.includes(`name="${field}"`)) errors.push(`A generated page is missing the ${field} inquiry field`);
}
if ((homepage.match(/data-contact-open/g) || []).length !== 2 || !homepage.includes('data-contact-open>Have a brief?</button>') || !homepage.includes('data-contact-open><span>WORK WITH ME</span><b>Have a brief? ↗</b></button>')) errors.push('Homepage must contain both writing-specific contact entry points');
if ([personalPage, offscriptPage, explorePage].some((html) => html.includes('data-contact-open'))) errors.push('Contact CTA is repeated outside the intended homepage placement');
if (!fs.existsSync(path.join(ROOT, 'dist', 'Aisha_Onola_Resume.pdf'))) errors.push('The cleanly named résumé PDF is absent from the production output');
const permanentTitles = {
  '001': 'The NYSC Reform Everyone Missed',
  '002': 'The US Visa Squeeze',
  '003': 'The Boom Nobody Can Feel',
  '004': 'Nigeria Uses AI but doesn’t own any of it',
  '005': 'Why Cement Costs So Much'
};
for (const [issueNumber, title] of Object.entries(permanentTitles)) {
  const item = offscript.find((candidate) => candidate.issueNumber === issueNumber);
  if (!item || item.title !== title) errors.push(`Issue ${issueNumber} does not use its permanent portfolio title`);
  if (!generated.includes(title)) errors.push(`Issue ${issueNumber} permanent title is absent from generated pages`);
}
const emDash = String.fromCodePoint(0x2014);
const emDashEntities = ['&' + 'mdash;', '&#' + '8212;', '&#x' + '2014;', '&#X' + '2014;', '\\u' + '2014'];
const hasDecorativeEmoji = (text) => [...text].some((character) => {
  const point = character.codePointAt(0);
  return (point >= 0x1f000 && point <= 0x1faff) || (point >= 0x2600 && point <= 0x27bf) || point === 0xfe0f || point === 0x20e3;
});
const visibleBodies = [homepage, personalPage, offscriptPage, explorePage, ...writing.map((item) => readOutput(path.join('writing', item.slug, 'index.html')))].map((html) => html.match(/<body[\s\S]*<\/body>/i)?.[0] || '').join('\n');
if (visibleBodies.includes(emDash) || emDashEntities.some((entity) => visibleBodies.toLowerCase().includes(entity.toLowerCase()))) errors.push('Visible website copy contains an em dash or encoded em-dash entity');
if (hasDecorativeEmoji(generated)) errors.push('Generated website contains a decorative emoji');
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
for (const hook of ['fetch(form.action', 'new FormData(form)', "event.key === 'Escape'", 'element.inert = true', 'window.scrollTo(0, savedScrollY)', 'submittedSuccessfully']) if (!clientScript.includes(hook)) errors.push(`Contact behavior hook is absent: ${hook}`);
if (!fs.existsSync(path.join(ROOT, 'dist', 'sitemap.xml'))) errors.push('Sitemap was not built');

if (errors.length) {
  console.error(`Checks failed (${errors.length}):\n${errors.map((error) => `- ${error}`).join('\n')}`);
  process.exit(1);
}
console.log('Checks passed: restored content, collection routes, article routes, shelves, Explore map, author-only hidden notes, metadata, structured data, sitemap, keyboard and reduced-motion hooks.');

