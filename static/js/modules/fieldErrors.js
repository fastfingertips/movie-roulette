/**
 * Server error handling for URL fields.
 *
 * Single place that knows how to:
 *  - classify an API error into a badge + default message
 *  - render that error on a field (badge, tooltip, meta line, invalid border)
 *  - persist it on the input so it survives UI re-renders until the value changes
 *  - clear it again
 *
 * This module intentionally has no imports to avoid circular dependencies.
 */

const DEFAULT_MESSAGES = {
    'Not Found': 'Could not be found on Letterboxd',
    'Private': 'Private on Letterboxd',
    'Empty': 'This list or watchlist is empty on Letterboxd',
};

/**
 * Classify an API error. Returns null when the error is not a field-level problem
 * (e.g. network failure, rate limit), so callers can ignore it.
 * @param {{status?: number, isEmptyList?: boolean}} err
 * @returns {{badge: 'Not Found'|'Private'|'Empty', defaultMessage: string}|null}
 */
export const classifyError = (err) => {
    if (!err) return null;
    let badge = null;
    if (err.status === 404) badge = 'Not Found';
    else if (err.status === 403) badge = 'Private';
    else if (err.status === 422 || err.isEmptyList === true) badge = 'Empty';
    return badge ? { badge, defaultMessage: DEFAULT_MESSAGES[badge] } : null;
};

const getParts = (input) => {
    const wrapper = input.closest('.field__input-wrapper');
    return {
        statusEl: wrapper?.querySelector('.field__status') || null,
        metaEl: wrapper?.querySelector('.field__meta') || null,
    };
};

const renderError = (input, badge, message) => {
    const { statusEl, metaEl } = getParts(input);
    input.classList.add('is-invalid');
    if (statusEl) {
        statusEl.textContent = badge;
        statusEl.title = message;
        statusEl.classList.add('is-visible', 'is-invalid');
    }
    if (metaEl && message) {
        metaEl.textContent = message;
        metaEl.classList.add('is-visible');
        input.classList.add('has-meta');
    }
};

/**
 * Show an error on a field and remember it until the input value changes.
 * @param {HTMLInputElement} input
 * @param {string} badge Badge label (e.g. "Empty")
 * @param {string} message Tooltip / meta text
 */
export const applyServerError = (input, badge, message) => {
    input.dataset.serverError = badge;
    input.dataset.serverErrorVal = input.value.trim().toLowerCase();
    input.dataset.serverErrorMsg = message;
    renderError(input, badge, message);
};

/** Remove any remembered server error from a field. */
export const clearServerError = (input) => {
    delete input.dataset.serverErrorVal;
    delete input.dataset.serverError;
    delete input.dataset.serverErrorMsg;
};

/**
 * Re-render a remembered error if the input value is unchanged.
 * If the value changed, the remembered error is dropped.
 * @returns {boolean} true when an error was re-rendered (caller should stop processing)
 */
export const reapplyServerError = (input) => {
    if (!input.dataset.serverErrorVal) return false;
    if (input.dataset.serverErrorVal !== input.value.trim().toLowerCase()) {
        clearServerError(input);
        return false;
    }
    renderError(
        input,
        input.dataset.serverError || 'Invalid',
        input.dataset.serverErrorMsg || '',
    );
    return true;
};
