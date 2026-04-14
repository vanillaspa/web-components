# @vanillaspa/web-components

> Single File Components powered by Vite — pure HTML, vanilla JS.

Write a `.sfc` file. Get a custom element. That's it.

---

## How it works

Each `.sfc` file under `src/components/` is a **Single File Component** containing up to three top-level tags:

```html
<!-- src/components/app/app-card.html -->
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

At build time, the Vite plugin SFC transforms each `.sfc` file into a real ES module — no string evaluation at runtime. `import.meta.glob` eagerly imports those modules, and `registerComponents` calls `customElements.define()` using the **filename stem as the tag name**:

| File | Element |
|------|---------|
| `src/components/app/app-card.sfc` | `<app-card>` |
| `src/components/ui/nav-bar.sfc` | `<nav-bar>` |

The `<script>` body receives **`shadowDocument`** — the element's open `ShadowRoot` — as its only argument. No globals, no `this`, no framework conventions to memorise.

---

## Installation

`@vanillaspa/web-components` uses `import.meta.glob`, a [Vite](https://vite.dev)-specific build primitive. **Vite is required** as a peer dependency.

```bash
npm install @vanillaspa/web-components
npm install --save-dev vite
```

---

## Setup with Vite

### 1. Register the plugin

```js
// vite.config.js
import { sfcPlugin } from '@vanillaspa/web-components/vite-plugin-sfc';
import { defineConfig } from 'vite';

export default defineConfig({
    plugins: [sfcPlugin()],
});
```

### 2. Call `registerComponents` in your entry point

```js
// main.js (or wherever your app boots)
import { registerComponents } from '@vanillaspa/web-components';

registerComponents(import.meta.glob('/src/components/**/*.sfc', { eager: true }));
```

Then just use your elements anywhere:

```html
<app-card data-title="Hello"></app-card>
```

No `customElements.define()`. No imports per component. No wiring.

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

## Security

- `<script>` bodies are compiled to real ES module functions at **build time** by `sfcPlugin` — no runtime string evaluation.
- No CSP relaxation required. Standard `script-src 'self'` is sufficient.
- Styles are applied via [Constructable Stylesheets](https://developer.mozilla.org/en-US/docs/Web/API/CSSStyleSheet/CSSStyleSheet) (`adoptedStyleSheets`) — CSS is parsed once per component type, not once per instance.
- On `disconnectedCallback` a `component:disconnected` event is dispatched on the host element for event-bus auto-cleanup (see [@vanillaspa/event-bus](https://github.com/vanillaspa/event-bus)).

---

## API reference

Full technical documentation: [module-web-components](https://vanillaspa.github.io/web-components/module-web-components.html)
