/**
 * @fileoverview Vite plugin that transforms SFC <code>.html</code> files into real ES modules at build time.
 *
 * Eliminates runtime string evaluation (<code>AsyncFunction</code> / <code>unsafe-eval</code>) by compiling each
 * component's <code>&lt;template&gt;</code>, <code>&lt;style&gt;</code>, and <code>&lt;script&gt;</code>
 * into a standard ES module during the Vite transform phase. The consuming app requires no special
 * Content-Security-Policy directive.
 *
 * Each transformed <code>.html</code> module exports:
 * <ul>
 *   <li><code>templateHtml</code> — inner HTML of the <code>&lt;template&gt;</code> tag, or <code>""</code>.</li>
 *   <li><code>styleText</code>    — inner text of the <code>&lt;style&gt;</code> tag, or <code>""</code>.</li>
 *   <li><code>setup</code>        — async setup function receiving <code>shadowDocument</code>, or <code>null</code>.</li>
 * </ul>
 *
 * Note: SFC root tags (<code>&lt;template&gt;</code>, <code>&lt;style&gt;</code>, <code>&lt;script&gt;</code>)
 * must not carry HTML attributes.
 *
 * @module vite-plugin-sfc
 */

/**
 * Returns a Vite plugin that compiles `.html` SFC files into ES modules.
 *
 * @returns {Object} A Vite plugin object — see {@link https://vite.dev/guide/api-plugin Vite Plugin API}.
 */
export function sfcPlugin() {
    return {
        name: 'vite-sfc',
        enforce: 'pre',
        transform(src, id) {
            if (id.includes('\0') || !id.endsWith('.html') || id.includes('?')) return;
            // Skip full HTML documents (e.g. the app entry-point index.html)
            if (/<(!DOCTYPE|html)[\s>]/i.test(src)) return;

            const templateMatch = src.match(/<template>([\s\S]*?)<\/template>/);
            const styleMatch    = src.match(/<style>([\s\S]*?)<\/style>/);
            const scriptMatch   = src.match(/<script>([\s\S]*?)<\/script>/);

            const templateHtml = templateMatch ? templateMatch[1].trim() : '';
            const styleText    = styleMatch    ? styleMatch[1].trim()    : '';

            const setupExport = scriptMatch
                ? `export async function setup(shadowDocument) {\n${scriptMatch[1]}\n}`
                : `export const setup = null;`;

            return {
                code: [
                    `export const templateHtml = ${JSON.stringify(templateHtml)};`,
                    `export const styleText = ${JSON.stringify(styleText)};`,
                    setupExport,
                ].join('\n'),
                map: null,
            };
        },
    };
}
