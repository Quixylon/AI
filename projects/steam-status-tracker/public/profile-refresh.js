const avatar = document.querySelector('#profile-avatar');

let lastAvatarUrl = '';

async function refreshSteamAvatar() {
  if (!avatar) return;

  try {
    const response = await fetch(`./data/status.json?v=${Date.now()}`, {
      cache: 'no-store'
    });

    if (!response.ok) return;

    const status = await response.json();
    const avatarUrl = status?.player?.avatar;
    if (!avatarUrl) return;

    if (avatarUrl !== lastAvatarUrl) {
      const freshAvatarUrl = new URL(avatarUrl);
      freshAvatarUrl.searchParams.set('site-refresh', status.checkedAt || Date.now());
      avatar.src = freshAvatarUrl.toString();
      lastAvatarUrl = avatarUrl;
    }
  } catch {
    // Keep the last successfully loaded avatar when Steam data is unavailable.
  }
}

refreshSteamAvatar();
window.setInterval(refreshSteamAvatar, 60_000);
window.addEventListener('focus', refreshSteamAvatar);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) refreshSteamAvatar();
});
