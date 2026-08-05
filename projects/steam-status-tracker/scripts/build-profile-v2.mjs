import { readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';

const root = 'projects/steam-status-tracker/public/profile-v2';
const encoded = [1, 2, 3, 4]
  .map((index) => readFileSync(join(root, `payload-${index}.txt`), 'utf8').trim())
  .join('');

const source = gunzipSync(Buffer.from(encoded, 'base64')).toString('utf8');
const motionPatch = `
<style id="profile-motion-patch">
  .cat {
    display: inline-grid !important;
    width: auto !important;
    height: auto !important;
    margin: -.18em -.12em -.18em -.06em !important;
    padding: .08em !important;
    border: 0 !important;
    border-radius: 0 !important;
    background: transparent !important;
    box-shadow: none !important;
    font-size: 1em !important;
    line-height: 1 !important;
  }

  .word {
    transform-origin: 50% 75%;
    animation:
      word-in .52s cubic-bezier(.2,.8,.2,1) forwards,
      word-glow-polished 4.8s ease-in-out infinite,
      word-drift-polished 5.6s ease-in-out infinite !important;
    animation-delay:
      calc(170ms + var(--i)*42ms),
      calc(900ms + var(--i)*-165ms),
      calc(900ms + var(--i)*-210ms) !important;
    will-change: translate, scale, color, text-shadow;
  }

  .signal-line {
    position: relative !important;
    display: block !important;
    height: 16px !important;
  }

  .signal-line::before {
    position: absolute !important;
    left: 0 !important;
    right: 0 !important;
    top: 50% !important;
    height: 1px !important;
    translate: 0 -50% !important;
    background: linear-gradient(90deg, transparent, rgba(166,151,255,.72) 18%, rgba(97,205,250,.58) 82%, transparent) !important;
  }

  .signal-line b {
    position: absolute !important;
    z-index: 2 !important;
    left: 0;
    top: 50% !important;
    width: 8px !important;
    height: 8px !important;
    border-radius: 50% !important;
    background: #f3f4ff !important;
    box-shadow: 0 0 10px rgba(255,255,255,.95), 0 0 22px rgba(166,151,255,.72) !important;
    translate: -50% -50% !important;
    animation: signal-travel-polished 5.4s cubic-bezier(.45,.05,.55,.95) infinite !important;
    will-change: left, scale, opacity;
  }

  .signal-line i {
    position: absolute !important;
    right: 0 !important;
    top: 50% !important;
    translate: 0 -50% !important;
  }

  @keyframes word-glow-polished {
    0%, 100% { color: #c5cbd8; text-shadow: 0 0 0 rgba(166,151,255,0); }
    38% { color: #f4f5fb; text-shadow: 0 0 14px rgba(166,151,255,.24); }
    62% { color: #d8e9f6; text-shadow: 0 0 10px rgba(97,205,250,.15); }
  }

  @keyframes word-drift-polished {
    0%, 100% { translate: 0 0; scale: 1; }
    28% { translate: 0 -2.2px; scale: 1.012; }
    54% { translate: 0 .8px; scale: .998; }
    76% { translate: 0 -1px; scale: 1.006; }
  }

  @keyframes signal-travel-polished {
    0% { left: 0%; opacity: .15; scale: .72; }
    10% { opacity: 1; scale: 1; }
    48% { scale: 1.24; }
    90% { opacity: 1; scale: 1; }
    100% { left: 100%; opacity: .15; scale: .72; }
  }
</style>`;

const html = source.replace('</head>', `${motionPatch}\n</head>`);
writeFileSync(join(root, 'index.html'), html);
console.log(`Built profile-v2/index.html (${Buffer.byteLength(html)} bytes)`);
