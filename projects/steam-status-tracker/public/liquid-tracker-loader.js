'use strict';

(async () => {
  const response = await fetch('./liquid-tracker.js?v=4', { cache: 'no-store' });
  if (!response.ok) throw new Error(`Не удалось загрузить Liquid Glass: HTTP ${response.status}`);

  const source = await response.text();
  const isolatedSource = `"use strict";\n${source}\n//# sourceURL=liquid-tracker.runtime.js`;
  Function(isolatedSource)();
})().catch((error) => {
  console.error('Liquid Glass layer failed to start', error);
});
