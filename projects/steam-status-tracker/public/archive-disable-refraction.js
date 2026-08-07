(() => {
  'use strict';

  function disableRefraction() {
    const q = window.QPolish;
    const refraction = q?.refraction;

    if (refraction) {
      try {
        if (refraction.raf) cancelAnimationFrame(refraction.raf);
      } catch {}
      refraction.raf = 0;

      try {
        refraction.items?.forEach?.((item) => item?.cv?.remove?.());
        refraction.items?.clear?.();
      } catch {}

      refraction.scan = () => {};
      refraction.add = () => {};
      refraction.draw = () => {};
      refraction.loop = () => {};
    }

    document.querySelectorAll('.refraction-canvas').forEach((canvas) => canvas.remove());
  }

  disableRefraction();
  new MutationObserver(disableRefraction).observe(document.documentElement, {
    childList: true,
    subtree: true
  });
})();
