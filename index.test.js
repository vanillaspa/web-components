import { describe, it, expect } from 'vitest';
import { render, registerComponents } from './index.js';

// ---------------------------------------------------------------------------
// render — null-handling
// ---------------------------------------------------------------------------

describe('render', () => {
    it('renders nothing when templateHtml is empty and sheet is null', () => {
        const shadowRoot = document.createElement('div').attachShadow({ mode: 'open' });
        render(shadowRoot, '', null);

        expect(shadowRoot.childNodes.length).toBe(0);
    });

    it('applies the adopted stylesheet when a sheet is provided', () => {
        const shadowRoot = document.createElement('div').attachShadow({ mode: 'open' });
        const sheet = new CSSStyleSheet();
        sheet.replaceSync('div { color: red; }');
        render(shadowRoot, '', sheet);

        expect(shadowRoot.adoptedStyleSheets).toContain(sheet);
    });
});

// ---------------------------------------------------------------------------
// registerComponents — tag-name derivation
// ---------------------------------------------------------------------------

describe('registerComponents', () => {
    it('derives the tag name from the filename stem', () => {
        registerComponents({
            '/src/components/my-widget.html': { templateHtml: '', styleText: '', setup: null },
        });

        expect(customElements.get('my-widget')).toBeDefined();
    });

    it('derives the tag name correctly from a nested path', () => {
        registerComponents({
            '/src/components/ui/nested/my-nested-comp.html': { templateHtml: '', styleText: '', setup: null },
        });

        expect(customElements.get('my-nested-comp')).toBeDefined();
    });

    it('passes the shadow root as shadowDocument to the setup function', async () => {
        registerComponents({
            '/src/components/shadow-doc-test.html': {
                templateHtml: '',
                styleText: '',
                setup: async (shadowDocument) => {
                    shadowDocument.host.setAttribute('data-shadow', 'true');
                },
            },
        });

        const el = document.createElement('shadow-doc-test');
        document.body.appendChild(el);
        await Promise.resolve();

        expect(el.getAttribute('data-shadow')).toBe('true');
    });
});
