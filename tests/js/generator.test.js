import { describe, expect, it } from 'vitest';
import {
    buildGeneratorOutput,
    GENERATOR_DOCS_MARKDOWN,
    getSourceMeta,
    initDocsPagination,
    normalizeSourceInput,
    parseSourceTokens,
    renderSourceList
} from '../../static/js/modules/generator.js';

describe('getSourceMeta & parseSourceTokens', () => {
    it('correctly metadataizes a user watchlist', () => {
        const meta = getSourceMeta('bugracoskun');
        expect(meta).toEqual({
            raw: 'bugracoskun',
            normalized: 'bugracoskun',
            type: 'user',
            label: 'Watchlist',
            display: '@bugracoskun'
        });
    });

    it('correctly metadataizes a custom list', () => {
        const meta = getSourceMeta('official/letterboxds-top-500-films');
        expect(meta).toEqual({
            raw: 'official/letterboxds-top-500-films',
            normalized: 'official/letterboxds-top-500-films',
            type: 'list',
            label: 'Custom List',
            display: 'official/letterboxds-top-500-films'
        });
    });

    it('correctly metadataizes an explicit watchlist path', () => {
        const meta = getSourceMeta('https://letterboxd.com/dave/watchlist/');
        expect(meta).toEqual({
            raw: 'https://letterboxd.com/dave/watchlist/',
            normalized: 'dave/watchlist',
            type: 'user',
            label: 'Watchlist',
            display: '@dave'
        });
    });

    it('parses multiple sources with deduplication', () => {
        const input = 'bugracoskun, official/top-250-films\nbugracoskun';
        const parsed = parseSourceTokens(input);
        expect(parsed).toHaveLength(2);
        expect(parsed[0].normalized).toBe('bugracoskun');
        expect(parsed[1].normalized).toBe('official/top-250-films');
    });

    it('returns empty array for empty inputs', () => {
        expect(parseSourceTokens('')).toEqual([]);
        expect(parseSourceTokens('   ')).toEqual([]);
    });

    it('renders empty message when no sources parsed', () => {
        const listEl = { innerHTML: '' };
        const countEl = { textContent: '' };
        const badgeEl = { textContent: '' };

        renderSourceList(listEl, countEl, badgeEl, []);

        expect(badgeEl.textContent).toBe('0 sources');
        expect(countEl.textContent).toBe('No sources detected');
        expect(listEl.innerHTML).toContain('generator-source-empty');
    });

    it('renders list items when sources are present', () => {
        const listEl = { innerHTML: '' };
        const countEl = { textContent: '' };
        const badgeEl = { textContent: '' };

        const sources = parseSourceTokens('bugracoskun, official/top-250-films');
        renderSourceList(listEl, countEl, badgeEl, sources);

        expect(badgeEl.textContent).toBe('2 sources');
        expect(countEl.textContent).toBe('2 sources detected');
        expect(listEl.innerHTML).toContain('@bugracoskun');
        expect(listEl.innerHTML).toContain('official/top-250-films');
        expect(listEl.innerHTML).toContain('generator-source-item');
        expect(listEl.innerHTML).not.toContain('/r/');
    });
});

describe('normalizeSourceInput', () => {
    it('normalizes full Letterboxd URLs and clean slugs', () => {
        expect(normalizeSourceInput('https://letterboxd.com/bugracoskun/list/turkish/')).toBe('bugracoskun/turkish');
        expect(normalizeSourceInput('https://letterboxd.com/bugracoskun/watchlist/')).toBe('bugracoskun/watchlist');
        expect(normalizeSourceInput('https://letterboxd.com/bugracoskun/')).toBe('bugracoskun');
        expect(normalizeSourceInput('bugracoskun/turkish')).toBe('bugracoskun/turkish');
        expect(normalizeSourceInput('  official/top-250-films  ')).toBe('official/top-250-films');
    });

    it('handles multiple sources across lines or commas', () => {
        const input = 'bugracoskun/turkish, https://letterboxd.com/official/top-250-films/\nuser2/watchlist';
        expect(normalizeSourceInput(input)).toBe('bugracoskun/turkish,official/top-250-films,user2/watchlist');
    });

    it('returns empty string for empty or blank input', () => {
        expect(normalizeSourceInput('')).toBe('');
        expect(normalizeSourceInput('   \n  \t ')).toBe('');
    });
});

describe('buildGeneratorOutput', () => {
    const origin = 'https://roulette.bugra.co';

    it('builds clean redirect URL for single list', () => {
        const res = buildGeneratorOutput({
            sources: 'bugracoskun/turkish',
            actionType: 'redirect',
            origin
        });

        expect(res.url).toBe('https://roulette.bugra.co/r/bugracoskun/turkish');
        expect(res.html).toBe('<a href="https://roulette.bugra.co/r/bugracoskun/turkish">Random Movie</a>');
        expect(res.markdown).toBe('[Random Movie](https://roulette.bugra.co/r/bugracoskun/turkish)');
    });

    it('attaches count hint to single list redirect', () => {
        const res = buildGeneratorOutput({
            sources: 'bugracoskun/turkish',
            count: 1200,
            actionType: 'redirect',
            origin
        });

        expect(res.url).toBe('https://roulette.bugra.co/r/bugracoskun/turkish?count=1200');
        expect(res.html).toBe('<a href="https://roulette.bugra.co/r/bugracoskun/turkish?count=1200">Random Movie</a>');
    });

    it('does not attach shuffle parameter by default', () => {
        const res = buildGeneratorOutput({
            sources: 'bugracoskun/turkish',
            actionType: 'redirect',
            origin
        });

        expect(res.url).toBe('https://roulette.bugra.co/r/bugracoskun/turkish');
        expect(res.url).not.toContain('shuffle');
    });

    it('attaches shuffle parameter when explicitly enabled', () => {
        const res = buildGeneratorOutput({
            sources: 'bugracoskun/turkish',
            shuffle: true,
            actionType: 'redirect',
            origin
        });

        expect(res.url).toBe('https://roulette.bugra.co/r/bugracoskun/turkish?shuffle=1');
    });

    it('supports legacy strategy=letterboxd parameter', () => {
        const res = buildGeneratorOutput({
            sources: 'bugracoskun/turkish',
            strategy: 'letterboxd',
            actionType: 'redirect',
            origin
        });

        expect(res.url).toBe('https://roulette.bugra.co/r/bugracoskun/turkish?shuffle=1');
    });

    it('builds query-based URL for multiple sources in redirect mode', () => {
        const res = buildGeneratorOutput({
            sources: 'user1/list1, user2/list2',
            mode: 'equal',
            actionType: 'redirect',
            origin
        });

        expect(res.url).toBe('https://roulette.bugra.co/r?url=user1/list1,user2/list2&mode=equal');
    });

    it('builds web app URL with auto-roll disabled', () => {
        const res = buildGeneratorOutput({
            sources: 'bugracoskun/turkish',
            actionType: 'app',
            autoRoll: false,
            origin
        });

        expect(res.url).toBe('https://roulette.bugra.co/?url=bugracoskun/turkish&run=0');
    });

    it('supports custom anchor label in HTML and Markdown', () => {
        const res = buildGeneratorOutput({
            sources: 'bugracoskun/turkish',
            label: 'Rastgele Film Sec',
            origin
        });

        expect(res.html).toBe('<a href="https://roulette.bugra.co/r/bugracoskun/turkish">Rastgele Film Sec</a>');
        expect(res.markdown).toBe('[Rastgele Film Sec](https://roulette.bugra.co/r/bugracoskun/turkish)');
    });

    it('supports json format output toggle', () => {
        const res = buildGeneratorOutput({
            sources: 'bugracoskun/turkish',
            format: 'json',
            origin
        });

        expect(res.url).toBe('https://roulette.bugra.co/r/bugracoskun/turkish?format=json');
    });

    it('provides comprehensive markdown documentation spec for AI and notes', () => {
        expect(GENERATOR_DOCS_MARKDOWN).toContain('Movie Roulette - URL Redirect & API Specification');
        expect(GENERATOR_DOCS_MARKDOWN).toContain('/r/:username');
        expect(GENERATOR_DOCS_MARKDOWN).toContain('/r/:username/:list_slug');
        expect(GENERATOR_DOCS_MARKDOWN).toContain('/r?url=list1,list2');
        expect(GENERATOR_DOCS_MARKDOWN).toContain('count (integer, optional)');
        expect(GENERATOR_DOCS_MARKDOWN).toContain('shuffle (1 | 0, default 0)');
        expect(GENERATOR_DOCS_MARKDOWN).toContain('mode (proportional | equal, default proportional)');
        expect(GENERATOR_DOCS_MARKDOWN).toContain('format (json, optional)');
    });

    it('manages tab switching, page visibility, and boundary navigation in initDocsPagination', () => {
        const createMockEl = () => {
            const listeners = {};
            const classes = new Set();
            const attrs = {};
            return {
                classes,
                attrs,
                disabled: false,
                textContent: '',
                addEventListener(evt, cb) {
                    listeners[evt] = cb;
                },
                click() {
                    if (listeners.click) listeners.click();
                },
                classList: {
                    toggle(cls, force) {
                        if (force) classes.add(cls);
                        else classes.delete(cls);
                    },
                    contains(cls) {
                        return classes.has(cls);
                    }
                },
                setAttribute(attr, val) {
                    attrs[attr] = String(val);
                },
                removeAttribute(attr) {
                    delete attrs[attr];
                }
            };
        };

        const tabs = [createMockEl(), createMockEl()];
        const pages = [createMockEl(), createMockEl()];
        const dots = [createMockEl(), createMockEl()];
        const prevBtn = createMockEl();
        const nextBtn = createMockEl();
        const pageNum = createMockEl();

        const mockModal = {
            querySelectorAll(sel) {
                if (sel === '.generator-docs-tab') return tabs;
                if (sel === '.generator-docs-page') return pages;
                if (sel === '.generator-page-dot') return dots;
                return [];
            },
            querySelector(sel) {
                if (sel === '#gen-docs-prev') return prevBtn;
                if (sel === '#gen-docs-next') return nextBtn;
                if (sel === '#gen-docs-current-page') return pageNum;
                return null;
            }
        };

        const pagination = initDocsPagination(mockModal);
        expect(pagination).not.toBeNull();
        expect(pagination.getCurrentIndex()).toBe(0);

        expect(prevBtn.disabled).toBe(true);
        expect(nextBtn.disabled).toBe(false);
        expect(pageNum.textContent).toBe('1');
        expect(tabs[0].classList.contains('is-active')).toBe(true);
        expect(tabs[1].classList.contains('is-active')).toBe(false);

        pagination.setPage(1);
        expect(pagination.getCurrentIndex()).toBe(1);
        expect(prevBtn.disabled).toBe(false);
        expect(nextBtn.disabled).toBe(true);
        expect(pageNum.textContent).toBe('2');

        // Test boundary limits
        pagination.setPage(5);
        expect(pagination.getCurrentIndex()).toBe(1);
        pagination.setPage(-1);
        expect(pagination.getCurrentIndex()).toBe(1);

        // Prev / next button clicks
        prevBtn.click();
        expect(pagination.getCurrentIndex()).toBe(0);
        expect(pageNum.textContent).toBe('1');
        nextBtn.click();
        expect(pagination.getCurrentIndex()).toBe(1);
        expect(pageNum.textContent).toBe('2');
    });
});
