const htmlFiles = import.meta.glob('/src/components/**/*.html', { query: '?raw', import: 'default', eager: true });

window.getShadowDocument = function magic(hostDataIDs) {
    if (typeof hostDataIDs === 'string') { hostDataIDs = hostDataIDs.split(','); }
    else if (Array.isArray(hostDataIDs)) { hostDataIDs = hostDataIDs.toReversed(); }
    else return undefined;
    if (hostDataIDs) {
        let shadowDOM = document;
        for (let hostDataID of hostDataIDs) {
            let found = shadowDOM.querySelector('[data-id="' + hostDataID + '"]');
            if (found) { shadowDOM = found.shadowRoot; } else {
                console.error({ hostDataID });
                return null;
            }
        }
        return shadowDOM;
    }
    return null;
}

function getComponentName(filePath) {
    const fileName = filePath.split("/").pop();
    const dashSplit = fileName.split('-');
    const prefix = dashSplit[0];
    const dotSplit = dashSplit[1].split('.'); // TODO accept three-fold-components
    const suffix = dotSplit[0];
    return `${prefix}-${suffix}`;
}

for (let filePath of Object.keys(htmlFiles)) {
    let componentName = getComponentName(filePath);
    console.debug(`defining ${componentName}...`);
    let html = htmlFiles[filePath];
    const fragment = document.createRange().createContextualFragment(html);
    const scriptFragment = fragment.querySelector("script");
    const styleFragment = fragment.querySelector("style");
    const templateFragment = fragment.querySelector("template");
    customElements.define(componentName, class extends HTMLElement {
        constructor() {
            super();
            const shadowRoot = this.attachShadow({ mode: "open" });
        }
        connectedCallback() {
            this.hostDataIDs = []; // used to find the nested shadowDocument
            this.dataset.id = Math.random().toString(16).substring(2, 8); // should suffice
            let hostElement = this;
            while (hostElement && hostElement.dataset.id) { // +3 get parent.host data-id 's
                this.hostDataIDs.push(hostElement.dataset.id);
                hostElement = hostElement.getRootNode().host;
            }
            this.#render();
        }
        #render() {
            this.shadowRoot.replaceChildren();
            this.#appendTemplate();
            this.#appendStyle();
            this.#appendScript();
        }
        #appendScript() {
            if (scriptFragment) {
                const scriptElement = document.createElement("script");
                scriptElement.setAttribute("type", "module");
                scriptElement.textContent = `
const shadowDocument = getShadowDocument('${this.hostDataIDs.toReversed().toString()}');
${scriptFragment ? scriptFragment.textContent : ''}
`;
                this.shadowRoot.appendChild(scriptElement);
            }
        }
        #appendStyle() {
            if (styleFragment) {
                let clonedStyle = styleFragment.cloneNode(true);
                this.shadowRoot.appendChild(clonedStyle);
            }
        }
        #appendTemplate() {
            if (templateFragment) {
                const clonedFragment = templateFragment.content.cloneNode(true);
                this.shadowRoot.appendChild(clonedFragment);
            }
        }
    });
}
