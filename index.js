/**
 * @fileoverview Register raw `.sfc.html` files as native custom elements.
 *
 * Each `.sfc.html` file is imported as raw text through `import.meta.glob(..., { eager: true, query: '?raw' })`.
 * The component's `<template>`, `<style>` and `<script>` sections are parsed and mounted into an open shadow root.
 * The `<script>` body is executed with the shadow root as `shadowDocument`.
 *
 * @module web-components
 */

/**
 * @typedef {Object} SFCModule
 * @property {string|{default:string}} default - Raw `.sfc.html` content or a module exposing it through `default`.
 */

/**
 * @typedef {Object} RegistrationResult
 * @property {string} filePath - The path of the source file.
 * @property {'ok'|'name-derive-failed'|'already-defined'|'parse-failed'|'import-failed'|'style-failed'|'define-failed'} status - The outcome status.
 * @property {Error|null} [error] - The error object if the status is not 'ok'.
 */

/**
 * Register all SFC modules as custom elements.
 *
 * For each `.sfc.html` entry, the template, style and script sections are parsed,
 * a shared `CSSStyleSheet` is created for the component style, and a custom
 * element is registered using the filename stem as the tag name.
 *
 * @param {Record<string, SFCModule>} rawComponents - Map of file path → raw `.sfc.html` content.
 * @param {...CSSStyleSheet} globalSheets - Optional global stylesheets to apply to every component instance.
 * @returns {Promise<PromiseSettledResult<RegistrationResult>[]>} A promise resolving to the status reports.
 */
export async function registerComponents(rawComponents, ...globalSheets) {
    const tasks = Object.entries(rawComponents || {}).map(([filePath, rawContent]) =>
        registerSingleComponent(filePath, rawContent, globalSheets)
    );

    const results = await Promise.allSettled(tasks);

    for (const r of results) { // Log summary of failures (if any)
        if (r.status === 'fulfilled' && r.value && r.value.status !== 'ok') { // Returning {filePath, status: 'ok'} uniformly would make the Promise.allSettled result array actually inspectable/loggable as a full registration report (useful for a dev-mode "N/M components registered" banner), rather than only surfacing failures.
            console.warn('component registration result:', r.value);
        } else if (r.status === 'rejected') {
            console.error('component registration task rejected', r.reason);
        }
    }
    return results;
}

/**
 * Parses and registers a single SFC file as a custom element.
 * * @param {string} filePath 
 * @param {SFCModule} rawContent 
 * @param {CSSStyleSheet[]} globalSheets 
 * @returns {Promise<RegistrationResult>}
 */
async function registerSingleComponent(filePath, rawContent, globalSheets) {
    const componentName = filePath.split('/').pop().split('.')[0];

    // 1. Initial Structural Validations
    if (!componentName || !componentName.includes('-')) {
        const err = new Error(`Invalid custom element name: "${componentName}". Must contain a hyphen.`); // https://html.spec.whatwg.org/multipage/custom-elements.html#valid-custom-element-name
        console.error(`failed deriving componentName for ${filePath}`, err);
        return { filePath, status: 'name-derive-failed', error: err };
    }

    if (customElements.get(componentName)) { // the loser reports define-failed, not already-defined
        console.warn(`custom element ${componentName} already defined, skipping registration for ${filePath}`);
        return { filePath, status: 'already-defined', error: null };
    }

    const contentString = typeof rawContent === 'string' ? rawContent : rawContent.default ?? '';
    let scriptUrl = '';
    let currentStage = 'parse-failed'; // Tracks the pipeline stage for uniform error catching

    try {
        // 2. Parse SFC Content
        const sfc = new DOMParser().parseFromString(contentString, 'text/html');
        if (!sfc) throw new Error('DOMParser returned null document');

        const template = sfc.querySelector('template') || document.createElement('template');
        const style = sfc.querySelector('style') || document.createElement('style');
        const script = sfc.querySelector('script') || document.createElement('script');

        // 3. Prepare and Import Virtual Script Module
        currentStage = 'import-failed';
        const asyncWrapper = `export async function setup(shadowDocument) {${script.textContent}}`;
        const blob = new Blob([asyncWrapper], { type: 'text/javascript' });
        scriptUrl = URL.createObjectURL(blob);

        const module = await import(scriptUrl);

        // 4. Build Stylesheets
        currentStage = 'style-failed';
        const sheet = new CSSStyleSheet();
        sheet.replaceSync(style.textContent || '');

        // 5. Custom Element Definition
        currentStage = 'define-failed';
        customElements.define(componentName, class extends HTMLElement { // https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_custom_elements#custom_element_lifecycle_callbacks
            constructor() {
                super();
                this.attachShadow({ mode: 'open' });
            }
            connectedCallback() {
                const styleSheets = [...globalSheets, sheet]
                this.shadowRoot.replaceChildren(template.content.cloneNode(true));
                this.shadowRoot.adoptedStyleSheets = styleSheets.filter(Boolean);

                const maybePromise = module.setup(this.shadowRoot);
                if (maybePromise instanceof Promise) {
                    maybePromise.catch(err => console.error(`Component <${componentName}> setup() rejected:`, err));
                }
            }
            disconnectedCallback() {
                this.dispatchEvent(new CustomEvent('component:disconnected', { bubbles: false }));
            }
        });

        return { filePath, status: 'ok' };
    } catch (err) {
        console.error(`Failed during phase "${currentStage}" for component ${filePath}:`, err);
        return { filePath, status: currentStage, error: err };
    } finally {
        if (scriptUrl) {
            URL.revokeObjectURL(scriptUrl);
        }
    }
}
