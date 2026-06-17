/**
 * player.js — VeilCraft Player Controller
 *
 * Implements first-person movement with PointerLock, physics, inventory,
 * stats (health/hunger/stamina), attacking, and head bob.
 * PointerLockControls is implemented inline since we load Three.js from CDN.
 */

// ─────────────────────────────────────────────────────────────
// POINTER LOCK CONTROLS (inline, no import needed)
// ─────────────────────────────────────────────────────────────
class PointerLockControls {
  constructor(camera, domElement) {
    this.camera = camera;
    this.domElement = domElement;
    this.isLocked = false;

    this._euler = new THREE.Euler(0, 0, 0, 'YXZ');
    this._PI_2 = Math.PI / 2;
    this.minPolarAngle = 0;
    this.maxPolarAngle = Math.PI;
    this.pointerSpeed = 1.0;

    this._onMouseMove = this._onMouseMove.bind(this);
    this._onPointerlockChange = this._onPointerlockChange.bind(this);
    this._onPointerlockError = this._onPointerlockError.bind(this);

    this.connect();
  }

  connect() {
    this.domElement.ownerDocument.addEventListener('mousemove', this._onMouseMove);
    this.domElement.ownerDocument.addEventListener('pointerlockchange', this._onPointerlockChange);
    this.domElement.ownerDocument.addEventListener('pointerlockerror', this._onPointerlockError);
  }

  disconnect() {
    this.domElement.ownerDocument.removeEventListener('mousemove', this._onMouseMove);
    this.domElement.ownerDocument.removeEventListener('pointerlockchange', this._onPointerlockChange);
    this.domElement.ownerDocument.removeEventListener('pointerlockerror', this._onPointerlockError);
  }

  lock() {
    this.domElement.requestPointerLock();
  }

  unlock() {
    this.domElement.ownerDocument.exitPointerLock();
  }

  _onPointerlockChange() {
    if (this.domElement.ownerDocument.pointerLockElement === this.domElement) {
      this.isLocked = true;
      if (this.onLock) this.onLock();
    } else {
      this.isLocked = false;
      if (this.onUnlock) this.onUnlock();
    }
  }

  _onPointerlockError() {
    console.error('[PointerLock] Error requesting pointer lock');
  }

  _onMouseMove(event) {
    if (!this.isLocked) return;

    const movementX = event.movementX || 0;
    const movementY = event.movementY || 0;
    const sens = (this.pointerSpeed * 0.002);

    this._euler.setFromQuaternion(this.camera.quaternion);
    this._euler.y -= movementX * sens;
    this._euler.x -= movementY * sens;
    this._euler.x = Math.max(
      this._PI_2 - this.maxPolarAngle,
      Math.min(this._PI_2 - this.minPolarAngle, this._euler.x)
    );

    this.camera.quaternion.setFromEuler(this._euler);
  }

  getObject() { return this.camera; }
  getDirection() {
    const dir = new THREE.Vector3(0, 0, -1);
    dir.applyQuaternion(this.camera.quaternion);
    return dir;
  }
}

// ─────────────────────────────────────────────────────────────
// ITEM DATABASE (stats lookup)
// ─────────────────────────────────────────────────────────────
const ITEM_DB = {
  // Tools
  'Fists':           { icon: '✊', damage: 3,  type: 'fist',    desc: 'Vos poings nus.' },
  'Wooden Axe':      { icon: '🪓', damage: 5,  type: 'axe',     desc: 'Axe en bois basique.' },
  'Wooden Pickaxe':  { icon: '⛏️', damage: 5,  type: 'pickaxe', desc: 'Pioche en bois.' },
  'Wooden Sword':    { icon: '🗡️', damage: 8,  type: 'sword',   desc: 'Épée en bois.' },
  'Stone Axe':       { icon: '🪓', damage: 15, type: 'axe',     desc: 'Hache en pierre.' },
  'Stone Pickaxe':   { icon: '⛏️', damage: 15, type: 'pickaxe', desc: 'Pioche en pierre.' },
  'Stone Sword':     { icon: '🗡️', damage: 18, type: 'sword',   desc: 'Épée en pierre.' },
  'Iron Axe':        { icon: '🪓', damage: 30, type: 'axe',     desc: 'Hache en fer.' },
  'Iron Pickaxe':    { icon: '⛏️', damage: 30, type: 'pickaxe', desc: 'Pioche en fer.' },
  'Iron Sword':      { icon: '🗡️', damage: 35, type: 'sword',   desc: 'Épée en fer.' },
  'Steel Sword':     { icon: '⚔️', damage: 55, type: 'sword',   desc: 'Épée en acier.' },
  'Gold Sword':      { icon: '⚔️', damage: 45, type: 'sword',   desc: 'Épée en or.' },
  'Bow':             { icon: '🏹', damage: 25, type: 'bow',     range: 15, desc: 'Arc en bouleau.' },
  // Armor
  'Iron Armor':      { icon: '🛡️', armor: 15, type: 'armor',   desc: 'Armure en fer.' },
  'Wooden Shield':   { icon: '🛡️', armor: 5,  type: 'shield',  desc: 'Bouclier en bois.' },
  // Materials
  'Wood':            { icon: '🪵', type: 'material', desc: 'Bois de chêne.' },
  'Birch Wood':      { icon: '🪵', type: 'material', desc: 'Bois de bouleau.' },
  'Bark':            { icon: '🟫', type: 'material', desc: 'Écorce d\'arbre.' },
  'Rock':            { icon: '🪨', type: 'material', desc: 'Pierre brute.' },
  'Flint':           { icon: '🔪', type: 'material', desc: 'Silex tranchant.' },
  'Iron Ore':        { icon: '🔩', type: 'material', desc: 'Minerai de fer brut.' },
  'Iron Bar':        { icon: '⬜', type: 'material', desc: 'Barre de fer fondu.' },
  'Stone Brick':     { icon: '🧱', type: 'material', desc: 'Brique de pierre.' },
  'Wheat':           { icon: '🌾', type: 'material', desc: 'Blé sauvage.' },
  'Flint Arrows':    { icon: '🏹', type: 'ammo',     desc: 'Flèches en silex (x10).' },
  // Consumables
  'Pink Shroom':     { icon: '🍄', type: 'consumable', stamina: 30, desc: '+30 Endurance.' },
  'Red Shroom':      { icon: '🍄', type: 'consumable', health: 30,  desc: '+30 Santé.' },
  'Yellow Shroom':   { icon: '🍄', type: 'consumable', hunger: 30,  desc: '+30 Faim.' },
  'Bread':           { icon: '🍞', type: 'consumable', hunger: 40, health: 10, desc: '+40 Faim, +10 Santé.' },
  'Soup':            { icon: '🥣', type: 'consumable', hunger: 60, health: 30, stamina: 20, desc: '+60 Faim, +30 Santé, +20 Endurance.' },
  // Structures
  'Campfire':        { icon: '🔥', type: 'structure', desc: 'Source de lumière et chaleur.' },
  'Workbench':       { icon: '🔨', type: 'structure', desc: 'Établi de forge.' },
  'Furnace':         { icon: '🔴', type: 'structure', desc: 'Four de fusion.' },
  'Anvil':           { icon: '⚫', type: 'structure', desc: 'Enclume pour armes avancées.' },
  'Fletching Table': { icon: '🏹', type: 'structure', desc: 'Table de flèches.' },
  'Cauldron':        { icon: '🫕', type: 'structure', desc: 'Chaudron de cuisine.' },
  'Bed':             { icon: '🛏️', type: 'structure', desc: 'Permet de passer la nuit et définir son point de réapparition.' },
  'Chest':           { icon: '🧰', type: 'structure', desc: 'Permet de stocker des objets de façon permanente.' },
};

// ─────────────────────────────────────────────────────────────
// INVENTORY
// ─────────────────────────────────────────────────────────────
class Inventory {
  constructor(size = 30) {
    this.size = size;
    this.slots = new Array(size).fill(null); // null or { type, count }
    this.hotbarSize = 10;
    this.selectedSlot = 0;
  }

  getHotbar() { return this.slots.slice(0, this.hotbarSize); }

  getSelectedItem() {
    return this.slots[this.selectedSlot] || null;
  }

  selectSlot(idx) {
    this.selectedSlot = Math.max(0, Math.min(this.hotbarSize - 1, idx));
  }

  /**
   * Add items to inventory. Returns leftover count.
   */
  addItem(type, count) {
    let remaining = count;

    // Try to stack on existing
    for (let i = 0; i < this.size && remaining > 0; i++) {
      if (this.slots[i] && this.slots[i].type === type) {
        this.slots[i].count += remaining;
        remaining = 0;
      }
    }

    // Fill empty slots
    for (let i = 0; i < this.size && remaining > 0; i++) {
      if (!this.slots[i]) {
        this.slots[i] = { type, count: remaining };
        remaining = 0;
      }
    }

    return remaining; // 0 = all added, >0 = inventory full
  }

  /**
   * Remove `count` of `type` from inventory. Returns actual removed count.
   */
  removeItem(type, count) {
    let remaining = count;
    for (let i = this.size - 1; i >= 0 && remaining > 0; i--) {
      if (this.slots[i] && this.slots[i].type === type) {
        const take = Math.min(this.slots[i].count, remaining);
        this.slots[i].count -= take;
        remaining -= take;
        if (this.slots[i].count <= 0) this.slots[i] = null;
      }
    }
    return count - remaining;
  }

  /**
   * Count total of a type across all slots.
   */
  countItem(type) {
    let total = 0;
    for (const s of this.slots) {
      if (s && s.type === type) total += s.count;
    }
    return total;
  }

  /**
   * Drop item from selected hotbar slot.
   */
  dropSelected() {
    const item = this.slots[this.selectedSlot];
    if (!item) return null;
    const dropped = { type: item.type, count: 1 };
    item.count--;
    if (item.count <= 0) this.slots[this.selectedSlot] = null;
    return dropped;
  }

  serialize() { return { slots: this.slots, selectedSlot: this.selectedSlot }; }
  deserialize(data) {
    if (data) {
      this.slots = data.slots || new Array(this.size).fill(null);
      this.selectedSlot = data.selectedSlot || 0;
    }
  }
}

// ─────────────────────────────────────────────────────────────
// PLAYER CLASS
// ─────────────────────────────────────────────────────────────
class Player {
  constructor(camera, scene, domElement) {
    this.camera = camera;
    this.scene = scene;
    this.domElement = domElement;

    // Stats
    this.health  = 100;
    this.maxHealth = 100;
    this.hunger  = 100;
    this.maxHunger = 100;
    this.stamina = 100;
    this.maxStamina = 100;
    this.armor = 0;       // From equipped armor

    // Physics
    this.velocity = new THREE.Vector3();
    this.onGround = false;
    this.gravity = -20;
    this.jumpForce = 7;
    this.speed = 5;
    this.sprintMultiplier = 1.65;
    this.acceleration = 12;
    this.friction = 10;

    // Position
    this.position = new THREE.Vector3(0, 5, 0);
    this.height = 1.7;  // Camera height above ground
    this.eyeHeight = 1.65;

    // Controls
    this.controls = new PointerLockControls(camera, domElement);
    this.keys = {};
    this.isSprinting = false;
    this.isDead = false;
    this.respawnTimer = 0;

    // Inventory
    this.inventory = new Inventory(30);

    // Head bob
    this.bobTime = 0;
    this.bobAmount = 0;
    this.baseEyeHeight = this.eyeHeight;

    // Attack
    this.isAttacking = false;
    this.attackCooldown = 0;
    this.attackRate = 0.5; // seconds
    this.attackRange = 3.5;
    this.raycaster = new THREE.Raycaster();

    // Visual Tool Model
    this.toolGroup = new THREE.Group();
    this.toolGroup.position.set(0.4, -0.4, -0.6);
    this.camera.add(this.toolGroup);
    this.scene.add(this.camera);
    
    this.toolMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.4, 0.1),
      new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.8 })
    );
    this.toolGroup.add(this.toolMesh);
    this.swingTimer = 0;
    this.attackRange = 3.0;
    this.isAttacking = false;

    // Nearby workstation (set by main.js)
    this.nearbyWorkstation = null;
    this.nearbyWorkstationType = null;

    // Network
    this.id = null;  // peerId
    this.name = 'Joueur';

    // Stats timers
    this.hungerTimer = 0;
    this.staminaTimer = 0;
    this.footstepTimer = 0;

    // Mouse sensitivity (can be changed from settings)
    this.mouseSensitivity = 5;

    // Death cause
    this.deathCause = 'environnement';

    this._setupInput();
  }

  // ──────────────────────────────────────────
  // INPUT
  // ──────────────────────────────────────────
  _setupInput() {
    document.addEventListener('keydown', e => {
      this.keys[e.code] = true;

      // Scroll hotbar with number keys
      if (!isNaN(e.key) && e.key >= '1' && e.key <= '9') {
        this.inventory.selectSlot(parseInt(e.key) - 1);
      }
      if (e.key === '0') this.inventory.selectSlot(9);

      // Q = drop item
      if (e.code === 'KeyQ' && this.controls.isLocked) {
        const dropped = this.inventory.dropSelected();
        if (dropped && this.onItemDrop) this.onItemDrop(dropped);
      }
    });

    document.addEventListener('keyup', e => {
      this.keys[e.code] = false;
    });

    document.addEventListener('wheel', e => {
      if (!this.controls.isLocked) return;
      const delta = e.deltaY > 0 ? 1 : -1;
      let next = (this.inventory.selectedSlot + delta + 10) % 10;
      this.inventory.selectSlot(next);
    });

    // Left click = attack
    document.addEventListener('mousedown', e => {
      if (e.button === 0 && this.controls.isLocked) {
        this.isAttacking = true;
      }
    });
    document.addEventListener('mouseup', e => {
      if (e.button === 0) this.isAttacking = false;
    });

    // Pointer lock events
    this.controls.onLock = () => {
      document.getElementById('click-to-play').style.display = 'none';
    };
    this.controls.onUnlock = () => {
      // Show click-to-play only if game is running and not in menu/dead
      if (!window.gameInstance?.isPaused && !this.isDead) {
        document.getElementById('click-to-play').style.display = 'flex';
      }
    };
  }

  // ──────────────────────────────────────────
  // UPDATE (called every frame)
  // ──────────────────────────────────────────
  update(dt, world) {
    if (this.isDead) {
      this.respawnTimer -= dt;
      if (this.respawnTimer <= 0) this.respawn();
      return;
    }

    this._updateStats(dt);
    this._updateMovement(dt, world);
    this._updateHeadBob(dt);
    this._updateAttack(dt);

    // Update mouse sensitivity
    this.controls.pointerSpeed = this.mouseSensitivity;
  }

  _updateStats(dt) {
    // Hunger decreases over time
    this.hungerTimer += dt;
    const hungerRate = this.isSprinting ? 1.2 : 0.5;
    if (this.hungerTimer > 1) {
      this.hunger = Math.max(0, this.hunger - hungerRate);
      this.hungerTimer = 0;

      // Starving damages health
      if (this.hunger <= 0) {
        this.takeDamage(2, 'famine');
      }
    }

    // Stamina
    this.staminaTimer += dt;
    if (this.staminaTimer > 0.05) {
      this.staminaTimer = 0;
      if (this.isSprinting && this._isMoving()) {
        this.stamina = Math.max(0, this.stamina - 0.8);
        if (this.stamina <= 0) this.isSprinting = false;
      } else if (!this.isSprinting && this.hunger > 0) {
        this.stamina = Math.min(this.maxStamina, this.stamina + 0.4);
      }
    }
  }

  _isMoving() {
    return this.keys['KeyW'] || this.keys['KeyS'] || this.keys['KeyA'] || this.keys['KeyD'];
  }

  _updateMovement(dt, world) {
    if (!this.controls.isLocked) return;

    this.isSprinting = this.keys['ShiftLeft'] && this._isMoving() && this.stamina > 0;
    const speed = this.speed * (this.isSprinting ? this.sprintMultiplier : 1.0);

    // Movement directions
    const forward = new THREE.Vector3();
    const right = new THREE.Vector3();
    this.camera.getWorldDirection(forward);
    forward.y = 0; forward.normalize();
    right.crossVectors(forward, new THREE.Vector3(0,1,0)).normalize();

    const move = new THREE.Vector3();
    if (this.keys['KeyW']) move.addScaledVector(forward, 1);
    if (this.keys['KeyS']) move.addScaledVector(forward, -1);
    if (this.keys['KeyA']) move.addScaledVector(right, -1);
    if (this.keys['KeyD']) move.addScaledVector(right, 1);

    if (move.lengthSq() > 0) move.normalize();

    // Smooth acceleration
    const targetVelX = move.x * speed;
    const targetVelZ = move.z * speed;
    const acc = this.acceleration * dt;
    const fric = this.friction * dt;

    if (move.lengthSq() > 0) {
      this.velocity.x += (targetVelX - this.velocity.x) * acc;
      this.velocity.z += (targetVelZ - this.velocity.z) * acc;
    } else {
      // Apply friction
      this.velocity.x *= Math.max(0, 1 - fric);
      this.velocity.z *= Math.max(0, 1 - fric);
    }

    // Gravity
    this.velocity.y += this.gravity * dt;

    // Jump
    if (this.keys['Space'] && this.onGround && this.stamina > 5) {
      this.velocity.y = this.jumpForce;
      this.stamina = Math.max(0, this.stamina - 8);
    }

    // Apply velocity
    this.position.addScaledVector(this.velocity, dt);

    // World bounds
    const worldRadius = 95;
    const dx = this.position.x, dz = this.position.z;
    if (Math.sqrt(dx*dx + dz*dz) > worldRadius) {
      const angle = Math.atan2(dz, dx);
      this.position.x = Math.cos(angle) * worldRadius;
      this.position.z = Math.sin(angle) * worldRadius;
      this.velocity.x *= 0.5;
      this.velocity.z *= 0.5;
    }

    // Ground collision
    let groundY = 0;
    if (world) {
      if (this.position.y < -100) {
        groundY = world.getCaveFloorAt(this.position.x, this.position.z);
      } else {
        groundY = world.getHeightAt(this.position.x, this.position.z);
      }
    }

    if (this.position.y <= groundY + this.height) {
      this.position.y = groundY + this.height;
      this.velocity.y = Math.max(0, this.velocity.y);
      this.onGround = true;
    } else {
      this.onGround = false;
    }

    // Camera follows position
    this.camera.position.set(
      this.position.x,
      this.position.y - this.height + this.eyeHeight,
      this.position.z
    );

    // Footstep sounds
    if (this.onGround && this._isMoving()) {
      const footRate = this.isSprinting ? 0.3 : 0.45;
      this.footstepTimer += dt;
      if (this.footstepTimer > footRate) {
        this.footstepTimer = 0;
        if (window.audio) window.audio.playFootstep();
      }
    } else {
      this.footstepTimer = 0;
    }
  }

  _updateHeadBob(dt) {
    if (!this.controls.isLocked) return;
    if (this.onGround && this._isMoving()) {
      const rate = this.isSprinting ? 14 : 9;
      this.bobTime += dt * rate;
      this.bobAmount = Math.min(1, this.bobAmount + dt * 5);
    } else {
      this.bobTime += dt * 3;
      this.bobAmount = Math.max(0, this.bobAmount - dt * 8);
    }
    const bob = Math.sin(this.bobTime) * 0.06 * this.bobAmount;
    const bobX = Math.sin(this.bobTime * 0.5) * 0.03 * this.bobAmount;
    this.camera.position.y += bob;
    this.camera.position.x += bobX;
  }

  _updateAttack(dt) {
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);

    if (this.isAttacking && this.attackCooldown <= 0) {
      this.attackCooldown = this.attackRate;
      this._doAttack();
      this.swingTimer = 1.0;
    }

    // Swing animation
    if (this.swingTimer > 0) {
      this.swingTimer -= dt * 6; // swing speed
      if (this.swingTimer < 0) this.swingTimer = 0;
      const t = Math.sin(this.swingTimer * Math.PI);
      this.toolGroup.rotation.x = -t * 1.2;
      this.toolGroup.rotation.y = t * 0.2;
      this.toolGroup.position.z = -0.6 - t * 0.3;
    } else {
      this.toolGroup.rotation.set(0, 0, 0);
      this.toolGroup.position.z = -0.6;
    }
    
    // Update tool visual geometry
    this._updateToolModel();
  }

  _updateToolModel() {
    const item = this.inventory.getSelectedItem();
    const type = item?.type || 'Fists';
    
    // Only rebuild if the equipped item type changed
    if (this._currentToolType === type) return;
    this._currentToolType = type;

    // Clear old model
    while(this.toolGroup.children.length > 0) {
      this.toolGroup.remove(this.toolGroup.children[0]);
    }

    // Base hand (Player skin)
    const handMat = new THREE.MeshStandardMaterial({ color: 0xd2b48c, roughness: 0.8 });
    const hand = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.4), handMat);
    
    // Position hand in bottom right of view
    // The toolGroup itself is moved during swing animations
    hand.position.set(0.3, -0.3, -0.2); 
    // Rotate arm slightly inward
    hand.rotation.y = -0.2;
    hand.rotation.x = 0.2;
    this.toolGroup.add(hand);

    if (type === 'Fists') return;

    // Material colors
    let headColor = 0x888888;
    const typeStr = String(type).toLowerCase();
    if (typeStr.includes('wood')) headColor = 0x8b4513;
    else if (typeStr.includes('stone') || typeStr.includes('rock')) headColor = 0x666666;
    else if (typeStr.includes('iron')) headColor = 0xaaaaaa;
    else if (typeStr.includes('steel')) headColor = 0xc0c0c0;
    else if (typeStr.includes('gold')) headColor = 0xffd700;

    const stickMat = new THREE.MeshStandardMaterial({ color: 0x5c4033 });
    const headMat = new THREE.MeshStandardMaterial({ color: headColor, roughness: 0.6, metalness: typeStr.includes('wood')?0:0.4 });

    const toolRoot = new THREE.Group();
    // Attach tool exactly to the hand's end
    toolRoot.position.set(0.3, -0.3, -0.4);
    toolRoot.rotation.copy(hand.rotation);

    if (typeStr.includes('pickaxe')) {
      const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.8), stickMat);
      handle.rotation.x = Math.PI / 2; handle.position.z = -0.2;
      toolRoot.add(handle);
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.08, 0.08), headMat);
      head.position.set(0, 0, -0.5);
      toolRoot.add(head);
    } else if (typeStr.includes('axe')) {
      const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.7), stickMat);
      handle.rotation.x = Math.PI / 2; handle.position.z = -0.15;
      toolRoot.add(handle);
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.25, 0.3), headMat);
      head.position.set(0.1, 0, -0.4);
      toolRoot.add(head);
    } else if (typeStr.includes('sword')) {
      const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.3), stickMat);
      handle.rotation.x = Math.PI / 2; handle.position.z = 0;
      toolRoot.add(handle);
      const guard = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.06, 0.06), headMat);
      guard.position.set(0, 0, -0.15);
      toolRoot.add(guard);
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.08, 0.8), headMat);
      blade.position.set(0, 0, -0.55);
      toolRoot.add(blade);
    } else {
      // Generic item box held in hand
      const itemBox = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), headMat);
      itemBox.position.z = -0.1;
      toolRoot.add(itemBox);
    }
    
    this.toolGroup.add(toolRoot);
  }

  _doAttack() {
    const item = this.inventory.getSelectedItem();
    const itemDef = item ? ITEM_DB[item.type] : ITEM_DB['Fists'];
    const damage = itemDef ? (itemDef.damage || 3) : 3;
    const range = itemDef?.range || this.attackRange;

    this.raycaster.setFromCamera({ x: 0, y: 0 }, this.camera);
    this.raycaster.far = range;

    if (this.onAttack) this.onAttack(damage, itemDef?.type || 'fist');

    // Visual feedback
    const crosshair = document.getElementById('crosshair');
    crosshair?.classList.add('attacking');
    setTimeout(() => crosshair?.classList.remove('attacking'), 150);
  }

  // ──────────────────────────────────────────
  // HEALTH / DAMAGE
  // ──────────────────────────────────────────
  takeDamage(amount, cause = 'enemy') {
    if (this.isDead) return;
    const reduced = Math.max(1, amount - this.armor);
    this.health = Math.max(0, this.health - reduced);

    // Red flash
    const flash = document.getElementById('damage-flash');
    if (flash) {
      flash.classList.add('flash');
      setTimeout(() => flash.classList.remove('flash'), 200);
    }

    if (window.audio) window.audio.playPlayerHurt();
    if (this.onDamage) this.onDamage(reduced);

    if (this.health <= 0) {
      this.die(cause);
    }
  }

  heal(amount) {
    this.health = Math.min(this.maxHealth, this.health + amount);
    if (this.onHeal) this.onHeal(amount);
  }

  restoreHunger(amount) { this.hunger  = Math.min(this.maxHunger,  this.hunger  + amount); }
  restoreStamina(amount){ this.stamina = Math.min(this.maxStamina, this.stamina + amount); }

  die(cause) {
    this.isDead = true;
    this.deathCause = cause;
    this.respawnTimer = 5;
    this.velocity.set(0,0,0);
    if (window.audio) window.audio.playDeath();
    if (this.onDeath) this.onDeath(cause);
    this.controls.unlock();
  }

  respawn() {
    this.isDead = false;
    this.health = this.maxHealth * 0.5;
    this.hunger = 60;
    this.stamina = 60;
    
    if (this.respawnPoint) {
      this.position.set(this.respawnPoint.x, this.respawnPoint.y, this.respawnPoint.z);
    } else {
      // Respawn at center
      this.position.set(
        (Math.random() - 0.5) * 10,
        5,
        (Math.random() - 0.5) * 10
      );
    }
    
    this.velocity.set(0, 0, 0);
    if (this.onRespawn) this.onRespawn();
  }

  // ──────────────────────────────────────────
  // CONSUMABLES
  // ──────────────────────────────────────────
  useSelectedItem() {
    const slot = this.inventory.slots[this.inventory.selectedSlot];
    if (!slot) return;
    const def = ITEM_DB[slot.type];
    if (!def || def.type !== 'consumable') return;

    if (def.health)  this.heal(def.health);
    if (def.hunger)  this.restoreHunger(def.hunger);
    if (def.stamina) this.restoreStamina(def.stamina);

    slot.count--;
    if (slot.count <= 0) this.inventory.slots[this.inventory.selectedSlot] = null;

    if (window.audio) window.audio.playCraftSuccess();
    if (window.ui) window.ui.showPickup(`${def.icon} ${slot.type} consommé`);
  }

  // ──────────────────────────────────────────
  // SERIALIZATION
  // ──────────────────────────────────────────
  getNetworkState() {
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    return {
      id: this.id,
      name: this.name,
      position: { x: this.position.x, y: this.position.y, z: this.position.z },
      rotation: { x: this.camera.rotation.x, y: this.camera.rotation.y },
      health: this.health,
      isDead: this.isDead,
    };
  }

  serialize() {
    return {
      position: { x: this.position.x, y: this.position.y, z: this.position.z },
      health: this.health,
      hunger: this.hunger,
      stamina: this.stamina,
      inventory: this.inventory.serialize(),
    };
  }

  deserialize(data) {
    if (!data) return;
    if (data.position) {
      this.position.set(data.position.x, data.position.y, data.position.z);
      this.camera.position.set(
        data.position.x,
        data.position.y - this.height + this.eyeHeight,
        data.position.z
      );
    }
    if (data.health  !== undefined) this.health  = data.health;
    if (data.hunger  !== undefined) this.hunger  = data.hunger;
    if (data.stamina !== undefined) this.stamina = data.stamina;
    if (data.inventory) this.inventory.deserialize(data.inventory);
  }
}

// Expose globally
window.Player = Player;
window.Inventory = Inventory;
window.ITEM_DB = ITEM_DB;
window.PointerLockControls = PointerLockControls;
