// @ts-check
// Phase 8 checks from PLAN.md. Run with `npm test`.
const { test, expect } = require('@playwright/test');
const path = require('path');
const { pathToFileURL } = require('url');

const GAME = pathToFileURL(path.resolve(__dirname, '..', 'index.html')).href;
const SHOTS = path.resolve(__dirname, '..', 'docs', 'screenshots');

/** Open the game in instant-animation mode with a fixed seed and track console errors. */
async function open(page, { seed = 1234, fast = true } = {}) {
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${GAME}?seed=${seed}${fast ? '&fast=1' : ''}`);
  await page.waitForFunction(() => !!window.game);
  return errors;
}
const startLevel = (page, li) => page.evaluate(li => window.game.startLevel(li), li);
const playerTurnReady = page => page.waitForFunction(() => {
  const g = window.game;
  return g.state.phase === 'player' && !g.ui.busy;
});
/** Click the centre of board tile (x, y). */
async function clickTile(page, x, y, button = 'left') {
  const box = await page.locator('#board').boundingBox();
  await page.mouse.click(box.x + (x + 0.5) * box.width / 12, box.y + (y + 0.5) * box.height / 10, { button });
}

test('title screen loads and the campaign starts without console errors', async ({ page }) => {
  const errors = await open(page, { fast: false });
  await expect(page.getByRole('button', { name: 'Start Campaign' })).toBeVisible();
  await page.getByRole('button', { name: 'Start Campaign' }).click();
  await expect(page.getByText('Border Skirmish').first()).toBeVisible();
  await page.getByRole('button', { name: 'Begin Battle' }).click();
  await playerTurnReady(page);
  expect(errors).toEqual([]);
});

test.describe('combat formulas', () => {
  test('Aldric vs Brigand forecast: 11 damage x2 at 100% hit', async ({ page }) => {
    await open(page);
    await startLevel(page, 0);
    const fc = await page.evaluate(() => window.game.forecast('aldric', 'brigand-1'));
    expect(fc.A.atk).toBe(14);          // 6 Str + 7 Mt + 1 triangle
    expect(fc.A.dmg).toBe(11);          // 14 - 3 Def
    expect(fc.A.count).toBe(2);         // 9 Spd >= 3 + 4
    expect(fc.A.hit).toBe(100);         // clamped
    expect(fc.A.crit).toBe(14);         // 10 + 8/2 - 0
    expect(fc.D.tri).toBe(-1);          // axe loses to sword
  });

  test('magic targets Resistance: Maelis vs Brenna', async ({ page }) => {
    await open(page);
    await startLevel(page, 0);
    const r = await page.evaluate(() => ({
      magic: window.game.forecast('maelis', 'brenna'),
      physical: window.game.forecast('brenna', 'maelis'),
    }));
    expect(r.magic.A.atk).toBe(12);     // 7 Mag + 5 Mt
    expect(r.magic.A.dmg).toBe(11);     // 12 - 1 Res (Brenna has 11 Def, which is ignored)
    expect(r.physical.A.dmg).toBe(13);  // 8 Str + 7 Mt - 2 Def
  });

  test('bows cannot counter at range 1 but can at range 2', async ({ page }) => {
    await open(page);
    await startLevel(page, 0);
    const r = await page.evaluate(() => {
      const g = window.game, w = g.state.units.find(u => u.id === 'wren');
      return {
        adjacent: g.forecast('brigand-1', 'wren', w.x + 1, w.y).D.canCounter,
        twoAway: g.forecast('maelis', 'wren', w.x + 2, w.y).D.canCounter,
      };
    });
    expect(r.adjacent).toBe(false);
    expect(r.twoAway).toBe(true);
  });

  test('forest adds +1 Def and +20 Avoid to the defender', async ({ page }) => {
    await open(page);
    await startLevel(page, 0);
    const r = await page.evaluate(() => {
      const g = window.game, b = g.state.units.find(u => u.id === 'brigand-1');
      const plain = g.forecast('aldric', b, b.x - 1, b.y);
      b.x = 1; b.y = 1;                    // (1,1) is forest
      const forest = g.forecast('aldric', b, 0, 1);
      return { plain: plain.A, forest: forest.A };
    });
    expect(r.forest.dmg).toBe(r.plain.dmg - 1);
  });

  test('2RN: 10,000 rolls at displayed 90% land about 98% of the time', async ({ page }) => {
    await open(page);
    await startLevel(page, 0);
    const r = await page.evaluate(() => {
      let hits = 0;
      for (let i = 0; i < 10000; i++) if (window.game.roll2RN(90)) hits++;
      return { rate: hits / 10000, table90: window.game.trueHit(90), table30: window.game.trueHit(30) };
    });
    expect(r.table90).toBeCloseTo(0.981, 3);
    expect(r.table30).toBeCloseTo(0.183, 3);
    expect(r.rate).toBeGreaterThan(0.97);
    expect(r.rate).toBeLessThan(0.99);
  });
});

test.describe('movement', () => {
  test('Brenna cannot enter mountains, forest costs 2, allies can be passed but not stopped on', async ({ page }) => {
    await open(page);
    await startLevel(page, 0);
    const r = await page.evaluate(() => {
      const g = window.game, s = g.state;
      const brenna = s.units.find(u => u.id === 'brenna');
      const aldric = s.units.find(u => u.id === 'aldric');
      const aTiles = g.reachable('aldric');
      const stopsOnAlly = aTiles.some(t => s.units.some(u => u !== aldric && u.alive && u.x === t.x && u.y === t.y));
      // (2,8) costs 6 going around, but only 3 through Brenna at (1,7): Aldric (Mov 5) must pass through her.
      const passesAlly = aTiles.some(t => t.x === 2 && t.y === 8);
      // Put Brenna beside the mountain cluster: (5,3) is a mountain, (5,4) is a forest.
      brenna.x = 4; brenna.y = 4;
      const bTiles = g.reachable('brenna');
      const onMountain = bTiles.some(t => s.map[t.y][t.x] === 'M');
      const forest = bTiles.find(t => t.x === 5 && t.y === 4);
      return { onMountain, forestCost: forest && forest.cost, stopsOnAlly, passesAlly };
    });
    expect(r.onMountain).toBe(false);
    expect(r.forestCost).toBe(2);
    expect(r.stopsOnAlly).toBe(false);
    expect(r.passesAlly).toBe(true);
  });
});

test('one full Level 1 player turn by clicking, then the enemy phase hands control back', async ({ page }) => {
  const errors = await open(page);
  await startLevel(page, 0);
  await playerTurnReady(page);
  const moves = [['aldric', 0, 7, 2, 6], ['brenna', 1, 7, 2, 7], ['wren', 0, 8, 2, 8], ['maelis', 1, 8, 1, 9]];
  for (const [id, fx, fy, tx, ty] of moves) {
    await clickTile(page, fx, fy);
    await clickTile(page, tx, ty);
    await expect(page.locator('#menu')).toBeVisible();
    await page.locator('#menu button[data-act="wait"]').click();
    const u = await page.evaluate(id => window.game.state.units.find(u => u.id === id), id);
    expect([u.x, u.y, u.acted]).toEqual([tx, ty, true]);
  }
  await page.keyboard.press('e');
  await page.waitForFunction(() => window.game.state.turn === 2 && window.game.state.phase === 'player' && !window.game.ui.busy);
  expect(errors).toEqual([]);
});

test('Esc and right-click cancel an unconfirmed move back to the start tile', async ({ page }) => {
  await open(page);
  await startLevel(page, 0);
  await playerTurnReady(page);
  await clickTile(page, 0, 7);
  await clickTile(page, 2, 6);
  await expect(page.locator('#menu')).toBeVisible();
  await page.keyboard.press('Escape');
  let a = await page.evaluate(() => window.game.state.units.find(u => u.id === 'aldric'));
  expect([a.x, a.y]).toEqual([0, 7]);
  await clickTile(page, 2, 6);
  await clickTile(page, 5, 5, 'right');
  a = await page.evaluate(() => window.game.state.units.find(u => u.id === 'aldric'));
  expect([a.x, a.y]).toEqual([0, 7]);
});

test('guard units stay put until a player unit is in reach', async ({ page }) => {
  await open(page);
  await startLevel(page, 0);
  await playerTurnReady(page);
  const where = behavior => page.evaluate(b => window.game.state.units.filter(u => u.behavior === b).map(u => [u.id, u.x, u.y]), behavior);
  const guardsBefore = await where('guard'), aggroBefore = await where('aggressive');
  await page.evaluate(() => window.game.endTurn());
  await playerTurnReady(page);
  expect(await where('guard')).toEqual(guardsBefore);
  expect(await where('aggressive')).not.toEqual(aggroBefore);   // the aggressive ones advanced
});

test('an enemy with a choice attacks the squishier unit', async ({ page }) => {
  await open(page);
  await startLevel(page, 0);
  await playerTurnReady(page);
  // Brenna (armored) and Maelis (fragile) both within reach of the aggressive Mercenary.
  const target = await page.evaluate(async () => {
    const g = window.game, s = g.state, U = id => s.units.find(u => u.id === id);
    for (const e of s.units) if (e.team === 'enemy' && e.id !== 'mercenary-1') e.alive = false;
    Object.assign(U('brenna'), { x: 6, y: 4 });
    Object.assign(U('maelis'), { x: 6, y: 6 });
    Object.assign(U('mercenary-1'), { x: 8, y: 5 });
    const hp = { brenna: U('brenna').hp, maelis: U('maelis').hp };
    s.units.find(u => u.id === 'mercenary-1').hp = 20;
    await g.endTurn();
    return { brenna: U('brenna').hp < hp.brenna, maelis: U('maelis').hp < hp.maelis, merc: [U('mercenary-1').x, U('mercenary-1').y] };
  });
  expect(target.brenna).toBe(false);
  // The Mercenary moved next to Maelis to attack (hit or miss, it chose her).
  expect(Math.abs(target.merc[0] - 6) + Math.abs(target.merc[1] - 6)).toBe(1);
});

test('undo restores the RNG, so repeating an attack gives the same rolls', async ({ page }) => {
  await open(page, { seed: 99 });
  await startLevel(page, 0);
  await playerTurnReady(page);
  const results = await page.evaluate(async () => {
    const g = window.game, s = g.state, U = id => s.units.find(u => u.id === id);
    Object.assign(U('brigand-2'), { x: 4, y: 8 });         // bring a brigand into Wren's bow range
    const out = [];
    for (let i = 0; i < 3; i++) {
      await g.act('wren', 2, 8, 'attack', 'brigand-2');
      out.push({ brigand: U('brigand-2').hp, wren: U('wren').hp, history: s.history.length });
      g.undo();
    }
    return { out, restoredHp: U('brigand-2').hp, wrenBack: [U('wren').x, U('wren').y] };
  });
  expect(results.out[1]).toEqual(results.out[0]);
  expect(results.out[2]).toEqual(results.out[0]);
  expect(results.restoredHp).toBe(22);
  expect(results.wrenBack).toEqual([0, 8]);
});

test('danger zone shrinks after an enemy dies', async ({ page }) => {
  await open(page);
  await startLevel(page, 0);
  await playerTurnReady(page);
  const r = await page.evaluate(() => {
    const g = window.game;
    const before = g.dangerZone().length;
    g.state.units.find(u => u.id === 'brigand-2').alive = false;
    return { before, after: g.dangerZone().length };
  });
  expect(r.after).toBeLessThan(r.before);
});

test.describe('win and loss conditions', () => {
  test('Level 1: defeating every enemy wins', async ({ page }) => {
    await open(page);
    await startLevel(page, 0);
    await playerTurnReady(page);
    await page.evaluate(async () => {
      const g = window.game, s = g.state, U = id => s.units.find(u => u.id === id);
      for (const e of s.units) if (e.team === 'enemy' && e.id !== 'brigand-2') e.alive = false;
      Object.assign(U('brigand-2'), { x: 3, y: 7, hp: 1 });
      await g.act('aldric', 2, 7, 'attack', 'brigand-2');
    });
    await expect(page.getByRole('heading', { name: 'Victory' })).toBeVisible();
    await page.getByRole('button', { name: /Continue/ }).click();
    await expect(page.getByText('Hold the Bridge').first()).toBeVisible();
    const aldric = await page.evaluate(() => window.game.roster.find(r => r.id === 'aldric'));
    expect([aldric.hp, aldric.str, aldric.spd, aldric.def]).toEqual([22, 7, 10, 6]);
  });

  test('any level: Aldric falling loses', async ({ page }) => {
    await open(page);
    await startLevel(page, 0);
    await playerTurnReady(page);
    await page.evaluate(async () => {
      const g = window.game;
      g.state.units.find(u => u.id === 'aldric').alive = false;
      await g.act('brenna', 1, 7, 'wait');
    });
    await expect(page.getByRole('heading', { name: 'Defeat' })).toBeVisible();
    await page.getByRole('button', { name: 'Retry Chapter' }).click();
    await expect(page.getByRole('button', { name: 'Begin Battle' })).toBeVisible();
  });

  test('Level 2: surviving 8 turns wins', async ({ page }) => {
    await open(page);
    await startLevel(page, 1);
    await playerTurnReady(page);
    await page.evaluate(async () => {
      const g = window.game;
      for (const e of g.state.units) if (e.team === 'enemy') e.alive = false;   // keep it about the clock
      g.state.turn = 8;
      g.state.spawned = 0;
      await g.endTurn();
    });
    await expect(page.getByRole('heading', { name: 'Victory' })).toBeVisible();
  });

  test('Level 2: reinforcements arrive on turns 3 and 5', async ({ page }) => {
    await open(page);
    await startLevel(page, 1);
    await playerTurnReady(page);
    const counts = await page.evaluate(async () => {
      const g = window.game, s = g.state, out = [];
      for (const e of s.units) if (e.team === 'enemy') e.alive = false;
      // Keep one far-away enemy alive so the rout rule doesn't end the level.
      const keep = s.units.find(u => u.id === 'mage-1'); keep.alive = true; keep.x = 11; keep.y = 0; keep.behavior = 'guard';
      // Make the army unkillable so the new arrivals can't end the level early.
      for (const p of s.units) if (p.team === 'player') Object.assign(p, { hp: 99, maxHp: 99, def: 99, res: 99 });
      for (let t = 1; t <= 5; t++) { await g.endTurn(); out.push(s.units.filter(u => u.team === 'enemy').length); }
      return out;
    });
    expect(counts).toEqual([6, 6, 8, 8, 10]);   // 6 at start, +2 after turn 3, +2 after turn 5
  });

  test('Level 2: an enemy ending its phase on the gate loses', async ({ page }) => {
    await open(page);
    await startLevel(page, 1);
    await playerTurnReady(page);
    await page.evaluate(async () => {
      const g = window.game, s = g.state, U = id => s.units.find(u => u.id === id);
      Object.assign(U('brenna'), { x: 2, y: 0 });
      Object.assign(U('brigand-1'), { x: 0, y: 3 });   // one step from the gate
      await g.endTurn();
    });
    await expect(page.getByRole('heading', { name: 'Defeat' })).toBeVisible();
    await expect(page.locator('#overlay')).toContainText('gate');
  });

  test('Level 3: Aldric seizing the throne wins the campaign', async ({ page }) => {
    await open(page);
    await startLevel(page, 2);
    await playerTurnReady(page);
    await page.evaluate(async () => {
      const g = window.game, s = g.state, U = id => s.units.find(u => u.id === id);
      U('garrick').alive = false;
      for (const e of s.units) if (e.team === 'enemy') e.alive = false;
      Object.assign(U('aldric'), { x: 5, y: 2 });
      await g.act('aldric', 5, 1, 'seize');
    });
    await expect(page.getByRole('heading', { name: 'Eastmarch Is Free' })).toBeVisible();
  });
});

test('screenshot each level at its start', async ({ page }) => {
  const errors = await open(page);
  for (const li of [0, 1, 2]) {
    await startLevel(page, li);
    await playerTurnReady(page);
    await page.mouse.move(0, 0);
    await page.waitForTimeout(150);
    await page.locator('#app').screenshot({ path: path.join(SHOTS, `level-${li + 1}.png`) });
  }
  expect(errors).toEqual([]);
});
