# Changelog

All notable changes to VeilCraft.

## [3.0] — Real caves, first-person hands & combat feedback

This release delivers the headline roadmap items that were still missing: genuine enclosed
caves, a visible first-person hand with swing animations, and clear hit feedback on enemies —
plus a fix for 3D models failing to load on GitHub Pages.

### Added
- **Real caves (`js/caves.js`, `window.VCCaves`).** The world now contains 5 fully enclosed,
  deterministic cave systems: a surface entrance crater you climb down through, a large main
  chamber, 2–3 satellite chambers, and connecting tunnels. Chambers have solid floors, walls,
  and domed ceilings; satellites are sealed underground while the entrance stays open to the sky.
  Caves contain their own **coal, iron, and gold** deposits and **glowing crystals** that light
  the dark.
- **Cave collision & atmosphere.** Walking below a chamber ceiling drops you onto the cave floor
  with a working head-clamp (no popping through rock). Underground, the sun and ambient light dim,
  the fog closes in, and a warm **head-torch** switches on so you can see.
- **First-person hand + held-item view model.** You now always see a low-poly hand on screen, with
  the selected item held in it. Attacking/mining plays a real **swing animation** (arc + recoil),
  and the view model has a subtle idle sway tied to head-bob. Fists swing when empty-handed.
- **Enemy hit feedback.** Struck enemies **flash red**, take **knockback** away from the blow,
  and show a floating **damage number** that rises and fades. Pigs are knocked back too.
- **Cave tests.** The headless suite gained a full `VCCaves` section (determinism, structure,
  sampling, entrance carve, world integration) — now **877 assertions**.

### Fixed
- **3D models not loading on GitHub Pages.** Added a `.nojekyll` file so Pages serves the model
  folders verbatim (Jekyll was silently dropping/!-prefixed asset paths), and hardened the model
  loader in `js/assets.js` with a longer timeout and one automatic retry for cold-cache stalls.

## [2.0] — Content, polish & systems overhaul

This release closes out the major feature requests: real item art, visible held items,
deeper progression, caves, and a proper safety net of tests and docs.

### Added
- **Hand-drawn item icon set.** 50 generated SVG icons in `assets/icons/items/`, wired through
  the new `js/icons.js` (`window.VCIcons`). The hotbar, inventory and tooltips now show real art
  instead of ambiguous emoji (no more "flint is a diamond, iron ore is a pickaxe"). Emoji remain
  as an automatic fallback.
- **Held-item models.** The item in your hand now shows the correct low-poly model (axe, pickaxe,
  wood, stone, rock…) via `VCAssets.buildModel`, with a colored-box fallback.
- **Item stats & tooltips.** Every item carries `rarity`, `value`, `stack` and combat/consumable
  stats. Hovering a slot shows a rich tooltip: rarity badge, type, damage, armor, range,
  durability, and restore values. Rarity also tints slot borders.
- **Caves / grottos.** The island is now carved with sunken rocky grottos. The richest ores
  — **coal, gold, and extra iron** — spawn only inside them, with distinct ore visuals. Generation
  stays fully deterministic.
- **Progression.** New recipes and items: **leather armor, gold armor**, **gold bar** smelting,
  **beds, chests, wood/stone walls, wood doors**, and edible **berries**.
- **Sleeping.** Place a **bed** at night (P) to sleep through to morning — skips the night,
  clears the current wave, and restores health/stamina. Host-authoritative.
- **Starvation warning UI** and **damage-cause tags** on floating damage numbers
  (Famine / Chute / enemy), so you always know *why* you took damage.
- **Headless test suite** (`tests/run-tests.mjs`) — 857 assertions across item data, icons,
  recipes, stat tables, crafting, and deterministic world + cave generation.
- **Documentation** — `README.md` (players) and `DEVELOPER.md` (architecture, extending, testing).

### Fixed
- **"Taking damage for no reason."** Starvation now only triggers after hunger actually reaches
  zero (with a short grace period), and enemy melee only lands when an enemy is genuinely in
  range (≤ 1.8 units). No more phantom hits with no mob nearby.
- **Item duplication on pickup** — pickups are resolved by the authoritative host
  (`MSG.ITEM_PICKED`), eliminating the exponential drop/duplication bug.
- **Exponential Q-drop duplication** — dropping items no longer multiplies them.
- **Unused models/icons** — resource and held-item models are now actually mapped and rendered.

### Changed
- Crafting recipes, consumable effects and tool stats expanded and reconciled so every entry
  references a real item (enforced by tests).
- Item ids normalized to canonical `snake_case` throughout.

### Known limitations
- Caves are sunken grottos, not true overhang tunnels — a deliberate choice given the
  single-heightfield terrain. (True tunnels would require voxel/chunk meshing.)
- The automated tests validate data and logic only. Rendering, lighting, animation, input and
  multiplayer sync still require a browser playtest — they can't run in a headless sandbox.

## [1.0] — Initial release
- First-person movement, mining/harvesting, crafting, day/night cycle, enemy waves,
  and peer-to-peer multiplayer on a seeded procedural island.
