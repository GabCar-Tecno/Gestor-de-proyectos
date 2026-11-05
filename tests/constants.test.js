const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadConstants() {
  const sandbox = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'constants.js'), 'utf8'), sandbox);
  return sandbox.window.APP_CONSTANTS;
}

test('board ranks cancelled requirements after every other stage', () => {
  const { BOARD_RANK } = loadConstants();
  const others = Object.entries(BOARD_RANK.byStatus).filter(([id]) => id !== 'cancelado').map(([, rank]) => rank);
  assert.equal(typeof BOARD_RANK.byStatus.cancelado, 'number');
  assert.ok(BOARD_RANK.byStatus.cancelado > Math.max(...others, BOARD_RANK.other));
});
