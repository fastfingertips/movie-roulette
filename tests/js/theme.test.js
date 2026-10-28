import { describe, expect, it } from 'vitest';
import {
    SYSTEM_THEME,
    THEMES,
    isTranslucent,
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
            { id: 'letterboxd-light', mode: 'light' },
            { id: 'amoled-light', mode: 'light' },
            { id: 'classic-dark', mode: 'dark' },
            { id: 'amoled', mode: 'dark' },
            { id: 'midnight-lime', mode: 'dark' },
            { id: 'letterboxd-dark', mode: 'dark' },
            { id: 'pine-orchid-dark', mode: 'dark' },
            { id: 'citron-berry-dark', mode: 'dark' }
        ]);
        expect(THEMES).toHaveLength(12);
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

        expect(resolveTheme('letterboxd-light')?.id).toBe('letterboxd-light');
        expect(resolveTheme('letterboxd-light')?.mode).toBe('light');

        expect(resolveTheme('amoled-light')?.id).toBe('amoled-light');
        expect(resolveTheme('amoled-light')?.mode).toBe('light');

        expect(resolveTheme('amoled')?.id).toBe('amoled');
        expect(resolveTheme('amoled')?.mode).toBe('dark');

        expect(resolveTheme('midnight-lime')?.id).toBe('midnight-lime');
        expect(resolveTheme('midnight-lime')?.mode).toBe('dark');

        expect(resolveTheme('letterboxd-dark')?.id).toBe('letterboxd-dark');
        expect(resolveTheme('letterboxd-dark')?.mode).toBe('dark');

        expect(resolveTheme('pine-orchid-dark')?.id).toBe('pine-orchid-dark');
        expect(resolveTheme('pine-orchid-dark')?.mode).toBe('dark');

        expect(resolveTheme('citron-berry-dark')?.id).toBe('citron-berry-dark');
        expect(resolveTheme('citron-berry-dark')?.mode).toBe('dark');

        // Invalid themes return null
        expect(resolveTheme('light-2')).toBeNull();
        expect(resolveTheme('dark-3')).toBeNull();
        expect(resolveTheme('non-existent')).toBeNull();
        expect(resolveTheme('')).toBeNull();
        expect(resolveTheme(null)).toBeNull();
    });

    it('defaults translucency to true when localStorage is unavailable', () => {
        expect(isTranslucent()).toBe(true);
    });
});
