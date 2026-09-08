import fs from 'node:fs';
import path from 'node:path';
import { ROOT, SITE_URL, escapeHtml, formatDate, loadAllWriting, validateWriting } from './content.mjs';

const dist = path.join(ROOT, 'dist');
const writing = validateWriting(loadAllWriting());
const personal = writing.filter((item) => item.kind === 'personal');
const offscript = writing.filter((item) => item.kind === 'offscript').sort((a, b) => a.issueNumber.localeCompare(b.issueNumber));
const featuredOffscript = offscript.filter((item) => ['001', '002', '003', '004', '005'].includes(item.issueNumber));
const exploreWriting = [...personal, ...featuredOffscript];
const featured = [personal.find((item) => item.slug === 'people-who-made-my-world'), featuredOffscript.find((item) => item.issueNumber === '005')].filter(Boolean);
const featuredDescriptions = {
  'offscript-005-we-make-enough-cement-to-export-it-so-why-is-a-bag-still-13-000': 'Nigeria produces more cement than it needs. So why does buying a bag here cost more than it does in countries that import theirs?'
};

const themeCounts = new Map();
exploreWriting.forEach((item) => item.topics.forEach((topic) => themeCounts.set(topic, (themeCounts.get(topic) || 0) + 1)));
const themeOrder = ['Nigeria', 'Systems', 'Everyday life', 'Identity', 'Work', 'Money', 'Technology', 'Culture', 'Belonging', 'People', 'Internet feminism', 'Internet culture', 'Information', 'Self-knowledge', 'Housing', 'Ownership', 'Mobility', 'Education'];
const topThemes = themeOrder.filter((theme) => themeCounts.has(theme)).sort((a, b) => themeCounts.get(b) - themeCounts.get(a));
const exploreThemes = ['Nigeria', 'Systems', 'Identity', 'Money', 'Everyday life'].filter((theme) => themeCounts.has(theme));
const spineText = (title, max = 34) => title.length > max ? `${title.slice(0, max - 1).trimEnd()}…` : title;

const excerptBySlug = {
  'people-who-made-my-world': 'Maybe where you live isn’t the only environment that raises you.',
  'so-i-started-dating-myself': 'So, I decided to date myself.',
  'it-kinda-chic-to-stay': 'Because there is a huge world outside our feeds.',
  'that-not-what-decentering-men': 'Maybe it’s to have a spine of your own.'
};

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const source = path.join(from, entry.name);
    const target = path.join(to, entry.name);
    entry.isDirectory() ? copyDir(source, target) : fs.copyFileSync(source, target);
  }
}

const internal = (item) => `/writing/${item.slug}/`;
const absolute = (pathname) => `${SITE_URL}${pathname}`;
const categoryClass = (item) => item.kind === 'offscript' ? 'is-offscript' : 'is-personal';
const excerpt = (item) => excerptBySlug[item.slug] || item.body.split(/(?<=[.!?])\s+/)[0].replaceAll('\n', ' ').trim();
const pad = (number, length = 2) => String(number).padStart(length, '0');

function head({ title, description, pathname = '/', canonical, image = '/writing/people-who-made-my-world.jpeg', type = 'website', schema }) {
  const pageTitle = `${title} | Aisha Onola`;
  const pageUrl = absolute(pathname);
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#f6efe4">
  <link rel="icon" href="data:,">
  <title>${escapeHtml(pageTitle)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="author" content="Aisha Onola">
  <link rel="canonical" href="${escapeHtml(canonical || pageUrl)}">
  <meta property="og:type" content="${type}">
  <meta property="og:site_name" content="Aisha Onola | Writing">
  <meta property="og:title" content="${escapeHtml(pageTitle)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:url" content="${escapeHtml(pageUrl)}">
  <meta property="og:image" content="${escapeHtml(absolute(image))}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(pageTitle)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${escapeHtml(absolute(image))}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,500;12..96,600;12..96,700;12..96,800&family=Instrument+Serif:ital@0;1&family=Instrument+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&family=Caveat:wght@600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/styles.css">
  <script src="/site.js" defer></script>${schema ? `
  <script type="application/ld+json">${JSON.stringify(schema).replaceAll('<', '\\u003c')}</script>` : ''}
</head>`;
}

function nav(active) {
  const items = [['home', '/', 'Home'], ['personal', '/personal/', 'Personal'], ['offscript', '/offscript/', 'The OffScript'], ['explore', '/explore/', 'Explore']];
  return `<a class="skip-link" href="#main">Skip to content</a>
<header class="site-header">
  <a class="wordmark" href="https://aishaonola.me" aria-label="A. Onola, main website">A. Onola</a>
  <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="site-nav"><span>Menu</span><i aria-hidden="true"></i></button>
  <nav id="site-nav" aria-label="Primary navigation">${items.map(([key, href, label]) => `<a href="${href}"${active === key ? ' class="active" aria-current="page"' : ''}>${label}</a>`).join('')}<a href="https://aishaonola.me/#about">About</a></nav>
</header>`;
}

function footer() {
  return `<footer class="site-footer"><div><a class="footer-name" href="https://aishaonola.me">Aisha Onola</a><p>Writer in Lagos.</p><a class="footer-email" href="mailto:contact@aishaonola.me">contact@aishaonola.me</a></div><a class="back-top" href="#top">Back to top ↑</a></footer>`;
}

function page({ active, body, bodyClass = '', ...meta }) {
  return `${head(meta)}<body id="top" class="${bodyClass}" data-route="${active}"><div class="route-wipe" aria-hidden="true"></div><div class="grain" aria-hidden="true"></div>${nav(active)}<main id="main">${body}</main>${footer()}</body></html>`;
}

function featuredPair() {
  return `<section class="featured-lobby wrap" aria-labelledby="featured-heading" data-featured-pair>
  <div class="section-title"><p class="eyebrow">Two places to begin</p><h2 id="featured-heading">Start with a story worth staying for.</h2></div>
  <div class="feature-stage">
    <div class="feature-stack" role="group" aria-label="Choose one of two featured stories">${featured.map((item, index) => `<article class="feature-card ${index === 0 ? 'is-selected' : ''}" data-feature-card="${index}" style="--feature-offset:${index === 0 ? 0 : 1}"><button id="feature-select-${index}" type="button" class="feature-select" aria-pressed="${index === 0}" aria-controls="feature-detail-${index}" aria-label="Select ${escapeHtml(item.title)}"><img src="${item.cover}" alt="Cover image for ${escapeHtml(item.title)}"><span>${pad(index + 1)}</span></button></article>`).join('')}</div>
    <div class="feature-details">${featured.map((item, index) => `<article id="feature-detail-${index}" class="feature-detail" aria-labelledby="feature-select-${index}" ${index === 0 ? '' : 'hidden'}><p class="mono-label">Featured · ${item.kind === 'offscript' ? `The OffScript · Issue ${item.issueNumber}` : 'Personal'}</p><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(featuredDescriptions[item.slug] || item.subtitle)}</p><a class="button button-dark" href="${internal(item)}">Read the story →</a></article>`).join('')}
      <div class="deck-controls"><button type="button" data-feature-move="-1" aria-label="Previous featured story">←</button><p aria-live="polite"><span data-feature-current>1</span> of ${featured.length}</p><button type="button" data-feature-move="1" aria-label="Next featured story">→</button></div>
    </div>
  </div>
</section>`;
}

function gateways() {
  const personalCovers = personal.slice(0, 3);
  const issueCovers = [...featuredOffscript].reverse().slice(0, 4);
  return `<section class="gateways wrap" aria-labelledby="gateway-heading"><div class="section-title compact"><p class="eyebrow">Choose a shelf</p><h2 id="gateway-heading">Two ways into the work.</h2></div><div class="gateway-grid">
    <a class="gateway gateway-personal" href="/personal/"><div class="gateway-covers" aria-hidden="true">${personalCovers.map((item, index) => `<img src="${item.cover}" alt="" style="--i:${index}">`).join('')}</div><div class="gateway-copy"><p class="mono-label">Personal writing</p><h3>Small observations that kept getting bigger.</h3><p>Essays about identity, people, work, culture, and figuring things out in public.</p><span>Enter Personal Writing <i aria-hidden="true">→</i></span></div></a>
    <a class="gateway gateway-offscript" href="/offscript/"><div class="issue-fan" aria-hidden="true">${issueCovers.map((item, index) => `<span class="mini-spine" style="--i:${index}">${escapeHtml(spineText(item.title, 16))}</span>`).join('')}</div><div class="gateway-copy"><p class="mono-label">The OffScript</p><h3>Start with the headline. Stay for what it means.</h3><p>Reported stories about Nigeria, money, technology, and the systems beneath ordinary life.</p><span>Open The OffScript shelf <i aria-hidden="true">→</i></span></div></a>
  </div></section>`;
}

function compactSubscribe() {
  return `<section class="compact-subscribe"><div class="wrap"><div><p class="eyebrow">Keep the tab open</p><h2>Like the way I write?</h2></div><div class="subscribe-options"><a href="https://aishaonola.medium.com/"><span>Personal writing</span><b>Follow on Medium ↗</b></a><a href="https://aishaonola.substack.com/"><span>Personal writing</span><b>Read on Substack ↗</b></a><a href="https://theoffscript.page/#join"><span>The OffScript</span><b>Subscribe free ↗</b></a></div></div></section>`;
}

function writerSection() {
  return `<section class="writer-section reveal" aria-labelledby="writer-section-heading"><div class="wrap writer-section-inner"><header class="writer-section-heading"><p class="eyebrow">Behind the writing</p><h2 id="writer-section-heading">Aisha Onola</h2></header><div class="writer-section-copy"><p>I&#8217;m a writer in Lagos, and I tend to write about the things I&#8217;m trying to understand: how systems affect ordinary people, what money changes, what culture tells us about ourselves, and sometimes, what it feels like to be a person figuring life out in real time.</p><p>I&#8217;m also the founder and editor of The OffScript, where I write and build stories for young Nigerians around politics, money, technology and culture.</p><nav class="writer-links" aria-label="More about Aisha"><a href="https://aishaonola.me/#about">More about me →</a><a href="mailto:contact@aishaonola.me">Get in touch →</a></nav></div></div></section>`;
}

function threadCluster(limit = 8) {
  const shown = topThemes.slice(0, limit);
  return `<div class="thread-cluster reveal-stagger" aria-label="Recurring ideas across the writing">${shown.map((theme, index) => `<span style="--i:${index}">${escapeHtml(theme)}</span>`).join('')}</div>`;
}

function homePage() {
  const body = `<section class="lobby-hero"><div><p class="eyebrow">Writing</p><h1>Things I’ve <span class="edited-word"><s>said</s><em>written.</em><svg viewBox="0 0 310 24" aria-hidden="true"><path d="M4 16c74-8 178-11 302-7"/></svg></span></h1><p class="intro">The words I keep coming back to, whatever I'm writing about.</p>${threadCluster()}<a class="choose-start thread-link" href="/explore/">Follow a thread <span aria-hidden="true">→</span></a></div></section>
  <div class="reveal">${featuredPair()}</div>
  ${writerSection()}
  <div class="reveal">${gateways()}</div>
  ${compactSubscribe()}`;
  const schema = { '@context': 'https://schema.org', '@type': 'WebSite', name: 'Aisha Onola | Writing', url: SITE_URL, author: { '@type': 'Person', name: 'Aisha Onola', url: 'https://aishaonola.me' } };
  return page({ active: 'home', title: 'Things I’ve written.', description: 'Personal essays, observations, and stories about Nigeria, culture, work, identity, and the internet.', pathname: '/', schema, bodyClass: 'home-page', body });
}

function personalShelfPage() {
  const shelf = `<section class="collection-hero personal-collection reveal"><div class="wrap collection-hero-inner"><div><p class="eyebrow">Personal writing</p><h1>The things that get personal.</h1></div><div class="collection-intro"><p>Some things make more sense to me once I write them down. These are the pieces where I turn the questions inward: identity, people, growing up, relationships, self-perception, and the small experiences that quietly change how I understand myself.</p><a class="collection-cta" href="#personal-shelf-heading">Browse the essays ↓</a></div></div></section>
  <section class="personal-shelf wrap reveal" aria-labelledby="personal-shelf-heading" data-shelf="personal" tabindex="0"><div class="shelf-heading"><h2 id="personal-shelf-heading">The essay shelf</h2><div class="view-toggle" role="group" aria-label="Choose shelf view"><button type="button" class="active" data-view="shelf" aria-pressed="true">Shelf view</button><button type="button" data-view="list" aria-pressed="false">List view</button></div></div>
  <div class="shelf-experience"><div class="personal-deck" data-deck>${personal.map((item, index) => `<button type="button" class="personal-cover ${index === 0 ? 'is-selected' : ''}" data-slide="${index}" aria-pressed="${index === 0}" aria-controls="personal-detail-${index}" style="--i:${index}"><img src="${item.cover}" alt="Cover image for ${escapeHtml(item.title)}"><span>${pad(index + 1)}</span></button>`).join('')}</div>
  <div class="shelf-detail">${personal.map((item, index) => `<article id="personal-detail-${index}" data-slide-panel="${index}" ${index === 0 ? '' : 'hidden'}><p class="mono-label">${escapeHtml(formatDate(item.date))} · ${escapeHtml(item.publication)}</p><h3>${escapeHtml(item.title)}</h3><p class="detail-subtitle">${escapeHtml(item.subtitle)}</p><blockquote>“${escapeHtml(excerpt(item))}”</blockquote><a class="button button-wine" href="${internal(item)}">Read the story →</a></article>`).join('')}<div class="deck-controls"><button type="button" data-shelf-move="-1" aria-label="Previous personal story">←</button><p aria-live="polite"><span data-shelf-current>1</span> / ${pad(personal.length)}</p><button type="button" data-shelf-move="1" aria-label="Next personal story">→</button></div></div></div>
  <div class="personal-list" hidden>${personal.map((item, index) => `<article><span>${pad(index + 1)}</span><div><p>${escapeHtml(formatDate(item.date))}</p><h3><a href="${internal(item)}">${escapeHtml(item.title)}</a></h3><p>${escapeHtml(item.subtitle)}</p></div><a href="${internal(item)}" aria-label="Read ${escapeHtml(item.title)}">→</a></article>`).join('')}</div></section>`;
  return page({ active: 'personal', title: 'Personal writing', description: `${personal.length} personal essays and observations by Aisha Onola.`, pathname: '/personal/', bodyClass: 'personal-page', body: shelf });
}

function offscriptShelfPage() {
  const latestFirst = [...featuredOffscript].reverse();
  const spineColors = [['var(--wine)', 'var(--cream)'], ['var(--blue-deep)', 'var(--blue-pale)'], ['var(--gold)', 'var(--ink)'], ['var(--ink)', 'var(--cream)'], ['var(--wine-deep)', 'var(--gold)']];
  const featuredIssues = latestFirst;
  const remaining = offscript.length - featuredIssues.length;
  const body = `<section class="collection-hero offscript-hero reveal"><div class="wrap collection-hero-inner"><div><p class="eyebrow">The OffScript · Issues 001 to 005</p><h1>Trying to make sense of the bigger picture.</h1></div><div class="collection-intro"><p>I report and explain the stories shaping everyday life in Nigeria, from politics and money to technology and culture.</p><a class="collection-cta" href="#spine-heading">Browse the issues ↓</a></div></div></section>
  <section class="spine-section wrap reveal" aria-labelledby="spine-heading"><div class="shelf-heading"><h2 id="spine-heading">A few issues to start with</h2></div>
  <div class="spine-shelf reveal-stagger">${featuredIssues.map((item, index) => { const [bg, fg] = spineColors[index % spineColors.length]; return `<a class="spine" href="${internal(item)}" style="--spine-bg:${bg};--spine-fg:${fg}" title="${escapeHtml(item.title)}"><span class="spine-num">${item.issueNumber}</span><span class="spine-title">${escapeHtml(spineText(item.title))}</span></a>`; }).join('')}</div>
  ${remaining > 0 ? `<div class="spine-nudge"><a class="button button-blue" href="https://theoffscript.page/">Read more issues on The OffScript ↗</a></div>` : ''}
  </section>`;
  return page({ active: 'offscript', title: 'The OffScript shelf', description: `${featuredIssues.length} featured OffScript issues by Aisha Onola, with the full archive on theoffscript.page.`, pathname: '/offscript/', image: featuredIssues[0].cover, bodyClass: 'offscript-page', body });
}

function explorePage() {
  const preferred = exploreThemes;
  const themes = preferred.filter((theme) => themeCounts.has(theme));
  const initial = themes.includes('Nigeria') ? 'Nigeria' : themes[0];
  const body = `<section class="explore-hero wrap reveal"><p class="eyebrow">Explore · ${exploreWriting.length} connected pieces</p><h1>Follow the thought.</h1><p>Choose an idea. The map connects four personal essays with five featured OffScript issues: personal observations in burgundy and reported stories in blue.</p></section>
  <section class="thought-map wrap reveal" aria-labelledby="thought-map-heading" data-thought-map data-initial-theme="${escapeHtml(initial.toLowerCase())}"><h2 id="thought-map-heading" class="sr-only">Recurring themes across the writing</h2><div class="theme-picker" role="group" aria-label="Choose a recurring theme">${themes.map((theme) => `<button type="button" data-theme="${escapeHtml(theme.toLowerCase())}" aria-pressed="${theme === initial}"><span>${escapeHtml(theme)}</span><small>${themeCounts.get(theme)}</small></button>`).join('')}</div>
  <div class="map-canvas"><svg class="map-lines" aria-hidden="true"></svg><div class="theme-hub"><span>Following</span><strong data-theme-label>${escapeHtml(initial)}</strong></div><div class="thought-nodes">${exploreWriting.map((item, index) => `<article class="thought-node ${categoryClass(item)}" data-thought-node data-topics="${escapeHtml(item.topics.join('|').toLowerCase())}" style="--node:${index}"><p>${item.kind === 'offscript' ? `Issue ${item.issueNumber}` : 'Personal'}</p><h3><a href="${internal(item)}">${escapeHtml(item.title)}</a></h3><blockquote>“${escapeHtml(excerpt(item))}”</blockquote><div>${item.topics.map((topic) => `<span>${escapeHtml(topic)}</span>`).join('')}</div></article>`).join('')}</div></div>
  <p class="map-status" aria-live="polite"><span data-map-count></span> pieces connected to <strong data-status-theme>${escapeHtml(initial)}</strong>.</p></section>`;
  return page({ active: 'explore', title: 'Explore the ideas', description: `Explore recurring ideas across ${exploreWriting.length} connected pieces by Aisha Onola.`, pathname: '/explore/', bodyClass: 'explore-page', body });
}

function behindPiece(item) {
  const notes = [];
  if (item.behindThePiece.note) notes.push(['note', 'Why I wrote this', item.behindThePiece.note]);
  if (item.behindThePiece.process) notes.push(['process', 'How I approached it', item.behindThePiece.process]);
  if (item.behindThePiece.extras?.length) notes.push(['extras', 'Notes I kept', item.behindThePiece.extras]);
  if (!notes.length) return '';
  return `<section class="behind-piece" data-behind><button class="behind-toggle" type="button" aria-expanded="false" aria-controls="behind-${item.slug}"><span class="handwritten">Open my notes</span><strong>Behind the piece</strong><i aria-hidden="true">+</i></button><div class="behind-drawer" id="behind-${item.slug}" hidden>${notes.map(([key, label, value]) => `<section><h3>${label}</h3>${Array.isArray(value) ? `<ul>${value.map((entry) => `<li>${escapeHtml(entry)}</li>`).join('')}</ul>` : `<p>${escapeHtml(value)}</p>`}</section>`).join('')}</div></section>`;
}

function relatedFor(item) {
  const score = (candidate) => candidate.topics.filter((topic) => item.topics.includes(topic)).length;
  const best = (kind) => writing.filter((candidate) => candidate.kind === kind && candidate.slug !== item.slug && (kind !== 'offscript' || ['001', '002', '003', '004', '005'].includes(candidate.issueNumber))).sort((a, b) => score(b) - score(a) || b.date.localeCompare(a.date))[0];
  return [best('personal'), best('offscript')].filter(Boolean);
}

function articlePage(item) {
  const canonical = item.originalUrl || absolute(internal(item));
  const related = relatedFor(item).map((candidate) => candidate.kind === 'offscript' && candidate.followTitle ? { ...candidate, title: candidate.followTitle } : candidate);
  const originalLabel = item.kind === 'offscript' ? 'The OffScript' : item.publication;
  const subscribe = item.kind === 'offscript' ? `<a class="button button-blue" href="${item.subscribeUrl}">Subscribe to The OffScript ↗</a><a class="text-link" href="/personal/">Explore personal writing →</a>` : `<a class="button button-cream" href="${item.subscribeUrl}">${item.publication === 'Medium' ? 'Follow on Medium' : 'Read on Substack'} ↗</a><a class="text-link" href="/offscript/">Explore The OffScript →</a>`;
  const body = `<div class="reading-progress" aria-hidden="true"><i></i></div><header class="article-hero"><div class="article-hero-copy"><a class="back-link" href="/${item.kind === 'offscript' ? 'offscript' : 'personal'}/">← Back to the shelf</a><p class="article-kicker">${item.kind === 'offscript' ? `The OffScript · Issue ${item.issueNumber}` : 'Personal writing'}</p><h1>${escapeHtml(item.title)}</h1><p class="article-subtitle">${escapeHtml(item.subtitle)}</p><div class="article-meta"><time datetime="${item.date}">${escapeHtml(formatDate(item.date))}</time>${item.originalUrl ? `<span aria-hidden="true">•</span><a href="${escapeHtml(item.originalUrl)}">Originally published in ${escapeHtml(originalLabel)} ↗</a>` : `<span aria-hidden="true">•</span><span>${escapeHtml(item.publication)}</span>`}</div></div><figure><img src="${item.cover}" alt="${escapeHtml(item.kind === 'offscript' ? `Cover for The OffScript issue ${item.issueNumber}: ${item.title}` : `Cover image for ${item.title}`)}"><figcaption>${item.kind === 'offscript' ? `The OffScript · Issue ${item.issueNumber}` : escapeHtml(item.publication)}</figcaption></figure></header>
  <div class="article-layout"><article class="article-body">${item.bodyHtml}</article><aside class="article-aside"><p>${item.kind === 'offscript' ? `ISSUE ${item.issueNumber}` : 'PERSONAL'}</p><span>${escapeHtml(item.topics.join(' · '))}</span></aside></div>
  <div class="article-after wrap-narrow reveal">${behindPiece(item)}${item.originalUrl ? `<div class="original-cta"><p>Originally published in ${escapeHtml(originalLabel)}</p><a class="button ${item.kind === 'offscript' ? 'button-blue' : 'button-dark'}" href="${escapeHtml(item.originalUrl)}">Read the original on ${escapeHtml(originalLabel)} ↗</a></div>` : ''}<section class="related" aria-labelledby="related-heading"><p class="eyebrow">Keep following it</p><h2 id="related-heading">Follow this thought</h2><div class="reveal-stagger">${related.map((candidate) => `<article class="${categoryClass(candidate)}"><p>${candidate.kind === 'offscript' ? `The OffScript · Issue ${candidate.issueNumber}` : 'Personal writing'}</p><h3><a href="${internal(candidate)}">${escapeHtml(candidate.title)}</a></h3><div class="topic-row">${candidate.topics.filter((topic) => item.topics.includes(topic)).map((topic) => `<span>${escapeHtml(topic)}</span>`).join('')}</div><a class="read-link" href="${internal(candidate)}">Read the story →</a></article>`).join('')}</div></section></div>
  <section class="article-subscribe reveal"><div><h2>${item.kind === 'offscript' ? 'Stay in tune.' : 'More personal writing?'}</h2><p>${item.kind === 'offscript' ? 'One weekly email explaining the stories shaping everyday life in Nigeria.' : 'Essays and observations about identity, people, work, and culture.'}</p>${subscribe}</div></section>`;
  const schema = { '@context': 'https://schema.org', '@type': item.kind === 'offscript' ? 'NewsArticle' : 'Article', headline: item.title, description: item.subtitle, image: absolute(item.cover), datePublished: item.date, author: { '@type': 'Person', name: 'Aisha Onola', url: 'https://aishaonola.me' }, publisher: { '@type': 'Organization', name: item.publication }, mainEntityOfPage: canonical, isAccessibleForFree: true };
  return page({ active: item.kind === 'offscript' ? 'offscript' : 'personal', title: item.title, description: item.subtitle, pathname: internal(item), canonical, image: item.cover, type: 'article', schema, bodyClass: `article-page ${categoryClass(item)}`, body });
}

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });
copyDir(path.join(ROOT, 'public'), dist);
const routes = [['index.html', homePage()], ['personal/index.html', personalShelfPage()], ['offscript/index.html', offscriptShelfPage()], ['explore/index.html', explorePage()]];
for (const [relativePath, html] of routes) {
  const output = path.join(dist, relativePath);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, html, 'utf8');
}
for (const item of writing) {
  const articleDir = path.join(dist, 'writing', item.slug);
  fs.mkdirSync(articleDir, { recursive: true });
  fs.writeFileSync(path.join(articleDir, 'index.html'), articlePage(item), 'utf8');
}
const sitemapPaths = ['/', '/personal/', '/offscript/', '/explore/', ...writing.map(internal)];
fs.writeFileSync(path.join(dist, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapPaths.map((pathname) => `  <url><loc>${absolute(pathname)}</loc></url>`).join('\n')}\n</urlset>\n`, 'utf8');
fs.writeFileSync(path.join(dist, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${SITE_URL}/sitemap.xml\n`, 'utf8');
console.log(`Built 4 collection routes + ${writing.length} internal article pages from ${personal.length} personal pieces and ${offscript.length} OffScript issues.`);

