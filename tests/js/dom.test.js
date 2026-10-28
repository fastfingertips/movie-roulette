import { describe, expect, it } from 'vitest';
import { hydrateModal, refreshIcons } from '../../static/js/modules/dom.js';
import {
    THEMES,
    buildThemeMenuHtml,
    getCounterpartTheme,
    getEffectiveMode,
    getStoredThemeMode,
    setStoredThemeMode
} from '../../static/js/modules/theme.js';

describe('DOM hydration and dynamic theme menu', () => {
    it('builds segmented mode switch with system option and unified palette options', () => {
        const lightHtml = buildThemeMenuHtml(THEMES, 'light', 'classic-light', 'system');
        expect(lightHtml).toContain('theme-mode-switch');
        expect(lightHtml).toContain('data-mode-value="system"');
        expect(lightHtml).toContain('data-mode-value="light"');
        expect(lightHtml).toContain('data-mode-value="dark"');
        expect(lightHtml).toContain('System');
        expect(lightHtml).toContain('data-theme-id="classic-light"');
        expect(lightHtml).toContain('Classic');
        expect(lightHtml).toContain('Pine &amp; Orchid');

        const darkHtml = buildThemeMenuHtml(THEMES, 'dark', 'classic-dark', 'dark');
        expect(darkHtml).toContain('data-theme-id="classic-dark"');
        expect(darkHtml).toContain('data-theme-id="midnight-lime"');
        expect(darkHtml).toContain('data-theme-id="amoled"');
    });

    it('defaults theme mode to system and manages storage transitions', () => {
        const store = {};
        const originalStorage = globalThis.localStorage;
        globalThis.localStorage = {
            getItem: (key) => store[key] || null,
            setItem: (key, val) => { store[key] = String(val); },
            removeItem: (key) => { delete store[key]; }
        };

        try {
            expect(getStoredThemeMode()).toBe('system');
            setStoredThemeMode('dark');
            expect(getStoredThemeMode()).toBe('dark');
            expect(getEffectiveMode('dark')).toBe('dark');

            setStoredThemeMode('light');
            expect(getStoredThemeMode()).toBe('light');
            expect(getEffectiveMode('light')).toBe('light');

            setStoredThemeMode('system');
            expect(getStoredThemeMode()).toBe('system');
        } finally {
            if (originalStorage) {
                globalThis.localStorage = originalStorage;
            } else {
                delete globalThis.localStorage;
            }
        }
    });

    it('resolves symmetric counterpart theme across light and dark modes', () => {
        expect(getCounterpartTheme('classic-light', 'dark')).toBe('classic-dark');
        expect(getCounterpartTheme('classic-dark', 'light')).toBe('classic-light');
        expect(getCounterpartTheme('forest-lime', 'dark')).toBe('midnight-lime');
        expect(getCounterpartTheme('midnight-lime', 'light')).toBe('forest-lime');
        expect(getCounterpartTheme('amoled-light', 'dark')).toBe('amoled');
        expect(getCounterpartTheme('amoled', 'light')).toBe('amoled-light');
        expect(getCounterpartTheme('letterboxd-light', 'dark')).toBe('letterboxd-dark');
        expect(getCounterpartTheme('letterboxd-dark', 'light')).toBe('letterboxd-light');
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
