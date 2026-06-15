/**
 * save.js — VeilCraft Save/Load System
 *
 * Saves world state, player data, and game progress to localStorage.
 * Supports 3 save slots and auto-save every 30 seconds.
 */

const SAVE_KEY_PREFIX = 'veilcraft_save_';
const DEFAULT_SLOT = 1;
const AUTO_SAVE_INTERVAL = 30;

class SaveSystem {
  constructor() {
    this.currentSlot = DEFAULT_SLOT;
    this.autoSaveTimer = 0;
    this.enabled = true;
    this.world = null;
    this.player = null;
    this.waveManager = null;
    this.dayNumber = 1;
  }

  _key(slot = this.currentSlot) {
    return SAVE_KEY_PREFIX + slot;
  }

  hasSave(slot = this.currentSlot) {
    try { return !!localStorage.getItem(this._key(slot)); } catch(e) { return false; }
  }

  getSaveMeta(slot = this.currentSlot) {
    try {
      const raw = localStorage.getItem(this._key(slot));
      if (!raw) return null;
      const data = JSON.parse(raw);
      return {
        slot,
        date: data.savedAt ? new Date(data.savedAt).toLocaleString('fr-FR') : 'Inconnu',
        dayNumber: data.dayNumber || 1,
        playerName: data.playerName || 'Aventurier',
        seed: data.seed,
      };
    } catch(e) { return null; }
  }

  getAllSlotMeta() {
    return [1, 2, 3].map(s => this.getSaveMeta(s));
  }

  save(slot = this.currentSlot) {
    if (!this.enabled) return false;
    try {
      const data = {
        savedAt: Date.now(),
        version: '0.1',
        seed: this.world?.seed || 0,
        dayNumber: this.dayNumber,
        playerName: this.player?.name || 'Aventurier',
        world: this.world?.serialize() || null,
        player: this.player?.serialize() || null,
        wave: this.waveManager?.serialize() || null,
      };
      localStorage.setItem(this._key(slot), JSON.stringify(data));
      console.log('[Save] Saved to slot', slot);
      return true;
    } catch(e) {
      console.error('[Save] Failed to save:', e);
      return false;
    }
  }

  load(slot = this.currentSlot) {
    try {
      const raw = localStorage.getItem(this._key(slot));
      if (!raw) return null;
      const data = JSON.parse(raw);
      console.log('[Save] Loaded from slot', slot);
      return data;
    } catch(e) {
      console.error('[Save] Failed to load:', e);
      return null;
    }
  }

  deleteSave(slot = this.currentSlot) {
    try { localStorage.removeItem(this._key(slot)); } catch(e) {}
  }

  applyToGame(data) {
    if (!data) return false;
    try {
      if (data.world  && this.world)  this.world.deserialize(data.world);
      if (data.player && this.player) this.player.deserialize(data.player);
      if (data.dayNumber !== undefined) this.dayNumber = data.dayNumber;
      return true;
    } catch(e) {
      console.error('[Save] Failed to apply:', e);
      return false;
    }
  }

  exportAsJSON(slot = this.currentSlot) {
    return localStorage.getItem(this._key(slot)) || null;
  }

  importFromJSON(jsonStr, slot = this.currentSlot) {
    try {
      JSON.parse(jsonStr);
      localStorage.setItem(this._key(slot), jsonStr);
      return true;
    } catch(e) { return false; }
  }

  update(dt) {
    if (!this.enabled) return;
    this.autoSaveTimer += dt;
    if (this.autoSaveTimer >= AUTO_SAVE_INTERVAL) {
      this.autoSaveTimer = 0;
      this.save();
    }
  }
}

window.SaveSystem = SaveSystem;
