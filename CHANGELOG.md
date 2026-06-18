# Changelog

All notable changes to VeilCraft.

## [4.1] — Cave readability & navigation polish

Follow-up to the 4.0 cave rework, addressing live play-test feedback that the caves looked
**brown** and felt **weird and hard to navigate**. The geometry from 4.0 was sound; the
problems were lighting and proportions. Caves now read as bright, open, grey-stone caverns
you can comfortably move through.

### Fixed
- **Rock looked muddy brown.** The only meaningful light underground was a strongly orange
  head-torch (`0xffb169`) shining on near-black rock (`0x4a4658`), and the cave ambient was
  crushed to near-zero (0.06) under heavy near-black fog — so everything turned brown and
  murky. The torch is now **near-white** (`0xfff1e0`, longer reach), the rock is a lighter
  **cool blue-grey stone** (`0xb0b4c4`), and underground ambient is a steady **cool fill**
  (`0x6b76a0` @ 0.6) with lighter, cooler fog. Grey stone now reads as grey stone.
- **Caves were hard to navigate.** Three causes, all fixed:
  - **Too cramped** — main hall and satellite chambers are taller (≈7–10 of headroom) and
    wider, and tunnels are now proper **walkable-width corridors** (radius ≈3.4–4.8, up from
    ≈2.2–3.2).
  - **Too dark to see across a room** — every chamber now gets its own **soft cool fill light**
    so the whole room is readable, not just the torch cone in front of you.
  - **Disorienting shapes** — wall/dome jitter was dialed way back (rough rock, not spiky
    chaos), and tunnels are **trimmed to the chamber rims** with a **flat floor strip** so a
    passage reads as a mouth in the wall instead of a lump poking into the room.
- **Cave tint could leak onto the surface.** The cave ambient now resets to the surface tone
  the moment you leave, so the overworld is never left with a cool cast.

### Tests & docs
- The headless suite grew to **896 assertions** — added **navigability invariants**: every
  chamber has comfortable standing headroom (≥ 6) yet stays an enclosed room (< 12, so the
  head-clamp still engages), and every tunnel is a walkable-width corridor (radius ≥ 3.0).
- `tools/sim_cave.mjs` re-run against the roomier layout: 0 surface leaks, ingress/egress and
  deepest-chamber traversal all pass.

## [4.0] — Walkable underground systems & live-build fixes

This release rebuilds the cave entrance into a genuinely **walkable underground system** and
fixes the issues found while play-testing v3 live on GitHub Pages. The headline is the cave
rework: the old entrance was effectively a vertical crater you couldn't move around in (you
slid up the wall the moment you tried to walk), so it has been replaced with a real, sloped
ramp you stroll down and back up.

### Changed
- **Caves are now walkable underground systems, not a crater.** The entrance is a sloped,
  open-topped **ramp ("adit")** carved from a surface mouth down into the main chamber. Because
  the ramp is modelled as its own cave volume, a single consistent floor function carries you
  smoothly **down into the cave and back up into daylight** — no more being lifted out and
  locked above the ceiling. The main chamber connects to 4–6 branching satellite chambers via
  tunnels, forming a real multi-room network.
- **Cave horizontal containment is wall-aware.** Leaving the carved volume now only blocks you
  when the ground outside is an actual wall (terrain well above your feet). Walking out onto
  open ground — e.g. up the ramp mouth — is always allowed, so you can never get trapped
  underground.

### Fixed
- **Caves were unwalkable "cylinder holes."** Climbing the side wall on entry / being unable to
  move around is gone; the ramp + union-based environment sampling keep you on a sensible floor
  throughout the whole system.
- **All enemies flickered when one took damage.** Damage flashes mutated a *shared* material;
  every enemy now owns a cloned material, so only the struck enemy flashes.
- **Day/night cycle ran far too fast.** Day length is now 300s (night 110s) for a calm,
  readable cycle.
- **You couldn't see the item in your hand.** The first-person camera is now part of the scene
  graph, so the held-item view model (and swing animations) actually render on screen.
- **`computeBoundingSphere(): radius is NaN` console spam.** Tunnel geometry treated chamber
  *indices* as objects, producing a `NaN` cylinder height. Tunnels now resolve
  `sys.chambers[t.a/t.b]` with a finite-length guard, eliminating the malformed geometry.

### Tests & docs
- The headless suite grew to **893 assertions** (entrance ramp geometry, open-topped ceiling,
  ramp-floor descent mouth→chamber, NaN-geometry regression, graph connectivity).
- A dedicated headless **player-physics simulation** (`tools/sim_cave.mjs`) walks the real
  generated systems with gravity and asserts ramp **ingress**, **egress**, deep-chamber
  **traversal**, and **zero surface leaks**.

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
