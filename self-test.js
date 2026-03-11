/**
 * @everystate/vue: zero-dependency self-test
 *
 * Since the Vue adapter uses Vue's provide/inject, ref, computed, and
 * lifecycle hooks (which require a Vue runtime), this self-test verifies:
 * 1. The store-side patterns that the composables consume work correctly
 * 2. The subscribe + get pattern (usePath)
 * 3. The set pattern (useIntent)
 * 4. The wildcard subscribe pattern (useWildcard)
 * 5. The setAsync lifecycle pattern (useAsync)
 *
 * The composables themselves (usePath, useIntent, useWildcard, useAsync)
 * are thin wrappers around store.subscribe + Vue's ref/computed.
 * Testing the store patterns proves the composables will work.
 */

import { createEveryState } from '@everystate/core';

let passed = 0;
let failed = 0;

function assert(label, condition) {
  if (condition) {
    console.log(`  [PASS] ${label}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${label}`);
    failed++;
  }
}

function section(title) {
  console.log(`\n${title}`);
}

// -- 1. usePath pattern: subscribe + get (ref + computed) ---------------

section('1. usePath pattern: subscribe + get');

const s1 = createEveryState({ user: { name: 'Alice' } });
let s1snap = s1.get('user.name');
const unsub1 = s1.subscribe('user.name', () => { s1snap = s1.get('user.name'); });
assert('initial snapshot', s1snap === 'Alice');

s1.set('user.name', 'Bob');
assert('snapshot updates on set', s1snap === 'Bob');

unsub1();
s1.set('user.name', 'Charlie');
assert('unsubscribe stops updates', s1snap === 'Bob');
s1.destroy();

// -- 2. useIntent pattern: stable setter --------------------------------

section('2. useIntent pattern: stable setter');

const s2 = createEveryState({ intent: { addTask: null } });
const setter = (value) => s2.set('intent.addTask', value);
setter({ text: 'Buy milk' });
assert('setter writes to path', s2.get('intent.addTask').text === 'Buy milk');

setter(null);
assert('setter clears value', s2.get('intent.addTask') === null);
s2.destroy();

// -- 3. useWildcard pattern: subscribe wildcard + get parent ------------

section('3. useWildcard pattern: wildcard subscribe');

const s3 = createEveryState({ state: { tasks: { t1: 'A', t2: 'B' } } });
let wildcardFires = 0;
const unsub3 = s3.subscribe('state.tasks.*', () => {
  wildcardFires++;
});

s3.set('state.tasks.t1', 'A updated');
assert('wildcard fires on child change', wildcardFires === 1);

s3.set('state.tasks.t3', 'C');
assert('wildcard fires on new child', wildcardFires === 2);

const parent = s3.get('state.tasks');
assert('get parent returns object', typeof parent === 'object');
assert('parent has t1', parent.t1 === 'A updated');
assert('parent has t3', parent.t3 === 'C');

unsub3();
s3.destroy();

// -- 4. useAsync pattern: setAsync lifecycle ----------------------------

section('4. useAsync pattern: setAsync lifecycle');

const s4 = createEveryState({});
const promise = s4.setAsync('users', async () => [{ id: 1, name: 'Alice' }]);

// During loading
assert('loading: status = loading', s4.get('users.status') === 'loading');
assert('loading: error = null', s4.get('users.error') === null);

await promise;

// After success
assert('success: status = success', s4.get('users.status') === 'success');
assert('success: data is array', Array.isArray(s4.get('users.data')));
assert('success: data[0].name = Alice', s4.get('users.data')[0].name === 'Alice');
s4.destroy();

// -- 5. useAsync error pattern ------------------------------------------

section('5. useAsync error pattern');

const s5 = createEveryState({});
try {
  await s5.setAsync('data', async () => { throw new Error('Network error'); });
} catch {}
assert('error: status = error', s5.get('data.status') === 'error');
assert('error: error message exists', typeof s5.get('data.error') === 'string' || s5.get('data.error') instanceof Error);
s5.destroy();

// -- 6. Provider pattern: store as provide/inject -----------------------

section('6. Provider pattern: store as external dependency');

const s6 = createEveryState({ count: 0 });
// The provider uses Vue's provide/inject to pass the store.
// We verify the store is usable as an external store with subscribe + get.
const subscribe = (onStoreChange) => s6.subscribe('count', () => onStoreChange());
const getSnapshot = () => s6.get('count');

let latestSnapshot = getSnapshot();
const unsub6 = subscribe(() => { latestSnapshot = getSnapshot(); });

s6.set('count', 10);
assert('external store subscribe works', latestSnapshot === 10);

s6.set('count', 20);
assert('external store re-fires', latestSnapshot === 20);

unsub6();
s6.destroy();

// -- 7. Batch pattern (Vue nextTick compat) -----------------------------

section('7. batch pattern (Vue nextTick compat)');

const s7 = createEveryState({ a: 0, b: 0 });
let renderCount = 0;
s7.subscribe('a', () => { renderCount++; });
s7.subscribe('b', () => { renderCount++; });

s7.batch(() => {
  s7.set('a', 1);
  s7.set('b', 2);
});
assert('batch: 2 subscribers fire once each', renderCount === 2);
assert('batch: a = 1', s7.get('a') === 1);
assert('batch: b = 2', s7.get('b') === 2);
s7.destroy();

// -- 8. onBeforeUnmount pattern: unsubscribe on cleanup ----------------

section('8. Unsubscribe pattern (onBeforeUnmount simulation)');

const s8 = createEveryState({ x: 0 });
let s8fires = 0;
const unsub8 = s8.subscribe('x', () => { s8fires++; });

s8.set('x', 1);
assert('before unsub: fires', s8fires === 1);

// Simulate onBeforeUnmount
unsub8();
s8.set('x', 2);
assert('after unsub: stops firing', s8fires === 1);
assert('value still updated in store', s8.get('x') === 2);
s8.destroy();

// -- Summary ------------------------------------------------------------

console.log(`\n@everystate/vue v1.0.0 self-test`);
if (failed > 0) {
  console.error(`[FAIL] ${failed} assertion(s) failed, ${passed} passed`);
  process.exit(1);
} else {
  console.log(`[PASS] ${passed} assertions passed`);
}
