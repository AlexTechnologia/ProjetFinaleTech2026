// Headless validation of the player cave-collision logic from main.js _move
// (WITH gravity + walkable-ramp entrance), run against real generated systems.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const VCCaves = require('/data/veilcraft/veilcraft/js/caves.js');

const mulberry32 = (a) => () => {
  a |= 0; a = (a + 0x6D2B79F5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const BASE = 8; // realistic island surface height near an entrance
const systems = VCCaves.generateCaveSystems(mulberry32(7), () => BASE, { count: 5, islandRadius: 180 });
const getCaveEnv = (x, z) => VCCaves.sampleCaves(systems, x, z);
const surfAt = (x, z) => BASE - VCCaves.entranceCarve(systems, x, z); // world.getHeightAt
const EYE = 1.7;
let fail = 0;
const log = (m) => console.log(m);

// Faithful reproduction of main.js _move (cave block + gravity + containment).
function step(pos, vx, vz) {
  const dt = 0.03;
  const prevX = pos.x, prevZ = pos.z;
  pos.x += vx * dt; pos.z += vz * dt;
  pos.vy = (pos.vy || 0) - 25 * dt;
  pos.y += pos.vy * dt;
  const surf = surfAt(pos.x, pos.z);
  let groundY = surf + EYE, ceilCap = Infinity, inCave = false;
  const cave = getCaveEnv(pos.x, pos.z);
  if (cave) {
    const feet = pos.y - EYE;
    if (feet < cave.ceil + 0.4) {
      groundY = cave.floor + EYE; inCave = true;
      if (cave.ceil - cave.floor < 12) ceilCap = cave.ceil - 0.2;
      const blocked = (x, z) => { if (getCaveEnv(x, z)) return false; return surfAt(x, z) > feet + 1.0; };
      if (blocked(pos.x, prevZ)) pos.x = prevX;
      if (blocked(pos.x, pos.z)) pos.z = prevZ;
    }
  }
  if (pos.y <= groundY) { pos.y = groundY; pos.vy = 0; }
  if (ceilCap !== Infinity && pos.y > ceilCap) { pos.y = ceilCap; if (pos.vy > 0) pos.vy = 0; }
  return inCave;
}
function settle(pos, frames = 80) { for (let i = 0; i < frames; i++) step(pos, 0, 0); }
function walkTo(pos, tx, tz, maxFrames = 2500) {
  for (let i = 0; i < maxFrames; i++) {
    const dx = tx - pos.x, dz = tz - pos.z, d = Math.hypot(dx, dz);
    if (d < 1.0) return true;
    step(pos, (dx / d) * 8, (dz / d) * 8);
  }
  return false;
}

// ── TEST A: no interior cave point resolves to the surface (no wall-climb). ──
let sampled = 0, leaks = 0;
for (const sys of systems) {
  for (const ch of sys.chambers) {
    const pts = [[ch.x, ch.z]];
    for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2, rr = ch.r * 0.7; pts.push([ch.x + Math.cos(a) * rr, ch.z + Math.sin(a) * rr]); }
    for (const [x, z] of pts) { sampled++; const p = { x, y: ch.floorY + EYE, z, vy: 0 }; settle(p); if (p.y > BASE - 1) leaks++; }
  }
  for (const t of sys.tunnels) {
    const A = sys.chambers[t.a], B = sys.chambers[t.b];
    sampled++; const p = { x: (A.x + B.x) / 2, y: Math.min(A.floorY, B.floorY) + EYE, z: (A.z + B.z) / 2, vy: 0 }; settle(p);
    if (p.y > BASE - 1) leaks++;
  }
}
log(`interior points sampled: ${sampled}, surface leaks: ${leaks}`);
if (leaks > 0) { console.error('FAIL: interior cave points resolve to the surface'); fail++; }

const sys = systems[0];
const e = sys.entrance, c0 = sys.chambers[0];

// ── TEST B: INGRESS — walk from the surface mouth down into the chamber. ──
const p = { x: e.mouth.x, y: BASE + EYE, z: e.mouth.z, vy: 0 };
settle(p, 20);
log(`at mouth: y ${p.y.toFixed(1)} (surface ${(BASE + EYE).toFixed(1)})`);
walkTo(p, c0.x, c0.z);
const inChamber = Math.hypot(p.x - c0.x, p.z - c0.z) < c0.r;
log(`INGRESS reached main chamber: ${inChamber}, depth y ${p.y.toFixed(1)} (floor+EYE ${(c0.floorY + EYE).toFixed(1)})`);
if (!inChamber) { console.error('FAIL: could not walk down the ramp into the chamber'); fail++; }
if (Math.abs(p.y - (c0.floorY + EYE)) > 2.5) { console.error('FAIL: did not end on the chamber floor'); fail++; }

// ── TEST C: EGRESS — walk back up the ramp into daylight. ──
walkTo(p, e.mouth.x, e.mouth.z);
const out = Math.abs(p.y - (BASE + EYE)) < 1.5 && Math.hypot(p.x - e.mouth.x, p.z - e.mouth.z) < 2;
log(`EGRESS back at surface: ${out}, y ${p.y.toFixed(1)}`);
if (!out) { console.error('FAIL: could not walk back up the ramp into daylight (trapped)'); fail++; }

// ── TEST D: traverse the tunnel graph from the chamber to the deepest room. ──
const adj = sys.chambers.map(() => []);
sys.tunnels.forEach((t) => { adj[t.a].push(t.b); adj[t.b].push(t.a); });
const prev = new Array(sys.chambers.length).fill(-1); const seen = new Set([0]); const q = [0];
while (q.length) { const n = q.shift(); for (const m of adj[n]) if (!seen.has(m)) { seen.add(m); prev[m] = n; q.push(m); } }
let deepest = 0; for (let i = 1; i < sys.chambers.length; i++) if (sys.chambers[i].floorY < sys.chambers[deepest].floorY) deepest = i;
const path = []; for (let n = deepest; n !== -1; n = prev[n]) path.unshift(n);
const pp = { x: c0.x, y: c0.floorY + EYE, z: c0.z, vy: 0 };
let worst = -Infinity;
for (let i = 1; i < path.length; i++) {
  const t = sys.chambers[path[i]]; walkTo(pp, t.x, t.z);
  if (pp.y > BASE - 1) worst = Math.max(worst, pp.y);
}
const reachedDeep = Math.hypot(pp.x - sys.chambers[deepest].x, pp.z - sys.chambers[deepest].z) < sys.chambers[deepest].r;
log(`TRAVERSE path [${path.join('→')}] reached deepest: ${reachedDeep} (y ${pp.y.toFixed(1)}, floor ${(sys.chambers[deepest].floorY + EYE).toFixed(1)})`);
if (!reachedDeep) { console.error('FAIL: could not traverse tunnels to the deepest chamber'); fail++; }
if (worst > BASE - 1) { console.error('FAIL: rose to the surface while following tunnels'); fail++; }

console.log(fail === 0 ? '\nSIM OK \u2713' : `\nSIM FAILED (${fail})`);
process.exit(fail === 0 ? 0 : 1);
