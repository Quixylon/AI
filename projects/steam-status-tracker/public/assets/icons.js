(() => {
'use strict';
const icons = ICONS;
function kind(link){const explicit=link?.dataset?.icon||link?.dataset?.kind||link?.getAttribute?.('data-link-kind');if(explicit&&icons[explicit])return explicit;const source=`${link?.href||''} ${link?.textContent||''}`.toLowerCase();if(source.includes('t.me')||source.includes('telegram'))return'telegram';if(source.includes('discord'))return'discord';if(source.includes('roblox'))return'roblox';if(source.includes('tiktok'))return'tiktok';if(source.includes('steam'))return'steam';if(source.includes('csrep'))return'csrep';if(source.includes('github'))return'github';return'generic'}
function apply(){document.querySelectorAll('.social-link').forEach(link=>{const icon=link.querySelector('.social-link__icon'),k=kind(link);if(!icon||icon.dataset.polishIcon===k)return;link.dataset.polishKind=k;icon.innerHTML=icons[k]||icons.generic;icon.dataset.polishIcon=k});document.querySelectorAll('.platform-logo[data-icon]').forEach(icon=>{const k=icon.dataset.icon;if(!icons[k]||icon.dataset.polishIcon===k)return;icon.innerHTML=icons[k];icon.dataset.polishIcon=k})}
window.renderBrandIcons = apply;
apply();
})();
