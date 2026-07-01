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
 * Trusted Types policy used to preserve SFC markup and wrap component scripts.
 *
 * The policy returns the raw template HTML unchanged and turns the `<script>`
 * body into an async setup function that the runtime can execute later.
 * @type {{createHTML: function(string): string, createScript: function(string): string}}
 */
const sfcPolicy = window.trustedTypes?.createPolicy('sfc-policy', {
    createHTML: (input) => input,
    createScript: (input) => `return (async function setup(shadowDocument) {${input}})`
}) || { // fallback for browsers without Trusted Types
    createHTML: (input) => input,
    createScript: (input) => `return (async function setup(shadowDocument) {${input}})`
};

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
    setupFunction(shadowRoot);
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
export function registerComponents(rawComponents, ...globalSheets) {
    for (const [filePath, rawContent] of Object.entries(rawComponents)) {
        const contentString = typeof rawContent === 'string' ? rawContent : rawContent.default ?? '';
        const templateString = contentString.match(/<template>([\s\S]*?)<\/template>/)?.[1] || '';
        const styleString = contentString.match(/<style>([\s\S]*?)<\/style>/)?.[1] || '';
        const scriptString = contentString.match(/<script>([\s\S]*?)<\/script>/)?.[1] || '';

        const template = document.createElement('template');
        template.innerHTML = sfcPolicy.createHTML(templateString);

        const sheet = new CSSStyleSheet();
        sheet.replaceSync(styleString);

        const trustedScript = sfcPolicy.createScript(scriptString);
        const asyncSetupFunction = new Function(trustedScript)();

        const componentName = filePath.split('/').pop().split('.')[0]; // https://html.spec.whatwg.org/multipage/custom-elements.html#valid-custom-element-name
        customElements.define(componentName, class extends HTMLElement { // https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_custom_elements#custom_element_lifecycle_callbacks
            constructor() {
                super();
                this.attachShadow({ mode: 'open' });
            }
            connectedCallback() {
                render(this.shadowRoot, template, asyncSetupFunction, ...globalSheets, sheet);
            }
            disconnectedCallback() {
                this.dispatchEvent(new CustomEvent('component:disconnected', { bubbles: false }));
            }
        });
    }
}
