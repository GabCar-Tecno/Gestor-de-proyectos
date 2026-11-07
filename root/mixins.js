(function () {
  const root = typeof window !== 'undefined' ? window : globalThis;
  root.ROOT_MIXINS = [];

  function applyRootMixins(Component) {
    const proto = Component.prototype;
    const owners = new Map();
    root.ROOT_MIXINS.forEach((mixin, index) => {
      Object.getOwnPropertyNames(mixin).forEach((name) => {
        if (owners.has(name)) {
          throw new Error(`Root mixin method "${name}" is defined in mixins ${owners.get(name)} and ${index}`);
        }
        if (name in proto) {
          throw new Error(`Root mixin method "${name}" already exists on the component prototype`);
        }
        owners.set(name, index);
        Object.defineProperty(proto, name, {
          value: mixin[name],
          writable: true,
          configurable: true,
          enumerable: false
        });
      });
    });
  }

  root.applyRootMixins = applyRootMixins;
  if (typeof module !== 'undefined' && module.exports) module.exports = { applyRootMixins };
})();
