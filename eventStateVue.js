import { ref, computed, onMounted, onBeforeUnmount, provide, inject } from 'vue';

// ---- Provide / Inject ----
const STORE_KEY = Symbol('everystate');

/**
 * Provider: makes a store available to all descendant components via composables.
 * The store is created *outside* Vue. The provider is pure dependency injection.
 *
 * Call this in your root component's setup():
 *   provideStore(store);
 *
 * @param {object} store - An EveryState store instance
 */
export function provideStore(store) {
  provide(STORE_KEY, store);
}

/**
 * useStore: returns the EveryState store from the injection context.
 * Throws if called outside a component that called provideStore().
 *
 * @returns {object} The EveryState store
 */
export function useStore() {
  const store = inject(STORE_KEY);
  if (!store) {
    throw new Error(
      'useStore: no store found. Call provideStore(store) in an ancestor component\'s setup().'
    );
  }
  return store;
}

/**
 * usePath: subscribe to a dot-path in the store.
 * Creates a reactive ref that updates when the store value changes.
 * Returns a read-only computed for template use.
 *
 * @param {string} path - Dot-separated state path (e.g. 'user.name')
 * @returns {import('vue').ComputedRef} A computed ref with the current value
 */
export function usePath(path) {
  const store = useStore();
  const value = ref(store.get(path));
  let unsubscribe = null;

  onMounted(() => {
    unsubscribe = store.subscribe(path, (val) => {
      value.value = val;
    });
  });

  onBeforeUnmount(() => {
    if (unsubscribe) unsubscribe();
  });

  return computed(() => value.value);
}

/**
 * useIntent: returns a stable function that publishes a value to a path.
 * Does not need to be reactive - it just writes to the store.
 *
 * @param {string} path - Dot-separated intent path (e.g. 'intent.addTask')
 * @returns {(value: any) => any} A setter function
 */
export function useIntent(path) {
  const store = useStore();
  return (value) => store.set(path, value);
}

/**
 * useWildcard: subscribe to a wildcard path (e.g. 'state.tasks.*').
 * Re-renders whenever any child of that path changes.
 * The returned value is the parent object at the path prefix.
 *
 * @param {string} wildcardPath - e.g. 'state.tasks.*' or 'state.*'
 * @returns {import('vue').ComputedRef} A computed ref with the parent object
 */
export function useWildcard(wildcardPath) {
  const store = useStore();
  const parentPath = wildcardPath.endsWith('.*')
    ? wildcardPath.slice(0, -2)
    : wildcardPath;

  const value = ref(store.get(parentPath));
  let unsubscribe = null;

  onMounted(() => {
    unsubscribe = store.subscribe(wildcardPath, () => {
      value.value = store.get(parentPath);
    });
  });

  onBeforeUnmount(() => {
    if (unsubscribe) unsubscribe();
  });

  return computed(() => value.value);
}

/**
 * useAsync: trigger an async operation and subscribe to its status.
 * Returns reactive refs for data, status, error, plus execute and cancel functions.
 *
 * @param {string} path - Base path for the async operation
 * @returns {{ data: import('vue').ComputedRef, status: import('vue').ComputedRef, error: import('vue').ComputedRef, execute: Function, cancel: Function }}
 */
export function useAsync(path) {
  const store = useStore();

  const data = usePath(`${path}.data`);
  const status = usePath(`${path}.status`);
  const error = usePath(`${path}.error`);

  const execute = (fetcher) => store.setAsync(path, fetcher);
  const cancel = () => store.cancel(path);

  return { data, status, error, execute, cancel };
}
