import { describe, it, expect } from 'vitest';
import { parseComponent, registerComponents } from './index.js';

// ---------------------------------------------------------------------------
// parseComponent — null-handling (own logic, not platform behaviour)
// ---------------------------------------------------------------------------

describe('parseComponent', () => {
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
});

// ---------------------------------------------------------------------------
// registerComponents — tag-name derivation (own logic)
// ---------------------------------------------------------------------------

describe('registerComponents', () => {
    it('derives the tag name from the filename stem', () => {
        registerComponents({ '/src/components/my-widget.html': '<template></template>' });

        expect(customElements.get('my-widget')).toBeDefined();
    });

    it('derives the tag name correctly from a nested path', () => {
        registerComponents({ '/src/components/ui/nested/my-nested-comp.html': '<template></template>' });

        expect(customElements.get('my-nested-comp')).toBeDefined();
    });

    it('passes the shadow root as shadowDocument to the setup script', async () => {
        registerComponents({
            '/src/components/shadow-doc-test.html': `
                <template></template>
                <script>shadowDocument.host.setAttribute('data-shadow', 'true');</script>
            `,
        });
        const el = document.createElement('shadow-doc-test');
        document.body.appendChild(el);
        await Promise.resolve();

        expect(el.getAttribute('data-shadow')).toBe('true');
    });
});
