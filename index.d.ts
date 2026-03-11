/**
 * @everystate/vue
 *
 * Vue adapter for EveryState with composables.
 * Built on Vue 3's provide/inject, ref, computed, and lifecycle hooks.
 */

import type { EveryStateStore } from '@everystate/core';
import type { ComputedRef } from 'vue';

/**
 * Provider: makes a store available to all descendant components via composables.
 * The store is created *outside* Vue. The provider is pure dependency injection.
 *
 * Call this in your root component's setup():
 *   provideStore(store);
 */
export function provideStore(store: EveryStateStore): void;

/**
 * Returns the EveryState store from the injection context.
 * Throws if called outside a component that called provideStore().
 */
export function useStore(): EveryStateStore;

/**
 * Subscribe to a dot-path in the store.
 * Creates a reactive ref that updates when the store value changes.
 * Returns a read-only computed for template use.
 *
 * @param path - Dot-separated state path (e.g. 'user.name')
 * @returns A computed ref with the current value at the path
 */
export function usePath(path: string): ComputedRef<any>;

/**
 * Returns a stable function that publishes a value to a path.
 * Does not need to be reactive - it just writes to the store.
 *
 * @param path - Dot-separated intent path (e.g. 'intent.addTask')
 * @returns A setter function
 */
export function useIntent(path: string): (value: any) => any;

/**
 * Subscribe to a wildcard path (e.g. 'state.*').
 * Re-renders whenever any child of that path changes.
 * The returned value is the parent object at the path prefix.
 *
 * @param wildcardPath - e.g. 'state.tasks.*' or 'state.*'
 * @returns A computed ref with the parent object
 */
export function useWildcard(wildcardPath: string): ComputedRef<any>;

/**
 * Trigger an async operation and subscribe to its status.
 *
 * @param path - Base path for the async operation
 */
export function useAsync(path: string): {
  data: ComputedRef<any>;
  status: ComputedRef<string | undefined>;
  error: ComputedRef<any>;
  execute: (fetcher: (signal: AbortSignal) => Promise<any>) => Promise<any>;
  cancel: () => void;
};
