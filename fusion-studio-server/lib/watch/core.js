/**
 * Centralized chokidar subscription manager.
 *
 * One chokidar instance per unique watched path. All subscribers on the same
 * path share the instance. The first subscriber's options win for that path
 * (this is intentional, not a bug — options are path-level, not subscriber-level).
 *
 * API:
 *   subscribe({ id, path, options, handler }) → unsubscribe function
 *   unsubscribe(id)
 *   closeAll()
 */

const chokidar = require('chokidar');
const { runSafely } = require('../background-services/safety');

const DEFAULT_OPTIONS = {
  followSymlinks: true,
  ignoreInitial: true,
  awaitWriteFinish: { stabilityThreshold: 300, pollInterval: 100 },
  ignored: [],
};

// path → { watcher, subscribers: Map(id, { handler, options }) }
const instances = new Map();

// id → path (reverse lookup for unsubscribe)
const subscriberPaths = new Map();

function getOptionsKey(opts) {
  // For equality checking — stringify shallowly
  return JSON.stringify({
    depth: opts.depth,
    ignored: opts.ignored,
    awaitWriteFinish: opts.awaitWriteFinish,
    followSymlinks: opts.followSymlinks,
    ignoreInitial: opts.ignoreInitial,
  });
}

function subscribe({ id, path: watchPath, options = {}, handler }) {
  if (!id) throw new Error('subscribe() requires an id');
  if (!watchPath) throw new Error('subscribe() requires a path');
  if (typeof handler !== 'function') throw new Error('subscribe() requires a handler function');

  if (subscriberPaths.has(id)) {
    console.warn(`[WatchCore] Subscriber "${id}" already exists — removing previous subscription`);
    unsubscribe(id);
  }

  const mergedOptions = { ...DEFAULT_OPTIONS, ...options };

  let instance = instances.get(watchPath);
  if (!instance) {
    instance = {
      watcher: chokidar.watch(watchPath, mergedOptions),
      subscribers: new Map(),
      options: mergedOptions,
    };

    instance.watcher.on('all', (event, filePath) => {
      for (const [subId, sub] of instance.subscribers) {
        runSafely(`WatchCore:${subId}`, () => sub.handler(event, filePath));
      }
    });

    instance.watcher.on('error', (err) => {
      console.error(`[WatchCore] Watcher error for ${watchPath}:`, err.message);
    });

    instances.set(watchPath, instance);
  } else {
    // Warn if options differ from the first subscriber's options
    const existingKey = getOptionsKey(instance.options);
    const newKey = getOptionsKey(mergedOptions);
    if (existingKey !== newKey) {
      console.warn(
        `[WatchCore] Subscriber "${id}" on ${watchPath} requested options different from ` +
        `the existing subscriber. First subscriber's options win.`
      );
    }
  }

  instance.subscribers.set(id, { handler, options: mergedOptions });
  subscriberPaths.set(id, watchPath);

  console.log(`[WatchCore] Subscribed "${id}" to ${watchPath} (${instance.subscribers.size} subscriber(s))`);

  return function unsubscribeById() {
    unsubscribe(id);
  };
}

function unsubscribe(id) {
  const watchPath = subscriberPaths.get(id);
  if (!watchPath) return;

  const instance = instances.get(watchPath);
  if (instance) {
    instance.subscribers.delete(id);
    console.log(`[WatchCore] Unsubscribed "${id}" from ${watchPath} (${instance.subscribers.size} remaining)`);

    if (instance.subscribers.size === 0) {
      instance.watcher.close();
      instances.delete(watchPath);
      console.log(`[WatchCore] Closed watcher for ${watchPath}`);
    }
  }

  subscriberPaths.delete(id);
}

function closeAll() {
  for (const [watchPath, instance] of instances) {
    instance.watcher.close();
    console.log(`[WatchCore] Closed watcher for ${watchPath}`);
  }
  instances.clear();
  subscriberPaths.clear();
}

module.exports = { subscribe, unsubscribe, closeAll };
