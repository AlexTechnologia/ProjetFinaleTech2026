// world.js — Génération procédurale du monde
// Utilise un générateur aléatoire seedé (Mulberry32) pour des mondes déterministes
// Tous les clients avec la même seed génèrent un monde identique
// @authors Eric Villeneuve & Alex Musial — ICS3U 2026

'use strict';

// Générateur de nombres pseudo-aléatoires Mulberry32 (seedé, déterministe)
// Utilisé pour garantir que tous les clients génèrent la même île
function mulberry32(seed) {
  return function() {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// Implémentation simple de bruit de Perlin (pour la hauteur du terrain)
function smoothNoise(rng) {
  const grid = {};
  return function(x, y) {
    const ix = Math.floor(x), iy = Math.floor(y);
    const fx = x - ix, fy = y - iy;
    const key = (cx, cy) => `${cx},${cy}`;
    const rand = (cx, cy) => {
      if (!grid[key(cx, cy)]) grid[key(cx, cy)] = rng() * 2 - 1;
      return grid[key(cx, cy)];
    };
    const lerp = (a, b, t) => a + t * t * (3 - 2 * t) * (b - a);
    return lerp(
      lerp(rand(ix, iy), rand(ix+1, iy), fx),
      lerp(rand(ix, iy+1), rand(ix+1, iy+1), fx),
      fy
    );
  };
}

/**
 * Configuration and definitions for world generation.
 * @namespace WORLD
 */
const WORLD = {
  SIZE: 400,          // Taille de l'île en unités Three.js
  ISLAND_RADIUS: 180,  // Rayon de l'île (le reste = eau)
  RESOURCES: {
    oak_tree:    { count: 120, health: 50,  scale: 1.0 },
    birch_tree:  { count: 80,  health: 40,  scale: 0.9 },
    dark_oak:    { count: 40,  health: 80,  scale: 1.3 },
    rock:        { count: 120, health: 60,  scale: 1.0 },
    iron_ore:    { count: 50,  health: 80,  scale: 0.8 },
    flint_node:  { count: 60,  health: 30,  scale: 0.6 },
    gold_ore:    { count: 15,  health: 90,  scale: 1.0 },
    cave_entrance:{ count: 6,  health: 9999,scale: 1.5 },
    pink_shroom: { count: 30,  health: 1,   scale: 0.4 },
    red_shroom:  { count: 30,  health: 1,   scale: 0.4 },
    yellow_shroom:{ count: 30, health: 1,   scale: 0.4 },
    wheat:       { count: 40,  health: 1,   scale: 0.5 },
  }
};

/**
 * Returns an array of dropped items when a specific resource type is destroyed.
 * @type {Object.<string, function(): Array<{type: string, count: number}>>}
 */
const RESOURCE_DROPS = {
  oak_tree:    () => [{ type: 'wood', count: 3 + Math.floor(Math.random() * 3) }, 
                      ...(Math.random() < 0.4 ? [{ type: 'bark', count: 1 + Math.floor(Math.random() * 2) }] : [])],
  birch_tree:  () => [{ type: 'birch_wood', count: 3 + Math.floor(Math.random() * 3) },
                      ...(Math.random() < 0.4 ? [{ type: 'bark', count: 1 }] : [])],
  dark_oak:    () => [{ type: 'wood', count: 4 + Math.floor(Math.random() * 4) },
                      { type: 'bark', count: 1 + Math.floor(Math.random() * 2) }],
  rock:        () => [{ type: 'rock', count: 2 + Math.floor(Math.random() * 3) },
                      ...(Math.random() < 0.3 ? [{ type: 'flint', count: 1 }] : [])],
  iron_ore:    () => [{ type: 'iron_ore', count: 2 + Math.floor(Math.random() * 2) }],
  coal:        () => [{ type: 'coal', count: 2 + Math.floor(Math.random() * 3) }],
  gold_ore:    () => [{ type: 'gold_ore', count: 1 + Math.floor(Math.random() * 2) },
                      ...(Math.random() < 0.25 ? [{ type: 'gold_ore', count: 1 }] : [])],
  flint_node:  () => [{ type: 'flint', count: 2 + Math.floor(Math.random() * 2) }],
  pink_shroom: () => [{ type: 'pink_shroom', count: 1 }],
  red_shroom:  () => [{ type: 'red_shroom', count: 1 }],
  yellow_shroom:() => [{ type: 'yellow_shroom', count: 1 }],
  wheat:       () => [{ type: 'wheat', count: 2 + Math.floor(Math.random() * 3) }],
};

/**
 * Core procedural generation class for the game world.
 * Responsible for creating the island terrain, scattering resources,
 * and determining heights using seeded Simplex noise.
 */
class World {
  /**
   * @param {number} [seed] - The seed used for the world generator. If omitted, a random one is chosen.
   */
  constructor() {
    this.seed = null;
    this.resources = new Map();    // networkId -> resource object
    this.destroyedIds = new Set(); // IDs des ressources détruites
    this.workstations = [];        // Établis placés par les joueurs
    this.dayCount = 1;
    this.rng = null;
  }

  /**
   * Procedurally generates all static resources according to WORLD settings.
   */
  generate(seed) {
    this.seed = seed;
    this.resources.clear();
    this.destroyedIds.clear();
    this.rng = mulberry32(seed);
    this.noise1 = smoothNoise(mulberry32(seed + 111));
    this.noise2 = smoothNoise(mulberry32(seed + 222));
    this.noise3 = smoothNoise(mulberry32(seed + 333));
    let idCounter = 0;

    // Générer chaque type de ressource
    for (const [type, config] of Object.entries(WORLD.RESOURCES)) {
      for (let i = 0; i < config.count; i++) {
        // Placer la ressource sur l'île
        let x, z, distFromCenter;
        let attempts = 0;
        do {
          x = (this.rng() - 0.5) * WORLD.SIZE * 0.9;
          z = (this.rng() - 0.5) * WORLD.SIZE * 0.9;
          distFromCenter = Math.sqrt(x * x + z * z);
          attempts++;
        } while (distFromCenter > WORLD.ISLAND_RADIUS - 5 && attempts < 50);
        
        if (distFromCenter > WORLD.ISLAND_RADIUS - 5) continue;

        // Hauteur basée sur le terrain généré
        const y = this.getHeightAt(x, z);
        if (y < 0) continue; // Ne pas spawner sous l'eau

        const networkId = `res_${idCounter++}`;
        const resource = {
          networkId,
          type,
          position: { x, y, z },
          health: config.health,
          maxHealth: config.health,
          scale: config.scale * (0.8 + this.rng() * 0.4), // Variation de taille
          mesh: null, // Sera assigné par entities.js
        };
        this.resources.set(networkId, resource);
        
        // Match cave entrances with a corresponding exit in the deep dimension
        if (type === 'cave_entrance') {
          const cy = this.getCaveFloorAt(x, z);
          const exitId = `res_${idCounter++}`;
          this.resources.set(exitId, {
            networkId: exitId, type: 'cave_exit', position: { x, y: cy, z },
            health: 9999, maxHealth: 9999, scale: 1.5, mesh: null
          });
        }
      }
    }
    // ── Cave/grotto ores: coal, gold and extra iron concentrated inside the
    //    carved grotto zones, so descending underground actually pays off.
    //    Runs after the surface pass in a fixed order → fully deterministic.
    const caveOres = [
      { type: 'coal',     count: 45, health: 70, scale: 0.8 },
      { type: 'gold_ore', count: 26, health: 95, scale: 0.8 },
      { type: 'iron_ore', count: 30, health: 80, scale: 0.8 },
    ];
    for (const cfg of caveOres) {
      let placed = 0, tries = 0;
      while (placed < cfg.count && tries < cfg.count * 80) {
        tries++;
        const x = (this.rng() - 0.5) * WORLD.SIZE * 0.9;
        const z = (this.rng() - 0.5) * WORLD.SIZE * 0.9;
        if (Math.hypot(x, z) > WORLD.ISLAND_RADIUS - 8) continue;
        if (this.caveDepth(x, z) < 0.3) continue; // only inside grottos
        const y = this.getHeightAt(x, z);
        if (y < 0) continue;
        const networkId = `res_${idCounter++}`;
        this.resources.set(networkId, {
          networkId, type: cfg.type, position: { x, y, z },
          health: cfg.health, maxHealth: cfg.health,
          scale: cfg.scale * (0.8 + this.rng() * 0.4), mesh: null,
        });
        placed++;
      }
    }

    // ── Deep Cave Resources ─────────────────────────
    const deepOres = [
      { type: 'pink_shroom', count: 60, health: 1, scale: 0.6 },
      { type: 'yellow_shroom', count: 60, health: 1, scale: 0.6 },
      { type: 'gold_ore', count: 50, health: 95, scale: 1.0 },
      { type: 'iron_ore', count: 100, health: 80, scale: 1.0 },
    ];
    for (const cfg of deepOres) {
      for (let i = 0; i < cfg.count; i++) {
        const x = (this.rng() - 0.5) * WORLD.SIZE * 0.9;
        const z = (this.rng() - 0.5) * WORLD.SIZE * 0.9;
        const y = this.getCaveFloorAt(x, z);
        const networkId = `res_${idCounter++}`;
        this.resources.set(networkId, {
          networkId, type: cfg.type, position: { x, y, z },
          health: cfg.health, maxHealth: cfg.health,
          scale: cfg.scale * (0.8 + this.rng() * 0.4), mesh: null,
        });
      }
    }

    console.log(`[World] Monde généré — seed: ${seed}, ressources: ${this.resources.size}`);
    return this;
  }

  // Retourne une ressource par son ID
  getResource(networkId) {
    return this.resources.get(networkId) || null;
  }

  // Inflige des dégâts à une ressource, retourne { destroyed, drops } 
  damageResource(networkId, damage) {
    const resource = this.resources.get(networkId);
    if (!resource || this.destroyedIds.has(networkId)) {
      return { destroyed: false, drops: [] };
    }

    if (resource.type === 'cave_entrance' || resource.type === 'cave_exit') return { destroyed: false, drops: [] };

    resource.health -= damage;
    
    if (resource.health <= 0) {
      return this.destroyResource(networkId);
    }
    
    return { destroyed: false, drops: [] };
  }

  // Détruit une ressource et génère ses drops
  destroyResource(networkId) {
    const resource = this.resources.get(networkId);
    if (!resource) return { destroyed: false, drops: [] };
    
    this.destroyedIds.add(networkId);
    const dropFn = RESOURCE_DROPS[resource.type];
    const drops = dropFn ? dropFn() : [];
    
    // Supprimer le mesh Three.js si présent
    if (resource.mesh) {
      resource.mesh.parent?.remove(resource.mesh);
      resource.mesh.geometry?.dispose();
      resource.mesh.material?.dispose();
      resource.mesh = null;
    }
    
    console.log(`[World] Ressource détruite: ${networkId} (${resource.type}) — drops:`, drops);
    return { destroyed: true, drops, resource };
  }

  // Deterministic cave/grotto field. High values mark sunken rocky grottos
  // carved into the island where the richest ores (coal, iron, gold) appear.
  caveField(x, z) {
    if (!this.noise2) return 0;
    return this.noise2(x * 0.018 + 50, z * 0.018 - 50);
  }

  // Carving strength (0..1) at a point; 0 outside grotto zones.
  caveDepth(x, z) {
    const c = this.caveField(x, z);
    if (c <= 0.45) return 0;
    const t = (c - 0.45) / 0.55;
    return Math.min(1, t * t);
  }

  // True where the terrain has been carved into an explorable grotto.
  isCaveZone(x, z) {
    return this.caveDepth(x, z) > 0.25;
  }

  // Retourne la hauteur du sol de la dimension souterraine profonde
  getCaveFloorAt(x, z) {
    if (!this.noise1) return -1000;
    const n1 = this.noise1(x * 0.02, z * 0.02);
    const n2 = this.noise2(x * 0.05, z * 0.05);
    return -1000 + (n1 * 12) + (n2 * 5);
  }

  // Retourne la hauteur du plafond de la dimension souterraine
  getCaveCeilingAt(x, z) {
    if (!this.noise3) return -970;
    const n3 = this.noise3(x * 0.02, z * 0.02);
    return -970 + (n3 * 15);
  }

  getHeightAt(x, z) {
    if (!this.noise1) return 0;
    const dist = Math.hypot(x, z);
    const R = WORLD.ISLAND_RADIUS;

    // Radial island mask: flat interior, then a smooth beach falloff toward the shore.
    let mask;
    if (dist < R - 35)      mask = 1.0;
    else if (dist < R)      { const t = (dist - (R - 35)) / 35; mask = 1 - t * t * (3 - 2 * t); }
    else                    mask = 0;

    // Two octaves of value noise for natural rolling hills.
    const n1 = this.noise1(x * 0.012, z * 0.012);
    const n2 = this.noise2(x * 0.05,  z * 0.05);
    const hills = (n1 * 0.6 + n2 * 0.4) * 6 + 5;

    // Broad, gentle central rise.
    const dome = Math.cos(Math.min(1, dist / R) * Math.PI * 0.5);
    const centre = dome * dome * 4;

    // Mountain ranges: a low-frequency region mask decides WHERE mountains rise,
    // and ridged noise shapes the (snow-capped) peaks. Smooth, never spiky.
    const region = this.noise3 ? this.noise3(x * 0.013, z * 0.013) : 0;
    const mMask  = Math.max(0, region - 0.2) / 0.8;
    const ridge  = 1 - Math.abs(this.noise1(x * 0.03, z * 0.03));
    const mountains = mMask * mMask * (0.45 + 0.55 * ridge) * 34;

    let h = (hills + centre + mountains) * mask;

    // Carve sunken grottos ("caves") into the solid interior. A pure heightfield
    // can't do true overhangs, so these are deep rocky basins you descend into
    // to mine the rarest ores. The floor stays above sea level so they stay dry.
    const carve = this.caveDepth(x, z);
    if (carve > 0 && mask > 0.6) {
      h = Math.max(1.5, h - carve * 12);
    }

    // Gentle sea floor beyond the shoreline.
    if (dist > R) h = -3 - (dist - R) * 0.08;
    if (h < -4) h = -4;
    return h;
  }

  // Vérifie si une position est sur l'île
  isOnIsland(x, z) {
    return Math.sqrt(x * x + z * z) < WORLD.ISLAND_RADIUS;
  }

  // Place un établi dans le monde
  placeWorkstation(type, position, ownerId) {
    const ws = { type, position, ownerId, id: `ws_${Date.now()}` };
    this.workstations.push(ws);
    return ws;
  }

  // Retourne l'établi le plus proche d'une position (si assez proche)
  getNearbyWorkstation(position, maxDist = 4) {
    let closest = null, closestDist = maxDist;
    for (const ws of this.workstations) {
      const dx = ws.position.x - position.x;
      const dz = ws.position.z - position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < closestDist) { closest = ws; closestDist = dist; }
    }
    return closest ? closest.type : null;
  }

  // Sérialise l'état du monde pour la sauvegarde ou la synchro réseau
  serialize() {
    return {
      seed: this.seed,
      dayCount: this.dayCount,
      destroyedIds: Array.from(this.destroyedIds),
      workstations: this.workstations,
    };
  }

  // Restaure l'état du monde depuis des données sérialisées
  deserialize(data) {
    if (data.destroyedIds) {
      data.destroyedIds.forEach(id => {
        this.destroyedIds.add(id);
        const res = this.resources.get(id);
        if (res && res.mesh) {
          res.mesh.parent?.remove(res.mesh);
          res.mesh = null;
        }
      });
    }
    if (data.workstations) this.workstations = data.workstations;
    if (data.dayCount) this.dayCount = data.dayCount;
    return this;
  }
}

// Instance globale du monde
const world = new World();
