# VeilCraft

> A first-person multiplayer survival & crafting game that runs entirely in the browser.
> Vanilla JavaScript + Three.js, peer-to-peer multiplayer over WebRTC — no server, no build step.

**Authors:** Eric Villeneuve & Alex Musial — ICS3U 2026

---

## Play

VeilCraft is 100% static. Any static host works (GitHub Pages, or just open it locally).

```bash
# from the project root
python3 -m http.server 8000
# then open http://localhost:8000/index.html
```

> A local web server is required (not `file://`) because the game loads ES modules,
> textures and 3D models with `fetch`, which browsers block on the `file://` protocol.

- **`index.html`** — landing / main menu
- **`game.html`** — the game itself
- **`journal.html`** — the project journal

---

## Controls

| Input | Action |
|------|--------|
| **W A S D** | Move |
| **Mouse** | Look around (click the game once to lock the pointer) |
| **Shift** | Sprint (drains stamina) |
| **Space** | Jump |
| **Left click** | Attack / mine / harvest |
| **1 – 0** | Select hotbar slot |
| **Mouse wheel** | Cycle hotbar slots |
| **F** | Use / eat the selected item |
| **P** | Place the selected structure (workbench, bed, wall, chest…) |
| **E** | Open / close inventory |
| **Q** | Drop one of the selected item |
| **Escape** | Close menus / release pointer |

---

## Surviving

- **Gather** wood, stone, flint, mushrooms and ore by hitting resources with the right tool.
- **Craft** by opening your inventory near the matching workstation. Better workstations unlock better gear:
  - **Workbench** → tools, walls, doors, beds, chests
  - **Furnace** → smelt iron & gold bars, cook food
  - **Anvil** → armor and advanced weapons
  - **Campfire / Cauldron** → cook meat, brew soup
  - **Fletching table** → bows and arrows
- **Eat** before your hunger hits zero — once it does, you start **starving** and lose health over time (watch for the on-screen warning).
- **Survive the night.** Enemies spawn in waves after dark. Build walls, craft armor, and fight back.
- **Sleep.** Craft a **bed**, place it at night with **P**, and sleep through to morning to skip the danger.
- **Explore caves.** Find a cave mouth and **walk down its sloped ramp** into a real underground system of enclosed **chambers and branching tunnels** — then stroll right back up into daylight when you're done. The richest ores (coal, iron, gold) and **glowing crystals** are deep inside. It's dark down there — your **head-torch** lights automatically once you're underground.
- **Fight with feel.** You can see your **hand and held item** on screen; attacking plays a swing. Enemies **flash, get knocked back, and show damage numbers** when you hit them.

## Progression at a glance

```
Wood tools  →  Stone tools  →  Iron tools  →  Steel / Gold gear
            →  Leather armor → Iron armor → Gold armor
            →  Shelter: walls, doors, chests, beds
```

Every item has a **rarity** (common → uncommon → rare → epic) and a **tooltip** showing its full stats — damage, armor, durability, restore values and more. Hover any inventory slot to inspect it.

---

## Multiplayer

VeilCraft uses **PeerJS / WebRTC** for direct peer-to-peer play — there is no central game server.

1. One player hosts and shares their room code.
2. Friends join with that code.
3. The host is authoritative for the world seed, resource state and item pickups, so everyone sees the same island.

If the host leaves, host migration hands authority to another player.

---

## Project layout

```
veilcraft/
├─ index.html  game.html  journal.html
├─ css/        game.css
├─ js/         world, player, entities, crafting, network, ui, assets, icons, audio, save, main
├─ assets/     models/  icons/  Textures/
├─ tools/      icon generator + data-splice scripts
└─ tests/      run-tests.mjs   (headless Node test suite)
```

See **DEVELOPER.md** for architecture details and **CHANGELOG.md** for what changed.

## Tests

```bash
node tests/run-tests.mjs
```

Runs a headless suite (no browser needed) covering item-database integrity, icon assets,
recipe validity, stat tables, the crafting system, and deterministic world + cave generation.
