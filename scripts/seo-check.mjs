import fs from 'node:fs';
import path from 'node:path';
import { ROOT, SITE_URL, loadAllWriting } from './content.mjs';

const errors = [];
const dist = path.join(ROOT, 'dist');
const writing = loadAllWriting();
const personal = writing.filter((item) => item.kind === 'personal');
const issues = writing.filter((item) => item.kind === 'offscript' && ['001', '002', '003', '004', '005'].includes(item.issueNumber));
const expectedPaths = ['/', '/personal/', '/offscript/', '/explore/', ...personal.map((item) => `/writing/${item.slug}/`), ...issues.map((item) => `/writing/${item.slug}/`)];
const expectedUrls = expectedPaths.map((pathname) => `${SITE_URL}${pathname}`);
const htmlFiles = [];

function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(target);
    else if (entry.name === 'index.html') htmlFiles.push(target);
  }
}

function routeFor(file) {
  const relative = path.relative(dist, file).replaceAll('\\', '/').replace(/index\.html$/, '');
  return `/${relative}`.replace('//', '/');
}

function content(html, expression) {
  return html.match(expression)?.[1] || '';
}

function pngSize(filename) {
  const data = fs.readFileSync(filename);
  return [data.readUInt32BE(16), data.readUInt32BE(20)];
}

walk(dist);
const pages = htmlFiles.map((file) => {
  const html = fs.readFileSync(file, 'utf8');
  const pathname = routeFor(file);
  const canonical = content(html, /<link rel="canonical" href="([^"]+)">/);
  const title = content(html, /<title>([^<]+)<\/title>/);
  const description = content(html, /<meta name="description" content="([^"]+)">/);
  const ogTitle = content(html, /<meta property="og:title" content="([^"]+)">/);
  const ogDescription = content(html, /<meta property="og:description" content="([^"]+)">/);
  const ogUrl = content(html, /<meta property="og:url" content="([^"]+)">/);
  const ogImage = content(html, /<meta property="og:image" content="([^"]+)">/);
  const xTitle = content(html, /<meta name="twitter:title" content="([^"]+)">/);
  const xDescription = content(html, /<meta name="twitter:description" content="([^"]+)">/);
  const xImage = content(html, /<meta name="twitter:image" content="([^"]+)">/);
  const schemaText = content(html, /<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  let schema;
  try { schema = JSON.parse(schemaText); } catch { errors.push(`${pathname}: invalid JSON-LD`); }

  if (canonical !== `${SITE_URL}${pathname}`) errors.push(`${pathname}: canonical is incorrect`);
  if (ogUrl !== canonical) errors.push(`${pathname}: Open Graph URL differs from canonical`);
  if (ogTitle !== title || xTitle !== title) errors.push(`${pathname}: social title differs from page title`);
  if (ogDescription !== description || xDescription !== description) errors.push(`${pathname}: social description differs from page description`);
  if (ogImage !== `${SITE_URL}/aisha-onola-og.png` || xImage !== ogImage) errors.push(`${pathname}: social image is incorrect`);
  if (!html.includes('<meta property="og:image:width" content="1200">') || !html.includes('<meta property="og:image:height" content="630">')) errors.push(`${pathname}: social image dimensions are absent`);
  if (!html.includes('<meta name="twitter:card" content="summary_large_image">')) errors.push(`${pathname}: X card type is incorrect`);
  for (const asset of ['/favicon.ico', '/favicon.svg', '/favicon-32x32.png', '/favicon-16x16.png', '/apple-touch-icon.png', '/site.webmanifest']) {
    if (!html.includes(`href="${asset}"`)) errors.push(`${pathname}: missing head reference to ${asset}`);
  }
  if (!schema?.['@graph']?.some((entry) => entry['@type'] === 'Person')) errors.push(`${pathname}: Person schema is absent`);
  if (!schema?.['@graph']?.some((entry) => entry['@type'] === 'WebSite')) errors.push(`${pathname}: WebSite schema is absent`);
  if (['/personal/', '/offscript/', '/explore/'].includes(pathname) && !schema?.['@graph']?.some((entry) => entry['@type'] === 'CollectionPage')) errors.push(`${pathname}: CollectionPage schema is absent`);
  if (pathname.startsWith('/writing/') && !schema?.['@graph']?.some((entry) => entry['@type'] === 'BlogPosting')) errors.push(`${pathname}: BlogPosting schema is absent`);
  return { pathname, title, description, html };
});

if (pages.length !== expectedPaths.length || expectedPaths.some((pathname) => !pages.some((page) => page.pathname === pathname))) errors.push('Generated route set differs from the approved sitemap scope');
if (new Set(pages.map((page) => page.title)).size !== pages.length) errors.push('Page titles are not unique');
if (new Set(pages.map((page) => page.description)).size !== pages.length) errors.push('Page descriptions are not unique');
const home = pages.find((page) => page.pathname === '/');
if (home?.title !== 'Aisha Onola | Writer and Creator of The OffScript') errors.push('Homepage title is incorrect');
if (home?.description !== 'Aisha Onola is a Nigerian writer in Lagos and the creator of The OffScript. Read her personal essays and reported stories about life in Nigeria.') errors.push('Homepage description is incorrect');
for (const page of pages.filter((entry) => entry.pathname !== '/')) if (!page.title.endsWith(' | Aisha Onola')) errors.push(`${page.pathname}: title format is incorrect`);

const generated = pages.map((page) => page.html).join('\n');
const prohibitedClaims = [
  ['9', ' connected pieces'].join(''),
  ['9', ' pieces'].join(''),
  ['9', ' articles'].join(''),
  ['9', ' stories'].join(''),
  ['4', ' pieces'].join(''),
  ['four', ' personal essays'].join(''),
  ['5', ' featured issues'].join(''),
  ['five', ' featured OffScript issues'].join('')
];
for (const claim of prohibitedClaims) if (generated.toLowerCase().includes(claim.toLowerCase())) errors.push(`Generated pages retain a prohibited collection-size claim: ${claim}`);
if (!generated.includes('Choose an idea. Follow the connections between personal observations and reported stories.')) errors.push('The exact Explore introduction is absent');
if (generated.includes('writing.aishaonola.me') || /<meta[^>]+noindex/i.test(generated)) errors.push('A preview domain or noindex directive remains');
if (!generated.includes('href="https://theoffscript.page')) errors.push('A crawlable The OffScript link is absent');

const offscriptPage = pages.find((page) => page.pathname === '/offscript/')?.html || '';
for (const issue of ['001', '002', '003', '004', '005']) if (!offscriptPage.includes(`class="spine-num">${issue}</span>`)) errors.push(`Issue spine ${issue} is absent`);

const sitemap = fs.readFileSync(path.join(dist, 'sitemap.xml'), 'utf8');
const sitemapUrls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
if (sitemapUrls.length !== expectedUrls.length || new Set(sitemapUrls).size !== expectedUrls.length || expectedUrls.some((url) => !sitemapUrls.includes(url))) errors.push('Sitemap URLs differ from the approved route set');
if (/issue-?00[67]|preview|writing\.aishaonola\.me/i.test(sitemap)) errors.push('Sitemap contains an excluded or preview URL');

const robots = fs.readFileSync(path.join(dist, 'robots.txt'), 'utf8');
if (!robots.includes('User-agent: *\nAllow: /') || !robots.includes(`Sitemap: ${SITE_URL}/sitemap.xml`) || /Disallow:\s*\//i.test(robots)) errors.push('robots.txt does not allow crawling or has the wrong sitemap');

const assets = {
  'aisha-onola-og.png': [1200, 630],
  'favicon-16x16.png': [16, 16],
  'favicon-32x32.png': [32, 32],
  'apple-touch-icon.png': [180, 180],
  'icon-192.png': [192, 192],
  'icon-512.png': [512, 512]
};
for (const [name, expected] of Object.entries(assets)) {
  const file = path.join(dist, name);
  if (!fs.existsSync(file)) errors.push(`Missing asset: ${name}`);
  else if (pngSize(file).join('x') !== expected.join('x')) errors.push(`${name}: dimensions are incorrect`);
}
for (const name of ['favicon.ico', 'favicon.svg', 'site.webmanifest']) if (!fs.existsSync(path.join(dist, name))) errors.push(`Missing asset: ${name}`);
try { JSON.parse(fs.readFileSync(path.join(dist, 'site.webmanifest'), 'utf8')); } catch { errors.push('Web manifest is invalid JSON'); }

if (errors.length) {
  console.error(`SEO checks failed (${errors.length}):\n${errors.map((error) => `- ${error}`).join('\n')}`);
  process.exit(1);
}
console.log(`SEO checks passed for ${pages.length} unique pages on ${SITE_URL}; metadata, JSON-LD, crawl controls, sitemap and standalone assets are valid.`);
