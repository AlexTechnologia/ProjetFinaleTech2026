// VeilCraft item-icon generator — authors a cohesive SVG icon set (no network, deterministic).
// Output: assets/icons/items/<key>.svg  (64x64, rarity-tinted background + item glyph)
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'assets', 'icons', 'items');
mkdirSync(OUT, { recursive: true });

// ── palettes ────────────────────────────────────────────────
const RARITY = {
  common:    ['#3a3a46', '#21212a'],
  uncommon:  ['#2f5d3a', '#16301f'],
  rare:      ['#274a78', '#142944'],
  epic:      ['#542f78', '#2a1640'],
  legendary: ['#7a5a1e', '#3d2c0c'],
};
const METAL = {
  wood:  { h: '#7a5230', d: '#5a3a1f', l: '#9c6e44' },
  stone: { h: '#8a8a90', d: '#62626a', l: '#aeaeb6' },
  iron:  { h: '#c8ccd4', d: '#9098a4', l: '#e8ecf2' },
  steel: { h: '#aab4d6', d: '#7782a8', l: '#d3dbf2' },
  gold:  { h: '#f2c84b', d: '#c79a22', l: '#ffe88a' },
  flint: { h: '#5b6168', d: '#3c4046', l: '#7d848c' },
};
const HANDLE = '#6b4a2a', HANDLE_D = '#4a3019';

function svg(inner, rarity = 'common') {
  const [c0, c1] = RARITY[rarity] || RARITY.common;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
<defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
<stop offset="0" stop-color="${c0}"/><stop offset="1" stop-color="${c1}"/></linearGradient></defs>
<rect x="2" y="2" width="60" height="60" rx="12" fill="url(#bg)" stroke="#0008" stroke-width="2"/>
<rect x="4" y="4" width="56" height="26" rx="11" fill="#ffffff10"/>
${inner}</svg>
`;
}

// ── glyph builders ──────────────────────────────────────────
const log = (m) => `
<g transform="rotate(-32 32 32)">
<rect x="16" y="24" width="32" height="16" rx="6" fill="${m.h}" stroke="${m.d}" stroke-width="2"/>
<ellipse cx="18" cy="32" rx="4" ry="8" fill="${m.l}" stroke="${m.d}" stroke-width="2"/>
<circle cx="18" cy="32" r="2.4" fill="none" stroke="${m.d}" stroke-width="1.3"/></g>`;

const chunk = (m, spec = '#0006') => `
<path d="M20 40 L16 28 L28 18 L44 22 L48 36 L38 48 L24 47 Z" fill="${m.h}" stroke="${m.d}" stroke-width="2.2" stroke-linejoin="round"/>
<path d="M28 18 L34 30 L48 36" fill="none" stroke="${m.l}" stroke-width="1.6"/>
<circle cx="30" cy="36" r="2.2" fill="${spec}"/><circle cx="38" cy="30" r="1.7" fill="${spec}"/><circle cx="25" cy="30" r="1.5" fill="${spec}"/>`;

const ingot = (m) => `
<path d="M16 42 L20 32 L44 32 L48 42 Z" fill="${m.h}" stroke="${m.d}" stroke-width="2" stroke-linejoin="round"/>
<path d="M22 32 L24 26 L40 26 L42 32 Z" fill="${m.l}" stroke="${m.d}" stroke-width="2" stroke-linejoin="round"/>
<rect x="21" y="35" width="22" height="2" fill="#fff5"/>`;

const tool = (m, head) => `
<line x1="22" y1="50" x2="40" y2="18" stroke="${HANDLE}" stroke-width="5" stroke-linecap="round"/>
<line x1="22" y1="50" x2="40" y2="18" stroke="${HANDLE_D}" stroke-width="1.6" stroke-linecap="round"/>
${head(m)}`;

const axeHead = (m) => `<path d="M38 14 Q54 16 52 30 Q44 26 36 24 Z" fill="${m.h}" stroke="${m.d}" stroke-width="2" stroke-linejoin="round"/>`;
const pickHead = (m) => `<path d="M24 18 Q40 10 56 18 Q40 18 40 18 Q40 18 24 18 Z" fill="${m.h}" stroke="${m.d}" stroke-width="2.4" stroke-linecap="round"/>`;
const swordGlyph = (m) => `
<path d="M30 50 L40 14 L44 14 L40 50 Z" fill="${m.h}" stroke="${m.d}" stroke-width="2" stroke-linejoin="round"/>
<rect x="26" y="48" width="18" height="5" rx="2" transform="rotate(-12 35 50)" fill="#8a6a3a" stroke="#5a4222" stroke-width="1.5"/>
<rect x="31" y="52" width="5" height="9" rx="2" fill="${HANDLE}" stroke="${HANDLE_D}" stroke-width="1.4"/>`;
const shieldGlyph = (m) => `
<path d="M32 14 L50 20 Q50 42 32 52 Q14 42 14 20 Z" fill="${m.h}" stroke="${m.d}" stroke-width="2.4" stroke-linejoin="round"/>
<path d="M32 14 L32 52 M14 24 L50 24" stroke="${m.d}" stroke-width="1.6"/>`;
const bowGlyph = (m) => `
<path d="M44 12 Q22 32 44 52" fill="none" stroke="${m.h}" stroke-width="4" stroke-linecap="round"/>
<line x1="44" y1="12" x2="44" y2="52" stroke="#e8e8e8" stroke-width="1.4"/>
<line x1="18" y1="32" x2="48" y2="32" stroke="${HANDLE}" stroke-width="2.4"/>
<path d="M44 28 L52 32 L44 36 Z" fill="#cfcfcf"/>`;
const arrowGlyph = (m) => `
<line x1="14" y1="50" x2="50" y2="14" stroke="${HANDLE}" stroke-width="3"/>
<path d="M50 14 L42 16 L48 22 Z" fill="${m.h}" stroke="${m.d}" stroke-width="1.4"/>
<path d="M14 50 L20 44 M14 50 L20 52 M14 50 L12 44" stroke="#d9d2c0" stroke-width="2"/>`;
const armorGlyph = (m) => `
<path d="M20 18 L26 16 L32 20 L38 16 L44 18 L46 30 Q46 46 32 52 Q18 46 18 30 Z" fill="${m.h}" stroke="${m.d}" stroke-width="2.4" stroke-linejoin="round"/>
<path d="M32 20 L32 52 M24 28 L40 28" stroke="${m.d}" stroke-width="1.6"/>`;

const mushroom = (cap) => `
<rect x="28" y="34" width="8" height="16" rx="3" fill="#efe6cf" stroke="#cbbf9f" stroke-width="1.6"/>
<path d="M14 36 Q14 18 32 18 Q50 18 50 36 Z" fill="${cap}" stroke="#0006" stroke-width="2" stroke-linejoin="round"/>
<circle cx="24" cy="28" r="2.4" fill="#ffffffcc"/><circle cx="38" cy="26" r="2" fill="#ffffffcc"/>`;
const meat = (cooked) => `
<ellipse cx="34" cy="30" rx="15" ry="12" fill="${cooked ? '#8a4a26' : '#d98a8a'}" stroke="#0006" stroke-width="2"/>
<ellipse cx="34" cy="30" rx="15" ry="12" fill="none" stroke="${cooked ? '#5a2e16' : '#b56'}" stroke-width="1.4"/>
<rect x="40" y="38" width="5" height="16" rx="2.5" transform="rotate(-35 42 46)" fill="#f3ecd8" stroke="#cbbf9f" stroke-width="1.5"/>`;
const bread = `
<path d="M14 40 Q14 24 32 24 Q50 24 50 40 Q50 46 44 46 L20 46 Q14 46 14 40 Z" fill="#d8a24a" stroke="#a06a1e" stroke-width="2"/>
<path d="M24 28 L28 34 M32 27 L36 33 M40 28 L44 34" stroke="#a06a1e" stroke-width="1.6"/>`;
const soup = `
<path d="M14 32 Q14 48 32 48 Q50 48 50 32 Z" fill="#d9d9e0" stroke="#9aa" stroke-width="2"/>
<ellipse cx="32" cy="32" rx="18" ry="5" fill="#84cc16" stroke="#5a8a10" stroke-width="1.6"/>
<circle cx="26" cy="31" r="1.8" fill="#b639"/><circle cx="36" cy="32" r="1.6" fill="#e84"/>`;
const wheat = `
<line x1="32" y1="52" x2="32" y2="22" stroke="#caa23a" stroke-width="2.4"/>
<g fill="#f0c64a" stroke="#b8902a" stroke-width="1.2">
<ellipse cx="32" cy="18" rx="3" ry="5"/><ellipse cx="26" cy="24" rx="3" ry="5"/><ellipse cx="38" cy="24" rx="3" ry="5"/>
<ellipse cx="26" cy="32" rx="3" ry="5"/><ellipse cx="38" cy="32" rx="3" ry="5"/></g>`;
const brick = (m) => `
<rect x="14" y="26" width="36" height="22" rx="2" fill="${m.h}" stroke="${m.d}" stroke-width="2"/>
<path d="M14 37 L50 37 M26 26 L26 37 M38 37 L38 48 M20 37 L20 48" stroke="${m.d}" stroke-width="1.5"/>`;

// structures
const campfire = `
<g stroke="#5a3a1f" stroke-width="3" stroke-linecap="round"><line x1="18" y1="48" x2="46" y2="40"/><line x1="46" y1="48" x2="18" y2="40"/></g>
<path d="M32 16 Q40 26 34 34 Q44 32 40 44 Q32 50 24 44 Q20 34 30 32 Q26 24 32 16 Z" fill="#ff7a1a" stroke="#e65100" stroke-width="1.6"/>
<path d="M32 26 Q36 32 33 38 Q30 40 29 36 Q28 30 32 26 Z" fill="#ffd34d"/>`;
const workbench = `
<rect x="16" y="26" width="32" height="8" fill="#9c6e44" stroke="#5a3a1f" stroke-width="2"/>
<rect x="18" y="34" width="5" height="16" fill="#7a5230" stroke="#5a3a1f" stroke-width="1.6"/>
<rect x="41" y="34" width="5" height="16" fill="#7a5230" stroke="#5a3a1f" stroke-width="1.6"/>
<line x1="34" y1="18" x2="44" y2="26" stroke="#c8ccd4" stroke-width="3" stroke-linecap="round"/>`;
const furnace = `
<rect x="18" y="20" width="28" height="30" rx="3" fill="#6a6a72" stroke="#3a3a40" stroke-width="2"/>
<rect x="24" y="32" width="16" height="14" rx="2" fill="#1a1a1f"/>
<path d="M28 44 Q32 38 36 44 Z" fill="#ff7a1a"/>`;
const anvil = `
<path d="M16 28 L48 28 L48 33 L40 33 L44 40 L20 40 L24 33 L16 33 Z" fill="#5a5a64" stroke="#2e2e36" stroke-width="2" stroke-linejoin="round"/>
<rect x="26" y="40" width="12" height="10" fill="#4a4a54" stroke="#2e2e36" stroke-width="2"/>`;
const cauldron = `
<rect x="22" y="18" width="20" height="4" fill="#7a7a82"/>
<path d="M18 24 Q18 48 32 48 Q46 48 46 24 Z" fill="#3a3a42" stroke="#1e1e24" stroke-width="2"/>
<ellipse cx="32" cy="26" rx="14" ry="4" fill="#5a8a10"/>`;
const bed = `
<rect x="12" y="34" width="40" height="14" rx="3" fill="#7a5230" stroke="#4a3019" stroke-width="2"/>
<rect x="12" y="30" width="40" height="8" rx="3" fill="#c0392b" stroke="#8a2a20" stroke-width="1.6"/>
<rect x="14" y="28" width="12" height="8" rx="3" fill="#f0f0f0" stroke="#bbb" stroke-width="1.4"/>
<rect x="12" y="46" width="5" height="8" fill="#4a3019"/><rect x="47" y="46" width="5" height="8" fill="#4a3019"/>`;
const chest = `
<rect x="16" y="30" width="32" height="18" rx="2" fill="#9c6e44" stroke="#5a3a1f" stroke-width="2"/>
<path d="M16 30 Q16 22 32 22 Q48 22 48 30 Z" fill="#7a5230" stroke="#5a3a1f" stroke-width="2"/>
<rect x="29" y="33" width="6" height="8" rx="1" fill="#f2c84b" stroke="#a07a1e" stroke-width="1.4"/>`;
const wall = (m) => `<rect x="16" y="18" width="32" height="34" rx="2" fill="${m.h}" stroke="${m.d}" stroke-width="2"/>
<path d="M16 29 L48 29 M16 41 L48 41 M32 18 L32 29 M24 29 L24 41 M40 41 L40 52" stroke="${m.d}" stroke-width="1.4"/>`;
const door = `<rect x="20" y="16" width="24" height="38" rx="2" fill="#7a5230" stroke="#4a3019" stroke-width="2"/>
<rect x="24" y="20" width="16" height="14" fill="#8a5e36" stroke="#4a3019" stroke-width="1.4"/><circle cx="38" cy="36" r="2" fill="#f2c84b"/>`;

// ── item -> (rarity, glyph) ─────────────────────────────────
const I = {
  wood:        ['common', log(METAL.wood)],
  birch_wood:  ['common', log({h:'#cdbfa0',d:'#9c8e6e',l:'#e6dcc4'})],
  bark:        ['common', chunk({h:'#6b4c2a',d:'#46301a',l:'#86643c'})],
  rock:        ['common', chunk(METAL.stone)],
  flint:       ['common', chunk(METAL.flint, '#222')],
  iron_ore:    ['uncommon', chunk({h:'#9a8a7a',d:'#6a5a4a',l:'#b8a898'}, '#c8783c')],
  gold_ore:    ['rare', chunk({h:'#9a8a6a',d:'#6a5a3a',l:'#b8a87a'}, '#f2c84b')],
  coal:        ['common', chunk({h:'#3a3a40',d:'#18181c',l:'#55555c'}, '#000')],
  iron_bar:    ['uncommon', ingot(METAL.iron)],
  gold_bar:    ['rare', ingot(METAL.gold)],
  stone_brick: ['common', brick(METAL.stone)],
  wheat:       ['common', wheat],
  string:      ['common', `<path d="M20 20 Q44 28 24 36 Q44 44 22 50" fill="none" stroke="#e8e2d0" stroke-width="3" stroke-linecap="round"/>`],
  leather:     ['common', `<path d="M18 22 L46 22 L48 42 Q32 52 16 42 Z" fill="#a0673a" stroke="#6a4424" stroke-width="2" stroke-linejoin="round"/><path d="M22 26 L42 26" stroke="#6a4424" stroke-width="1.4"/>`],

  raw_meat:    ['common', meat(false)],
  cooked_meat: ['uncommon', meat(true)],
  pink_shroom: ['uncommon', mushroom('#f472b6')],
  red_shroom:  ['uncommon', mushroom('#ef4444')],
  yellow_shroom:['uncommon', mushroom('#fbbf24')],
  berries:     ['common', `<g fill="#c0392b" stroke="#8a2420" stroke-width="1.4"><circle cx="26" cy="34" r="7"/><circle cx="38" cy="32" r="7"/><circle cx="32" cy="42" r="7"/></g>`],
  bread:       ['common', bread],
  soup:        ['uncommon', soup],

  wooden_axe:      ['common', tool(METAL.wood, axeHead)],
  wooden_pickaxe:  ['common', tool(METAL.wood, pickHead)],
  wooden_sword:    ['common', swordGlyph(METAL.wood)],
  wooden_shield:   ['common', shieldGlyph(METAL.wood)],
  stone_axe:       ['common', tool(METAL.stone, axeHead)],
  stone_pickaxe:   ['common', tool(METAL.stone, pickHead)],
  stone_sword:     ['uncommon', swordGlyph(METAL.stone)],
  iron_axe:        ['uncommon', tool(METAL.iron, axeHead)],
  iron_pickaxe:    ['uncommon', tool(METAL.iron, pickHead)],
  iron_sword:      ['rare', swordGlyph(METAL.iron)],
  steel_sword:     ['epic', swordGlyph(METAL.steel)],
  gold_sword:      ['epic', swordGlyph(METAL.gold)],
  bow:             ['rare', bowGlyph(METAL.wood)],
  flint_arrows:    ['common', arrowGlyph(METAL.flint)],
  leather_armor:   ['uncommon', armorGlyph({h:'#a0673a',d:'#6a4424',l:'#c08858'})],
  iron_armor:      ['rare', armorGlyph(METAL.iron)],
  gold_armor:      ['epic', armorGlyph(METAL.gold)],

  campfire:        ['common', campfire],
  workbench:       ['common', workbench],
  furnace:         ['uncommon', furnace],
  anvil:           ['uncommon', anvil],
  cauldron:        ['uncommon', cauldron],
  fletching_table: ['uncommon', workbench],
  bed:             ['uncommon', bed],
  chest:           ['common', chest],
  wood_wall:       ['common', wall(METAL.wood)],
  stone_wall:      ['common', wall(METAL.stone)],
  wood_door:       ['common', door],
};

let n = 0;
for (const [key, [rarity, glyph]] of Object.entries(I)) {
  writeFileSync(join(OUT, key + '.svg'), svg(glyph, rarity));
  n++;
}
console.log('Wrote ' + n + ' item icons to ' + OUT);
