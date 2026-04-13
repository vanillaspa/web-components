/**
 * @fileoverview Auto-registration of HTML Single File Components as custom elements.
 *
 * At build time, Vite's <code>import.meta.glob</code> eagerly imports every <code>.html</code> file
 * under <code>src/components/</code> as a raw string. Each file is parsed and registered
 * as a <code>customElements.define(...)</code> using the filename as the element tag name:
 *
 * <pre><code>
 * src/components/foo/foo-bar.html          →  &lt;foo-bar&gt;
 * src/components/foo/foo-bar-baz-qux.html  →  &lt;foo-bar-baz-qux&gt;
 * </code></pre>
 *
 * Each custom element uses an open <code>ShadowDOM</code>. On <code>connectedCallback</code>, the
 * element renders its <code>&lt;template&gt;</code> and <code>&lt;style&gt;</code>, then executes the
 * <code>&lt;script&gt;</code> body as an <code>AsyncFunction</code> with <code>shadowDocument</code>
 * (the shadow root) passed directly as a parameter. No inline <code>&lt;script&gt;</code>
 * elements are injected, so the app does not require <code>'unsafe-inline'</code> in
 * Content-Security-Policy — only <code>'unsafe-eval'</code> for the <code>AsyncFunction</code>
 * constructor.
 *
 * On <code>disconnectedCallback</code>, a <code>component:disconnected</code> custom event is
 * dispatched on the element for @vanillaspa/event-bus auto-cleanup.
 *
 * @module web-components
 */

/** @type {Record<string, string>} */
const htmlFiles = import.meta.glob('/src/components/**/*.html', { query: '?raw', import: 'default', eager: true });

/** @type {AsyncFunctionConstructor} */
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;


/**
 * Parse an SFC HTML string into its three fragments and a setup function.
 *
 * The <code>&lt;script&gt;</code> body is compiled once per component type into an
 * <code>AsyncFunction('shadowDocument', ...)</code>. Each instance calls it with its
 * own shadow root — no inline scripts, no global lookup.
 *
 * @param {string} html - Raw HTML content of the <code>.html</code> file.
 * @returns {{ template: HTMLTemplateElement|null, style: HTMLStyleElement|null, setup: AsyncFunction|null }}
 */
export function parseComponent(html) {
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
export function render(shadowRoot, component) {
    shadowRoot.replaceChildren();
    if (component.template) shadowRoot.appendChild(component.template.content.cloneNode(true));
    if (component.style) shadowRoot.appendChild(component.style.cloneNode(true));
}

/**
 * Register all SFC HTML files as custom elements.
 *
 * @param {Record<string, string>} htmlFiles - Map of file path → raw HTML string.
 */
export function registerComponents(htmlFiles) {
    for (const [filePath, html] of Object.entries(htmlFiles)) {
        const component = parseComponent(html);
        // Absolute filePath from `import.meta.glob`. file-name is component-name
        const componentName = filePath.split("/").pop().split('.')[0];
        customElements.define(componentName, class extends HTMLElement {
            constructor() {
                super();
                this.attachShadow({ mode: "open" });
            }
            connectedCallback() {
                render(this.shadowRoot, component);
                component.setup?.(this.shadowRoot);
            }
            disconnectedCallback() {
                this.dispatchEvent(new CustomEvent('component:disconnected', { bubbles: false }));
            }
        });
    }
}

registerComponents(htmlFiles);
