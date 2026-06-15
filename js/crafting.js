// crafting.js — Système de craft et recettes
// Gère toutes les recettes, les établis et la logique d'artisanat
// @authors Eric Villeneuve & Alex Musial — ICS3U 2026

'use strict';

// Définition de toutes les recettes du jeu
// workstation: null=basique, 'workbench', 'furnace', 'anvil', 'cauldron', 'fletching_table'
const RECIPES = [
  // === CRAFT DE BASE (pas d'établi requis) ===
  {
    id: 'campfire',
    name: 'Feu de camp',
    icon: '🔥',
    workstation: null,
    ingredients: [{ type: 'wood', count: 5 }],
    result: { type: 'campfire', count: 1 },
    description: 'Éclaire la nuit et garde chaud'
  },
  {
    id: 'workbench',
    name: 'Établi',
    icon: '🪵',
    workstation: null,
    ingredients: [{ type: 'wood', count: 10 }],
    result: { type: 'workbench', count: 1 },
    description: 'Permet de crafter des outils avancés'
  },

  // === ÉTABLI ===
  {
    id: 'wooden_axe',
    name: 'Hache en bois',
    icon: '🪓',
    workstation: 'workbench',
    ingredients: [{ type: 'wood', count: 5 }],
    result: { type: 'wooden_axe', count: 1 },
    toolStats: { damage: 5, toolType: 'axe', durability: 50 },
    description: 'Pour abattre les arbres efficacement'
  },
  {
    id: 'wooden_pickaxe',
    name: 'Pioche en bois',
    icon: '⛏️',
    workstation: 'workbench',
    ingredients: [{ type: 'wood', count: 5 }],
    result: { type: 'wooden_pickaxe', count: 1 },
    toolStats: { damage: 5, toolType: 'pickaxe', durability: 50 },
    description: 'Pour miner la pierre'
  },
  {
    id: 'wooden_sword',
    name: 'Épée en bois',
    icon: '🗡️',
    workstation: 'workbench',
    ingredients: [{ type: 'wood', count: 6 }],
    result: { type: 'wooden_sword', count: 1 },
    toolStats: { damage: 8, toolType: 'sword', durability: 40 },
    description: 'Arme de base pour les ennemis'
  },
  {
    id: 'wooden_shield',
    name: 'Bouclier en bois',
    icon: '🛡️',
    workstation: 'workbench',
    ingredients: [{ type: 'wood', count: 8 }],
    result: { type: 'wooden_shield', count: 1 },
    toolStats: { armor: 5, toolType: 'shield' },
    description: 'Réduit les dégâts reçus de 5'
  },
  {
    id: 'furnace',
    name: 'Fournaise',
    icon: '🏭',
    workstation: 'workbench',
    ingredients: [{ type: 'rock', count: 15 }],
    result: { type: 'furnace', count: 1 },
    description: 'Fond les minerais en lingots'
  },
  {
    id: 'anvil',
    name: 'Enclume',
    icon: '⚒️',
    workstation: 'workbench',
    ingredients: [{ type: 'iron_bar', count: 5 }, { type: 'rock', count: 15 }],
    result: { type: 'anvil', count: 1 },
    description: 'Forge des armes et armures en métal'
  },
  {
    id: 'fletching_table',
    name: 'Table de flèches',
    icon: '🏹',
    workstation: 'workbench',
    ingredients: [{ type: 'birch_wood', count: 25 }, { type: 'flint', count: 10 }],
    result: { type: 'fletching_table', count: 1 },
    description: 'Crée des arcs et des flèches'
  },
  {
    id: 'cauldron',
    name: 'Chaudron',
    icon: '🫕',
    workstation: 'workbench',
    ingredients: [{ type: 'wood', count: 10 }, { type: 'rock', count: 10 }],
    result: { type: 'cauldron', count: 1 },
    description: 'Cuisine des aliments'
  },

  // === FOURNAISE ===
  {
    id: 'iron_bar',
    name: 'Lingot de fer',
    icon: '🔩',
    workstation: 'furnace',
    ingredients: [{ type: 'iron_ore', count: 2 }, { type: 'wood', count: 1 }],
    result: { type: 'iron_bar', count: 1 },
    smeltTime: 5000,
    description: 'Minerai fondu en lingot'
  },
  {
    id: 'stone_brick',
    name: 'Brique de pierre',
    icon: '🧱',
    workstation: 'furnace',
    ingredients: [{ type: 'rock', count: 3 }, { type: 'wood', count: 1 }],
    result: { type: 'stone_brick', count: 1 },
    smeltTime: 3000,
    description: 'Pierre taillée en brique solide'
  },

  // === ENCLUME ===
  {
    id: 'stone_axe',
    name: 'Hache en pierre',
    icon: '🪓',
    workstation: 'anvil',
    ingredients: [{ type: 'rock', count: 8 }, { type: 'wood', count: 2 }],
    result: { type: 'stone_axe', count: 1 },
    toolStats: { damage: 15, toolType: 'axe', durability: 100 },
    description: 'Hache plus durable en pierre'
  },
  {
    id: 'stone_pickaxe',
    name: 'Pioche en pierre',
    icon: '⛏️',
    workstation: 'anvil',
    ingredients: [{ type: 'rock', count: 8 }, { type: 'wood', count: 2 }],
    result: { type: 'stone_pickaxe', count: 1 },
    toolStats: { damage: 15, toolType: 'pickaxe', durability: 100 },
    description: 'Mine le fer'
  },
  {
    id: 'stone_sword',
    name: 'Épée en pierre',
    icon: '🗡️',
    workstation: 'anvil',
    ingredients: [{ type: 'rock', count: 8 }, { type: 'birch_wood', count: 2 }],
    result: { type: 'stone_sword', count: 1 },
    toolStats: { damage: 18, toolType: 'sword', durability: 80 },
    description: 'Épée de pierre'
  },
  {
    id: 'iron_axe',
    name: 'Hache en fer',
    icon: '🪓',
    workstation: 'anvil',
    ingredients: [{ type: 'iron_bar', count: 3 }, { type: 'birch_wood', count: 5 }],
    result: { type: 'iron_axe', count: 1 },
    toolStats: { damage: 30, toolType: 'axe', durability: 200 },
    description: 'Hache en fer, très efficace'
  },
  {
    id: 'iron_pickaxe',
    name: 'Pioche en fer',
    icon: '⛏️',
    workstation: 'anvil',
    ingredients: [{ type: 'iron_bar', count: 3 }, { type: 'birch_wood', count: 5 }],
    result: { type: 'iron_pickaxe', count: 1 },
    toolStats: { damage: 30, toolType: 'pickaxe', durability: 200 },
    description: 'Mine plus vite'
  },
  {
    id: 'iron_sword',
    name: 'Épée en fer',
    icon: '⚔️',
    workstation: 'anvil',
    ingredients: [{ type: 'iron_bar', count: 5 }, { type: 'birch_wood', count: 3 }],
    result: { type: 'iron_sword', count: 1 },
    toolStats: { damage: 35, toolType: 'sword', durability: 150 },
    description: 'Épée solide et fiable'
  },
  {
    id: 'steel_sword',
    name: 'Épée en acier',
    icon: '⚔️',
    workstation: 'anvil',
    ingredients: [{ type: 'iron_bar', count: 7 }, { type: 'birch_wood', count: 5 }],
    result: { type: 'steel_sword', count: 1 },
    toolStats: { damage: 55, toolType: 'sword', durability: 300 },
    description: 'Épée puissante forgée à l\'enclume'
  },
  {
    id: 'gold_sword',
    name: 'Épée en or',
    icon: '⚔️',
    workstation: 'anvil',
    ingredients: [{ type: 'wood', count: 5 }, { type: 'gold_bar', count: 5 }],
    result: { type: 'gold_sword', count: 1 },
    toolStats: { damage: 45, toolType: 'sword', durability: 120 },
    description: 'Brillante mais fragile'
  },
  {
    id: 'flint_arrows',
    name: 'Flèches en silex',
    icon: '🏹',
    workstation: 'anvil',
    ingredients: [{ type: 'flint', count: 5 }, { type: 'wood', count: 3 }],
    result: { type: 'flint_arrows', count: 10 },
    description: 'Munitions pour l\'arc'
  },
  {
    id: 'iron_armor',
    name: 'Armure en fer',
    icon: '🛡️',
    workstation: 'anvil',
    ingredients: [{ type: 'iron_bar', count: 10 }],
    result: { type: 'iron_armor', count: 1 },
    toolStats: { armor: 15, toolType: 'armor' },
    description: 'Réduit les dégâts de 15'
  },

  // === CHAUDRON ===
  {
    id: 'bread',
    name: 'Pain',
    icon: '🍞',
    workstation: 'cauldron',
    ingredients: [{ type: 'wheat', count: 5 }],
    result: { type: 'bread', count: 1 },
    consumable: { hunger: 40, health: 10 },
    description: 'Restaure 40 faim et 10 vie'
  },
  {
    id: 'soup',
    name: 'Soupe',
    icon: '🍲',
    workstation: 'cauldron',
    ingredients: [{ type: 'rock', count: 1 }, { type: 'bark', count: 2 }],
    result: { type: 'soup', count: 1 },
    consumable: { hunger: 60, health: 30, stamina: 20 },
    description: 'Restaure 60 faim, 30 vie, 20 endurance'
  },

  // === TABLE DE FLÈCHES ===
  {
    id: 'bow',
    name: 'Arc',
    icon: '🏹',
    workstation: 'fletching_table',
    ingredients: [{ type: 'birch_wood', count: 8 }, { type: 'bark', count: 5 }],
    result: { type: 'bow', count: 1 },
    toolStats: { damage: 25, toolType: 'bow', range: 15, durability: 80 },
    description: 'Attaque à distance — nécessite des flèches'
  },
];

// Stats des consommables trouvés dans le monde
const CONSUMABLE_EFFECTS = {
  pink_shroom:  { stamina: 30, description: 'Champignon rose — restaure 30 endurance' },
  red_shroom:   { health: 30, description: 'Champignon rouge — restaure 30 vie' },
  yellow_shroom:{ hunger: 30, description: 'Champignon jaune — restaure 30 faim' },
  ligon_shroom: { hunger: 10, description: 'Champignon ligon — restaure 10 faim' },
  bread:        { hunger: 40, health: 10, description: 'Pain — restaure 40 faim et 10 vie' },
  soup:         { hunger: 60, health: 30, stamina: 20, description: 'Soupe — restaure tout' },
};

// Stats des outils (dégâts, type, etc.)
const TOOL_STATS = {
  fist:           { damage: 3,  toolType: 'fist',    durability: Infinity },
  wooden_axe:     { damage: 5,  toolType: 'axe',     durability: 50 },
  wooden_pickaxe: { damage: 5,  toolType: 'pickaxe', durability: 50 },
  wooden_sword:   { damage: 8,  toolType: 'sword',   durability: 40 },
  wooden_shield:  { armor: 5,   toolType: 'shield' },
  stone_axe:      { damage: 15, toolType: 'axe',     durability: 100 },
  stone_pickaxe:  { damage: 15, toolType: 'pickaxe', durability: 100 },
  stone_sword:    { damage: 18, toolType: 'sword',   durability: 80 },
  iron_axe:       { damage: 30, toolType: 'axe',     durability: 200 },
  iron_pickaxe:   { damage: 30, toolType: 'pickaxe', durability: 200 },
  iron_sword:     { damage: 35, toolType: 'sword',   durability: 150 },
  steel_sword:    { damage: 55, toolType: 'sword',   durability: 300 },
  gold_sword:     { damage: 45, toolType: 'sword',   durability: 120 },
  bow:            { damage: 25, toolType: 'bow',      range: 15, durability: 80 },
  iron_armor:     { armor: 15,  toolType: 'armor' },
  campfire:       { toolType: 'structure' },
  workbench:      { toolType: 'structure' },
  furnace:        { toolType: 'structure' },
  anvil:          { toolType: 'structure' },
  fletching_table:{ toolType: 'structure' },
  cauldron:       { toolType: 'structure' },
};

class CraftingSystem {
  constructor() {
    this.recipes = RECIPES;
    this.smeltingQueue = []; // { recipeId, startTime, peerId }
  }

  // Retourne les recettes disponibles selon l'inventaire et l'établi à proximité
  getAvailableRecipes(inventory, nearbyWorkstation = null) {
    return this.recipes.filter(recipe => {
      // Vérifier que l'établi requis est disponible
      if (recipe.workstation && recipe.workstation !== nearbyWorkstation) return false;
      return this.canCraft(recipe, inventory);
    });
  }

  // Retourne TOUTES les recettes pour l'affichage (même non craftables)
  getRecipesForWorkstation(nearbyWorkstation = null) {
    return this.recipes.filter(recipe => {
      if (!nearbyWorkstation) return !recipe.workstation;
      return recipe.workstation === nearbyWorkstation;
    });
  }

  // Vérifie si une recette est craftable avec l'inventaire donné
  canCraft(recipe, inventory) {
    return recipe.ingredients.every(ingredient => {
      const count = this.countItem(inventory, ingredient.type);
      return count >= ingredient.count;
    });
  }

  // Exécute le craft: retire les ingrédients, ajoute le résultat
  craft(recipeId, inventory, nearbyWorkstation = null) {
    const recipe = this.getRecipeById(recipeId);
    if (!recipe) return { success: false, message: 'Recette introuvable' };
    if (recipe.workstation && recipe.workstation !== nearbyWorkstation) {
      return { success: false, message: 'Établi incorrect' };
    }
    if (!this.canCraft(recipe, inventory)) {
      return { success: false, message: 'Ressources insuffisantes' };
    }

    // Retirer les ingrédients de l'inventaire
    for (const ingredient of recipe.ingredients) {
      this.removeItems(inventory, ingredient.type, ingredient.count);
    }

    // Ajouter le résultat
    const item = {
      type: recipe.result.type,
      count: recipe.result.count,
      ...(recipe.toolStats ? { stats: recipe.toolStats } : {}),
      ...(recipe.consumable ? { consumable: recipe.consumable } : {}),
    };
    this.addItem(inventory, item);

    return { success: true, item, recipe };
  }

  // Récupère une recette par son ID
  getRecipeById(id) {
    return this.recipes.find(r => r.id === id) || null;
  }

  // Compte le nombre d'un item dans l'inventaire
  countItem(inventory, type) {
    if (inventory.countItem) return inventory.countItem(type);
    const arr = inventory.slots || inventory;
    return arr.reduce((sum, slot) => {
      return sum + (slot && slot.type === type ? slot.count : 0);
    }, 0);
  }

  // Retire des items de l'inventaire
  removeItems(inventory, type, amount) {
    if (inventory.removeItem) return inventory.removeItem(type, amount);
    const arr = inventory.slots || inventory;
    let remaining = amount;
    for (let i = 0; i < arr.length && remaining > 0; i++) {
      if (arr[i] && arr[i].type === type) {
        const take = Math.min(arr[i].count, remaining);
        arr[i].count -= take;
        remaining -= take;
        if (arr[i].count <= 0) arr[i] = null;
      }
    }
  }

  // Ajoute un item à l'inventaire
  addItem(inventory, item) {
    if (inventory.addItem) return inventory.addItem(item.type, item.count);
    const arr = inventory.slots || inventory;
    for (let i = 0; i < arr.length; i++) {
      if (arr[i] && arr[i].type === item.type) {
        arr[i].count += item.count;
        return i;
      }
    }
    for (let i = 0; i < arr.length; i++) {
      if (!arr[i]) {
        arr[i] = { ...item };
        return i;
      }
    }
    return -1; // Inventaire plein
  }

  // Applique les effets d'un consommable sur le joueur
  applyConsumable(itemType, player) {
    const effects = CONSUMABLE_EFFECTS[itemType];
    if (!effects) return false;
    if (effects.health)  player.health  = Math.min(player.maxHealth,  player.health  + effects.health);
    if (effects.hunger)  player.hunger  = Math.min(player.maxHunger,  player.hunger  + effects.hunger);
    if (effects.stamina) player.stamina = Math.min(player.maxStamina, player.stamina + effects.stamina);
    return true;
  }

  // Retourne les stats d'un outil
  getToolStats(itemType) {
    return TOOL_STATS[itemType] || TOOL_STATS.fist;
  }
}

// Instance globale
const craftingSystem = new CraftingSystem();
