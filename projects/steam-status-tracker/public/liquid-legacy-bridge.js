'use strict';

try {
  if (typeof observer !== 'undefined') observer.disconnect();
} catch {}

let bridgeFrame = 0;
function maintainLegacyDetails() {
  if (bridgeFrame) return;
  bridgeFrame = requestAnimationFrame(() => {
    bridgeFrame = 0;
    try {
      if (typeof restoreLegacyCat === 'function') restoreLegacyCat();
      if (typeof decorateDescription === 'function') decorateDescription();
      if (typeof applyLegacyIcons === 'function') applyLegacyIcons();
    } catch {}
  });
}

new MutationObserver(maintainLegacyDetails).observe(document.body, {
  childList: true,
  subtree: true
});

maintainLegacyDetails();
addEventListener('hashchange', maintainLegacyDetails);
addEventListener('pageshow', maintainLegacyDetails);
