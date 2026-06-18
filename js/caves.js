// caves.js — Real underground cave systems for VeilCraft
// ─────────────────────────────────────────────────
// A pure-logic module (no THREE dependency) so it can be unit-tested headless.
// It deterministically lays out branching cave systems (entrance shaft + a
// connected network of chambers joined by tunnels), provides collision
// sampling (floor / ceiling / horizontal containment) and the terrain carve
// used to dig an entrance down from the surface, plus the deterministic
// ore / crystal / decoration contents of each chamber.
//
// Rendering and player physics live in main.js; this file only produces the
// deterministic geometry data those systems consume.
// @authors Eric Villeneuve & Alex Musial — ICS3U 2026
'use strict';

(function () {
  const TAU = Math.PI * 2;

  // Closest point on segment AB to P (2D), returns distance + param t in [0,1].
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
      // Deeper chambers are richer (more & better ore).
      const depthBias = Math.min(1, Math.max(0, (-c.floorY) / 16));
      const n = 2 + Math.floor(rng() * 3) + Math.round(depthBias * 2);
      for (let i = 0; i < n; i++) {
        const a = rng() * TAU;
        const rr = rng() * Math.max(0.5, c.r - 1.6);
        const roll = rng();
        let type;
        if (roll < 0.45 - depthBias * 0.2) type = 'coal';
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
          h: 0.5 + rng() * 1.1,
          hue: rng(), // 0..1 → color picked at render time
        });
      }
    }
    return out;
  }

  // Deterministic stalagmites (floor) + stalactites (ceiling) for cave detail.
  function buildFormations(rng, chambers) {
    const out = [];
    for (let ci = 0; ci < chambers.length; ci++) {
      const c = chambers[ci];
      const n = 2 + Math.floor(rng() * 4);
      for (let i = 0; i < n; i++) {
        const a = rng() * TAU;
        const rr = 0.4 + rng() * Math.max(0.6, c.r - 1.2);
        const ceiling = rng() < 0.45;
        out.push({
          chamber: ci,
          x: c.x + Math.cos(a) * rr,
          z: c.z + Math.sin(a) * rr,
          ceiling,                       // true = stalactite (hangs from ceiling)
          h: 0.8 + rng() * (ceiling ? 1.8 : 2.4),
          r: 0.2 + rng() * 0.45,
        });
      }
    }
    return out;
  }

  /**
   * Deterministically generate branching cave systems for a world.
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
    const maxAttempts = target * 14;

    while (systems.length < target && attempts < maxAttempts) {
      attempts++;
      const ang = rng() * TAU;
      // Keep entrances away from the spawn point (0,0) and the shoreline.
      const rad = 45 + rng() * (islandR - 75);
      const ex = Math.cos(ang) * rad;
      const ez = Math.sin(ang) * rad;
      const surf = getHeightAt ? getHeightAt(ex, ez) : 6;
      if (surf < 4) continue;          // need solid, dry land
      if (systems.some(s => Math.hypot(s.entrance.x - ex, s.entrance.z - ez) < 42)) continue;

      // — Main chamber, fed by a walkable ramp down from the surface —
      const baseFloor = -5 - rng() * 6;
      const chambers = [{
        x: ex, z: ez, r: 7.5 + rng() * 4.5,
        floorY: baseFloor, ceilY: baseFloor + 6 + rng() * 2.5,
        depth: 0,
      }];
      const c0 = chambers[0];
      // A walkable ramp ("adit"): an open-topped trench from a surface mouth
      // down into the main chamber, so the player WALKS in and out instead of
      // dropping down a vertical shaft. Length is sized for a gentle slope.
      const eang = rng() * TAU;
      const rampLen = Math.max(10, Math.min(40, (surf - baseFloor) * 1.7));
      const inner = { x: ex + Math.cos(eang) * c0.r * 0.5, z: ez + Math.sin(eang) * c0.r * 0.5 };
      const mouth = { x: ex + Math.cos(eang) * (c0.r * 0.5 + rampLen), z: ez + Math.sin(eang) * (c0.r * 0.5 + rampLen) };
      const tunnels = [];

      // — Branching network: each new chamber sprouts from a random existing
      //   one, so systems feel like real, connected, multi-room caverns. —
      const nExtra = 4 + Math.floor(rng() * 3);   // 4–6 extra chambers (5–7 total)
      for (let s = 0; s < nExtra; s++) {
        const parentIdx = Math.floor(rng() * chambers.length);
        const from = chambers[parentIdx];
        const a = rng() * TAU;
        const d = 12 + rng() * 12;
        const cx = from.x + Math.cos(a) * d;
        const cz = from.z + Math.sin(a) * d;
        // Deeper the further we branch from the surface.
        const cFloor = from.floorY - (1.5 + rng() * 4.5);
        const cr = 5 + rng() * 4.5;
        const idx = chambers.push({
          x: cx, z: cz, r: cr,
          floorY: cFloor, ceilY: cFloor + 4.5 + rng() * 2.5,
          depth: from.depth + 1,
        }) - 1;
        tunnels.push({ a: parentIdx, b: idx, r: 2.2 + rng() * 1.0 });
      }

      const sys = {
        id: systems.length,
        entrance: { x: ex, z: ez, r: 2.8, surfaceY: surf, floorY: baseFloor, mouth, inner },
        chambers,
        tunnels,
      };
      sys.deposits = buildDeposits(rng, chambers);
      sys.crystals = buildCrystals(rng, chambers);
      sys.formations = buildFormations(rng, chambers);
      systems.push(sys);
    }
    return systems;
  }

  /**
   * Sample cave containment at a horizontal point.
   * Returns the enclosing chamber/tunnel with the largest margin, or null when
   * the point is outside every cave volume.
   * @returns {null | { floor:number, ceil:number, system:object, kind:string, margin:number }}
   */
  function sampleCaves(systems, x, z) {
    if (!systems || !systems.length) return null;
    // The carved space is the UNION of every chamber/tunnel that contains the
    // point, so we return the lowest floor and highest ceiling among them.
    // (Picking a single "best" volume by horizontal margin could pin the player
    // to a shallow tunnel's ceiling where it overlaps a deeper chamber, which
    // made the floor gate fail and teleport the player up to the surface.)
    let floor = Infinity, ceil = -Infinity, margin = -Infinity;
    let system = null, kind = null;
    for (const sys of systems) {
      for (const c of sys.chambers) {
        const d = Math.hypot(x - c.x, z - c.z);
        if (d < c.r) {
          if (c.floorY < floor) floor = c.floorY;
          if (c.ceilY > ceil) ceil = c.ceilY;
          const m = 1 - d / c.r;
          if (m > margin) { margin = m; system = sys; kind = 'chamber'; }
        }
      }
      for (const t of sys.tunnels) {
        const A = sys.chambers[t.a], B = sys.chambers[t.b];
        if (!A || !B) continue;
        const seg = distToSegment(x, z, A.x, A.z, B.x, B.z);
        if (seg.dist < t.r) {
          const tf = A.floorY + (B.floorY - A.floorY) * seg.t;
          let tc = A.ceilY + (B.ceilY - A.ceilY) * seg.t;
          if (tc < tf + 2.6) tc = tf + 2.6;
          if (tf < floor) floor = tf;
          if (tc > ceil) ceil = tc;
          const m = 1 - seg.dist / t.r;
          if (m > margin) { margin = m; system = sys; kind = 'tunnel'; }
        }
      }
      // Entrance ramp: an open-topped trench that ramps from the surface (at the
      // mouth) down to the main chamber floor (at the inner end). Open ceiling
      // so the player can always walk up/down it into daylight.
      const e = sys.entrance;
      if (e && e.mouth) {
        const seg = distToSegment(x, z, e.mouth.x, e.mouth.z, e.inner.x, e.inner.z);
        if (seg.dist < e.r) {
          const rf = e.surfaceY + (e.floorY - e.surfaceY) * seg.t; // mouth→surf, inner→floor
          const rc = e.surfaceY + 20; // open to the sky
          if (rf < floor) floor = rf;
          if (rc > ceil) ceil = rc;
          const m = 1 - seg.dist / e.r;
          if (m > margin) { margin = m; system = sys; kind = 'entrance'; }
        }
      }
    }
    if (ceil === -Infinity) return null;
    return { floor, ceil, system, kind, margin };
  }

  // Convenience: is a horizontal point inside any cave volume (chamber/tunnel)?
  function isInside(systems, x, z) {
    return sampleCaves(systems, x, z) != null;
  }

  // Is a point inside the open entrance crater (where daylight reaches and the
  // ceiling is left open so the player can walk down into the cave)?
  function inEntrance(systems, x, z) {
    if (!systems) return false;
    for (const sys of systems) {
      const e = sys.entrance;
      if (!e || !e.mouth) continue;
      if (distToSegment(x, z, e.mouth.x, e.mouth.z, e.inner.x, e.inner.z).dist < e.r) return true;
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
      if (!e || !e.mouth) continue;
      const R = e.r + 2.0; // trench rim (blend zone)
      const seg = distToSegment(x, z, e.mouth.x, e.mouth.z, e.inner.x, e.inner.z);
      if (seg.dist >= R) continue;
      const rf = e.surfaceY + (e.floorY - e.surfaceY) * seg.t; // ramp floor height here
      const depth = e.surfaceY - rf; // how far the ramp floor sits below the surface
      if (depth <= 0) continue;
      const f = 1 - seg.dist / R;     // 1 trench centre .. 0 rim
      const smooth = f * f * (3 - 2 * f);
      const c = depth * smooth;
      if (c > carve) carve = c;
    }
    return carve;
  }

  const api = {
    generateCaveSystems, sampleCaves, isInside, inEntrance, entranceCarve, distToSegment,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.VCCaves = api;
})();
