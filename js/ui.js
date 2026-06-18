/**
 * ui.js — VeilCraft UI Manager
 *
 * Manages all DOM-based UI elements:
 * HUD bars, hotbar, inventory panel, crafting, wave announcements,
 * death screen, pause, chat, player list, tooltips, notifications.
 */

class UI {
  constructor() {
    this.inventoryOpen = false;
    this.isPaused = false;
    this.chatOpen = false;
    this.tabOpen = false;
    this.settingsOpen = false;

    // Cache DOM elements
    this.els = {
      healthBar:     document.getElementById('health-bar'),
      healthVal:     document.getElementById('health-val'),
      hungerBar:     document.getElementById('hunger-bar'),
      hungerVal:     document.getElementById('hunger-val'),
      staminaBar:    document.getElementById('stamina-bar'),
      staminaVal:    document.getElementById('stamina-val'),
      dayIcon:       document.getElementById('day-icon'),
      dayLabel:      document.getElementById('day-label'),
      timeLabel:     document.getElementById('time-label'),
      hotbar:        document.getElementById('hotbar'),
      hotbarSlots:   [],
      inventoryPanel:document.getElementById('inventory-panel'),
      inventoryGrid: document.getElementById('inventory-grid'),
      equipSlots:    Array.from(document.querySelectorAll('#equip-section .equip-slot')),
      recipeList:    document.getElementById('recipe-list'),
      craftTitle:    document.getElementById('craft-title'),
      craftWsLabel:  document.getElementById('craft-workstation-label'),
      waveAnnounce:  document.getElementById('wave-announce'),
      waveTitle:     document.getElementById('wave-title'),
      waveSub:       document.getElementById('wave-sub'),
      damageFlash:   document.getElementById('damage-flash'),
      deathScreen:   document.getElementById('death-screen'),
      deathCause:    document.getElementById('death-cause'),
      respawnTimer:  document.getElementById('respawn-timer'),
      pauseMenu:     document.getElementById('pause-menu'),
      pickupNotifs:  document.getElementById('pickup-notifs'),
      chatPanel:     document.getElementById('chat-panel'),
      chatMessages:  document.getElementById('chat-messages'),
      chatInput:     document.getElementById('chat-input'),
      playerTab:     document.getElementById('player-tab'),
      playerTabList: document.getElementById('player-tab-list'),
      interactPrompt:document.getElementById('interact-prompt'),
      interactText:  document.getElementById('interact-text'),
      tooltip:       document.getElementById('item-tooltip'),
      tooltipName:   document.getElementById('tooltip-name'),
      tooltipDesc:   document.getElementById('tooltip-desc'),
      tooltipStats:  document.getElementById('tooltip-stats'),
      settingsModal: document.getElementById('settings-modal'),
      connLabel:     document.getElementById('conn-label'),
      connDot:       document.getElementById('conn-dot'),
      connPing:      document.getElementById('conn-ping'),
      crosshair:     document.getElementById('crosshair'),
      clickToPlay:   document.getElementById('click-to-play'),
    };

    // References set by main.js
    this.player = null;
    this.crafting = null;
    this.inventory = null;

    // Notify move state
    this._pendingPickups = [];
    this._pickupTimer = 0;

    // Selected item in inventory for moving
    this._selectedInvSlot = -1;

    this._buildHotbar();
    this._buildInventoryGrid();
    this._setupChatInput();
    this._setupSettings();
    this._setupClickToPlay();
    this._setupTooltip();
  }

  // ──────────────────────────────────────────
  // HOTBAR SETUP
  // ──────────────────────────────────────────
  _buildHotbar() {
    this.els.hotbar.innerHTML = '';
    this.els.hotbarSlots = [];
    for (let i = 0; i < 10; i++) {
      const slot = document.createElement('div');
      slot.className = 'hotbar-slot';
      slot.innerHTML = `<span class="slot-num">${i === 9 ? 0 : i+1}</span>`;
      slot.addEventListener('click', () => {
        if (this.player) this.player.inventory.selectSlot(i);
        this.updateHotbar();
      });
      this.els.hotbar.appendChild(slot);
      this.els.hotbarSlots.push(slot);
    }
  }

  // ──────────────────────────────────────────
  // INVENTORY GRID SETUP
  // ──────────────────────────────────────────
  _buildInventoryGrid() {
    this.els.inventoryGrid.innerHTML = '';
    for (let i = 0; i < 30; i++) {
      const slot = document.createElement('div');
      slot.className = 'inv-slot' + (i < 10 ? ' hotbar-marker' : '');
      slot.dataset.index = i;

      slot.addEventListener('click', () => this._onInvSlotClick(i));
      slot.addEventListener('mouseenter', (e) => this._showTooltip(e, i));
      slot.addEventListener('mouseleave', () => this._hideTooltip());

      this.els.inventoryGrid.appendChild(slot);
    }

    // Equipment slots (armor / off-hand): click while an inventory item is
    // selected to equip it; click an occupied slot with nothing selected to
    // take the equipped item back.
    for (const el of (this.els.equipSlots || [])) {
      el.addEventListener('click', () => this._onEquipSlotClick(el.dataset.equip));
      el.addEventListener('mouseenter', (e) => this._showEquipTooltip(e, el.dataset.equip));
      el.addEventListener('mouseleave', () => this._hideTooltip());
    }
  }

  _onEquipSlotClick(slotName) {
    if (!this.player || !slotName) return;
    const inv = this.player.inventory;
    let changed = false;
    if (this._selectedInvSlot !== -1) {
      // Try to equip the currently-selected inventory item.
      changed = inv.equipTo(slotName, this._selectedInvSlot);
      this._selectedInvSlot = -1;
    } else if (inv.equipment[slotName]) {
      // Nothing selected → unequip back into the bag.
      changed = inv.unequip(slotName);
    }
    if (changed) {
      this.player.recomputeArmor?.();
      this.player.updateHeldItem?.();
      this.updateHotbar();
      this.updateHUD?.(this.player);
    }
    this.updateInventoryGrid();
  }

  _showEquipTooltip(e, slotName) {
    if (!this.player) return;
    const it = this.player.inventory.equipment?.[slotName];
    if (it) this._showTooltip(e, null, it.type);
  }

  _onInvSlotClick(index) {
    if (!this.player) return;
    const inv = this.player.inventory;

    if (this._selectedInvSlot === -1) {
      // Select
      if (inv.slots[index]) {
        this._selectedInvSlot = index;
        this.updateInventoryGrid();
      }
    } else {
      // Move / swap
      if (this._selectedInvSlot !== index) {
        const temp = inv.slots[this._selectedInvSlot];
        inv.slots[this._selectedInvSlot] = inv.slots[index];
        inv.slots[index] = temp;
      }
      this._selectedInvSlot = -1;
      this.updateInventoryGrid();
      this.updateHotbar();
    }
  }

  _showTooltip(e, invIndex) {
    if (!this.player) return;
    const item = this.player.inventory.slots[invIndex];
    if (!item) return;
    const def = window.ITEM_DB?.[item.type];
    if (!def) return;

    const RARITY = {
      common:   { label: 'Commun',     color: '#c8c8d0' },
      uncommon: { label: 'Peu commun', color: '#5fd35f' },
      rare:     { label: 'Rare',       color: '#5aa9ff' },
      epic:     { label: 'Épique',     color: '#c264ff' },
    };
    const rar = RARITY[def.rarity] || RARITY.common;
    const iconUrl = window.VCIcons ? window.VCIcons.url(def.iconKey || item.type) : null;
    const iconHtml = iconUrl
      ? `<img class="tooltip-icon" src="${iconUrl}" alt="">`
      : `<span class="tooltip-icon-emoji">${def.icon || '📦'}</span>`;
    this.els.tooltipName.innerHTML = `${iconHtml}<span style="color:${rar.color}">${def.name || item.type}</span>`;
    this.els.tooltipDesc.innerHTML = `<span class="tooltip-rarity" style="color:${rar.color}">${rar.label}${def.tier ? ' · Tier ' + def.tier : ''}</span><br>${def.desc || ''}`;

    const TYPE_LABEL = { material:'Matériau', consumable:'Consommable', tool:'Outil', armor:'Armure', ammo:'Munition', structure:'Structure' };
    const row = (k, v) => `<div class="tooltip-stat-row"><span class="tooltip-stat-key">${k}</span><span class="tooltip-stat-val">${v}</span></div>`;
    let statsHtml = '';
    if (def.type)       statsHtml += row('Type', TYPE_LABEL[def.type] || def.type);
    if (def.damage)     statsHtml += row('⚔ Dégâts', def.damage);
    if (def.armor)      statsHtml += row('🛡 Armure', def.armor);
    if (def.range)      statsHtml += row('🎯 Portée', def.range);
    if (def.durability) statsHtml += row('🔧 Durabilité', def.durability);
    if (def.health)     statsHtml += row('❤ Santé', '+' + def.health);
    if (def.hunger)     statsHtml += row('🍗 Faim', '+' + def.hunger);
    if (def.stamina)    statsHtml += row('⚡ Endurance', '+' + def.stamina);
    if (def.value)      statsHtml += row('💰 Valeur', def.value);
    if (def.stack && def.stack > 1) statsHtml += row('📦 Pile max', def.stack);
    if (item.count > 1) statsHtml += row('Quantité', item.count);

    this.els.tooltipStats.innerHTML = statsHtml;
    this.els.tooltip.style.display = 'block';
  }

  _hideTooltip() {
    this.els.tooltip.style.display = 'none';
  }

  _setupTooltip() {
    document.addEventListener('mousemove', e => {
      if (this.els.tooltip.style.display === 'none') return;
      this.els.tooltip.style.left = (e.clientX + 16) + 'px';
      this.els.tooltip.style.top  = (e.clientY - 8) + 'px';
    });
  }

  // ──────────────────────────────────────────
  // CHAT
  // ──────────────────────────────────────────
  _setupChatInput() {
    document.addEventListener('keydown', e => {
      if (e.code === 'KeyT' && !this.chatOpen && !this.inventoryOpen && !this.isPaused) {
        this.openChat();
        e.preventDefault();
      }
      if (e.code === 'Tab') {
        e.preventDefault();
        if (!this.chatOpen) {
          this.tabOpen = !this.tabOpen;
          this.els.playerTab.style.display = this.tabOpen ? 'flex' : 'none';
        }
      }
    });

    if (this.els.chatInput) {
      this.els.chatInput.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
          const msg = this.els.chatInput.value.trim();
          if (msg && this.onChatSend) this.onChatSend(msg);
          this.els.chatInput.value = '';
          this.closeChat();
          e.preventDefault();
        }
        if (e.key === 'Escape') this.closeChat();
        e.stopPropagation();
      });
    }

    const sendBtn = document.getElementById('chat-send');
    if (sendBtn) {
      sendBtn.addEventListener('click', () => {
        const msg = this.els.chatInput?.value.trim();
        if (msg && this.onChatSend) this.onChatSend(msg);
        if (this.els.chatInput) this.els.chatInput.value = '';
        this.closeChat();
      });
    }
  }

  openChat() {
    this.chatOpen = true;
    this.els.chatPanel.style.display = 'block';
    setTimeout(() => this.els.chatInput?.focus(), 50);
    // Release pointer lock
    if (window.gameInstance?.player?.controls?.isLocked) {
      window.gameInstance.player.controls.unlock();
    }
  }

  closeChat() {
    this.chatOpen = false;
    this.els.chatPanel.style.display = 'none';
  }

  addChatMessage(name, msg, color = '#a78bfa') {
    if (!this.els.chatMessages) return;
    const div = document.createElement('div');
    div.className = 'chat-msg';
    div.innerHTML = `<span class="chat-name" style="color:${color}">${name}</span>: ${this._escapeHtml(msg)}`;
    this.els.chatMessages.appendChild(div);
    this.els.chatMessages.scrollTop = this.els.chatMessages.scrollHeight;

    // Auto-show chat briefly
    this.els.chatPanel.style.display = 'block';
    clearTimeout(this._chatHideTimer);
    if (!this.chatOpen) {
      this._chatHideTimer = setTimeout(() => {
        if (!this.chatOpen) this.els.chatPanel.style.display = 'none';
      }, 4000);
    }
  }

  _escapeHtml(str) {
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  // ──────────────────────────────────────────
  // SETTINGS
  // ──────────────────────────────────────────
  _setupSettings() {
    const volSlider = document.getElementById('vol-master');
    const muteBtn = document.getElementById('mute-btn');
    const sensSlider = document.getElementById('mouse-sens');

    if (volSlider) {
      volSlider.addEventListener('input', () => {
        if (window.audio) window.audio.setVolume(volSlider.value / 100);
      });
    }

    if (muteBtn) {
      muteBtn.addEventListener('click', () => {
        if (window.audio) {
          const muted = window.audio.toggleMute();
          muteBtn.textContent = muted ? '🔇 Son désactivé' : '🔊 Son activé';
        }
      });
    }

    if (sensSlider) {
      sensSlider.addEventListener('input', () => {
        if (window.gameInstance?.player) {
          window.gameInstance.player.mouseSensitivity = parseInt(sensSlider.value);
        }
      });
    }

    // M key = mute
    document.addEventListener('keydown', e => {
      if (e.code === 'KeyM' && !this.chatOpen) {
        if (window.audio) {
          const muted = window.audio.toggleMute();
          if (muteBtn) muteBtn.textContent = muted ? '🔇 Son désactivé' : '🔊 Son activé';
          this.showPickup(muted ? '🔇 Son désactivé' : '🔊 Son activé');
        }
      }
    });
  }

  // ──────────────────────────────────────────
  // CLICK TO PLAY
  // ──────────────────────────────────────────
  _setupClickToPlay() {
    const ctp = this.els.clickToPlay;
    if (ctp) {
      ctp.addEventListener('click', () => {
        if (window.audio) window.audio.init();
        if (window.gameInstance?.player?.controls) {
          window.gameInstance.player.controls.lock();
        }
      });
    }
  }

  // ──────────────────────────────────────────
  // UPDATE METHODS (called every frame or on change)
  // ──────────────────────────────────────────
  updateHUD(player) {
    if (!player) return;

    const hp  = Math.round(player.health);
    const hun = Math.round(player.hunger);
    const sta = Math.round(player.stamina);

    if (this.els.healthBar)  this.els.healthBar.style.width  = hp  + '%';
    if (this.els.hungerBar)  this.els.hungerBar.style.width  = hun + '%';
    if (this.els.staminaBar) this.els.staminaBar.style.width = sta + '%';
    if (this.els.healthVal)  this.els.healthVal.textContent  = hp;
    if (this.els.hungerVal)  this.els.hungerVal.textContent  = hun;
    if (this.els.staminaVal) this.els.staminaVal.textContent = sta;
  }

  updateDayNight(dayNumber, isNight, timeOfDay) {
    // timeOfDay: 0.0 = sunrise, 0.5 = noon, 1.0 = sunset/midnight
    const phases = ['Aube', 'Matin', 'Midi', 'Après-midi', 'Crépuscule', 'Nuit'];
    let phaseIdx = 0;

    if (isNight) {
      phaseIdx = 5;
    } else {
      phaseIdx = Math.min(4, Math.floor(timeOfDay * 5));
    }

    if (this.els.dayLabel)  this.els.dayLabel.textContent = `Jour ${dayNumber}`;
    if (this.els.timeLabel) this.els.timeLabel.textContent = phases[phaseIdx];
    if (this.els.dayIcon)   this.els.dayIcon.textContent = isNight ? '🌙' : '☀️';
  }

  updateHotbar(player) {
    if (!player) player = this.player;
    if (!player) return;

    const hotbar = player.inventory.getHotbar();
    const selected = player.inventory.selectedSlot;

    for (let i = 0; i < 10; i++) {
      const slot = this.els.hotbarSlots[i];
      if (!slot) continue;

      const item = hotbar[i];
      const def = item ? window.ITEM_DB?.[item.type] : null;

      slot.innerHTML = `<span class="slot-num">${i === 9 ? 0 : i+1}</span>`;

      if (item) {
        const iconSpan = document.createElement('span');
        iconSpan.className = 'slot-icon';
        if (window.VCIcons) window.VCIcons.into(iconSpan, def?.iconKey || item.type, def?.icon || '📦', 'vc-icon');
        else iconSpan.textContent = def?.icon || '📦';
        slot.appendChild(iconSpan);
        if (def?.rarity) slot.dataset.rarity = def.rarity; else delete slot.dataset.rarity;

        if (item.count > 1) {
          const cnt = document.createElement('span');
          cnt.className = 'slot-count';
          cnt.textContent = item.count;
          slot.appendChild(cnt);
        }
      } else {
        delete slot.dataset.rarity;
      }

      slot.classList.toggle('selected', i === selected);
    }
  }

  updateInventoryGrid(player) {
    if (!player) player = this.player;
    if (!player) return;

    const slots = this.els.inventoryGrid.children;
    for (let i = 0; i < 30; i++) {
      const slotEl = slots[i];
      if (!slotEl) continue;

      const item = player.inventory.slots[i];
      const def = item ? window.ITEM_DB?.[item.type] : null;

      slotEl.innerHTML = '';
      slotEl.classList.toggle('selected-for-move', i === this._selectedInvSlot);

      if (item) {
        const iconSpan = document.createElement('span');
        iconSpan.className = 'slot-icon';
        if (window.VCIcons) window.VCIcons.into(iconSpan, def?.iconKey || item.type, def?.icon || '📦', 'vc-icon');
        else iconSpan.textContent = def?.icon || '📦';
        slotEl.appendChild(iconSpan);
        if (def?.rarity) slotEl.dataset.rarity = def.rarity; else delete slotEl.dataset.rarity;

        const lbl = document.createElement('span');
        lbl.className = 'slot-label';
        lbl.textContent = def?.name || item.type;
        slotEl.appendChild(lbl);

        if (item.count > 1) {
          const cnt = document.createElement('span');
          cnt.className = 'slot-count';
          cnt.textContent = item.count;
          slotEl.appendChild(cnt);
        }
      }
    }
  }

  // ──────────────────────────────────────────
  // INVENTORY PANEL
  // ──────────────────────────────────────────
  openInventory(player, crafting, workstationType = null) {
    this.inventoryOpen = true;
    this.player = player;
    this.crafting = crafting;
    this.els.inventoryPanel.style.display = 'flex';

    // Release pointer lock when opening inventory
    if (window.gameInstance?.player?.controls?.isLocked) {
      window.gameInstance.player.controls.unlock();
    }

    this.updateInventoryGrid(player);
    this.updateCraftingPanel(player, crafting, workstationType);
    this._selectedInvSlot = -1;
  }

  closeInventory() {
    this.inventoryOpen = false;
    this.els.inventoryPanel.style.display = 'none';
    this._hideTooltip();
    this._selectedInvSlot = -1;

    // Re-request pointer lock after brief delay
    setTimeout(() => {
      if (!this.isPaused && !this.chatOpen) {
        if (window.gameInstance?.player?.controls) {
          window.gameInstance.player.controls.lock();
        }
      }
    }, 100);
  }

  updateCraftingPanel(player, crafting, workstationType = null) {
    if (!crafting) return;

    const nameOf = (id) => (window.ITEM_DB?.[id]?.name) || id;
    const iconOf = (id) => (window.ITEM_DB?.[id]?.icon) || '📦';

    const wsName = workstationType ? nameOf(workstationType) : null;
    const title = wsName ? ('🔨 ' + wsName) : '🔨 Forge de base';
    if (this.els.craftTitle) this.els.craftTitle.textContent = title;
    if (this.els.craftWsLabel) {
      this.els.craftWsLabel.textContent = wsName
        ? ('Utilisation : ' + wsName)
        : 'Forge de base — approchez un etabli pour debloquer plus de recettes';
    }

    // Base recipes (no workstation) are always available; a nearby workstation
    // unlocks its own recipes on top.
    let recipes = crafting.getRecipesForWorkstation(null);
    if (workstationType) recipes = recipes.concat(crafting.getRecipesForWorkstation(workstationType));

    if (!this.els.recipeList) return;
    this.els.recipeList.innerHTML = '';
    if (recipes.length === 0) {
      this.els.recipeList.innerHTML = '<div style="color:var(--text-dim);font-size:0.8rem;text-align:center;padding:1rem;">Aucune recette disponible</div>';
      return;
    }

    for (const r of recipes) {
      const canCraft = crafting.canCraft(r, player.inventory);
      const card = document.createElement('div');
      card.className = 'recipe-card' + (canCraft ? ' can-craft' : ' cannot-craft');
      const icon = r.icon || iconOf(r.result.type);

      const ingredientsHtml = r.ingredients.map(ing => {
        const have = crafting.countItem(player.inventory, ing.type);
        const enough = have >= ing.count;
        return '<div class="recipe-ingredient ' + (enough ? 'has-enough' : 'not-enough') + '">'
          + iconOf(ing.type) + ' ' + nameOf(ing.type) + ': ' + have + '/' + ing.count + '</div>';
      }).join('');

      card.innerHTML = ''
        + '<div class="recipe-name">' + icon + ' ' + r.name + '</div>'
        + '<div class="recipe-ingredients">' + ingredientsHtml + '</div>'
        + '<div class="recipe-result">→ ' + icon + ' ' + nameOf(r.result.type) + ' × ' + r.result.count + '</div>'
        + '<button class="recipe-craft-btn" ' + (canCraft ? '' : 'disabled') + ' data-recipe-id="' + r.id + '">'
        + (canCraft ? '✓ Fabriquer' : '✗ Ressources manquantes')
        + '</button>';

      const btn = card.querySelector('.recipe-craft-btn');
      if (btn && canCraft) {
        btn.addEventListener('click', () => {
          const result = crafting.craft(r.id, player.inventory, workstationType);
          if (result && result.success) {
            if (result.item) this.showPickup(icon + ' ' + nameOf(result.item.type) + ' × ' + result.item.count);
            this.updateInventoryGrid(player);
            this.updateCraftingPanel(player, crafting, workstationType);
            this.updateHotbar(player);
          } else {
            this.showPickup('❌ ' + ((result && result.message) || 'Echec'));
          }
        });
      }
      this.els.recipeList.appendChild(card);
    }
  }

  // ──────────────────────────────────────────
  // WAVE ANNOUNCEMENT
  // ──────────────────────────────────────────
  showWaveAnnounce(dayNumber, waveInfo) {
    if (this.els.waveAnnounce) {
      this.els.waveTitle.textContent = '☠ VAGUE NOCTURNE';
      this.els.waveSub.textContent = `Jour ${dayNumber} — Préparez-vous!`;
      this.els.waveAnnounce.style.display = 'block';
      clearTimeout(this._waveHideTimer);
      this._waveHideTimer = setTimeout(() => {
        if (this.els.waveAnnounce) this.els.waveAnnounce.style.display = 'none';
      }, 4000);
    }
  }

  showDayAnnounce(dayNumber) {
    if (this.els.waveAnnounce) {
      this.els.waveTitle.textContent = '☀ NOUVEAU JOUR';
      this.els.waveTitle.style.color = '#fbbf24';
      this.els.waveSub.textContent = `Jour ${dayNumber} — L'aube se lève`;
      this.els.waveAnnounce.style.display = 'block';
      clearTimeout(this._waveHideTimer);
      this._waveHideTimer = setTimeout(() => {
        if (this.els.waveAnnounce) this.els.waveAnnounce.style.display = 'none';
        if (this.els.waveTitle) this.els.waveTitle.style.color = '';
      }, 3000);
    }
  }

  // ──────────────────────────────────────────
  // DEATH SCREEN
  // ──────────────────────────────────────────
  showDeathScreen(cause) {
    const causeLabels = {
      enemy: 'Tué par un ennemi',
      famine: 'Mort de faim',
      environment: 'Mort par l\'environnement',
    };
    if (this.els.deathScreen) {
      this.els.deathScreen.style.display = 'flex';
      if (this.els.deathCause) this.els.deathCause.textContent = causeLabels[cause] || 'Cause inconnue';
    }
  }

  hideDeathScreen() {
    if (this.els.deathScreen) this.els.deathScreen.style.display = 'none';
  }

  updateDeathCountdown(seconds) {
    if (this.els.respawnTimer) {
      this.els.respawnTimer.textContent = Math.ceil(seconds);
    }
  }

  // ──────────────────────────────────────────
  // PAUSE MENU
  // ──────────────────────────────────────────
  showPause() {
    this.isPaused = true;
    if (this.els.pauseMenu) this.els.pauseMenu.style.display = 'flex';
  }

  hidePause() {
    this.isPaused = false;
    if (this.els.pauseMenu) this.els.pauseMenu.style.display = 'none';
  }

  // ──────────────────────────────────────────
  // PICKUP NOTIFICATION
  // ──────────────────────────────────────────
  showPickup(text) {
    const notif = document.createElement('div');
    notif.className = 'pickup-notif';
    notif.textContent = `+ ${text}`;
    if (this.els.pickupNotifs) {
      this.els.pickupNotifs.appendChild(notif);
      setTimeout(() => notif.remove(), 2000);
    }
  }

  // ──────────────────────────────────────────
  // DAMAGE FLASH (red screen pulse when hurt)
  // ──────────────────────────────────────────
  showDamageFlash() {
    const el = this.els && this.els.damageFlash;
    if (!el) return;
    el.style.opacity = '1';
    clearTimeout(this._damageFlashTimer);
    this._damageFlashTimer = setTimeout(() => { el.style.opacity = '0'; }, 130);
  }

  // ──────────────────────────────────────────
  // DAMAGE NUMBERS
  // ──────────────────────────────────────────
  showStarving(active, hungerFrac = 1) {
    let el = document.getElementById('starving-warning');
    if (active) {
      if (!el) {
        el = document.createElement('div');
        el.id = 'starving-warning';
        el.textContent = '🍗 Affamé ! Mangez quelque chose';
        document.body.appendChild(el);
      }
      el.style.display = 'block';
    } else if (el) {
      el.style.display = 'none';
    }
  }

  showDamageNumber(amount, isHeal = false, cause = null) {
    const div = document.createElement('div');
    div.className = 'damage-number' + (isHeal ? ' heal' : '');
    const CAUSE_LABEL = { Famine: '🍗', Goblin: '⚔', Orc: '⚔', DarkKnight: '⚔', Chute: '🪂' };
    const tag = cause && CAUSE_LABEL[cause] ? ' ' + CAUSE_LABEL[cause] : '';
    div.textContent = (isHeal ? '+' : '-') + amount + tag;
    // Position near center of screen
    div.style.left = (window.innerWidth/2 + (Math.random()-0.5)*80) + 'px';
    div.style.top  = (window.innerHeight/2 + (Math.random()-0.5)*40) + 'px';
    document.body.appendChild(div);
    setTimeout(() => div.remove(), 1000);
  }

  // ──────────────────────────────────────────
  // INTERACT PROMPT
  // ──────────────────────────────────────────
  showInteractPrompt(text) {
    if (this.els.interactPrompt) {
      this.els.interactPrompt.style.display = 'block';
      if (this.els.interactText) this.els.interactText.textContent = text;
    }
  }

  hideInteractPrompt() {
    if (this.els.interactPrompt) this.els.interactPrompt.style.display = 'none';
  }

  // ──────────────────────────────────────────
  // PLAYER LIST
  // ──────────────────────────────────────────
  updatePlayerList(players) {
    if (!this.els.playerTabList) return;
    this.els.playerTabList.innerHTML = '';
    for (const p of players) {
      const row = document.createElement('div');
      row.className = 'tab-player';
      row.innerHTML = `
        <div class="tab-player-dot" style="background:${p.color||'#22c55e'}"></div>
        <div class="tab-player-name">${this._escapeHtml(p.name)}</div>
        <div class="tab-player-ping">${p.ping !== undefined ? p.ping + 'ms' : '—'}</div>
      `;
      this.els.playerTabList.appendChild(row);
    }
  }

  // ──────────────────────────────────────────
  // CONNECTION STATUS
  // ──────────────────────────────────────────
  setConnectionStatus(status, label, ping = null) {
    // status: 'online' | 'offline' | 'connecting'
    if (this.els.connDot) {
      this.els.connDot.className = 'conn-dot ' + (status === 'online' ? '' : status);
    }
    if (this.els.connLabel) this.els.connLabel.textContent = label;
    if (this.els.connPing && ping !== null) {
      this.els.connPing.style.display = 'inline';
      this.els.connPing.textContent = `${ping}ms`;
    }
  }

  // ──────────────────────────────────────────
  // LOADING SCREEN
  // ──────────────────────────────────────────
  setLoadingProgress(pct, message) {
    const bar = document.getElementById('loading-bar');
    const sub = document.getElementById('loading-sub');
    if (bar) bar.style.width = pct + '%';
    if (sub && message) sub.textContent = message;
  }

  hideLoadingScreen() {
    const ls = document.getElementById('loading-screen');
    if (ls) {
      ls.classList.add('fade-out');
      setTimeout(() => { ls.style.display = 'none'; }, 800);
    }
  }

  showClickToPlay() {
    if (this.els.clickToPlay) this.els.clickToPlay.style.display = 'flex';
  }
}

// Expose globally
window.UI = UI;
