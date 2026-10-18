/**
 * @fileoverview Register raw `.sfc.html` files as native custom elements.
 *
 * The component's `<template>`, `<style>` and `<script>` sections are parsed and mounted into an open shadow root.
 * The `<script>` body is executed with the shadow root as `shadowDocument`.
 *
 * @module web-components
 */

/**
 * @typedef {string|{default:string}} SFCModule
 * The raw `.sfc.html` file content (either directly as a string or wrapped in a module default export). 
 * The file may contain optional `<template>`, `<style>`, and `<script>` HTML tags which are parsed at runtime.
 */

/**
 * @typedef {Object} RegistrationResult
 * @property {string} filePath - The path of the source file.
 * @property {'ok'|'name-derive-failed'|'already-defined'|'parse-failed'|'import-failed'|'style-failed'|'define-failed'|'system-error'} status - The outcome status.
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
 * @returns {Promise<RegistrationResult[]>} A promise resolving to an array of the status reports.
 */
export async function registerComponents(rawComponents, ...globalSheets) {
    const components = rawComponents || {};
    const tasks = Object.entries(components).map(([filePath, rawContent]) =>
        registerSingleComponent(filePath, rawContent, globalSheets)
    );

    const results = await Promise.allSettled(tasks);

    return results.map((r, index) => {
        if (r.status === 'rejected') {
            const filePath = Object.keys(components)[index];
            console.error(`Component registration crashed for ${filePath}`, r.reason);
            return { filePath, status: 'system-error', error: r.reason };
        }
        return r.value;
    });
}

/**
 * Parses and registers a single SFC file as a custom element.
 * @param {string} filePath - The path of the source file.
 * @param {SFCModule} rawContent - The content or exported default of the SFC file.
 * @param {CSSStyleSheet[]} globalSheets - Optional global stylesheets to apply to every component instance.
 * @returns {Promise<RegistrationResult>}
 */
async function registerSingleComponent(filePath, rawContent, globalSheets) {
    let componentName;
    try {
        componentName = deriveComponentName(filePath);
    } catch (err) {
        return { filePath, status: 'name-derive-failed', error: err };
    }

    if (customElements.get(componentName)) {
        return { filePath, status: 'already-defined', error: null };
    }

    let sfc;
    try {
        sfc = parseSFCContent(rawContent);
    } catch (err) {
        return { filePath, status: 'parse-failed', error: err };
    }

    let module;
    try {
        module = await importSFCModule(sfc);
    } catch (err) {
        return { filePath, status: 'import-failed', error: err };
    }

    let styleSheets;
    try {
        styleSheets = createSFCStyles(sfc, globalSheets);
    } catch (err) {
        return { filePath, status: 'style-failed', error: err };
    }

    try {
        defineSFCElement(componentName, sfc, module, styleSheets);
        return { filePath, status: 'ok' };
    } catch (err) {
        return { filePath, status: 'define-failed', error: err };
    }
}

/**
 * Stage 1: Derives and validates the custom element name from the file path.
 * @param {string} filePath - The file path of the component.
 * @returns {string} The valid custom element tag name.
 */
function deriveComponentName(filePath) {
    if (!filePath || typeof filePath !== 'string') {
        throw new Error(`Invalid filePath: "${filePath}". Must be a non-empty string.`);
    }
    const componentName = filePath.split('/').pop().split('.')[0];
    if (!componentName || !componentName.includes('-')) {
        // https://html.spec.whatwg.org/multipage/custom-elements.html#valid-custom-element-name
        throw new Error(`Invalid custom element name: "${componentName}". Must contain a hyphen.`);
    }
    return componentName;
}

/**
* Stage 2: Parses raw SFC text content into a DOM Document.
* @param {SFCModule} rawContent - The content or exported default of the SFC file.
* @returns {Document} The parsed document representation of the SFC.
*/
function parseSFCContent(rawContent) {
    const contentString = typeof rawContent === 'string' ? rawContent : rawContent?.default ?? '';
    const sfc = new DOMParser().parseFromString(contentString, 'text/html');
    if (!sfc) throw new Error('DOMParser returned null document');
    return sfc;
}


/**
 * Stage 3: Compiles and imports the optional SFC script via a temporary Blob URL.
 * Safely revokes the object URL once the import is fully resolved.
 * @param {Document} sfc - The parsed SFC document.
 * @returns {Promise<any|null>} The imported module or null if no script is present.
 */
async function importSFCModule(sfc) {
    const script = sfc.querySelector('script');
    if (!script || !script.textContent.trim()) {
        return null;
    }
    const asyncWrapper = `export async function setup(shadowDocument) {${script.textContent}}`;
    const blob = new Blob([asyncWrapper], { type: 'text/javascript' });
    const scriptUrl = URL.createObjectURL(blob);
    try {
        return await import(scriptUrl);
    } finally {
        URL.revokeObjectURL(scriptUrl);
    }
}

/**
 * Stage 4: Generates the combined component styles and global stylesheets.
 * @param {Document} sfc - The parsed SFC document.
 * @param {CSSStyleSheet[]} globalSheets - Global stylesheets to inherit.
 * @returns {CSSStyleSheet[]} Array of stylesheets to apply to shadow root.
 */
function createSFCStyles(sfc, globalSheets) {
    const style = sfc.querySelector('style');
    const sheet = new CSSStyleSheet();
    if (style) {
        sheet.replaceSync(style.textContent || '');
    }
    return [...globalSheets, sheet].filter(Boolean);
}


/**
 * Stage 5: Defines the custom element class and registers it with the browser.
 * @param {string} componentName - The tag name for the custom element.
 * @param {Document} sfc - The parsed SFC document.
 * @param {any} module - The imported SFC module.
 * @param {CSSStyleSheet[]} styleSheets - Constructable stylesheets for shadow root.
 */
function defineSFCElement(componentName, sfc, module, styleSheets) {
    const template = sfc.querySelector('template') || document.createElement('template');

    // https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_custom_elements#custom_element_lifecycle_callbacks
    customElements.define(componentName, class extends HTMLElement {
        constructor() {
            super();
            this.attachShadow({ mode: 'open' });
        }
        connectedCallback() {
            this.shadowRoot.replaceChildren(template.content.cloneNode(true));
            this.shadowRoot.adoptedStyleSheets = styleSheets;
            if (module && typeof module.setup === 'function') {
                module.setup(this.shadowRoot)
                    .catch(err => console.error(`Component <${componentName}> setup() rejected:`, err));
            }
        }
        disconnectedCallback() {
            this.dispatchEvent(new CustomEvent('component:disconnected', { bubbles: false }));
        }
    });
}
