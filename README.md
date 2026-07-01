# @vanillaspa/web-components

> Register `.sfc` files as native custom elements with a tiny runtime layer.

Write a `.sfc` file. Get a custom element. That's it.

---

## How it works

Each `.sfc` file under `src/components/` may contain up to three top-level tags:

```html
<!-- src/components/app/app-card.sfc -->
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

registerComponents(import.meta.glob('/src/components/**/*.sfc', { eager: true, query: '?raw' }));
```

The filename stem becomes the custom element name:

| File | Element |
|------|---------|
| `src/components/app/app-card.sfc` | `<app-card>` |
| `src/components/router/router-app.sfc` | `<router-app>` |

The `<script>` body of each `.sfc` file receives **`shadowDocument`** — the element's open `ShadowRoot` — as its only argument. No framework conventions are required. **`shadowDocument`** is the private scope DOM on each of your custom HTMLElements. Most methods available on the **`document`** are also available on the **`shadowDocument`**, for instance **`getElementById`** or **`querySelector`**.

---

## Installation

`@vanillaspa/web-components` uses [Vite](https://vite.dev) and `import.meta.glob`. **Vite is required** as a peer dependency.

```bash
npm install @vanillaspa/web-components
npm install --save-dev vite
```

---

## Quick start

```js
// main.js
import { registerComponents } from '@vanillaspa/web-components';

registerComponents(import.meta.glob('/src/components/**/*.sfc', { eager: true, query: '?raw' }));
```

Then use your components anywhere in the app:

```html
<app-card data-title="Hello"></app-card>
```

No manual `customElements.define()`. No per-component imports. No wiring.

```json
// package.json
"scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
}
```

---

## File layout

```
src/
└── components/
    ├── app/
    │   ├── app-root.sfc
    │   └── app-card.sfc
    └── ui/
        └── nav-bar.sfc
```

> **Each component must live under `src/components/`** so the `import.meta.glob` pattern picks it up correctly.

> **SFC root tags must not carry HTML attributes.** `<template>`, `<style>`, and `<script>` are matched by tag name only.

---

## API

- `registerComponents(rawComponents, ...globalSheets)` parses each `.sfc` file, creates a component template, applies styles through `adoptedStyleSheets`, and defines the matching custom element.
- `render(shadowRoot, template, setupFunction, ...styleSheets)` is the internal render helper used for mounting the component markup and executing the setup logic.

---

## Security and rendering

- The component script is executed from the parsed `.sfc` source and receives `shadowDocument` as its only argument.
- Styles are applied through [Constructable Stylesheets](https://developer.mozilla.org/en-US/docs/Web/API/CSSStyleSheet/CSSStyleSheet) (`adoptedStyleSheets`) so each component type can share a reusable stylesheet.
- On `disconnectedCallback`, a `component:disconnected` event is dispatched on the host element for event-bus cleanup.

---

## API reference

Full technical spec: [module-web-components](https://github.com/vanillaspa/web-components/index.js)
