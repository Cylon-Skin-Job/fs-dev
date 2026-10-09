'use strict';

function createServerRuntimeActivation() {
  let settle;
  let state = 'pending';
  const settled = new Promise((resolve) => { settle = resolve; });

  async function wait() {
    const activated = await settled;
    if (!activated) throw new Error('server runtime unavailable');
  }

  function activate() {
    if (state !== 'pending') throw new Error('server runtime activation is already settled');
    state = 'active';
    settle(true);
  }

  function fail() {
    if (state !== 'pending') return;
    state = 'failed';
    settle(false);
  }

  return Object.freeze({ wait, activate, fail });
}

module.exports = { createServerRuntimeActivation };
