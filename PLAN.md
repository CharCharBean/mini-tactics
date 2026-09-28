# Mini Tactics Game — Build Plan for Claude Code

Sep 28, 2026 · @Charles

Claude Code builds a 3-level, Fire Emblem–style tactics game as one HTML file, using GBA-era combat math, smart-ish enemy AI, and danger zone, forecast and undo.

## Goal and constraints

Ship one file, `index.html`, that opens in any modern browser and plays a full 3-level medieval tactics campaign with no install and no external assets.

**Hard constraints**

- One self-contained HTML file: markup, CSS and JavaScript inline. No build step, no frameworks, no image or audio files.
- Render on an HTML5 `<canvas>`. Draw all sprites procedurally (simple pixel-art shapes in code) or with small inline SVG/emoji-free shapes.
- Original setting and characters only. Borrow the genre mechanics (grid tactics, weapon triangle, GBA-style math), never Fire Emblem names, characters, logos or art.
- Medieval fantasy theme throughout: knights, brigands, castles, bridges, forests.
- Mouse-first controls, plus keyboard shortcuts (listed in the Danger zone, forecast and undo section).
- Grid: 12 columns × 10 rows, 48 px tiles, so the board is 576 × 480 px, plus a side panel for unit info and the forecast.
- No `localStorage` or other browser storage. All state lives in JavaScript variables.

**Definition of done**

- All 3 levels are winnable and losable, with a title screen, level intro text, victory and defeat screens, and a final win screen.
- Combat numbers in the forecast match the formulas in this doc exactly.
- Danger zone, forecast and undo all work as specified.
- No console errors across a full playthrough.

## Turn flow

&#91;embedded content: turn flow · player phase, enemy phase, win and loss\]

Model the game as this state machine: one variable holds the current phase, and every click or keypress is handled according to it. Level 2 adds a third outcome: surviving 8 turns counts as Victory, and an enemy on the gate counts as Defeat.

## Combat rules

Use the Fire Emblem 7 (GBA) formulas, minus weight/constitution, weapon ranks, supports and effectiveness. Round down everywhere. Clamp every displayed percentage to 0–100.

| Value | Formula |
| --- | --- |
| Attack | Str (Mag for tomes) + weapon Mt + triangle bonus (±1) |
| Damage | max(0, Attack − target Def (Res vs. tomes) − terrain Def) |
| Hit | weapon Hit + 2×Skl + Lck/2 + triangle bonus (±15) |
| Avoid | 2×Spd + Lck + terrain Avoid |
| Displayed hit | Hit − target Avoid |
| Crit | weapon Crit + Skl/2 − target Lck |
| Crit damage | Damage × 3 |
| Doubling | Attack twice if Spd ≥ target Spd + 4 |

**True hit (2RN).** Roll two integers 0–99 and average them. The attack lands if the average is below displayed hit. Crits use a single roll. This matches the GBA games: a displayed 90% lands about 98% of the time, a displayed 30% about 18%.

**Exchange order.** Attacker strikes; defender counters if the attacker's distance is inside the defender's weapon range and the defender is alive; then the faster unit strikes again if it doubles. The exchange stops the moment either unit reaches 0 HP.

**Weapon triangle.** Sword beats Axe, Axe beats Lance, Lance beats Sword. The winner gets +1 Attack and +15 Hit; the loser gets −1 and −15. Bows and tomes are neutral.

**Weapons**

| Weapon | Type | Mt | Hit | Crit | Range | Used by |
| --- | --- | --- | --- | --- | --- | --- |
| Oathblade | Sword | 7 | 95 | 10 | 1 | Player Lord only |
| Iron Sword | Sword | 5 | 90 | 0 | 1 | Mercenary |
| Steel Sword | Sword | 8 | 75 | 0 | 1 | Level 3 elites |
| Iron Lance | Lance | 7 | 80 | 0 | 1 | Knight, Soldier |
| Iron Axe | Axe | 8 | 75 | 0 | 1 | Brigand |
| Warlord's Axe | Axe | 12 | 70 | 5 | 1 | Boss |
| Iron Bow | Bow | 6 | 85 | 0 | 2 | Archers |
| Fire | Tome | 5 | 90 | 0 | 1–2 | Mages |

Bows cannot counter at range 1, which gives players a reason to rush archers. Weapons never break.

**Terrain**

| Terrain | Move cost | Avoid | Def | Notes |
| --- | --- | --- | --- | --- |
| Plains, road, floor, bridge | 1 | 0 | 0 |  |
| Forest | 2 | +20 | +1 |  |
| Mountain | 3 | +30 | +1 | Knights cannot enter |
| Fort | 2 | +20 | +2 | Heals 20% max HP at the start of its owner's phase |
| Throne | 1 | +30 | +3 | Heals 20% like a fort; Level 3 seize tile |
| Wall, water, cliff | Impassable | — | — | Ranged attacks still pass over |

**Healing.** No healer class for now. Every player unit carries one Vulnerary: using it heals 10 HP, takes the unit's action, and it has 3 uses per level. Units return to full HP between levels.

## Units

Four player units, five enemy classes and one boss. Stats are starting values; tune them only if playtesting in phase 7 shows a level is unwinnable or trivial.

**Player army (blue)**

| Name | Class | Weapon | HP | Str | Mag | Skl | Spd | Lck | Def | Res | Mov | Role |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Aldric | Lord | Oathblade | 20 | 6 | 0 | 8 | 9 | 7 | 5 | 2 | 5 | Must survive; seizes in Level 3 |
| Brenna | Knight | Iron Lance | 24 | 8 | 0 | 5 | 3 | 3 | 11 | 1 | 4 | Wall; holds chokepoints |
| Wren | Archer | Iron Bow | 18 | 6 | 0 | 8 | 7 | 4 | 4 | 1 | 5 | Range 2 only |
| Maelis | Mage | Fire | 16 | 0 | 7 | 6 | 7 | 5 | 2 | 6 | 5 | Hits Res; answer to armor |

**Enemy classes (red), Level 1 values**

| Class | Weapon | HP | Str | Mag | Skl | Spd | Lck | Def | Res | Mov |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Brigand | Iron Axe | 22 | 7 | 0 | 3 | 3 | 0 | 3 | 0 | 5 |
| Soldier | Iron Lance | 20 | 6 | 0 | 4 | 4 | 1 | 5 | 0 | 5 |
| Mercenary | Iron Sword | 20 | 6 | 0 | 7 | 8 | 2 | 4 | 0 | 5 |
| Archer | Iron Bow | 18 | 5 | 0 | 5 | 5 | 1 | 3 | 0 | 5 |
| Mage | Fire | 16 | 0 | 5 | 4 | 5 | 1 | 2 | 4 | 5 |
| Boss: Warlord Garrick | Warlord's Axe | 34 | 11 | 0 | 7 | 6 | 4 | 9 | 3 | 0 |

**Scaling.** Level 2 enemies get +2 HP, +1 Str/Mag, +1 Def. Level 3 enemies get +4 HP, +2 Str/Mag, +1 Skl, +1 Spd, +2 Def. After clearing a level, every surviving player unit gets a fixed bonus of +2 HP, +1 Str or Mag, +1 Spd, +1 Def. No experience points or random growths.

**Losing units.** A player unit at 0 HP leaves the map for the rest of that level and returns at full HP for the next one. If Aldric falls, the level is lost and restarts.

**Look.** Blue for players, red for enemies, a gold crown on the boss. Each class gets a distinct silhouette drawn in code: shield and plume (Lord), heavy armor (Knight), bow (Archer), hood and staff glow (Mage), horned helm (Brigand), spear (Soldier). Grey out a unit after it has acted.

## Levels

Three 12 × 10 maps, each teaching one idea: fighting, defending, then assaulting. Store each map as an array of 10 strings of 12 characters, exactly as drawn below. Coordinates are (column, row), zero-indexed from the top left.

**Legend.** `.` plains · `F` forest · `M` mountain · `T` fort · `G` gate (fort stats; Level 2 objective tile) · `H` throne · `_` castle floor · `W` wall · `~` water · `=` bridge · `1` Aldric · `2` Brenna · `3` Wren · `4` Maelis · `b` Brigand · `s` Soldier · `m` Mercenary · `a` Archer · `g` Mage. Unit tiles are plains underneath, except castle-floor tiles inside walls.

### Level 1: Border Skirmish

Intro: "Brigands have crossed the border into Eastmarch. Drive them out." Objective: defeat all 5 enemies. Teaches movement, the weapon triangle and the forecast.

```text
..F.....FF..
.FF..b....F.
......M..s..
.F...MM.....
.....F..m.F.
..T.....F...
.F..F....a..
12.....F....
34..F...b...
...F....FF..
```

Behaviors: both Brigands and the Mercenary are Aggressive; the Soldier and Archer are Guard.

### Level 2: Hold the Bridge

Intro: "The raiders' main force is coming for the Aldermoor bridge. Hold the gate until dawn." Objective: survive 8 turns (win at the start of player phase 9) or defeat every enemy. Lose if Aldric falls or any enemy ends its phase on the gate `G` at (0,4).

```text
F....~~....F
.F...~~..M..
..F..~~.s...
.1...~~..a..
G2.T.==..b..
.3...==.s...
.4F..~~...g.
..F..~~.b...
.F...~~..M..
F....~~....F
```

Reinforcements arrive at the end of the enemy phase and act next turn: turn 3, Brigands at (11,2) and (11,7); turn 5, a Mercenary at (11,4) and an Archer at (11,5). Skip a spawn if its tile is occupied. All enemies are Aggressive and treat the gate as a target they want to reach. The water is two tiles wide, so ranged enemies must come onto the bridge or its banks to reach the near side. This is the level where danger zone matters.

### Level 3: Castle Seize

Intro: "Warlord Garrick holds Blackwater Keep. Take the throne and end this." Objective: move Aldric onto the throne `H` at (5,1) and choose Seize. Garrick starts on the throne, so he must be defeated first. Lose if Aldric falls.

```text
WWWWWWWWWWWW
W_a__H__g_aW
W____s_____W
WWW_WWWW_WWW
W_m______b_W
W__T____T__W
WWWWW__WWWWW
.F..b....F..
..F.....s...
..1234....F.
```

The main gate is the gap at (5,6)–(6,6); the throne room is reached through doorways at (3,3) and (8,3). Behaviors: Garrick is Boss (never moves, attacks anything in range, gains throne bonuses and healing). Everything in the throne room (rows 1–2) is Guard. The courtyard Mercenary and Brigand are Guard. The two enemies outside the walls are Aggressive. Archers at (2,1) and (10,1) cover both doorways at range 2.

## Enemy AI

Each enemy tries every reachable tile and every target it could hit from there, scores each option, and takes the best one. This is the brute-force approach from The Liquid Fire's tactics AI series, scaled down to a 12 × 10 grid where it runs instantly.

**Movement range.** Dijkstra flood fill from the unit's tile, summing terrain move costs up to its Mov. Allies can be passed through but not stopped on; enemies of the unit block. The same function serves player movement, enemy AI and the danger zone.

**Scoring an attack option** (move to tile *t*, attack target *u*), using the forecast's own numbers:

1. Expected damage dealt = sum over the unit's strikes of damage × true-hit chance (use the 2RN table, not the displayed %).
2. +50 if the expected exchange can kill *u* (enough damage if every strike hits and the displayed hit is at least 40%).
3. +20 if *u* is Aldric; +10 if *u* is an Archer or Mage.
4. − expected counter damage taken × 0.8.
5. - terrain Avoid of *t* × 0.1, so enemies prefer forests and forts when all else is equal.

Act only if the best score is above 0; otherwise fall back to movement.

**Fallback movement.** Move to the reachable tile with the shortest path distance to the nearest player unit (Level 2: to the gate if it is closer). Break ties by higher terrain Avoid.

**Behaviors**

| Behavior | Rule |
| --- | --- |
| Aggressive | Always runs the full scoring above, then fallback movement. |
| Guard | Does nothing until a player unit is inside its threat range (move + weapon range) at the start of the enemy phase; then behaves as Aggressive for the rest of the level. |
| Boss | Never moves. Attacks the best target in weapon range from its current tile. |

**Turn order.** Enemies act one at a time, ranged units first, then melee sorted by distance to the nearest player unit. Pause about 400 ms per enemy and animate its move and attack so the player can follow.

## Danger zone, forecast and undo

These three features make the game fair to play, so build them to the same standard as combat.

**Danger zone**

- `D` or a toolbar button toggles it. When on, tint red every tile any living enemy could attack next enemy phase: its movement range from its current tile, expanded by its weapon range.
- Guard units that are not yet triggered still count, since the player cannot see who is triggered. The boss counts with Mov 0.
- Clicking an enemy shows just that enemy's range: blue for movement, red for attack. Clicking again or pressing `Esc` clears it.
- Recompute after every player action, so the zone reflects units the player has just killed.

**Battle forecast**

Shown in the side panel when the player hovers a valid target during target selection. Nothing happens until the player clicks the target a second time or presses `Enter`.

| Row | Player unit | Enemy |
| --- | --- | --- |
| Name and weapon | shown, with a triangle arrow (▲ advantage, ▼ disadvantage) | same |
| HP | current → predicted if every strike hits | same |
| Damage | per strike, with ×2 if doubling | same, or "–" if it cannot counter |
| Hit | displayed % | same |
| Crit | displayed % | same |

The forecast must call the same combat function the battle uses, so the numbers can never disagree.

**Undo**

- Before a unit's action is confirmed, `Esc` or right-click cancels the move and returns the unit to its starting tile (standard FE behavior).
- `Z` or an Undo button reverts the last completed player action (move, attack, Vulnerary or Seize) by restoring a snapshot of the full game state taken just before it. Undo history clears at the start of each enemy phase, so the player can only undo within their own turn.
- Anti-reroll rule: use a seeded pseudo-random generator (for example mulberry32) and store its state in each snapshot. Undoing and repeating the same attack produces the same rolls, so undo cannot be used to reroll a miss. Choosing a different target or order consumes different rolls, which is fine.

**Controls**

| Input | Action |
| --- | --- |
| Left-click unit | Select; shows movement (blue) and attack (red) ranges |
| Left-click blue tile | Move there, then open the action menu: Attack, Vulnerary, Seize (throne only), Wait |
| Right-click or `Esc` | Cancel the current step |
| `D` | Toggle danger zone |
| `Z` | Undo last action |
| `E` | End player phase (ask to confirm if units have not acted) |
| `Enter` | Confirm attack from the forecast |

## Build phases

Build in this order and do not start a phase until the previous phase's check passes. Each phase should leave `index.html` playable in some form.

- [x] **1. Board and data.** Canvas, map parsing from the Level 1 strings, terrain drawing, unit sprites, side panel showing the hovered unit's stats and tile's terrain bonuses. *Check:* Level 1 renders exactly as drawn; hovering any tile shows correct terrain values.
- [x] **2. Movement and turns.** Dijkstra movement range, selecting and moving units, the action menu with Wait, greying out acted units, End Phase, a stub enemy phase that does nothing. *Check:* Brenna cannot enter mountains; forest costs 2; allies can be passed through but not stopped on.
- [x] **3. Combat and forecast.** The combat function (formulas, triangle, 2RN, doubling, counters, crits), attack range display, the forecast panel, a simple hit/miss/crit animation and HP bars, unit removal at 0 HP, Vulnerary. *Check:* a hand-computed Aldric vs. Brigand forecast matches the panel (Aldric deals 11 ×2 at 100% hit); Wren cannot counter at range 1.
- [x] **4. Enemy AI.** Scoring, fallback movement, Aggressive, Guard and Boss behaviors, animated enemy phase. *Check:* in Level 1 an enemy with a choice attacks the lower-HP or squishier unit; Guard units stay put until triggered.
- [x] **5. Danger zone and undo.** Toggle, per-enemy range on click, snapshot undo with seeded RNG. *Check:* undoing an attack that missed and repeating it misses again; the danger zone shrinks after killing an enemy.
- [x] **6. Levels and flow.** Levels 2 and 3, objectives (rout, survive and defend the gate, seize), reinforcements, level intros, victory and defeat screens, between-level stat bonus, final win screen, restart level. *Check:* each level can be won and lost through every listed condition.
- [x] **7. Balance and polish.** Play every level start to finish at least twice; tune stats only if a level is unwinnable or trivial. Add a turn counter, objective text in the panel, smooth movement, and short Web Audio beeps for hit, miss and crit if time allows. *Check:* full playthrough with no console errors.
- [x] **8. Verify.** Run the checks below in a headless browser (Playwright) and fix anything that fails.

**Automated checks for phase 8**

- Expose `window.game` with `state`, `forecast(attacker, defender)` and `reachable(unit)` so tests can inspect the game without clicking.
- Test the formulas against the forecast example in phase 3 and one mage-vs-knight case (magic uses Res).
- Test that 10,000 simulated 2RN rolls at displayed 90% land close to 98%.
- Script one full player turn in Level 1 by clicking, then confirm the enemy phase ends and control returns to the player.
- Screenshot each level at its start so a person can compare it to the ASCII maps.

All of these live in `tests/game.spec.js` (20 tests, run with `npm test`), plus checks for every win and loss
condition, reinforcement timing, Esc/right-click cancel and zero console errors. Level screenshots are written to
`docs/screenshots/`.

## Decisions

Spec ambiguities, resolved as close to the GBA games as possible:

- **AI terrain term.** The spec says "− terrain Avoid × 0.1, so enemies prefer forests", but subtracting would make
  them *avoid* cover. The code adds it (`+ Avoid × 0.1`), which matches the stated intent.
- **Garrick is not scaled.** Applying Level 3 scaling to the boss gives him 38 HP and 14 Def on the throne, healing
  7 per turn; only Maelis could scratch him. He uses his listed stats (34 HP, 9 Def, 3 Res).
- **Level 3 elites.** The Steel Sword ("Level 3 elites") goes to the Level 3 Mercenary.
- **Level 2 rout.** "Defeat every enemy" only counts once both reinforcement waves have arrived; otherwise wiping the
  first six on turn 2 would skip the chapter's point.
- **Level 2 gate AI.** Enemies treat stepping onto the gate as a +100 option, so they actually go for it.
- **Guards wake when struck.** A Guard unit that is attacked becomes Aggressive, as in the GBA games.
- **No auto-end of the player phase.** Keeps Undo useful for your last unit; the End Turn button pulses instead.
- **Vulnerary** is hidden at full HP. Only units alive at the end of a chapter get the stat bonus.
- **Tiles under units** are castle floor when next to floor/throne, otherwise plains (Level 3 courtyard vs. field).
- **Forecast targeting.** Hovering shows the forecast; the first click locks the target, the second click (or Enter)
  attacks. Arrow keys / Tab cycle targets for keyboard players.
- **Retry seeds.** Each chapter attempt gets a fresh RNG seed; `?seed=N` in the URL makes runs reproducible, and
  `?fast=1` turns off animation (both used by the tests).

## Playtest notes (phase 7)

A greedy scripted player (not shipped) played each chapter from 10–12 seeds, with the between-chapter bonuses applied:

| Chapter | Result | Notes |
| --- | --- | --- |
| 1. Border Skirmish | Won 10/10 in 5–7 turns | Gentle tutorial; occasionally loses Maelis. |
| 2. Hold the Bridge | Won 10/10 with a plan | The whole raiding party crosses in one turn, so careless play loses the gate on turn 2. Holding the gate with Aldric and the fort with Brenna won every run, usually losing one unit. The intro tip now hints that a unit on the gate blocks it. |
| 3. Castle Seize | Won ~50% (bold play), ~10 turns | Hardest part is Garrick: 12 Def on the throne and +6 HP a turn. Maelis (Fire vs. Res) from range 2 plus Aldric doubling is the answer. Timid play stalls. |

No stats were changed: no chapter was unwinnable or trivial. If Chapter 3 feels too grindy for your players, the
easiest knobs are Garrick's HP or the throne's heal.

## Kickoff prompt

Paste this into Claude Code with this plan attached or pasted in full. Claude Code works best from an exact spec plus a checklist, so the prompt points at both and asks for a pause after each phase.

```text
You are building a small browser tactics game. The full spec is in the attached
plan ("Mini Tactics Game — Build Plan for Claude Code"). Treat it as the source
of truth for rules, stats, maps and features.

Deliverable: a single self-contained index.html (inline CSS and JS, canvas
rendering, no external assets, no localStorage).

How to work:
1. Read the whole plan first. Save it into the repo as PLAN.md.
2. Work through the Build phases in order. After each phase, run its Check,
   tick it off in PLAN.md, and give me a two-line summary before moving on.
3. Keep all rules in one combat module that both the forecast and the battle
   call. Never duplicate formulas.
4. Use original names and procedurally drawn pixel-style sprites. Do not use
   Fire Emblem names, characters or art.
5. If a spec detail is ambiguous, pick the option closest to the GBA Fire
   Emblem games, note the choice in PLAN.md under "Decisions", and keep going.
6. In phase 8, write Playwright checks as described and fix failures.

Start with phase 1.
```

Tip: if Claude Code drifts or a phase grows large, restart from the next unchecked box and say "continue from phase N of PLAN.md".

## Sources and references

Formulas and algorithms come from the pages marked "opened"; the other projects were surveyed for scope and structure, and none is forked.

| Source | What it gave this plan | Status |
| --- | --- | --- |
| [Combat Calculations – FE7, Triangle Attack](https://fe7.triangleattack.com/guides/calculations) | Attack, damage, hit, avoid, crit, doubling threshold, triangle bonuses | Opened |
| [Battle Formulas – Fire Emblem Wiki](https://fireemblem.fandom.com/wiki/Battle_Formulas) | Cross-check of formulas across games, 2RN true hit | Surveyed |
| [Tactics RPG A.I. Part 2 – The Liquid Fire](https://theliquidfire.com/2015/12/21/tactics-rpg-a-i-part-2/) | Brute-force scoring of every move-and-attack option; fallback toward the nearest opponent | Opened |
| [Tactical-RPG Move Range – Throw the Project](https://www.throwtheproject.com/blog/tutorial/tactical-rpg-move-range/) | Flood-fill movement with terrain costs; same search reused for attack range | Opened |
| [Zafnok/tactical-rpg PR #39](https://github.com/Zafnok/tactical-rpg/pull/39) | Example of movement, pathfinding and threat ranges in one change | Surveyed |
| [sviridoff/tactical-rpg](https://github.com/sviridoff/tactical-rpg) | JavaScript tactics clone; project structure reference | Surveyed |
| [King-F-Crimson/fire-emblem-clone](https://github.com/King-F-Crimson/fire-emblem-clone) | Simple turn-based clone; scope reference | Surveyed |
| [chessmasterhong/WaterEmblem](https://github.com/chessmasterhong/WaterEmblem) | Browser clone; scope reference | Surveyed |
| [frodr33/fire-emblem](https://github.com/frodr33/fire-emblem) | Clone; scope reference | Surveyed |
| [RudyFisher7/fe-fftactics-clone](https://github.com/RudyFisher7/fe-fftactics-clone) | FE/FFT hybrid; scope reference | Surveyed |
| [Tactics RPG Difficult! (itch.io)](https://golanpolandolan.itch.io/3-level-tactics-rpg-loop) | A 3-level tactics game, confirming the scope is realistic | Surveyed |

The game mechanics themselves (grid tactics, weapon triangle, the formulas) are not copyrightable, which is why the plan borrows them freely while keeping every name, character and piece of art original.
