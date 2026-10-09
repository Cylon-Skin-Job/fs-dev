const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { createRequire } = require('node:module');
const path = require('node:path');
const fromRepo = createRequire(path.join(process.cwd(), 'package.json'));
const { SessionManager } = fromRepo('./fusion-studio-server/lib/thread/session-manager');
(async () => {
  const keepAlive = setInterval(() => {}, 1000);
  const sessions = new SessionManager({providerCloseGraceMs:1,providerCloseForceMs:1});
  const wire = new EventEmitter(); wire.killed=false;
  wire.kill=()=>{wire.killed=true;return true;};
  const owner=sessions.openSession('review-listeners',null,wire);
  const outcomes=[];
  try {
    for(let attempt=1;attempt<=3;attempt++) {
      await assert.rejects(sessions.closeSessionAndWait('review-listeners'), /Provider process did not close/);
      outcomes.push({attempt,exit:wire.listenerCount('exit'),close:wire.listenerCount('close'),sameOwner:sessions.getSession('review-listeners')===owner,state:owner.state,closePromise:!!owner.closePromise,idleTimers:sessions.timeouts.size});
      assert.equal(wire.listenerCount('exit'),attempt); assert.equal(wire.listenerCount('close'),attempt);
      assert.equal(sessions.getSession('review-listeners'),owner);
    }
    console.log(JSON.stringify(outcomes));
  } finally { clearInterval(keepAlive);wire.removeAllListeners();sessions.activeSessions.clear();for(const timer of sessions.timeouts.values())clearTimeout(timer);sessions.timeouts.clear(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
