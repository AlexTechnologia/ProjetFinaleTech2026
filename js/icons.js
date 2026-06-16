// ─────────────────────────────────────────────────────────────
// VeilCraft — Item icon resolver
// Maps an item key to its authored SVG icon in assets/icons/items/.
// Falls back gracefully (returns null) when no icon exists, so callers
// can keep their emoji fallback. Pure, no dependencies, browser-safe.
// ─────────────────────────────────────────────────────────────
(function () {
  const BASE = 'assets/icons/items/';
  // Keys mirror the generated SVG filenames (see tools/gen-icons.mjs).
  const SET = new Set([
    'anvil', 'bark', 'bed', 'berries', 'birch_wood', 'bow', 'bread',
    'campfire', 'cauldron', 'chest', 'coal', 'cooked_meat', 'fletching_table',
    'flint', 'flint_arrows', 'furnace', 'gold_armor', 'gold_bar', 'gold_ore',
    'gold_sword', 'iron_armor', 'iron_axe', 'iron_bar', 'iron_ore',
    'iron_pickaxe', 'iron_sword', 'leather', 'leather_armor', 'pink_shroom',
    'raw_meat', 'red_shroom', 'rock', 'soup', 'steel_sword', 'stone_axe',
    'stone_brick', 'stone_pickaxe', 'stone_sword', 'stone_wall', 'string',
    'wheat', 'wood', 'wood_door', 'wood_wall', 'wooden_axe', 'wooden_pickaxe',
    'wooden_shield', 'wooden_sword', 'workbench', 'yellow_shroom',
  ]);

  function has(key) { return SET.has(key); }
  function url(key) { return SET.has(key) ? BASE + key + '.svg' : null; }

  // Build an <img> element for the icon, or null if none exists.
  function el(key, className) {
    const u = url(key);
    if (!u) return null;
    const img = document.createElement('img');
    img.className = className || 'vc-icon';
    img.src = u;
    img.alt = '';
    img.draggable = false;
    return img;
  }

  // Inject an icon into a parent element. Uses the SVG when available,
  // otherwise writes the emoji fallback as text. Always succeeds.
  function into(parent, key, emojiFallback, className) {
    const img = el(key, className);
    if (img) { parent.appendChild(img); return img; }
    const span = document.createElement('span');
    span.className = (className || 'vc-icon') + ' vc-icon-emoji';
    span.textContent = emojiFallback || '📦';
    parent.appendChild(span);
    return span;
  }

  window.VCIcons = { has, url, el, into, SET, BASE };
})();
