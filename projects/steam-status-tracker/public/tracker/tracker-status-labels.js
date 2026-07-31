const historyList = document.querySelector('#history-list');

function updateCurrentStatusLabels() {
  if (!historyList) return;

  historyList.querySelectorAll('.history-entry').forEach((entry) => {
    const currentBadge = entry.querySelector('.history-badge.current');
    const durationLabel = entry.querySelector('.history-duration-row > span');

    if (!currentBadge || !durationLabel) return;

    const nextLabel = entry.classList.contains('offline')
      ? 'Не в сети уже'
      : 'Уже в сети';

    if (durationLabel.textContent !== nextLabel) {
      durationLabel.textContent = nextLabel;
    }
  });
}

if (historyList) {
  new MutationObserver(updateCurrentStatusLabels).observe(historyList, {
    childList: true,
    subtree: true
  });

  updateCurrentStatusLabels();
}
