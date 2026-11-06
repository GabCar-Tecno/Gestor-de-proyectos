const test = require('node:test');
const assert = require('node:assert/strict');

const constants = require('../constants.js');

const loadConstants = () => constants;

test('board ranks cancelled requirements after every other stage', () => {
  const { BOARD_RANK } = loadConstants();
  const others = Object.entries(BOARD_RANK.byStatus).filter(([id]) => id !== 'cancelado').map(([, rank]) => rank);
  assert.equal(typeof BOARD_RANK.byStatus.cancelado, 'number');
  assert.ok(BOARD_RANK.byStatus.cancelado > Math.max(...others, BOARD_RANK.other));
});

test('requirement file uploads accept Word and PDF formats up to 50 MB', () => {
  const { REQUIREMENT_FILE } = loadConstants();
  assert.deepEqual({ ...REQUIREMENT_FILE.contentTypes }, {
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.pdf': 'application/pdf'
  });
  assert.equal(REQUIREMENT_FILE.maxSizeBytes, 50 * 1024 * 1024);
});
