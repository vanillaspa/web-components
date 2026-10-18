# @vanillaspa/web-components

> Register `.sfc.html` files as native custom elements with a tiny runtime layer.

Write a `.sfc.html` file. Get a custom element. That's it.

[![npm version](https://img.shields.io/npm/v/@vanillaspa/web-components.svg)](https://www.npmjs.com/package/@vanillaspa/web-components)
[![License: Unlicense](https://img.shields.io/badge/license-Unlicense-blue.svg)](https://unlicense.org)

---

## How it works

Each `.sfc.html` file may contain up to three top-level tags:

```html
<!-- src/components/app/app-card.sfc.html -->
<template>
    <article>
        <slot></slot>
    </article>
</template>

<style>
    article { border: 1px solid #ccc; padding: 1rem; }
</style>

<script>
    const heading = shadowDocument.querySelector('article');
    heading.textContent = shadowDocument.host.dataset.title;
</script>
```

The runtime expects these files to be imported as raw text and registered through `registerComponents`:

```js
import { registerComponents } from '@vanillaspa/web-components';

registerComponents(import.meta.glob('/src/components/**/*.sfc.html', { eager: true, query: '?raw' }));
```

The filename stem becomes the custom element name (must contain a hyphen):

| File | Element |
|------|---------|
| `src/components/app/app-card.sfc.html` | `<app-card>` |
| `src/components/router/router-app.sfc.html` | `<router-app>` |

The `<script>` body of each `.sfc.html` file receives **`shadowDocument`** — the element's open `ShadowRoot` — as its execution context. No framework conventions are required. **`shadowDocument`** is the private scope DOM on each of your custom HTMLElements. Most methods available on the **`document`** are also available on the **`shadowDocument`**, for instance **`getElementById`** or **`querySelector`**.

---

## ✨ Boilerplate Integration (`src/main.js`)

In the official **[vanillaspa/boilerplate](https://github.com/vanillaspa/boilerplate)** setup (`src/main.js`), components are gathered from external libraries and local paths using Vite's `import.meta.glob`, combined with a patched Tailwind `CSSStyleSheet`, and registered together:

```javascript
/**
 * @fileoverview Application entry point for the @vanillaspa/boilerplate.
 */
import tailwindCss from '/src/styles/tailwind.css?inline';
import { registerComponents } from '@vanillaspa/web-components';
import { rawComponents } from '@vanillaspa/components-library';

const myComponents = import.meta.glob('/src/components/**/*.sfc.html', { eager: true, query: '?raw' });

const tailwindSheet = new CSSStyleSheet();
tailwindSheet.replaceSync(tailwindCss.replaceAll(':root', ':host')); // patch known Tailwind issue with :root selector in shadow DOM

registerComponents(rawComponents, tailwindSheet);
registerComponents(myComponents, tailwindSheet);

let root = 'router-app'; // the root element to replace body children with 
await customElements.whenDefined(root);

// Optional runtime modules loaded in parallel
const modulesToLoad = [
    { load: () => import('@vanillaspa/event-bus') },
    { load: () => import('@vanillaspa/sqlite-database') },
    { load: () => import('@vanillaspa/sqlite-database/contract') },
    { load: () => import('graphql'), name: 'graphqlmod' }
];

try {
    const results = await Promise.allSettled(
        modulesToLoad.map(m => m.load())
    );

    results.forEach((result, index) => {
        if (result.status === 'rejected') {
            console.error(`Error loading module ${index}:`, result.reason);
            return;
        }

        const module = result.value;
        const name = modulesToLoad[index].name || module.name; 
        if (name) {
            window[name] = Object.freeze({ ...module });
        }
    });
} catch (error) {
    console.error('Critical error during module initialization:', error);
} finally {
    document.body.replaceChildren(document.createElement(root));
}
```

---

## 📦 Alternative Import & Interaction Vectors

`registerComponents()` accepts any dictionary mapping file paths to raw SFC content (`Record<string, string | { default: string }>`). Below are alternative ways to feed component collections into the registry:

### 1. Runtime Network Fetching (`fetch`)
Fetch `.sfc.html` templates dynamically over HTTP from a backend endpoint or server:
```javascript
import { registerComponents } from '@vanillaspa/web-components';

const path = './components/modal-dialog.sfc.html';
const response = await fetch(path);
const rawContent = await response.text();

await registerComponents({
  [path]: rawContent
});
```

### 2. Manual File Picker (`<input type="file">`)
Let users select one or multiple `.sfc.html` files from their operating system:
```html
<input type="file" id="sfcPicker" multiple accept=".sfc.html,.html">

<script type="module">
  import { registerComponents } from '@vanillaspa/web-components';

  document.getElementById('sfcPicker').addEventListener('change', async (e) => {
    const rawComponents = {};
    for (const file of e.target.files) {
      rawComponents[file.name] = await file.text();
    }
    await registerComponents(rawComponents);
  });
</script>
```

### 3. Directory Crawling (`webkitdirectory`)
Batch-import an entire folder tree of `.sfc.html` components in a single user gesture:

```html
<input type="file" webkitdirectory id="folderPicker">

<script type="module">
  import { registerComponents } from '@vanillaspa/web-components';

  document.getElementById('folderPicker').addEventListener('change', async (e) => {
    const rawComponents = {};
    for (const file of e.target.files) {
      if (file.name.endsWith('.sfc.html')) {
        rawComponents[file.webkitRelativePath || file.name] = await file.text();
      }
    }
    await registerComponents(rawComponents);
  });
</script>
```

### 4. Spatial Drag and Drop
Let users drag `.sfc.html` files or directories from their OS file manager directly into an interactive drop zone:
```javascript
import { registerComponents } from '@vanillaspa/web-components';

const dropZone = document.getElementById('dropZone');

dropZone.addEventListener('dragover', (e) => e.preventDefault());
dropZone.addEventListener('drop', async (e) => {
  e.preventDefault();
  
  const rawComponents = {};
  for (const file of e.dataTransfer.files) {
    if (file.name.endsWith('.sfc.html')) {
      rawComponents[file.name] = await file.text();
    }
  }

  await registerComponents(rawComponents);
});
```

---

## Installation & Requirements

`@vanillaspa/web-components` uses [Vite](https://vite.dev) and `import.meta.glob`. **Vite is required** as a peer dependency.

```bash
npm install @vanillaspa/web-components
npm install --save-dev vite
```

---

## File layout

```
src/
└── components/
    ├── app/
    │   ├── app-root.sfc.html
    │   └── app-card.sfc.html
    └── ui/
        └── nav-bar.sfc.html
```

---

## Security and rendering

- The component script executes via a temporary Blob URL and receives `shadowDocument` as its setup argument.
- Styles are applied through [Constructable Stylesheets](https://developer.mozilla.org/en-US/docs/Web/API/CSSStyleSheet/CSSStyleSheet) (`adoptedStyleSheets`) so each component type can share reusable global sheets.
- On `disconnectedCallback`, a `component:disconnected` event is dispatched on the host element for event-bus cleanup.

---

## API Reference & Status Codes (`registerComponents`)

```javascript
/**
 * @param {Record<string, string|{default: string}>} rawComponents - Map of file path -> raw content
 * @param {...CSSStyleSheet} globalSheets - Optional global constructable stylesheets applied to all shadow roots
 * @returns {Promise<Array<{filePath: string, status: string, error?: Error|null}>>}
 */
```

### Status Report Codes (`RegistrationResult`)
* `'ok'` — Component successfully parsed and registered.
* `'already-defined'` — Custom element tag name is already registered.
* `'name-derive-failed'` — Filename stem does not contain a hyphen (`-`).
* `'parse-failed'` — `DOMParser` failed to parse the file text.
* `'import-failed'` — Inline `<script>` execution or blob import threw an error.
* `'style-failed'` — Constructable stylesheet creation failed.
* `'define-failed'` — `customElements.define()` threw an exception.
* `'system-error'` — Unhandled internal crash.

---

## 📄 License
This is free and unencumbered software released into the public domain. See [UNLICENSE](https://unlicense.org) for details.
