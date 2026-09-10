import fs from 'node:fs';
import path from 'node:path';
import { ROOT, slugify } from './content.mjs';

const ARCHIVE_URL = 'https://theoffscript.page/archive';
const outputDir = path.join(ROOT, 'content', 'offscript');
const outputPath = path.join(outputDir, 'issues.json');
const imageDir = path.join(ROOT, 'public', 'writing');
const dryRun = process.argv.includes('--dry-run');
const portfolioIssueNumbers = new Set(['001', '002', '003', '004', '005']);

// Permanent display titles for Issues 001-005 on Aisha's personal site.
// The publication headlines remain available through each issue's originalUrl.
const portfolioTitles = {
  '001': 'The NYSC Reform Everyone Missed',
  '002': 'The US Visa Squeeze',
  '003': 'The Boom Nobody Can Feel',
  '004': 'Nigeria Uses AI but doesn’t own any of it',
  '005': 'Why Cement Costs So Much'
};

const followTitles = {
  '001': 'The NYSC Reform Everyone Missed',
  '002': 'The US Visa Squeeze',
  '003': 'The Boom Nobody Can Feel',
  '004': 'Nigeria Uses AI but doesn’t own any of it',
  '005': 'Why Cement Costs So Much'
};

const topicMap = {
  '001': ['Nigeria', 'Work', 'Identity', 'Culture', 'Systems'],
  '002': ['Nigeria', 'Mobility', 'Education', 'Systems'],
  '003': ['Nigeria', 'Money', 'Everyday life', 'Systems'],
  '004': ['Nigeria', 'Technology', 'Ownership', 'Money', 'Systems'],
  '005': ['Nigeria', 'Money', 'Housing', 'Everyday life', 'Systems']
};

function jsonLdDocuments(html) {
  return [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
    .map((match) => {
      try { return JSON.parse(match[1].replaceAll('&quot;', '"').replaceAll('&amp;', '&')); }
      catch { return null; }
    }).filter(Boolean);
}

async function getText(url) {
  const response = await fetch(url, { headers: { 'user-agent': 'AishaWritingSync/1.0 (+https://read.aishaonola.me)' } });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText} for ${url}`);
  return response.text();
}

function localCover(issueNumber, html) {
  const existing = fs.readdirSync(imageDir).find((name) => name.startsWith(`issue-${issueNumber}-`));
  if (existing) return { cover: `/writing/${existing}`, remote: '' };
  const preload = html.match(/<link[^>]+rel=["']preload["'][^>]+as=["']image["'][^>]+href=["']([^"']+)["']/i)
    || html.match(/<img[^>]+src=["'](\/issues\/[^"']+)["']/i);
  if (!preload) return { cover: '', remote: '' };
  const remote = new URL(preload[1], 'https://theoffscript.page').href;
  return { cover: `/writing/${path.basename(new URL(remote).pathname)}`, remote };
}

async function downloadCover(remote, cover) {
  if (!remote || !cover) return;
  const destination = path.join(ROOT, 'public', cover.replace(/^\//, ''));
  if (fs.existsSync(destination) || dryRun) return;
  const response = await fetch(remote);
  if (!response.ok) throw new Error(`Could not download cover ${remote}: ${response.status}`);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, Buffer.from(await response.arrayBuffer()));
  console.log(`  downloaded ${path.relative(ROOT, destination)}`);
}

async function main() {
  console.log(`Checking ${ARCHIVE_URL}`);
  const archiveHtml = await getText(ARCHIVE_URL);
  const collection = jsonLdDocuments(archiveHtml).find((doc) => doc['@type'] === 'CollectionPage');
  const entries = collection?.mainEntity?.itemListElement;
  if (!Array.isArray(entries) || !entries.length) throw new Error('Archive JSON-LD did not contain an ItemList. No files changed.');

  fs.mkdirSync(outputDir, { recursive: true });
  const previous = fs.existsSync(outputPath) ? JSON.parse(fs.readFileSync(outputPath, 'utf8')) : { issues: [] };
  const previousByNumber = new Map(previous.issues.map((issue) => [issue.issueNumber, issue]));
  const discovered = [];
  const warnings = [];

  for (const entry of entries) {
    const issueUrl = entry.url;
    const issueNumber = issueUrl.match(/\/issue\/(\d+)/)?.[1];
    if (!issueNumber) { warnings.push(`Could not find issue number in ${issueUrl}`); continue; }
    if (!portfolioIssueNumbers.has(issueNumber)) continue;
    console.log(`Importing issue ${issueNumber}`);
    const html = await getText(issueUrl);
    const article = jsonLdDocuments(html).find((doc) => /Article$/.test(doc['@type'] || ''));
    if (!article) { warnings.push(`Issue ${issueNumber}: missing Article JSON-LD`); continue; }
    const required = ['headline', 'description', 'datePublished', 'articleBody'];
    const missing = required.filter((field) => !article[field]);
    if (missing.length) warnings.push(`Issue ${issueNumber}: missing ${missing.join(', ')}`);
    const coverInfo = localCover(issueNumber, html);
    if (!coverInfo.cover) warnings.push(`Issue ${issueNumber}: no reliable cover image found`);
    await downloadCover(coverInfo.remote, coverInfo.cover);
    const prior = previousByNumber.get(issueNumber) || {};
    discovered.push({
      title: portfolioTitles[issueNumber] || article.headline || entry.name || prior.title || `Issue ${issueNumber}`,
      followTitle: followTitles[issueNumber] || prior.followTitle || '',
      subtitle: article.description || prior.subtitle || '',
      slug: prior.slug || `offscript-${issueNumber}-${slugify(article.headline || entry.name || '')}`,
      date: article.datePublished || prior.date || '',
      category: 'The OffScript',
      publication: 'The OffScript',
      issueNumber,
      cover: coverInfo.cover || prior.cover || '',
      originalUrl: issueUrl,
      subscribeUrl: 'https://theoffscript.page/#join',
      featured: false,
      topics: prior.topics?.length ? prior.topics : (topicMap[issueNumber] || ['Nigeria']),
      body: article.articleBody || prior.body || '',
      source: 'JSON-LD',
      syncedAt: new Date().toISOString()
    });
  }

  const liveNumbers = new Set(discovered.map((issue) => issue.issueNumber));
  const preserved = previous.issues.filter((issue) => portfolioIssueNumbers.has(issue.issueNumber) && !liveNumbers.has(issue.issueNumber));
  const issues = [...discovered, ...preserved].sort((a, b) => b.date.localeCompare(a.date));
  const added = discovered.filter((issue) => !previousByNumber.has(issue.issueNumber));
  const result = { source: ARCHIVE_URL, syncedAt: new Date().toISOString(), issues };

  if (!dryRun) fs.writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  console.log(`${dryRun ? 'Dry run:' : 'Done:'} ${discovered.length} live issue(s), ${added.length} new, ${preserved.length} previously imported issue(s) preserved.`);
  if (warnings.length) {
    console.warn('Review needed:');
    warnings.forEach((warning) => console.warn(`  - ${warning}`));
    process.exitCode = 2;
  } else {
    console.log('All required fields and covers are present.');
  }
  console.log('Manual notes were not touched: content/offscript/behind-the-piece.json');
}

main().catch((error) => {
  console.error(`Sync failed: ${error.message}`);
  console.error('Fallback: keep the last imported issues.json, then add or correct the affected issue there without changing behind-the-piece.json.');
  process.exitCode = 1;
});
