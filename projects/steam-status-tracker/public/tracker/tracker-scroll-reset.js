(() => {
  if ('scrollRestoration' in window.history) {
    window.history.scrollRestoration = 'manual';
  }

  const listIds = ['games-list', 'history-list'];
  const lists = listIds
    .map((id) => document.getElementById(id))
    .filter(Boolean);

  function resetPageScroll() {
    const root = document.documentElement;
    const previousBehavior = root.style.scrollBehavior;
    root.style.scrollBehavior = 'auto';
    window.scrollTo(0, 0);

    window.requestAnimationFrame(() => {
      window.scrollTo(0, 0);
      root.style.scrollBehavior = previousBehavior;
    });
  }

  function resetListScroll(list) {
    const previousBehavior = list.style.scrollBehavior;
    list.style.overflowAnchor = 'none';
    list.style.scrollBehavior = 'auto';
    list.scrollTop = 0;

    window.requestAnimationFrame(() => {
      list.scrollTop = 0;
      list.style.scrollBehavior = previousBehavior;
    });
  }

  for (const list of lists) {
    if (list.children.length > 0) {
      resetListScroll(list);
      continue;
    }

    const observer = new MutationObserver(() => {
      if (list.children.length === 0) return;
      observer.disconnect();
      resetListScroll(list);
    });

    observer.observe(list, { childList: true });
  }

  resetPageScroll();
  window.addEventListener('pageshow', () => {
    resetPageScroll();
    for (const list of lists) resetListScroll(list);
  }, { once: true });
})();
