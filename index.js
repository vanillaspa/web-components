/**
 * @fileoverview Auto-registration of HTML Single File Components as custom elements.
 *
 * At build time, Vite's `import.meta.glob` eagerly imports every `.html` file
 * under `src/components/` as a raw string. Each file is parsed and registered
 * as a `customElements.define(...)` using the filename as the element tag name:
 *
 * ```
 * src/components/foo/foo-bar.html          →  <foo-bar>
 * src/components/foo/foo-bar-baz-qux.html  →  <foo-bar-baz-qux>
 * ```
 *
 * Each custom element uses an open `ShadowDOM`. On `connectedCallback`, the
 * element assigns itself a `data-id` (8 hex chars, CSPRNG), renders its
 * `<template>` and `<style>`, then executes the `<script>` body as an
 * `AsyncFunction` with `shadowDocument` (the shadow root) passed directly
 * as a parameter. No inline `<script>` elements are injected, so the app
 * does not require `'unsafe-inline'` in Content-Security-Policy — only
 * `'unsafe-eval'` for the `AsyncFunction` constructor.
 *
 * On `disconnectedCallback`, a `component:disconnected` custom event is
 * dispatched on the element for event bus auto-cleanup.
 *
 * @module web-components
 */

/** @type {Record<string, string>} file path → raw HTML string */
const htmlFiles = import.meta.glob('/src/components/**/*.html', { query: '?raw', import: 'default', eager: true });

/** @type {AsyncFunctionConstructor} */
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

/**
 * Derive the custom element tag name from a component file path.
 *
 * @example
 * getComponentName('/src/components/router/router-app2.html')      // → 'router-app2'
 * getComponentName('/src/components/foo/foo-bar-baz-qux.html')      // → 'foo-bar-baz-qux'
 *
 * @param {string} filePath - Absolute file path from `import.meta.glob`.
 * @returns {string} Custom element tag name.
 */
function getComponentName(filePath) {
    const fileName = filePath.split("/").pop();
    return fileName.split('.')[0];
}

/**
 * Parse an SFC HTML string into its three fragments and a setup function.
 *
 * The `<script>` body is compiled once per component type into an
 * `AsyncFunction('shadowDocument', ...)`. Each instance calls it with its
 * own shadow root — no inline scripts, no global lookup.
 *
 * @param {string} html - Raw HTML content of the `.html` file.
 * @returns {{ template: HTMLTemplateElement|null, style: HTMLStyleElement|null, setup: AsyncFunction|null }}
 */
function parseComponent(html) {
    const fragment = document.createRange().createContextualFragment(html);
    const scriptEl = fragment.querySelector("script");
    return {
        template: fragment.querySelector("template"),
        style:    fragment.querySelector("style"),
        setup:    scriptEl ? new AsyncFunction('shadowDocument', scriptEl.textContent) : null,
    };
}

/**
 * Render template and style into a shadow root.
 *
 * @param {ShadowRoot} shadowRoot
 * @param {{ template: HTMLTemplateElement|null, style: HTMLStyleElement|null }} component
 */
function render(shadowRoot, component) {
    shadowRoot.replaceChildren();
    if (component.template) shadowRoot.appendChild(component.template.content.cloneNode(true));
    if (component.style) shadowRoot.appendChild(component.style.cloneNode(true));
}

for (const [filePath, html] of Object.entries(htmlFiles)) {
    const component = parseComponent(html);

    customElements.define(getComponentName(filePath), class extends HTMLElement {
        constructor() {
            super();
            this.attachShadow({ mode: "open" });
        }

        connectedCallback() {
            this.dataset.id = crypto.randomUUID().split('-')[0];
            render(this.shadowRoot, component);
            component.setup?.(this.shadowRoot);
        }

        disconnectedCallback() {
            this.dispatchEvent(new CustomEvent('component:disconnected', { bubbles: false }));
        }
    });
}
