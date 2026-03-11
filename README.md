# @everystate/vue v1.0.3

[![Tests](https://github.com/ImsirovicAjdin/everystate-vue/actions/workflows/tests.yml/badge.svg)](https://github.com/ImsirovicAjdin/everystate-vue/actions/workflows/tests.yml)
[![npm](https://img.shields.io/npm/v/@everystate/vue)](https://www.npmjs.com/package/@everystate/vue)

**Vue 3 adapter for EveryState with composables**

Use EveryState in Vue with `provideStore`, `usePath`, `useIntent`, `useWildcard`, and `useAsync` composables.
Built on Vue 3's `provide`/`inject`, `ref`, `computed`, and lifecycle hooks.

## Installation

```bash
npm install @everystate/vue @everystate/core vue
```

> **Zero external dependencies** - `@everystate/vue` only depends on `@everystate/core` (same namespace) and Vue as peer dependencies. For its self-test and integration tests, it uses `@everystate/test` (also same namespace). No third-party packages required.

## Quick Start

```vue
<!-- App.vue -->
<script setup>
import { createEveryState } from '@everystate/core';
import { provideStore } from '@everystate/vue';

const store = createEveryState({ count: 0 });
provideStore(store);
</script>

<template>
  <Counter />
</template>
```

```vue
<!-- Counter.vue -->
<script setup>
import { usePath, useIntent } from '@everystate/vue';

const count = usePath('count');
const setCount = useIntent('count');
</script>

<template>
  <div>
    <p>Count: {{ count }}</p>
    <button @click="setCount(count + 1)">Increment</button>
  </div>
</template>
```

## Composables

- **`provideStore(store)`** - Makes the store available to all descendant components. Call in your root component's `setup()`.
- **`usePath(path)`** - Subscribe to a dot-path. Returns a read-only `computed` that updates when the path changes.
- **`useIntent(path)`** - Returns a stable setter function for a path. Just writes to the store.
- **`useWildcard(path)`** - Subscribe to a wildcard path (e.g. `'user.*'`). Returns a `computed` with the parent object.
- **`useAsync(path)`** - Returns `{ data, status, error, execute, cancel }` as computed refs for async operations.
- **`useStore()`** - Returns the raw store from the injection context.

## How It Works

### `usePath`: EventState → Vue Reactivity

```js
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
```

The contract:

1. Create a `ref` with the current value from the store
2. Subscribe to the path when the component mounts
3. Update the `ref` when the store notifies
4. Unsubscribe when the component unmounts
5. Return a `computed` for read-only access

When `store.set(path, value)` is called, EventState fires the subscription. We update the `ref`. Vue's reactivity system detects the change and re-renders.

### `useIntent`: Vue → EventState

```js
export function useIntent(path) {
  const store = useStore();
  return (value) => store.set(path, value);
}
```

Simple. It doesn't need to be reactive. It just returns a function that writes to the store.

## Comparison to Pinia

| Concern | Pinia | EveryState + Vue |
|---------|-------|------------------|
| **Reactivity** | Automatic (proxy-based) | Explicit (subscribe + ref) |
| **Actions** | Store methods | Store subscribers |
| **Framework coupling** | Vue-only | Framework-agnostic |
| **DI mechanism** | `defineStore` | `provide`/`inject` |
| **Testing** | Needs Vue test utils | Pure state in → state out |
| **DevTools** | Vue DevTools integration | Path introspection built-in |

**Use Pinia when:** you're building a Vue-only app, you want automatic reactivity tracking, you want Vue DevTools integration.

**Use EventState when:** you need framework independence, you want explicit testable boundaries, you're sharing state across multiple rendering layers, or you prefer intent-driven architecture.

## Documentation

Full documentation available at [everystate.dev](https://everystate.dev).

## Ecosystem

| Package | Description | License |
|---|---|---|
| [@everystate/aliases](https://www.npmjs.com/package/@everystate/aliases) | Ergonomic single-character and short-name DOM aliases for vanilla JS | MIT |
| [@everystate/angular](https://www.npmjs.com/package/@everystate/angular) | Angular adapter: `usePath`, `useIntent`, `useWildcard`, `useAsync` — bridges store to Angular signals | MIT |
| [@everystate/core](https://www.npmjs.com/package/@everystate/core) | Path-based state management with wildcard subscriptions and async support | MIT |
| [@everystate/css](https://www.npmjs.com/package/@everystate/css) | Reactive CSSOM engine: design tokens, typed validation, WCAG enforcement, all via path-based state | MIT |
| [@everystate/examples](https://www.npmjs.com/package/@everystate/examples) | Example applications and patterns | MIT |
| [@everystate/perf](https://www.npmjs.com/package/@everystate/perf) | Performance monitoring overlay | MIT |
| [@everystate/react](https://www.npmjs.com/package/@everystate/react) | React hooks adapter: `usePath`, `useIntent`, `useAsync` hooks and `EventStateProvider` | MIT |
| [@everystate/renderer](https://www.npmjs.com/package/@everystate/renderer) | Direct-binding reactive renderer: `bind-*`, `set`, `each` attributes. Zero build step | MIT |
| [@everystate/router](https://www.npmjs.com/package/@everystate/router) | SPA routing as state | MIT |
| [@everystate/solid](https://www.npmjs.com/package/@everystate/solid) | Solid adapter: `usePath`, `useIntent`, `useWildcard`, `useAsync` — bridges store to Solid signals | MIT |
| [@everystate/test](https://www.npmjs.com/package/@everystate/test) | Event-sequence testing for EveryState stores. Zero dependency. | MIT |
| [@everystate/types](https://www.npmjs.com/package/@everystate/types) | Typed dot-path autocomplete for EveryState stores | MIT |
| [@everystate/view](https://www.npmjs.com/package/@everystate/view) | State-driven view: DOMless resolve + surgical DOM projector. View tree as first-class state | MIT |
| [@everystate/vue](https://www.npmjs.com/package/@everystate/vue) | Vue 3 composables adapter: `provideStore`, `usePath`, `useIntent`, `useWildcard`, `useAsync` | MIT |

## Self-test (CLI, opt-in)

Run the bundled self-test to verify the store-side patterns that the Vue composables consume.
It requires `@everystate/core` but **no Vue runtime** - it exercises the store layer only.
It is **opt-in** and never runs automatically on install:

```bash
# via npx (no install needed)
npx everystate-vue-self-test

# if installed locally
everystate-vue-self-test

# or directly
node node_modules/@everystate/vue/self-test.js
```

You can also run the npm script from the package folder:

```bash
npm --prefix node_modules/@everystate/vue run self-test
```

### Integration tests (@everystate/test)

The `tests/` folder contains a separate integration suite that uses
`@everystate/test` and `@everystate/core` (declared as `devDependencies`).
This is an intentional tradeoff: the **self-test** stays lightweight,
while integration tests remain available for deeper validation.

**For end users** (after installing the package):

```bash
# Install test dependencies
npm install @everystate/test @everystate/core

# Run from package folder
cd node_modules/@everystate/vue
npm run test:integration
# or short alias
npm run test:i
```

Or, from your project root:

```bash
npm --prefix node_modules/@everystate/vue run test:integration
# or short alias
npm --prefix node_modules/@everystate/vue run test:i
```

**For package developers** (working in the source repo):

```bash
# Install dev dependencies first
npm install

# Run integration tests
npm run test:integration
```

## License

MIT © Ajdin Imsirovic
