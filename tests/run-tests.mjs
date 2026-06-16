#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════
//  VeilCraft — headless test suite
//  @authors Eric Villeneuve & Alex Musial — ICS3U 2026
//
//  Runs in pure Node (no browser / no WebGL). The browser game scripts are
//  loaded inside a `vm` sandbox with light DOM/THREE stubs so we can assert
//  on the real data tables and deterministic generation logic.
//
//  Usage:  node tests/run-tests.mjs
//  Exit code 0 = all green, 1 = at least one failure.
// ════════════════════════════════════════════════════════════════════════
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const JS = (f) => path.join(ROOT, 'js', f);
const read = (p) => fs.readFileSync(p, 'utf8');

// ── tiny test harness ───────────────────────────────────────────────────
let passed = 0, failed = 0;
const failures = [];
function ok(cond, msg) {
  if (cond) { passed++; }
  else { failed++; failures.push(msg); console.log('  \u2717 ' + msg); }
}
function section(name) { console.log('\n\u2500\u2500 ' + name + ' \u2500\u2500'); }
function eq(a, b, msg) { ok(a === b, `${msg} (expected ${JSON.stringify(b)}, got ${JSON.stringify(a)})`); }

// ── DOM / THREE / browser stubs ─────────────────────────────────────────
function makeEl() {
  const el = {
    style: {}, dataset: {}, children: [], classList: {
      add() {}, remove() {}, toggle() {}, contains() { return false; },
    },
    setAttribute() {}, removeAttribute() {}, getAttribute() { return null; },
    appendChild(c) { this.children.push(c); return c; }, append() {},
    remove() {}, addEventListener() {}, removeEventListener() {},
    querySelector() { return null; }, querySelectorAll() { return []; },
    insertBefore() {}, cloneNode() { return makeEl(); },
    set textContent(v) { this._t = v; }, get textContent() { return this._t || ''; },
    set innerHTML(v) { this._h = v; }, get innerHTML() { return this._h || ''; },
    focus() {}, blur() {}, getContext() { return null; },
  };
  return el;
}
const THREE = new Proxy(function () {}, {
  get() { return THREE; },
  apply() { return THREE; },
  construct() { return new Proxy({}, { get() { return () => {}; } }); },
});

function buildSandbox() {
  const win = {};
  const doc = {
    addEventListener() {}, removeEventListener() {},
    getElementById() { return null; }, querySelector() { return null; },
    querySelectorAll() { return []; }, createElement() { return makeEl(); },
    createElementNS() { return makeEl(); }, body: makeEl(), head: makeEl(),
  };
  win.document = doc;
  win.addEventListener = () => {};
  win.removeEventListener = () => {};
  win.requestAnimationFrame = () => 0;
  win.cancelAnimationFrame = () => {};
  win.location = { href: '', hostname: 'localhost', search: '' };
  win.navigator = { userAgent: 'node', clipboard: { writeText() {} } };
  const sandbox = {
    window: win, document: doc, THREE, console,
    setTimeout: () => 0, clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {},
    requestAnimationFrame: () => 0, cancelAnimationFrame: () => {},
    localStorage: { _d: {}, getItem(k) { return this._d[k] ?? null; }, setItem(k, v) { this._d[k] = String(v); }, removeItem(k) { delete this._d[k]; } },
    navigator: win.navigator, location: win.location,
    performance: { now: () => Date.now() },
    alert: () => {}, prompt: () => null, confirm: () => true,
    Peer: function () { return { on() {}, connect() { return { on() {} }; } }; },
    URL, Blob: function () {}, FileReader: function () {},
  };
  sandbox.globalThis = sandbox;
  return sandbox;
}

// ── load the game scripts into one shared context ───────────────────────
const sandbox = buildSandbox();
const ctx = vm.createContext(sandbox);
function runFile(file, captureTail = '') {
  const src = read(JS(file)) + (captureTail ? '\n;' + captureTail : '');
  try {
    vm.runInContext(src, ctx, { filename: file });
    return true;
  } catch (e) {
    console.log(`  (note: ${file} threw during load: ${e.message})`);
    return false;
  }
}

runFile('icons.js');
runFile('world.js', 'globalThis.__WORLD = { World, WORLD, RESOURCE_DROPS, mulberry32 };');
runFile('crafting.js', 'globalThis.__CRAFT = { RECIPES, CONSUMABLE_EFFECTS, TOOL_STATS, CraftingSystem, craftingSystem };');
runFile('main.js'); // window.ITEM_DB is assigned near the top; safe even if a later line throws.

const ITEM_DB = sandbox.window.ITEM_DB;
const VCIcons = sandbox.window.VCIcons;
const { World, WORLD, RESOURCE_DROPS } = sandbox.__WORLD || {};
const { RECIPES, CONSUMABLE_EFFECTS, TOOL_STATS, CraftingSystem } = sandbox.__CRAFT || {};

const RARITIES = new Set(['common', 'uncommon', 'rare', 'epic', 'legendary']);
const WORKSTATIONS = new Set([null, undefined, 'campfire', 'workbench', 'furnace', 'anvil', 'fletching_table', 'cauldron']);

// ════════════════════════════════════════════════════════════════════════
//  1. ITEM_DB integrity
// ════════════════════════════════════════════════════════════════════════
section('ITEM_DB integrity');
ok(ITEM_DB && typeof ITEM_DB === 'object', 'ITEM_DB loaded from main.js');
if (ITEM_DB) {
  const keys = Object.keys(ITEM_DB);
  ok(keys.length >= 50, `ITEM_DB has \u2265 50 items (found ${keys.length})`);
  for (const k of keys) {
    const it = ITEM_DB[k];
    ok(it && typeof it.name === 'string' && it.name.length > 0, `${k}: has name`);
    ok(typeof it.icon === 'string' && it.icon.length > 0, `${k}: has emoji fallback icon`);
    ok(typeof it.iconKey === 'string' && it.iconKey.length > 0, `${k}: has iconKey`);
    ok(typeof it.type === 'string' && it.type.length > 0, `${k}: has type`);
    ok(RARITIES.has(it.rarity), `${k}: rarity '${it.rarity}' is valid`);
    ok(Number.isFinite(it.stack) && it.stack >= 1, `${k}: stack \u2265 1`);
    ok(Number.isFinite(it.value) && it.value >= 0, `${k}: value \u2265 0`);
    ok(typeof it.desc === 'string' && it.desc.length > 0, `${k}: has description`);
  }
}

// ════════════════════════════════════════════════════════════════════════
//  2. Icon assets exist on disk and match ITEM_DB iconKeys
// ════════════════════════════════════════════════════════════════════════
section('Icon assets');
const ICON_DIR = path.join(ROOT, 'assets', 'icons', 'items');
ok(fs.existsSync(ICON_DIR), 'assets/icons/items/ exists');
if (ITEM_DB && fs.existsSync(ICON_DIR)) {
  for (const k of Object.keys(ITEM_DB)) {
    const key = ITEM_DB[k].iconKey;
    const file = path.join(ICON_DIR, key + '.svg');
    const exists = fs.existsSync(file);
    ok(exists, `icon file exists for '${key}' (${k})`);
    if (exists) {
      const svg = read(file);
      ok(/<svg[\s>]/.test(svg) && /<\/svg>/.test(svg), `${key}.svg is well-formed`);
    }
  }
}
if (VCIcons) {
  ok(typeof VCIcons.has === 'function' && typeof VCIcons.url === 'function', 'VCIcons API present');
  if (ITEM_DB) {
    for (const k of Object.keys(ITEM_DB)) {
      ok(VCIcons.has(ITEM_DB[k].iconKey), `VCIcons knows '${ITEM_DB[k].iconKey}'`);
    }
  }
}

// ════════════════════════════════════════════════════════════════════════
//  3. Recipe validity
// ════════════════════════════════════════════════════════════════════════
section('Recipes');
ok(Array.isArray(RECIPES) && RECIPES.length > 0, `RECIPES loaded (${RECIPES ? RECIPES.length : 0})`);
if (Array.isArray(RECIPES) && ITEM_DB) {
  const ids = new Set();
  for (const r of RECIPES) {
    ok(typeof r.id === 'string' && !ids.has(r.id), `recipe id '${r.id}' is unique`);
    ids.add(r.id);
    ok(ITEM_DB[r.result.type] != null, `recipe '${r.id}' result '${r.result?.type}' \u2208 ITEM_DB`);
    ok(r.result.count >= 1, `recipe '${r.id}' result count \u2265 1`);
    ok(WORKSTATIONS.has(r.workstation), `recipe '${r.id}' workstation '${r.workstation}' valid`);
    for (const ing of r.ingredients) {
      ok(ITEM_DB[ing.type] != null, `recipe '${r.id}' ingredient '${ing.type}' \u2208 ITEM_DB`);
      ok(ing.count >= 1, `recipe '${r.id}' ingredient '${ing.type}' count \u2265 1`);
    }
  }
}

// ════════════════════════════════════════════════════════════════════════
//  4. Stat tables reference only real items
// ════════════════════════════════════════════════════════════════════════
section('Stat tables');
if (CONSUMABLE_EFFECTS && ITEM_DB) {
  for (const k of Object.keys(CONSUMABLE_EFFECTS)) ok(ITEM_DB[k] != null, `consumable '${k}' \u2208 ITEM_DB`);
}
if (TOOL_STATS && ITEM_DB) {
  for (const k of Object.keys(TOOL_STATS)) ok(k === 'fist' || ITEM_DB[k] != null, `tool stat '${k}' \u2208 ITEM_DB`);
}

// ════════════════════════════════════════════════════════════════════════
//  5. Crafting system behaviour (array-backed inventory)
// ════════════════════════════════════════════════════════════════════════
section('Crafting system');
if (CraftingSystem && Array.isArray(RECIPES)) {
  const cs = new CraftingSystem();
  const basic = RECIPES.find(r => !r.workstation);
  ok(basic != null, 'at least one no-workstation recipe exists');
  if (basic) {
    const inv = new Array(20).fill(null);
    // stock exactly the ingredients
    for (const ing of basic.ingredients) inv[inv.indexOf(null)] = { type: ing.type, count: ing.count };
    eq(cs.canCraft(basic, inv), true, `can craft '${basic.id}' with exact ingredients`);
    const res = cs.craft(basic.id, inv, null);
    ok(res.success, `craft '${basic.id}' succeeds`);
    eq(cs.countItem(inv, basic.result.type) >= basic.result.count, true, `result '${basic.result.type}' added to inventory`);
    for (const ing of basic.ingredients) eq(cs.countItem(inv, ing.type), 0, `ingredient '${ing.type}' consumed`);
    // can no longer craft (ingredients gone)
    eq(cs.canCraft(basic, inv), false, 'cannot re-craft after ingredients consumed');
  }
  // stacking: addItem merges onto an existing stack
  const inv2 = new Array(10).fill(null);
  cs.addItem(inv2, { type: 'wood', count: 5 });
  cs.addItem(inv2, { type: 'wood', count: 3 });
  eq(cs.countItem(inv2, 'wood'), 8, 'stacking merges identical items');
  // consumable clamps to max
  const player = { health: 90, maxHealth: 100, hunger: 50, maxHunger: 100, stamina: 80, maxStamina: 100 };
  cs.applyConsumable('bread', player);
  eq(player.hunger, 90, 'bread restores hunger (+40 clamped)');
  eq(player.health, 100, 'bread heal clamps at maxHealth');
}

// ════════════════════════════════════════════════════════════════════════
//  6. World generation — determinism
// ════════════════════════════════════════════════════════════════════════
section('World determinism');
function snapshot(seed) {
  const w = new World();
  w.generate(seed);
  return [...w.resources.values()]
    .map(r => `${r.networkId}:${r.type}:${r.position.x.toFixed(3)}:${r.position.y.toFixed(3)}:${r.position.z.toFixed(3)}`)
    .join('|');
}
if (World) {
  const a = snapshot(123456);
  const b = snapshot(123456);
  eq(a, b, 'same seed \u2192 identical world');
  const c = snapshot(999999);
  ok(a !== c, 'different seed \u2192 different world');
}

// ════════════════════════════════════════════════════════════════════════
//  7. World generation — caves & terrain sanity
// ════════════════════════════════════════════════════════════════════════
section('Caves & terrain');
if (World) {
  const w = new World();
  w.generate(424242);
  // terrain never produces NaN/Infinity across a coarse grid
  let finite = true, maxCave = -1, caveSamples = 0;
  for (let x = -WORLD.ISLAND_RADIUS; x <= WORLD.ISLAND_RADIUS; x += 12) {
    for (let z = -WORLD.ISLAND_RADIUS; z <= WORLD.ISLAND_RADIUS; z += 12) {
      const h = w.getHeightAt(x, z);
      if (!Number.isFinite(h)) finite = false;
      const cd = w.caveDepth(x, z);
      if (!(cd >= 0 && cd <= 1)) finite = false;
      maxCave = Math.max(maxCave, w.caveField(x, z));
      if (cd > 0.25) caveSamples++;
    }
  }
  ok(finite, 'getHeightAt & caveDepth are finite / in-range everywhere');
  ok(maxCave > 0.45, `grotto zones exist (max caveField ${maxCave.toFixed(2)})`);
  ok(caveSamples > 0, `grid contains carved grotto cells (${caveSamples})`);
  // cave-only ores were generated and sit inside grotto zones
  const byType = {};
  for (const r of w.resources.values()) byType[r.type] = (byType[r.type] || 0) + 1;
  ok((byType.coal || 0) > 0, `coal ore generated (${byType.coal || 0})`);
  ok((byType.gold_ore || 0) > 0, `gold ore generated (${byType.gold_ore || 0})`);
  let oresInCaves = true;
  for (const r of w.resources.values()) {
    if (r.type === 'coal' || r.type === 'gold_ore') {
      if (w.caveDepth(r.position.x, r.position.z) < 0.3) oresInCaves = false;
    }
  }
  ok(oresInCaves, 'all coal & gold ore spawned inside grotto zones');
  // drops resolve to real items
  for (const t of ['coal', 'gold_ore', 'iron_ore']) {
    const drops = RESOURCE_DROPS[t] ? RESOURCE_DROPS[t]() : [];
    ok(drops.length > 0 && drops.every(d => ITEM_DB[d.type] != null), `'${t}' drops valid items`);
  }
}

// ── summary ─────────────────────────────────────────────────────────────
console.log(`\n${'='.repeat(56)}`);
console.log(`  RESULT: ${passed} passed, ${failed} failed`);
console.log('='.repeat(56));
if (failed > 0) {
  console.log('\nFailed assertions:');
  for (const f of failures) console.log('  \u2717 ' + f);
  process.exit(1);
}
console.log('  All green \u2713');
process.exit(0);
