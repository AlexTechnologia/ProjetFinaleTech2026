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
// Caves must load before world.js so world.generate() can see VCCaves. In the
// vm sandbox, window.VCCaves does not create a bare global, so we promote it
// onto the context global explicitly (mirrors the browser, where it is global).
runFile('caves.js', 'globalThis.VCCaves = (typeof window !== "undefined" && window.VCCaves) ? window.VCCaves : (typeof VCCaves !== "undefined" ? VCCaves : undefined); globalThis.__CAVES = globalThis.VCCaves;');
runFile('world.js', 'globalThis.__WORLD = { World, WORLD, RESOURCE_DROPS, mulberry32 };');
runFile('crafting.js', 'globalThis.__CRAFT = { RECIPES, CONSUMABLE_EFFECTS, TOOL_STATS, CraftingSystem, craftingSystem };');
runFile('main.js'); // window.ITEM_DB is assigned near the top; safe even if a later line throws.
// player.js defines its OWN slimmer ITEM_DB and reassigns window.ITEM_DB at the
// end of the file. We want its Inventory/Player exports but must keep main.js's
// complete ITEM_DB, so snapshot it and restore afterward.
const __mainItemDb = sandbox.window.ITEM_DB;
runFile('player.js'); // exposes window.Player / window.Inventory at the end of the file.
if (__mainItemDb) sandbox.window.ITEM_DB = __mainItemDb;

const ITEM_DB = sandbox.window.ITEM_DB;
const VCIcons = sandbox.window.VCIcons;
const { World, WORLD, RESOURCE_DROPS, mulberry32 } = sandbox.__WORLD || {};
const VCCaves = sandbox.__CAVES;
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
    // Skip deposits placed by the new VCCaves chamber system (validated below);
    // this check covers only the legacy grotto-zone ore placement.
    if (r.inCave) continue;
    if (r.type === 'coal' || r.type === 'gold_ore') {
      if (w.caveDepth(r.position.x, r.position.z) < 0.3) oresInCaves = false;
    }
  }
  ok(oresInCaves, 'all legacy coal & gold ore spawned inside grotto zones');
  // drops resolve to real items
  for (const t of ['coal', 'gold_ore', 'iron_ore']) {
    const drops = RESOURCE_DROPS[t] ? RESOURCE_DROPS[t]() : [];
    ok(drops.length > 0 && drops.every(d => ITEM_DB[d.type] != null), `'${t}' drops valid items`);
  }
}

// ════════════════════════════════════════════════════════════════════════
section('Real cave systems (VCCaves)');
if (VCCaves && WORLD) {
  ok(typeof VCCaves.generateCaveSystems === 'function', 'VCCaves.generateCaveSystems exists');
  ok(typeof VCCaves.sampleCaves === 'function', 'VCCaves.sampleCaves exists');
  ok(typeof VCCaves.inEntrance === 'function', 'VCCaves.inEntrance exists');
  ok(typeof VCCaves.entranceCarve === 'function', 'VCCaves.entranceCarve exists');
  ok(typeof VCCaves.isInside === 'function', 'VCCaves.isInside exists');
  ok(typeof VCCaves.distToSegment === 'function', 'VCCaves.distToSegment exists');

  const mk = (seed) => {
    const rng = mulberry32(seed);
    return VCCaves.generateCaveSystems(rng, () => 5, { count: 5, islandRadius: WORLD.ISLAND_RADIUS });
  };
  const a = mk(42), b = mk(42), c = mk(99);
  ok(Array.isArray(a) && a.length === 5, `generates requested count (${a && a.length})`);
  ok(JSON.stringify(a) === JSON.stringify(b), 'generation is deterministic for a fixed seed');
  ok(JSON.stringify(a) !== JSON.stringify(c), 'different seeds yield different cave layouts');

  // Structural sanity on every system.
  let structureOk = true, floorBelowCeil = true, depositsOk = true;
  for (const sys of a) {
    if (!sys.entrance || !Array.isArray(sys.chambers) || sys.chambers.length < 1) structureOk = false;
    if (!Array.isArray(sys.tunnels) || !Array.isArray(sys.deposits) || !Array.isArray(sys.crystals)) structureOk = false;
    for (const ch of sys.chambers || []) {
      if (!(ch.floorY < ch.ceilY)) floorBelowCeil = false;
    }
    for (const d of sys.deposits || []) {
      if (!['coal', 'iron_ore', 'gold_ore'].includes(d.type)) depositsOk = false;
    }
  }
  ok(structureOk, 'every system has entrance, chambers, tunnels, deposits, crystals');
  ok(floorBelowCeil, 'every chamber has floorY below ceilY (real headroom)');
  ok(depositsOk, 'cave deposits are coal / iron_ore / gold_ore only');

  // ── Ceilings stay BELOW the surface (no "floating clouds", no pop-out-top). ──
  // The height function here is a constant 5, so the clamp must keep every
  // chamber ceiling at <= surface - 3 = 2, while preserving walkable headroom.
  let ceilBelowSurface = true, headroomOk = true;
  for (const sys of a) {
    for (const ch of sys.chambers) {
      if (ch.ceilY > 5 - 3 + 1e-6) ceilBelowSurface = false;
      if (ch.ceilY - ch.floorY < 6 - 1e-6) headroomOk = false;
    }
  }
  ok(ceilBelowSurface, 'every chamber ceiling is clamped below the surface (no domes poke through)');
  ok(headroomOk, 'ceiling clamp preserves >= 6 units of walkable headroom');
  // sampleCaves must never report open cave space above the surface, which is
  // what let the player "walk into a wall and come out the top" — EXCEPT at
  // entrance ramps, which are deliberately open-topped so you can climb out
  // into daylight.
  let noOpenSpaceAboveSurface = true;
  for (const sys of a) {
    for (const ch of sys.chambers) {
      if (VCCaves.inEntrance(a, ch.x, ch.z)) continue; // ramps are open to the sky by design
      const env = VCCaves.sampleCaves(a, ch.x, ch.z);
      if (env && env.ceil > 5 - 3 + 1e-6) noOpenSpaceAboveSurface = false;
    }
  }
  ok(noOpenSpaceAboveSurface, 'no non-entrance chamber exposes open cave volume above the surface');

  // ── Branching networks: multi-room systems with INDEXED tunnels. ──
  let multiRoom = true, tunnelIdxOk = true, connectedOk = true, formationsOk = true;
  let tunnelGeomFinite = true, tunnelGeomPositive = true;
  for (const sys of a) {
    if (sys.chambers.length < 5) multiRoom = false; // entrance + >=4 branches
    // Every tunnel endpoint must be a valid INTEGER index into chambers — the
    // exact contract main.js relies on (treating them as objects gave NaN).
    for (const t of sys.tunnels) {
      if (!Number.isInteger(t.a) || !Number.isInteger(t.b)) tunnelIdxOk = false;
      const A = sys.chambers[t.a], B = sys.chambers[t.b];
      if (!A || !B) { tunnelIdxOk = false; continue; }
      // Reproduce main.js's tunnel geometry maths and assert it never NaNs.
      const ay = A.floorY + t.r, by = B.floorY + t.r;
      const len = Math.hypot(B.x - A.x, by - ay, B.z - A.z);
      if (!Number.isFinite(len)) tunnelGeomFinite = false;
      if (!(len > 0)) tunnelGeomPositive = false;
    }
    // Graph connectivity: every chamber reachable from the entrance (idx 0).
    const adj = sys.chambers.map(() => []);
    for (const t of sys.tunnels) { adj[t.a].push(t.b); adj[t.b].push(t.a); }
    const seen = new Set([0]); const stack = [0];
    while (stack.length) { const n = stack.pop(); for (const m of adj[n]) if (!seen.has(m)) { seen.add(m); stack.push(m); } }
    if (seen.size !== sys.chambers.length) connectedOk = false;
    // Formations (stalagmites / stalactites) reference valid chambers.
    if (!Array.isArray(sys.formations)) formationsOk = false;
    for (const f of sys.formations || []) {
      if (!sys.chambers[f.chamber] || !(f.h > 0) || !(f.r > 0)) formationsOk = false;
    }
  }
  ok(multiRoom, 'every system is a multi-room network (>= 5 chambers)');
  ok(tunnelIdxOk, 'tunnels store valid INTEGER chamber indices (a, b)');
  ok(tunnelGeomFinite, 'tunnel geometry length is always finite (no NaN CylinderGeometry)');
  ok(tunnelGeomPositive, 'tunnel geometry length is always positive');
  ok(connectedOk, 'every chamber is reachable from the entrance via tunnels');
  ok(formationsOk, 'formations reference valid chambers with positive size');

  // sampleCaves resolves to a chamber at a chamber centre.
  const ch0 = a[0].chambers[0];
  const env = VCCaves.sampleCaves(a, ch0.x, ch0.z);
  ok(env && env.floor < env.ceil, 'sampleCaves returns enclosed floor/ceil at a chamber centre');
  const farEnv = VCCaves.sampleCaves(a, 99999, 99999);
  ok(farEnv === null, 'sampleCaves returns null far from any cave');

  // A tunnel midpoint is walkable (sampleCaves resolves it via segment dist).
  let tunnelWalkable = false;
  for (const sys of a) {
    if (!sys.tunnels.length) continue;
    const t = sys.tunnels[0];
    const A = sys.chambers[t.a], B = sys.chambers[t.b];
    const mx = (A.x + B.x) / 2, mz = (A.z + B.z) / 2;
    const env = VCCaves.sampleCaves(sys === a[0] ? a : [sys], mx, mz);
    if (env && env.floor < env.ceil) { tunnelWalkable = true; break; }
  }
  ok(tunnelWalkable, 'sampleCaves resolves a walkable env at a tunnel midpoint');

  // Horizontal containment contract: inside a chamber resolves, just past the
  // wall does not (this is what stops the player climbing cave walls).
  const cc = a[0].chambers[0];
  ok(VCCaves.isInside(a, cc.x, cc.z) === true, 'isInside true at a chamber centre');
  ok(VCCaves.isInside(a, cc.x + cc.r + 3, cc.z) === false, 'isInside false just outside the chamber wall');

  // Entrance is now a walkable sloped RAMP (mouth on the surface → inner end in
  // the chamber), not a vertical crater you fall down.
  const e0 = a[0].entrance;
  ok(e0 && e0.mouth && e0.inner && typeof e0.floorY === 'number', 'entrance exposes mouth/inner/floorY ramp geometry');
  const rampMidX = (e0.mouth.x + e0.inner.x) / 2, rampMidZ = (e0.mouth.z + e0.inner.z) / 2;
  ok(VCCaves.inEntrance(a, e0.mouth.x, e0.mouth.z) === true, 'inEntrance true at the ramp mouth');
  ok(VCCaves.inEntrance(a, rampMidX, rampMidZ) === true, 'inEntrance true along the ramp');
  ok(VCCaves.inEntrance(a, 99999, 99999) === false, 'inEntrance false far away');
  // The mouth meets the surface (no carve); the ramp digs DOWN toward the chamber.
  ok(VCCaves.entranceCarve(a, rampMidX, rampMidZ) > 0, 'entranceCarve digs the ramp trench below the surface');
  eq(VCCaves.entranceCarve(a, 99999, 99999), 0, 'entranceCarve is 0 far from any entrance');
  // The ramp is itself a walkable cave volume, and it is OPEN-topped (tall
  // ceiling) so the player can always walk up it into daylight (no trap).
  const rampEnv = VCCaves.sampleCaves(a, rampMidX, rampMidZ);
  ok(rampEnv && rampEnv.floor < rampEnv.ceil, 'sampleCaves resolves a walkable env on the ramp');
  ok(rampEnv && (rampEnv.ceil - rampEnv.floor) >= 12, 'the ramp is open-topped (tall ceiling) so you can walk out into daylight');
  // Ramp floor descends from the surface (mouth) toward the chamber floor (inner).
  const fMouth = VCCaves.sampleCaves(a, e0.mouth.x, e0.mouth.z);
  const fInner = VCCaves.sampleCaves(a, e0.inner.x, e0.inner.z);
  ok(fMouth && fInner && fInner.floor < fMouth.floor, 'ramp floor descends from the mouth down to the chamber');

  // World integration: generate() populates caveSystems and cave ores.
  const w = new World();
  w.generate(42);
  ok(Array.isArray(w.caveSystems) && w.caveSystems.length === 5, `world.generate populates caveSystems (${w.caveSystems.length})`);
  const wch = w.caveSystems[0].chambers[0];
  ok(w.getCaveEnv(wch.x, wch.z) != null, 'world.getCaveEnv returns an env inside a chamber');
  ok(w.inCaveEntrance(w.caveSystems[0].entrance.mouth.x, w.caveSystems[0].entrance.mouth.z) === true, 'world.inCaveEntrance true at the ramp mouth');
  let caveResources = 0;
  for (const r of w.resources.values()) if (r.inCave) caveResources++;
  ok(caveResources > 0, `cave deposits registered as resources (${caveResources})`);
}

// ════════════════════════════════════════════════════════════════════════
//  Equipment slots (armor + off-hand)
// ════════════════════════════════════════════════════════════════════════
section('Inventory equipment slots');
const Inventory = sandbox.window.Inventory;
ok(typeof Inventory === 'function', 'Inventory class exported from player.js');
if (typeof Inventory === 'function' && ITEM_DB) {
  // The equip logic reads window.ITEM_DB to classify item types.
  sandbox.window.ITEM_DB = ITEM_DB;

  // Pick representative real items from the live DB for each category.
  const armorType   = Object.keys(ITEM_DB).find(k => ITEM_DB[k].type === 'armor');
  const shieldType  = Object.keys(ITEM_DB).find(k => ITEM_DB[k].toolType === 'shield');
  const foodType    = Object.keys(ITEM_DB).find(k => ITEM_DB[k].type === 'consumable');
  const materialType= Object.keys(ITEM_DB).find(k => ITEM_DB[k].type === 'material');
  ok(armorType && foodType && materialType, `found sample items (armor=${armorType}, food=${foodType}, mat=${materialType})`);

  const inv = new Inventory(30);
  ok(inv.equipment && inv.equipment.armor === null && inv.equipment.offhand === null, 'fresh inventory has empty armor + offhand slots');

  // Classification.
  eq(inv.equipSlotFor(armorType), 'armor', 'armor item maps to the armor slot');
  eq(inv.equipSlotFor(foodType), 'offhand', 'consumable maps to the offhand slot');
  if (shieldType) eq(inv.equipSlotFor(shieldType), 'offhand', 'shield maps to the offhand slot');
  eq(inv.equipSlotFor(materialType), null, 'a plain material is not equippable');
  ok(inv.canEquipTo('armor', armorType) === true, 'canEquipTo accepts armor in the armor slot');
  ok(inv.canEquipTo('offhand', armorType) === false, 'canEquipTo rejects armor in the offhand slot');

  // Equip transition: item leaves the bag, lands in the slot.
  inv.addItem(armorType, 1);
  const armorIdx = inv.slots.findIndex(s => s && s.type === armorType);
  ok(inv.equipTo('armor', armorIdx) === true, 'equipTo moves armor into the armor slot');
  eq(inv.equipment.armor && inv.equipment.armor.type, armorType, 'armor slot now holds the armor item');
  eq(inv.countItem(armorType), 0, 'equipped armor no longer counts in the bag');
  ok(inv.equipTo('armor', armorIdx) === false, 'equipTo fails on an empty source slot');

  // Equipping a different armor swaps the previous one back into the bag.
  const armorType2 = Object.keys(ITEM_DB).filter(k => ITEM_DB[k].type === 'armor')[1];
  if (armorType2) {
    inv.addItem(armorType2, 1);
    const idx2 = inv.slots.findIndex(s => s && s.type === armorType2);
    ok(inv.equipTo('armor', idx2) === true, 'equipping a second armor succeeds');
    eq(inv.equipment.armor.type, armorType2, 'armor slot holds the newly equipped armor');
    eq(inv.countItem(armorType), 1, 'previously equipped armor is swapped back into the bag');
  }

  // Offhand accepts food, and eating/clearing is reflected by unequip.
  inv.addItem(foodType, 1);
  const foodIdx = inv.slots.findIndex(s => s && s.type === foodType);
  ok(inv.equipTo('offhand', foodIdx) === true, 'food can be placed in the offhand slot');
  ok(inv.unequip('offhand') === true, 'unequip returns the offhand item to the bag');
  eq(inv.equipment.offhand, null, 'offhand slot is empty after unequip');
  ok(inv.countItem(foodType) >= 1, 'unequipped food is back in the bag');
  ok(inv.unequip('offhand') === false, 'unequip on an empty slot is a no-op (false)');

  // Serialization round-trips the equipment state.
  const inv2 = new Inventory(30);
  inv2.deserialize(inv.serialize());
  eq(inv2.equipment.armor && inv2.equipment.armor.type, inv.equipment.armor && inv.equipment.armor.type, 'serialize/deserialize preserves equipped armor');
  ok(JSON.stringify(inv2.serialize().equipment) === JSON.stringify(inv.serialize().equipment), 'equipment survives a full serialize round-trip');
  // Legacy saves with no equipment field still load cleanly.
  const legacy = new Inventory(30);
  legacy.deserialize({ slots: new Array(30).fill(null), selectedSlot: 0 });
  ok(legacy.equipment && legacy.equipment.armor === null && legacy.equipment.offhand === null, 'legacy saves without equipment default to empty slots');
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
