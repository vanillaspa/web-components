import { describe, it, expect, beforeEach } from 'vitest';
import { parseComponent, render, registerComponents } from './index.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const FULL_SFC = `
    <template><p>Hello</p></template>
    <style>p { color: red; }</style>
    <script>shadowDocument.host.setAttribute('data-ready', 'true');</script>
`;

// ---------------------------------------------------------------------------
// parseComponent
// ---------------------------------------------------------------------------

describe('parseComponent', () => {
    it('extracts a template element from the HTML', () => {
        const { template } = parseComponent(FULL_SFC);

        expect(template).not.toBeNull();
        expect(template.tagName.toLowerCase()).toBe('template');
    });

    it('extracts a style element from the HTML', () => {
        const { style } = parseComponent(FULL_SFC);

        expect(style).not.toBeNull();
        expect(style.tagName.toLowerCase()).toBe('style');
    });

    it('compiles the script body into an AsyncFunction', () => {
        const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
        const { setup } = parseComponent(FULL_SFC);

        expect(setup).toBeInstanceOf(AsyncFunction);
    });

    it('setup has shadowDocument as its only formal parameter', () => {
        const { setup } = parseComponent(FULL_SFC);

        expect(setup.length).toBe(1);
    });

    it('setup returns a Promise when called', () => {
        const { setup } = parseComponent('<script>/* noop */</script>');

        const result = setup(document.createDocumentFragment());

        expect(result).toBeInstanceOf(Promise);
        return result;
    });

    it('returns null for template when no <template> tag is present', () => {
        const { template } = parseComponent('<style></style><script></script>');

        expect(template).toBeNull();
    });

    it('returns null for style when no <style> tag is present', () => {
        const { style } = parseComponent('<template></template><script></script>');

        expect(style).toBeNull();
    });

    it('returns null for setup when no <script> tag is present', () => {
        const { setup } = parseComponent('<template></template>');

        expect(setup).toBeNull();
    });

    it('preserves inner HTML of the <template> tag', () => {
        const { template } = parseComponent('<template><span>hi</span></template>');

        expect(template.innerHTML).toBe('<span>hi</span>');
    });

    it('preserves the text content of the <style> tag', () => {
        const { style } = parseComponent('<style>p{color:blue}</style>');

        expect(style.textContent).toBe('p{color:blue}');
    });
});

// ---------------------------------------------------------------------------
// render
// ---------------------------------------------------------------------------

describe('render', () => {
    function makeShadowRoot() {
        const host = document.createElement('div');
        document.body.appendChild(host);
        return host.attachShadow({ mode: 'open' });
    }

    it('appends the template content into the shadow root', () => {
        const sr = makeShadowRoot();
        const { template } = parseComponent('<template><p>Hi</p></template>');

        render(sr, { template, style: null });

        expect(sr.querySelector('p')).not.toBeNull();
        expect(sr.querySelector('p').textContent).toBe('Hi');
    });

    it('appends the style element into the shadow root', () => {
        const sr = makeShadowRoot();
        const { style } = parseComponent('<style>p{color:red}</style>');

        render(sr, { template: null, style });

        expect(sr.querySelector('style')).not.toBeNull();
        expect(sr.querySelector('style').textContent).toBe('p{color:red}');
    });

    it('clears existing shadow root content before rendering', () => {
        const sr = makeShadowRoot();
        const component = parseComponent('<template><p>Content</p></template>');
        render(sr, component);

        render(sr, component);

        expect(sr.querySelectorAll('p').length).toBe(1);
    });

    it('clones template content so the original is reusable across multiple renders', () => {
        const sr1 = makeShadowRoot();
        const sr2 = makeShadowRoot();
        const component = parseComponent('<template><p>Clone</p></template>');

        render(sr1, component);
        render(sr2, component);

        expect(sr1.querySelector('p')).not.toBeNull();
        expect(sr2.querySelector('p')).not.toBeNull();
    });

    it('does not throw when template is null', () => {
        const sr = makeShadowRoot();

        expect(() => render(sr, { template: null, style: null })).not.toThrow();
    });

    it('does not throw when style is null', () => {
        const sr = makeShadowRoot();
        const { template } = parseComponent('<template><p>Hi</p></template>');

        expect(() => render(sr, { template, style: null })).not.toThrow();
    });
});

// ---------------------------------------------------------------------------
// registerComponents
// ---------------------------------------------------------------------------

describe('registerComponents', () => {
    it('defines a custom element whose tag name equals the filename stem', () => {
        registerComponents({ '/src/components/reg-tag.html': '<template></template>' });

        expect(customElements.get('reg-tag')).toBeDefined();
    });

    it('attaches an open shadow DOM in the element constructor', () => {
        registerComponents({ '/src/components/reg-shadow.html': '<template></template>' });
        const el = document.createElement('reg-shadow');

        expect(el.shadowRoot).not.toBeNull();
        expect(el.shadowRoot.mode).toBe('open');
    });

    it('renders the template into the shadow root when connected to the document', () => {
        registerComponents({
            '/src/components/reg-render.html': '<template><span>rendered</span></template>',
        });
        const el = document.createElement('reg-render');

        document.body.appendChild(el);

        expect(el.shadowRoot.querySelector('span')).not.toBeNull();
        expect(el.shadowRoot.querySelector('span').textContent).toBe('rendered');
    });

    it('calls setup with the shadow root as argument when connected to the document', async () => {
        registerComponents({
            '/src/components/reg-setup.html': `
                <template></template>
                <script>shadowDocument.host.setAttribute('data-ready', 'true');</script>
            `,
        });
        const el = document.createElement('reg-setup');

        document.body.appendChild(el);
        await Promise.resolve(); // flush the microtask queue for the AsyncFunction

        expect(el.getAttribute('data-ready')).toBe('true');
    });

    it('dispatches a component:disconnected event when removed from the document', () => {
        registerComponents({ '/src/components/reg-disc.html': '<template></template>' });
        const el = document.createElement('reg-disc');
        document.body.appendChild(el);

        let fired = false;
        el.addEventListener('component:disconnected', () => { fired = true; });

        document.body.removeChild(el);

        expect(fired).toBe(true);
    });

    it('the component:disconnected event does not bubble up the DOM tree', () => {
        registerComponents({ '/src/components/reg-bubble.html': '<template></template>' });
        const el = document.createElement('reg-bubble');
        document.body.appendChild(el);

        let bubbled = false;
        const handler = () => { bubbled = true; };
        document.body.addEventListener('component:disconnected', handler);

        document.body.removeChild(el);
        document.body.removeEventListener('component:disconnected', handler);

        expect(bubbled).toBe(false);
    });

    it('derives the tag name from nested path filenames correctly', () => {
        registerComponents({ '/src/components/ui/nested/my-nested-comp.html': '<template></template>' });

        expect(customElements.get('my-nested-comp')).toBeDefined();
    });
});
