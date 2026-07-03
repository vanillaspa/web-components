/**
 * @fileoverview Register raw `.sfc` files as native custom elements.
 *
 * Each `.sfc` file is imported as raw text through `import.meta.glob(..., { eager: true, query: '?raw' })`.
 * The component's `<template>`, `<style>` and `<script>` sections are parsed and mounted into an open shadow root.
 * The `<script>` body is executed with the shadow root as `shadowDocument`.
 *
 * @module web-components
 */

/**
 * @typedef {Object} SFCModule
 * @property {string|{default:string}} default - Raw `.sfc` content or a module exposing it through `default`.
 */

/**
 * Render a component's template and styles into a shadow root.
 *
 * The template is cloned from a pre-built `HTMLTemplateElement` and the styles are
 * applied through `adoptedStyleSheets`. The setup function receives the shadow root
 * as its only argument.
 *
 * @param {ShadowRoot} shadowRoot - The component's open shadow root.
 * @param {HTMLTemplateElement} template - Pre-built template containing the component markup.
 * @param {Function} setupFunction - Function that receives `shadowDocument` and runs the component script.
 * @param {...(CSSStyleSheet|undefined)} styleSheets - Optional global or component stylesheets to adopt.
 * @returns {void}
 */
export function render(shadowRoot, template, setupFunction, ...styleSheets) {
    shadowRoot.replaceChildren(template.content.cloneNode(true));
    shadowRoot.adoptedStyleSheets = styleSheets.filter(Boolean);
    const maybePromise = setupFunction(shadowRoot);
    if (maybePromise && typeof maybePromise.then === 'function') {
        maybePromise.catch(err => console.error('component setup() rejected', err));
    }
}

/**
 * Register all SFC modules as custom elements.
 *
 * For each `.sfc` entry, the template, style and script sections are parsed,
 * a shared `CSSStyleSheet` is created for the component style, and a custom
 * element is registered using the filename stem as the tag name.
 *
 * @param {Record<string, SFCModule>} rawComponents - Map of file path → raw `.sfc` content.
 * @param {...CSSStyleSheet} globalSheets - Optional global stylesheets to apply to every component instance.
 * @returns {void}
 */
export async function registerComponents(rawComponents, ...globalSheets) {
    const tasks = Object.entries(rawComponents || {}).map(([filePath, rawContent]) => (async () => {
        const componentName = filePath.split('/').pop().split('.')[0];
        try {
            if (!componentName || !componentName.includes('-')) {
                throw new Error(`invalid component name derived from ${filePath}, must contain a hyphen`); // https://html.spec.whatwg.org/multipage/custom-elements.html#valid-custom-element-name
            }
        } catch (err) {
            console.error(`failed deriving componentName for ${filePath}`, err);
            return { filePath, status: 'name-derive-failed', error: err };
        }

        if (customElements.get(componentName)) { // the loser reports define-failed, not already-defined
            console.warn(`custom element ${componentName} already defined, skipping registration for ${filePath}`);
            return { filePath, status: 'already-defined', error: null };
        }

        const contentString = typeof rawContent === 'string' ? rawContent : rawContent.default ?? '';

        let sfc;
        try {
            sfc = new DOMParser().parseFromString(contentString, 'text/html');
        } catch (err) {
            console.error(`failed parsing SFC ${filePath}`, err);
            return { filePath, status: 'parse-failed', error: err };
        }

        const template = sfc.querySelector('template') || document.createElement('template');
        const style = sfc.querySelector('style') || document.createElement('style');
        const script = sfc.querySelector('script') || document.createElement('script');
        const asyncWrapper = `export async function setup(shadowDocument) {${script.textContent}}`;
        const blob = new Blob([asyncWrapper], { type: 'text/javascript' });
        const scriptUrl = URL.createObjectURL(blob);

        let module;
        try {
            module = await import(scriptUrl);
        } catch (err) {
            console.error(`failed importing component script for ${filePath}`, err);
            return { filePath, status: 'import-failed', error: err };
        } finally {
            try { URL.revokeObjectURL(scriptUrl); } catch (e) { /* ignore. If component authoring DX matters, consider deferring revocation until component teardown, or accept the tradeoff explicitly. */ }
        }

        let sheet;
        try {
            sheet = new CSSStyleSheet();
            sheet.replaceSync(style.textContent);
        } catch (err) {
            console.error(`failed creating stylesheet for ${filePath}`, err);
            return { filePath, status: 'style-failed', error: err };
        }

        try {
            customElements.define(componentName, class extends HTMLElement { // https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_custom_elements#custom_element_lifecycle_callbacks
                constructor() {
                    super();
                    this.attachShadow({ mode: 'open' });
                }
                connectedCallback() {
                    render(this.shadowRoot, template, module.setup, ...globalSheets, sheet);
                }
                disconnectedCallback() {
                    this.dispatchEvent(new CustomEvent('component:disconnected', { bubbles: false }));
                }
            });
        } catch (err) {
            console.error(`failed registering custom element for ${filePath}`, err);
            return { filePath, status: 'define-failed', error: err };
        }
        return { filePath, status: 'ok' }
    })());

    const results = await Promise.allSettled(tasks);
    for (const r of results) { // Log summary of failures (if any)
        if (r.status === 'fulfilled' && r.value && r.value.status !== 'ok') { // Returning {filePath, status: 'ok'} uniformly would make the Promise.allSettled result array actually inspectable/loggable as a full registration report (useful for a dev-mode "N/M components registered" banner), rather than only surfacing failures.
            console.warn('component registration result:', r.value);
        }
        else if (r.status === 'rejected') {
            console.error('component registration task rejected', r.reason);
        }
    }
    return results;
}
