// Short-lived in-memory cache for the catalogue reads every public page makes
// (all products, categories, projects, articles). On the shared host each of
// those is a MySQL round trip, which was most of the time to first byte.
// Any admin change clears it (server.js); TTL bounds what other Passenger
// workers may still show after an edit made through a different worker.
const TTL_MS = 60 * 1000;
const store = new Map();

// Wrap an async function so calls with the same arguments share one result for TTL_MS.
// Concurrent misses share the same promise; a failed call is not cached.
const wrap = (name, fn) => (...args) => {
    const key = `${name}:${JSON.stringify(args)}`;
    const hit = store.get(key);
    if (hit && hit.expires > Date.now()) return hit.promise;
    const promise = Promise.resolve().then(() => fn(...args));
    store.set(key, { promise, expires: Date.now() + TTL_MS });
    promise.catch(() => { if (store.get(key) && store.get(key).promise === promise) store.delete(key); });
    return promise;
};

const clear = () => store.clear();

module.exports = { wrap, clear };
