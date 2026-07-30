const desktopMotionMedia = window.matchMedia('(hover: hover) and (pointer: fine) and (min-width: 769px)');
let desktopMotionLoaded = false;

async function configureResponsiveRuntime() {
  const desktopMotion = desktopMotionMedia.matches;
  document.documentElement.classList.toggle('desktop-motion', desktopMotion);
  document.documentElement.classList.toggle('touch-layout', !desktopMotion);

  const overlay = document.querySelector('#cursor-web-overlay');
  if (overlay) overlay.hidden = !desktopMotion;

  if (!desktopMotion || desktopMotionLoaded) return;
  desktopMotionLoaded = true;

  await Promise.allSettled([
    import('./cursor-web.js?v=2'),
    import('./inertia.js?v=2')
  ]);
}

desktopMotionMedia.addEventListener?.('change', configureResponsiveRuntime);
window.addEventListener('resize', configureResponsiveRuntime, { passive: true });
configureResponsiveRuntime();
