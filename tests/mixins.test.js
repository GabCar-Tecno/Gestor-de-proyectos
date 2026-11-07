const test = require('node:test');
const assert = require('node:assert/strict');

const { applyRootMixins } = require('../root/mixins.js');

const makeComponent = () => {
  class Component {
    existing() {
      return 'existing';
    }
  }
  return Component;
};

test.beforeEach(() => {
  globalThis.ROOT_MIXINS.length = 0;
});

test('applies two mixins without collisions onto the prototype', () => {
  globalThis.ROOT_MIXINS.push({ alpha() { return this.base + 'a'; } });
  globalThis.ROOT_MIXINS.push({ beta() { return this.base + 'b'; } });
  const Component = makeComponent();
  applyRootMixins(Component);
  const instance = Object.assign(new Component(), { base: 'x' });
  assert.equal(instance.alpha(), 'xa');
  assert.equal(instance.beta(), 'xb');
  assert.equal(instance.existing(), 'existing');
});

test('throws naming the method when two mixins define the same name', () => {
  globalThis.ROOT_MIXINS.push({ shared() {} });
  globalThis.ROOT_MIXINS.push({ shared() {} });
  assert.throws(() => applyRootMixins(makeComponent()), (error) => {
    assert.ok(error instanceof Error);
    assert.match(error.message, /"shared"/);
    return true;
  });
});

test('throws naming the method when a mixin collides with the prototype', () => {
  globalThis.ROOT_MIXINS.push({ existing() {} });
  assert.throws(() => applyRootMixins(makeComponent()), (error) => {
    assert.ok(error instanceof Error);
    assert.match(error.message, /"existing"/);
    return true;
  });
});
