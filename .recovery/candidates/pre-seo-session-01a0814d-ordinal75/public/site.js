const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

const navToggle = document.querySelector('.nav-toggle');
const nav = document.querySelector('#site-nav');
const closeNav = () => {
  navToggle?.setAttribute('aria-expanded', 'false');
  nav?.removeAttribute('data-open');
};
navToggle?.addEventListener('click', () => {
  const opening = navToggle.getAttribute('aria-expanded') !== 'true';
  navToggle.setAttribute('aria-expanded', String(opening));
  nav?.toggleAttribute('data-open', opening);
});
document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeNav(); });

if (!reducedMotion.matches) {
  document.querySelectorAll('a[href^="/"]').forEach((link) => link.addEventListener('click', (event) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const next = new URL(link.href, location.href);
    if (next.pathname === location.pathname && next.hash) return;
    event.preventDefault();
    document.body.classList.add('route-leaving');
    setTimeout(() => { location.href = link.href; }, 260);
  }));
}

function makeController(root, options = {}) {
  const slides = [...root.querySelectorAll('[data-slide]')];
  const panels = [...root.querySelectorAll('[data-slide-panel]')];
  const current = root.querySelector('[data-shelf-current]');
  let index = 0;
  const select = (next, focus = false) => {
    index = (next + slides.length) % slides.length;
    slides.forEach((slide, slideIndex) => {
      const selected = slideIndex === index;
      const deckSlot = (slideIndex - index + slides.length) % slides.length;
      slide.classList.toggle('is-selected', selected);
      slide.setAttribute('aria-pressed', String(selected));
      slide.style.setProperty('--distance', String(slideIndex - index));
      slide.style.setProperty('--x', `${-52 + deckSlot * 12}%`);
      slide.style.setProperty('--mobile-x', `calc(-50% + ${(slideIndex - index) * 58}%)`);
      slide.style.setProperty('--r', `${deckSlot * 3}deg`);
      slide.style.setProperty('--mobile-r', `${(slideIndex - index) * 5}deg`);
      slide.style.setProperty('--deck-layer', String(slides.length - deckSlot));
      if (selected && focus) slide.focus({ preventScroll: true });
    });
    panels.forEach((panel, panelIndex) => panel.toggleAttribute('hidden', panelIndex !== index));
    if (current) current.textContent = options.padded ? String(index + 1).padStart(2, '0') : String(index + 1);
    root.style.setProperty('--selected', String(index));
  };
  slides.forEach((slide, slideIndex) => {
    slide.addEventListener('click', () => select(slideIndex));
    slide.addEventListener('focus', () => select(slideIndex));
    slide.addEventListener('pointerenter', (event) => { if (event.pointerType === 'mouse') select(slideIndex); });
  });
  root.querySelectorAll('[data-shelf-move]').forEach((button) => button.addEventListener('click', () => select(index + Number(button.dataset.shelfMove), true)));
  root.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowRight') { event.preventDefault(); select(index + 1, true); }
    if (event.key === 'ArrowLeft') { event.preventDefault(); select(index - 1, true); }
    if (event.key === 'Home') { event.preventDefault(); select(0, true); }
    if (event.key === 'End') { event.preventDefault(); select(slides.length - 1, true); }
  });
  let touchX = null;
  root.addEventListener('touchstart', (event) => { touchX = event.touches[0].clientX; }, { passive: true });
  root.addEventListener('touchend', (event) => {
    if (touchX === null) return;
    const distance = event.changedTouches[0].clientX - touchX;
    if (Math.abs(distance) > 55) select(index + (distance < 0 ? 1 : -1), true);
    touchX = null;
  }, { passive: true });
  select(0);
  return { select };
}

document.querySelectorAll('[data-shelf]').forEach((shelf) => makeController(shelf, { padded: shelf.dataset.shelf === 'offscript' }));

document.querySelectorAll('[data-view]').forEach((button) => button.addEventListener('click', () => {
  const shelf = button.closest('.personal-shelf');
  const isList = button.dataset.view === 'list';
  shelf.querySelector('.shelf-experience').toggleAttribute('hidden', isList);
  shelf.querySelector('.personal-list').toggleAttribute('hidden', !isList);
  shelf.querySelectorAll('[data-view]').forEach((other) => {
    const selected = other === button;
    other.classList.toggle('active', selected);
    other.setAttribute('aria-pressed', String(selected));
  });
}));

const featuredRoot = document.querySelector('[data-featured-pair]');
if (featuredRoot) {
  const cards = [...featuredRoot.querySelectorAll('[data-feature-card]')];
  const panels = [...featuredRoot.querySelectorAll('.feature-detail')];
  const current = featuredRoot.querySelector('[data-feature-current]');
  let selected = 0;
  const select = (next, focus = false) => {
    selected = (next + cards.length) % cards.length;
    cards.forEach((card, index) => {
      const active = index === selected;
      card.classList.toggle('is-selected', active);
      card.style.setProperty('--feature-offset', String((index - selected + cards.length) % cards.length));
      card.querySelector('button').setAttribute('aria-pressed', String(active));
      if (active && focus) card.querySelector('button').focus({ preventScroll: true });
    });
    panels.forEach((panel, index) => panel.toggleAttribute('hidden', index !== selected));
    current.textContent = String(selected + 1);
  };
  cards.forEach((card, index) => {
    const button = card.querySelector('button');
    button.addEventListener('click', () => select(index));
    button.addEventListener('focus', () => select(index));
    button.addEventListener('pointerenter', (event) => { if (event.pointerType === 'mouse') select(index); });
  });
  featuredRoot.querySelectorAll('[data-feature-move]').forEach((button) => button.addEventListener('click', () => select(selected + Number(button.dataset.featureMove), true)));
  featuredRoot.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowRight') { event.preventDefault(); select(selected + 1, true); }
    if (event.key === 'ArrowLeft') { event.preventDefault(); select(selected - 1, true); }
    if (event.key === 'Home') { event.preventDefault(); select(0, true); }
    if (event.key === 'End') { event.preventDefault(); select(cards.length - 1, true); }
  });
  let touchX = null;
  featuredRoot.addEventListener('touchstart', (event) => { touchX = event.touches[0].clientX; }, { passive: true });
  featuredRoot.addEventListener('touchend', (event) => {
    if (touchX === null) return;
    const distance = event.changedTouches[0].clientX - touchX;
    if (Math.abs(distance) > 55) select(selected + (distance < 0 ? 1 : -1), true);
    touchX = null;
  }, { passive: true });
  select(0);
}

const overviewToggle = document.querySelector('[data-overview-toggle]');
const overview = document.querySelector('#issue-overview');
const setOverview = (open) => {
  if (!overview || !overviewToggle) return;
  overview.toggleAttribute('hidden', !open);
  overviewToggle.setAttribute('aria-expanded', String(open));
  overviewToggle.textContent = open ? 'Hide overview' : overviewToggle.dataset.label || overviewToggle.textContent;
  if (open) overview.querySelector('a')?.focus({ preventScroll: true });
};
if (overviewToggle) overviewToggle.dataset.label = overviewToggle.textContent;
overviewToggle?.addEventListener('click', () => setOverview(overviewToggle.getAttribute('aria-expanded') !== 'true'));
document.querySelector('[data-overview-close]')?.addEventListener('click', () => { setOverview(false); overviewToggle?.focus(); });

const map = document.querySelector('[data-thought-map]');
if (map) {
  const buttons = [...map.querySelectorAll('[data-theme]')];
  const nodes = [...map.querySelectorAll('[data-thought-node]')];
  const svg = map.querySelector('.map-lines');
  const canvas = map.querySelector('.map-canvas');
  const hub = map.querySelector('.theme-hub');
  let activeTheme = map.dataset.initialTheme;
  const drawLines = () => {
    svg.replaceChildren();
    if (innerWidth < 760 || reducedMotion.matches) return;
    const canvasBox = canvas.getBoundingClientRect();
    const hubBox = hub.getBoundingClientRect();
    const startX = hubBox.left + hubBox.width / 2 - canvasBox.left;
    const startY = hubBox.top + hubBox.height / 2 - canvasBox.top;
    nodes.filter((node) => !node.hidden).forEach((node) => {
      const box = node.getBoundingClientRect();
      const endX = box.left + box.width / 2 - canvasBox.left;
      const endY = box.top + box.height / 2 - canvasBox.top;
      const bend = (startX + endX) / 2;
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', `M${startX} ${startY} C${bend} ${startY},${bend} ${endY},${endX} ${endY}`);
      path.setAttribute('class', node.classList.contains('is-offscript') ? 'line-offscript' : 'line-personal');
      svg.append(path);
    });
  };
  const selectTheme = (theme) => {
    activeTheme = theme;
    let count = 0;
    buttons.forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.theme === theme)));
    nodes.forEach((node) => {
      const connected = node.dataset.topics.split('|').includes(theme);
      node.toggleAttribute('hidden', !connected);
      if (connected) { node.style.setProperty('--connected-index', String(count)); count += 1; }
    });
    const label = buttons.find((button) => button.dataset.theme === theme)?.querySelector('span')?.textContent || theme;
    map.querySelector('[data-theme-label]').textContent = label;
    map.querySelector('[data-status-theme]').textContent = label;
    map.querySelector('[data-map-count]').textContent = String(count);
    requestAnimationFrame(drawLines);
  };
  buttons.forEach((button) => button.addEventListener('click', () => selectTheme(button.dataset.theme)));
  addEventListener('resize', drawLines, { passive: true });
  selectTheme(activeTheme);
}

document.querySelectorAll('[data-behind]').forEach((section) => {
  const button = section.querySelector('.behind-toggle');
  const drawer = section.querySelector('.behind-drawer');
  button.addEventListener('click', () => {
    const open = button.getAttribute('aria-expanded') !== 'true';
    button.setAttribute('aria-expanded', String(open));
    drawer.toggleAttribute('hidden', !open);
    section.classList.toggle('is-open', open);
  });
});

const progress = document.querySelector('.reading-progress i');
if (progress) {
  const updateProgress = () => {
    const body = document.querySelector('.article-body');
    const start = body?.offsetTop || 0;
    const end = start + (body?.offsetHeight || 1) - innerHeight;
    const value = Math.min(1, Math.max(0, (scrollY - start + innerHeight * .2) / Math.max(1, end - start)));
    progress.style.transform = `scaleX(${value})`;
  };
  addEventListener('scroll', updateProgress, { passive: true });
  updateProgress();
}

const revealTargets = [...document.querySelectorAll('.reveal, .reveal-stagger')];
if (reducedMotion.matches || !('IntersectionObserver' in window)) {
  revealTargets.forEach((el) => el.classList.add('in-view'));
} else {
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) { entry.target.classList.add('in-view'); revealObserver.unobserve(entry.target); }
    });
  }, { threshold: .14 });
  revealTargets.forEach((el) => revealObserver.observe(el));
}

if (matchMedia('(hover: hover) and (pointer: fine)').matches && !reducedMotion.matches) {
  document.querySelectorAll('.button').forEach((el) => {
    el.addEventListener('mousemove', (event) => {
      const box = el.getBoundingClientRect();
      const x = (event.clientX - box.left - box.width / 2) * .22;
      const y = (event.clientY - box.top - box.height / 2) * .22;
      el.style.setProperty('--magnet-x', `${x}px`);
      el.style.setProperty('--magnet-y', `${y}px`);
      el.classList.add('is-magnetic');
    });
    el.addEventListener('mouseleave', () => el.classList.remove('is-magnetic'));
  });
}
