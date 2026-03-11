/**
 * @everystate/vue: integration tests via @everystate/test
 *
 * Tests the store-side patterns that Vue composables consume.
 * Since EveryState is the IR, testing the IR proves the composables work.
 * The composables are thin wrappers: usePath = subscribe + ref + computed,
 * useIntent = set, useWildcard = subscribe wildcard + get parent.
 *
 * Vue-specific behavior (template re-renders, provide/inject) requires
 * a Vue test environment and is outside the scope of these tests.
 */

import { createEventTest, runTests } from '@everystate/test';
import { createEveryState } from '@everystate/core';

const results = runTests({

  // -- usePath patterns (ref + computed) --------------------------------

  'usePath: subscribe to exact path': () => {
    const t = createEventTest({ user: { name: 'Alice', age: 30 } });
    t.trigger('user.name', 'Bob');
    t.assertPath('user.name', 'Bob');
    t.assertType('user.name', 'string');
    t.assertEventFired('user.name', 1);
  },

  'usePath: nested path subscription': () => {
    const t = createEventTest({ app: { settings: { theme: 'dark' } } });
    t.trigger('app.settings.theme', 'light');
    t.assertPath('app.settings.theme', 'light');
    t.assertEventFired('app.settings.theme', 1);
  },

  'usePath: unsubscribe stops notifications (onBeforeUnmount)': () => {
    const store = createEveryState({ count: 0 });
    let fires = 0;
    const unsub = store.subscribe('count', () => { fires++; });
    store.set('count', 1);
    unsub(); // simulates onBeforeUnmount cleanup
    store.set('count', 2);
    if (fires !== 1) throw new Error(`Expected 1 fire after unsub, got ${fires}`);
    store.destroy();
  },

  // -- useIntent patterns -----------------------------------------------

  'useIntent: set value at path': () => {
    const t = createEventTest({ intent: { addTask: null } });
    t.trigger('intent.addTask', { text: 'Buy milk', done: false });
    t.assertPath('intent.addTask', { text: 'Buy milk', done: false });
    t.assertType('intent.addTask', 'object');
  },

  'useIntent: reset intent after processing': () => {
    const t = createEventTest({ intent: { submit: null } });
    t.trigger('intent.submit', { form: 'login' });
    t.trigger('intent.submit', null);
    t.assertPath('intent.submit', null);
  },

  // -- useWildcard patterns ---------------------------------------------

  'useWildcard: fires on any child change': () => {
    const store = createEveryState({ state: { tasks: {} } });
    let fires = 0;
    store.subscribe('state.tasks.*', () => { fires++; });
    store.set('state.tasks.t1', { text: 'A', done: false });
    store.set('state.tasks.t2', { text: 'B', done: false });
    if (fires !== 2) throw new Error(`Expected 2 fires, got ${fires}`);
    store.destroy();
  },

  'useWildcard: get parent returns full object': () => {
    const t = createEventTest({ state: { tasks: { t1: 'A', t2: 'B' } } });
    t.trigger('state.tasks.t3', 'C');
    t.assertPath('state.tasks', { t1: 'A', t2: 'B', t3: 'C' });
  },

  // -- useAsync patterns ------------------------------------------------

  'useAsync: loading → success lifecycle': async () => {
    const store = createEveryState({});
    await store.setAsync('users', async () => [{ id: 1, name: 'Alice' }]);
    if (store.get('users.status') !== 'success') throw new Error('Expected success');
    if (!Array.isArray(store.get('users.data'))) throw new Error('Expected array');
    store.destroy();
  },

  'useAsync: loading → error lifecycle': async () => {
    const store = createEveryState({});
    try {
      await store.setAsync('data', async () => { throw new Error('fail'); });
    } catch {}
    if (store.get('data.status') !== 'error') throw new Error('Expected error');
    store.destroy();
  },

  'useAsync: status/data/error paths are typed': () => {
    const t = createEventTest({});
    t.store.setMany({
      'users.status': 'success',
      'users.data': [{ id: 1, name: 'Alice' }],
      'users.error': null,
    });
    t.assertType('users.status', 'string');
    t.assertArrayOf('users.data', { id: 'number', name: 'string' });
  },

  // -- Provider pattern (provide/inject) --------------------------------

  'provider: store as external store (provide/inject compat)': () => {
    const store = createEveryState({ count: 0 });
    // Simulate provide/inject + ref + computed contract
    let snapshot = store.get('count');
    const subscribe = (cb) => store.subscribe('count', () => {
      snapshot = store.get('count');
      cb();
    });
    let renderCount = 0;
    const unsub = subscribe(() => { renderCount++; });

    store.set('count', 1);
    if (snapshot !== 1) throw new Error('Snapshot should be 1');
    if (renderCount !== 1) throw new Error('Should have rendered once');

    store.set('count', 2);
    if (snapshot !== 2) throw new Error('Snapshot should be 2');
    if (renderCount !== 2) throw new Error('Should have rendered twice');

    unsub();
    store.destroy();
  },

  // -- batch (Vue nextTick compat) --------------------------------------

  'batch: atomic updates (Vue nextTick compat)': () => {
    const t = createEventTest({ form: { name: '', email: '' } });
    t.store.batch(() => {
      t.trigger('form.name', 'Alice');
      t.trigger('form.email', 'alice@example.com');
    });
    t.assertPath('form.name', 'Alice');
    t.assertPath('form.email', 'alice@example.com');
    // Each path fires once after batch
    t.assertEventFired('form.name', 1);
    t.assertEventFired('form.email', 1);
  },

  'batch: setMany for atomic route updates': () => {
    const t = createEventTest({});
    t.store.setMany({
      'ui.route.view': 'dashboard',
      'ui.route.path': '/dashboard',
      'ui.route.params': {},
    });
    t.assertPath('ui.route.view', 'dashboard');
    t.assertPath('ui.route.path', '/dashboard');
    t.assertType('ui.route.view', 'string');
  },

  // -- type generation from Vue patterns --------------------------------

  'types: Vue app state shape': () => {
    const t = createEventTest({
      user: { name: 'Alice', email: 'alice@example.com', role: 'admin' },
      tasks: [{ id: 1, text: 'Buy milk', done: false }],
      ui: { theme: 'dark', sidebarOpen: true },
    });
    t.assertShape('user', { name: 'string', email: 'string', role: 'string' });
    t.assertArrayOf('tasks', { id: 'number', text: 'string', done: 'boolean' });
    t.assertShape('ui', { theme: 'string', sidebarOpen: 'boolean' });

    const types = t.getTypeAssertions();
    if (types.length !== 3) throw new Error(`Expected 3 type assertions, got ${types.length}`);
  },

  // -- Edge cases ---------------------------------------------------------

  'edge: setting same value still notifies subscribers': () => {
    const store = createEveryState({ count: 1 });
    let fires = 0;
    store.subscribe('count', () => { fires++; });
    store.set('count', 1);
    store.set('count', 1);
    if (fires !== 2) throw new Error(`Expected 2 fires, got ${fires}`);
    store.destroy();
  },

  'edge: deep path auto-creates intermediate objects': () => {
    // Verify that setting a deeply nested path on an empty store
    // creates the full chain of parent objects automatically
    const store = createEveryState({});
    store.set('a.b.c.d', 'deep');
    if (store.get('a.b.c.d') !== 'deep') throw new Error('Deep path not created');
    if (typeof store.get('a.b.c') !== 'object') throw new Error('Intermediate c not an object');
    if (typeof store.get('a.b') !== 'object') throw new Error('Intermediate b not an object');
    store.destroy();
  },

  'edge: set null is a valid value': () => {
    const store = createEveryState({ data: { items: [1, 2, 3] } });
    store.set('data.items', null);
    if (store.get('data.items') !== null) throw new Error('Expected null');
    store.destroy();
  },

  'edge: set undefined is a valid value': () => {
    const store = createEveryState({ flag: true });
    store.set('flag', undefined);
    if (store.get('flag') !== undefined) throw new Error('Expected undefined');
    store.destroy();
  },

  'edge: multiple subscribers on same path fire independently': () => {
    const store = createEveryState({ x: 0 });
    let firesA = 0;
    let firesB = 0;
    const unsubA = store.subscribe('x', () => { firesA++; });
    const unsubB = store.subscribe('x', () => { firesB++; });

    store.set('x', 1);
    if (firesA !== 1 || firesB !== 1) throw new Error('Both should fire once');

    // Unsubscribing one does not affect the other
    unsubA();
    store.set('x', 2);
    if (firesA !== 1) throw new Error('A should stay at 1 after unsub');
    if (firesB !== 2) throw new Error('B should fire again');

    unsubB();
    store.destroy();
  },

  'edge: get/set after destroy throws': () => {
    // Important for onBeforeUnmount timing: if a component tries to
    // read/write after the store is destroyed, it should fail loudly
    // rather than silently corrupt state
    const store = createEveryState({ x: 1 });
    store.destroy();

    let getThrew = false;
    try { store.get('x'); } catch { getThrew = true; }
    if (!getThrew) throw new Error('get() should throw after destroy');

    let setThrew = false;
    try { store.set('x', 2); } catch { setThrew = true; }
    if (!setThrew) throw new Error('set() should throw after destroy');
  },

  'edge: subscribe after destroy throws': () => {
    const store = createEveryState({ x: 1 });
    store.destroy();

    let threw = false;
    try { store.subscribe('x', () => {}); } catch { threw = true; }
    if (!threw) throw new Error('subscribe() should throw after destroy');
  },

  'edge: realistic Vue app state shape': () => {
    // A full Vue app with auth, routing, entities, and UI state
    const t = createEventTest({
      auth: { user: null, token: null, isAuthenticated: false },
      router: { view: 'home', path: '/', params: {} },
      entities: { posts: {}, comments: {} },
      ui: { theme: 'dark', sidebarOpen: false, modal: null, loading: false },
    });

    // Simulate login flow
    t.trigger('auth.user', { id: 1, name: 'Alice', role: 'admin' });
    t.trigger('auth.token', 'jwt-abc-123');
    t.trigger('auth.isAuthenticated', true);
    t.assertPath('auth.isAuthenticated', true);
    t.assertShape('auth.user', { id: 'number', name: 'string', role: 'string' });

    // Simulate route change
    t.trigger('router.view', 'dashboard');
    t.trigger('router.path', '/dashboard');
    t.assertPath('router.view', 'dashboard');

    // Simulate entity loading
    t.trigger('entities.posts', { p1: { title: 'Hello', body: 'World' } });
    t.assertShape('entities.posts.p1', { title: 'string', body: 'string' });

    // Simulate UI toggles
    t.trigger('ui.sidebarOpen', true);
    t.trigger('ui.modal', 'confirm-delete');
    t.assertPath('ui.modal', 'confirm-delete');
    t.assertType('ui.loading', 'boolean');
  },
});

if (results.failed > 0) process.exit(1);
