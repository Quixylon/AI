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
