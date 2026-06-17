'use strict';
/*
 * VeilCraft asset loader — loads CC0 GLB/GLTF models into a cache and hands out
 * grounded, scale-normalized clones. Everything degrades gracefully: if a model
 * fails to load (or three.js loaders are missing), callers fall back to the
 * original procedural meshes, so the game never breaks.
 *
 * Models live under assets/models/. GLB = self-contained static props. GLTF =
 * Quaternius rigged characters (skinned, with embedded animations).
 */
(function () {
  const BASE = 'assets/models/';

  // logical key -> filename
  const FILES = {
    // ── environment (static GLB) ──
    tree_oak:   'tree.glb',
    tree_dark:  'tree-tall.glb',
    tree_birch: 'tree-autumn.glb',
    rock_a:     'rock-a.glb',
    rock_b:     'rock-b.glb',
    rock_c:     'rock-c.glb',
    ore_stone:  'resource-stone.glb',
    flint:      'rock-flat.glb',
    // ── held-item viewmodels (static GLB shown in the player's hand) ──
    'tool-axe':       'tool-axe.glb',
    'tool-pickaxe':   'tool-pickaxe.glb',
    'resource-wood':  'resource-wood.glb',
    'resource-stone': 'resource-stone.glb',
    'rock-flat':      'rock-flat.glb',
    'rock-a':         'rock-a.glb',
    'rock-b':         'rock-b.glb',
    // ── structures / workstations (static GLB) ──
    campfire:        'campfire-pit.glb',
    workbench:       'workbench.glb',
    furnace:         'workbench-grind.glb',
    anvil:           'workbench-anvil.glb',
    cauldron:        'bucket.glb',
    fletching_table: 'workbench.glb',
    // ── characters (skinned GLTF, animated) ──
    enemy_goblin:  'Goblin_Male.gltf',
    enemy_orc:     'Zombie_Male.gltf',
    enemy_knight:  'Knight_Male.gltf',
    player_remote: 'Soldier_Male.gltf',
  };

  const SKINNED = new Set(['enemy_goblin', 'enemy_orc', 'enemy_knight', 'player_remote']);

  // key -> { scene, animations, height, minY, skinned }
  const cache = {};
  let loader = null;

  function getLoader() {
    if (!loader && typeof THREE !== 'undefined' && THREE.GLTFLoader) {
      loader = new THREE.GLTFLoader();
    }
    return loader;
  }

  function loadOne(key) {
    return new Promise((resolve) => {
      const l = getLoader();
      if (!l || !FILES[key]) { resolve(false); return; }
      let settled = false;
      const done = (ok) => { if (!settled) { settled = true; resolve(ok); } };
      // Safety timeout so a stuck request never blocks the loading screen.
      const timer = setTimeout(() => { console.warn('[Assets] timeout', key); done(false); }, 15000);
      try {
        l.load(BASE + FILES[key], (gltf) => {
          clearTimeout(timer);
          try {
            const scene = gltf.scene || (gltf.scenes && gltf.scenes[0]);
            if (!scene) { done(false); return; }
            // glTF materials default to metalness=1, which renders pitch black
            // without a reflection environment. Force metalness off on EVERY
            // material (including material arrays used by the characters), and
            // give untextured materials a faint self-glow so they read at night.
            const fixMat = (m) => {
              if (!m) return;
              if (m.metalness !== undefined) m.metalness = 0;
              if (m.roughness !== undefined && m.roughness > 0.95) m.roughness = 0.85;
              if (!m.map && m.color && m.emissive && m.emissiveIntensity !== undefined) {
                m.emissive.copy(m.color);
                m.emissiveIntensity = 0.2;
              }
              m.needsUpdate = true;
            };
            scene.traverse((o) => {
              if (o.isMesh || o.isSkinnedMesh) {
                o.castShadow = true;
                o.frustumCulled = false;
                if (Array.isArray(o.material)) o.material.forEach(fixMat);
                else fixMat(o.material);
              }
            });
            const box = new THREE.Box3().setFromObject(scene);
            const height = Math.max(0.01, box.max.y - box.min.y);
            cache[key] = {
              scene,
              animations: gltf.animations || [],
              height,
              minY: box.min.y,
              skinned: SKINNED.has(key),
            };
            done(true);
          } catch (e) { console.warn('[Assets] parse fail', key, e); done(false); }
        }, undefined, (err) => { clearTimeout(timer); console.warn('[Assets] load fail', key, err && err.message); done(false); });
      } catch (e) { clearTimeout(timer); console.warn('[Assets] throw', key, e); done(false); }
    });
  }

  async function preload(onProgress) {
    const keys = Object.keys(FILES);
    let done = 0, ok = 0;
    // Load all models in parallel for a much faster boot.
    await Promise.all(keys.map(async (key) => {
      const success = await loadOne(key);
      if (success) ok++;
      done++;
      if (onProgress) { try { onProgress(done / keys.length, key); } catch (e) {} }
    }));
    console.log(`[Assets] preloaded ${ok}/${keys.length} models`);
    return ok;
  }

  function cloneScene(entry) {
    if (entry.skinned && THREE.SkeletonUtils && THREE.SkeletonUtils.clone) {
      return THREE.SkeletonUtils.clone(entry.scene);
    }
    return entry.scene.clone(true);
  }

  // Returns { object, animations, scale } grounded at y=0 and scaled so the
  // model is roughly `targetHeight` tall. Returns null if not cached.
  function buildModel(key, targetHeight) {
    const entry = cache[key];
    if (!entry) return null;
    try {
      const obj = cloneScene(entry);
      const s = targetHeight ? (targetHeight / entry.height) : 1;
      obj.scale.setScalar(s);
      obj.position.y = -entry.minY * s; // drop feet/base to y=0
      return { object: obj, animations: entry.animations, scale: s };
    } catch (e) {
      console.warn('[Assets] build fail', key, e);
      return null;
    }
  }

  function has(key) { return !!cache[key]; }

  window.VCAssets = { preload, buildModel, has, FILES, _cache: cache };
})();
