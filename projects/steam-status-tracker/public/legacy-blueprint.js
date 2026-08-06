'use strict';

const LEGACY_ICONS = Object.freeze({
  telegram: '<svg class="brand-icon-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M21.94 2.51c-.52-.43-1.36-.25-2.19.05L2.58 9.18c-1.17.46-1.16 1.12-.21 1.42l4.38 1.37 1.69 5.26c.21.57.11.8.7.8.46 0 .67-.21.93-.46l2.23-2.17 4.65 3.44c.86.47 1.47.23 1.69-.8L21.5 4.51c.29-1.28-.23-1.61.44-2Zm-3.67 3.1-8.6 7.76-.33 3.53-1.35-4.31 9.62-6.07c.42-.26.81-.12.66-.91Z"/></svg>',
  discord: '<svg class="brand-icon-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M20.32 4.37A19.8 19.8 0 0 0 15.43 2.85a.08.08 0 0 0-.08.04c-.21.38-.44.87-.61 1.25a18.4 18.4 0 0 0-5.49 0 12.6 12.6 0 0 0-.62-1.25.08.08 0 0 0-.08-.04A19.74 19.74 0 0 0 3.68 4.37a.07.07 0 0 0-.03.03C.53 9.05-.32 13.58.1 18.06a.08.08 0 0 0 .03.06 19.9 19.9 0 0 0 5.99 3.03.08.08 0 0 0 .08-.03c.46-.63.87-1.3 1.23-1.99a.08.08 0 0 0-.04-.11 12.9 12.9 0 0 1-1.87-.89.08.08 0 0 1-.01-.13l.37-.29a.07.07 0 0 1 .08-.01c3.93 1.79 8.18 1.79 12.06 0a.07.07 0 0 1 .08.01l.37.29a.08.08 0 0 1-.01.13c-.6.34-1.22.64-1.87.89a.08.08 0 0 0-.04.11c.36.7.77 1.36 1.23 1.99a.08.08 0 0 0 .08.03 19.9 19.9 0 0 0 6-3.03.08.08 0 0 0 .03-.06c.5-5.18-.84-9.67-3.55-13.66a.06.06 0 0 0-.03-.03ZM8.02 15.33c-1.18 0-2.16-1.09-2.16-2.42s.96-2.42 2.16-2.42c1.21 0 2.18 1.1 2.16 2.42 0 1.33-.96 2.42-2.16 2.42Zm7.97 0c-1.18 0-2.16-1.09-2.16-2.42s.96-2.42 2.16-2.42c1.21 0 2.18 1.1 2.16 2.42 0 1.33-.95 2.42-2.16 2.42Z"/></svg>',
  roblox: '<svg class="brand-icon-svg" viewBox="0 0 24 24" aria-hidden="true"><path fill-rule="evenodd" d="M5.16 1 23 5.16 18.84 23 1 18.84 5.16 1Zm5.18 8.08-1.26 5.26 5.26 1.26 1.26-5.26-5.26-1.26Z" clip-rule="evenodd"/></svg>',
  tiktok: '<svg class="brand-icon-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M12.53.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03a10.5 10.5 0 0 1-4.2-.97c-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75a7.31 7.31 0 0 1-1.35 3.94 7.37 7.37 0 0 1-5.91 3.21 7.14 7.14 0 0 1-4.08-1.03 7.41 7.41 0 0 1-3.65-5.72c-.02-.5-.03-1-.01-1.49a7.44 7.44 0 0 1 2.58-4.96 7.18 7.18 0 0 1 6.15-1.72c.02 1.48-.04 2.96-.04 4.44a3.33 3.33 0 0 0-3.02.37 3.24 3.24 0 0 0-1.36 1.75c-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87a3.24 3.24 0 0 0 2.77-1.61c.19-.33.4-.68.41-1.07.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07Z"/></svg>',
  steam: '<svg class="brand-icon-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M11.98 0C5.68 0 .51 4.86.02 11.04l6.43 2.66a3.6 3.6 0 0 1 2.11-.68l3.6-5.21v-.08a4.83 4.83 0 1 1 4.82 4.83h-.11l-5.14 3.67v.21a3.6 3.6 0 0 1-7.12.72L.02 15.28C1.45 20.44 6.18 24 11.98 24a12 12 0 1 0 0-24ZM7.28 18.43l-1.47-.61a2.55 2.55 0 0 0 1.31 1.25 2.55 2.55 0 0 0 3.33-1.37 2.55 2.55 0 0 0-1.37-3.33 2.52 2.52 0 0 0-1.94-.01l1.52.63a1.88 1.88 0 1 1-1.38 3.44Zm9.71-7.48a3.22 3.22 0 1 1 0-6.43 3.22 3.22 0 0 1 0 6.43Zm0-5.63a2.42 2.42 0 1 0 0 4.83 2.42 2.42 0 0 0 0-4.83Z"/></svg>',
  csrep: '<svg class="brand-icon-svg brand-icon-outline" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5 20 6v5.5c0 4.8-3.2 8.7-8 10-4.8-1.3-8-5.2-8-10V6l8-3.5Z"/><circle cx="12" cy="11.5" r="3.1"/><path d="M12 6.6v1.8M12 14.6v1.8M7.1 11.5h1.8M15.1 11.5h1.8"/></svg>',
  github: '<svg class="brand-icon-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 .7a11.5 11.5 0 0 0-3.64 22.41c.58.11.79-.25.79-.56v-2.23c-3.22.7-3.9-1.37-3.9-1.37-.53-1.34-1.29-1.7-1.29-1.7-1.05-.72.08-.71.08-.71 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.57-.29-5.27-1.29-5.27-5.69 0-1.26.45-2.28 1.19-3.08-.12-.29-.52-1.46.11-3.04 0 0 .97-.31 3.16 1.18a10.96 10.96 0 0 1 5.75 0C17.03 5.03 18 5.34 18 5.34c.63 1.58.23 2.75.11 3.04.74.8 1.19 1.82 1.19 3.08 0 4.41-2.71 5.39-5.29 5.68.42.36.79 1.07.79 2.16v3.25c0 .31.21.68.8.56A11.5 11.5 0 0 0 12 .7Z"/></svg>',
  generic: '<svg class="brand-icon-svg brand-icon-outline" viewBox="0 0 24 24" aria-hidden="true"><path d="M10.5 13.5a4.5 4.5 0 0 0 6.36.14l2.78-2.78a4.5 4.5 0 0 0-6.36-6.36l-1.59 1.59"/><path d="M13.5 10.5a4.5 4.5 0 0 0-6.36-.14l-2.78 2.78a4.5 4.5 0 0 0 6.36 6.36l1.59-1.59"/></svg>'
});

function inferKind(link) {
  const explicit = link?.dataset?.icon || link?.dataset?.kind || link?.getAttribute?.('data-link-kind');
  if (explicit && LEGACY_ICONS[explicit]) return explicit;

  const source = `${link?.href || ''} ${link?.textContent || ''}`.toLowerCase();
  if (source.includes('t.me') || source.includes('telegram')) return 'telegram';
  if (source.includes('discord')) return 'discord';
  if (source.includes('roblox')) return 'roblox';
  if (source.includes('tiktok')) return 'tiktok';
  if (source.includes('steam')) return 'steam';
  if (source.includes('csrep')) return 'csrep';
  if (source.includes('github')) return 'github';
  return 'generic';
}

function applyLegacyIcons(root = document) {
  root.querySelectorAll('.social-link').forEach((link) => {
    const icon = link.querySelector('.social-link__icon');
    if (!icon) return;
    const kind = inferKind(link);
    link.dataset.legacyKind = kind;
    if (icon.dataset.legacyIcon === kind) return;
    icon.innerHTML = LEGACY_ICONS[kind] || LEGACY_ICONS.generic;
    icon.dataset.legacyIcon = kind;
  });

  root.querySelectorAll('.platform-logo[data-icon]').forEach((icon) => {
    const kind = icon.dataset.icon;
    if (!LEGACY_ICONS[kind] || icon.dataset.legacyIcon === kind) return;
    icon.innerHTML = LEGACY_ICONS[kind];
    icon.dataset.legacyIcon = kind;
  });
}

function decorateDescription() {
  const description = document.getElementById('profileDescription');
  if (!description) return;

  const text = description.textContent.trim() || 'Здесь собраны мои некоторые цифровые следы — места, где я иногда появляюсь.';
  if (description.dataset.legacyDecoratedText === text && description.querySelector('.description-word')) return;

  description.dataset.legacyDecoratedText = text;
  description.replaceChildren();
  description.setAttribute('aria-label', text);

  text.split(/\s+/).forEach((word, index) => {
    const span = document.createElement('span');
    span.className = 'description-word';
    span.style.setProperty('--word-entry-delay', `${170 + index * 45}ms`);
    span.style.setProperty('--word-flow-delay', `${index * -180}ms`);
    span.textContent = word;
    description.append(span, document.createTextNode(' '));
  });
}

function restoreLegacyCat() {
  const cat = document.getElementById('catButton');
  if (!cat) return;

  if (!cat.classList.contains('legacy-cat-button')) {
    cat.classList.add('legacy-cat-button');
    cat.textContent = '🐈';
    cat.title = 'Мяу';
    cat.setAttribute('aria-label', 'Мяукнуть');

    cat.addEventListener('click', () => {
      if (typeof cat.animate !== 'function') return;
      cat.animate([
        { transform:'translateY(0) rotate(0deg) scale(1)', offset:0 },
        { transform:'translateY(-7px) rotate(-3deg) scale(1.08)', offset:.24 },
        { transform:'translateY(-5px) rotate(2deg) scale(1.06)', offset:.5 },
        { transform:'translateY(-2px) rotate(-1deg) scale(1.025)', offset:.76 },
        { transform:'translateY(0) rotate(0deg) scale(1)', offset:1 }
      ], { duration:980, easing:'cubic-bezier(.22,.72,.24,1)' });
    });
  }

  const hint = document.getElementById('catHint');
  if (hint) hint.hidden = true;
}

function restoreLegacyText() {
  const hello = document.querySelector('.hello-title');
  if (hello) hello.textContent = 'Привет';

  const trackerButton = document.querySelector('.profile-tracker-cta span:first-child');
  if (trackerButton) trackerButton.textContent = 'Steam Tracker';

  const gunsButton = document.querySelector('.guns-cta span:first-child');
  if (gunsButton) gunsButton.textContent = 'guns.lol';

  const eyebrow = document.getElementById('trackerEyebrow');
  if (eyebrow) eyebrow.textContent = 'QUIXYLON TRACKER';
}

let scheduled = false;
function applyLegacyLayer() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    document.documentElement.classList.add('legacy-blueprint');
    restoreLegacyCat();
    restoreLegacyText();
    decorateDescription();
    applyLegacyIcons();
  });
}

const observer = new MutationObserver(applyLegacyLayer);
observer.observe(document.body, { childList:true, subtree:true, characterData:true });

applyLegacyLayer();
window.addEventListener('hashchange', applyLegacyLayer);
window.addEventListener('pageshow', applyLegacyLayer);
