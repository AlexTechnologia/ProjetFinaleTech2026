/**
 * main.js — VeilCraft Game Orchestrator (Fixed)
 * Bridges all subsystems: Three.js scene, World, Player, Entities, Network, UI, Audio
 * @authors Eric Villeneuve & Alex Musial — ICS3U 2026
 */

'use strict';

(() => {

// ─────────────────────────────────────────────────────────────
// ITEM DATABASE — icons, descriptions, stats for UI tooltips
// ─────────────────────────────────────────────────────────────
window.ITEM_DB = {
  // Resources
  'Wood':          { icon: '🪵', desc: 'Bois de chêne' },
  'Birch Wood':    { icon: '🪵', desc: 'Bois de bouleau' },
  'Bark':          { icon: '🌿', desc: 'Écorce' },
  'Rock':          { icon: '🪨', desc: 'Pierre' },
  'Flint':         { icon: '💎', desc: 'Silex tranchant' },
  'Iron Ore':      { icon: '⛏️', desc: 'Minerai de fer brut' },
  'Iron Bar':      { icon: '🔩', desc: 'Lingot de fer fondu' },
  'Gold Bar':      { icon: '🥇', desc: 'Lingot d\'or' },
  'Stone Brick':   { icon: '🧱', desc: 'Brique de pierre' },
  'Wheat':         { icon: '🌾', desc: 'Blé' },
  'Raw Meat':      { icon: '🥩', desc: 'Viande crue', health: 5, hunger: 15 },
  'Cooked Meat':   { icon: '🍖', desc: 'Viande cuite', health: 20, hunger: 50 },
  // Consumables
  'Pink Shroom':   { icon: '🍄', desc: 'Restaure 30 endurance', stamina: 30 },
  'Red Shroom':    { icon: '🍄', desc: 'Restaure 30 vie', health: 30 },
  'Yellow Shroom': { icon: '🍄', desc: 'Restaure 30 faim', hunger: 30 },
  'Bread':         { icon: '🍞', desc: 'Restaure 40 faim et 10 vie', hunger: 40, health: 10 },
  'Soup':          { icon: '🍲', desc: 'Restaure faim, vie et endurance', hunger: 60, health: 30, stamina: 20 },
  // Tools
  'Wooden Axe':    { icon: '🪓', desc: 'Hache en bois', damage: 5, type: 'tool' },
  'Wooden Pickaxe':{ icon: '⛏️', desc: 'Pioche en bois', damage: 5, type: 'tool' },
  'Wooden Sword':  { icon: '🗡️', desc: 'Épée en bois', damage: 8, type: 'tool' },
  'Wooden Shield': { icon: '🛡️', desc: 'Bouclier en bois', armor: 5, type: 'tool' },
  'Stone Axe':     { icon: '🪓', desc: 'Hache en pierre', damage: 15, type: 'tool' },
  'Stone Pickaxe': { icon: '⛏️', desc: 'Pioche en pierre', damage: 15, type: 'tool' },
  'Stone Sword':   { icon: '🗡️', desc: 'Épée en pierre', damage: 18, type: 'tool' },
  'Iron Axe':      { icon: '🪓', desc: 'Hache en fer', damage: 30, type: 'tool' },
  'Iron Pickaxe':  { icon: '⛏️', desc: 'Pioche en fer', damage: 30, type: 'tool' },
  'Iron Sword':    { icon: '⚔️', desc: 'Épée en fer', damage: 35, type: 'tool' },
  'Steel Sword':   { icon: '⚔️', desc: 'Épée en acier', damage: 55, type: 'tool' },
  'Gold Sword':    { icon: '⚔️', desc: 'Épée en or', damage: 45, type: 'tool' },
  'Bow':           { icon: '🏹', desc: 'Arc — besoin de flèches', damage: 25, range: 15, type: 'tool' },
  'Flint Arrows':  { icon: '➳', desc: 'Munitions pour l\'arc', type: 'ammo' },
  'Iron Armor':    { icon: '🛡️', desc: 'Armure en fer', armor: 15, type: 'armor' },
  // Structures
  'Campfire':      { icon: '🔥', desc: 'Éclaire la nuit', type: 'structure' },
  'Workbench':     { icon: '🪚', desc: 'Permet de crafter des outils', type: 'structure' },
  'Furnace':       { icon: '🏭', desc: 'Fond les minerais', type: 'structure' },
  'Anvil':         { icon: '⚒️', desc: 'Forge les armes en métal', type: 'structure' },
  'Cauldron':      { icon: '🫕', desc: 'Cuisine des aliments', type: 'structure' },
  'Fletching Table':{ icon: '🏹', desc: 'Crée arcs et flèches', type: 'structure' },
};

// ─────────────────────────────────────────────────────────────
// SAVE SYSTEM — wraps saveManager from save.js
// ─────────────────────────────────────────────────────────────
class SaveSystem {
  constructor() { this.KEY = 'veilcraft_v1'; }

  save(slot, data) {
    try { localStorage.setItem(`${this.KEY}_slot${slot}`, JSON.stringify(data)); return true; }
    catch(e) { console.warn('[Save] Failed:', e); return false; }
  }

  load(slot) {
    try {
      const raw = localStorage.getItem(`${this.KEY}_slot${slot}`);
      return raw ? JSON.parse(raw) : null;
    } catch(e) { return null; }
  }

  hasSave(slot) { return !!localStorage.getItem(`${this.KEY}_slot${slot}`); }
}

// ─────────────────────────────────────────────────────────────
// WAVE MANAGER — wraps entities.js enemy spawning
// ─────────────────────────────────────────────────────────────
class WaveManager {
  constructor(scene, world) {
    this.scene   = scene;
    this.world   = world;
    this.enemies = [];
    this.dayNumber = 1;
    this.isNight   = false;
    this.onWaveStart  = null;
    this.onWaveEnd    = null;
    this.onEnemyKilled= null;
    this._spawnDone   = false;
  }

  startWave() {
    this._spawnDone = false;
    if (this.onWaveStart) this.onWaveStart(this.dayNumber, this._getWaveConfig());
    setTimeout(() => this._spawnWave(), 5000);
  }

  endWave() {
    if (this.onWaveEnd) this.onWaveEnd(this.dayNumber);
    this.dayNumber++;
  }

  _getWaveConfig() {
    const d = this.dayNumber;
    if (d % 5 === 0) return [{ type: 'DarkKnight', count: 1 }, { type: 'Orc', count: d }, { type: 'Goblin', count: d * 2 }];
    if (d === 1)     return [{ type: 'Goblin', count: 3 }];
    if (d === 2)     return [{ type: 'Goblin', count: 5 }, { type: 'Orc', count: 1 }];
    return [{ type: 'Goblin', count: Math.min(3 + d * 2, 15) }, { type: 'Orc', count: Math.min(Math.floor(d / 2), 5) }];
  }

  _spawnWave() {
    const config = this._getWaveConfig();
    let delay = 0;
    for (const group of config) {
      for (let i = 0; i < group.count; i++) {
        setTimeout(() => {
          if (!this.isNight) return;
          const angle  = Math.random() * Math.PI * 2;
          const radius = 30 + Math.random() * 20;
          const pos    = new THREE.Vector3(Math.cos(angle) * radius, 2, Math.sin(angle) * radius);
          const enemy  = new Enemy(this.scene, group.type, pos, (e) => {
            this.enemies = this.enemies.filter(x => x !== e);
            if (this.onEnemyKilled) this.onEnemyKilled(e);
          });
          this.enemies.push(enemy);
        }, delay);
        delay += 700;
      }
    }
  }

  update(dt, playerPos) {
    this.enemies = this.enemies.filter(e => !e.isDead);
    for (const e of this.enemies) e.update(dt, playerPos);
  }

  getAllEnemies() { return this.enemies; }

  clearEnemies() {
    this.enemies.forEach(e => e.destroy());
    this.enemies = [];
  }
}

// ─────────────────────────────────────────────────────────────
// ENEMY — simple 3D box enemy with pathfinding
// ─────────────────────────────────────────────────────────────
const ENEMY_DEFS = {
  Goblin:     { color: 0x44aa44, hp: 30,  dmg: 5,  speed: 4.5, scale: 0.7 },
  Orc:        { color: 0x2d6b2d, hp: 80,  dmg: 15, speed: 3.0, scale: 1.0 },
  DarkKnight: { color: 0x222255, hp: 200, dmg: 30, speed: 2.5, scale: 1.4 },
};

class Enemy {
  constructor(scene, typeName, position, onDeath) {
    const def = ENEMY_DEFS[typeName] || ENEMY_DEFS.Goblin;
    this.typeName  = typeName;
    this.health    = def.hp;
    this.maxHealth = def.hp;
    this.damage    = def.dmg;
    this.speed     = def.speed;
    this.isDead    = false;
    this.onDeath   = onDeath;
    this.attackCd  = 0;
    this.scene     = scene;

    // Mesh
    const g = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.6 * def.scale, 1.0 * def.scale, 0.4 * def.scale),
      new THREE.MeshStandardMaterial({ color: def.color, emissive: def.color, emissiveIntensity: 0.15, roughness: 0.8 })
    );
    body.position.y = 0.5 * def.scale;
    body.castShadow = true;
    g.add(body);

    const head = new THREE.Mesh(
      new THREE.BoxGeometry(0.45 * def.scale, 0.45 * def.scale, 0.45 * def.scale),
      new THREE.MeshStandardMaterial({ color: new THREE.Color(def.color).multiplyScalar(1.3), emissive: def.color, emissiveIntensity: 0.2, roughness: 0.8 })
    );
    head.position.y = 1.2 * def.scale;
    g.add(head);

    // Health bar
    this._hpCanvas = document.createElement('canvas');
    this._hpCanvas.width = 128; this._hpCanvas.height = 16;
    this._hpTex = new THREE.CanvasTexture(this._hpCanvas);
    const hpBar = new THREE.Mesh(
      new THREE.PlaneGeometry(1.0 * def.scale, 0.12 * def.scale),
      new THREE.MeshBasicMaterial({ map: this._hpTex, transparent: true, depthWrite: false })
    );
    hpBar.position.y = 1.9 * def.scale;
    this._hpBar = hpBar;
    g.add(hpBar);

    g.position.copy(position);
    g.userData.isEnemy = true;
    g.userData.enemyRef = this;
    scene.add(g);
    this.mesh = g;
    this.position = g.position;

    this._updateHPBar();
  }

  _updateHPBar() {
    const ctx = this._hpCanvas.getContext('2d');
    const pct = Math.max(0, this.health / this.maxHealth);
    ctx.clearRect(0, 0, 128, 16);
    ctx.fillStyle = '#333'; ctx.fillRect(0, 0, 128, 16);
    ctx.fillStyle = pct > 0.5 ? '#4CAF50' : pct > 0.25 ? '#FF9800' : '#F44336';
    ctx.fillRect(2, 2, Math.floor(124 * pct), 12);
    this._hpTex.needsUpdate = true;
  }

  takeDamage(amount) {
    if (this.isDead) return;
    this.health -= amount;
    this._updateHPBar();
    if (window.audio) window.audio.playEnemyHit();
    if (this.health <= 0) this.die();
  }

  die() {
    this.isDead = true;
    if (window.audio) window.audio.playEnemyDeath();
    if (this.onDeath) this.onDeath(this);
    // Shrink animation
    const iv = setInterval(() => {
      if (!this.mesh) { clearInterval(iv); return; }
      this.mesh.scale.multiplyScalar(0.85);
      if (this.mesh.scale.x < 0.05) { clearInterval(iv); this.destroy(); }
    }, 30);
  }

  destroy() {
    if (this.mesh) { this.scene.remove(this.mesh); this.mesh = null; }
  }

  update(dt, playerPos) {
    if (this.isDead || !this.mesh) return;
    if (this._hpBar && window.gameCamera) this._hpBar.quaternion.copy(window.gameCamera.quaternion);

    const dx = playerPos.x - this.mesh.position.x;
    const dz = playerPos.z - this.mesh.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist > 1.5) {
      this.mesh.position.x += (dx / dist) * this.speed * dt;
      this.mesh.position.z += (dz / dist) * this.speed * dt;
      this.mesh.rotation.y = Math.atan2(dx, dz);
    } else {
      this.attackCd -= dt;
      if (this.attackCd <= 0) {
        this.attackCd = 1.5;
        if (window.gameInstance?.player) {
          window.gameInstance.player.takeDamage(this.damage);
        }
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────
// DROPPED ITEM
// ─────────────────────────────────────────────────────────────
const ITEM_COLORS_MAP = {
  'Wood': 0x8B4513, 'Birch Wood': 0xDEB887, 'Bark': 0x7B5E3A,
  'Rock': 0x888888, 'Flint': 0x6699CC, 'Iron Ore': 0xCD7F32,
  'Iron Bar': 0xC0C0C0, 'Gold Bar': 0xFFD700, 'Stone Brick': 0xBBAA99,
  'Pink Shroom': 0xFF69B4, 'Red Shroom': 0xFF4444, 'Yellow Shroom': 0xFFD700,
  'Wheat': 0xDAA520, 'Bread': 0xDEB887, 'Soup': 0xFF8C00,
  'Iron Sword': 0x9999FF, 'Iron Armor': 0x7777AA, 'Flint Arrows': 0x6699AA,
};

class DroppedItem {
  constructor(scene, type, count, position) {
    this.scene = scene;
    this.type  = type;
    this.count = count;
    this.id    = `drop_${Date.now()}_${Math.random().toString(36).substr(2,4)}`;
    this._rot  = Math.random() * Math.PI * 2;
    this._bob  = Math.random() * Math.PI * 2;
    this._baseY = (position.y || 0) + 0.5;

    const color = ITEM_COLORS_MAP[type] || 0xFFFFFF;
    this.mesh = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.18, 0),
      new THREE.MeshLambertMaterial({ color, emissive: color, emissiveIntensity: 0.3 })
    );
    this.mesh.position.set(position.x, this._baseY, position.z);
    this.mesh.userData.isDroppedItem = true;
    this.mesh.userData.dropRef = this;
    scene.add(this.mesh);
  }

  update(dt) {
    if (!this.mesh) return;
    this._rot += dt * 2;
    this._bob += dt * 1.5;
    this.mesh.rotation.y = this._rot;
    this.mesh.position.y = this._baseY + Math.sin(this._bob) * 0.12;
  }

  destroy() {
    if (this.mesh) { this.scene.remove(this.mesh); this.mesh.geometry.dispose(); this.mesh.material.dispose(); this.mesh = null; }
  }
}

// ─────────────────────────────────────────────────────────────
// NETWORK WRAPPER
// ─────────────────────────────────────────────────────────────
class Network {
  constructor() {
    this.peer        = null;
    this.mode        = 'solo';
    this.roomCode    = null;
    this.myId        = null;
    this.isHost      = false;
    this.connections = new Map();
    this.localName   = 'Aventurier';

    this.onConnected   = null;
    this.onPlayerJoined= null;
    this.onPlayerLeft  = null;
    this.onMessage     = null;
    this.onError       = null;
  }

  init(mode, roomCode, name) {
    this.mode = mode;
    this.roomCode = roomCode;
    this.localName = name || 'Aventurier';

    if (mode === 'solo') {
      this.isHost = true;
      this.myId = 'solo_' + Math.random().toString(36).substr(2, 6);
      if (this.onConnected) setTimeout(() => this.onConnected(), 50);
      return;
    }

    const peerId = mode === 'host' ? 'vc_' + roomCode : undefined;
    this.peer = new Peer(peerId, {
      config: { iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:3478' },
      ]},
      debug: 0,
    });

    this.peer.on('open', (id) => {
      this.myId = id;
      if (mode === 'host') {
        this.isHost = true;
        if (this.onConnected) this.onConnected();
      } else {
        this._connectToPeer('vc_' + roomCode);
      }
    });

    this.peer.on('connection', (conn) => this._setup(conn));
    this.peer.on('error', (err) => { if (this.onError) this.onError(err); });
    this.peer.on('disconnected', () => { setTimeout(() => this.peer?.reconnect(), 2000); });
  }

  _connectToPeer(id) {
    const conn = this.peer.connect(id, { reliable: true, serialization: 'json' });
    this._setup(conn, true);
  }

  _setup(conn, isHostConn = false) {
    conn.on('open', () => {
      this.connections.set(conn.peer, conn);
      if (this.onPlayerJoined) this.onPlayerJoined(conn.peer, this.localName);
      if (isHostConn && this.onConnected) { this.myId = this.peer.id; this.onConnected(); }
      // If host, send world sync to new peer
      if (this.isHost && window.gameInstance) {
        setTimeout(() => {
          window.gameInstance._sendWorldSync(conn.peer);
        }, 500);
      }
    });
    conn.on('data', (data) => {
      if (data && data.type && this.onMessage) {
        // Relay if host
        if (this.isHost) {
          this.connections.forEach((c, pid) => { if (pid !== conn.peer && c.open) c.send({ ...data, _relay: true, _from: conn.peer }); });
        }
        this.onMessage(data.type, data.data, data._from || conn.peer);
      }
    });
    conn.on('close', () => {
      this.connections.delete(conn.peer);
      if (this.onPlayerLeft) this.onPlayerLeft(conn.peer);
    });
    conn.on('error', (err) => console.warn('[Net] conn error:', err));
  }

  send(peerId, type, data) {
    const c = this.connections.get(peerId);
    if (c?.open) c.send({ type, data });
  }

  broadcast(type, data, excludeId = null) {
    const msg = { type, data };
    this.connections.forEach((c, id) => { if (id !== excludeId && c.open) c.send(msg); });
  }

  getLatency() { return 0; }
  isSolo() { return this.mode === 'solo'; }
  disconnect() { this.connections.forEach(c => c.close()); this.peer?.destroy(); }
}

// ─────────────────────────────────────────────────────────────
// CRAFTING ADAPTER — maps UI crafting to crafting.js system
// ─────────────────────────────────────────────────────────────
class Crafting {
  getRecipes(workstationType) {
    if (typeof craftingSystem !== 'undefined') {
      return craftingSystem.getRecipesForWorkstation(workstationType || null);
    }
    return [];
  }

  canCraft(recipe, inventory) {
    if (typeof craftingSystem !== 'undefined') {
      // Adapt inventory format
      const flatInv = inventory.slots.filter(Boolean);
      return recipe.ingredients.every(ing => {
        const have = flatInv.filter(s => s.type === ing.type).reduce((n, s) => n + s.count, 0);
        return have >= ing.count;
      });
    }
    return false;
  }

  craft(recipe, inventory) {
    if (typeof craftingSystem === 'undefined') return false;
    // Check ingredients
    if (!this.canCraft(recipe, inventory)) return false;
    // Remove ingredients
    for (const ing of recipe.ingredients) {
      inventory.removeItem(ing.type, ing.count);
    }
    // Add result
    inventory.addItem(recipe.result.type, recipe.result.count);
    return true;
  }
}

// ─────────────────────────────────────────────────────────────
// PLAYER ADAPTER — wraps player.js Player class
// ─────────────────────────────────────────────────────────────
class PlayerAdapter {
  constructor(camera, scene, domElement) {
    this.camera     = camera;
    this.scene      = scene;
    this.health     = 100;
    this.maxHealth  = 100;
    this.hunger     = 100;
    this.maxHunger  = 100;
    this.stamina    = 100;
    this.maxStamina = 100;
    this.armor      = 0;
    this.isDead     = false;
    this.respawnTimer = 0;
    this.position   = new THREE.Vector3(0, 1.7, 0);
    this.velocity   = new THREE.Vector3();
    this.onGround   = true;
    this.isSprinting= false;
    this.isMoving   = false;
    this.yaw        = 0;
    this.pitch      = 0;
    this.headBobTime= 0;
    this.headBobAmt = 0;
    this.mouseSensitivity = 5;
    this.inventory  = new Inventory(30);
    this.attackCd   = 0;
    this._lastAttack= 0;
    this.id         = 'local';
    this.name       = 'Joueur';

    // Callbacks set by VeilCraftGame
    this.onAttack   = null;
    this.onItemDrop = null;
    this.onDeath    = null;
    this.onRespawn  = null;
    this.onDamage   = null;
    this.onHeal     = null;

    // Input state
    this.keys = {};
    this.isLocked = false;

    // PointerLock controls inline
    this.controls = this._buildControls(camera, domElement);
    // Held item
    this.heldItemContainer = new THREE.Group();
    this.heldItemContainer.position.set(0.5, -0.4, -0.8);
    this.camera.add(this.heldItemContainer);
    this.updateHeldItem();

    this._setupInput(domElement);
  }

  updateHeldItem() {
    this.heldItemContainer.clear();
    const item = this.inventory.getSelectedItem();
    if (!item) return;
    const db = window.ITEM_DB?.[item.type];
    const color = ITEM_COLORS_MAP[item.type] || 0xAAAAAA;
    
    let mesh;
    if (db?.type === 'tool' || db?.type === 'armor') {
      mesh = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.8, 0.1), new THREE.MeshLambertMaterial({ color }));
      mesh.position.set(0, 0.4, 0);
      mesh.rotation.x = Math.PI / 6;
    } else {
      mesh = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), new THREE.MeshLambertMaterial({ color }));
    }
    this.heldItemContainer.add(mesh);
  }

  _buildControls(camera, el) {
    const euler = new THREE.Euler(0, 0, 0, 'YXZ');
    const self  = this;
    const ctrl  = {
      isLocked: false,
      lock() { el.requestPointerLock(); },
      unlock() { document.exitPointerLock(); },
    };
    el.addEventListener('click', () => {
      if (!ctrl.isLocked && !window.gameInstance?.ui?.inventoryOpen && !window.gameInstance?.isPaused) {
        ctrl.lock();
        if (window.audio) { window.audio.init(); window.audio.resume(); }
      }
    });
    document.addEventListener('pointerlockchange', () => {
      ctrl.isLocked = (document.pointerLockElement === el);
      self.isLocked = ctrl.isLocked;
      if (ctrl.isLocked) {
        const ctp = document.getElementById('click-to-play');
        if (ctp) ctp.style.display = 'none';
      }
    });
    document.addEventListener('mousemove', (e) => {
      if (!ctrl.isLocked) return;
      const sens = (self.mouseSensitivity / 5) * 0.002;
      euler.setFromQuaternion(camera.quaternion);
      euler.y -= e.movementX * sens;
      euler.x -= e.movementY * sens;
      euler.x = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, euler.x));
      camera.quaternion.setFromEuler(euler);
      self.yaw   = euler.y;
      self.pitch = euler.x;
    });
    return ctrl;
  }

  _setupInput(el) {
    document.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
      if (!this.controls.isLocked || window.gameInstance?.ui?.chatOpen) return;

      if (e.code === 'KeyQ') {
        const item = this.inventory.getSelectedItem();
        if (item && this.onItemDrop) this.onItemDrop({ type: item.type, count: item.count });
        this.inventory.slots[this.inventory.selectedSlot] = null;
        if (window.gameInstance) window.gameInstance.ui.updateHotbar(this);
      }
      if (e.code === 'KeyF') { this.useSelectedItem(); if (window.gameInstance) window.gameInstance.ui.updateHotbar(this); }

      // Hotbar number keys
      if (e.code.startsWith('Digit')) {
        const n = parseInt(e.code.replace('Digit', ''));
        this.inventory.selectSlot(n === 0 ? 9 : n - 1);
        this.updateHeldItem();
        if (window.gameInstance) window.gameInstance.ui.updateHotbar(this);
      }
    });
    document.addEventListener('keyup', (e) => { this.keys[e.code] = false; });

    // Scroll to change slot
    document.addEventListener('wheel', (e) => {
      if (window.gameInstance?.ui?.inventoryOpen) return;
      const dir = e.deltaY > 0 ? 1 : -1;
      this.inventory.selectSlot((this.inventory.selectedSlot + dir + 10) % 10);
      this.updateHeldItem();
      if (window.gameInstance) window.gameInstance.ui.updateHotbar(this);
    }, { passive: true });

    // Attack
    document.addEventListener('mousedown', (e) => {
      if (e.button !== 0 || !this.controls.isLocked) return;
      if (window.gameInstance?.ui?.inventoryOpen || window.gameInstance?.isPaused) return;
      const now = performance.now() / 1000;
      if (now - this._lastAttack < 0.4) return;
      this._lastAttack = now;
      if (this.onAttack) {
        const item = this.inventory.getSelectedItem();
        const db   = item ? window.ITEM_DB?.[item.type] : null;
        const dmg  = db?.damage || 3;
        const tool = db?.type === 'tool' ? item.type : 'Fist';
        this.onAttack(dmg, tool);
      }
      if (window.audio) window.audio.playHitWood();
    });
  }

  useSelectedItem() {
    const item = this.inventory.getSelectedItem();
    if (!item) return;
    const db = window.ITEM_DB?.[item.type];
    if (!db) return;
    if (db.health || db.hunger || db.stamina) {
      if (db.health)  this.health  = Math.min(this.maxHealth,  this.health  + db.health);
      if (db.hunger)  this.hunger  = Math.min(this.maxHunger,  this.hunger  + db.hunger);
      if (db.stamina) this.stamina = Math.min(this.maxStamina, this.stamina + db.stamina);
      item.count--;
      if (item.count <= 0) this.inventory.slots[this.inventory.selectedSlot] = null;
      if (window.audio) window.audio.playPickup();
      if (window.gameInstance) {
        window.gameInstance.ui.showPickup(`${db.icon} ${item.type} utilisé`);
      }
    }
  }

  takeDamage(amount) {
    if (this.isDead) return;
    const dmg = Math.max(1, amount - this.armor);
    this.health = Math.max(0, this.health - dmg);
    if (window.audio) window.audio.playPlayerHurt();
    if (window.gameInstance) window.gameInstance.ui.showDamageFlash();
    if (this.onDamage) this.onDamage(dmg);
    if (this.health <= 0) this.die();
  }

  die() {
    this.isDead = true; this.respawnTimer = 5;
    if (window.audio) window.audio.playPlayerDeath();
    if (this.onDeath) this.onDeath('Ennemi');
    if (window.gameInstance) window.gameInstance.ui.showDeathScreen('Ennemi');
  }

  respawn() {
    this.isDead = false;
    this.health = this.maxHealth / 2; this.hunger = 80; this.stamina = 100;
    this.position.set((Math.random()-0.5)*6, 3, (Math.random()-0.5)*6);
    this.velocity.set(0,0,0);
    if (this.onRespawn) this.onRespawn();
    if (window.gameInstance) window.gameInstance.ui.hideDeathScreen();
  }

  update(dt, getHeight) {
    if (this.isDead) {
      this.respawnTimer -= dt;
      if (this.respawnTimer <= 0) this.respawn();
      return;
    }
    this._move(dt, getHeight);
    this._stats(dt);
    this._headBob(dt);
    this.camera.position.copy(this.position);
    this.camera.position.y += this.headBobAmt;
  }

  _move(dt, getHeight) {
    if (window.gameInstance?.ui?.inventoryOpen || window.gameInstance?.isPaused || window.gameInstance?.ui?.chatOpen) return;

    const spd = (this.keys['ShiftLeft'] || this.keys['ShiftRight']) && this.stamina > 0 ? 14 : 8;
    this.isSprinting = spd > 8;

    const fwd = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const rgt = new THREE.Vector3( Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const dir = new THREE.Vector3();
    if (this.keys['KeyW']) dir.add(fwd);
    if (this.keys['KeyS']) dir.sub(fwd);
    if (this.keys['KeyA']) dir.sub(rgt);
    if (this.keys['KeyD']) dir.add(rgt);
    this.isMoving = dir.lengthSq() > 0;

    if (this.isMoving) { dir.normalize(); this.velocity.x = dir.x * spd; this.velocity.z = dir.z * spd; }
    else { this.velocity.x *= 0.8; this.velocity.z *= 0.8; }

    if (this.keys['Space'] && this.onGround) { this.velocity.y = 10; this.onGround = false; }
    if (!this.onGround) this.velocity.y -= 25 * dt;

    const safeDt = Math.min(dt, 0.05);
    this.position.x += this.velocity.x * safeDt;
    this.position.y += this.velocity.y * safeDt;
    this.position.z += this.velocity.z * safeDt;

    if (getHeight) {
      const groundY = getHeight(this.position.x, this.position.z) + 1.7;
      if (this.position.y <= groundY) { this.position.y = groundY; this.velocity.y = 0; this.onGround = true; }
      else { this.onGround = this.position.y - groundY < 0.2; }
    }

    const dist = Math.hypot(this.position.x, this.position.z);
    if (dist > 190) { this.position.x *= 190 / dist; this.position.z *= 190 / dist; }

    if (window.audio) window.audio.update(dt, this.isMoving && this.onGround, this.isSprinting);
  }

  _stats(dt) {
    this.hunger = Math.max(0, this.hunger - (this.isSprinting ? 1.5 : 0.5) * dt);
    if (this.isSprinting && this.isMoving) this.stamina = Math.max(0, this.stamina - 20 * dt);
    else if (this.hunger > 0) this.stamina = Math.min(this.maxStamina, this.stamina + 10 * dt);
    if (this.hunger <= 0) this.health = Math.max(0, this.health - 2 * dt);
  }

  _headBob(dt) {
    if (this.isMoving && this.onGround) {
      this.headBobTime += dt * (this.isSprinting ? 12 : 8);
      this.headBobAmt = Math.sin(this.headBobTime) * 0.06;
    } else { this.headBobAmt *= 0.85; this.headBobTime = 0; }
  }

  getData() {
    return { pos: { x: this.position.x, y: this.position.y, z: this.position.z }, yaw: this.yaw, pitch: this.pitch, health: this.health, hunger: this.hunger, stamina: this.stamina, inventory: this.inventory.serialize() };
  }
}

// ─────────────────────────────────────────────────────────────
// MAIN GAME CLASS
// ─────────────────────────────────────────────────────────────
class VeilCraftGame {
  constructor() {
    this.scene    = null; this.camera  = null; this.renderer = null;
    this.world    = null; this.player  = null; this.waveManager = null;
    this.network  = null; this.ui      = null; this.crafting = null;
    this.saveSystem = null;

    // Day/night
    this.DAY_DURATION  = 120; this.NIGHT_DURATION = 60;
    this.dayTime       = 0;  this.isNight = false; this.dayNumber = 1;

    // Scene objects
    this.sunMesh = null; this.moonMesh = null; this.starField = null;
    this.sunLight = null; this.ambientLight = null;
    this._terrainMesh = null; this._waterMesh = null;

    // Game state
    this.isPaused  = false; this.isRunning = false;
    this.lastTime  = 0; this.syncTimer = 0;

    // Dropped items & remote players
    this.droppedItems  = [];
    this.remotePlayers = new Map(); // peerId → OtherPlayerMesh
    this._playerColors = ['#a78bfa','#67e8f9','#86efac','#fbbf24','#f87171','#fb923c'];
    this._colorIdx     = 0;

    // Session
    this.mode = 'solo'; this.roomCode = null; this.playerName = 'Aventurier'; this.seed = 42;

    window.gameInstance  = this;
    window.gameCamera    = null;
  }

  // ─── BOOT ───────────────────────────────────────
  async start() {
    this._parseSession();
    this._initScene();
    this._initSubsystems();
    this._setupInput();
    this._initNetwork();
    this._generateWorld();
    this._finalizeLoad();
    this._startLoop();
  }

  _parseSession() {
    const p = new URLSearchParams(window.location.search);
    this.mode       = p.get('mode') || sessionStorage.getItem('vc_mode') || 'solo';
    this.roomCode   = p.get('room') || sessionStorage.getItem('vc_room') || null;
    this.playerName = sessionStorage.getItem('vc_name') || 'Aventurier';
    const s         = sessionStorage.getItem('vc_seed');
    this.seed       = s ? parseInt(s) : Math.floor(Math.random() * 999999) + 1;
    console.log(`[Game] mode=${this.mode} room=${this.roomCode} seed=${this.seed}`);
  }

  // ─── SCENE ───────────────────────────────────────
  _initScene() {
    const canvas = document.getElementById('game-canvas');
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;

    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    window.gameCamera = this.camera;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x87ceeb, 0.008);

    // Sky
    if (THREE.Sky) {
      this.sky = new THREE.Sky();
      this.sky.scale.setScalar(10000);
      this.scene.add(this.sky);
      this.sunPosition = new THREE.Vector3();
    } else {
      this.scene.background = new THREE.Color(0x87ceeb);
    }

    this.ambientLight = new THREE.AmbientLight(0x404080, 0.5);
    this.scene.add(this.ambientLight);

    this.sunLight = new THREE.DirectionalLight(0xfff8e0, 1.5);
    this.sunLight.position.set(50, 80, 30);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.set(2048, 2048);
    this.sunLight.shadow.camera.near = 0.5; this.sunLight.shadow.camera.far = 300;
    this.sunLight.shadow.camera.left = -120; this.sunLight.shadow.camera.right = 120;
    this.sunLight.shadow.camera.top  =  120; this.sunLight.shadow.camera.bottom = -120;
    this.scene.add(this.sunLight);

    // Moon
    const moonLight = new THREE.DirectionalLight(0x8899cc, 0.15);
    moonLight.position.set(-50, 40, -50);
    this.scene.add(moonLight);
    this._moonLight = moonLight;

    // Sun mesh
    this.sunMesh = new THREE.Mesh(new THREE.SphereGeometry(4,12,12), new THREE.MeshBasicMaterial({ color: 0xfff176 }));
    this.scene.add(this.sunMesh);

    // Moon mesh
    this.moonMesh = new THREE.Mesh(new THREE.SphereGeometry(2.5,12,12), new THREE.MeshBasicMaterial({ color: 0xd0d0ff }));
    this.scene.add(this.moonMesh);

    // Stars
    const starCount = 600; const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const th = Math.random()*Math.PI*2, ph = Math.acos(2*Math.random()-1)*0.5, r = 400+Math.random()*80;
      starPos[i*3]=r*Math.sin(ph)*Math.cos(th); starPos[i*3+1]=r*Math.cos(ph); starPos[i*3+2]=r*Math.sin(ph)*Math.sin(th);
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    this.starField = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 1.2, sizeAttenuation: true }));
    this.starField.visible = false;
    this.scene.add(this.starField);

    // Water
    if (THREE.Water) {
      this._waterMesh = new THREE.Water(
        new THREE.PlaneGeometry(2000, 2000),
        {
          textureWidth: 512,
          textureHeight: 512,
          waterNormals: new THREE.TextureLoader().load('https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/waternormals.jpg', function (texture) {
            texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
          }),
          sunDirection: new THREE.Vector3(),
          sunColor: 0xffffff,
          waterColor: 0x001e0f,
          distortionScale: 3.7,
          fog: this.scene.fog !== undefined
        }
      );
      this._waterMesh.rotation.x = -Math.PI / 2;
      this._waterMesh.position.y = -0.3;
      this.scene.add(this._waterMesh);
    } else {
      this._waterMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(2000, 2000).rotateX(-Math.PI/2),
        new THREE.MeshLambertMaterial({ color: 0x1565c0, transparent: true, opacity: 0.75 })
      );
      this._waterMesh.position.y = -0.3;
      this.scene.add(this._waterMesh);
    }

    // Post-Processing
    if (THREE.EffectComposer && THREE.UnrealBloomPass) {
      const renderScene = new THREE.RenderPass(this.scene, this.camera);
      const bloomPass = new THREE.UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
      bloomPass.threshold = 0.85;
      bloomPass.strength = 0.25;
      bloomPass.radius = 0.5;
      
      this.composer = new THREE.EffectComposer(this.renderer);
      this.composer.addPass(renderScene);
      this.composer.addPass(bloomPass);
    }

    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      if (this.composer) this.composer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  _buildTerrainMesh() {
    if (this._terrainMesh) { this.scene.remove(this._terrainMesh); this._terrainMesh.geometry.dispose(); }
    const seg = 100, sz = 240;
    let geo = new THREE.PlaneGeometry(sz, sz, seg, seg);
    geo.rotateX(-Math.PI / 2);
    
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const y = this.world ? this.world.getHeightAt(x, z) : 0;
      pos.setY(i, Math.max(y, -0.4));
    }
    
    geo = geo.toNonIndexed();
    geo.computeVertexNormals();

    const newPos = geo.attributes.position;
    const colors = new Float32Array(newPos.count * 3);
    for (let i = 0; i < newPos.count; i += 3) {
      const y1 = newPos.getY(i), y2 = newPos.getY(i+1), y3 = newPos.getY(i+2);
      const avgY = (y1 + y2 + y3) / 3;
      let r=0.3,g=0.55,b=0.2;
      if (avgY < 0.3)      { r=0.86; g=0.82; b=0.6;  } // Sand
      else if (avgY < 4)   { r=0.45; g=0.7;  b=0.25; } // Bright Grass
      else if (avgY < 9)   { r=0.35; g=0.55; b=0.2;  } // Dark Grass
      else if (avgY < 14)  { r=0.55; g=0.52; b=0.45; } // Rock
      else                 { r=0.95; g=0.95; b=0.95; } // Snow
      
      for (let j = 0; j < 3; j++) {
        colors[(i+j)*3]=r; colors[(i+j)*3+1]=g; colors[(i+j)*3+2]=b;
      }
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    
    this._terrainMesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ 
      vertexColors: true, roughness: 0.8, metalness: 0.1 
    }));
    this._terrainMesh.receiveShadow = true;
    this.scene.add(this._terrainMesh);
  }

  // ─── SUBSYSTEMS ─────────────────────────────────
  _initSubsystems() {
    this.ui = new UI();
    this.ui.setLoadingProgress(20, 'Initialisation des systèmes…');

    this.world      = new World();
    this.crafting   = craftingSystem;
    this.saveSystem = new SaveSystem();

    this.player = new PlayerAdapter(this.camera, this.scene, this.renderer.domElement);
    this.player.name = this.playerName;

    this.player.onAttack   = (dmg, tool) => this._onPlayerAttack(dmg, tool);
    this.player.onItemDrop = (item)       => this._onItemDrop(item);
    this.player.onDeath    = (cause)      => { 
      if (window.audio) window.audio.playPlayerDeath(); 
      this.ui.showDeathScreen(cause);
    };
    this.player.onRespawn  = ()           => {
      this.ui.hideDeathScreen();
    };
    this.player.onDamage   = (amt)        => { if (this.ui) this.ui.showDamageNumber(amt, false); };

    this.waveManager = new WaveManager(this.scene, this.world);
    this.waveManager.onWaveStart = (day, spawns) => {
      this.ui.showWaveAnnounce(day, spawns);
      if (window.audio) window.audio.playWaveSpawn();
      if (!this.network.isSolo()) this.network.broadcast(MSG.WAVE_START, { dayNumber: day });
    };
    this.waveManager.onWaveEnd = (day) => {
      this.ui.showDayAnnounce(day + 1);
      if (!this.network.isSolo()) this.network.broadcast(MSG.WAVE_END, {});
    };
    this.waveManager.onEnemyKilled = (enemy) => {
      const drops = this._enemyDrops(enemy.typeName);
      for (const d of drops) this._spawnDrop(d.type, d.count, { x: enemy.position?.x || 0, y: 0, z: enemy.position?.z || 0 });
    };

    this.ui.player   = this.player;
    this.ui.crafting = this.crafting;
    this.ui.onCraftRequest = (recipe, wsType) => this._doCraft(recipe, wsType);
    this.ui.setLoadingProgress(40, 'Systèmes prêts…');
  }

  // ─── INPUT ──────────────────────────────────────
  _setupInput() {
    document.addEventListener('keydown', (e) => {
      if (e.code === 'Escape') {
        if (this.ui.inventoryOpen) { this.ui.closeInventory(); }
        else if (!this.isPaused) { this.pause(); }
        else { this.resume(); }
        e.preventDefault();
      }
      if (e.code === 'KeyE' && !this.ui.chatOpen) {
        if (this.ui.inventoryOpen) { this.ui.closeInventory(); }
        else {
          const ws = this._getNearbyWorkstation();
          this.ui.openInventory(this.player, this.crafting, ws);
        }
        e.preventDefault();
      }
      if (e.code === 'KeyP' && this.player.isLocked) this._placeStructure();
    });
    window.gameInstance = this;
  }

  pause() { this.isPaused = true; this.ui.showPause(); this.player.controls.unlock(); }
  resume() { this.isPaused = false; this.ui.hidePause(); if (!this.ui.inventoryOpen) setTimeout(() => this.player.controls.lock(), 100); }
  toggleSettings() {
    const m = document.getElementById('settings-modal');
    if (m) { const o = m.style.display !== 'none'; m.style.display = o ? 'none' : 'flex'; this.ui.settingsOpen = !o; }
  }

  // ─── NETWORK ────────────────────────────────────
  _initNetwork() {
    this.network = new Network();
    this.network.localName = this.playerName;

    this.network.onConnected = () => {
      const ov = document.getElementById('connection-overlay');
      if (ov) ov.classList.add('hidden');
      this.ui.setConnectionStatus('online', this.mode === 'solo' ? 'Solo' : `Salle: ${this.roomCode}`);
      this.ui.showClickToPlay();
    };

    this.network.onPlayerJoined = (peerId, name) => {
      const color = this._playerColors[this._colorIdx++ % this._playerColors.length];
      this.remotePlayers.set(peerId, { name, color, ping: 0, mesh: this._buildRemotePlayerMesh(color) });
      this.ui.addChatMessage('Système', `${name || peerId.substring(0,8)} a rejoint!`, '#86efac');
      this._updatePlayerTab();
    };

    this.network.onPlayerLeft = (peerId) => {
      const p = this.remotePlayers.get(peerId);
      if (p?.mesh) { this.scene.remove(p.mesh); }
      this.remotePlayers.delete(peerId);
      this.ui.addChatMessage('Système', 'Un joueur a quitté.', '#fca5a5');
      this._updatePlayerTab();
    };

    this.network.onMessage = (type, data, fromId) => this._handleMsg(type, data, fromId);
    this.network.onError   = (err) => { this.ui.setConnectionStatus('offline', 'Hors ligne'); console.error('[Net]', err); };

    this.network.init(this.mode, this.roomCode, this.playerName);
  }

  _sendWorldSync(peerId) {
    this.network.send(peerId, MSG.WORLD_SYNC, {
      seed: this.world.seed,
      worldData: this.world.serialize(),
      dayNumber: this.dayNumber,
      dayTime: this.dayTime,
      isNight: this.isNight,
    });
  }

  _handleMsg(type, data, fromId) {
    switch(type) {
      case MSG.WORLD_SYNC:
        if (this.mode === 'join' && data) {
          this.seed = data.seed;
          this.world.generate(data.seed);
          if (data.worldData) this.world.deserialize(data.worldData);
          this._buildTerrainMesh();
          this._buildResourceMeshes();
          this.dayNumber = data.dayNumber || 1;
          this.dayTime   = data.dayTime   || 0;
          this.isNight   = data.isNight   || false;
          this.waveManager.dayNumber = this.dayNumber;
        }
        break;
      case MSG.PLAYER_UPDATE:
        if (data && fromId !== 'local') {
          const rp = this.remotePlayers.get(fromId);
          if (rp?.mesh) {
            rp.mesh.position.lerp(new THREE.Vector3(data.x || 0, (data.y || 0) - 1, data.z || 0), 0.3);
            rp.mesh.rotation.y = data.yaw || 0;
          }
        }
        break;
      case MSG.RESOURCE_DESTROYED:
        if (data?.networkId && this.world) {
          this.world.damageResource(data.networkId, 9999);
          const mesh = this._resourceMeshes?.get(data.networkId);
          if (mesh) { this.scene.remove(mesh); this._resourceMeshes.delete(data.networkId); }
        }
        break;
      case MSG.ITEM_DROPPED:
        if (data) this._spawnDrop(data.type, data.count, data.position);
        break;
      case MSG.WORKSTATION_PLACED:
        if (data) this._placeWorkstationMesh(data.type, data.position);
        break;
      case MSG.CHAT:
        if (data) { const rp = this.remotePlayers.get(fromId); this.ui.addChatMessage(data.name || 'Joueur', data.msg, rp?.color || '#a78bfa'); }
        break;
      case MSG.WAVE_START:
        if (data) this.ui.showWaveAnnounce(data.dayNumber, []);
        break;
      case MSG.WAVE_END:
        this.ui.showDayAnnounce(this.dayNumber + 1);
        break;
    }
  }

  _updatePlayerTab() {
    const list = [{ name: this.playerName, color: '#a78bfa', ping: 0 },
      ...Array.from(this.remotePlayers.entries()).map(([,p]) => ({ name: p.name, color: p.color, ping: 0 }))];
    this.ui.updatePlayerList(list);
  }

  _buildRemotePlayerMesh(color) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 1.5, 8), new THREE.MeshLambertMaterial({ color }));
    body.position.y = 0.75; g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), new THREE.MeshLambertMaterial({ color: 0xFFDDAA }));
    head.position.y = 1.7; g.add(head);
    this.scene.add(g);
    return g;
  }

  // ─── WORLD ──────────────────────────────────────
  _generateWorld() {
    this.ui.setLoadingProgress(60, 'Génération du monde…');
    this.world.generate(this.seed);

    this.ui.setLoadingProgress(75, 'Construction du terrain…');
    this._buildTerrainMesh();

    this.ui.setLoadingProgress(85, 'Placement des ressources…');
    this._buildResourceMeshes();

    this.ui.setLoadingProgress(90, 'Apparition des animaux…');
    this.pigs = [];
    if (this.world) {
      for (let i = 0; i < 20; i++) {
        const angle = Math.random() * Math.PI * 2;
        const r = 20 + Math.random() * 140;
        const x = Math.cos(angle) * r;
        const z = Math.sin(angle) * r;
        const y = this.world.getHeightAt(x, z);
        if (y >= 0 && window.Pig) {
          this.pigs.push(new window.Pig(this.scene, this.world, new THREE.Vector3(x, y, z)));
        }
      }
    }

    if (this.mode === 'solo') {
      const saved = this.saveSystem.load(1);
      if (saved && saved.seed === this.seed) {
        if (saved.player?.pos) {
          this.player.position.set(saved.player.pos.x, saved.player.pos.y, saved.player.pos.z);
          this.player.yaw = saved.player.yaw || 0;
        }
        if (saved.player?.inventory) this.player.inventory.deserialize(saved.player.inventory);
        if (saved.dayNumber) { this.dayNumber = saved.dayNumber; this.waveManager.dayNumber = saved.dayNumber; }
        if (saved.dayTime)   this.dayTime = saved.dayTime;
        console.log('[Game] Save loaded — Day', this.dayNumber);
      }
    }
    this.ui.setLoadingProgress(95, 'Finalisation…');
  }

  _buildResourceMeshes() {
    this._resourceMeshes = this._resourceMeshes || new Map();
    this._resourceMeshes.forEach(m => this.scene.remove(m));
    this._resourceMeshes.clear();
    if (!this.world) return;

    // Use world.js resource data to build Three.js meshes
    this.world.resources.forEach((res, netId) => {
      if (this.world.destroyedIds.has(netId)) return;
      const mesh = this._buildResourceMesh(res);
      res.mesh = mesh;
      this._resourceMeshes.set(netId, mesh);
      this.scene.add(mesh);
    });
    console.log(`[Game] Built ${this._resourceMeshes.size} resource meshes`);
  }

  _buildResourceMesh(res) {
    const g = new THREE.Group();
    const t = res.type, s = res.scale || 1;

    const mat = (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.9, flatShading: true });

    switch(t) {
      case 'oak_tree': case 'dark_oak': {
        const tc = t === 'dark_oak' ? 0x4A3728 : 0x8B4513;
        const lc = t === 'dark_oak' ? 0x1A5C1A : 0x228B22;
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.15*s, 0.2*s, 1.8*s, 5), mat(tc));
        trunk.position.y = 0.9*s; trunk.castShadow = true; g.add(trunk);
        const leaves = new THREE.Mesh(new THREE.IcosahedronGeometry(1.2*s, 0), mat(lc));
        leaves.position.y = 2.4*s; leaves.rotation.set(Math.random(), Math.random(), Math.random()); leaves.castShadow = true; g.add(leaves);
        break;
      }
      case 'birch_tree': {
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12*s, 0.16*s, 1.8*s, 5), mat(0xF5F5DC));
        trunk.position.y = 0.9*s; trunk.castShadow = true; g.add(trunk);
        const leaves = new THREE.Mesh(new THREE.IcosahedronGeometry(1.0*s, 0), mat(0x90EE90));
        leaves.position.y = 2.2*s; leaves.rotation.set(Math.random(), Math.random(), Math.random()); leaves.castShadow = true; g.add(leaves);
        break;
      }
      case 'rock': {
        const r = new THREE.Mesh(new THREE.IcosahedronGeometry(0.6*s, 0), mat(0x777777));
        r.position.y = 0.4*s; r.rotation.set(Math.random(), Math.random(), Math.random()); r.scale.set(1, 0.7, 1.2); r.castShadow = true; g.add(r);
        break;
      }
      case 'iron_ore': {
        const r = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5*s, 0), mat(0x555555));
        r.position.y = 0.3*s; r.rotation.set(Math.random(), Math.random(), Math.random()); r.castShadow = true; g.add(r);
        const d = new THREE.Mesh(new THREE.IcosahedronGeometry(0.15*s, 0), mat(0xCD7F32));
        d.position.set(0.2*s, 0.4*s, 0.2*s); g.add(d);
        break;
      }
      case 'flint_node': {
        const f = new THREE.Mesh(new THREE.IcosahedronGeometry(0.32*s, 0), mat(0x445566));
        f.position.y = 0.2*s; f.rotation.set(Math.random(), Math.random(), Math.random()); g.add(f);
        break;
      }
      case 'pink_shroom': case 'red_shroom': case 'yellow_shroom': {
        const cc = {pink_shroom:0xFF69B4, red_shroom:0xFF4444, yellow_shroom:0xFFD700}[t];
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.06*s, 0.08*s, 0.35*s, 6), mat(0xFFFAFA));
        stem.position.y = 0.18*s; g.add(stem);
        const cap = new THREE.Mesh(new THREE.ConeGeometry(0.25*s, 0.22*s, 8), mat(cc));
        cap.position.y = 0.45*s; g.add(cap);
        break;
      }
      case 'wheat': {
        for (let i = 0; i < 5; i++) {
          const stk = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.6*s, 4), mat(0xDAA520));
          stk.position.set((Math.random()-0.5)*0.3, 0.3*s, (Math.random()-0.5)*0.3); g.add(stk);
        }
        break;
      }
      default: {
        const def = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), mat(0xAAAAAA));
        def.position.y = 0.2; g.add(def);
      }
    }
    g.position.set(res.position.x, res.position.y || 0, res.position.z);
    g.userData.networkId = res.networkId;
    g.userData.resourceType = t;
    g.userData.isResource = true;
    return g;
  }

  // ─── FINALIZE ───────────────────────────────────
  _finalizeLoad() {
    const groundY = this.world ? this.world.getHeightAt(0, 0) + 2 : 2;
    this.player.position.set(0, groundY, 0);

    // Starter items
    if (this.player.inventory.countItem('Wood') === 0) {
      this.player.inventory.addItem('Wood', 3);
      this.player.inventory.addItem('Rock', 2);
    }

    this.ui.onChatSend = (msg) => {
      this.ui.addChatMessage(this.playerName, msg, '#a78bfa');
      if (!this.network.isSolo()) this.network.broadcast(MSG.CHAT, { name: this.playerName, msg });
    };

    this.ui.setLoadingProgress(100, 'Prêt!');
    setTimeout(() => this.ui.hideLoadingScreen(), 600);
    this.isRunning = true;
    this.ui.showClickToPlay();
    this.ui.setConnectionStatus('online', this.mode === 'solo' ? 'Solo' : `Salle: ${this.roomCode}`);
    this._updatePlayerTab();

    // Auto-save every 30s in solo
    if (this.mode === 'solo') {
      setInterval(() => this._autoSave(), 30000);
    }

    console.log('[Game] Ready! Mode:', this.mode);
  }

  _autoSave() {
    this.saveSystem.save(1, {
      seed: this.world?.seed,
      dayNumber: this.dayNumber,
      dayTime: this.dayTime,
      player: this.player.getData(),
    });
    this.ui.showPickup('💾 Sauvegarde auto…');
  }

  // ─── GAME LOOP ───────────────────────────────────
  _startLoop() {
    const loop = (ts) => {
      requestAnimationFrame(loop);
      const dt = Math.min((ts - this.lastTime) / 1000, 0.1);
      this.lastTime = ts;
      if (this.isRunning && !this.isPaused) this._update(dt, ts);
      else if (this.player?.isDead) {
        this.player.update(dt, (x, z) => this.world ? this.world.getHeightAt(x, z) : 0);
        this.ui.updateDeathCountdown(this.player.respawnTimer);
      }
      if (this.composer) this.composer.render();
      else this.renderer.render(this.scene, this.camera);
    };
    requestAnimationFrame(loop);
  }

  _update(dt, ts) {
    // Player
    this.player.update(dt, (x, z) => this.world ? this.world.getHeightAt(x, z) : 0);
    this.ui.updateHUD(this.player);

    // Day/night cycle
    this._updateDayNight(dt);

    // Wave manager
    this.waveManager.update(dt, this.player.position);

    // Pigs
    if (this.pigs) {
      for (const pig of this.pigs) {
        pig.update(dt);
      }
    }

    // Dropped items
    for (let i = this.droppedItems.length - 1; i >= 0; i--) {
      const d = this.droppedItems[i];
      d.update(dt);
      if (!d.mesh) { this.droppedItems.splice(i, 1); continue; }
      const dx = d.mesh.position.x - this.player.position.x;
      const dz = d.mesh.position.z - this.player.position.z;
      if (Math.hypot(dx, dz) < 1.5) {
        const lo = this.player.inventory.addItem(d.type, d.count);
        this.ui.showPickup(`${window.ITEM_DB?.[d.type]?.icon || '📦'} ${d.type} ×${d.count}`);
        this.ui.updateHotbar(this.player);
        if (window.audio) window.audio.playPickup();
        if (!this.network.isSolo()) this.network.broadcast(MSG.ITEM_PICKED, { id: d.id });
        d.destroy();
        this.droppedItems.splice(i, 1);
      }
    }

    // Particles
    if (this.particles) {
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];
        p.userData.life -= dt * 2;
        if (p.userData.life <= 0) {
          this.scene.remove(p);
          this.particles.splice(i, 1);
        } else {
          p.userData.vy -= 9.8 * dt; // gravity
          p.position.x += p.userData.vx * dt;
          p.position.y += p.userData.vy * dt;
          p.position.z += p.userData.vz * dt;
          p.scale.setScalar(p.userData.life);
        }
      }
    }

    // Workstation Prompt
    const ws = this._getNearbyWorkstation();
    if (ws && this.ui.els.interactPrompt && !this.ui.inventoryOpen) {
      this.ui.els.interactPrompt.style.display = 'block';
      this.ui.els.interactText.textContent = `[E] Utiliser ${ws.type.replace('_', ' ')}`;
    } else if (this.ui.els.interactPrompt) {
      this.ui.els.interactPrompt.style.display = 'none';
    }

    // Remote player interpolation (handled in _handleMsg)
    // Water shimmer
    if (this._waterMesh) {
      if (this._waterMesh.material.uniforms && this._waterMesh.material.uniforms['time']) {
        this._waterMesh.material.uniforms['time'].value += dt * 0.5;
      } else {
        this._waterMesh.position.y = -0.3 + Math.sin(ts * 0.001) * 0.05;
      }
    }

    // Network sync every 50ms
    this.syncTimer += dt;
    if (this.syncTimer > 0.05 && !this.network.isSolo()) {
      this.syncTimer = 0;
      const pd = this.player.getData();
      this.network.broadcast(MSG.PLAYER_UPDATE, { x: pd.pos.x, y: pd.pos.y, z: pd.pos.z, yaw: pd.yaw });
    }
  }

  _updateDayNight(dt) {
    const total = this.DAY_DURATION + this.NIGHT_DURATION;
    this.dayTime = (this.dayTime + dt) % total;

    const wasNight = this.isNight;
    this.isNight   = this.dayTime >= this.DAY_DURATION;

    if (this.isNight && !wasNight) {
      if (window.audio) window.audio.playNightStart();
      this.waveManager.isNight = true;
      this.waveManager.startWave();
      if (this.network.isHost) this.network.broadcast(MSG.WAVE_START, { dayNumber: this.dayNumber });
    }
    if (!this.isNight && wasNight) {
      this.dayNumber++; this.waveManager.dayNumber = this.dayNumber;
      this.waveManager.isNight = false;
      this.waveManager.clearEnemies();
      this.waveManager.endWave();
      if (window.audio) window.audio.playDayStart();
      if (this.network.isHost) this.network.broadcast(MSG.WAVE_END, {});
    }

    const t = this.dayTime / total;
    const dayFrac = this.DAY_DURATION / total;

    // Sky color & lighting
    let sunInt, ambInt;
    if (!this.isNight) {
      const td = t / dayFrac;
      let s = 1.0;
      if (td < 0.15) { s = td / 0.15; sunInt = s * 0.8; ambInt = s * 0.4 + 0.1; }
      else if (td > 0.85) { s = 1 - ((td - 0.85) / 0.15); sunInt = s * 0.8; ambInt = s * 0.3 + 0.1; }
      else { sunInt = 0.8; ambInt = 0.4; }
      this.starField.visible = false;
    } else {
      sunInt = 0; ambInt = 0.1; this.starField.visible = true;
    }

    this.sunLight.intensity = sunInt;
    this.ambientLight.intensity = ambInt;
    this.scene.fog.density = this.isNight ? 0.015 : 0.008;

    // Sun/moon position
    const ang = t * Math.PI * 2 - Math.PI / 2;
    this.sunMesh.position.set(Math.cos(ang)*400, Math.sin(ang)*400, 0);
    this.moonMesh.position.set(-Math.cos(ang)*400, -Math.sin(ang)*400, 0);
    this.sunLight.position.copy(this.sunMesh.position).normalize().multiplyScalar(100);

    // Update THREE.Sky
    if (this.sky) {
      let phi = Math.PI/2;
      let theta = 0;
      if (!this.isNight) {
         const td = t / dayFrac;
         phi = Math.PI * (0.5 - Math.sin(td * Math.PI) * 0.4);
         theta = Math.PI * 2 * td;
      } else {
         phi = Math.PI * 0.6; // Below horizon
      }
      this.sunPosition.setFromSphericalCoords(1, phi, theta);
      this.sky.material.uniforms['sunPosition'].value.copy(this.sunPosition);
      this.sky.material.uniforms['turbidity'].value = 10;
      this.sky.material.uniforms['rayleigh'].value = 2;
      this.sky.material.uniforms['mieCoefficient'].value = 0.005;
      this.sky.material.uniforms['mieDirectionalG'].value = 0.8;
      
      if (this.scene.fog) {
        if (!this.isNight) {
          const td = t / dayFrac;
          let s = 1.0;
          if (td < 0.15) s = td / 0.15;
          else if (td > 0.85) s = 1 - ((td - 0.85) / 0.15);
          this.scene.fog.color.lerpColors(new THREE.Color(0xFF7043), new THREE.Color(0x87CEEB), s);
        } else {
          this.scene.fog.color.set(0x0A0A1E);
        }
      }
    } else {
      let sky;
      if (!this.isNight) {
        const td = t / dayFrac;
        if (td < 0.15) { sky = new THREE.Color().lerpColors(new THREE.Color(0x0A1A3A), new THREE.Color(0xFF7043), td/0.15); }
        else if (td > 0.85) { sky = new THREE.Color().lerpColors(new THREE.Color(0x87CEEB), new THREE.Color(0xFF5722), (td-0.85)/0.15); }
        else sky = new THREE.Color(0x87CEEB);
      } else sky = new THREE.Color(0x0A0A1E);
      this.scene.background?.set(sky);
      this.scene.fog.color.set(sky);
    }

    if (this._waterMesh && this._waterMesh.material.uniforms && this._waterMesh.material.uniforms['sunDirection']) {
      this._waterMesh.material.uniforms['sunDirection'].value.copy(this.sunLight.position).normalize();
    }

    this.ui.updateDayNight(this.dayNumber, this.isNight, this.dayTime / this.DAY_DURATION);
  }

  // ─── ATTACK ────────────────────────────────────
  _onPlayerAttack(damage, toolType) {
    if (!this.player.isLocked) return;

    if (this.player.heldItemContainer) {
      this.player.heldItemContainer.rotation.x -= Math.PI / 4;
      setTimeout(() => { if (this.player.heldItemContainer) this.player.heldItemContainer.rotation.x += Math.PI / 4; }, 150);
    }

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
    raycaster.far = toolType === 'Bow' ? 15 : 3.5;

    const targets = [];
    if (this._resourceMeshes) {
      this._resourceMeshes.forEach((mesh, netId) => {
        if (mesh) { mesh.traverse(o => { if (o.isMesh) targets.push({ obj: o, kind: 'resource', ref: netId }); }); }
      });
    }
    this.waveManager.getAllEnemies().forEach(e => {
      if (!e.isDead && e.mesh) { e.mesh.traverse(o => { if (o.isMesh) targets.push({ obj: o, kind: 'enemy', ref: e }); }); }
    });
    if (this.pigs) {
      this.pigs.forEach(p => {
        if (!p.isDead && p.mesh) p.mesh.traverse(o => { if (o.isMesh) targets.push({ obj: o, kind: 'pig', ref: p }); });
      });
    }

    const hits = raycaster.intersectObjects(targets.map(t => t.obj));
    if (!hits.length) return;

    const hitObj = hits[0].object;
    const t = targets.find(x => x.obj === hitObj);
    if (!t) return;

    if (t.kind === 'resource') this._hitResource(t.ref, damage, toolType);
    else if (t.kind === 'enemy') { t.ref.takeDamage(damage); }
    else if (t.kind === 'pig') { t.ref.takeDamage(damage); if (window.audio) window.audio.playHitWood(); }
  }

  _hitResource(netId, damage, toolType) {
    const res = this.world.getResource(netId);
    if (!res) return;
    if (window.audio) {
      if (res.type.includes('tree') || res.type.includes('wood')) window.audio.playHitWood();
      else window.audio.playHitRock();
    }
    
    const mesh = this._resourceMeshes.get(netId);
    if (mesh) {
      mesh.position.x += (Math.random() - 0.5) * 0.2;
      mesh.position.z += (Math.random() - 0.5) * 0.2;
      setTimeout(() => {
        if (mesh && res.position) mesh.position.set(res.position.x, res.position.y || 0, res.position.z);
      }, 100);
      this._spawnHitParticles(res.position, res.type);
    }

    const r = this.world.damageResource(netId, damage);
    if (r.destroyed) {
      const mesh = this._resourceMeshes.get(netId);
      if (mesh) { this.scene.remove(mesh); this._resourceMeshes.delete(netId); }
      this._spawnResourceDrops(r, res);
      if (!this.network.isSolo()) this.network.broadcast(MSG.RESOURCE_DESTROYED, { networkId: netId });
    }
  }

  _spawnHitParticles(pos, type) {
    this.particles = this.particles || [];
    const color = type.includes('rock') || type.includes('iron') || type.includes('flint') ? 0x888888 : 0x8B4513;
    for (let i=0; i<5; i++) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), new THREE.MeshBasicMaterial({ color }));
      p.position.set(pos.x + (Math.random()-0.5), (pos.y||0) + 1 + Math.random(), pos.z + (Math.random()-0.5));
      p.userData = { 
        vx: (Math.random()-0.5)*2, vy: Math.random()*2 + 1, vz: (Math.random()-0.5)*2,
        life: 1.0
      };
      this.scene.add(p);
      this.particles.push(p);
    }
  }

  _spawnResourceDrops(result, res) {
    // world.js returns destroyResource drops
    const drops = result.drops || [];
    if (!drops.length && res) {
      // Fallback drop table using world.js RESOURCE_DROPS via getDropsForResource
      const fallback = this.world.getDropsForResource ? this.world.getDropsForResource(res.type) : [];
      drops.push(...fallback);
    }
    for (const d of drops) {
      const type = this._normalizeItemName(d.type);
      this._spawnDrop(type, d.count, res.position);
    }
  }

  _normalizeItemName(raw) {
    // Map world.js type names to ITEM_DB keys
    const map = {
      wood: 'Wood', birch_wood: 'Birch Wood', bark: 'Bark', rock: 'Rock',
      flint: 'Flint', iron_ore: 'Iron Ore', pink_shroom: 'Pink Shroom',
      red_shroom: 'Red Shroom', yellow_shroom: 'Yellow Shroom', wheat: 'Wheat',
    };
    return map[raw] || raw;
  }

  _spawnDrop(type, count, pos) {
    const off = { x: pos.x + (Math.random()-0.5)*2, y: (pos.y||0)+0.5, z: pos.z + (Math.random()-0.5)*2 };
    const d = new DroppedItem(this.scene, type, count, off);
    this.droppedItems.push(d);
    if (!this.network.isSolo()) {
      this.network.broadcast(MSG.ITEM_DROPPED, { type, count, position: off, id: d.id });
    }
  }

  _enemyDrops(typeName) {
    const t = { Goblin:[{type:'Flint',count:1}], Orc:[{type:'Iron Ore',count:2}], DarkKnight:[{type:'Iron Bar',count:2}] };
    return t[typeName] || [];
  }

  // ─── ITEM DROP ──────────────────────────────────
  _onItemDrop(item) {
    const pos = { x: this.player.position.x, y: this.player.position.y - 0.5, z: this.player.position.z };
    this._spawnDrop(item.type, item.count, pos);
  }

  // ─── WORKSTATIONS ───────────────────────────────
  _getNearbyWorkstation() {
    if (!this.world) return null;
    const pp = this.player.position;
    return this.world.getNearbyWorkstation(pp, 4);
  }

  _placeStructure() {
    const item = this.player.inventory.getSelectedItem();
    if (!item) return;
    const db = window.ITEM_DB?.[item.type];
    if (!db || db.type !== 'structure') return;
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    const pos = { x: this.player.position.x + dir.x * 3, y: this.world?.getHeightAt(this.player.position.x + dir.x*3, this.player.position.z + dir.z*3) || 0, z: this.player.position.z + dir.z * 3 };
    this._placeWorkstationMesh(item.type, pos);
    this.world.placeWorkstation(item.type.toLowerCase().replace(/ /g,'_'), pos, this.network.myId);
    this.player.inventory.removeItem(item.type, 1);
    this.ui.updateHotbar(this.player);
    this.ui.showPickup(`${db.icon} ${item.type} placé`);
    if (window.audio) window.audio.playCraftSuccess();
    if (!this.network.isSolo()) this.network.broadcast(MSG.WORKSTATION_PLACED, { type: item.type, position: pos });
  }

  _placeWorkstationMesh(type, pos) {
    const COLORS = { 'Campfire':0xFF6600,'Workbench':0x8B4513,'Furnace':0xFF4500,'Anvil':0x555555,'Cauldron':0x336699,'Fletching Table':0x8B6914 };
    const color = COLORS[type] || 0xAAAAAA;
    const g = new THREE.Group();
    const box = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.7, 0.8), new THREE.MeshLambertMaterial({ color }));
    box.position.y = 0.35; box.castShadow = true; g.add(box);
    if (type === 'Campfire') {
      const fl = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.5, 6), new THREE.MeshBasicMaterial({ color: 0xFF6600 }));
      fl.position.y = 0.6; g.add(fl);
      const pl = new THREE.PointLight(0xFF6600, 1.5, 8); pl.position.y = 0.7; g.add(pl);
    }
    g.position.set(pos.x, pos.y || 0, pos.z);
    this.scene.add(g);
  }

  // ─── CRAFTING ───────────────────────────────────
  _doCraft(recipe, wsType) {
    const ok = this.crafting.craft(recipe, this.player.inventory);
    if (ok) {
      if (window.audio) window.audio.playCraftSuccess();
      this.ui.showPickup(`✅ ${recipe.name} fabriqué!`);
      this.ui.updateHotbar(this.player);
      // Place structure if it's a workstation
      const db = window.ITEM_DB?.[recipe.result?.type];
      if (db?.type === 'structure') this._placeStructure();
      this.ui.updateCraftingList(this.player, this.crafting, wsType);
    } else {
      if (window.audio) window.audio.playError();
      this.ui.showPickup('❌ Ressources insuffisantes');
    }
  }
}

// ─────────────────────────────────────────────────────────────
// BOOT
// ─────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  document.addEventListener('click', () => {
    if (window.audio && !window.audio._initialized) { window.audio.init(); }
  });
  const game = new VeilCraftGame();
  game.start().catch(err => {
    console.error('[Game] Fatal:', err);
    const el = document.getElementById('loading-tip');
    if (el) el.textContent = 'Erreur de démarrage. Rechargez la page. (' + err.message + ')';
  });
});

window.addEventListener('beforeunload', () => {
  if (window.gameInstance?.mode === 'solo') {
    window.gameInstance?._autoSave();
  }
  window.gameInstance?.network?.disconnect();
});

})(); // End of IIFE
