import { describe, expect, it } from 'vitest';
import {
    canonicalKey,
    escapeHtml,
    formatListUrl,
    parseUrlParams,
    stripOrigin,
} from '../../static/js/modules/utils.js';

describe('stripOrigin', () => {
    it('removes the Letterboxd origin and trailing slashes', () => {
        expect(stripOrigin('https://letterboxd.com/User/List/Foo/')).toBe('user/list/foo');
        expect(stripOrigin('https://www.letterboxd.com/user')).toBe('user');
    });

    it('handles empty and nullish input', () => {
        expect(stripOrigin('')).toBe('');
        expect(stripOrigin(null)).toBe('');
        expect(stripOrigin(undefined)).toBe('');
    });
});

describe('canonicalKey', () => {
    it.each([
        ['bugracoskun', 'bugracoskun/watchlist'],
        ['bugracoskun/watchlist', 'bugracoskun/watchlist'],
        ['bugracoskun/comedy', 'bugracoskun/list/comedy'],
        ['bugracoskun/list/comedy', 'bugracoskun/list/comedy'],
        ['https://letterboxd.com/bugracoskun/list/comedy/', 'bugracoskun/list/comedy'],
        ['bugracoskun/list/watchlist', 'bugracoskun/list/watchlist'],
    ])('maps %s to %s', (input, expected) => {
        expect(canonicalKey(input)).toBe(expected);
    });

    it('returns null for empty or reserved inputs', () => {
        expect(canonicalKey('')).toBeNull();
        expect(canonicalKey('films')).toBeNull();
        expect(canonicalKey('user/films')).toBeNull();
    });
});

describe('parseUrlParams', () => {
    it('splits comma separated sources and keeps order', () => {
        const { urls } = parseUrlParams('?url=a%2Fcomedy%2Cb%2Cc');
        expect(urls).toEqual(['a/comedy', 'b', 'c']);
    });

    it('drops duplicates by canonical key and flags duplicate watchlists', () => {
        const result = parseUrlParams('?url=user,user/watchlist');
        expect(result.urls).toEqual(['user']);
        expect(result.hasDuplicateWatchlist).toBe(true);
    });

    it('normalizes user/watchlist to the username', () => {
        const { urls } = parseUrlParams('?url=user/watchlist');
        expect(urls).toEqual(['user']);
    });

    it('limits the number of sources', () => {
        const { urls } = parseUrlParams('?url=a,b,c,d,e,f,g', 5);
        expect(urls).toHaveLength(5);
    });

    it('accepts alias parameter names', () => {
        expect(parseUrlParams('?lists=a').urls).toEqual(['a']);
        expect(parseUrlParams('?src=a&sources=b').urls).toEqual(['a', 'b']);
    });

    it.each(['?run=0', '?auto=0'])('disables auto run with %s', (search) => {
        expect(parseUrlParams(`${search}&url=a`).shouldRun).toBe(false);
    });

    it('auto runs by default and returns nothing for an empty query', () => {
        expect(parseUrlParams('?url=a').shouldRun).toBe(true);
        expect(parseUrlParams('').urls).toEqual([]);
    });
});

describe('formatListUrl', () => {
    it('formats watchlists and lists', () => {
        expect(formatListUrl('user')).toEqual({ name: 'user', type: 'Watchlist' });
        expect(formatListUrl('user/watchlist')).toEqual({ name: 'user', type: 'Watchlist' });
        expect(formatListUrl('user/list/comedy')).toEqual({ name: 'user/comedy', type: 'List' });
        expect(formatListUrl('user/comedy')).toEqual({ name: 'user/comedy', type: 'List' });
    });

    it('keeps a custom list named watchlist distinct', () => {
        expect(formatListUrl('user/list/watchlist')).toEqual({
            name: 'user/list/watchlist',
            type: 'List',
        });
    });
});

describe('escapeHtml', () => {
    it('escapes HTML special characters', () => {
        expect(escapeHtml('<a href="x">&\'</a>')).toBe(
            '&lt;a href=&quot;x&quot;&gt;&amp;&#039;&lt;/a&gt;',
        );
    });

    it('returns an empty string for nullish values', () => {
        expect(escapeHtml(null)).toBe('');
        expect(escapeHtml(undefined)).toBe('');
    });
});
