// World and progression data.
// Math is no longer per-world — every world contains the full 12×12 set.
// Worlds are pure progression / theming.
// `levelsRequired` is 4 (mult, div, mixed, boss) — world N+1 unlocks when all
// 4 challenges of world N are cleared. See checkWorldUnlock() below.
//
// Each world also carries:
//   - `villain`: the boss persona text (shown above the boss HP bar). In
//     Chapter 3 the same field is the MESS headline on the level-select boss
//     tile: an everyday event at the place, never a creature.
//   - `flavorText`: a 1-line story beat per world. Chapters 1 and 2 keep it as
//     data only; Chapter 3 shows it on the order-complete card after every boss
//     win (ConveyorScene).
//   - `rushLine` (Chapter 3 only): the tail of the boss quota line. ConveyorScene
//     composes 'Pack all N ' + rushLine + '.', so it stays lowercase with no
//     trailing period.

export const WORLDS = [
  // ── Chapter 1 — "Outer Space" (the original campaign) ──────────────────────
  {
    id: 1,
    chapter: 1,
    name: 'Moon Base',
    color: 0x6f7ec4,
    accentColor: 0xb5e6ff,
    description: 'Where it all begins: your first hop into the dark.',
    villain: 'Cratershade',
    flavorText: 'Moon Base reclaimed. The Void recoils into deeper space.',
    levelsRequired: 4
  },
  {
    id: 2,
    chapter: 1,
    name: 'Asteroid Belt',
    color: 0xc77a4a,
    accentColor: 0xffb38a,
    description: 'Dodging the rubble of long-gone planets.',
    villain: 'Boulderlord',
    flavorText: 'Asteroid Belt cleared. The rubble drifts quiet again.',
    levelsRequired: 4
  },
  {
    id: 3,
    chapter: 1,
    name: 'Crystal Planet',
    color: 0x7a4eaa,
    accentColor: 0xd5a6ff,
    description: 'A world where time chimes like glass.',
    villain: 'Shardmaw',
    flavorText: 'Crystal Planet rings free. Light pours through the facets.',
    levelsRequired: 4
  },
  {
    id: 4,
    chapter: 1,
    name: 'Nebula Gardens',
    color: 0x4f956b,
    accentColor: 0x9be8a3,
    description: 'Drifting clouds of color and quiet warmth.',
    villain: 'Mistshroud',
    flavorText: 'Nebula Gardens bloom. Color rolls back across the dark.',
    levelsRequired: 4
  },
  {
    id: 5,
    chapter: 1,
    name: 'Robot Station',
    color: 0x4c7ab5,
    accentColor: 0x9bd4ff,
    description: 'An automated outpost humming with ancient code.',
    villain: 'Coregrinder',
    flavorText: 'Robot Station reboots. Ancient lights blink awake.',
    levelsRequired: 4
  },
  {
    id: 6,
    chapter: 1,
    name: 'Black Hole Edge',
    color: 0x4a2a55,
    accentColor: 0xff9ec7,
    description: 'Light bends. So does logic.',
    villain: 'Eventhorror',
    flavorText: 'The Black Hole Edge holds. Light bends back toward home.',
    levelsRequired: 4
  },
  {
    id: 7,
    chapter: 1,
    name: 'Ice Comet',
    color: 0x6e95c2,
    accentColor: 0xb6e0ff,
    description: 'A frozen tail blazing across the sky.',
    villain: 'Frostfang',
    flavorText: 'Ice Comet streaks free. Its tail blazes a path forward.',
    levelsRequired: 4
  },
  {
    id: 8,
    chapter: 1,
    name: 'Supernova',
    color: 0xc44b5e,
    accentColor: 0xffae8a,
    description: "A star's last brilliant breath.",
    villain: 'Pyrewraith',
    flavorText: 'Supernova settles. Its embers seed new constellations.',
    levelsRequired: 4
  },
  {
    id: 9,
    chapter: 1,
    name: 'Galactic Core',
    color: 0xc88a3a,
    accentColor: 0xffe07a,
    description: 'The bright, dense heart of your home galaxy.',
    villain: 'Corecrusher',
    flavorText: 'Galactic Core pulses gold. The galaxy turns on its axis once more.',
    levelsRequired: 4
  },
  {
    id: 10,
    chapter: 1,
    name: 'Parallel Dimension',
    color: 0x55858a,
    accentColor: 0xa6f0e8,
    description: 'Familiar yet strange. The rules feel sideways.',
    villain: 'Mirrorshade',
    flavorText: 'Parallel Dimension snaps back. The rules feel right again.',
    levelsRequired: 4
  },
  {
    id: 11,
    chapter: 1,
    name: "Universe's End",
    color: 0x4a4a8c,
    accentColor: 0xfff3b8,
    description: 'The last horizon. The final stand against the Void.',
    villain: 'The Void Devourer',
    flavorText: 'The Void cracks open, and something pulls you inward, smaller and smaller…',
    levelsRequired: 4,
    bigBoss: true
  },
  // ── Chapter 2 — "Inner Space" (the microscopic finale) ─────────────────────
  // Reached via the wormhole that tears open beside "Universe's End" (World 11,
  // CHAPTER1_FINAL_ID) once that finale boss is beaten — the Void cracks open and
  // pulls you inward. A nanocraft shrinks down through the body; bosses are
  // kid-friendly giant germs. The grand finale lives at the end (world 28).
  {
    id: 21,
    chapter: 2,
    name: 'Bloodstream',
    color: 0x8a2b3a,
    accentColor: 0xff7a8a,
    description: 'Shrunk to a speck, riding the warm red rivers within.',
    villain: 'Sneezel',
    flavorText: 'The Bloodstream runs clear. The current carries you deeper.',
    levelsRequired: 4
  },
  {
    id: 22,
    chapter: 2,
    name: 'Cell City',
    color: 0x2f8f86,
    accentColor: 0x4ecdc4,
    description: 'A bustling metropolis of living cells.',
    villain: 'Gunkster',
    flavorText: 'Cell City hums back to life. The streets glow clean again.',
    levelsRequired: 4
  },
  {
    id: 23,
    chapter: 2,
    name: 'Nucleus Vault',
    color: 0x6a3fa0,
    accentColor: 0xc77eff,
    description: 'The vault where the cell keeps its blueprints.',
    villain: 'Scramble',
    flavorText: 'The Nucleus settles. The blueprints read true again.',
    levelsRequired: 4
  },
  {
    id: 24,
    chapter: 2,
    name: 'Neuron Forest',
    color: 0x3a5fa0,
    accentColor: 0x7fb8ff,
    description: 'A glowing forest of crackling nerve-trees.',
    villain: 'Staticbug',
    flavorText: 'The Neuron Forest steadies. Bright signals race home.',
    levelsRequired: 4
  },
  {
    id: 25,
    chapter: 2,
    name: 'Marrow Caverns',
    color: 0xb5863a,
    accentColor: 0xffcf6b,
    description: 'Deep caverns where brand-new cells are born.',
    villain: 'Crustle',
    flavorText: 'Marrow Caverns bloom. Fresh cells stream upward.',
    levelsRequired: 4
  },
  {
    id: 26,
    chapter: 2,
    name: 'Immune Front',
    color: 0x4f8a35,
    accentColor: 0x9be86b,
    description: 'The front line where the body defends itself.',
    villain: 'Swarm Mother',
    flavorText: 'The Immune Front holds. The body breathes easy.',
    levelsRequired: 4
  },
  {
    id: 27,
    chapter: 2,
    name: 'Mitochondria Core',
    color: 0xc4622a,
    accentColor: 0xff9b4a,
    description: 'The roaring furnace that powers every cell.',
    villain: 'Drainol',
    flavorText: 'Mitochondria Core reignites. Energy floods back through the body.',
    levelsRequired: 4
  },
  {
    id: 28,
    chapter: 2,
    name: 'The Singularity Cell',
    color: 0x6a6ab0,
    accentColor: 0xfff3b8,
    description: 'The very first cell of all, where the smallest war ends.',
    villain: 'Patient Zero',
    flavorText: 'The Singularity Cell goes quiet. From the smallest speck, everything heals.',
    levelsRequired: 4,
    bigBoss: true
  },
  // ── Chapter 3, "Home Ground" (homecoming) ──────────────────────────────────
  // The scale arc lands at human scale: Outer Space (the cosmos), Inner Space
  // (the body), Home Ground (the family's own city). The fighting is over, so
  // the mode of play changes too: no falling asteroids, a calm "Pack & Go"
  // conveyor (kind: 'sort', runs ConveyorScene). The eight worlds are one
  // Saturday of errands, morning to dusk, in order: the grocery store, the big
  // garden, the mall, the beach, the warehouse store, the bakery, the seawall
  // and the mountain. Each world's sky steps later than the last. Reached via
  // the warp gate that opens beside the Singularity Cell once the grand finale
  // (World 28) is cleared. Bosses here are "rush orders", not monsters: an
  // everyday mess at the place and a quota to pack before it is too late. The
  // grand finale is dusk on the mountain (World 38): get everyone up and the
  // lights on before dark.
  //
  // No real place, business or city name appears anywhere on screen or in code.
  // The identity lives in the art and the recognition cues; the names are plain
  // nouns the way the kids say them.
  {
    id: 31,
    chapter: 3,
    name: 'The Grocery Store',
    color: 0x4f7f6a,
    accentColor: 0xb8f0c8,
    description: 'First stop. The checkout belt, and a cart to fill.',
    villain: 'Saturday Rush',
    // Chapter 3 "rush order" briefs. Ch1/Ch2 surface their villain as a foe on the
    // boss card; Home Ground has no foes, so the same field is the MESS headline
    // on the boss tile: an everyday event at the place (the tide came in, the
    // sprinklers came on early), never a creature to fight. bossBrief is the
    // rush-order card's body; rushLine is the tail of its quota line.
    bossBrief: 'Every lane is open and the line still reaches the bread aisle. Pack every bag before the cart rolls.',
    flavorText: 'Bags packed, cart full. Out into the morning.',
    rushLine: 'before the cart rolls',
    levelsRequired: 4,
    kind: 'sort'
  },
  {
    id: 32,
    chapter: 3,
    name: 'The Big Garden',
    color: 0x4f8a3a,
    accentColor: 0xa8e878,
    description: 'Hedges taller than Dad, a lake with stepping stones, and trays to pot.',
    villain: 'Early Sprinklers',
    bossBrief: 'The sprinklers came on early and every tray got shuffled. Pot them all before the beds dry out.',
    flavorText: 'Trays potted, beds planted. The whole garden hums.',
    rushLine: 'before the beds dry',
    levelsRequired: 4,
    kind: 'sort'
  },
  {
    id: 33,
    chapter: 3,
    name: 'The Mall',
    color: 0x6a6fa8,
    accentColor: 0xd8dcff,
    description: 'Glass roof, long escalators, trees growing on top of the building.',
    villain: 'Rain Day Rush',
    bossBrief: 'It is pouring and the whole city came in to get dry. Pack every bag before the food hall closes.',
    flavorText: 'Bags packed and the rain let up. Back out under the glass.',
    rushLine: 'before the food hall closes',
    levelsRequired: 4,
    kind: 'sort'
  },
  {
    id: 37,
    chapter: 3,
    name: 'The Seawall',
    color: 0x3a8a8a,
    accentColor: 0xffcf7a,
    description: 'Bikes on the seawall, little ferries on the water, the dome across the way.',
    villain: 'Sunset Crowd',
    bossBrief: 'Everybody came out for the sunset and every little ferry is full. Get them across before the light goes.',
    flavorText: 'Every ferry home. The water goes gold, then pink.',
    rushLine: 'before the light goes',
    levelsRequired: 4,
    kind: 'sort'
  },
  {
    id: 36,
    chapter: 3,
    name: 'The Bread Place',
    color: 0xb87048,
    accentColor: 0xffd1a8,
    description: 'The bread place on the plaza. Get there before they close.',
    villain: 'Oven All at Once',
    bossBrief: 'Everything came out of the oven at once and the line is around the corner. Box them while they are warm.',
    // The one and only line in the game that uses the family word. Never a
    // label anyone must read, never a name.
    flavorText: 'Last loaf boxed. One blueby bread saved for the littlest.',
    rushLine: 'before they close',
    levelsRequired: 4,
    kind: 'sort'
  },
  {
    id: 34,
    chapter: 3,
    name: 'The Beach',
    color: 0x3a8fb5,
    accentColor: 0xffe08a,
    description: 'Low tide for miles, a row of logs, and the snack window.',
    villain: 'Tide Over the Towels',
    bossBrief: 'The tide turned and came up over the towels. Everyone wants their order before the blanket moves again.',
    flavorText: 'Every tray out, everyone fed. The tide goes back out for miles.',
    rushLine: 'before the blanket moves',
    levelsRequired: 4,
    kind: 'sort'
  },
  {
    id: 35,
    chapter: 3,
    name: 'The Big Store',
    color: 0xb5623a,
    accentColor: 0xffc27a,
    description: 'Shelves to the ceiling, giant carts, and a hot dog at the end.',
    villain: 'A Pallet Tipped',
    bossBrief: 'A pallet tipped in the back and every giant box is loose. Get them on the flatbeds before the doors close.',
    flavorText: 'Flatbeds loaded, hot dog in hand. That is the big shop done.',
    rushLine: 'before the doors close',
    levelsRequired: 4,
    kind: 'sort'
  },
  {
    id: 38,
    chapter: 3,
    name: 'The Mountain',
    color: 0x4a4f8a,
    accentColor: 0xfff3b8,
    description: 'You walked all the way up. Now get everyone down before dark.',
    villain: 'Everyone Still Up Top',
    // Closes the dark thread that opened in Chapter 1, WITHOUT reopening it: this
    // is not the Void come back (that let go for good inside the smallest cell).
    // It is ordinary evening at the top of the mountain. The Home Ground answer
    // to dark is switching the lights on for the ride down, not a battle.
    // You WALK up this mountain and ride the cabin down, which is how the
    // family actually does it. That is why the copy says climbed, not rode, and
    // why the finale's reward line is the ride down rather than the ride up.
    // Surfaced by ConveyorScene's rush-order intro (see bossBrief): four short
    // lines, sized for the card's 4200ms hold.
    bossBrief: 'Not the old dark. Just evening,\nthe kind that comes every day.\nYou climbed all the way up here.\nNow light it up for the ride down.',
    flavorText: 'The lights come on. Below you, the whole city does too.',
    rushLine: 'before dark',
    levelsRequired: 4,
    bigBoss: true,
    kind: 'sort'
  },
  // Hidden worlds — discovered via warp asteroids in specific levels.
  // Not part of the main world map S-curve. Don't gate the ending.
  {
    id: 15,
    chapter: 1,
    name: 'Glitch World',
    color: 0x39ff14,
    accentColor: 0xff00ff,
    description: 'Something is wrong with the math here.',
    villain: 'Datamosh',
    flavorText: 'The glitches settle. You sense the system breathing.',
    levelsRequired: 1,
    hidden: true,
    discoveredFrom: { worldId: 5, mode: 'div' },
    kind: 'gauntlet'
  },
  {
    id: 16,
    chapter: 1,
    name: "Dad's Garage",
    color: 0xc88a3a,
    accentColor: 0xffe07a,
    description: "The garage where Dad tinkers between worlds.",
    villain: null,
    flavorText: 'You found it. Dad smiles at the screen.',
    levelsRequired: 1,
    hidden: true,
    discoveredFrom: { worldId: 9, modes: ['mult', 'mixed'] },
    kind: 'exploration'
  },
  // Chapter 2 secret — King Coli, the hidden hygiene superboss. A regal E. coli
  // germ-king on a porcelain throne. Discovered via the mixed-mode warp asteroid
  // in Neuron Forest (W24). Tough-but-fair (~40 HP, below Patient Zero's 46).
  {
    id: 17,
    chapter: 2,
    name: 'The Royal Flush',
    color: 0x6b8f3a,
    accentColor: 0xeed25a,
    description: 'A throne where forgotten germs grow strong.',
    villain: 'King Coli',
    flavorText: 'Scrubbed clean. The throne sits empty and gleaming.',
    levelsRequired: 1,
    hidden: true,
    discoveredFrom: { worldId: 24, mode: 'mixed' },
    kind: 'gauntlet'
  },
  // Chapter 2 secret — "Recess": a real-world playground + running track tucked
  // inside the body (the Dad's-Garage trick). Discovered via the div-mode warp
  // asteroid in Immune Front (W26). Non-combat exploration.
  {
    id: 18,
    chapter: 2,
    name: 'Playground',
    color: 0x4a90d9,
    accentColor: 0x7ed957,
    description: 'A patch of the outside world, tucked away.',
    villain: null,
    flavorText: 'You found it. The bell never rings here.',
    levelsRequired: 1,
    hidden: true,
    discoveredFrom: { worldId: 26, mode: 'div' },
    kind: 'exploration'
  },
  // Chapter 3 secret, "Hot Pot Time": the self-serve, individual-bowl hot pot
  // line the family actually eats at. Same no-real-names rule as Dad's Garage,
  // the Playground and every Home Ground world, and it is also the chapter's
  // OWN mechanic in real life: you walk a line filling a bowl, hand it over a
  // counter, take a number, and it comes back made. Pack & Go, for dinner.
  //
  // Discovery is the one thing that could not be reused: warp asteroids only
  // spawn in GameScene, and Chapter 3 runs ConveyorScene. So this world uses
  // `discoveredFromCrate` instead: a rare food crate rides the bakery counter
  // (The Bread Place, W36; see getConveyorSecretForHost +
  // ConveyorScene.spawnFoodCrate). The crate keeps its exact shipped look so
  // it still reads as the odd one out among the bread boxes.
  {
    id: 19,
    chapter: 3,
    name: 'Hot Pot Time',
    color: 0xb5432e,
    accentColor: 0xffb85c,
    description: 'The long line of bins, the scale, and your own table.',
    villain: null,
    flavorText: 'You found it. Five seats, and one of them is yours.',
    levelsRequired: 1,
    hidden: true,
    discoveredFromCrate: { worldId: 36 },
    kind: 'exploration'
  },
  // Chapter 3 secret #2, "The Science Dome": the HARD one. The big silver
  // dome across the water from The Seawall (World 37), at dusk with its lights
  // off. Every crate is a puzzle with one factor missing (`? × 8 = 56` instead
  // of `7 × 8`), and each one solved switches on the next light. Quota 48, the
  // highest in the game (King Coli 40, The Mountain 44), on the game's longest
  // clock. When it is won the dome glows warm gold and white, never a rainbow.
  //
  // It took over from The Night Shift (the old id 20) under a NEW id, so every
  // kid gets a fresh secret to find, including the ones who already found the
  // Night Shift. Id 20 is retired, not deleted: its save keys, its stars (still
  // in the star total) and its Night Noodles all stay. See RETIRED_WORLD_IDS.
  //
  // `belt: true` routes it to the ConveyorScene rather than GameScene (see
  // usesConveyorScene): it is a gauntlet, but Chapter 3's gauntlet is the belt.
  // Crucially the belt SPEED is untouched: the difficulty is the thinking, not
  // the tempo, because a panic-fast belt manufactures taps the engine would
  // wrongly certify as automatic (see the floor in ConveyorScene).
  //
  // No creatures, no villain. Nothing here is chasing her; it is just a dark
  // dome and a stack of puzzles to light it up.
  {
    id: 39,
    chapter: 3,
    name: 'The Science Dome',
    color: 0x4a3a80,        // dusk violet: the sky and the unlit dome
    accentColor: 0xffd27a,  // warm lamp gold: the lights coming on
    description: 'Every crate is a puzzle with one number missing. Solve them all and the whole dome lights up.',
    villain: null,
    flavorText: 'Every light is on. You can see it from all the way across the water.',
    bossBrief: 'Dusk at the dome, and its lights are off.\nEach crate is a puzzle with a number missing.\nSolve it to switch on the next light.',
    levelsRequired: 1,
    hidden: true,
    belt: true,
    discoveredFromCrate: { worldId: 37 },
    kind: 'gauntlet'
  }
];

// Worlds that were taken out of WORLDS but may still live in old saves. Their
// worldProgress entries are carried through load and save untouched (see
// mergeWorldProgress), so nothing a kid earned there is lost and the star
// total keeps adding up. 20 is The Night Shift, replaced by The Science Dome
// (39). Its discovered and cleared flags stay in the hidden-world seeds.
export const RETIRED_WORLD_IDS = [20];

// Visible worlds — the main world map S-curve.
export const VISIBLE_WORLDS = WORLDS.filter(w => !w.hidden);

// Hidden worlds — discoverable via warp asteroids.
export const HIDDEN_WORLDS = WORLDS.filter(w => w.hidden);

// The three secret-room notice boards. They share one note pool and one deck
// (see src/content/dadNotes.js + getDailyNoteForBoard), but each pays its own
// once-per-day stardust when its note is opened. Declared here rather than imported so GameData
// stays free of content-file dependencies; the list must match NOTE_BOARDS.
export const DAD_NOTE_BOARDS = ['garage', 'playground', 'hotpot'];

// Chapter finals are PINNED explicitly (not "last visible world") so that
// adding Chapter 2 worlds can't silently move the end-of-game trigger. Beating
// World 11 ends Chapter 1 (Cosmic pet + Arcade unlock, then the cliffhanger);
// beating World 28 is the true grand finale at the end of Chapter 2.
export const CHAPTER1_FINAL_ID = 11;
export const CHAPTER2_FINAL_ID = 28;
// Chapter 3 ("Home Ground") finale: dusk on the mountain (World 38), where the
// lights come on before dark and everyone rides down toward the city.
export const CHAPTER3_FINAL_ID = 38;

// Chapter 3 day-order revision. Bumped whenever the Home Ground stops are
// re-sequenced. Saves carry the revision they were written under; anything
// lower gets migrateChapter3Order() exactly once, on load. Rev 1 is the
// original day; rev 2 is the re-sequenced one.
export const CH3_ORDER_REV = 2;

// True if this world is the Chapter 1 final boss (Void Devourer). Drives the
// Cosmic-form unlock + the cliffhanger cinematic. Named for back-compat.
export function isFinalVisibleWorld(worldId) {
  return worldId === CHAPTER1_FINAL_ID;
}

// True if this world is the grand-finale boss at the end of Chapter 2.
export function isFinaleWorld(worldId) {
  return worldId === CHAPTER2_FINAL_ID;
}

// True if this world is the Chapter 3 finale (The Mountain, dusk on the peak).
export function isChapter3FinaleWorld(worldId) {
  return worldId === CHAPTER3_FINAL_ID;
}

// Visible worlds belonging to a chapter, in map order. Existing (untagged)
// worlds default to chapter 1.
export function getChapterWorlds(chapter) {
  return VISIBLE_WORLDS.filter(w => (w.chapter || 1) === chapter);
}

// The worlds that "exist" for the player right now: every visible world across
// all three chapters. Kept as a function because world-count totals (Records, the
// parent dashboard) read it from several places, and hidden worlds must stay out
// of those counts.
export function getActiveWorlds() {
  return VISIBLE_WORLDS;
}

// Returns the next visible world id (for ship auto-advance), or null at the end
// of the chapter. Stays WITHIN the world's own chapter — clearing World 11 does
// not auto-advance into Chapter 2 (that's reached via the warp gate).
export function getNextVisibleWorldId(currentId) {
  const world = findWorld(currentId);
  const chapterWorlds = getChapterWorlds(world?.chapter || 1);
  const idx = chapterWorlds.findIndex(w => w.id === currentId);
  if (idx < 0 || idx === chapterWorlds.length - 1) return null;
  return chapterWorlds[idx + 1].id;
}

// Find a world by id (visible or hidden). Used by GameScene/HiddenWorldScene.
export function findWorld(worldId) {
  return WORLDS.find(w => w.id === worldId) || null;
}

// Which hidden world (if any) is reachable from this (worldId, mode) host?
// Supports both shapes: { mode: 'div' } (single host mode) and
// { modes: ['mult', 'mixed'] } (list of host modes — Dad's Garage uses this).
export function getHiddenWorldForHost(worldId, mode) {
  return HIDDEN_WORLDS.find(h => {
    const df = h.discoveredFrom;
    if (df?.worldId !== worldId) return false;
    if (df.modes) return df.modes.includes(mode);
    return df.mode === mode;
  }) || null;
}

// Which hidden world (if any) is reachable from a CONVEYOR host world? The
// Chapter 3 belt has no asteroids to warp off, so its secret rides in on a rare
// food crate instead (ConveyorScene.spawnFoodCrate). Keyed on the world alone —
// every Chapter 3 level runs the same belt, so any level of the host qualifies.
// Deliberately a separate field from `discoveredFrom` so GameScene's warp
// arming can never accidentally match a conveyor-only secret, or vice versa.
export function getConveyorSecretForHost(worldId) {
  return HIDDEN_WORLDS.find(h => h.discoveredFromCrate?.worldId === worldId) || null;
}

// Mode → human-readable label and config used by GameScene/LevelSelectScene.
// Cut: speed/missing/multi — every level is timed now (timer comes from world),
// and missing/multi target advanced cognition rather than automaticity.
export const MODES = {
  mult:  { label: 'Multiply', symbol: '×',  duration: 60, scoreThreshold: 18 },
  div:   { label: 'Divide',   symbol: '÷',  duration: 60, scoreThreshold: 14 },
  mixed: { label: 'Mixed',    symbol: '×÷', duration: 60, scoreThreshold: 16 }
};

// Per-LEVEL scene routing. Chapter 3 ("Home Ground", kind: 'sort') runs the
// Conveyor for every level. As an owner-gated pilot, the Ch1/Ch2 "mixed" (×÷)
// practice level can ALSO route into the Conveyor (reskinned to its own chapter)
// so every world gets one "sort" level among its combat levels — behind
// conveyorMixedEnabled (default OFF). Boss levels always stay on GameScene.
// Reads the progress singleton at call-time (the later `export const progress`
// is fine), mirroring getActiveWorlds.
export function usesConveyorScene(world, levelMode) {
  if (!world) return false;
  if (world.belt) return true;                      // secret belt gauntlet (The Science Dome)
  if (world.kind === 'sort') return true;            // Ch3 — unchanged, all levels
  if (!progress.conveyorMixedEnabled) return false;  // pilot off → legacy routing
  if (world.hidden) return false;                    // secret gauntlet/exploration worlds stay on GameScene
  const chapter = world.chapter || 1;
  if (chapter !== 1 && chapter !== 2) return false;  // pilot scope: Ch1/Ch2 only
  if (levelMode !== 'mixed') return false;           // ONLY the mixed level (boss excluded)
  // A mixed level that HOSTS a hidden-world warp must stay on GameScene: the warp
  // asteroid — the only in-game way to discover that secret world (e.g. W24 mixed →
  // King Coli, W9 mixed → Dad's Garage) — spawns only in GameScene, never on the
  // belt. Keep those few hosts on asteroids so the pilot can't sever discovery.
  if (getHiddenWorldForHost(world.id, levelMode)) return false;
  return true;
}

// Preserve the existing imports while both scene engines share pure result rules.
export {
  MASTERY_ACCURACY, MASTERY_SCORE_RATIO, isRoundMastered, calculateStars
} from './RoundResults.js';

// Per-problem timer (seconds) keyed by world id. Drives asteroid descent speed
// and spawn cadence.
const WORLD_PROBLEM_SECONDS = {
  1: 8.0,  2: 7.5,  3: 7.0,  4: 6.5,  5: 6.0,
  6: 5.5,  7: 5.0,  8: 4.5,  9: 4.0,  10: 3.5,  11: 3.0,
  // Chapter 2 ("Inner Space") keeps a flat-ish "same designed speed" (~4.5→3.5)
  // on purpose — it is NOT a faster hand-tuned ramp. The per-kid pressure comes
  // from getAdaptiveProblemSeconds (scoped to chapter 2 + arcade), which these
  // values only serve as the cold-start fallback for.
  21: 4.5,  22: 4.3,  23: 4.1,  24: 4.0,  25: 3.9,  26: 3.8,  27: 3.6,  28: 3.5,
  // Chapter 3 ("Home Ground"): the cold-start baseline for the Conveyor belt's
  // active-item window. The real per-kid pressure comes from
  // getAdaptiveProblemSeconds (Conveyor opts in, like Chapter 2). Flat-ish, calm.
  31: 4.5,  32: 4.3,  33: 4.1,  37: 4.0,  36: 3.9,  34: 3.8,  35: 3.6,  38: 3.5,
  // Hidden worlds use their own pacing (read lazily). Glitch boss (15) gets a
  // touch more time: its problems are visually corrupted and it's a 22-hit
  // gauntlet, so 4.5s base (+1.0s boss = 5.5s) keeps a 3-star run attainable.
  15: 4.5,  16: 4.0
};

// Tuning dials for the upper-level variety mechanics. Stardust, twists, and
// mini-bosses all gate on world id and roll against these. One stop for
// playtest tweaks — no spelunking.
export const UPPER_LEVEL_CONFIG = {
  stardust: { minWorldId: 8,  oneIn: 8, bonusScore: 2, bonusStreak: 2 },
  // Chapter 1 worlds 8-11 ramp 0.30→0.40. Chapter 2 (21-28) carries the same
  // signature-twist variety so Inner Space doesn't read as "plain" next to the
  // upper Outer-Space worlds — a matching ramp climbing to the grand finale.
  twist: {
    minWorldId: 8,
    rate: {
      8: 0.30, 9: 0.30, 10: 0.30, 11: 0.40,
      21: 0.30, 22: 0.30, 23: 0.32, 24: 0.34, 25: 0.36, 26: 0.38, 27: 0.40, 28: 0.45,
    },
  },
  miniBoss: { minWorldId: 10, oneIn: 8, hp: 2, fallMultiplier: 1.3, bonusScore: 3 },
};

function getProblemSecondsForWorld(worldId) {
  return WORLD_PROBLEM_SECONDS[worldId] ?? 6.0;
}

// Number of ANSWERABLE asteroids on screen at once. Every world is single-slot
// now — multi-slot share-the-button-strip caused a class of bugs (warp focus
// theft, duplicate problems, target-swap mid-tap, race conditions) that we
// kept whack-a-moling. Difficulty still scales via fall speed (W1 8s/problem,
// W11 3s/problem) and per-world problem pools.
// Workshop (16) is non-combat (0 means no spawn loop).
export function getAsteroidCountForWorld(worldId) {
  if (worldId === 16) return 0;
  return 1;
}

// Boss timer adds +1.0s to the world's per-problem timer — boss is rigorous
// on accuracy, not chaotic on speed.
const BOSS_TIMER_BONUS_S = 1.0;
export function getProblemSecondsForWorldAndMode(worldId, mode) {
  const base = getProblemSecondsForWorld(worldId);
  return mode === 'boss' ? base + BOSS_TIMER_BONUS_S : base;
}

// ── Automaticity ───────────────────────────────────────────────────────────
// The whole point of the game is INSTANT recall, not just correctness. A fact
// is "automatic" only when answered correctly AND fast, several times running.
// FLUENCY_CAP_MS is a FIXED absolute threshold (independent of any kid's
// baseline) so "automatic" means real fluency for every kid — a slow kid's
// pace can never define mastery down. The per-kid adaptivity lives in the
// fall-speed pressure (getAdaptiveProblemSeconds), not in this definition.
// ~2500ms includes reading the problem + finding + tapping the button.
const FLUENCY_CAP_MS = 2500;
const AUTOMATIC_FAST_STREAK = 3; // consecutive correct+fast reps to certify a fact

// Adaptive per-problem fall window (seconds) derived from a kid's measured pace.
// Pushes ~10% faster than their comfort, clamped so it never plateaus slow
// (FLOOR keeps pulling toward true fluency) nor overwhelms a young kid (CEIL).
// `paceMs` is the kid's EWMA correct response time (records.getPaceMs()).
// Cold start (no pace yet) falls back to the world's designed pacing.
// SCOPED by the caller (GameScene) to Chapter 2 + Arcade only — Chapter 1 keeps
// its original hand-designed speed curve.
const ADAPTIVE_PUSH = 0.9;
const ADAPTIVE_FLOOR_S = 2.0;
const ADAPTIVE_CEIL_S = 6.0;
export function getAdaptiveProblemSeconds(worldId, mode, paceMs) {
  if (!paceMs || paceMs <= 0) return getProblemSecondsForWorldAndMode(worldId, mode);
  const target = (paceMs / 1000) * ADAPTIVE_PUSH;
  let s = Math.min(ADAPTIVE_CEIL_S, Math.max(ADAPTIVE_FLOOR_S, target));
  if (mode === 'boss') s += BOSS_TIMER_BONUS_S; // boss keeps its accuracy cushion
  return s;
}

// Chapter 1 SAFETY FLOOR (not a replacement for the hand-tuned curve). Returns the
// fall window a slower kid genuinely needs — their measured pace plus a small
// cushion — so the GameScene can take max(designedCurve, thisFloor). A capable
// kid's value here is well below the designed window, so they always get the
// original curve unchanged; a slow kid never gets a window shorter than they can
// answer in (which on W9-11's fast fixed windows would otherwise time out every
// problem and make the mastery gate unreachable). Returns 0 on cold start (no
// pace data) so the designed curve wins. Used ONLY for Chapter 1; Chapter 2 +
// Arcade still use the pushy getAdaptiveProblemSeconds.
const COMFORT_PUSH = 1.15;  // give a slower kid ~15% more than their comfy pace
const COMFORT_CEIL_S = 7.0; // never absurdly slow
export function getComfortableProblemSeconds(worldId, mode, paceMs) {
  if (!paceMs || paceMs <= 0) return 0;
  let s = Math.min(COMFORT_CEIL_S, (paceMs / 1000) * COMFORT_PUSH);
  if (mode === 'boss') s += BOSS_TIMER_BONUS_S;
  return s;
}

// Boss config — buttonCount/asteroidScale are fixed; HP scales by world
// (see getBossHpForWorld). Boss is meant to be a real fight, not a 5-tap
// formality, so even world 1 is 10 HP.
export const BOSS_CONFIG = {
  buttonCount: 6,
  asteroidScale: 3.4
};

// Boss HP per world: 10 at world 1, +2 per world up to W10 (28 HP).
// W11 is the BIG boss (Void Devourer) and gets a hard override — 4 phases.
// Stays inside the 90s boss timer at every world.
// Chapter 2 bosses get explicit HP — the `8 + worldId*2` formula would give
// world 28 a brutal 64 HP. The germ bosses sit ~10–18; Patient Zero (28) is the
// grand-finale big boss, tuned just under World 11's Void Devourer.
const CHAPTER2_BOSS_HP = {
  21: 10, 22: 11, 23: 12, 24: 13, 25: 14, 26: 15, 27: 16, 28: 46
};
// Chapter 3 "rush order" bosses. The `8 + worldId*2` formula would give the
// 30s brutal HP; the Home Ground rush orders sit ~10 to 18, and The Mountain
// (38) is the grand finale tuned just under World 11's Void Devourer / Patient
// Zero.
const CHAPTER3_BOSS_HP = {
  // Keyed by world id but the ramp belongs to the SLOT in the day, so these
  // are written in play order: 31, 32, 33, 37, 36, 34, 35, then the finale.
  31: 10, 32: 11, 33: 12, 37: 13, 36: 14, 34: 15, 35: 16, 38: 44
};
export function getBossHpForWorld(worldId) {
  if (worldId === 11) return 48;       // Void Devourer — 4 phases of ~12 hp each.
  if (worldId === 15) return 22;       // Glitch World boss (Datamosh) — mid-game spike.
  if (worldId === 17) return 40;       // King Coli — hidden superboss, just under Patient Zero.
  if (worldId === 39) return 48;       // The Science Dome: the hardest quota in the game, on backwards facts.
  if (CHAPTER2_BOSS_HP[worldId]) return CHAPTER2_BOSS_HP[worldId];
  if (CHAPTER3_BOSS_HP[worldId]) return CHAPTER3_BOSS_HP[worldId];
  return 8 + worldId * 2;
}

// Boss round length (seconds). Standard bosses get 90s. The grand-finale boss
// (Patient Zero, W28) is the single longest fight in the game at 46 HP, so it
// gets a bigger clock (120s ≈ 2.6s/hit) to stay fair for younger players —
// without it, 46 correct answers in 90s (~1.95s each) is out of reach for the
// target age. Tuning dial: lower W28's HP or raise this if playtests disagree.
export function getBossDurationForWorld(worldId) {
  if (worldId === 28) return 120;
  if (worldId === 17) return 110;   // King Coli — 40 HP superboss, needs a bigger clock.
  // The Science Dome: 48 crates of INVERSE facts. Per-crate pace (~2.7s) matches
  // King Coli's; the extra length is what makes it the hardest thing in the game,
  // rather than a speed squeeze the belt floor exists to prevent.
  if (worldId === 39) return 130;
  return 90;
}

const GLITCH_MATH_WORLDS = [6, 7, 8];

export function getGlitchProblem() {
  const worldForMath = GLITCH_MATH_WORLDS[Math.floor(Math.random() * GLITCH_MATH_WORLDS.length)];
  const base = getProblemForWorld(worldForMath, 'boss');

  const roll = Math.random();
  if (roll < 0.25) {
    return { ...base, glitchKind: 'clean', glitchChoices: null };
  }

  if (roll < 0.625) {
    const answerStr = base.answer.toString();
    const hiddenIdx = Math.floor(Math.random() * answerStr.length);
    const hiddenDigit = parseInt(answerStr[hiddenIdx], 10);
    const display = `${base.display} = ${answerStr.slice(0, hiddenIdx)}▓${answerStr.slice(hiddenIdx + 1)}`;

    const choiceSet = new Set([hiddenDigit]);
    for (let d = 1; d <= 9 && choiceSet.size < 6; d++) {
      if (hiddenDigit - d >= 0) choiceSet.add(hiddenDigit - d);
      if (choiceSet.size < 6 && hiddenDigit + d <= 9) choiceSet.add(hiddenDigit + d);
    }
    const choices = [...choiceSet].sort((a, b) => a - b);

    return {
      ...base,
      display,
      answer: hiddenDigit,
      glitchKind: 'hidden-digit',
      glitchChoices: choices
    };
  }

  const hideLeft = Math.random() < 0.5;
  const match = base.display.match(/^(\d+)\s*([×÷])\s*(\d+)$/);
  if (!match) {
    return { ...base, glitchKind: 'clean', glitchChoices: null };
  }
  const left = parseInt(match[1], 10);
  const op = match[2];
  const right = parseInt(match[3], 10);
  const hiddenOperand = hideLeft ? left : right;
  const display = hideLeft
    ? `? ${op} ${right} = ${base.answer}`
    : `${left} ${op} ? = ${base.answer}`;

  // Division-dividends can exceed 12 (e.g. 96), so the cap is generous.
  const upperBound = Math.max(12, hiddenOperand + 8);
  const choiceSet = new Set([hiddenOperand]);
  for (let d = 1; d <= 11 && choiceSet.size < 6; d++) {
    if (hiddenOperand - d >= 1) choiceSet.add(hiddenOperand - d);
    if (choiceSet.size < 6 && hiddenOperand + d <= upperBound) choiceSet.add(hiddenOperand + d);
  }
  const choices = [...choiceSet].sort((a, b) => a - b);

  return {
    ...base,
    display,
    answer: hiddenOperand,
    glitchKind: 'hidden-operand',
    glitchChoices: choices
  };
}

// Smart distractors: build 3 wrong answers that mimic real kid mistakes for
// the given problem. Always pulls from this fact family, never random.
//
// For multiplication a × b = c:
//   - off-by-one factor results: (a-1)*b, (a+1)*b, a*(b-1), a*(b+1)
//   - swapped → addition mistake: a + b
//   - one ballpark distractor: c ± small
//
// For division c ÷ d = q (where c = d*q):
//   - off-by-one quotient: q ± 1
//   - the divisor / dividend itself
//   - common confusion: c - d
//
// Returns `count` distinct ints, none equal to the correct answer, none
// negative, none implausibly far from the correct value. Default 3 for normal
// 4-button play; pass 5 for boss (6 buttons total).
export function getDistractors(problem, count = 3) {
  const { a, b, op, answer } = problem;
  const candidates = new Set();

  if (op === '×') {
    // Off-by-one factor (very common kid mistake — they recall the wrong fact).
    candidates.add((a - 1) * b);
    candidates.add((a + 1) * b);
    candidates.add(a * (b - 1));
    candidates.add(a * (b + 1));
    // Square-of-factor mistake (e.g. 7×8 → guess 49 because they thought 7×7).
    candidates.add(a * a);
    candidates.add(b * b);
    // Addition / counted-on-fingers mistake.
    candidates.add(a + b);
    // Double-the-answer / half-the-answer ballpark slips.
    candidates.add(answer + a);
    candidates.add(answer - b);
    candidates.add(answer + 1);
    candidates.add(answer - 1);
  } else {
    // Division: c ÷ d = q
    const dividend = a * b;
    const divisor = (problem.display.match(/÷\s*(\d+)/) || [])[1];
    const dNum = divisor ? parseInt(divisor, 10) : Math.max(a, b);
    const q = answer;
    // Off-by-one quotient.
    candidates.add(q - 1);
    candidates.add(q + 1);
    candidates.add(q + 2);
    // Subtract divisor from dividend instead of dividing.
    candidates.add(dividend - dNum);
    // Quotient × 2 / quotient / 2 (rough ballpark slip).
    candidates.add(q * 2);
    candidates.add(Math.max(1, Math.floor(q / 2)));
    // The divisor itself (kid froze and just typed something on the card).
    candidates.add(dNum);
  }

  // Filter to plausible values, drop duplicates and the correct answer.
  const valid = [...candidates].filter(n =>
    Number.isInteger(n) &&
    n > 0 &&
    n !== answer &&
    n <= 200          // anything beyond is implausible for 1..12 facts
  );

  // Shuffle and pick 3.
  for (let i = valid.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [valid[i], valid[j]] = [valid[j], valid[i]];
  }

  const picked = [];
  for (const v of valid) {
    if (picked.length >= count) break;
    if (!picked.includes(v)) picked.push(v);
  }

  // Fallback: if we couldn't find enough (very small facts like 1×1), pad ±n.
  let pad = 1;
  while (picked.length < count) {
    const candidate = answer + pad;
    if (candidate > 0 && candidate !== answer && !picked.includes(candidate)) {
      picked.push(candidate);
    }
    pad = pad > 0 ? -pad : -pad + 1;
    if (Math.abs(pad) > 30) break;
  }

  return picked;
}

// Generate one problem for the given mode.
// Math is no longer constrained by world — facts are sampled freely from 1..12.
// `worldId` is accepted for back-compat but only used for theming elsewhere.
//
// Fact-pool weighting:
//   - mode === 'boss': 100% weak facts (lowest accuracy first; ties broken by
//     slowest avg). Falls back to random if no factMastery data exists yet.
//   - other modes: 60% weak fact, 40% pure random. The "weak" picker pulls
//     from the bottom-third of accuracy among facts the player has actually
//     attempted (>=2 tries).
//
// Returns { display, a, b, op, answer, factKey }.
export function getProblemForWorld(_worldId, mode = 'mult', factOverride = null) {
  // Decide operation
  let op = mode;
  if (mode === 'mixed' || mode === 'boss') {
    op = Math.random() < 0.5 ? 'mult' : 'div';
  }

  let a, b;
  // factOverride (used by the Tune-Up) forces a specific fact; otherwise weight
  // toward weak facts as before.
  if (factOverride && factOverride.a) {
    a = factOverride.a;
    b = factOverride.b;
  } else {
    const useWeak = mode === 'boss' ? true : Math.random() < 0.6;
    if (useWeak) {
      const weak = progress.pickWeakFact();
      if (weak) {
        a = weak.a;
        b = weak.b;
      }
    }
  }

  if (a === undefined) {
    a = Math.floor(Math.random() * 12) + 1;
    b = Math.floor(Math.random() * 12) + 1;
  }

  const product = a * b;
  const factKey = `${Math.min(a, b)}x${Math.max(a, b)}`;

  if (op === 'mult') {
    // Random factor order
    const flip = Math.random() < 0.5;
    const left = flip ? b : a;
    const right = flip ? a : b;
    return {
      display: `${left} × ${right}`,
      a, b,
      op: '×',
      answer: product,
      factKey
    };
  }

  if (op === 'div') {
    // Division: present product ÷ divisor = quotient.
    const divisorIsA = Math.random() < 0.5;
    const divisor = divisorIsA ? a : b;
    const quotient = divisorIsA ? b : a;
    return {
      display: `${product} ÷ ${divisor}`,
      a, b,
      op: '÷',
      answer: quotient,
      factKey
    };
  }

  // Fallback: behave like multiplication.
  return {
    display: `${a} × ${b}`,
    a, b,
    op: '×',
    answer: product,
    factKey
  };
}

// One problem for the Tune-Up (spaced-repetition review). Draws from the kid's
// due/rusty facts (pickReviewFact); falls back to weak, then random. `mixed` so
// the refresh field is a varied ×/÷ mix.
export function getReviewProblem(worldId, mode = 'mixed') {
  const fact = progress.pickReviewFact();
  return getProblemForWorld(worldId, mode, fact || undefined);
}

// Wraps getProblemForWorld with a W8+ "twist" — same underlying fact, different
// presentation. Each upper world has a signature twist; W11 mixes them. Twists
// that don't fit the current operation (e.g. mirror only makes sense for ×)
// degrade to flare (visual-only) so the upper levels never look "normal."
//
// Returns the standard problem shape plus { twistKind, twistDistractors? }.
// `twistKind: null` means "no twist this spawn" (rolls below the per-world rate).
export function getTwistedProblem(worldId, mode) {
  const base = getProblemForWorld(worldId, mode);
  if (worldId < UPPER_LEVEL_CONFIG.twist.minWorldId) {
    return { ...base, twistKind: null };
  }

  const rate = UPPER_LEVEL_CONFIG.twist.rate[worldId] ?? 0;
  if (Math.random() > rate) return { ...base, twistKind: null };

  const kindForWorld = {
    8: 'flare',
    9: 'gravity',
    10: 'mirror',
    11: ['flare', 'gravity', 'mirror'][Math.floor(Math.random() * 3)],
    // Chapter 2 cycles the three signature twists so each inner world has its
    // own flavor; the grand finale (28) mixes all three like World 11. (Twists
    // that don't fit the current op degrade to flare downstream.)
    21: 'flare',
    22: 'gravity',
    23: 'mirror',
    24: 'flare',
    25: 'gravity',
    26: 'mirror',
    27: 'gravity',
    28: ['flare', 'gravity', 'mirror'][Math.floor(Math.random() * 3)],
  };
  const kind = kindForWorld[worldId] || 'flare';

  if (kind === 'flare') {
    return { ...base, twistKind: 'flare' };
  }

  if (kind === 'mirror' && base.op === '×') {
    const match = base.display.match(/^(\d+)\s*×\s*(\d+)$/);
    if (!match) return { ...base, twistKind: 'flare' };
    const swapped = `${match[2]} × ${match[1]}`;
    return { ...base, display: swapped, twistKind: 'mirror' };
  }

  if (kind === 'gravity' && base.op === '×') {
    const match = base.display.match(/^(\d+)\s*×\s*(\d+)$/);
    if (!match) return { ...base, twistKind: 'flare' };
    const left = parseInt(match[1], 10);
    const right = parseInt(match[2], 10);
    const product = base.answer;
    const hideLeft = Math.random() < 0.5;
    const missingFactor = hideLeft ? left : right;
    const visibleFactor = hideLeft ? right : left;
    const display = hideLeft
      ? `? × ${right} = ${product}`
      : `${left} × ? = ${product}`;
    return {
      ...base,
      display,
      answer: missingFactor,
      twistKind: 'gravity',
      twistDistractors: getFactorDistractors(product, missingFactor, visibleFactor),
    };
  }

  // Twist doesn't fit the operation (e.g. mirror/gravity on ÷); degrade
  // to flare so the asteroid still LOOKS special.
  return { ...base, twistKind: 'flare' };
}

// One INVERSE problem for The Science Dome (W39). Each crate is a puzzle with a
// number missing, so instead of "7 × 8" telling you the bin, the crate says
// `? × 8 = 56` and you work backwards to 7.
//
// Built on top of getProblemForWorld(..., 'boss'), so it inherits the 100%-weak-
// fact sampling and, critically, the SAME factKey: a Science Dome answer records
// against the same fact the rest of the game tracks, rather than forking mastery
// data into a parallel "inverse" pool. Whether the base draw came back as × or ÷
// is irrelevant: both describe the fact a×b, and this always presents it as the
// one question the room asks, "which factor is missing".
//
// The answer is always a factor (1..12), never a product, so it stays inside the
// keypad's digit cap and the dock labels stay short.
export function getInverseProblem(worldId, factOverride = null) {
  const base = getProblemForWorld(worldId, 'boss', factOverride);
  const { a, b } = base;
  const product = a * b;
  const hideLeft = Math.random() < 0.5;
  const missingFactor = hideLeft ? a : b;
  const visibleFactor = hideLeft ? b : a;
  return {
    ...base,
    display: hideLeft ? `? × ${visibleFactor} = ${product}` : `${visibleFactor} × ? = ${product}`,
    op: '×',
    answer: missingFactor,
    inverse: true,
    distractors: getFactorDistractors(product, missingFactor, visibleFactor)
  };
}

// Distractors for gravity-twist problems where the answer is the missing
// factor. Pulls other factors of the product, off-by-one slips, and the
// visible factor itself (kid trap: "must be the number I can see").
export function getFactorDistractors(product, missingFactor, visibleFactor, count = 3) {
  const candidates = new Set();
  candidates.add(missingFactor - 1);
  candidates.add(missingFactor + 1);
  candidates.add(missingFactor + 2);
  candidates.add(missingFactor - 2);
  candidates.add(visibleFactor);
  for (let f = 1; f <= 12; f++) {
    if (product % f === 0 && f !== missingFactor) candidates.add(f);
  }

  const valid = [...candidates].filter(n =>
    Number.isInteger(n) &&
    n > 0 &&
    n !== missingFactor &&
    n <= 144
  );

  for (let i = valid.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [valid[i], valid[j]] = [valid[j], valid[i]];
  }

  const picked = [];
  for (const v of valid) {
    if (picked.length >= count) break;
    if (!picked.includes(v)) picked.push(v);
  }

  let pad = 1;
  while (picked.length < count) {
    const cand = missingFactor + pad;
    if (cand > 0 && cand !== missingFactor && !picked.includes(cand)) picked.push(cand);
    pad = pad > 0 ? -pad : -pad + 1;
    if (Math.abs(pad) > 20) break;
  }
  return picked;
}

// Player progress manager
class PlayerProgress {
  constructor() {
    this.load();
  }

  load() {
    try {
      const saved = localStorage.getItem('cosmicMathProgress');
      if (saved) {
        const data = JSON.parse(saved);
        this.worldProgress = this.mergeWorldProgress(data.worldProgress);
        this.factMastery = data.factMastery || {};
        this.totalStars = data.totalStars || 0;
        this.currentWorld = data.currentWorld || 1;
        this.companion = { ...this.getDefaultCompanion(), ...(data.companion || {}) };
        this.economy = { ...this.getDefaultEconomy(), ...(data.economy || {}) };
        this.ship = this.mergeShip(data.ship);
        this.cosmetics = this.mergeCosmetics(data.cosmetics);
        // Act 2 / hidden / arcade additions — backward-compatible defaults.
        this.endingSeen = !!data.endingSeen;
        this.justClearedWorld = data.justClearedWorld || null;
        // Seed every hidden world id so the shape is complete on load (15/16 Ch1,
        // 17/18 Ch2, 19/39 Ch3). Absent keys already read false via isHiddenWorld*,
        // but listing them keeps this the one place the roster is declared. 20 is
        // the retired Night Shift: still seeded so a kid who found or cleared it
        // keeps those flags. The Science Dome (39) starts undiscovered for everyone.
        this.hiddenWorldDiscovered = { 15: false, 16: false, 17: false, 18: false, 19: false, 20: false, 39: false, ...(data.hiddenWorldDiscovered || {}) };
        this.hiddenWorldCleared = { 15: false, 16: false, 17: false, 18: false, 19: false, 20: false, 39: false, ...(data.hiddenWorldCleared || {}) };
        this.arcade = { endlessBest: 0, bossRushBest: null, ...(data.arcade || {}) };
        this.petHelperUsed = !!data.petHelperUsed; // big-boss helper consumed
        this.dadNoteState = { lastClaimDate: null, nextIndex: 0, ...(data.dadNoteState || {}) };
        this.recessNoteState = { lastClaimDate: null, nextIndex: 0, ...(data.recessNoteState || {}) };
        // Legacy per-board note state. Superseded by dadNotePoolState below (the
        // three boards now share one pool); loaded so old saves still parse.
        this.hotPotNoteState = { lastClaimDate: null, nextIndex: 0, ...(data.hotPotNoteState || {}) };
        // Shared daily deal for all three Dad's note boards: one deck, three
        // notes pinned per day, one +10 each when opened. See getDailyNoteForBoard.
        this.dadNotePoolState = { dealDate: null, deck: [], deckN: 0, assigned: null, claimed: {}, ...(data.dadNotePoolState || {}) };
        this.tutorialSeen = !!data.tutorialSeen;
        this.cosmicHintSeen = !!data.cosmicHintSeen;
        // Chapter 2 ("Inner Space") additions — backward-compatible defaults so
        // existing saves (endingSeen, Cosmic pet) are untouched. currentChapter
        // is just which map the player is viewing; finaleSeen gates the grand
        // finale at World 28 (separate from endingSeen, which gates World 11's
        // Cosmic/Arcade unlock and must NOT be reset).
        this.currentChapter = data.currentChapter || 1;
        this.finaleSeen = !!data.finaleSeen;
        // Chapter 3 ("Home Ground") grand finale: World 38 (The Mountain).
        // Separate from finaleSeen (W28) so the W28 grand finale still plays once
        // for players who reached it before Ch3 existed.
        this.finale3Seen = !!data.finale3Seen;
        // Which Chapter 3 day-order this save was written under. Absent means
        // rev 1, which is what triggers the one-time migration below.
        this.ch3OrderRev = data.ch3OrderRev || 1;
        // One-shot arrival card that frames Chapter 3 ("the fighting is over, this
        // is home"). Shown once, the first time the player surfaces onto the
        // Chapter 3 map, then never again (it is a premise beat, not a reminder).
        // makerWelcomeSeen gated the first version of that card and stays in
        // saves, unused, so nothing is renamed under existing kids.
        // homeGroundWelcomeSeen gates the rewritten Home Ground card, so a kid who
        // already entered Chapter 3 sees the new premise exactly once.
        this.makerWelcomeSeen = !!data.makerWelcomeSeen;
        this.homeGroundWelcomeSeen = !!data.homeGroundWelcomeSeen;
        // Owner-only pilot: route the Ch1/Ch2 "mixed" level into the Conveyor
        // (Pack & Go) mode. Per-browser (localStorage), default OFF.
        this.conveyorMixedEnabled = !!data.conveyorMixedEnabled;
        if (this.currentWorld >= 12 && this.currentWorld <= 14) this.currentWorld = 11;
        // Runs BEFORE checkWorldUnlock so the frontier is re-derived from the
        // migrated flags rather than the stale ones.
        const ch3Migrated = this.migrateChapter3Order();
        this.checkWorldUnlock(null);
        if (ch3Migrated) this.save();
      } else {
        this.reset();
      }
    } catch (e) {
      this.reset();
    }
  }

  reset() {
    this.worldProgress = this.getDefaultWorldProgress();
    this.factMastery = {};
    this.totalStars = 0;
    this.currentWorld = 1;
    this.companion = this.getDefaultCompanion();
    this.economy = this.getDefaultEconomy();
    this.ship = this.getDefaultShip();
    this.cosmetics = this.getDefaultCosmetics();
    this.endingSeen = false;
    this.justClearedWorld = null;
    this.hiddenWorldDiscovered = { 15: false, 16: false, 17: false, 18: false, 19: false, 20: false, 39: false };
    this.hiddenWorldCleared = { 15: false, 16: false, 17: false, 18: false, 19: false, 20: false, 39: false };
    this.arcade = { endlessBest: 0, bossRushBest: null };
    this.petHelperUsed = false;
    this.dadNoteState = { lastClaimDate: null, nextIndex: 0 };
    this.recessNoteState = { lastClaimDate: null, nextIndex: 0 };
    this.hotPotNoteState = { lastClaimDate: null, nextIndex: 0 };
    this.dadNotePoolState = { dealDate: null, deck: [], deckN: 0, assigned: null, claimed: {} };
    this.tutorialSeen = false;
    this.cosmicHintSeen = false;
    this.currentChapter = 1;
    this.finaleSeen = false;
    this.finale3Seen = false;
    this.ch3OrderRev = CH3_ORDER_REV;   // a new save is born on the current day order
    this.makerWelcomeSeen = false;
    this.homeGroundWelcomeSeen = false;
    this.conveyorMixedEnabled = false;
    this.save();
  }

  // Wipe ALL game data (and the companion picker). Wired to the Reset button
  // in the parent dashboard. Keeps the parent PIN.
  resetAll() {
    try {
      localStorage.removeItem('cosmicMathProgress');
      localStorage.removeItem('cosmicMathRecords');
      localStorage.removeItem('cosmicMathAchievements');
    } catch (e) {}
    this.reset();
  }

  // Lifetime answer totals derived from factMastery — used by evolution gates.
  getLifetimeTotals() {
    let correct = 0;
    let total = 0;
    for (const fact of Object.values(this.factMastery)) {
      if (!fact) continue;
      correct += fact.correct || 0;
      total += fact.total || 0;
    }
    return {
      correct,
      total,
      accuracy: total > 0 ? correct / total : 0
    };
  }

  getWorldsClearedCount() {
    let count = 0;
    for (const w of getActiveWorlds()) {
      if (this.isWorldFullyCleared(w.id)) count++;
    }
    return count;
  }

  getDefaultCompanion() {
    return {
      speciesId: null,
      stage: 'egg',
      cosmicForm: false,
      displayStage: null,
      // Trophy shelf: pets the player has fully raised. Each entry is
      // { speciesId, retiredAt }. Read-only — not re-equippable.
      completed: []
    };
  }

  getDefaultEconomy() {
    return {
      stardust: 0,
      lastDailyBonusDate: null    // 'YYYY-MM-DD' — first game of day grants +5
    };
  }

  getDefaultShip() {
    return {
      parts: {
        hull: 'hull_default',
        wings: 'wings_default',
        paint: 'paint_default',
        addon: null,
        pattern: 'pattern_none',
        trail: 'trail_default_flame'
      },
      ownedParts: [
        'hull_default', 'wings_default', 'paint_default',
        'pattern_none', 'trail_default_flame'
      ]
    };
  }

  getDefaultCosmetics() {
    return {
      pet: { hat: null, accessory: null, aura: 'aura_none' },
      ownedIds: ['aura_none']
    };
  }

  mergeShip(saved) {
    const def = this.getDefaultShip();
    if (!saved) return def;
    const ownedParts = Array.isArray(saved.ownedParts) ? [...saved.ownedParts] : [...def.ownedParts];
    // Migration: ensure default pattern + trail are owned for old saves
    for (const id of ['pattern_none', 'trail_default_flame']) {
      if (!ownedParts.includes(id)) ownedParts.push(id);
    }
    const parts = { ...def.parts, ...(saved.parts || {}) };
    // Patterns are now folded into paints. Reset any non-default pattern slot
    // to pattern_none so the legacy slot doesn't paint over the new system.
    if (parts.pattern && parts.pattern !== 'pattern_none') {
      parts.pattern = 'pattern_none';
    }
    // Migration: decal slot → addon slot.
    const DECAL_TO_ADDON = {
      decal_star: 'addon_antenna',
      decal_heart: 'addon_spoiler',
      decal_crown: 'addon_periscope',
      decal_comet: 'addon_cannons',
      decal_compass: 'addon_satellite',
      decal_phoenix: 'addon_phoenix_crest',
      decal_galaxy_swirl: 'addon_galaxy_orb',
      decal_dragon: 'addon_dragon_horns',
      decal_glitch: 'addon_glitch_module'
    };
    for (let i = ownedParts.length - 1; i >= 0; i--) {
      const id = ownedParts[i];
      if (DECAL_TO_ADDON[id]) {
        const addonId = DECAL_TO_ADDON[id];
        if (!ownedParts.includes(addonId)) ownedParts.push(addonId);
        ownedParts.splice(i, 1);
      }
    }
    if (parts.decal && DECAL_TO_ADDON[parts.decal]) {
      parts.addon = DECAL_TO_ADDON[parts.decal];
    }
    delete parts.decal;
    if (!('addon' in parts)) parts.addon = null;
    // Migration: retired hull/trail ids whose art was removed. An unknown hull
    // id silently renders the default silhouette (ShipRenderer falls through to
    // HULL_STANDARD), so reset the equipped slot and drop the dead ids from
    // owned — same treatment retired cosmetics get in mergeCosmetics.
    const RETIRED_HULLS = new Set(['hull_vortex']);
    const RETIRED_TRAILS = new Set(['trail_starlight']);
    if (RETIRED_HULLS.has(parts.hull)) parts.hull = 'hull_default';
    if (RETIRED_TRAILS.has(parts.trail)) parts.trail = 'trail_default_flame';
    for (let i = ownedParts.length - 1; i >= 0; i--) {
      if (RETIRED_HULLS.has(ownedParts[i]) || RETIRED_TRAILS.has(ownedParts[i])) {
        ownedParts.splice(i, 1);
      }
    }
    return { parts, ownedParts };
  }

  mergeCosmetics(saved) {
    const def = this.getDefaultCosmetics();
    if (!saved) return def;
    const ownedIds = Array.isArray(saved.ownedIds) ? [...saved.ownedIds] : [];
    if (!ownedIds.includes('aura_none')) ownedIds.push('aura_none');
    const pet = { hat: null, accessory: null, aura: 'aura_none', ...(saved.pet || {}) };
    delete pet.outfit;
    if (!pet.aura) pet.aura = 'aura_none';
    // Migration: food hat slot → accessory slot.
    const FOOD_IDS = new Set([
      'hat_strawberry','hat_banana','hat_avocado','hat_pizza',
      'hat_donut','hat_onigiri','hat_taiyaki','hat_sushi'
    ]);
    if (FOOD_IDS.has(pet.hat)) {
      if (!pet.accessory) pet.accessory = pet.hat;
      pet.hat = null;
    }
    // Migration: drop retired wearables.
    const RETIRED_IDS = new Set([
      'hat_propeller','hat_astronaut','hat_wizard',
      'hat_starhat','hat_crown_stars','hat_galaxy_helm',
      'acc_jetpack','acc_antenna','acc_starhalo',
      'acc_wings','acc_cape','acc_starbow','acc_phoenix_cape'
    ]);
    for (let i = ownedIds.length - 1; i >= 0; i--) {
      if (RETIRED_IDS.has(ownedIds[i])) ownedIds.splice(i, 1);
    }
    if (RETIRED_IDS.has(pet.hat)) pet.hat = null;
    if (RETIRED_IDS.has(pet.accessory)) pet.accessory = null;
    return { pet, ownedIds };
  }

  mergeWorldProgress(saved) {
    const defaults = this.getDefaultWorldProgress();
    if (!saved) return defaults;
    for (const w of WORLDS) {
      const s = saved[w.id];
      if (s) {
        // Back-fill levelMastered for LEGACY saves (those predating this field):
        // any level already cleared for >=1 star under the old touch-to-clear
        // rules counts as mastered, so tightening the gate never RE-LOCKS access
        // a kid already had — notably a boss they'd unlocked but not yet beaten.
        // A NEW save always serializes levelMastered (at least {}), so s.levelMastered
        // === undefined reliably means "legacy", and this back-fill fires once.
        const levelStars = s.levelStars || {};
        let levelMastered = s.levelMastered;
        if (levelMastered === undefined) {
          levelMastered = {};
          for (const k of Object.keys(levelStars)) {
            if (levelStars[k] > 0) levelMastered[k] = true;
          }
        }
        defaults[w.id] = {
          unlocked: s.unlocked || defaults[w.id].unlocked,
          levelsCompleted: s.levelsCompleted || 0,
          starsEarned: s.starsEarned || 0,
          levelStars,
          levelMastered
        };
      }
    }
    // A retired world (The Night Shift, 20) is no longer in WORLDS, so the loop
    // above would drop it. Carry its entry through exactly as saved: its stars
    // are already in totalStars, and a later devClearAllWorlds recount (which
    // sums every entry) must still find them.
    for (const id of RETIRED_WORLD_IDS) {
      const s = saved[id];
      if (s && typeof s === 'object') defaults[id] = s;
    }
    return defaults;
  }

  getDefaultWorldProgress() {
    const progress = {};
    for (const world of WORLDS) {
      progress[world.id] = {
        unlocked: world.id === 1,
        levelsCompleted: 0,
        starsEarned: 0,
        levelStars: {},   // levelNum: stars (1-3) — cosmetic best result
        levelMastered: {} // levelNum: true — the campaign-advance gate
      };
    }
    return progress;
  }

  save() {
    try {
      localStorage.setItem('cosmicMathProgress', JSON.stringify({
        worldProgress: this.worldProgress,
        factMastery: this.factMastery,
        totalStars: this.totalStars,
        currentWorld: this.currentWorld,
        companion: this.companion,
        economy: this.economy,
        ship: this.ship,
        cosmetics: this.cosmetics,
        endingSeen: this.endingSeen,
        justClearedWorld: this.justClearedWorld,
        hiddenWorldDiscovered: this.hiddenWorldDiscovered,
        hiddenWorldCleared: this.hiddenWorldCleared,
        arcade: this.arcade,
        petHelperUsed: this.petHelperUsed,
        dadNoteState: this.dadNoteState,
        recessNoteState: this.recessNoteState,
        hotPotNoteState: this.hotPotNoteState,
        dadNotePoolState: this.dadNotePoolState,
        tutorialSeen: this.tutorialSeen,
        cosmicHintSeen: this.cosmicHintSeen,
        currentChapter: this.currentChapter,
        finaleSeen: this.finaleSeen,
        finale3Seen: this.finale3Seen,
        ch3OrderRev: this.ch3OrderRev,
        makerWelcomeSeen: this.makerWelcomeSeen,
        homeGroundWelcomeSeen: this.homeGroundWelcomeSeen,
        conveyorMixedEnabled: this.conveyorMixedEnabled
      }));
    } catch (e) {
      console.warn('Could not save progress');
    }
  }

  // Mark the ending sequence as seen (so it doesn't auto-replay next final-boss win).
  markEndingSeen() {
    if (this.endingSeen) return;
    this.endingSeen = true;
    this.save();
  }

  // Force-replay the ending on next final-boss win (dev menu only).
  resetEndingSeen() {
    if (!this.endingSeen) return;
    this.endingSeen = false;
    this.save();
  }

  // Switch which chapter map the player is viewing. Driven by the warp gate
  // (→ chapter 2) and the return gate (→ chapter 1) on the world map.
  setCurrentChapter(chapter) {
    if (this.currentChapter === chapter) return;
    this.currentChapter = chapter;
    this.save();
  }

  // Mark the grand finale (World 28) as seen, grant its rewards, and persist —
  // atomically. Called EARLY (before the long credits roll, mirroring
  // markEndingSeen) so closing the tab mid-finale can't strand the reward.
  // Returns true on the first call. Idempotent.
  markFinaleSeen() {
    const firstTime = !this.finaleSeen;
    this.finaleSeen = true;
    this.grantFinaleRewards();
    this.save();
    return firstTime;
  }

  // Force-replay the finale on next World-28 win (dev menu only).
  resetFinaleSeen() {
    if (!this.finaleSeen) return;
    this.finaleSeen = false;
    this.save();
  }

  // Mark the Chapter 3 grand finale (World 38, The Mountain) as seen and
  // persist, atomically and EARLY (before the homecoming credits roll) so closing
  // the tab mid-cinematic cannot strand the flag. Returns true on the first call.
  // Idempotent. No trophy to grant (Home Ground ships no new reward system), so
  // unlike markFinaleSeen this only sets the flag.
  markFinale3Seen() {
    const firstTime = !this.finale3Seen;
    this.finale3Seen = true;
    this.save();
    return firstTime;
  }

  // Force-replay the Chapter 3 finale on next World-38 win (dev menu only).
  resetFinale3Seen() {
    if (!this.finale3Seen) return;
    this.finale3Seen = false;
    this.save();
  }

  // Mark the Chapter 3 ("Home Ground") arrival card as seen and persist. The
  // older makerWelcomeSeen flag never had a marker (WorldMapScene set it inline
  // and saved); this one follows markTutorialSeen's shape so the scene only
  // reads the flag and calls this. Idempotent.
  markHomeGroundWelcomeSeen() {
    if (this.homeGroundWelcomeSeen) return;
    this.homeGroundWelcomeSeen = true;
    this.save();
  }

  // Owner-only pilot toggle (Dad's Menu) for routing the Ch1/Ch2 "mixed" level
  // into the Conveyor "Pack & Go" mode. Routing is computed live from this flag
  // (see usesConveyorScene), so there's nothing to recompute — just persist.
  setConveyorMixedEnabled(on) {
    this.conveyorMixedEnabled = !!on;
    this.save();
  }

  // Idempotently grant the Chapter 2 finale rewards: the signature Nanocraft
  // hull (auto-equipped) + the Bioluminescent aura. Mutates the save shape
  // directly rather than calling ShipManager/CosmeticManager — those modules
  // import `progress` from here, so calling back into them would be circular.
  // Caller is responsible for save() (markFinaleSeen does it).
  grantFinaleRewards() {
    const ship = this.ship;
    if (ship && Array.isArray(ship.ownedParts)) {
      if (!ship.ownedParts.includes('hull_nanocraft')) {
        ship.ownedParts.push('hull_nanocraft');
        if (ship.parts) ship.parts.hull = 'hull_nanocraft'; // auto-equip the trophy
      }
    }
    const cos = this.cosmetics;
    if (cos && Array.isArray(cos.ownedIds) && !cos.ownedIds.includes('aura_bioluminescent')) {
      cos.ownedIds.push('aura_bioluminescent');
    }
  }

  // Mark a hidden world as discovered (warp asteroid was solved). UI updates.
  discoverHiddenWorld(worldId) {
    if (this.hiddenWorldDiscovered[worldId]) return false;
    this.hiddenWorldDiscovered[worldId] = true;
    this.save();
    return true;
  }

  // Mark a hidden world as cleared (after its boss / exploration completes).
  clearHiddenWorld(worldId) {
    if (this.hiddenWorldCleared[worldId]) return;
    this.hiddenWorldCleared[worldId] = true;
    this.grantSecretReward(worldId);
    this.save();
  }

  // Idempotently grant a hidden world's signature reward on first clear. King
  // Coli (17) drops the exclusive Aegis hull (auto-equipped). Exploration
  // secrets (e.g. Recess, 18) grant their cosmetic in-scene via CosmeticManager.
  // Mutates the save shape directly to avoid a circular import of ShipManager.
  grantSecretReward(worldId) {
    if (worldId === 17) {
      const ship = this.ship;
      if (ship && Array.isArray(ship.ownedParts) && !ship.ownedParts.includes('hull_aegis')) {
        ship.ownedParts.push('hull_aegis');
        if (ship.parts) ship.parts.hull = 'hull_aegis'; // auto-equip the trophy
      }
    }
  }

  isHiddenWorldDiscovered(worldId) {
    return !!this.hiddenWorldDiscovered?.[worldId];
  }

  isHiddenWorldCleared(worldId) {
    return !!this.hiddenWorldCleared?.[worldId];
  }

  // Set after a world is cleared by a boss win; consumed by WorldMapScene to
  // auto-advance the ship one node. Null when nothing is pending.
  setJustClearedWorld(worldId) {
    if (this.justClearedWorld === worldId) return;
    this.justClearedWorld = worldId;
    this.save();
  }

  consumeJustClearedWorld() {
    const v = this.justClearedWorld;
    if (v === null) return null;
    this.justClearedWorld = null;
    this.save();
    return v;
  }

  // Force-unlock every visible world (dev menu only). NOTE: this only flips the
  // `unlocked` flag — it does NOT clear Universe's End (World 11), so the Inner
  // Space wormhole stays hidden even though Bloodstream reads unlocked. To
  // exercise the wormhole/chapter-warp, use "Clear ALL levels" (devClearAllWorlds)
  // instead, which 3-stars every world and reveals the gate.
  unlockAllVisibleWorlds() {
    let changed = false;
    for (const w of VISIBLE_WORLDS) {
      const wp = this.worldProgress[w.id];
      if (wp && !wp.unlocked) {
        wp.unlocked = true;
        changed = true;
      }
    }
    if (changed) this.save();
  }

  // Dev convenience: fully 3-star every visible world in BOTH chapters. Because
  // World 11 (Universe's End) ends up cleared, the Inner Space wormhole appears;
  // because the Chapter 2 worlds get cleared, the whole Chapter 2 map opens up.
  // Leaves the narrative flags (endingSeen/finaleSeen) alone — use the replay
  // buttons for the cinematics.
  devClearAllWorlds() {
    for (const w of VISIBLE_WORLDS) {
      const wp = this.worldProgress[w.id];
      if (!wp) continue;
      const stars = {};
      const mastered = {};
      for (let lvl = 1; lvl <= w.levelsRequired; lvl++) { stars[lvl] = 3; mastered[lvl] = true; }
      wp.levelStars = stars;
      wp.levelMastered = mastered;
      wp.levelsCompleted = w.levelsRequired;
      wp.starsEarned = w.levelsRequired * 3;
      wp.unlocked = true;
    }
    // Rebuild the star counter from scratch so the header chip stays consistent.
    let total = 0;
    for (const id in this.worldProgress) total += this.worldProgress[id].starsEarned || 0;
    this.totalStars = total;
    this.checkWorldUnlock(null);
    this.save();
  }

  // Today's note for one of the three Dad's note boards (garage, playground,
  // hotpot). Returns { message, index, unread }. Looking a note up never pays:
  // the board's daily stardust is paid when the kid opens it, through
  // claimDailyNoteReward, and `unread` says whether that is still to come.
  //
  // All three boards share ONE pool and ONE shuffled deck (src/content/dadNotes.js).
  // Each morning the deck deals three DIFFERENT notes and pins one to each board
  // for the rest of the day, so:
  //   • visiting all three rooms in a day gives three new notes, never the same
  //     line repeated — which a per-board deck could not guarantee;
  //   • every note in the pool is still seen exactly once before any repeat;
  //   • each board pays its own +10 once a day, the first time its note is
  //     opened (30/day for all three).
  // Re-entering a room later the same day re-shows that board's pinned note.
  // The deck reshuffles when it empties or when the pool size changes (i.e. J
  // edited a notes file), which re-deals the day.
  getDailyNoteForBoard(notes, boardKey) {
    if (!notes || notes.length === 0) return { message: '', index: 0, unread: false };
    // Local calendar date (YYYY-MM-DD) — must match EconomyManager.todayString so
    // the note and its daily stardust reset together at LOCAL midnight.
    const d = new Date();
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const N = notes.length;
    let state = this.dadNotePoolState || {};

    // New day (or the pool changed size) → deal one fresh note per board.
    if (state.dealDate !== today || state.deckN !== N || !state.assigned) {
      let deck = Array.isArray(state.deck) ? state.deck.slice() : [];
      let lastIndex = state.lastIndex;
      const assigned = {};
      for (const key of DAD_NOTE_BOARDS) {
        // Reshuffle on empty, avoiding an immediate repeat across the boundary.
        if (deck.length === 0) deck = this._shuffledNoteDeck(N, lastIndex);
        lastIndex = deck.shift();
        assigned[key] = lastIndex;
      }
      this.dadNotePoolState = { dealDate: today, deck, deckN: N, assigned, claimed: {}, lastIndex };
      this.save();
      state = this.dadNotePoolState;
    }

    const raw = state.assigned[boardKey];
    const index = Number.isInteger(raw) ? ((raw % N) + N) % N : 0;
    return { message: notes[index], index, unread: !state.claimed?.[boardKey] };
  }

  // The kid opened today's note on this board. True the first time per board
  // per day, which is when the note pays its stardust; false after that.
  claimDailyNoteReward(boardKey) {
    const state = this.dadNotePoolState;
    if (!state?.assigned || state.claimed?.[boardKey]) return false;
    state.claimed = { ...(state.claimed || {}), [boardKey]: true };
    this.save();
    return true;
  }

  // LEGACY per-board dealer, superseded by getDailyNoteForBoard above (the
  // three boards now share one pool). Kept so an old save's per-board state and
  // any straggling caller still behave; safe to delete once nothing calls it.
  claimDailyDadNoteIfDue(notes, stateKey = 'dadNoteState') {
    if (!notes || notes.length === 0) return { isNewDay: false, message: '', index: 0 };
    // Local calendar date (YYYY-MM-DD) — must match EconomyManager.todayString so
    // the note and its daily stardust reset together at LOCAL midnight. Using UTC
    // here rolled the note over hours early/late for non-UTC players.
    const d = new Date();
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const N = notes.length;
    const state = this[stateKey] || {};
    const isNewDay = state.lastClaimDate !== today;

    if (!isNewDay) {
      // Same day — re-show the note already claimed today. (nextIndex is the
      // legacy sequential field; honored here so a same-day upgrade keeps
      // showing the note the kid already saw.)
      let index = 0;
      if (Number.isInteger(state.lastIndex)) index = ((state.lastIndex % N) + N) % N;
      else if (Number.isInteger(state.nextIndex)) index = (((state.nextIndex - 1) % N) + N) % N;
      return { isNewDay: false, message: notes[index], index };
    }

    // New day: deal the next index off a shuffled deck. Rebuild + reshuffle when
    // the deck is missing/exhausted or the notes list changed length, so every
    // note is seen once per cycle in a fresh random order. The reshuffle avoids
    // dealing yesterday's note first (no back-to-back repeat across cycles).
    let deck = Array.isArray(state.deck) ? state.deck.slice() : [];
    if (deck.length === 0 || state.deckN !== N) {
      deck = this._shuffledNoteDeck(N, state.lastIndex);
    }
    const index = deck.shift();
    this[stateKey] = { lastClaimDate: today, deck, deckN: N, lastIndex: index };
    this.save();
    return { isNewDay: true, message: notes[index], index };
  }

  // Fisher-Yates shuffle of [0..N). When `avoidFirst` is a valid index, makes
  // sure the deck doesn't start with it (prevents the same note two days in a
  // row across a deck boundary).
  _shuffledNoteDeck(N, avoidFirst) {
    const deck = Array.from({ length: N }, (_, i) => i);
    for (let i = N - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    if (N > 1 && deck[0] === avoidFirst) {
      [deck[0], deck[1]] = [deck[1], deck[0]];
    }
    return deck;
  }

  markTutorialSeen() {
    if (this.tutorialSeen) return;
    this.tutorialSeen = true;
    this.save();
  }

  markCosmicHintSeen() {
    if (this.cosmicHintSeen) return;
    this.cosmicHintSeen = true;
    this.save();
  }

  // Endless mode best (60s timed sprint score).
  recordEndlessScore(score) {
    if (score > (this.arcade.endlessBest || 0)) {
      this.arcade.endlessBest = score;
      this.save();
      return true;
    }
    return false;
  }

  // Boss Rush best (lower time + higher accuracy is better — caller decides).
  recordBossRushResult({ won, timeMs, correct, total }) {
    const accuracy = total > 0 ? correct / total : 0;
    const prev = this.arcade.bossRushBest;
    // Only a WIN can be a "best". A first-ever run that was a loss must NOT be
    // stored (otherwise `!prev` would record the defeat and flash "NEW BEST!").
    const isBest = won && (!prev || !prev.won || accuracy > prev.accuracy
      || (accuracy === prev.accuracy && timeMs < prev.timeMs));
    if (isBest) {
      this.arcade.bossRushBest = { won, timeMs, correct, total, accuracy };
      this.save();
      return true;
    }
    return false;
  }

  // Record a fact attempt with spaced repetition (Section 4.3) + speed-based
  // automaticity. `elapsedMs` is the kid's response time (from GameScene); pass
  // null/undefined when timing isn't available (the speed fields then hold).
  recordFactAttempt(a, b, correct, elapsedMs = null) {
    const key = `${Math.min(a, b)}x${Math.max(a, b)}`;
    if (!this.factMastery[key]) {
      this.factMastery[key] = {
        correct: 0,
        total: 0,
        lastSeen: Date.now(),
        interval: 0,        // Days until next review (0 = immediate)
        nextReview: Date.now(), // When fact is due
        streak: 0,          // Consecutive correct answers
        recentMs: 0,        // EWMA of correct response times (automaticity)
        fastStreak: 0,      // Consecutive correct+fast (< fluency cap) answers
        automatic: false    // True once fastStreak reaches AUTOMATIC_FAST_STREAK
      };
    }

    const fact = this.factMastery[key];

    // Ensure all fields exist (for old save data migration)
    if (fact.streak === undefined) fact.streak = 0;
    if (fact.interval === undefined) fact.interval = 0;
    if (fact.nextReview === undefined) fact.nextReview = Date.now();
    if (fact.recentMs === undefined) fact.recentMs = 0;
    if (fact.fastStreak === undefined) fact.fastStreak = 0;
    if (fact.automatic === undefined) fact.automatic = false;

    fact.total++;
    fact.lastSeen = Date.now();

    if (correct) {
      fact.correct++;
      fact.streak++;
      // Extend interval based on streak (modified SM-2)
      // Intervals: immediate -> same session -> 1 day -> 3 days -> 7 days -> 14 days
      const intervals = [0, 0, 1, 3, 7, 14, 30];
      const intervalIndex = Math.min(fact.streak, intervals.length - 1);
      fact.interval = intervals[intervalIndex];
      fact.nextReview = Date.now() + (fact.interval * 24 * 60 * 60 * 1000);

      // Speed-based automaticity. Only correct answers carry timing signal —
      // a wrong answer's elapsed time reflects confusion, not recall speed.
      if (typeof elapsedMs === 'number' && elapsedMs > 0) {
        fact.recentMs = fact.recentMs > 0
          ? fact.recentMs * 0.7 + elapsedMs * 0.3
          : elapsedMs;
        if (elapsedMs <= FLUENCY_CAP_MS) fact.fastStreak++;
        else fact.fastStreak = 0; // correct but slow breaks the fast streak
        fact.automatic = fact.fastStreak >= AUTOMATIC_FAST_STREAK;
      }
    } else {
      // Wrong answer - reset to immediate review and de-certify automaticity.
      fact.streak = 0;
      fact.interval = 0;
      fact.nextReview = Date.now(); // Due immediately
      fact.fastStreak = 0;
      fact.automatic = false;
    }

    this.save();
  }

  // Get mastery percentage for a table (partners 1..12)
  getTableMastery(table) {
    let correct = 0;
    let total = 0;

    for (let i = 1; i <= 12; i++) {
      const key = `${Math.min(table, i)}x${Math.max(table, i)}`;
      if (this.factMastery[key]) {
        correct += this.factMastery[key].correct;
        total += this.factMastery[key].total;
      }
    }

    return total > 0 ? Math.round((correct / total) * 100) : 0;
  }

  // Complete a level. `mastered` (see isRoundMastered) is what actually advances
  // the campaign — stars are only the cosmetic best-result record.
  completeLevel(worldId, levelNum, stars, mastered = false) {
    const wp = this.worldProgress[worldId];
    const prevStars = wp.levelStars[levelNum] || 0;

    // Only update if better
    if (stars > prevStars) {
      wp.levelStars[levelNum] = stars;
      wp.starsEarned += (stars - prevStars);
      this.totalStars += (stars - prevStars);
    }

    // Mastery is additive and sticky — once a level is mastered it stays so,
    // so this gate can never strip a kid of access they've already earned.
    if (!wp.levelMastered) wp.levelMastered = {};
    if (mastered) wp.levelMastered[levelNum] = true;

    // Update levels completed
    wp.levelsCompleted = Object.keys(wp.levelStars).length;

    // Check if next world should unlock
    this.checkWorldUnlock(worldId);

    this.save();
  }

  // One-time Chapter 3 re-order migration. `unlocked` is sticky, so a save
  // written under the old day order can carry an unlocked stop that now sits
  // late in the array, and the map's frontier (the LAST unlocked index opens
  // every node before it) would hand a kid stops they never earned. Fix, once:
  // drop `unlocked` on any Chapter 3 stop the kid never actually played, then
  // let checkWorldUnlock re-derive the chain under the new order. A stop with
  // even one star is left alone, so nothing anyone reached is taken away.
  migrateChapter3Order() {
    if (this.ch3OrderRev >= CH3_ORDER_REV) return false;
    for (const w of getChapterWorlds(3)) {
      const wp = this.worldProgress[w.id];
      if (!wp || !wp.unlocked) continue;
      if (Object.keys(wp.levelStars || {}).length === 0) wp.unlocked = false;
    }
    this.ch3OrderRev = CH3_ORDER_REV;
    return true;
  }

  checkWorldUnlock(_completedWorldId) {
    // Sequential unlock WITHIN each chapter: world N+1 unlocks when world N has
    // all its challenges cleared. Each chapter's FIRST world has its own gate:
    //   • Chapter 1 (Moon Base) is always unlocked.
    //   • Chapter 2 (Bloodstream) unlocks once "Universe's End" (World 11, the
    //     Chapter 1 finale) is fully cleared — the same condition that reveals
    //     the warp gate, so the wormhole and the unlocked first inner world
    //     appear together right after the Void cracks open.
    // Hidden worlds (15/16) are NOT in this chain — they unlock via warp-asteroid
    // discovery (see discoverHiddenWorld).
    for (const chapter of [1, 2, 3]) {
      const worlds = getChapterWorlds(chapter);
      for (let i = 0; i < worlds.length; i++) {
        const world = worlds[i];
        const wp = this.worldProgress[world.id];
        if (!wp) continue;
        if (i === 0) {
          // First world of the chapter: gate on the chapter's entry condition.
          // Never re-lock (matches original behavior of only flipping → true).
          // Inner Space (Chapter 2) opens only after the Chapter 1 finale —
          // "Universe's End" (World 11) — is beaten and the Void cracks open,
          // pulling the player inward. This matches the warp-gate reveal on the
          // map so the wormhole and the unlocked first world appear together.
          // Each chapter's first world gates on the PREVIOUS chapter's finale:
          // Ch2 (Inner Space) opens after World 11; Ch3 (Home Ground) opens after
          // the grand finale, World 28, the same condition that reveals the
          // Home Ground warp gate on the Chapter 2 map.
          const entryOpen =
            chapter === 1 ? true :
            chapter === 2 ? this.isWorldFullyCleared(CHAPTER1_FINAL_ID) :
            chapter === 3 ? this.isWorldFullyCleared(CHAPTER2_FINAL_ID) :
            false;
          if (entryOpen) wp.unlocked = true;
          continue;
        }
        const prev = worlds[i - 1];
        const prevWp = this.worldProgress[prev.id];
        // The brake: the next world opens only when EVERY level of the previous
        // world is mastered (not merely touched for ≥1 star). Sticky `unlocked`
        // below means tightening this gate never re-locks a world a kid already
        // reached — it only adds friction to worlds not yet unlocked.
        const prevCleared = prevWp && Object.keys(prevWp.levelMastered || {}).length >= prev.levelsRequired;
        // The Chapter 3 finale needs the WHOLE day behind it, not just the stop
        // before it. For anyone playing the day in order this is the identical
        // condition, so it changes nothing for a new player or for anyone who
        // has already finished. It is what stops a save written under the old
        // Chapter 3 order from opening the mountain, and rolling the homecoming
        // credits, with a stop still unplayed.
        const gateOpen = world.id === CHAPTER3_FINAL_ID
          ? worlds.every(w => w.id === CHAPTER3_FINAL_ID || this.isWorldMastered(w.id))
          : prevCleared;
        if (gateOpen && !wp.unlocked) {
          wp.unlocked = true;
        }
      }
    }
    // Hidden worlds: unlocked iff discovered. (They are accessed from glitch
    // nodes on the map, not the sequential chain.)
    for (const h of HIDDEN_WORLDS) {
      const wp = this.worldProgress[h.id];
      if (wp) wp.unlocked = this.isHiddenWorldDiscovered(h.id);
    }
  }

  // How badly a fact needs practice — the automaticity NEED score (higher =
  // more in need). Drives weak-fact targeting. Three signals, layered:
  //   1. Inaccuracy — a fact you get wrong needs work most (dominant weight).
  //   2. Accurate-but-slow — correct but over the fluency cap and not yet
  //      automatic. THIS is the core automaticity signal the old engine
  //      ignored: the kid who is right but counting on fingers.
  //   3. Decay — a once-automatic fact whose spaced-repetition review is
  //      overdue resurfaces so it stays sharp (activates the dormant
  //      nextReview logic). Keeps the already-fluent kid's facts fresh.
  _automaticityNeedScore(data) {
    const accuracy = data.total > 0 ? data.correct / data.total : 0;
    let score = (1 - accuracy) * 2;
    if (accuracy >= 0.7 && !data.automatic) {
      if (data.recentMs > 0) {
        score += Math.min(1, Math.max(0, (data.recentMs - FLUENCY_CAP_MS) / FLUENCY_CAP_MS));
      } else {
        score += 0.5; // accurate but never timed → still worth a fast rep
      }
    }
    if (data.automatic && data.nextReview && Date.now() > data.nextReview) {
      score += 0.8;
    }
    return score;
  }

  // Facts the player has attempted, ranked most-in-need first by the
  // automaticity need score, tie-broken by fewest attempts (surface novel ones).
  rankedWeakFacts(minTotal = 2) {
    const facts = [];
    for (const [key, data] of Object.entries(this.factMastery)) {
      if (!data || data.total < minTotal) continue;
      const [a, b] = key.split('x').map(Number);
      if (a < 1 || b < 1 || a > 12 || b > 12) continue;
      facts.push({
        a, b,
        accuracy: data.correct / data.total,
        total: data.total,
        recentMs: data.recentMs || 0,
        automatic: !!data.automatic,
        score: this._automaticityNeedScore(data)
      });
    }
    facts.sort((x, y) => y.score - x.score || x.total - y.total);
    return facts;
  }

  // ── Resurfacing / spaced repetition ─────────────────────────────────────────
  // The dormant other half of the automaticity engine, finally surfaced. A fact
  // is "rusty" once it reached fluency (automatic) AND its spaced-repetition
  // review date has since passed — i.e. a fact the kid LEARNED and is now quietly
  // forgetting. Because mastery is distributed across real calendar days, rust
  // can't be crammed away in one sitting; tending it is what keeps a finite map
  // calling kids back. Most-overdue first.
  getRustyFacts() {
    const now = Date.now();
    const out = [];
    for (const [key, d] of Object.entries(this.factMastery)) {
      if (!d || !d.automatic || !d.nextReview || now <= d.nextReview) continue;
      const [a, b] = key.split('x').map(Number);
      if (a >= 1 && b >= 1 && a <= 12 && b <= 12) out.push({ a, b, overdueMs: now - d.nextReview });
    }
    out.sort((x, y) => y.overdueMs - x.overdueMs);
    return out;
  }

  getRustyFactCount() {
    return this.getRustyFacts().length;
  }

  // Fact for one Tune-Up rep: most-overdue rusty fact first; if nothing is rusty,
  // any attempted fact past its review date; else the weakest fact; else null
  // (caller then samples a random fact). Keeps the refresh always non-empty.
  pickReviewFact() {
    const rusty = this.getRustyFacts();
    if (rusty.length) {
      const pool = rusty.slice(0, Math.min(rusty.length, 8));
      const f = pool[Math.floor(Math.random() * pool.length)];
      return { a: f.a, b: f.b };
    }
    const now = Date.now();
    const due = [];
    for (const [key, d] of Object.entries(this.factMastery)) {
      if (!d || (d.total || 0) < 1 || !d.nextReview || now <= d.nextReview) continue;
      const [a, b] = key.split('x').map(Number);
      if (a >= 1 && b >= 1 && a <= 12 && b <= 12) due.push({ a, b });
    }
    if (due.length) return due[Math.floor(Math.random() * due.length)];
    return this.pickWeakFact(); // {a,b,...} or null
  }

  // Returns null on fresh saves so callers can fall back to random sampling.
  // Top third by need, floor 3 / cap 8 — focused without becoming repetitive
  // on a single fact.
  pickWeakFact() {
    const facts = this.rankedWeakFacts();
    if (facts.length === 0) return null;
    const poolSize = Math.min(Math.max(3, Math.ceil(facts.length / 3)), 8);
    const pool = facts.slice(0, poolSize);
    return pool[Math.floor(Math.random() * pool.length)];
  }

  // "Cleared" = every level touched for ≥1 star. Kept count-based and UNCHANGED
  // so narrative/banner gates (world-clear banner, Chapter 2 entry, finale) and
  // existing saves behave exactly as before. The mastery gate below is separate.
  isWorldFullyCleared(worldId) {
    const wp = this.worldProgress[worldId];
    const world = WORLDS.find(w => w.id === worldId);
    if (!wp || !world) return false;
    return Object.keys(wp.levelStars).length >= world.levelsRequired;
  }

  // ── Mastery queries (drive the advance gate + Mission Briefing UI) ──────────
  isLevelMastered(worldId, levelNum) {
    return !!this.worldProgress[worldId]?.levelMastered?.[levelNum];
  }

  getMasteredLevelCount(worldId) {
    const wp = this.worldProgress[worldId];
    return wp ? Object.keys(wp.levelMastered || {}).length : 0;
  }

  // Every level mastered — the condition that unlocks the next world.
  isWorldMastered(worldId) {
    const world = WORLDS.find(w => w.id === worldId);
    return !!world && this.getMasteredLevelCount(worldId) >= world.levelsRequired;
  }

  isWorldUnlocked(worldId) {
    return this.worldProgress[worldId]?.unlocked || false;
  }

  getWorldProgress(worldId) {
    return this.worldProgress[worldId];
  }

  // Get mastery percentage for a specific fact (for analytics)
  getFactMastery(a, b) {
    const key = `${Math.min(a, b)}x${Math.max(a, b)}`;
    const fact = this.factMastery[key];
    if (!fact || fact.total === 0) return 0;
    return Math.round((fact.correct / fact.total) * 100);
  }

  // Has this fact been certified automatic (correct + fast, repeatedly)?
  isAutomatic(a, b) {
    const key = `${Math.min(a, b)}x${Math.max(a, b)}`;
    return !!this.factMastery[key]?.automatic;
  }

  // Per-fact automaticity status for the parent dashboard grid:
  //   'automatic'    — fast + accurate (gold)
  //   'slow'         — accurate (>=70%) but not yet automatic (the gap to close)
  //   'inaccurate'   — below 70% accuracy
  //   'unseen'       — not yet attempted
  getFactStatus(a, b) {
    const key = `${Math.min(a, b)}x${Math.max(a, b)}`;
    const fact = this.factMastery[key];
    if (!fact || fact.total === 0) return 'unseen';
    if (fact.automatic) return 'automatic';
    return (fact.correct / fact.total) >= 0.7 ? 'slow' : 'inaccurate';
  }

  // Dashboard summary across the 78 unique facts (1..12, a<=b). Counts how many
  // are automatic, accurate-but-slow, still inaccurate, and untouched.
  getAutomaticityStats() {
    let automatic = 0, slow = 0, inaccurate = 0, attempted = 0;
    const totalFacts = 78; // 12*13/2 unique normalized facts
    for (let a = 1; a <= 12; a++) {
      for (let b = a; b <= 12; b++) {
        const status = this.getFactStatus(a, b);
        if (status === 'unseen') continue;
        attempted++;
        if (status === 'automatic') automatic++;
        else if (status === 'slow') slow++;
        else inaccurate++;
      }
    }
    return { automatic, slow, inaccurate, attempted, totalFacts };
  }

  // Accurate-but-slow facts — the actionable automaticity gap for parents.
  // Correct most of the time but still over the fluency cap (not automatic),
  // ranked slowest-first.
  getSlowFacts(count = 8) {
    const out = [];
    for (const [key, data] of Object.entries(this.factMastery)) {
      if (!data || data.total < 2) continue;
      const [a, b] = key.split('x').map(Number);
      if (a < 1 || b < 1 || a > 12 || b > 12) continue;
      if (data.automatic) continue;
      if ((data.correct / data.total) < 0.7) continue; // that's an accuracy problem
      out.push({ a, b, recentMs: Math.round(data.recentMs || 0), total: data.total });
    }
    out.sort((x, y) => y.recentMs - x.recentMs);
    return out.slice(0, count);
  }

  // SM-2 weakness predicate. Used by the wrong-answer flow to decide whether
  // to interrupt with a correction card. A fact qualifies as weak when the
  // player has seen it more than once and is averaging below 70% — i.e.
  // there's a real pattern of struggle, not just a single slip-up on a
  // fresh fact. Returning false on first-misses keeps gameplay snappy.
  isFactWeak(a, b) {
    const key = `${Math.min(a, b)}x${Math.max(a, b)}`;
    const fact = this.factMastery[key];
    if (!fact || fact.total < 2) return false;
    return (fact.correct / fact.total) < 0.7;
  }

  // Get most missed facts for analytics — strictly lowest-accuracy first
  // (rankedWeakFacts now sorts by overall need, which includes slow-but-correct
  // facts; "most missed" must stay accuracy-based for the dashboard label).
  getMostMissedFacts(count = 5) {
    return this.rankedWeakFacts(3)
      .filter(f => f.accuracy < 0.7) // accuracy problems only — slow-but-accurate
                                     // facts belong to the speed list, not here
      .sort((x, y) => x.accuracy - y.accuracy || y.total - x.total)
      .slice(0, count)
      .map(f => ({
        a: f.a,
        b: f.b,
        accuracy: Math.round(f.accuracy * 100),
        total: f.total
      }));
  }
}

// Singleton
export const progress = new PlayerProgress();

// Per-world music tempo. Pitches `levels.mp3` up/down via Web Audio
// playbackRate so each world reads a little differently. 2^(n/12) gives
// n semitones: +1=1.0595, +0.5≈1.0293, -2=0.8909, -3=0.8409. Default 1.0.
const WORLD_MUSIC_RATE = {
  1: 1.0,
  4: 1.0595,   // crystal sparkle: +1 semitone
  6: 0.8909,   // black hole edge: -2 semitones
  9: 0.8409,   // void: -3 semitones
  11: 1.0293,  // final: +0.5 semitones
  // Chapter 2 — "Inner Space" reads warmer/closer than the cold cosmos. The
  // bespoke level theme is organic/wet, so per-world pitch stays subtle (≤ ±1
  // semitone): deep downshifts on a resampled organic track turn muddy.
  21: 1.0293,  // bloodstream: +0.5 (a quickened pulse)
  22: 1.0,     // cell city: neutral
  23: 1.0595,  // nucleus vault: +1 (bright, crystalline)
  24: 0.9439,  // neuron forest: -1 (low, electric hush)
  25: 1.0,     // marrow caverns: neutral
  26: 0.9719,  // immune front: -0.5 (tense)
  27: 0.9439,  // mitochondria core: -1 (furnace rumble)
  28: 0.9439,  // singularity cell: -1 (finale gravitas, kept clean)
  // Chapter 3, "Home Ground": one summer Saturday around the city, bright and
  // unhurried. Subtle per-world pitch (within 1 semitone) over the bespoke Home
  // Ground level theme, stepping with the time of day rather than with danger.
  31: 1.0,     // the grocery store: neutral (morning routine)
  32: 1.0293,  // the big garden: +0.5 (a green lift, late morning)
  33: 1.0595,  // the mall: +1 (bright and busy, indoors out of the rain)
  34: 1.0293,  // the beach: +0.5 (airy, full afternoon sun)
  35: 0.9719,  // the big store: -0.5 (big boxes, low five o'clock light)
  36: 1.0,     // the bread place: neutral, warm (early evening)
  37: 0.9439,  // the seawall: -1 (broad, golden hour on the water)
  38: 1.0293,  // the mountain: +0.5 (finale shine, the lights coming on)
};
export function getWorldMusicRate(worldId) {
  return WORLD_MUSIC_RATE[worldId] ?? 1.0;
}
