import { $ } from './dom.js';
import { fetchMetadata } from './api.js';
import { applyServerError, classifyError } from './fieldErrors.js';

// Film counts per list, keyed by a canonical identifier so that
// "user/slug" and the full Letterboxd URL share one cache entry.
const counts = new Map();
const pending = new Set();

import { canonicalKey } from './utils.js';
export { canonicalKey };

const getStatusEl = (input) => {
    const wrapper = input.closest('.field__input-wrapper');
    return wrapper ? wrapper.querySelector('.field__status') : null;
};

const getRatioEl = (input) => {
    const wrapper = input.closest('.field__input-wrapper');
    if (!wrapper) return null;
    let ratioEl = wrapper.querySelector('.field__ratio');
    if (!ratioEl) {
        ratioEl = document.createElement('span');
        ratioEl.className = 'field__ratio';
        const badges = wrapper.querySelector('.field__badges');
        if (badges) {
            badges.appendChild(ratioEl);
        } else {
            const statusEl = wrapper.querySelector('.field__status');
            if (statusEl) {
                const badgeWrap = document.createElement('div');
                badgeWrap.className = 'field__badges';
                statusEl.parentNode.insertBefore(badgeWrap, statusEl);
                badgeWrap.appendChild(statusEl);
                badgeWrap.appendChild(ratioEl);
            } else {
                wrapper.appendChild(ratioEl);
            }
        }
    }
    return ratioEl;
};

const isValidField = (input) => {
    const statusEl = getStatusEl(input);
    const key = canonicalKey(input.value);
    return !!statusEl
        && !!key
        && !statusEl.classList.contains('is-invalid');
};

const formatPercent = (pct) => `${Number(pct.toFixed(1))}%`;

const clearRatio = (input, statusEl) => {
    input.classList.remove('has-ratio');
    const wrapper = input.closest('.field__input-wrapper');
    if (wrapper) {
        wrapper.style.removeProperty('--ratio-n');
    }
    if (statusEl) {
        statusEl.removeAttribute('data-ratio');
    }
    const ratioEl = wrapper?.querySelector('.field__ratio');
    if (ratioEl) {
        ratioEl.textContent = '';
        ratioEl.classList.remove('is-visible');
        ratioEl.removeAttribute('title');
    }
};

/**
 * Recomputes every badge's ratio from the cached counts. Idempotent and
 * synchronous, so it is safe to call on every UI refresh.
 */
export const applyRatios = () => {
    const inputs = Array.from(document.querySelectorAll('.field__input'));
    const entries = inputs.map((input) => {
        const statusEl = getStatusEl(input);
        const key = statusEl && isValidField(input) ? canonicalKey(input.value) : null;
        const count = key && counts.has(key) ? counts.get(key) : null;
        return { input, statusEl, count };
    });

    const validEntries = entries.filter((e) => isValidField(e.input));
    const loaded = validEntries.filter((e) => e.count !== null);
    const total = loaded.reduce((sum, e) => sum + e.count, 0);
    const isEqual = !!$('sampling-toggle')?.checked && loaded.length > 1;

    // When there is only a single list or not enough loaded lists, do not show ratios or ratio borders
    if (validEntries.length <= 1 || loaded.length <= 1) {
        entries.forEach(({ input, statusEl }) => clearRatio(input, statusEl));
        return;
    }

    entries.forEach(({ input, statusEl, count }) => {
        if (!isValidField(input) || count === null || total === 0) {
            clearRatio(input, statusEl);
            return;
        }
        const pct = isEqual ? 100 / loaded.length : (count / total) * 100;
        const label = formatPercent(pct);

        // Ratio badge tooltip: sampling odds and combined pool share
        const ratioTitle = isEqual
            ? `${label} chance to be chosen (1 in ${loaded.length} lists · Equal Odds)`
            : `${label} of the combined pool (${count.toLocaleString()} of ${total.toLocaleString()} films)`;

        const ratioEl = getRatioEl(input);
        if (ratioEl) {
            ratioEl.textContent = label;
            ratioEl.title = ratioTitle;
            ratioEl.classList.add('is-visible');
        }
        input.classList.add('has-ratio');

        // Baseline scaling: ensures small lists stay aesthetically above the ~6% corner threshold
        // while strictly preserving visible relative length differences between small lists (e.g. 2.5% vs 5.3%)
        const p = pct / 100;
        const visualRatio = isEqual ? p : (0.055 + 0.945 * p);
        input.closest('.field__input-wrapper')?.style.setProperty('--ratio-n', visualRatio.toFixed(4));
    });
};

/** Fetches the film count for fields once (cached) and refreshes ratios. Also validates list existence on Letterboxd. */
export const loadCount = (input) => {
    if (!isValidField(input)) return;
    const inputsToCheck = input ? [input] : Array.from(document.querySelectorAll('.field__input')).filter(isValidField);

    inputsToCheck.forEach((inp) => {
        const key = canonicalKey(inp.value);
        if (!key || counts.has(key) || pending.has(key)) {
            applyRatios();
            return;
        }

        const statusEl = getStatusEl(inp);
        pending.add(key);
        if (statusEl) statusEl.classList.add('is-loading');

        fetchMetadata([inp.value.trim()])
            .then((data) => {
                const list = data.lists && data.lists[0];
                if (list) {
                    if (list.count <= 0) {
                        const target = list.is_watchlist ? 'watchlist' : 'list';
                        applyServerError(inp, 'Empty', `The ${target} for '${list.user}' is empty on Letterboxd`);
                        return;
                    }
                    counts.set(key, list.count);
                }
            })
            .catch((err) => {
                const info = classifyError(err);
                if (info) {
                    // Prefer the backend's detailed message when available
                    applyServerError(inp, info.badge, err.message || info.defaultMessage);
                }
            })
            .finally(() => {
                pending.delete(key);
                if (statusEl) statusEl.classList.remove('is-loading');
                applyRatios();
                const submitBtn = document.querySelector('#randomize-form button[type="submit"]');
                const hasInvalid = Array.from(document.querySelectorAll('.field__status.is-invalid')).length > 0;
                if (submitBtn && hasInvalid) {
                    submitBtn.disabled = true;
                }
            });
    });
};

export const refreshAllCounts = () => {
    const validInputs = Array.from(document.querySelectorAll('.field__input')).filter(isValidField);
    validInputs.forEach((inp) => loadCount(inp));
};

/** Seeds the cache from a metadata response (lists keep the input order). */
export const primeCounts = (urls, lists) => {
    (lists || []).forEach((list, i) => {
        const key = canonicalKey(urls[i]);
        if (key && typeof list.count === 'number') counts.set(key, list.count);
    });
    applyRatios();
};
