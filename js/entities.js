/**
 * entities.js — VeilCraft Entity System
 *
 * Handles Three.js rendering of:
 *  - Resources (trees, rocks, ore, mushrooms)
 *  - Enemies (Goblin, Orc, Dark Knight)
 *  - Dropped items (spinning gems)
 *  - Other players (capsule mesh with nametag)
 *  - Workstations (placeable structures)
 *
 * Also manages WaveManager for night enemy spawning.
 */

// ─────────────────────────────────────────────────────────────
// ENTITY MANAGER
// ─────────────────────────────────────────────────────────────
class EntityManager {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.resourceMeshes = new Map(); // networkId → THREE.Group
    this.droppedItems = [];          // { mesh, type, count, position, id }
    this.enemies = [];               // Enemy instances
    this.otherPlayers = new Map();   // peerId → { mesh, nameTag, data }
    this.workstations = [];          // Placed workstation objects
    this.particles = [];             // Active particle effects

    this._dropIdCounter = 0;

    // Material cache
    this._materials = {};
  }

  _getMat(color, opts = {}) {
    const key = `${color}_${opts.emissive||0}_${opts.transparent||false}`;
    if (!this._materials[key]) {
      this._materials[key] = new THREE.MeshLambertMaterial({
        color,
        emissive: opts.emissive || 0x000000,
        emissiveIntensity: opts.emissiveIntensity || 0,
        transparent: opts.transparent || false,
        opacity: opts.opacity !== undefined ? opts.opacity : 1,
      });
    }
    return this._materials[key];
  }

  // ──────────────────────────────────────────
  // RESOURCE RENDERING
  // ──────────────────────────────────────────
  buildResourceMeshes() {
    for (const res of this.world.resources) {
      if (res.destroyed) continue;
      const mesh = this._createResourceMesh(res);
      if (mesh) {
        mesh.position.set(res.position.x, res.position.y, res.position.z);
        mesh.userData.networkId = res.networkId;
        mesh.userData.resourceType = res.type;
        this.scene.add(mesh);
        this.resourceMeshes.set(res.networkId, mesh);
        res.mesh = mesh;
      }
    }
  }

  _createResourceMesh(res) {
    const group = new THREE.Group();

    switch(res.type) {
      case 'OAK_TREE':
      case 'DARK_OAK': {
        const trunkH = res.type === 'DARK_OAK' ? 5 : 4;
        const leafR  = res.type === 'DARK_OAK' ? 2.2 : 1.8;
        const trunkC = res.type === 'DARK_OAK' ? 0x2e1f0f : 0x5a3e2b;
        const leafC  = res.type === 'DARK_OAK' ? 0x1a4a20 : 0x2d7a3a;
        // Trunk
        const trunk = new THREE.Mesh(
          new THREE.CylinderGeometry(0.25, 0.35, trunkH, 7),
          this._getMat(trunkC)
        );
        trunk.position.y = trunkH / 2;
        trunk.castShadow = true;
        group.add(trunk);
        // Leaves: stacked spheres
        for (let i = 0; i < 3; i++) {
          const r = leafR * (1 - i * 0.12);
          const leaf = new THREE.Mesh(
            new THREE.SphereGeometry(r, 7, 6),
            this._getMat(leafC)
          );
          leaf.position.y = trunkH + i * 0.9;
          leaf.castShadow = true;
          group.add(leaf);
        }
        break;
      }
      case 'BIRCH_TREE': {
        const trunk = new THREE.Mesh(
          new THREE.CylinderGeometry(0.18, 0.22, 4.5, 7),
          this._getMat(0xd4c8b4)
        );
        trunk.position.y = 2.25;
        trunk.castShadow = true;
        group.add(trunk);
        // Lighter round crown
        const leaf = new THREE.Mesh(
          new THREE.SphereGeometry(1.5, 7, 6),
          this._getMat(0x7bc47f)
        );
        leaf.position.y = 5;
        leaf.castShadow = true;
        group.add(leaf);
        break;
      }
      case 'ROCK': {
        const geo = new THREE.DodecahedronGeometry(0.8, 0);
        const rock = new THREE.Mesh(geo, this._getMat(0x7a7a7a));
        rock.scale.y = 0.6 + Math.random() * 0.3;
        rock.scale.x = 0.8 + Math.random() * 0.4;
        rock.rotation.y = Math.random() * Math.PI;
        rock.castShadow = true;
        group.add(rock);
        break;
      }
      case 'IRON_ORE': {
        const rockGeo = new THREE.DodecahedronGeometry(0.65, 0);
        const rockMesh = new THREE.Mesh(rockGeo, this._getMat(0x8a7a6a));
        group.add(rockMesh);
        // Orange vein dots
        for (let i = 0; i < 5; i++) {
          const dot = new THREE.Mesh(
            new THREE.SphereGeometry(0.08, 4, 4),
            this._getMat(0xd97706, { emissive: 0x7c3400, emissiveIntensity: 0.4 })
          );
          const theta = (i / 5) * Math.PI * 2;
          dot.position.set(Math.cos(theta)*0.55, (Math.random()-0.5)*0.4, Math.sin(theta)*0.55);
          group.add(dot);
        }
        break;
      }
      case 'FLINT_NODE': {
        const flint = new THREE.Mesh(
          new THREE.ConeGeometry(0.3, 0.7, 5),
          this._getMat(0x505050)
        );
        flint.rotation.z = Math.random() * 0.5;
        flint.position.y = 0.35;
        group.add(flint);
        break;
      }
      case 'PINK_SHROOM':
      case 'RED_SHROOM':
      case 'YELLOW_SHROOM': {
        const colors = { PINK_SHROOM: 0xf472b6, RED_SHROOM: 0xdc2626, YELLOW_SHROOM: 0xfbbf24 };
        const col = colors[res.type];
        const stem = new THREE.Mesh(
          new THREE.CylinderGeometry(0.07, 0.1, 0.35, 6),
          this._getMat(0xf5f5dc)
        );
        stem.position.y = 0.17;
        group.add(stem);
        const cap = new THREE.Mesh(
          new THREE.SphereGeometry(0.28, 7, 6, 0, Math.PI*2, 0, Math.PI*0.5),
          this._getMat(col)
        );
        cap.position.y = 0.35;
        group.add(cap);
        // Spots
        for (let i = 0; i < 3; i++) {
          const spot = new THREE.Mesh(
            new THREE.SphereGeometry(0.04, 4, 4),
            this._getMat(0xffffff)
          );
          const a = (i/3)*Math.PI*2;
          spot.position.set(Math.cos(a)*0.15, 0.45, Math.sin(a)*0.15);
          group.add(spot);
        }
        break;
      }
      case 'WHEAT': {
        // Simple vertical quads
        for (let i = 0; i < 4; i++) {
          const stalk = new THREE.Mesh(
            new THREE.CylinderGeometry(0.02, 0.02, 0.6, 3),
            this._getMat(0xd4a827)
          );
          stalk.position.set(
            (Math.random()-0.5)*0.3,
            0.3,
            (Math.random()-0.5)*0.3
          );
          group.add(stalk);
        }
        break;
      }
      default: {
        // Generic fallback
        const obj = new THREE.Mesh(
          new THREE.BoxGeometry(0.8, 0.8, 0.8),
          this._getMat(0x888888)
        );
        obj.position.y = 0.4;
        group.add(obj);
      }
    }

    // Enable shadow casting on all children
    group.traverse(child => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    return group;
  }

  /**
   * Remove a resource mesh from the scene (when destroyed).
   * Plays a particle burst.
   */
  destroyResourceMesh(networkId) {
    const mesh = this.resourceMeshes.get(networkId);
    if (!mesh) return;
    this._spawnDestroyParticles(mesh.position.clone());
    this.scene.remove(mesh);
    this.resourceMeshes.delete(networkId);
  }

  /**
   * Show damage on a resource mesh (brief flash/shake).
   */
  flashResourceDamage(networkId) {
    const mesh = this.resourceMeshes.get(networkId);
    if (!mesh) return;
    // Brief scale pulse
    const origScale = mesh.scale.clone();
    mesh.scale.multiplyScalar(0.92);
    setTimeout(() => { if (mesh) mesh.scale.copy(origScale); }, 100);
  }

  // ──────────────────────────────────────────
  // DROPPED ITEMS
  // ──────────────────────────────────────────
  /**
   * Spawn a dropped item in the world as a spinning gem.
   */
  spawnDroppedItem(type, count, position) {
    const def = window.ITEM_DB?.[type] || {};
    const color = this._itemColor(type);

    const gem = new THREE.Group();
    const geom = new THREE.OctahedronGeometry(0.25, 0);
    const mat = new THREE.MeshLambertMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.4,
    });
    const mesh = new THREE.Mesh(geom, mat);
    gem.add(mesh);

    // Glow ring
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.32, 0.04, 6, 12),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.4 })
    );
    ring.rotation.x = Math.PI / 2;
    gem.add(ring);

    gem.position.set(
      position.x + (Math.random()-0.5)*0.5,
      position.y + 0.5,
      position.z + (Math.random()-0.5)*0.5
    );

    this.scene.add(gem);

    const id = ++this._dropIdCounter;
    const item = { mesh: gem, type, count, id, spawnTime: Date.now(), bobOffset: Math.random()*Math.PI*2 };
    this.droppedItems.push(item);
    return id;
  }

  _itemColor(type) {
    const colors = {
      'Wood': 0x8b5e3c, 'Birch Wood': 0xc8b89a, 'Bark': 0x6b4c2a,
      'Rock': 0x9e9e9e, 'Flint': 0x607d8b, 'Iron Ore': 0xb7a09a,
      'Iron Bar': 0xb0bec5, 'Stone Brick': 0xa0a0a0,
      'Wheat': 0xf9c74f,
      'Pink Shroom': 0xf472b6, 'Red Shroom': 0xef4444, 'Yellow Shroom': 0xfbbf24,
      'Bread': 0xd4a017, 'Soup': 0x84cc16,
    };
    return colors[type] || 0xa78bfa;
  }

  /**
   * Animate dropped items and check for pickup.
   */
  updateDroppedItems(dt, playerPosition) {
    const pickupRadius = 1.8;
    const toRemove = [];

    for (const item of this.droppedItems) {
      const elapsed = (Date.now() - item.spawnTime) / 1000;
      // Bob up and down
      item.mesh.position.y = item.mesh.position.y - item.mesh.position.y * 0.001
        + Math.sin(elapsed * 3 + item.bobOffset) * 0.002 + 0.5
        + (this.world.getHeightAt(item.mesh.position.x, item.mesh.position.z) || 0);

      // Actually: just set bob relative to base height
      const baseY = (this.world?.getHeightAt(item.mesh.position.x, item.mesh.position.z) || 0) + 0.4;
      item.mesh.position.y = baseY + Math.sin(elapsed * 3 + item.bobOffset) * 0.2;

      // Rotate
      item.mesh.rotation.y += dt * 2.5;

      // Pickup check
      const dx = playerPosition.x - item.mesh.position.x;
      const dz = playerPosition.z - item.mesh.position.z;
      if (Math.sqrt(dx*dx + dz*dz) < pickupRadius) {
        toRemove.push(item);
      }
    }

    // Process pickups
    for (const item of toRemove) {
      this.scene.remove(item.mesh);
      this.droppedItems = this.droppedItems.filter(i => i !== item);
      if (window.audio) window.audio.playPickup();
      if (this.onItemPickup) this.onItemPickup(item.type, item.count);
    }
  }

  removeDroppedItem(id) {
    const idx = this.droppedItems.findIndex(i => i.id === id);
    if (idx !== -1) {
      this.scene.remove(this.droppedItems[idx].mesh);
      this.droppedItems.splice(idx, 1);
    }
  }

  // ──────────────────────────────────────────
  // OTHER PLAYERS (network)
  // ──────────────────────────────────────────
  /**
   * Create or update a remote player representation.
   */
  updateRemotePlayer(peerId, data) {
    if (!this.otherPlayers.has(peerId)) {
      this._createRemotePlayer(peerId, data.name || 'Joueur');
    }
    const p = this.otherPlayers.get(peerId);
    if (!p) return;

    // Smooth position
    const target = new THREE.Vector3(data.position.x, data.position.y, data.position.z);
    p.mesh.position.lerp(target, 0.2);
    if (data.rotation) {
      p.mesh.rotation.y = data.rotation.y;
    }
  }

  _createRemotePlayer(peerId, name) {
    const group = new THREE.Group();

    // Body (capsule approximation: cylinder + 2 spheres)
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.3, 0.3, 1.2, 8),
      this._getMat(0x4f46e5)
    );
    body.position.y = 0.9;
    group.add(body);

    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 8, 6),
      this._getMat(0xfcd34d)
    );
    head.position.y = 1.8;
    group.add(head);

    // Name tag (canvas texture)
    const nameTag = this._createNameTag(name);
    nameTag.position.y = 2.3;
    group.add(nameTag);

    this.scene.add(group);
    this.otherPlayers.set(peerId, { mesh: group, nameTag, data: { name } });
  }

  _createNameTag(name) {
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgba(10,5,30,0.8)';
    ctx.roundRect(4, 4, 248, 56, 12);
    ctx.fill();
    ctx.fillStyle = '#a78bfa';
    ctx.font = 'bold 26px Outfit, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(name, 128, 34);

    const tex = new THREE.CanvasTexture(canvas);
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthTest: false });
    const sprite = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.45), mat);
    return sprite;
  }

  removeRemotePlayer(peerId) {
    const p = this.otherPlayers.get(peerId);
    if (p) {
      this.scene.remove(p.mesh);
      this.otherPlayers.delete(peerId);
    }
  }

  // ──────────────────────────────────────────
  // WORKSTATIONS
  // ──────────────────────────────────────────
  placeWorkstation(type, position) {
    const colors = {
      'Workbench':       0x78350f,
      'Furnace':         0x991b1b,
      'Anvil':           0x374151,
      'Cauldron':        0x1e40af,
      'Campfire':        0xf97316,
      'Fletching Table': 0x6b4c2a,
    };
    const color = colors[type] || 0x444444;

    const group = new THREE.Group();

    // Base
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(1, 0.8, 1),
      this._getMat(color)
    );
    base.position.y = 0.4;
    base.castShadow = true;
    group.add(base);

    // Type-specific detail
    if (type === 'Furnace') {
      const door = new THREE.Mesh(
        new THREE.BoxGeometry(0.4, 0.3, 0.05),
        this._getMat(0x1a1a1a)
      );
      door.position.set(0, 0.4, 0.53);
      group.add(door);
      // Glow inside
      const glow = new THREE.Mesh(
        new THREE.BoxGeometry(0.32, 0.22, 0.04),
        this._getMat(0xff6600, { emissive: 0xff3300, emissiveIntensity: 1 })
      );
      glow.position.set(0, 0.4, 0.52);
      group.add(glow);
    } else if (type === 'Campfire') {
      // Logs
      for (let i = 0; i < 4; i++) {
        const log = new THREE.Mesh(
          new THREE.CylinderGeometry(0.06, 0.08, 0.9, 5),
          this._getMat(0x5a3e2b)
        );
        log.rotation.z = Math.PI/2;
        log.rotation.y = (i/4)*Math.PI;
        log.position.y = 0.06;
        group.add(log);
      }
      // Flame (emissive cone)
      const flame = new THREE.Mesh(
        new THREE.ConeGeometry(0.18, 0.5, 6),
        this._getMat(0xff6600, { emissive: 0xff3300, emissiveIntensity: 1.5 })
      );
      flame.position.y = 0.4;
      group.add(flame);
    } else if (type === 'Anvil') {
      const top = new THREE.Mesh(
        new THREE.BoxGeometry(1, 0.25, 0.6),
        this._getMat(0x9ca3af)
      );
      top.position.y = 0.9;
      group.add(top);
    }

    // Label sprite
    const label = this._createNameTag(type);
    label.position.y = 1.4;
    group.add(label);

    group.position.set(position.x, position.y, position.z);
    group.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });

    this.scene.add(group);
    const ws = { type, position, mesh: group, id: `ws_${Date.now()}` };
    this.workstations.push(ws);
    return ws;
  }

  getWorkstationNear(position, radius = 3) {
    for (const ws of this.workstations) {
      const dx = ws.position.x - position.x;
      const dz = ws.position.z - position.z;
      if (Math.sqrt(dx*dx + dz*dz) < radius) return ws;
    }
    return null;
  }

  // ──────────────────────────────────────────
  // PARTICLES
  // ──────────────────────────────────────────
  _spawnDestroyParticles(position) {
    const count = 12;
    for (let i = 0; i < count; i++) {
      const p = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 0.12, 0.12),
        this._getMat(0x8b6914, { emissive: 0x3a2800, emissiveIntensity: 0.5 })
      );
      p.position.copy(position);
      p.position.y += 1;
      const vel = new THREE.Vector3(
        (Math.random()-0.5)*5,
        Math.random()*6,
        (Math.random()-0.5)*5
      );
      this.scene.add(p);
      this.particles.push({ mesh: p, vel, life: 1.0 });
    }
  }

  updateParticles(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.vel.y -= 15 * dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      p.life -= dt * 2;
      if (p.mesh.material) p.mesh.material.opacity = Math.max(0, p.life);
      p.mesh.material.transparent = true;
      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        this.particles.splice(i, 1);
      }
    }
  }

  // ──────────────────────────────────────────
  // UPDATE
  // ──────────────────────────────────────────
  update(dt, playerPosition) {
    this.updateDroppedItems(dt, playerPosition);
    this.updateParticles(dt);

    // Update name tags to face camera
    if (window.gameInstance?.camera) {
      const cam = window.gameInstance.camera;
      for (const [, p] of this.otherPlayers) {
        p.mesh.children.forEach(child => {
          if (child.isMesh && child.material?.map instanceof THREE.CanvasTexture) {
            child.lookAt(cam.position);
          }
        });
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────
// ENEMY SYSTEM
// ─────────────────────────────────────────────────────────────
const ENEMY_TYPES = {
  Goblin: {
    label: 'Gobelin',
    hp: 30, damage: 5, speed: 4.5, attackRate: 1.0, attackRange: 1.5,
    color: 0x4ade80, size: [0.35, 1.0, 0.35], xp: 10,
    detectRange: 20,
  },
  Orc: {
    label: 'Orc',
    hp: 80, damage: 15, speed: 2.5, attackRate: 1.5, attackRange: 2.0,
    color: 0x16a34a, size: [0.55, 1.5, 0.55], xp: 30,
    detectRange: 25,
  },
  DarkKnight: {
    label: 'Chevalier Noir',
    hp: 200, damage: 30, speed: 3.5, attackRate: 1.2, attackRange: 2.0,
    color: 0x1e1b4b, size: [0.6, 2.0, 0.6], xp: 80,
    detectRange: 30,
  },
};

class Enemy {
  constructor(scene, type, position) {
    this.scene = scene;
    this.typeName = type;
    this.def = ENEMY_TYPES[type];
    this.hp = this.def.hp;
    this.maxHp = this.def.hp;
    this.position = new THREE.Vector3(position.x, position.y, position.z);
    this.velocity = new THREE.Vector3();
    this.attackCooldown = 0;
    this.isDead = false;
    this.deathTimer = 0;
    this.id = `enemy_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    this._buildMesh();
  }

  _buildMesh() {
    const [w, h, d] = this.def.size;
    const group = new THREE.Group();

    // Body
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(w*2, h, d*2),
      new THREE.MeshLambertMaterial({ color: this.def.color })
    );
    body.position.y = h / 2;
    body.castShadow = true;
    group.add(body);

    // Head
    const headSize = Math.min(w, d) * 1.8;
    const head = new THREE.Mesh(
      new THREE.BoxGeometry(headSize, headSize, headSize),
      new THREE.MeshLambertMaterial({ color: this.def.color })
    );
    head.position.y = h + headSize * 0.5;
    head.castShadow = true;
    group.add(head);

    // Eyes
    for (let s of [-1, 1]) {
      const eye = new THREE.Mesh(
        new THREE.SphereGeometry(headSize * 0.15, 4, 4),
        new THREE.MeshBasicMaterial({ color: 0xff0000 })
      );
      eye.position.set(s * headSize * 0.28, h + headSize * 0.6, headSize * 0.45);
      group.add(eye);
    }

    // Health bar (background)
    this.hpBarBg = new THREE.Mesh(
      new THREE.PlaneGeometry(1.2, 0.12),
      new THREE.MeshBasicMaterial({ color: 0x333333, depthTest: false })
    );
    this.hpBarBg.position.y = h + headSize + 0.35;
    this.hpBarBg.rotation.x = -0.3;
    group.add(this.hpBarBg);

    this.hpBar = new THREE.Mesh(
      new THREE.PlaneGeometry(1.2, 0.1),
      new THREE.MeshBasicMaterial({ color: 0xef4444, depthTest: false })
    );
    this.hpBar.position.y = h + headSize + 0.36;
    this.hpBar.rotation.x = -0.3;
    group.add(this.hpBar);

    group.position.copy(this.position);
    this.scene.add(group);
    this.mesh = group;
  }

  _updateHpBar() {
    if (!this.hpBar) return;
    const ratio = Math.max(0, this.hp / this.maxHp);
    this.hpBar.scale.x = ratio;
    this.hpBar.position.x = -(1.2 * (1 - ratio)) / 2;
    this.hpBar.material.color.setHex(
      ratio > 0.6 ? 0x22c55e : ratio > 0.3 ? 0xf59e0b : 0xef4444
    );
  }

  takeDamage(amount) {
    this.hp = Math.max(0, this.hp - amount);
    this._updateHpBar();
    // Flash red
    this.mesh.traverse(c => {
      if (c.isMesh && c.material?.color) {
        const orig = c.material.color.getHex();
        c.material.color.setHex(0xffffff);
        setTimeout(() => { if (c.material) c.material.color.setHex(orig); }, 80);
      }
    });
    if (this.hp <= 0) this.die();
  }

  die() {
    this.isDead = true;
    this.deathTimer = 0.4;
    if (window.audio) window.audio.playEnemyHit();
    // Shrink animation handled in update
  }

  update(dt, targets, world) {
    if (this.isDead) {
      this.deathTimer -= dt;
      const s = Math.max(0, this.deathTimer / 0.4);
      this.mesh.scale.setScalar(s);
      if (this.deathTimer <= 0) {
        this.scene.remove(this.mesh);
      }
      return;
    }

    // Find closest target
    let closestDist = Infinity, closestTarget = null;
    for (const t of targets) {
      if (!t || t.isDead) continue;
      const dx = t.position.x - this.position.x;
      const dz = t.position.z - this.position.z;
      const d = Math.sqrt(dx*dx + dz*dz);
      if (d < closestDist && d < this.def.detectRange) {
        closestDist = d;
        closestTarget = t;
      }
    }

    if (closestTarget) {
      // Move toward target
      if (closestDist > this.def.attackRange) {
        const dx = closestTarget.position.x - this.position.x;
        const dz = closestTarget.position.z - this.position.z;
        const len = Math.sqrt(dx*dx + dz*dz);
        this.velocity.x = (dx/len) * this.def.speed;
        this.velocity.z = (dz/len) * this.def.speed;
      } else {
        this.velocity.x = 0;
        this.velocity.z = 0;
        // Attack
        this.attackCooldown -= dt;
        if (this.attackCooldown <= 0) {
          this.attackCooldown = this.def.attackRate;
          if (closestTarget.takeDamage) {
            closestTarget.takeDamage(this.def.damage, 'enemy');
            if (window.audio) window.audio.playEnemyHit();
          }
        }
      }

      // Face target
      this.mesh.rotation.y = Math.atan2(
        closestTarget.position.x - this.position.x,
        closestTarget.position.z - this.position.z
      );
    } else {
      // Wander
      this.velocity.x *= 0.95;
      this.velocity.z *= 0.95;
    }

    // Apply movement
    this.position.x += this.velocity.x * dt;
    this.position.z += this.velocity.z * dt;

    // Ground follow
    const groundY = world?.getHeightAt(this.position.x, this.position.z) || 0;
    this.position.y = groundY;
    this.velocity.y = 0;

    this.mesh.position.copy(this.position);

    // Face camera for HP bar
    if (window.gameInstance?.camera) {
      this.hpBarBg?.lookAt(window.gameInstance.camera.position);
      this.hpBar?.lookAt(window.gameInstance.camera.position);
    }
  }

  getNetworkState() {
    return {
      id: this.id,
      type: this.typeName,
      position: { x: this.position.x, y: this.position.y, z: this.position.z },
      hp: this.hp,
      isDead: this.isDead,
    };
  }

  destroy() {
    this.scene.remove(this.mesh);
  }
}

// ─────────────────────────────────────────────────────────────
// WAVE MANAGER
// ─────────────────────────────────────────────────────────────
class WaveManager {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.enemies = [];
    this.dayNumber = 1;
    this.isNight = false;
    this.waveActive = false;

    // Callbacks
    this.onWaveStart = null;
    this.onWaveEnd = null;
    this.onEnemyKilled = null;
  }

  /**
   * Called when night starts.
   */
  startWave(dayNumber) {
    this.dayNumber = dayNumber;
    this.waveActive = true;
    this.isNight = true;

    const spawns = this._getWaveComposition(dayNumber);
    for (const { type, count } of spawns) {
      for (let i = 0; i < count; i++) {
        setTimeout(() => this._spawnEnemy(type), i * 500 + Math.random() * 2000);
      }
    }

    if (this.onWaveStart) this.onWaveStart(dayNumber, spawns);
    if (window.audio) window.audio.playNightStart();
  }

  _getWaveComposition(day) {
    // Scale difficulty with days
    if (day === 1) return [{ type: 'Goblin', count: 3 }];
    if (day === 2) return [{ type: 'Goblin', count: 5 }, { type: 'Orc', count: 1 }];
    if (day % 5 === 0) {
      // Boss wave every 5th night
      return [
        { type: 'Goblin', count: 4 + day },
        { type: 'Orc', count: 2 + Math.floor(day/3) },
        { type: 'DarkKnight', count: 1 + Math.floor(day/5) },
      ];
    }
    return [
      { type: 'Goblin', count: Math.min(15, 3 + day * 2) },
      { type: 'Orc', count: Math.max(0, Math.floor((day - 2) / 2)) },
    ];
  }

  _spawnEnemy(type) {
    if (!this.waveActive) return;

    // Spawn around the island perimeter (50-80 units from center)
    const angle = Math.random() * Math.PI * 2;
    const dist = 50 + Math.random() * 30;
    const x = Math.cos(angle) * dist;
    const z = Math.sin(angle) * dist;
    const y = this.world?.getHeightAt(x, z) || 0;

    const enemy = new Enemy(this.scene, type, { x, y, z });
    this.enemies.push(enemy);
  }

  endWave() {
    this.isNight = false;
    this.waveActive = false;
    // Clear remaining enemies
    for (const e of this.enemies) {
      if (!e.isDead) e.takeDamage(9999); // kill all
    }
    if (this.onWaveEnd) this.onWaveEnd(this.dayNumber);
    if (window.audio) window.audio.playDayStart();
  }

  update(dt, targets) {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      e.update(dt, targets, this.world);

      if (e.isDead && e.deathTimer <= 0) {
        this.enemies.splice(i, 1);
        if (this.onEnemyKilled) this.onEnemyKilled(e);
      }
    }

    // Check if wave cleared
    if (this.waveActive && this.enemies.length === 0 && this.isNight) {
      // Don't auto-end wave based on enemy count (day cycle handles it)
    }
  }

  getEnemyCount() { return this.enemies.filter(e => !e.isDead).length; }
  getAllEnemies() { return this.enemies; }

  serialize() {
    return {
      dayNumber: this.dayNumber,
    };
  }
}

// ─────────────────────────────────────────────────────────────
// PIG ENTITY
// ─────────────────────────────────────────────────────────────
class Pig {
  constructor(scene, world, position) {
    this.scene = scene;
    this.world = world;
    this.health = 20;
    this.isDead = false;
    this.mesh = new THREE.Group();
    
    const matBody = new THREE.MeshLambertMaterial({color: 0xffb6c1});
    const matHead = new THREE.MeshLambertMaterial({color: 0xff69b4});
    
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.6, 1.2), matBody);
    body.position.y = 0.4;
    body.castShadow = true;
    this.mesh.add(body);
    
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), matHead);
    head.position.set(0, 0.65, 0.6);
    head.castShadow = true;
    this.mesh.add(head);
    
    this.mesh.position.copy(position);
    this.targetPos = position.clone();
    this.idleTimer = 0;
    
    this.scene.add(this.mesh);
  }
  
  update(dt) {
    if (this.isDead || !this.mesh) return;
    this.idleTimer -= dt;
    
    if (this.idleTimer <= 0) {
      this.idleTimer = 2 + Math.random() * 4;
      const angle = Math.random() * Math.PI * 2;
      const dist = 3 + Math.random() * 5;
      this.targetPos.set(
        this.mesh.position.x + Math.cos(angle) * dist,
        0,
        this.mesh.position.z + Math.sin(angle) * dist
      );
      if (this.world) {
        const distFromCenter = Math.hypot(this.targetPos.x, this.targetPos.z);
        if (distFromCenter > 180) {
          this.targetPos.x = 0; this.targetPos.z = 0;
        }
        this.targetPos.y = this.world.getHeightAt(this.targetPos.x, this.targetPos.z);
      }
    }
    
    const dx = this.targetPos.x - this.mesh.position.x;
    const dz = this.targetPos.z - this.mesh.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist > 0.5) {
      const speed = this.idleTimer > 5 ? 6 : 2;
      this.mesh.position.x += (dx/dist) * speed * dt;
      this.mesh.position.z += (dz/dist) * speed * dt;
      if (this.world) this.mesh.position.y = this.world.getHeightAt(this.mesh.position.x, this.mesh.position.z);
      this.mesh.rotation.y = Math.atan2(dx, dz);
    }
  }
  
  takeDamage(amount) {
    this.health -= amount;
    this.idleTimer = 6;
    const angle = Math.random() * Math.PI * 2;
    this.targetPos.set(
      this.mesh.position.x + Math.cos(angle) * 20,
      0,
      this.mesh.position.z + Math.sin(angle) * 20
    );
    if (this.health <= 0) {
      this.isDead = true;
      this.scene.remove(this.mesh);
      if (window.gameInstance) {
        window.gameInstance._spawnResourceDrops(
          { drops: [{type: 'Raw Meat', count: 1 + Math.floor(Math.random()*2)}] },
          { position: this.mesh.position }
        );
      }
    }
  }
}

// Expose globally
window.Pig = Pig;
window.EntityManager = EntityManager;
window.WaveManager = WaveManager;
window.Enemy = Enemy;
window.ENEMY_TYPES = ENEMY_TYPES;
