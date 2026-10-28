import { describe, expect, it } from 'vitest';
import { hydrateModal, refreshIcons } from '../../static/js/modules/dom.js';
import { THEMES, buildThemeMenuHtml } from '../../static/js/modules/theme.js';

describe('DOM hydration and dynamic theme menu', () => {
    it('builds dynamic theme menu HTML for all light and dark themes', () => {
        const html = buildThemeMenuHtml();
        expect(html).toContain('Light Themes');
        expect(html).toContain('Dark Themes');
        THEMES.forEach(t => {
            expect(html).toContain(`data-theme-id="${t.id}"`);
            expect(html).toContain('theme-dot--bg');
        });
    });

    it('hydrates lazy modal template only once', () => {
        const appended = [];
        let tplRemoved = false;
        const mockTpl = {
            content: {
                cloneNode: () => ({ id: 'cloned-fragment' })
            },
            remove: () => {
                tplRemoved = true;
            }
        };
        const mockModal = {
            querySelector: (sel) => (sel === 'template' && !tplRemoved ? mockTpl : null),
            appendChild: (node) => appended.push(node)
        };

        expect(hydrateModal(mockModal)).toBe(true);
        expect(appended).toHaveLength(1);
        expect(tplRemoved).toBe(true);
        expect(hydrateModal(mockModal)).toBe(false);
    });

    it('safely handles null or missing window.lucide in refreshIcons', () => {
        expect(() => refreshIcons(null)).not.toThrow();
    });
});
