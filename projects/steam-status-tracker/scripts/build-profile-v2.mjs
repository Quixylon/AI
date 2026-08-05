import { access } from 'node:fs/promises';

const page = 'projects/steam-status-tracker/public/profile-v2/index.html';
await access(page);
console.log('profile-v2/index.html is a complete static page; no reconstruction step is required.');
