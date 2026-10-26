import { describe, expect, it } from 'vitest';
import {
    SYSTEM_THEME,
    THEME_MIGRATION_MAP,
    THEMES,
    resolveTheme
} from '../../static/js/modules/theme.js';

describe('theme constants and mapping', () => {
    it('defines expected semantic theme identifiers', () => {
        const themeIds = THEMES.map(t => t.id);
        expect(themeIds).toEqual([
            'classic-light',
            'pine-orchid',
            'citron-berry',
            'forest-lime',
            'classic-dark',
            'amoled',
            'midnight-lime'
        ]);
    });

    it('sets default light and dark themes', () => {
        expect(SYSTEM_THEME.light).toBe('forest-lime');
        expect(SYSTEM_THEME.dark).toBe('midnight-lime');
    });

    it('migrates legacy numbered theme IDs to semantic keys', () => {
        expect(THEME_MIGRATION_MAP).toEqual({
            light: 'classic-light',
            'light-2': 'pine-orchid',
            'light-3': 'citron-berry',
            'light-4': 'forest-lime',
            dark: 'classic-dark',
            'dark-2': 'amoled',
            'dark-3': 'midnight-lime'
        });
    });

    it('resolves semantic and legacy theme IDs', () => {
        expect(resolveTheme('forest-lime')?.id).toBe('forest-lime');
        expect(resolveTheme('forest-lime')?.mode).toBe('light');

        expect(resolveTheme('amoled')?.id).toBe('amoled');
        expect(resolveTheme('amoled')?.mode).toBe('dark');

        // Legacy migration resolution
        expect(resolveTheme('light-4')?.id).toBe('forest-lime');
        expect(resolveTheme('dark-3')?.id).toBe('midnight-lime');
        expect(resolveTheme('dark-2')?.id).toBe('amoled');
        expect(resolveTheme('light-2')?.id).toBe('pine-orchid');
        expect(resolveTheme('light-3')?.id).toBe('citron-berry');
        expect(resolveTheme('light')?.id).toBe('classic-light');
        expect(resolveTheme('dark')?.id).toBe('classic-dark');

        // Invalid themes
        expect(resolveTheme('non-existent')).toBeNull();
        expect(resolveTheme('')).toBeNull();
        expect(resolveTheme(null)).toBeNull();
    });
});
