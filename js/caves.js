// caves.js — Real underground cave systems for VeilCraft
// ─────────────────────────────────────────────────────────────
// A pure-logic module (no THREE dependency) so it can be unit-tested headless.
// It deterministically lays out cave systems (entrance crater + connected
// chambers + tunnels), provides collision sampling (floor/ceiling) and the
// terrain carve used to dig an entrance down from the surface, plus the
// deterministic ore/crystal contents of each chamber.
//
// Rendering and player physics live in main.js; this file only produces the
// deterministic geometry data those systems consume.
// @authors Eric Villeneuve & Alex Musial — ICS3U 2026
'use strict';

(function () {
  const TAU = Math.PI * 2;

  function distToSegment(px, pz, ax, az, bx, bz) {
    const dx = bx - ax, dz = bz - az;
    const len2 = dx * dx + dz * dz || 1e-6;
    let t = ((px - ax) * dx + (pz - az) * dz) / len2;
    if (t < 0) t = 0; else if (t > 1) t = 1;
    const cx = ax + dx * t, cz = az + dz * t;
    return { dist: Math.hypot(px - cx, pz - cz), t };
  }

  // Deterministic ore deposits scattered on each chamber floor.
  function buildDeposits(rng, chambers) {
    const out = [];
    for (let ci = 0; ci < chambers.length; ci++) {
      const c = chambers[ci];
      // Deeper chambers are richer.
      const depthBias = Math.min(1, Math.max(0, (-c.floorY) / 14));
      const n = 2 + Math.floor(rng() * 3);
      for (let i = 0; i < n; i++) {
        const a = rng() * TAU;
        const rr = rng() * Math.max(0.5, c.r - 1.3);
        const roll = rng();
        // Bias toward gold the deeper we are.
        let type;
        if (roll < 0.45 - depthBias * 0.15) type = 'coal';
        else if (roll < 0.8 - depthBias * 0.1) type = 'iron_ore';
        else type = 'gold_ore';
        out.push({
          chamber: ci,
          x: c.x + Math.cos(a) * rr,
          z: c.z + Math.sin(a) * rr,
          y: c.floorY,
          type,
          health: type === 'gold_ore' ? 95 : type === 'iron_ore' ? 80 : 60,
        });
      }
    }
    return out;
  }

  // Deterministic glowing crystals (ambient light + atmosphere).
  function buildCrystals(rng, chambers) {
    const out = [];
    for (let ci = 0; ci < chambers.length; ci++) {
      const c = chambers[ci];
      const n = 2 + Math.floor(rng() * 3);
      for (let i = 0; i < n; i++) {
        const a = rng() * TAU;
        const rr = rng() * Math.max(0.5, c.r - 1.0);
        out.push({
          chamber: ci,
          x: c.x + Math.cos(a) * rr,
          z: c.z + Math.sin(a) * rr,
          y: c.floorY,
          h: 0.5 + rng() * 1.0,
          hue: rng(), // 0..1 → color picked at render time
        });
      }
    }
    return out;
  }

  /**
   * Deterministically generate cave systems for a world.
   * @param {() => number} rng     seeded RNG in [0,1)
   * @param {(x:number,z:number)=>number} getHeightAt surface height sampler
   * @param {object} [opts] { count, islandRadius }
   * @returns {Array} cave systems
   */
  function generateCaveSystems(rng, getHeightAt, opts) {
    opts = opts || {};
    const islandR = opts.islandRadius || 180;
    const target = opts.count || 5;
    const systems = [];
    let attempts = 0;
    const maxAttempts = target * 12;

    while (systems.length < target && attempts < maxAttempts) {
      attempts++;
      const ang = rng() * TAU;
      // Keep entrances away from the spawn point (0,0) and the shoreline.
      const rad = 45 + rng() * (islandR - 75);
      const ex = Math.cos(ang) * rad;
      const ez = Math.sin(ang) * rad;
      const surf = getHeightAt ? getHeightAt(ex, ez) : 6;
      if (surf < 4) continue; // need solid, dry land
      if (systems.some(s => Math.hypot(s.entrance.x - ex, s.entrance.z - ez) < 38)) continue;

      const baseFloor = -4 - rng() * 6;            // main chamber floor (underground)
      const chambers = [];
      const tunnels = [];
      const mainR = 7 + rng() * 4;
      chambers.push({ x: ex, z: ez, r: mainR, floorY: baseFloor, ceilY: baseFloor + 5 + rng() * 2 });

      const nSat = 2 + Math.floor(rng() * 2);      // 2–3 satellite chambers
      let prev = 0;
      for (let s = 0; s < nSat; s++) {
        const a = rng() * TAU;
        const d = 13 + rng() * 9;
        const from = chambers[prev];
        const cx = from.x + Math.cos(a) * d;
        const cz = from.z + Math.sin(a) * d;
        const cFloor = baseFloor - 1.5 - rng() * 5; // progressively deeper
        const idx = chambers.push({
          x: cx, z: cz, r: 5 + rng() * 4,
          floorY: cFloor, ceilY: cFloor + 4 + rng() * 2,
        }) - 1;
        tunnels.push({ a: prev, b: idx, r: 2.3 + rng() * 0.7 });
        prev = idx;
      }

      const sys = {
        id: systems.length,
        entrance: { x: ex, z: ez, r: 3.2, surfaceY: surf },
        chambers,
        tunnels,
      };
      sys.deposits = buildDeposits(rng, chambers);
      sys.crystals = buildCrystals(rng, chambers);
      systems.push(sys);
    }
    return systems;
  }

  /**
   * Sample cave containment at a horizontal point.
   * @returns {null | { floor:number, ceil:number, system:object, kind:string, margin:number }}
   */
  function sampleCaves(systems, x, z) {
    if (!systems || !systems.length) return null;
    let best = null;
    for (const sys of systems) {
      for (const c of sys.chambers) {
        const d = Math.hypot(x - c.x, z - c.z);
        if (d < c.r) {
          const margin = 1 - d / c.r;
          if (!best || margin > best.margin) {
            best = { floor: c.floorY, ceil: c.ceilY, system: sys, kind: 'chamber', margin };
          }
        }
      }
      for (const t of sys.tunnels) {
        const A = sys.chambers[t.a], B = sys.chambers[t.b];
        const seg = distToSegment(x, z, A.x, A.z, B.x, B.z);
        if (seg.dist < t.r) {
          const floor = A.floorY + (B.floorY - A.floorY) * seg.t;
          let ceil = A.ceilY + (B.ceilY - A.ceilY) * seg.t;
          if (ceil < floor + 2.6) ceil = floor + 2.6;
          const margin = 1 - seg.dist / t.r;
          if (!best || margin > best.margin) {
            best = { floor, ceil, system: sys, kind: 'tunnel', margin };
          }
        }
      }
    }
    return best;
  }

  // Is a point inside the open entrance crater (where daylight reaches and the
  // ceiling is left open so the player can walk down into the cave)?
  function inEntrance(systems, x, z) {
    if (!systems) return false;
    for (const sys of systems) {
      const e = sys.entrance;
      if (Math.hypot(x - e.x, z - e.z) < e.r + 2.5) return true;
    }
    return false;
  }

  /**
   * Downward terrain carve (>= 0) to SUBTRACT from the surface height so an
   * entrance crater descends from the surface to the main chamber floor.
   * Smoothly blends to 0 at the crater rim.
   */
  function entranceCarve(systems, x, z) {
    if (!systems) return 0;
    let carve = 0;
    for (const sys of systems) {
      const e = sys.entrance;
      const R = e.r + 4.5; // crater rim radius
      const d = Math.hypot(x - e.x, z - e.z);
      if (d >= R) continue;
      const main = sys.chambers[0];
      const depth = e.surfaceY - (main.floorY + 0.4); // dig to just above floor
      if (depth <= 0) continue;
      const f = 1 - d / R;            // 1 center .. 0 rim
      const smooth = f * f * (3 - 2 * f);
      const c = depth * smooth;
      if (c > carve) carve = c;
    }
    return carve;
  }

  const api = { generateCaveSystems, sampleCaves, inEntrance, entranceCarve, distToSegment };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.VCCaves = api;
})();
