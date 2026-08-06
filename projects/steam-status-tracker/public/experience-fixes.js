'use strict';

// Compatibility for overview links inherited from the supplied reference layout.
document.addEventListener('click', event => {
  const link = event.target.closest('a[href="#tracker-steam"], a[href="#tracker-discord"], a[href="#tracker-telegram"]');
  if (!link) return;
  event.preventDefault();
  location.hash = link.getAttribute('href').replace('#tracker-', '#tracker/');
});
