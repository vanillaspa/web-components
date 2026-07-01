import DOMPurify from 'dompurify';

/**
 * @fileoverview Auto-registration of HTML Single File Components as custom elements.
 *
 * At build time, the `sfcPlugin` Vite plugin transforms every `.sfc` file under
 * `src/components/` into an ES module that exports `templateHtml`, `styleText`,
 * and `setup`. `import.meta.glob` eagerly imports those real modules — no string
 * evaluation at runtime, no `unsafe-eval` in Content-Security-Policy.
 *
 * The consuming app's entry point is responsible for calling `registerComponents`
 * with its own `import.meta.glob` result, keeping this module free of side effects
 * and fully tree-shakeable:
 *
 * <pre><code>
 * import { registerComponents } from '@vanillaspa/web-components';
 * registerComponents(import.meta.glob('/src/components/**&#47;*.sfc', { eager: true }));
 * </code></pre>
 *
 * @module web-components
 */

/**
 * @typedef {Object} SFCModule
 * @property {string} templateHtml - Inner HTML of the `<template>` tag, or `""`.
 * @property {string} styleText - Inner text of the `<style>` tag, or `""`.
 * @property {function(ShadowRoot): Promise<void>|null} setup - Pre-compiled setup function, or `null` when the component has no `<script>`.
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
 * The template is written directly via <code>innerHTML</code>. Styles are applied through
 * a shared <code>CSSStyleSheet</code> (Constructable Stylesheets) so CSS is parsed once
 * per component type rather than once per element instance.
 *
 * @param {ShadowRoot} shadowRoot
 * @param {string} templateHtml - Inner HTML to set on the shadow root.
 * @param {CSSStyleSheet|null} sheet - Pre-constructed stylesheet shared across all instances, or null.
 */
export function render(shadowRoot, templateString, scriptString, ...sheets) {
    const template = document.createElement('template');
    template.innerHTML = sfcPolicy.createHTML(templateString);
    shadowRoot.replaceChildren(template.content.cloneNode(true));

    shadowRoot.adoptedStyleSheets = sheets.filter(Boolean);

    const trustedScript = sfcPolicy.createScript(scriptString);
    const asyncSetupFn = new Function(trustedScript)();
    asyncSetupFn(shadowRoot);
}

/**
 * Register all SFC modules as custom elements.
 *
 * For each component, a <code>CSSStyleSheet</code> is constructed once and shared across
 * all instances of that element via <code>adoptedStyleSheets</code>.
 *
 * @param {Record<string, SFCModule>} sfcs - Map of file path → SFC module.
 */
export function registerComponents(rawComponents, ...globalSheets) {
    for (const [filePath, rawContent] of Object.entries(rawComponents)) {
        const templateString = rawContent.default.match(/<template>([\s\S]*?)<\/template>/)?.[1] || '';
        const styleString = rawContent.default.match(/<style>([\s\S]*?)<\/style>/)?.[1] || '';
        const scriptString = rawContent.default.match(/<script>([\s\S]*?)<\/script>/)?.[1] || '';

        const sheet = new CSSStyleSheet();
        sheet.replaceSync(styleString);

        const componentName = filePath.split('/').pop().split('.')[0];
        customElements.define(componentName, class extends HTMLElement {
            constructor() {
                super();
                this.attachShadow({ mode: 'open' });
            }
            connectedCallback() {
                render(this.shadowRoot, templateString, scriptString, ...globalSheets, sheet);
            }
            disconnectedCallback() {
                this.dispatchEvent(new CustomEvent('component:disconnected', { bubbles: false }));
            }
        });
    }
}

