const description = document.querySelector('#profile-description');

function applyWordDelays() {
  if (!description) return;

  description.querySelectorAll('.description-word').forEach((word, index) => {
    word.style.setProperty('--word-entry-delay', `${170 + index * 45}ms`);
    word.style.setProperty('--word-flow-delay', `${index * -180}ms`);
  });
}

if (description) {
  const observer = new MutationObserver(applyWordDelays);
  observer.observe(description, { childList: true });
  applyWordDelays();
}

/* Canvas создаётся в app.js. Усиливаем только его соединительные линии:
   делаем широкий мягкий проход и второй более чёткий проход поверх. */
const backgroundCanvas = document.querySelector('#interactive-background');
const backgroundContext = backgroundCanvas?.getContext('2d');

if (backgroundContext && !backgroundContext.__quixylonStrokeBoost) {
  const nativeStroke = backgroundContext.stroke.bind(backgroundContext);

  backgroundContext.stroke = function boostedStroke(...args) {
    const originalWidth = this.lineWidth;
    const originalBlur = this.shadowBlur;
    const originalShadowColor = this.shadowColor;

    try {
      this.lineWidth = Math.max(1.3, originalWidth * 1.9);
      this.shadowBlur = Math.max(3, originalBlur);
      this.shadowColor = 'rgba(166, 157, 255, 0.3)';
      nativeStroke(...args);

      this.lineWidth = Math.max(1, originalWidth * 1.28);
      this.shadowBlur = 0;
      return nativeStroke(...args);
    } finally {
      this.lineWidth = originalWidth;
      this.shadowBlur = originalBlur;
      this.shadowColor = originalShadowColor;
    }
  };

  backgroundContext.__quixylonStrokeBoost = true;
}
