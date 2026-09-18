import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const baseUrl = process.env.PREVIEW_URL || 'http://127.0.0.1:4173';
const cdpUrl = process.env.CDP_URL || 'http://127.0.0.1:9223';
const targets = await (await fetch(`${cdpUrl}/json/list`)).json();
const target = targets.find((entry) => entry.type === 'page' && entry.url === 'about:blank') || targets.find((entry) => entry.type === 'page');
if (!target?.webSocketDebuggerUrl) throw new Error('No inspectable Edge page target was found.');

const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true });
  socket.addEventListener('error', reject, { once: true });
});

let nextId = 0;
const pending = new Map();
const consoleProblems = [];
socket.addEventListener('message', ({ data }) => {
  const message = JSON.parse(data);
  if (message.id) {
    const request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id);
    if (message.error) request.reject(new Error(message.error.message));
    else request.resolve(message.result);
  }
  if (message.method === 'Runtime.exceptionThrown') consoleProblems.push(message.params.exceptionDetails?.text || 'Uncaught exception');
  if (message.method === 'Log.entryAdded' && ['error', 'warning'].includes(message.params.entry?.level)) consoleProblems.push(`${message.params.entry.level}: ${message.params.entry.text}`);
});

function send(method, params = {}) {
  const id = ++nextId;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}

async function evaluate(expression) {
  const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || 'Runtime evaluation failed');
  return result.result.value;
}

async function navigate(width, height, mobile = false) {
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile });
  await send('Page.navigate', { url: `${baseUrl}/` });
  await evaluate(`(async () => {
    while (document.readyState !== 'complete') await new Promise((resolve) => setTimeout(resolve, 20));
    await document.fonts.ready;
    return true;
  })()`);
}

async function screenshot(filename) {
  const metrics = await send('Page.getLayoutMetrics');
  const size = metrics.cssContentSize || metrics.contentSize;
  const capture = await send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: true,
    clip: { x: 0, y: 0, width: size.width, height: size.height, scale: 1 }
  });
  fs.writeFileSync(filename, Buffer.from(capture.data, 'base64'));
}

async function viewportScreenshot(filename, width, height) {
  const capture = await send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: false,
    clip: { x: 0, y: 0, width, height, scale: 1 }
  });
  fs.writeFileSync(filename, Buffer.from(capture.data, 'base64'));
}

await send('Page.enable');
await send('Runtime.enable');
await send('Log.enable');

const failures = [];
const screenshotDir = path.join(os.tmpdir(), 'aisha-writing-contact-audit');
fs.mkdirSync(screenshotDir, { recursive: true });

await navigate(1440, 1000);
const opened = await evaluate(`(async () => {
  const opener = document.querySelector('[data-contact-open]');
  scrollTo(0, opener.getBoundingClientRect().top + scrollY - 240);
  const before = scrollY;
  opener.focus();
  opener.click();
  await new Promise((resolve) => setTimeout(resolve, 500));
  const room = document.querySelector('[data-contact-experience]');
  return {
    before,
    hidden: room.hidden,
    ariaHidden: room.getAttribute('aria-hidden'),
    modal: room.getAttribute('aria-modal'),
    focused: document.activeElement?.name,
    bodyPosition: getComputedStyle(document.body).position,
    backgroundIsInert: document.querySelector('main').inert && document.querySelector('.site-header').inert && document.querySelector('.site-footer').inert,
    heading: document.querySelector('#contact-heading').textContent.trim(),
    supporting: document.querySelector('.contact-intro > p:last-child').textContent.trim(),
    action: document.querySelector('[data-contact-form]').action,
    method: document.querySelector('[data-contact-form]').method,
    source: document.querySelector('[name="source"]').value,
    fields: [...document.querySelectorAll('[data-contact-form] [name]')].map((field) => ({ name: field.name, type: field.type, required: field.required })),
    options: [...document.querySelectorAll('[name="project_type"] option')].slice(1).map((option) => option.textContent),
    mailto: document.querySelector('.contact-actions a').getAttribute('href')
  };
})()`);

if (opened.hidden || opened.ariaHidden !== 'false' || opened.modal !== 'true') failures.push('Contact room did not open as a modal full-screen state');
if (opened.focused !== 'name') failures.push('Opening focus did not move to the name field');
if (opened.bodyPosition !== 'fixed' || !opened.backgroundIsInert) failures.push('Background scroll or interaction was not locked');
if (opened.heading !== 'Let’s make something worth reading.' || opened.supporting !== 'Got a story, brief, role, or idea you think I’d be good for? Send it my way.') failures.push('Contact copy differs from the approved wording');
if (opened.action !== 'https://formspree.io/f/mzeblevj' || opened.method !== 'post' || opened.source !== 'read.aishaonola.me') failures.push('Formspree action, method, or source is incorrect');
if (JSON.stringify(opened.options) !== JSON.stringify(['Writing role', 'Article / essay', 'Content writing', 'Editorial project', 'Freelance project', 'Collaboration', 'Something else'])) failures.push('Project type options are incorrect');
if (!['name', 'email', 'project_type', 'message'].every((name) => opened.fields.some((field) => field.name === name && field.required))) failures.push('A required writing inquiry field is missing');
if (opened.fields.find((field) => field.name === 'email')?.type !== 'email' || opened.mailto !== 'mailto:contact@aishaonola.me') failures.push('Email field or mailto alternative is incorrect');
await screenshot(path.join(screenshotDir, 'desktop-contact.png'));

const focusTrap = await evaluate(`(() => {
  const last = document.querySelector('.contact-actions a');
  last.focus();
  last.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
  return document.activeElement?.matches('[data-contact-close]');
})()`);
if (!focusTrap) failures.push('Focus did not wrap inside the contact room');

const escaped = await evaluate(`(async () => {
  document.querySelector('[name="message"]').value = 'A draft worth keeping';
  document.querySelector('[data-contact-experience]').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  await new Promise((resolve) => setTimeout(resolve, 400));
  return {
    hidden: document.querySelector('[data-contact-experience]').hidden,
    scrollY,
    focusReturned: document.activeElement === document.querySelector('[data-contact-open]'),
    backgroundIsInteractive: !document.querySelector('main').inert,
    bodyPosition: getComputedStyle(document.body).position
  };
})()`);
if (!escaped.hidden || escaped.scrollY !== opened.before || !escaped.focusReturned || !escaped.backgroundIsInteractive || escaped.bodyPosition === 'fixed') failures.push('Escape did not restore focus, scroll, and page interaction');

const draft = await evaluate(`(async () => {
  document.querySelector('[data-contact-open]').click();
  await new Promise((resolve) => setTimeout(resolve, 450));
  return document.querySelector('[name="message"]').value;
})()`);
if (draft !== 'A draft worth keeping') failures.push('Draft content was lost after close and reopen');

const invalid = await evaluate(`(() => {
  const form = document.querySelector('[data-contact-form]');
  form.querySelector('[name="name"]').value = 'Reader';
  form.querySelector('[name="email"]').value = 'not-an-email';
  form.querySelector('[name="project_type"]').value = 'Article / essay';
  form.requestSubmit();
  return { valid: form.checkValidity(), typeMismatch: form.querySelector('[name="email"]').validity.typeMismatch, stillForm: !document.querySelector('[data-contact-form-state]').hidden };
})()`);
if (invalid.valid || !invalid.typeMismatch || !invalid.stillForm) failures.push('Invalid email validation did not keep the visitor on the form');

const failed = await evaluate(`(async () => {
  const form = document.querySelector('[data-contact-form]');
  form.querySelector('[name="email"]').value = 'reader@example.com';
  window.__fetchCount = 0;
  window.__pendingFetch = new Promise((resolve) => { window.__resolveFetch = resolve; });
  window.fetch = () => { window.__fetchCount += 1; return window.__pendingFetch; };
  form.requestSubmit();
  form.requestSubmit();
  await new Promise((resolve) => setTimeout(resolve, 30));
  const sending = {
    count: window.__fetchCount,
    disabled: document.querySelector('[data-contact-submit]').disabled,
    label: document.querySelector('[data-contact-submit]').textContent.trim(),
    message: form.querySelector('[name="message"]').value
  };
  window.__resolveFetch(new Response('{}', { status: 503, headers: { 'content-type': 'application/json' } }));
  await new Promise((resolve) => setTimeout(resolve, 80));
  return {
    sending,
    error: document.querySelector('[data-contact-error]').textContent.trim(),
    errorVisible: !document.querySelector('[data-contact-error]').hidden,
    enabled: !document.querySelector('[data-contact-submit]').disabled,
    message: form.querySelector('[name="message"]').value,
    formVisible: !document.querySelector('[data-contact-form-state]').hidden
  };
})()`);
if (failed.sending.count !== 1 || !failed.sending.disabled || failed.sending.label !== 'Sending…') failures.push('Sending state did not prevent a duplicate submission');
if (!failed.errorVisible || !failed.error || !failed.enabled || failed.message !== 'A draft worth keeping' || !failed.formVisible) failures.push('Failure state did not preserve the draft and allow retry');

const succeeded = await evaluate(`(async () => {
  const form = document.querySelector('[data-contact-form]');
  window.__submitted = null;
  window.fetch = async (url, options) => {
    window.__submitted = { url, method: options.method, accept: options.headers.Accept, values: Object.fromEntries(options.body.entries()) };
    return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
  };
  form.requestSubmit();
  await new Promise((resolve) => setTimeout(resolve, 350));
  return {
    submitted: window.__submitted,
    formHidden: document.querySelector('[data-contact-form-state]').hidden,
    successVisible: !document.querySelector('[data-contact-success-state]').hidden,
    successCopy: document.querySelector('#contact-success-heading').textContent.trim(),
    focused: document.activeElement?.id,
    mailto: document.querySelector('.contact-success-state a').getAttribute('href'),
    returnCopy: document.querySelector('[data-contact-return]').textContent.trim()
  };
})()`);
if (succeeded.submitted?.url !== 'https://formspree.io/f/mzeblevj' || succeeded.submitted?.method !== 'POST' || succeeded.submitted?.accept !== 'application/json' || succeeded.submitted?.values?.source !== 'read.aishaonola.me') failures.push('Async submission payload is not Formspree-compatible');
if (!succeeded.formHidden || !succeeded.successVisible || succeeded.successCopy !== 'Got it. I’ll get back to you soon :)' || succeeded.focused !== 'contact-success-heading') failures.push('Success did not become its own focused screen state');
if (succeeded.mailto !== 'mailto:contact@aishaonola.me' || !succeeded.returnCopy.startsWith('Back to the stories')) failures.push('Success alternatives or return action are incorrect');
await screenshot(path.join(screenshotDir, 'desktop-success.png'));

const returned = await evaluate(`(async () => {
  document.querySelector('[data-contact-return]').click();
  await new Promise((resolve) => setTimeout(resolve, 400));
  return {
    hidden: document.querySelector('[data-contact-experience]').hidden,
    scrollY,
    focusReturned: document.activeElement === document.querySelector('[data-contact-open]'),
    reset: document.querySelector('[name="message"]').value === ''
  };
})()`);
if (!returned.hidden || returned.scrollY !== opened.before || !returned.focusReturned || !returned.reset) failures.push('Back to the stories did not restore the exact page state after success');

for (const [width, height] of [[1366, 768], [1440, 900]]) {
  await navigate(width, height);
  const desktopFit = await evaluate(`(async () => {
    document.querySelector('[data-contact-open]').click();
    await new Promise((resolve) => setTimeout(resolve, 450));
    const room = document.querySelector('[data-contact-experience]');
    const required = [
      document.querySelector('.contact-header'),
      document.querySelector('.contact-intro .eyebrow'),
      document.querySelector('#contact-heading'),
      document.querySelector('.contact-intro > p:last-child'),
      document.querySelector('[name="name"]'),
      document.querySelector('[name="email"]'),
      document.querySelector('[name="project_type"]'),
      document.querySelector('[name="message"]'),
      document.querySelector('[data-contact-submit]'),
      document.querySelector('.contact-actions p')
    ];
    const bounds = required.map((element) => ({
      text: element.textContent.trim().replace(/\\s+/g, ' '),
      top: element.getBoundingClientRect().top,
      bottom: element.getBoundingClientRect().bottom
    }));
    return {
      scrollOverflow: room.scrollHeight - room.clientHeight,
      scrollTop: room.scrollTop,
      viewportHeight: innerHeight,
      minTop: Math.min(...bounds.map((item) => item.top)),
      maxBottom: Math.max(...bounds.map((item) => item.bottom)),
      bounds
    };
  })()`);
  if (desktopFit.scrollOverflow > 1 || desktopFit.scrollTop !== 0 || desktopFit.minTop < 0 || desktopFit.maxBottom > height + 1) {
    failures.push(`${width}x${height} contact form does not fit without vertical scrolling: ${JSON.stringify(desktopFit)}`);
  }
  await viewportScreenshot(path.join(screenshotDir, `desktop-contact-${width}x${height}.png`), width, height);
}

await navigate(1024, 768);
const laptop = await evaluate(`(async () => {
  document.querySelector('[data-contact-open]').click();
  await new Promise((resolve) => setTimeout(resolve, 450));
  const room = document.querySelector('[data-contact-experience]');
  const state = document.querySelector('[data-contact-form-state]');
  return {
    overflow: room.scrollWidth - room.clientWidth,
    columns: getComputedStyle(state).gridTemplateColumns.split(' ').length,
    headingSize: parseFloat(getComputedStyle(document.querySelector('.contact-intro h2')).fontSize),
    formWidth: document.querySelector('.contact-form-wrap').getBoundingClientRect().width
  };
})()`);
if (laptop.overflow > 1 || laptop.columns !== 2 || laptop.headingSize > 72 || laptop.formWidth < 390) failures.push('Laptop-sized contact layout is not balanced or overflow-free');
await screenshot(path.join(screenshotDir, 'laptop-contact.png'));

await navigate(375, 812, true);
const mobile = await evaluate(`(async () => {
  const opener = document.querySelector('[data-contact-open]');
  opener.click();
  await new Promise((resolve) => setTimeout(resolve, 450));
  const room = document.querySelector('[data-contact-experience]');
  const state = document.querySelector('[data-contact-form-state]');
  const heading = document.querySelector('.contact-intro h2');
  const submit = document.querySelector('[data-contact-submit]');
  return {
    overflow: room.scrollWidth - room.clientWidth,
    roomHeight: room.getBoundingClientRect().height,
    viewportHeight: innerHeight,
    stateDisplay: getComputedStyle(state).display,
    headingSize: parseFloat(getComputedStyle(heading).fontSize),
    inputSize: parseFloat(getComputedStyle(document.querySelector('[name="email"]')).fontSize),
    submitWidth: submit.getBoundingClientRect().width,
    stateWidth: state.getBoundingClientRect().width,
    closeSize: document.querySelector('[data-contact-close]').getBoundingClientRect().height
  };
})()`);
if (mobile.overflow > 1 || mobile.roomHeight < mobile.viewportHeight || mobile.stateDisplay !== 'block') failures.push('Mobile contact room does not stack or fit the viewport correctly');
if (mobile.headingSize > 58 || mobile.inputSize < 16 || mobile.submitWidth < mobile.stateWidth * .9 || mobile.closeSize < 40) failures.push('Mobile type or controls are not comfortably proportioned');
await screenshot(path.join(screenshotDir, 'mobile-contact.png'));

const mobileSuccess = await evaluate(`(async () => {
  const form = document.querySelector('[data-contact-form]');
  form.querySelector('[name="name"]').value = 'Reader';
  form.querySelector('[name="email"]').value = 'reader@example.com';
  form.querySelector('[name="project_type"]').value = 'Writing role';
  form.querySelector('[name="message"]').value = 'A mobile inquiry';
  window.fetch = async () => new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
  form.requestSubmit();
  await new Promise((resolve) => setTimeout(resolve, 350));
  const room = document.querySelector('[data-contact-experience]');
  return {
    visible: !document.querySelector('[data-contact-success-state]').hidden,
    overflow: room.scrollWidth - room.clientWidth,
    headingSize: parseFloat(getComputedStyle(document.querySelector('#contact-success-heading')).fontSize),
    closeVisible: document.querySelector('[data-contact-close]').getBoundingClientRect().height >= 40
  };
})()`);
if (!mobileSuccess.visible || mobileSuccess.overflow > 1 || mobileSuccess.headingSize > 60 || !mobileSuccess.closeVisible) failures.push('Mobile success screen is not proportioned or accessible');
await screenshot(path.join(screenshotDir, 'mobile-success.png'));

if (consoleProblems.length) failures.push(...consoleProblems.map((problem) => `console: ${problem}`));
console.log(`Contact audit: desktop and mobile flow checks; ${consoleProblems.length} console problems; ${failures.length} failures.`);
console.log(`Screenshots: ${screenshotDir}`);
if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
}
socket.close();
