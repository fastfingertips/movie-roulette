import { beforeEach, describe, expect, it } from 'vitest';
import {
    clearHistory,
    clearRecentLists,
    getHistory,
    getHistoryDisabled,
    getLists,
    saveHistory,
    saveHistoryDisabled,
    saveRecentLists
} from '../../static/js/modules/storage.js';

describe('storage module - history disable toggle', () => {
    let store = {};

    beforeEach(() => {
        store = {};
        globalThis.localStorage = {
            getItem: (key) => store[key] || null,
            setItem: (key, val) => { store[key] = String(val); },
            removeItem: (key) => { delete store[key]; }
        };
    });

    it('defaults getHistoryDisabled to false', () => {
        expect(getHistoryDisabled()).toBe(false);
    });

    it('persists history disabled state', () => {
        saveHistoryDisabled(true);
        expect(getHistoryDisabled()).toBe(true);
        expect(store['lb_history_disabled']).toBe('true');

        saveHistoryDisabled(false);
        expect(getHistoryDisabled()).toBe(false);
        expect(store['lb_history_disabled']).toBe('false');
    });

    it('saves history and recent lists when not disabled', () => {
        saveHistory({ movie: { name: 'Inception' } });
        expect(getHistory()).toHaveLength(1);

        saveRecentLists(['https://letterboxd.com/user/list/test/']);
        expect(getLists()).toHaveLength(1);
    });

    it('does not save history or recent lists when disabled', () => {
        saveHistoryDisabled(true);

        saveHistory({ movie: { name: 'Interstellar' } });
        expect(getHistory()).toHaveLength(0);

        saveRecentLists(['https://letterboxd.com/user/list/test2/']);
        expect(getLists()).toHaveLength(0);
    });

    it('clears history and recent lists correctly', () => {
        saveHistory({ movie: { name: 'Memento' } });
        saveRecentLists(['https://letterboxd.com/user/list/test/']);
        expect(getHistory()).toHaveLength(1);
        expect(getLists()).toHaveLength(1);

        clearHistory();
        clearRecentLists();
        expect(getHistory()).toHaveLength(0);
        expect(getLists()).toHaveLength(0);
    });
});
