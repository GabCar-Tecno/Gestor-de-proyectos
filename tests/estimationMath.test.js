const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadEstimationMath() {
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  for (const file of ['constants.js', 'estimationMath.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), sandbox);
  }
  return sandbox.window.ESTIMATION_MATH;
}

const { excelRoundUp, lineMetrics, activityWithHoursMetrics, estimationTotals } = loadEstimationMath();

const complexity = { optimistic_weight: 1, most_probable_weight: 4, pessimistic_weight: 1 };
const params = { decimals: 1, alertRatio: 0.3, dailyHours: 8, dedication: 0.9 };
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);

test('excelRoundUp rounds away from zero and ignores float noise', () => {
  assert.equal(excelRoundUp(1.21, 1), 1.3);
  assert.equal(excelRoundUp(1.2, 1), 1.2);
  assert.equal(excelRoundUp(1.1, 1), 1.1);
  assert.equal(excelRoundUp(0.1 + 0.2, 1), 0.3);
  assert.equal(excelRoundUp(2, 0), 2);
  assert.equal(excelRoundUp(2.0001, 0), 3);
  assert.equal(excelRoundUp(1.001, 2), 1.01);
});

test('lineMetrics returns null for empty or non numeric hours', () => {
  assert.equal(lineMetrics('', complexity, 1, 0.3), null);
  assert.equal(lineMetrics(null, complexity, 1, 0.3), null);
  assert.equal(lineMetrics(undefined, complexity, 1, 0.3), null);
  assert.equal(lineMetrics('abc', complexity, 1, 0.3), null);
});

test('lineMetrics with zero hours keeps the optimistic scenario at zero', () => {
  const m = lineMetrics(0, complexity, 1, 0.3);
  assert.equal(m.optimistic, 0);
  assert.equal(m.mostProbable, 0);
  assert.equal(m.pessimistic, 1);
  near(m.statistical, 1.2);
  near(m.stddev, 1 / 12);
  assert.equal(m.needsReview, false);
});

test('lineMetrics with positive hours weights the three scenarios and adds one', () => {
  const m = lineMetrics(4, complexity, 1, 0.3);
  assert.equal(m.optimistic, 3);
  assert.equal(m.mostProbable, 4);
  assert.equal(m.pessimistic, 5);
  near(m.statistical, 5);
  near(m.stddev, 2 / 12);
  assert.equal(lineMetrics('4', complexity, 1, 0.3).statistical, m.statistical);
});

test('lineMetrics flags needsReview only when the deviation is strictly above the ratio', () => {
  assert.equal(lineMetrics(3, complexity, 1, 0.3).needsReview, true);
  assert.equal(lineMetrics(4, complexity, 1, 0.3).needsReview, false);
  assert.equal(lineMetrics(10, complexity, 1, 0.1).needsReview, false);
  assert.equal(lineMetrics(10, complexity, 1, 0.09).needsReview, true);
  assert.equal(lineMetrics(0, complexity, 1, 0).needsReview, false);
});

test('activityWithHoursMetrics ignores sections and missing complexity', () => {
  assert.equal(activityWithHoursMetrics({ kind: 'section', hours: '3' }, complexity, params), null);
  assert.equal(activityWithHoursMetrics({ kind: 'activity', hours: '3' }, null, params), null);
  assert.equal(activityWithHoursMetrics({ kind: 'activity', hours: '' }, complexity, params), null);
  near(activityWithHoursMetrics({ kind: 'activity', hours: '3' }, complexity, params).statistical, 4);
});

test('estimationTotals sums sections, empty activities and activity types', () => {
  const lines = [
    { kind: 'section', typeId: '', hours: '' },
    { kind: 'activity', typeId: 'dev', hours: '4' },
    { kind: 'activity', typeId: 'dev', hours: '3' },
    { kind: 'activity', typeId: 'qa', hours: '0' },
    { kind: 'activity', typeId: 'dev', hours: '' },
    { kind: 'activity', typeId: 'qa', hours: '2' }
  ];
  const totals = estimationTotals(lines, complexity, params);
  assert.deepEqual(totals.metrics.map((m) => m === null), [true, false, false, false, true, false]);
  assert.equal(totals.developer, 9);
  near(totals.statistical, 13.2);
  assert.equal(totals.review, 2);
  assert.deepEqual({ ...totals.byType }, { dev: 7, qa: 2 });
  near(totals.dedicated, 7.2);
  near(totals.developerDays, 9 / 7.2);
  near(totals.statisticalDays, 13.2 / 7.2);
});

test('estimationTotals with no hours yields zero totals and null days when nothing is dedicated', () => {
  const totals = estimationTotals([{ kind: 'section' }, { kind: 'activity', typeId: 'dev', hours: '' }], complexity, { ...params, dedication: 0 });
  assert.equal(totals.developer, 0);
  assert.equal(totals.statistical, 0);
  assert.equal(totals.review, 0);
  assert.deepEqual({ ...totals.byType }, {});
  assert.equal(totals.developerDays, null);
  assert.equal(totals.statisticalDays, null);
});
