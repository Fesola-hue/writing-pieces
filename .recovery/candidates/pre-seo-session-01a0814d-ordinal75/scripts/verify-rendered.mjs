import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadAllWriting } from './content.mjs';

const baseUrl = process.env.PREVIEW_URL || 'http://127.0.0.1:4173';
const targets = await (await fetch('http://127.0.0.1:9223/json/list')).json();
const target = targets.find((entry) => entry.type === 'page' && entry.url === 'about:blank') || targets.find((entry) => entry.type === 'page');
if (!target?.webSocketDebuggerUrl) throw new Error('No inspectable Edge page target was found.');

const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true });
  socket.addEventListener('error', reject, { once: true });
});

let nextId = 0;
const pending = new Map();
const listeners = new Map();
const consoleProblems = [];
socket.addEventListener('message', ({ data }) => {
  const message = JSON.parse(data);
  if (message.id) {
    const request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id);
    if (message.error) request.reject(new Error(message.error.message));
    else request.resolve(message.result);
    return;
  }
  for (const resolve of listeners.get(message.method) || []) resolve(message.params);
  if (message.method === 'Runtime.exceptionThrown') consoleProblems.push(message.params.exceptionDetails?.text || 'Uncaught exception');
  if (message.method === 'Log.entryAdded' && ['error', 'warning'].includes(message.params.entry?.level)) consoleProblems.push(`${message.params.entry.level}: ${message.params.entry.text}`);
});

function send(method, params = {}) {
  const id = ++nextId;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}

function once(method) {
  return new Promise((resolve) => {
    const wrapped = (params) => {
      listeners.set(method, (listeners.get(method) || []).filter((listener) => listener !== wrapped));
      resolve(params);
    };
    listeners.set(method, [...(listeners.get(method) || []), wrapped]);
  });
}

async function evaluate(expression) {
  const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || 'Runtime evaluation failed');
  return result.result.value;
}

await send('Page.enable');
await send('Runtime.enable');
await send('Log.enable');

const writing = loadAllWriting();
const routes = ['/', '/personal/', '/offscript/', '/explore/', ...writing.map((item) => `/writing/${item.slug}/`)];
const viewports = [
  { name: 'desktop-1440', width: 1440, height: 1000, mobile: false, scale: 1 },
  { name: 'mobile-375', width: 375, height: 812, mobile: true, scale: 1 }
];
const screenshotDir = path.join(os.tmpdir(), 'aisha-writing-render-audit');
fs.rmSync(screenshotDir, { recursive: true, force: true });
fs.mkdirSync(screenshotDir, { recursive: true });
const results = [];
const internalLinks = new Set();

for (const viewport of viewports) {
  await send('Emulation.setDeviceMetricsOverride', {
    width: viewport.width,
    height: viewport.height,
    deviceScaleFactor: viewport.scale,
    mobile: viewport.mobile
  });
  for (const route of routes) {
    await send('Page.navigate', { url: `${baseUrl}${route}` });
    const pageHeight = await evaluate(`(async () => {
      while (document.readyState !== 'complete') await new Promise((resolve) => setTimeout(resolve, 20));
      await document.fonts.ready;
      return document.documentElement.scrollHeight;
    })()`);
    for (let y = 0; y < pageHeight; y += viewport.height * 0.7) {
      await send('Input.dispatchMouseEvent', {
        type: 'mouseWheel',
        x: Math.floor(viewport.width / 2),
        y: Math.floor(viewport.height / 2),
        deltaX: 0,
        deltaY: viewport.height * 0.7
      });
      await new Promise((resolve) => setTimeout(resolve, 90));
    }
    await evaluate(`new Promise((resolve) => { scrollTo(0, 0); setTimeout(() => resolve(true), 120); })`);
    const audit = await evaluate(`(() => {
      const text = document.body.innerText;
      const html = document.documentElement.outerHTML;
      const firstBodyParagraph = document.querySelector('.article-body p:first-child');
      const subtitle = document.querySelector('.article-subtitle');
      const headline = document.querySelector('.article-hero h1');
      const figure = document.querySelector('.article-page.is-offscript .article-hero figure');
      const subscription = document.querySelector('.article-page.is-offscript .article-subscribe');
      const footer = document.querySelector('.site-footer');
      const articleParagraphs = [...document.querySelectorAll('.article-body p')];
      const related = [...document.querySelectorAll('.related article.is-offscript')].map((card) => ({
        issue: card.querySelector('p')?.textContent.trim() || '',
        title: card.querySelector('h3')?.textContent.trim() || '',
        href: card.querySelector('h3 a')?.getAttribute('href') || '',
        category: card.className,
        metadata: [...card.querySelectorAll('.topic-row span')].map((node) => node.textContent.trim())
      }));
      const hasDecorativeEmoji = [...text].some((character) => {
        const point = character.codePointAt(0);
        return (point >= 0x1f000 && point <= 0x1faff) || (point >= 0x2600 && point <= 0x27bf) || point === 0xfe0f || point === 0x20e3;
      });
      return {
        route: location.pathname,
        title: document.title,
        h1: document.querySelector('h1')?.textContent.trim() || '',
        contentChars: text.length,
        articleParagraphCount: articleParagraphs.length,
        articleEnding: articleParagraphs.at(-1)?.textContent.trim() || '',
        intro: document.querySelector('.offscript-hero .collection-intro p')?.textContent.trim() || '',
        subscriptionBackground: subscription ? getComputedStyle(subscription).backgroundColor : '',
        subscriptionColor: subscription ? getComputedStyle(subscription).color : '',
        footerBackground: footer ? getComputedStyle(footer).backgroundColor : '',
        figureBackground: figure ? getComputedStyle(figure).backgroundColor : '',
        figureShadow: figure ? getComputedStyle(figure).boxShadow : '',
        figureTransform: figure ? getComputedStyle(figure).transform : '',
        subtitleFontSize: subtitle ? parseFloat(getComputedStyle(subtitle).fontSize) : 0,
        subtitleLineHeight: subtitle ? getComputedStyle(subtitle).lineHeight : '',
        headlineFontSize: headline ? parseFloat(getComputedStyle(headline).fontSize) : 0,
        dropCapColor: firstBodyParagraph ? getComputedStyle(firstBodyParagraph, '::first-letter').color : '',
        related,
        horizontalOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        brokenImages: [...document.images].filter((image) => !image.complete || image.naturalWidth === 0).map((image) => image.getAttribute('src')),
        unrevealed: [...document.querySelectorAll('.reveal:not(.in-view), .reveal-stagger:not(.in-view)')].map((node) => node.className),
        hasEmDash: text.includes(String.fromCodePoint(0x2014)) || html.includes(String.fromCodePoint(0x2014)),
        hasDecorativeEmoji,
        internalLinks: [...document.querySelectorAll('a[href^="/"]')].map((anchor) => anchor.getAttribute('href'))
      };
    })()`);
    audit.viewport = viewport.name;
    audit.internalLinks.forEach((href) => internalLinks.add(href));
    delete audit.internalLinks;
    results.push(audit);

    const metrics = await send('Page.getLayoutMetrics');
    const size = metrics.cssContentSize || metrics.contentSize;
    const screenshot = await send('Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: true,
      clip: { x: 0, y: 0, width: Math.min(size.width, viewport.width), height: size.height, scale: 1 }
    });
    const name = route === '/' ? 'home' : route.replace(/^\/|\/$/g, '').replaceAll('/', '--');
    fs.writeFileSync(path.join(screenshotDir, `${viewport.name}--${name}.png`), Buffer.from(screenshot.data, 'base64'));
  }
}

const linkResults = [];
for (const href of internalLinks) {
  const response = await fetch(new URL(href, baseUrl), { redirect: 'manual' });
  linkResults.push({ href, status: response.status });
}

const approvedTitles = new Set([
  'The NYSC Reform Everyone Missed',
  'The US Visa Squeeze',
  'The Boom Nobody Can Feel',
  'Nigeria Uses AI but doesnt own any of it',
  'Why Cement Costs So Much'
]);
const failures = [];
for (const result of results) {
  if (result.horizontalOverflow > 1) failures.push(`${result.viewport} ${result.route}: ${result.horizontalOverflow}px horizontal overflow`);
  if (result.brokenImages.length) failures.push(`${result.viewport} ${result.route}: broken images ${result.brokenImages.join(', ')}`);
  if (result.unrevealed.length) failures.push(`${result.viewport} ${result.route}: content stayed hidden after scrolling (${result.unrevealed.join(', ')})`);
  if (result.hasEmDash) failures.push(`${result.viewport} ${result.route}: em dash remains`);
  if (result.hasDecorativeEmoji) failures.push(`${result.viewport} ${result.route}: decorative emoji remains`);
  for (const card of result.related) {
    if (!approvedTitles.has(card.title)) failures.push(`${result.viewport} ${result.route}: stale related title ${card.title}`);
    if (!/^The OffScript · Issue 00[1-5]$/.test(card.issue)) failures.push(`${result.viewport} ${result.route}: incorrect related issue metadata ${card.issue}`);
  }
  if (result.route.startsWith('/writing/offscript-')) {
    if (result.subscriptionBackground !== 'rgb(216, 166, 62)') failures.push(`${result.viewport} ${result.route}: subscription is not gold`);
    if (result.footerBackground !== 'rgb(27, 18, 16)') failures.push(`${result.viewport} ${result.route}: footer is not dark`);
    if (result.figureBackground !== 'rgba(0, 0, 0, 0)' || result.figureShadow !== 'none') failures.push(`${result.viewport} ${result.route}: hero frame remains`);
    if (result.subtitleFontSize >= result.headlineFontSize || result.subtitleFontSize > 21) failures.push(`${result.viewport} ${result.route}: subtitle hierarchy is incorrect`);
    if (result.dropCapColor !== 'rgb(216, 166, 62)') failures.push(`${result.viewport} ${result.route}: drop cap is not gold`);
  }
}
for (const link of linkResults) if (link.status !== 200) failures.push(`${link.href}: internal link returned ${link.status}`);
if (consoleProblems.length) failures.push(...consoleProblems.map((problem) => `console: ${problem}`));

const report = { screenshotDir, routes: routes.length, viewports, results, linkResults, consoleProblems, failures };
fs.writeFileSync(path.join(screenshotDir, 'results.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(`Rendered audit: ${routes.length} routes x ${viewports.length} widths = ${results.length} page checks; ${linkResults.length} internal links; ${consoleProblems.length} console problems; ${failures.length} failures.`);
console.log(`Screenshots and full report: ${screenshotDir}`);
if (failures.length) console.error(failures.join('\n'));
socket.close();
if (failures.length) process.exitCode = 1;
