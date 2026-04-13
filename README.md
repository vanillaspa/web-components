# @vanillaspa/web-components

> Single File Components powered by Vite — pure HTML, vanilla JS.

Write a `.html` file. Get a custom element. That's it.

---

## How it works

Each `.html` file under `src/components/` is a **Single File Component** containing up to three top-level tags:

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

At load time the module reads every matching file via `import.meta.glob`, parses the three sections, and calls `customElements.define()` — using the **filename stem as the tag name**:

| File | Element |
|------|---------|
| `src/components/app/app-card.html` | `<app-card>` |
| `src/components/ui/nav-bar.html` | `<nav-bar>` |

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

```json
// package.json
"scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
}
```

Import the module once in your entry HTML — components register themselves automatically:

```html
<script type="module">
    import '@vanillaspa/web-components';
</script>
```

Then just use your elements anywhere:

```html
<app-card data-title="Hello"></app-card>
```

No `customElements.define()`. No imports per component. No wiring.

---

## File layout

```
src/
└── components/
    ├── app/
    │   ├── app-root.html
    │   └── app-card.html
    └── ui/
        └── nav-bar.html
```

> **Each component must live in a subfolder under `src/components/`** so the `import.meta.glob` wildcard pattern picks it up correctly.

---

## Security

- No `<script>` tags are injected into the DOM — scripts run as compiled `AsyncFunction` instances.
- CSP requirement: `'unsafe-eval'` only. `'unsafe-inline'` is **not** needed.
- On `disconnectedCallback` a `component:disconnected` event is dispatched on the host element for event-bus auto-cleanup (see [@vanillaspa/event-bus](https://github.com/vanillaspa/event-bus)).

---

## API reference

Full technical documentation: [module-web-components](https://vanillaspa.github.io/web-components/module-web-components.html)
