# @vanillaspa/web-components

> Register `.sfc.html` files as native custom elements with a tiny, dependency-free runtime.

Write a `.sfc.html` file. Get a custom element. That's it.

[![npm version](https://img.shields.io/npm/v/@vanillaspa/web-components.svg)](https://www.npmjs.com/package/@vanillaspa/web-components)
[![License: Unlicense](https://img.shields.io/badge/license-Unlicense-blue.svg)](https://unlicense.org)

---

## Table of contents

- [How it works](#how-it-works)
- [Writing a component](#writing-a-component)
- [Installation](#installation)
- [Ways to load components](#ways-to-load-components)
  - [1. Vite: `import.meta.glob`](#1-vite-importmetaglob)
  - [2. No bundler: import map + `fetch`](#2-no-bundler-import-map--fetch)
  - [3. Other bundlers](#3-other-bundlers)
  - [4. Inline strings](#4-inline-strings)
  - [5. File picker, folder picker, drag and drop](#5-file-picker-folder-picker-drag-and-drop)
- [Import maps for component scripts](#import-maps-for-component-scripts)
- [Global stylesheets (Tailwind etc.)](#global-stylesheets-tailwind-etc)
- [Component lifecycle](#component-lifecycle)
- [API reference](#api-reference)
- [Behavior and limitations](#behavior-and-limitations)
- [Security and CSP](#security-and-csp)
- [Browser support](#browser-support)
- [Project setup (Vite)](#project-setup-vite)
- [Boilerplate](#boilerplate)
- [License](#license)

---

## How it works

`registerComponents()` takes a dictionary of `file path → raw .sfc.html text`. For every entry it:

1. derives the tag name from the file name,
2. parses the text with `DOMParser`,
3. compiles the `<script>` section into a module (via a temporary Blob URL),
4. builds a constructable stylesheet from the `<style>` section,
5. defines a custom element that renders the `<template>` into an open shadow root, runs the script's `setup(shadowDocument)` function and observes a `data-state` attribute (a JSON value) as the component's state. Every state change calls the component's `render(state)`.

The runtime itself is plain browser JavaScript with no dependencies and no build step. A bundler is only needed if you want to *collect* files at build time (see [Vite](#1-vite-importmetaglob)).

## Writing a component

A `.sfc.html` file may contain up to three top-level tags: `<template>`, `<style>` and `<script>`. All three are optional. Only the **first** tag of each kind is used.

```html
<!-- src/components/app/app-counter.sfc.html -->
<template>
    <button id="btn"><slot>Count</slot></button>
    <output id="out"></output>
</template>

<style>
    :host { display: inline-flex; gap: .5rem; align-items: center; }
    button { padding: .25rem .75rem; }
</style>

<script>
    // `shadowDocument` is the element's open ShadowRoot.
    // `shadowDocument.host` is the custom element itself.
    const host = shadowDocument.host;
    const btn = shadowDocument.getElementById('btn');
    const out = shadowDocument.querySelector('output');

    // `host.state` is the parsed JSON of the `data-state` attribute (or `null`).
    // `render(state)` is called after setup() and every time the state changes.
    host.render = (state) => { out.textContent = String(state?.count ?? 0); };

    btn.addEventListener('click', () => {
        host.state = { ...host.state, count: (host.state?.count ?? 0) + 1 }; // updates the attribute → render()
    });
</script>
```

Use it like any other element:

```html
<app-counter data-state='{"count":5}'>Click me</app-counter>
```

`data-state` holds the component's state as JSON, the generic counterpart of single attributes like `data-start="5"`. See [State](#state-data-state).

### The file name is the tag name

The part of the file name before the **first dot** becomes the tag name. It must contain a hyphen and must be a valid custom element name (lowercase).

| File                                        | Element        |
| ------------------------------------------- | -------------- |
| `src/components/app/app-card.sfc.html`      | `<app-card>`   |
| `src/components/router/router-app.sfc.html` | `<router-app>` |
| `modal.sfc.html`                            | ❌ `name-derive-failed` (no hyphen) |

Directories are ignored; only the last path segment (split on `/`) counts.

### What the `<script>` section is

The script body is wrapped as the body of an **async function** inside an ES module:

```js
export async function setup(shadowDocument) { /* your script */ }
```

Consequences:

- `shadowDocument` is available as a variable.
- Top-level `await` works.
- Static `import ... from` and `export` statements are **not** allowed (they cannot appear inside a function). Use dynamic `import()` instead, see [Import maps](#import-maps-for-component-scripts).
- Relative dynamic imports (`import('./x.js')`) do **not** work, because the module lives at a `blob:` URL. Use absolute URLs or bare specifiers resolved by an import map.
- The code runs in strict mode and in the main window realm. It is **not sandboxed**.
- `setup` runs once per element connection (see [Component lifecycle](#component-lifecycle)).

---

## Installation

```bash
npm install @vanillaspa/web-components
```

Vite is **not** required by the runtime. It is only needed for the `import.meta.glob` examples below.

---

## Ways to load components

`registerComponents()` accepts `Record<string, string | { default: string }>`: either the raw text directly or a module namespace whose `default` export is the text. The keys are only used for tag-name derivation and for reporting.

### 1. Vite: `import.meta.glob`

**Eager, as module objects (`{ default: string }`):**

```js
import { registerComponents } from '@vanillaspa/web-components';

registerComponents(
    import.meta.glob('/src/components/**/*.sfc.html', { eager: true, query: '?raw' })
);
```

**Eager, as plain strings:**

```js
registerComponents(
    import.meta.glob('/src/components/**/*.sfc.html', { eager: true, query: '?raw', import: 'default' })
);
```

**Lazy (code-split).** The runtime expects text, not loader functions, so resolve them first:

```js
const lazy = import.meta.glob('/src/components/**/*.sfc.html', { query: '?raw', import: 'default' });

const raw = Object.fromEntries(
    await Promise.all(Object.entries(lazy).map(async ([path, load]) => [path, await load()]))
);

await registerComponents(raw);
```

**A single file:**

```js
import card from './components/app-card.sfc.html?raw';
await registerComponents({ './components/app-card.sfc.html': card });
```

### 2. No bundler: import map + `fetch`

Serve the files statically and load the runtime through an import map:

```html
<!doctype html>
<html>
<head>
    <script type="importmap">
    {
        "imports": {
            "@vanillaspa/web-components": "/node_modules/@vanillaspa/web-components/index.js"
        }
    }
    </script>
</head>
<body>
    <app-card data-state='{"title":"Hello"}'></app-card>

    <script type="module">
        import { registerComponents } from '@vanillaspa/web-components';

        const files = ['./components/app-card.sfc.html', './components/nav-bar.sfc.html'];

        const entries = await Promise.all(files.map(async (path) => {
            const res = await fetch(path);
            if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
            return [path, await res.text()];
        }));

        await registerComponents(Object.fromEntries(entries));
    </script>
</body>
</html>
```

Instead of a local `node_modules` path you can point the import map to a CDN. **Pin an exact version:**

```html
<script type="importmap">
{
    "imports": {
        "@vanillaspa/web-components": "https://cdn.jsdelivr.net/npm/@vanillaspa/web-components@2.10.0/index.js"
    }
}
</script>
```

The import map must appear **before** the first module script that uses it.

**Single request instead of many:** serve a `manifest.json` listing your component paths, or concatenate your components into one JSON file (`{ "app-card.sfc.html": "<template>…" }`) at build time and pass the parsed object straight to `registerComponents`.

### 3. Other bundlers

Any bundler that can import a file as a **raw string** works. Typical setups (adjust to your toolchain):

**webpack**

```js
// webpack.config.js
module.exports = { module: { rules: [{ test: /\.sfc\.html$/, type: 'asset/source' }] } };
```

```js
const ctx = require.context('./components', true, /\.sfc\.html$/);
registerComponents(Object.fromEntries(ctx.keys().map((key) => [key, ctx(key)])));
```

**esbuild**

```js
// build.js
await esbuild.build({ /* ... */ loader: { '.html': 'text' } });
```

```js
import card from './components/app-card.sfc.html';
await registerComponents({ 'app-card.sfc.html': card });
```

### 4. Inline strings

Handy for demos, tests and playgrounds. The key only needs to end in a valid name stem:

```js
import { registerComponents } from '@vanillaspa/web-components';

await registerComponents({
    'hello-world.sfc.html': `
        <template><p>Hello <slot>world</slot>!</p></template>
        <style>p { font-family: system-ui; }</style>
    `
});
```

When embedding a component that contains a `<script>` section inside an inline `<script type="module">` in HTML, escape the closing tag as `<\/script>`, and escape backticks and `${` inside template literals.

### 5. File picker, folder picker, drag and drop

Let users load components from their own machine. Remember that this **executes the code in those files**; see [Security and CSP](#security-and-csp).

**File picker**

```html
<input type="file" id="sfcPicker" multiple accept=".html">

<script type="module">
    import { registerComponents } from '@vanillaspa/web-components';

    document.getElementById('sfcPicker').addEventListener('change', async (e) => {
        const raw = {};
        for (const file of e.target.files) {
            if (file.name.endsWith('.sfc.html')) raw[file.name] = await file.text();
        }
        await registerComponents(raw);
    });
</script>
```

**Folder picker**

```html
<input type="file" id="folderPicker" webkitdirectory>

<script type="module">
    import { registerComponents } from '@vanillaspa/web-components';

    document.getElementById('folderPicker').addEventListener('change', async (e) => {
        const raw = {};
        for (const file of e.target.files) {
            if (file.name.endsWith('.sfc.html')) {
                raw[file.webkitRelativePath || file.name] = await file.text();
            }
        }
        await registerComponents(raw);
    });
</script>
```

**Drag and drop** (files; dropped folders are not traversed by this snippet)

```js
import { registerComponents } from '@vanillaspa/web-components';

const dropZone = document.getElementById('dropZone');

dropZone.addEventListener('dragover', (e) => e.preventDefault());
dropZone.addEventListener('drop', async (e) => {
    e.preventDefault();
    const raw = {};
    for (const file of e.dataTransfer.files) {
        if (file.name.endsWith('.sfc.html')) raw[file.name] = await file.text();
    }
    await registerComponents(raw);
});
```

---

## Import maps for component scripts

Because component scripts are compiled as modules, **bare specifiers in dynamic `import()` calls are resolved by the page's import map**, even though the module itself lives at a `blob:` URL. This is the recommended way to use libraries from inside a component without a bundler:

```html
<script type="importmap">
{
    "imports": {
        "@vanillaspa/web-components": "/node_modules/@vanillaspa/web-components/index.js",
        "dayjs": "https://cdn.jsdelivr.net/npm/dayjs@1.11.13/esm/index.js"
    }
}
</script>
```

```html
<!-- app-clock.sfc.html -->
<template><time></time></template>

<script>
    const { default: dayjs } = await import('dayjs');
    const time = shadowDocument.querySelector('time');

    const tick = () => { time.textContent = dayjs().format('HH:mm:ss'); };
    tick();
    const id = setInterval(tick, 1000);

    // clean up when the element is removed from the DOM
    shadowDocument.host.addEventListener('component:disconnected', () => clearInterval(id), { once: true });
</script>
```

With a bundler such as Vite, the same bare specifiers are resolved by the bundler **only for static imports in your own code**. A dynamic `import('dayjs')` inside a component script is evaluated at runtime in the browser, so it needs an import map (or an absolute URL), or you expose the library on `window` yourself before registering components.

---

## Global stylesheets (Tailwind etc.)

Pass any number of `CSSStyleSheet` objects after the components. They are adopted by every shadow root, **before** the component's own sheet, so component styles win on equal specificity.

```js
import tailwindCss from '/src/styles/tailwind.css?inline';
import { registerComponents } from '@vanillaspa/web-components';

const tailwind = new CSSStyleSheet();
tailwind.replaceSync(tailwindCss.replaceAll(':root', ':host')); // `:root` does not match inside a shadow root

await registerComponents(myComponents, tailwind);
```

Without a bundler:

```js
const css = await (await fetch('/styles/global.css')).text();
const sheet = new CSSStyleSheet();
await sheet.replace(css);

await registerComponents(raw, sheet);
```

Note: `@import` rules are ignored in constructable stylesheets, so inline or concatenate your CSS first.

---

## Component lifecycle

```
registerComponents()
 └─ per file:  derive name → parse → create script module → create styles → customElements.define

per element instance
   connectedCallback()         replace shadow children with a clone of <template>,
                               adopt stylesheets, call setup(shadowRoot)
                               └─ when setup() resolved and the element is still connected:
                                  host.render(state)                         (initial render)
   attributeChangedCallback()  data-state changed while connected → host.render(state)
   disconnectedCallback()      dispatch 'component:disconnected' on the host
```

- The script module is created **once per tag name**, not per instance.
- The element is defined only **after** the script module has loaded. Elements already present in the DOM are upgraded at that point. Use `await customElements.whenDefined('my-tag')` to wait for it.
- `setup()` is **not awaited** by the browser. If it rejects, the error is logged with `console.error`, the initial `render()` call is skipped and the element stays rendered.
- `setup()` runs on **every** connection. If an element is moved or re-attached, its shadow content is re-rendered and `setup()` runs again, so register listeners and timers there and release them on [`component:disconnected`](#cleanup-componentdisconnected).
- The return value of `setup()` is ignored.

### State: `data-state`

`data-state` is the generic **component state**. Where you would use `data-start="5"` for a single value and read it with `host.dataset.start`, `data-state` carries the whole state of the component as one JSON value.

| Member | Description |
| ------ | ----------- |
| `data-state="…"` | The raw JSON string in the attribute. Observed: a change calls `render()`. |
| `host.state` | The parsed attribute, as a **fresh copy** on every access. `null` if the attribute is absent or not valid JSON (the latter also logs an error). |
| `host.state = value` | Serializes `value` with `JSON.stringify` into the attribute. `null` or `undefined` removes the attribute. Throws a `TypeError` if the value is not JSON-serializable. |
| `host.render(state)` | Generic render hook, called by the runtime. See [Rendering](#rendering-with-render). |

**Setting the state**

In HTML, wrap the attribute in single quotes so the JSON can use double quotes:

```html
<upload-panel data-state='{"loading":true,"progress":40,"message":"Uploading…"}'></upload-panel>
```

In JavaScript, assign to the property (preferred) or set the attribute yourself:

```js
const panel = document.querySelector('upload-panel');

panel.state = { loading: true, progress: 80, message: 'Almost there' };
panel.state = { ...panel.state, loading: false }; // update: assign a new object
panel.state = null;                               // removes the attribute

panel.setAttribute('data-state', '{"loading":false}'); // equivalent to the property
panel.dataset.state;                                   // the raw JSON string
```

`host.state` is a copy, so `host.state.progress = 90` changes nothing. Assign a new object instead.

#### Rendering with `render()`

Every component host has a `render(state)` method. By default it does nothing. Replace it **inside `setup()`** with the function that draws your component:

```html
<!-- upload-panel.sfc.html -->
<template>
    <progress id="bar" max="100"></progress>
    <p id="msg"></p>
</template>

<script>
    const host = shadowDocument.host;
    const bar = shadowDocument.getElementById('bar');
    const msg = shadowDocument.getElementById('msg');

    host.render = (state) => {
        bar.hidden = !state?.loading;
        bar.value = state?.progress ?? 0;
        msg.textContent = state?.message ?? '';
    };
</script>
```

The runtime calls `host.render(state)`

1. **once after `setup()` has resolved** (initial render), and
2. **every time `data-state` changes while the element is connected.**

Why the runtime has to do this: an observed attribute only makes the browser call `attributeChangedCallback`. Nothing re-renders on its own, so the runtime calls `render()` from there.

`render()` is **not** called

- when the same JSON string is set again (browsers fire the callback anyway, the runtime ignores it),
- while the element is disconnected. When it is attached again, `setup()` runs and the initial render draws the latest state.

Rules:

- `state` is `null` when the attribute is absent, was removed or holds invalid JSON. Write `state?.x ?? default` and the component renders its empty state in all three cases.
- Assign `host.render` **in `setup()`**, not from outside. The old function keeps pointing at the old DOM until `setup()` assigns a new one on the next connect.
- If `setup()` has to wait for something (`await fetch(…)`), assign `host.render` **before** the `await`. State changes that arrive in the meantime are then drawn right away, and the initial render still follows when `setup()` resolves. Call `host.render(host.state)` yourself if you want the first draw before the `await`.
- `setup()` can write `host.state = …` freely: it only calls `render()`, it never runs `setup()` again. Do **not** write `host.state` unconditionally from inside `render()`, that would loop.
- An error thrown in `render()` is logged with `console.error` and does not stop the runtime.
- If the attribute is already in the markup when the element is upgraded, `render()` is called once during the upgrade, but `setup()` has not run yet, so that call reaches the default no-op. The initial render after `setup()` draws the state.
- No CSS selector can look inside the JSON. To style by state, set a class or attribute on an element inside the shadow root from your `render()` function and select on that.
- The runtime never writes `data-state` itself.

### Reacting to other attribute changes

`data-state` is the only observed attribute. For any other attribute, observe the host yourself:

```html
<script>
    const host = shadowDocument.host;
    const label = shadowDocument.querySelector('span');

    const update = () => { label.textContent = host.getAttribute('title') ?? ''; };
    const observer = new MutationObserver(update);
    observer.observe(host, { attributes: true, attributeFilter: ['title'] });
    update();

    host.addEventListener('component:disconnected', () => observer.disconnect(), { once: true });
</script>
```

### Cleanup: `component:disconnected`

`component:disconnected` is the **only event** the runtime dispatches. It fires on the host element when the element is removed from the DOM, with `bubbles: false`, so listen on the element itself (`shadowDocument.host`), not on an ancestor.

Because `setup()` runs again on every connect, everything it sets up outside the shadow root (timers, `window` listeners, observers, listeners on the host) has to be released here:

```html
<script>
    const host = shadowDocument.host;
    const timer = setInterval(() => { host.state = { ...host.state, tick: Date.now() }; }, 1000);

    host.addEventListener('component:disconnected', () => clearInterval(timer), { once: true });
</script>
```

[`@vanillaspa/event-bus`](https://github.com/vanillaspa) builds on this event: when you register a listener with a host element as `context`, the bus attaches a `component:disconnected` handler to that element and removes all of the context's listeners automatically:

```html
<script>
    const { addEventListener } = window.eventbus; // exposed by main.js under the module's exported `name`

    addEventListener('sqlite:statement', (event) => {
        console.log(event.detail);
    }, shadowDocument.host); // removed automatically when the element is disconnected
</script>
```

---

## API reference

### `registerComponents(rawComponents, ...globalStyles)`

```js
/**
 * @param {Record<string, string|{default: string}>} rawComponents - Map of file path → raw .sfc.html content
 * @param {...CSSStyleSheet} globalStyles - Optional global stylesheets applied to every component
 * @returns {Promise<Array<{filePath: string, status: string, error?: Error|null}>>}
 */
```

The promise always resolves with one report per input entry. It does not reject for failed components, so check the statuses:

```js
const results = await registerComponents(components);

const failed = results.filter((r) => r.status !== 'ok' && r.status !== 'already-defined');
failed.forEach((r) => console.error(`${r.filePath}: ${r.status}`, r.error));
```

### Status codes

| Status               | Meaning |
| -------------------- | ------- |
| `ok`                 | Component parsed, compiled and registered. |
| `already-defined`    | A custom element with this tag name was already registered **before** this call. Nothing was changed. |
| `name-derive-failed` | The path is not a non-empty string, or the file name stem contains no hyphen. |
| `parse-failed`       | `DOMParser` did not return a document. |
| `module-failed`      | Creating the `<script>` module failed (syntax error, blocked by CSP, forbidden `import`/`export` statement, …). |
| `style-failed`       | Creating the constructable stylesheet failed (e.g. no support in this browser). |
| `define-failed`      | `customElements.define()` threw, e.g. an invalid tag name, or two files in the **same** call with the same name stem. |
| `system-error`       | An unexpected internal error. The entry is logged with `console.error`. |

### Host element contract

| Member                   | Kind      | Description |
| ------------------------ | --------- | ----------- |
| `data-state`             | attribute | Observed. The component's state as JSON. See [State](#state-data-state). |
| `state`                  | property  | Parsed `data-state` (fresh copy, `null` if absent or invalid). Assigning serializes it into the attribute. |
| `render(state)`          | method    | No-op by default. Replace it in `setup()`. Called after `setup()` and on every state change while connected. See [Rendering](#rendering-with-render). |
| `component:disconnected` | event     | The only event. Dispatched when the element is removed from the DOM. |
| `shadowRoot`             | property  | Open shadow root; also passed to `setup()` as `shadowDocument`. |

### Types

The package is documented with JSDoc. The exported typedefs are `SFCContent` and `RegistrationResult`.

---

## Behavior and limitations

- Only the first `<template>`, `<style>` and `<script>` of a file are used; additional ones are ignored.
- There is no scoping beyond the Shadow DOM and no template binding or virtual DOM. Your `render(state)` function draws the component; the runtime only decides **when** it is called.
- Components are registered once. There is no hot replacement: registering the same tag name again yields `already-defined`.
- Component styles are applied **only** inside the shadow root. Use [global stylesheets](#global-stylesheets-tailwind-etc) for shared styles.
- No server-side rendering.
- `data-state` is the only observed attribute and must contain valid JSON. Use a `MutationObserver` for other attributes.
- Windows-style paths with backslashes are not split. Normalize keys to `/` before registering.

---

## Security and CSP

- Component scripts execute through a temporary **Blob URL** (`import(blobUrl)`). No `eval` or `new Function` is used, so `unsafe-eval` and Trusted Types are **not** required.
- Your Content Security Policy **must allow `blob:` in `script-src`**, for example:

  ```
  Content-Security-Policy: script-src 'self' blob:; script-src-elem 'self' blob:
  ```

  Vite's `server.headers` only applies to the dev server. Set the same header in production (reverse proxy, CDN or hosting config). See [Project setup](#project-setup-vite).

- Scripts run with the same privileges as your page. `shadowDocument` is a convenience, **not a sandbox**.
- Only register components from sources you trust. Loading `.sfc.html` files from user input (file picker, drag and drop) or from third-party servers is equivalent to executing that code on your page.

---

## Browser support

Requires custom elements v1, Shadow DOM, constructable stylesheets (`adoptedStyleSheets`), dynamic `import()` and Blob URLs. In practice that means current evergreen browsers (roughly Chrome/Edge 89+, Firefox 108+, Safari 16.4+). Import maps, if you use them, have similar requirements.

---

## Project setup (Vite)

This is the setup used by the official [vanillaspa/boilerplate](https://github.com/vanillaspa/boilerplate).

### `vite.config.js`

Trimmed to the parts that matter for the runtime:

```js
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
    build: {
        target: 'esnext' // required for top-level await in src/main.js
    },
    server: {
        headers: {
            // `blob:` is required: component scripts are imported from Blob URLs.
            // 'wasm-unsafe-eval' is only needed for SQLite WASM, not for this package.
            'Content-Security-Policy':
                "default-src 'self'; script-src 'self' 'wasm-unsafe-eval' blob:; script-src-elem 'self' blob:; " +
                "img-src 'self' data:; style-src 'self' 'unsafe-inline'; connect-src 'self' ws: wss:;",

            // Only needed for SQLite WASM with OPFS (cross-origin isolation):
            'Cross-Origin-Embedder-Policy': 'require-corp',
            'Cross-Origin-Opener-Policy': 'same-origin',

            'Referrer-Policy': 'strict-origin-when-cross-origin',
            'X-Content-Type-Options': 'nosniff',
            'X-Frame-Options': 'DENY'
        }
    },
    optimizeDeps: {
        exclude: ['@sqlite.org/sqlite-wasm'] // only if you use SQLite WASM
    },
    plugins: [tailwindcss()]
});
```

What belongs to what:

| Setting | Needed by |
| --- | --- |
| `script-src … blob:` | **this package** (Blob URL script modules) |
| `build.target: 'esnext'` | top-level `await` in `main.js` |
| `wasm-unsafe-eval`, COOP/COEP, `optimizeDeps.exclude` | SQLite WASM (OPFS), optional |
| `hmr: { protocol: 'wss' }`, `basicSsl()` | only when the dev server runs over HTTPS; omit both otherwise |

### `src/main.js`: boot sequence

```js
import { registerComponents } from '@vanillaspa/web-components';
import tailwindCss from '/src/styles/tailwind.css?inline';

// 1. Global stylesheet shared by all shadow roots
const tailwindSheet = new CSSStyleSheet();
tailwindSheet.replaceSync(tailwindCss.replaceAll(':root', ':host')); // `:root` does not match in shadow DOM

// 2. Discover and register all components
const components = import.meta.glob('/src/components/**/*.sfc.html', { eager: true, query: '?raw' });
const results = await registerComponents(components, tailwindSheet);

results
    .filter((r) => r.status !== 'ok' && r.status !== 'already-defined')
    .forEach((r) => console.error(`${r.filePath}: ${r.status}`, r.error));

const root = 'home-page'; // the root element that replaces the body content
if (!customElements.get(root)) {
    throw new Error(`Root component <${root}> was not registered, see errors above.`);
}

// 3. Optional runtime modules, loaded in parallel and exposed on `window`.
//    Use `name` to choose the global name, otherwise the module's exported `name` is used.
const modulesToLoad = [
    { load: () => import('@vanillaspa/sqlite-database') },
    { load: () => import('@vanillaspa/sqlite-database/contract') }
    // { load: () => import('@vanillaspa/event-bus') } // optional: exposed as window.eventbus (its exported `name`)
];

const loaded = await Promise.allSettled(modulesToLoad.map((m) => m.load())); // one failing module must not block the boot

loaded.forEach((result, index) => {
    if (result.status === 'rejected') {
        console.error(`Error loading module ${index}:`, result.reason);
        return;
    }
    const name = modulesToLoad[index].name || result.value.name;
    if (name) window[name] = Object.freeze({ ...result.value });
});

// 4. Mount the app last
document.body.replaceChildren(document.createElement(root));
```

Why it is structured this way:

- **Mount last.** Component scripts run in `setup()` when their element connects. Because the root element is only created after the optional modules are on `window`, every component can rely on those globals in `setup()`. Keep `index.html`'s `<body>` empty so no component connects earlier.
- **Await the registration.** `registerComponents()` resolves with one status per file and never rejects. Checking the results (or `customElements.get(root)`) avoids waiting forever on `customElements.whenDefined(root)` if the root component failed to register.
- **`Promise.allSettled`** keeps optional modules optional: a rejected import is logged and skipped.
- **`Object.freeze({ ...module })`** exposes a read-only copy, so components cannot overwrite a service by accident.

### Global CSS libraries and shadow roots

A stylesheet imported in `main.js` (for example `import '@fortawesome/fontawesome-free/css/all.css'`) applies to the **document only**. Its class rules do not reach elements inside component shadow roots. If you need such classes (like `.fa-solid`) inside components:

- keep the global import, because `@font-face` rules must be declared at document level, **and**
- adopt the same CSS as an additional global sheet:

```js
import faCss from '@fortawesome/fontawesome-free/css/all.css?inline';

const faSheet = new CSSStyleSheet();
faSheet.replaceSync(faCss);

await registerComponents(components, tailwindSheet, faSheet);
```

---

## Boilerplate

The official **[vanillaspa/boilerplate](https://github.com/vanillaspa/boilerplate)** wires all of this together with Vite, Tailwind and a component library (`@vanillaspa/components-library`), including the optional runtime modules `@vanillaspa/event-bus` and `@vanillaspa/sqlite-database`.

---

## License

This is free and unencumbered software released into the public domain. See [UNLICENSE](https://unlicense.org) for details.