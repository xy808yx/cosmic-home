# Cosmic Home: Polish Spec

Captured from interview on 2026-05-06. Three slices of polish, in priority order. Each slice is independently shippable.

---

## North-star philosophy

These shaped every decision below. When a future change is in scope-question, run it past these:

- **Core emotion: mastery.** The kid should feel "I'm getting better at math." Polish optimizes for that, not collection or adventure or achievement.
- **Pure-memory automaticity.** No coaching, no strategy hints, no surfacing of mastery internals. The kid plays, the engine adapts, memory builds. Don't show kids the spaced-repetition machinery.
- **No UI clutter.** The reason streaks/milestones got dropped. Don't add chrome counters, banners, or daily-streak-style metrics.
- **No daily-streak guilt.** No "don't break the chain" pressure mechanics.
- **Stars are a pure mastery badge.** They count up, they don't spend, they don't gate. They're the visible counterpart to the hidden accuracy gate driving evolution. Keep that role intact.
- **Pet on summary is always celebratory** — never sad/disappointed. Reinforce positivity regardless of run quality.

---

## Constraints — what we're NOT doing

Strict scope guards. These came directly from the interview:

- **No new gameplay mechanics.** No new modes, currencies, buttons, or pet abilities.
- **Don't touch the math engine.** `getProblemForWorld`, `getDistractors`, `recordFactAttempt`, `pickWeakFact` are dialed in. Keep the 60% weak / 40% random ratio, the SM-2 intervals, the off-by-one + square-of-factor distractors as they are.
- **No mid-mission UI overlays** beyond what already exists. No popup banners, modifier indicators, or chrome during play.
- **No new sprite assets.** Phaser graphics primitives only. Pet/ship sprites in [PetSprites.js](src/PetSprites.js) and [ShipRenderer.js](src/ShipRenderer.js) stay as-is.
- **No music.** SFX-only. The existing audio system in [AudioManager.js](src/AudioManager.js) is the audio surface.
- **No UI tinting per world.** HUD stays neutral and readable. World identity comes from asteroids + ambience + (new) backgrounds, not the chrome.

---

## Already-good things to preserve

A reminder before adding anything: these are working well and should not be regressed.

- Per-fact mastery + SM-2 spaced repetition ([GameData.js:529](src/GameData.js:529))
- Weak-fact serving (60% weak, 40% random; boss = 100% weak) ([GameData.js:264](src/GameData.js:264))
- Smart distractors (off-by-one factor, square-of-factor) ([GameData.js:191](src/GameData.js:191))
- Per-world bespoke asteroid art ([QuestionObjectArt.js](src/QuestionObjectArt.js))
- Per-world bespoke boss art ([QuestionObjectArt.js](src/QuestionObjectArt.js))
- Pet evolution gates: worlds cleared + lifetime correct + accuracy ([CompanionManager.js:106](src/CompanionManager.js:106))
- Lore card surfaces evolution progress on pet-button tap (not surfaced in header — keep it tap-only)
- Mission summary already includes: stars, score/accuracy/streak, evolution banner, first-mastery banner, weak-fact list, stardust earned chip
- In-mission streak counter (not the dropped meta-streak system) — fine to keep

---

## SLICE 1 — Play-screen win moment + summary closure

The biggest experiential gap. The kid spends 80% of their time on the play screen and the win moment is currently a quick laser + small fade. Three concrete additions, all targeting the moment-to-moment loop:

### 1.1 Bigger asteroid explosion

**File:** [src/scenes/GameScene.js](src/scenes/GameScene.js) — `explodeAsteroid()` (currently called from `handleCorrect`)

**Today:** asteroid container is destroyed after a short delay; a laser fires; that's it.

**Add:**
- **Particle burst** at the asteroid position. Use Phaser's particle system or hand-rolled graphics circles tweened outward + faded. ~12-20 particles, color = world accent + white sparkle highlights, sized 4-12px, ejected in a 360° spread.
- **Debris chunks** — 4-6 small polygonal shards spawned at the impact point, each with random rotation + outward velocity + gravity-ish fall, fade after ~600ms. Use the same palette as the asteroid body for the world.
- **Brief screen flash** — full-screen white/accent rectangle alpha 0→0.25→0 over ~120ms. Sells the "boom" without being seizure-y.
- **Audio already exists** — `audio.playAsteroidBoom?.()` is called; verify it's punchy enough or beef it up if needed.

**Boss explosion is separate** (slice 2). For slice 1, just upgrade the normal-asteroid case.

**Verification:** play world 1, get 3 correct in a row, the explosions should feel decisively different from current.

### 1.2 Pet on the mission summary (always celebratory)

**File:** [src/scenes/GameScene.js](src/scenes/GameScene.js) — `showSummary()` at line 1211

**Today:** summary panel has stars, stats, banners, weak-fact list, stardust chip. **No pet visible.**

**Add:**
- A `drawCompanion()` call positioned in a free corner of the summary panel (likely top-right or bottom-center, depending on layout — find a spot that doesn't crowd the score/accuracy/streak triplet).
- Pet **always celebratory**, regardless of star count. Trigger `bounceHappy()` on appearance. Loop a happy idle bob.
- Reasonable scale (e.g. `scale: 1.0` to read at the summary panel size).
- No progress bar or evolution UI — this is purely "the pet is here cheering."

**Why always-celebratory:** decided in interview. A sad pet on a bad run punishes the kid; we're optimizing for positive reinforcement of the play loop, not honest reporting.

**Verification:** play a 3-star, 1-star, and 0-star mission. Pet visible and cheering in all three.

### 1.3 Per-world background gradients + horizon shape

**File:** Likely a new helper or extension of [src/starfieldHelper.js](src/starfieldHelper.js); called from `GameScene.create()` and possibly `WorldMapScene` if we want consistency.

**Today:** shared starfield + per-world colored particles via `createMapAmbience` on the world map. Game scene background is plain black + starfield.

**Add per-world to the play scene only (slice 1):**
- A vertical gradient fill (top color → bottom color) tuned to each world's vibe. E.g. Moon Base = deep navy → silver-gray. Frost Belt = midnight blue → ice white. Inferno = black → dark crimson.
- A simple horizon shape at the bottom — a subtle arc/silhouette in a darker shade. Moon Base = lunar arc. Frost Belt = jagged ice ridge. Inferno = molten ridge.
- All Phaser graphics — no sprite assets. Each world is ~30 lines of `fillRect/fillCircle/fillTriangle` calls.
- Define the palette per world inline or in a small `WorldBackgrounds.js` map keyed by `worldId`.

**Don't extend to** the world map screen yet — that's a separate decision and the worldmap already has its own ambience system.

**Verification:** start a mission in worlds 1, 5, and 11. Backgrounds should look meaningfully different.

### Slice 1 done = ship it before starting slice 2.

---

## SLICE 2 — Boss defeat ceremony

The biggest "win moment" in the game (defeating a boss = clearing a world potentially) currently flows directly into the standard summary. Make it feel earned.

### 2.1 Multi-stage boss explosion

**File:** [src/scenes/GameScene.js](src/scenes/GameScene.js) — `defeatBoss()`

**Sequence (~2 seconds total, blocking before summary):**
1. **Boss flashes white** — full-tint white over the boss container, 150ms.
2. **Boss freezes** — stop any tweens, hold position.
3. **Cascading small explosions** — 3-4 small particle bursts ripple across the boss body over ~800ms, slightly randomized positions. Each burst uses the slice-1 explosion primitive at smaller scale.
4. **Final huge blast** — one large particle burst at boss center, 2-3x the size of a normal asteroid explosion. Screen flash 0→0.4→0.
5. **Boss container destroys.**
6. **Pet victory dance** (2.3) overlays during step 4-5.
7. **World-clear banner** (2.2) appears if applicable, then summary.

**Audio:** layered — current boss-impact sound, then a buildup whoosh, then a big boom on the final blast. Verify in [AudioManager.js](src/AudioManager.js) what's available; add new methods if needed (no new audio files — synthesize via Phaser's sound config or reuse existing samples at different rates).

### 2.2 World-clear banner

**File:** [src/scenes/GameScene.js](src/scenes/GameScene.js) — between `defeatBoss()` ceremony and `showSummary()`

**Trigger:** boss-defeat IFF this victory cleared the world (i.e. all required missions complete after this one).

**Format:**
- Full-width banner (~960px wide, ~140px tall) sliding down from the top of the screen.
- Background = world accent color at 0.95 alpha, with `0x0a0a1a` stroke.
- Text: `'<WORLDNAME> CLEARED!'` in display style, white, weight 900.
- Slides in over 350ms, sits for 2500ms, slides out over 350ms, then summary panel slides up.
- No tap-to-dismiss — auto-only. Don't add friction.
- Accompanied by a celebratory chord or rising tone (reuse `audio.playStar()` triple-burst pattern from first-mastery banner).

**Skip if** boss was beaten but world wasn't fully cleared (e.g. replay of the boss after world cleared). The trigger condition needs to check world-cleared state PRE-defeat vs POST-defeat to know if THIS run was the one that cleared.

### 2.3 Pet victory dance (shared, accent-tinted)

**File:** [src/scenes/GameScene.js](src/scenes/GameScene.js) and possibly [src/PetRenderer.js](src/PetRenderer.js) for the animation primitive

**Single shared animation, used for all 4 species. Tinted by species accent color.**

**Sequence:**
1. Pet pops out of the cockpit porthole — scale from 0 → 1.2 → 1.0 over 200ms, position above ship.
2. Pet bounces 3 times (Y oscillation, 250ms each) with hands-up arms-up via existing `bounceHappy()` (or extend it).
3. Glow halo in species accent color pulses behind the pet.
4. Pet returns to cockpit (scale 1.0 → 0 over 200ms).

**Total ~1500ms.** Plays during multi-stage boss explosion (steps 4-5 of 2.1) so it's parallel, not sequential. Adds character without extending the dead-air.

### Slice 2 done = ship it before starting slice 3.

---

## SLICE 3 — Future / TBD

Open. Reasonable candidates from the interview, none committed:
- Shop screen polish pass (tab consistency, hover states, info popups, scroll indicator)
- Lore card / Records screen parity pass with the home screen
- Onboarding / starter picker polish for first-run kids
- Music system (deferred — no music in slices 1-2, decided)

Decide slice 3 in a fresh planning session after slice 2 ships and the kid (and you) have lived with slices 1-2 for a bit.

---

## Decisions reference

A compact log of every decision made in the interview. If a future change conflicts with one of these, surface the conflict explicitly.

| Topic | Decision | Why / signal |
|---|---|---|
| Stars role | Pure mastery badge, no spend, no gate | Visible counterpart to the hidden accuracy gate; mastery emotion is core |
| Streaks/milestones | Stay dropped | Cluttered UI + daily-streak guilt |
| Core kid emotion | Mastery ("I'm getting better at math") | Shapes which polish matters |
| Pet evolution UI | Stay tap-only in lore card | No header chip, no pet-button ring, no mid-mission surfacing |
| Math engine | Don't touch | Adaptive serving + SR + distractors are dialed in |
| Wrong-answer coaching | Skip | Kids need automaticity through pure memory now |
| Mastery surfacing | Don't surface (no fact-mastery grid, no spaced-repetition due-count, no fact-family celebrations) | Pedagogical preference: invisible adaptive engine |
| Play-screen polish target | Bigger explosion (yes), wrong-answer pet reaction (no), camera shake (no), tension cue (no) | Ship the high-leverage thing tight |
| Boss defeat priority | Multi-stage explosion + world-clear callout + pet victory dance (yes), stardust rain (no) | Earn the climax |
| Music | Skipped entirely | Bundle bloat + scope creep concern; SFX is fine |
| World theming | Backgrounds (gradient + horizon) yes, UI tint no | Asteroid art already does theming; don't muddy chrome |
| Summary pet | Always celebratory | Positive reinforcement over honest reporting |
| Pet victory dance | Shared animation, accent-tinted by species | Don't 4x the animation work |
| World-clear banner | Auto-dismiss after 2.5s, no tap | Friction-free ceremony |
| Slice 1 | Bigger explosion + summary pet + per-world backgrounds | First polished bundle |
| Slice 2 | Boss defeat ceremony bundle | Earn the climax |
| Slice 3+ | Open | Decide after slice 2 ships |

---

## Implementation notes / hot file references

For whoever picks this up:

- Play screen: [src/scenes/GameScene.js](src/scenes/GameScene.js) — `handleCorrect`, `explodeAsteroid`, `defeatBoss`, `showSummary`
- World data + per-world config: [src/GameData.js](src/GameData.js) — `WORLDS`, `getProblemForWorld`, `getDistractors`
- Asteroid + boss art (already themed per world): [src/QuestionObjectArt.js](src/QuestionObjectArt.js)
- Pet rendering + animation methods: [src/PetRenderer.js](src/PetRenderer.js) — `drawCompanion`, `bounceHappy`, `slumpSad`, `rocketBoost`, etc.
- Pet evolution mechanics: [src/CompanionManager.js](src/CompanionManager.js) — `STAGE_GATES`, `checkEvolutionEligibility`
- Style presets: [src/textStyles.js](src/textStyles.js) — `style('display'/'subhead'/'body'/'caption')`
- Audio surface: [src/AudioManager.js](src/AudioManager.js) — `playLaser`, `playAsteroidBoom`, `playWrong`, `playStar`, etc.
- Starfield/ambience helper: [src/starfieldHelper.js](src/starfieldHelper.js)
