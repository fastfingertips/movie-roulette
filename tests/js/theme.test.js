import { describe, expect, it } from 'vitest';
import {
    SYSTEM_THEME,
    THEMES,
    resolveTheme
} from '../../static/js/modules/theme.js';

describe('theme constants and mapping', () => {
    it('defines expected semantic theme identifiers and modes', () => {
        const themeSummary = THEMES.map(t => ({ id: t.id, mode: t.mode }));
        expect(themeSummary).toEqual([
            { id: 'classic-light', mode: 'light' },
            { id: 'pine-orchid', mode: 'light' },
            { id: 'citron-berry', mode: 'light' },
            { id: 'forest-lime', mode: 'light' },
            { id: 'classic-dark', mode: 'dark' },
            { id: 'amoled', mode: 'dark' },
            { id: 'midnight-lime', mode: 'dark' }
        ]);
        expect(THEMES).toHaveLength(7);
        THEMES.forEach(t => {
            expect(t.name).toBeTruthy();
            expect(t.bg).toBeTruthy();
            expect(t.colors).toHaveLength(3);
        });
    });

    it('sets default light and dark themes', () => {
        expect(SYSTEM_THEME.light).toBe('forest-lime');
        expect(SYSTEM_THEME.dark).toBe('midnight-lime');
    });

    it('resolves semantic theme IDs', () => {
        expect(resolveTheme('forest-lime')?.id).toBe('forest-lime');
        expect(resolveTheme('forest-lime')?.mode).toBe('light');

        expect(resolveTheme('amoled')?.id).toBe('amoled');
        expect(resolveTheme('amoled')?.mode).toBe('dark');

        expect(resolveTheme('midnight-lime')?.id).toBe('midnight-lime');
        expect(resolveTheme('midnight-lime')?.mode).toBe('dark');

        // Invalid themes return null
        expect(resolveTheme('light-2')).toBeNull();
        expect(resolveTheme('dark-3')).toBeNull();
        expect(resolveTheme('non-existent')).toBeNull();
        expect(resolveTheme('')).toBeNull();
        expect(resolveTheme(null)).toBeNull();
    });
});
