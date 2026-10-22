import { describe, expect, it } from 'vitest';
import { classifyError } from '../../static/js/modules/fieldErrors.js';

describe('classifyError', () => {
    it.each([
        [{ status: 404 }, 'Not Found'],
        [{ status: 403 }, 'Private'],
        [{ status: 422 }, 'Empty'],
        [{ isEmptyList: true }, 'Empty'],
    ])('classifies %o as %s', (err, badge) => {
        const info = classifyError(err);
        expect(info.badge).toBe(badge);
        expect(info.defaultMessage).toBeTruthy();
    });

    it('ignores errors that are not field level problems', () => {
        expect(classifyError({ status: 500 })).toBeNull();
        expect(classifyError({ status: 503 })).toBeNull();
        expect(classifyError(new Error('network'))).toBeNull();
        expect(classifyError(null)).toBeNull();
    });

    it('does not infer the kind from message text', () => {
        // Regression: substring matching on "watchlist"/"empty" caused other fields to be flagged
        expect(classifyError({ status: 500, message: 'The watchlist is empty' })).toBeNull();
    });
});
