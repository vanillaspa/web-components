/**
 * @fileoverview Auto-registration of HTML Single File Components as custom elements.
 *
 * At build time, the `sfcPlugin` Vite plugin transforms every `.html` file under
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
 * registerComponents(import.meta.glob('/src/components/**&#47;*.html', { eager: true }));
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
export function render(shadowRoot, templateHtml, sheet) {
    const t = document.createElement('template');
    t.innerHTML = templateHtml;
    shadowRoot.replaceChildren(t.content.cloneNode(true));
    shadowRoot.adoptedStyleSheets = sheet ? [sheet] : [];
}

/**
 * Register all SFC modules as custom elements.
 *
 * For each component, a <code>CSSStyleSheet</code> is constructed once and shared across
 * all instances of that element via <code>adoptedStyleSheets</code>.
 *
 * @param {Record<string, SFCModule>} modules - Map of file path → SFC module.
 */
export function registerComponents(modules) {
    for (const [filePath, { templateHtml, styleText, setup }] of Object.entries(modules)) {
        const sheet = styleText ? new CSSStyleSheet() : null;
        sheet?.replaceSync(styleText);

        const componentName = filePath.split('/').pop().split('.')[0];
        customElements.define(componentName, class extends HTMLElement {
            constructor() {
                super();
                this.attachShadow({ mode: 'open' });
            }
            connectedCallback() {
                render(this.shadowRoot, templateHtml, sheet);
                setup?.(this.shadowRoot);
            }
            disconnectedCallback() {
                this.dispatchEvent(new CustomEvent('component:disconnected', { bubbles: false }));
            }
        });
    }
}
