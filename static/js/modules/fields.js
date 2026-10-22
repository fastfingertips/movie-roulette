import { $ } from './dom.js';
import { createUrlField } from '../components/UrlField.js';
import { CONFIG } from '../constants.js';
import { formatListUrl, canonicalKey, stripOrigin, RESERVED_SLUGS } from './utils.js';
import { loadCount } from './listStats.js';
import { fetchMetadata } from './api.js';
import { showToast } from './ui.js';

let urlCount = 1;


export const setUrlCount = (val) => { urlCount = val; };
export const getUrlCount = () => urlCount;

export const getActiveUrls = () => {
    const inputs = document.querySelectorAll('.field__input');
    return Array.from(inputs)
        .map(i => i.value.trim())
        .filter(v => v !== '');
};

export const renumberFields = () => {
    const fields = Array.from($('url-fields').querySelectorAll('.field'))
        .filter(f => !f.classList.contains('is-removing'));
    fields.forEach((field, i) => {
        const numEl = field.querySelector('.field__number');
        const newNum = i + 1;
        const oldNum = parseInt(numEl.textContent);

        // Trigger shift-up arrow animation if position changed
        if (oldNum && oldNum !== newNum) {
            numEl.classList.add('is-shifting');
            setTimeout(() => {
                numEl.textContent = newNum;
                numEl.classList.remove('is-shifting');
            }, 800); 
        } else if (!oldNum || oldNum !== newNum) {
            numEl.textContent = newNum;
        }

        const input = field.querySelector('input');
        const btn = field.querySelector('.field__remove');
        
        if (i === 0) {
            field.classList.remove('is-optional');
            input.placeholder = "URL, username, or user/list-slug…";
        } else {
            field.classList.add('is-optional');
            input.placeholder = "(Optional) URL, username, or slug…";
        }

        const isEmpty = input.value.trim() === '';
        if (!isEmpty) {
            btn.title = "Clear field";
        } else {
            btn.title = urlCount > 1 ? "Remove field" : "Clear field";
        }
    });

    $('url-fields').classList.toggle('is-single-field', urlCount === 1);
    $('add-url-btn').classList.toggle('is-hidden', urlCount >= CONFIG.MAX_URLS);
    const samplingWrapper = $('sampling-toggle-wrapper');
    if (samplingWrapper) {
        samplingWrapper.classList.toggle('is-hidden', urlCount <= 1);
    }
};

export const addField = (callback, value = '') => {
    if (urlCount >= CONFIG.MAX_URLS) return null;

    const div = createUrlField(urlCount + 1, value);
    $('url-fields').appendChild(div);
    urlCount++;
    renumberFields();
    if (window.lucide) window.lucide.createIcons();

    const input = div.querySelector('input');
    input.addEventListener('input', () => {
        renumberFields(); // Keep tooltips in sync as user types
        callback();
    });
    attachWatchlistWatcher(input, callback);
    
    div.querySelector('.field__remove').addEventListener('click', () => { 
        if (input.value !== '') {
            input.value = '';
            renumberFields(); // Update tooltips immediately after clearing
        } else if (urlCount > 1) {
            div.remove(); 
            urlCount--; 
            renumberFields();
        }
        callback();
    });
    return input;
};

let isAnimating = false;

export const animateShorten = (inputEl, shortForm) => {
    isAnimating = true;
    const eraseSpeed = 30;
    const typeSpeed = 80;
    
    const wrapper = inputEl.closest('.field__input-wrapper');
    const metaEl = wrapper ? wrapper.querySelector('.field__meta') : null;
    const originalValue = inputEl.value;

    if (metaEl) {
        metaEl.textContent = originalValue;
        metaEl.classList.add('is-visible');
        inputEl.classList.add('has-meta');
    }

    const eraseInterval = setInterval(() => {
        if (inputEl.value.length > 0) {
            inputEl.value = inputEl.value.slice(0, -1);
        } else {
            clearInterval(eraseInterval);
            
            // Small pause before typing
            setTimeout(() => {
                let i = 0;
                const typeInterval = setInterval(() => {
                    if (i < shortForm.length) {
                        inputEl.value += shortForm[i];
                        i++;
                    } else {
                        clearInterval(typeInterval);
                        isAnimating = false;
                        detectFieldType(inputEl);
                        if (document.activeElement !== inputEl) loadCount(inputEl);
                    }
                }, typeSpeed);
            }, 300);
        }
    }, eraseSpeed);
};

// Cache for list existence checks: username -> boolean (true: custom list exists, false: does not)
const customListExistenceCache = new Map();
const watchlistDebounceTimers = new Map();

export const checkAndResolveWatchlistSuffix = async (inputEl, updateUICallback) => {
    if (isAnimating || !inputEl) return;

    const rawVal = inputEl.value.trim().toLowerCase();
    const parts = stripOrigin(rawVal).split('/').filter(Boolean);

    // Only triggers for username/watchlist format (not username/list/watchlist)
    if (parts.length !== 2 || parts[1] !== 'watchlist') return;

    const username = parts[0];
    const wrapper = inputEl.closest('.field__input-wrapper');
    const statusEl = wrapper ? wrapper.querySelector('.field__status') : null;

    // Check if another field already has this username (as watchlist)
    const allInputs = Array.from(document.querySelectorAll('.field__input'));
    const isUsernameAlreadyPresent = allInputs.some((other) => {
        if (other === inputEl) return false;
        const otherVal = other.value.trim().toLowerCase();
        if (!otherVal) return false;
        const key = canonicalKey(otherVal);
        return key === `${username}/watchlist` || otherVal === username;
    });

    // Check cache first
    let hasCustomList = customListExistenceCache.get(username);

    if (hasCustomList === undefined) {
        // Show subtle checking status
        if (statusEl) {
            statusEl.textContent = 'Checking…';
            statusEl.classList.remove('is-invalid');
            statusEl.classList.add('is-visible', 'is-loading');
        }

        try {
            // Check if user has a custom list titled 'watchlist'
            await fetchMetadata([`${username}/list/watchlist`]);
            hasCustomList = true;
            customListExistenceCache.set(username, true);
        } catch {
            hasCustomList = false;
            customListExistenceCache.set(username, false);
        } finally {
            if (statusEl) {
                statusEl.classList.remove('is-loading');
            }
        }
    }

    // Input might have changed while awaiting
    if (inputEl.value.trim().toLowerCase() !== rawVal) return;

    if (hasCustomList) {
        // The user actually has a custom list named 'watchlist'!
        inputEl.value = `${username}/list/watchlist`;
        detectFieldType(inputEl);
        if (updateUICallback) updateUICallback();
        loadCount(inputEl);
    } else {
        // No custom list named 'watchlist' exists on Letterboxd.
        // It was intended to be the user's account watchlist.
        if (isUsernameAlreadyPresent) {
            // Cancel the entry as user's watchlist is already present
            inputEl.value = '';
            detectFieldType(inputEl);
            if (updateUICallback) updateUICallback();
            showToast(`'${username}' is already included.`);
        } else {
            // Convert to username using the typewriter animation
            showToast(`No list named 'watchlist' found. For watchlists, just type your username.`);
            animateShorten(inputEl, username);
        }
    }
};

export const attachWatchlistWatcher = (input, updateUICallback) => {
    input.addEventListener('input', () => {
        const parts = stripOrigin(input.value).split('/').filter(Boolean);
        if (parts.length === 2 && parts[1] === 'watchlist') {
            clearTimeout(watchlistDebounceTimers.get(input));
            const timer = setTimeout(() => {
                checkAndResolveWatchlistSuffix(input, updateUICallback);
            }, 600);
            watchlistDebounceTimers.set(input, timer);
        }
    });
};

// Fetch a list's film count as soon as the user leaves its textbox
export const initFieldStats = (updateUICallback) => {
    $('url-fields').addEventListener('focusout', (e) => {
        if (isAnimating || !e.target.matches('.field__input')) return;
        const inputEl = e.target;
        const parts = stripOrigin(inputEl.value).split('/').filter(Boolean);

        if (parts.length === 2 && parts[1] === 'watchlist') {
            checkAndResolveWatchlistSuffix(inputEl, updateUICallback);
        } else {
            loadCount(inputEl);
        }
    });
};

export const detectFieldType = (inputEl) => {
    if (isAnimating) return;

    const rawVal = inputEl.value.trim().toLowerCase();
    const wrapper = inputEl.closest('.field__input-wrapper');
    const statusEl = wrapper ? wrapper.querySelector('.field__status') : null;
    const metaEl = wrapper ? wrapper.querySelector('.field__meta') : null;
    
    if (!statusEl) return;
    
    if (!rawVal) {
        delete inputEl.dataset.serverErrorVal;
        delete inputEl.dataset.serverError;
        delete inputEl.dataset.serverErrorMsg;
        statusEl.classList.remove('is-visible', 'is-invalid');
        statusEl.removeAttribute('title');
        if (metaEl) {
            metaEl.classList.remove('is-visible');
            metaEl.textContent = '';
        }
        inputEl.classList.remove('has-meta', 'is-invalid');
        return;
    }

    // Preserve server error badges unless user changes input value
    if (inputEl.dataset.serverErrorVal) {
        if (inputEl.dataset.serverErrorVal === rawVal) {
            statusEl.textContent = inputEl.dataset.serverError || 'Invalid';
            statusEl.title = inputEl.dataset.serverErrorMsg || '';
            statusEl.classList.add('is-visible', 'is-invalid');
            inputEl.classList.add('is-invalid');
            if (metaEl && inputEl.dataset.serverErrorMsg) {
                metaEl.textContent = inputEl.dataset.serverErrorMsg;
                metaEl.classList.add('is-visible');
                inputEl.classList.add('has-meta');
            }
            return;
        }
        delete inputEl.dataset.serverErrorVal;
        delete inputEl.dataset.serverError;
        delete inputEl.dataset.serverErrorMsg;
    }

    // Detect full Letterboxd URL and trigger animation
    const isLetterboxdUrl = /^https?:\/\/(www\.)?letterboxd\.com\//.test(rawVal);
    if (isLetterboxdUrl) {
        const { name: short, type } = formatListUrl(rawVal);
        if (type && short) {
            animateShorten(inputEl, short);
            return;
        }
    }

    // Identify external domains (not letterboxd)
    const isUrl = rawVal.includes('.') || rawVal.includes('http');
    const isLetterboxd = rawVal.includes('letterboxd.com');
    
    if (isUrl && !isLetterboxd) {
        statusEl.textContent = 'Invalid';
        statusEl.title = 'Please enter a valid Letterboxd URL or username';
        statusEl.classList.add('is-visible', 'is-invalid');
        inputEl.classList.add('is-invalid');
        return;
    }

    // Strict validation: Incomplete paths (user/) are invalid, but full paths or watchlist paths with trailing slashes are OK
    const val = stripOrigin(rawVal);
    const parts = val.split('/').filter(Boolean);
    const isExplicitList = val.includes('/list/');

    // Invalid if:
    // 1. Single word + slash (e.g. nmcassa/)
    // 2. Ends with /list/ (incomplete)
    const isIncomplete = (parts.length === 1 && rawVal.endsWith('/')) || rawVal.endsWith('/list/');
    
    if (isIncomplete || (parts.length > 1 && !isExplicitList && parts.length !== 2)) {
        statusEl.textContent = 'Invalid';
        statusEl.title = 'Incomplete list path';
        statusEl.classList.add('is-visible', 'is-invalid');
        inputEl.classList.add('is-invalid');
        return;
    }

    // Letterboxd identifiers (usernames/slugs) are alphanumeric + underscores/dashes
    const isValidIdentifier = (s) => /^[a-z0-9_-]+$/.test(s);

    const isWatchlist = !isExplicitList && (
        (parts.length === 1 && isValidIdentifier(parts[0]) && !RESERVED_SLUGS.includes(parts[0])) ||
        (parts.length === 2 && parts[1] === 'watchlist' && isValidIdentifier(parts[0])) ||
        (val.includes('/watchlist') && isValidIdentifier(parts[0]))
    );

    // Check for duplicate canonical target across fields
    const myKey = canonicalKey(rawVal);
    if (myKey) {
        const allInputs = Array.from(document.querySelectorAll('.field__input'));
        const myIndex = allInputs.indexOf(inputEl);
        const duplicateOf = allInputs.find((other, otherIndex) => {
            if (other === inputEl) return false;
            const otherVal = other.value.trim();
            if (!otherVal) return false;
            return canonicalKey(otherVal) === myKey && otherIndex < myIndex;
        });

        if (duplicateOf) {
            statusEl.textContent = 'Duplicate';
            statusEl.classList.remove('is-loading');
            statusEl.classList.add('is-visible', 'is-invalid');
            inputEl.classList.add('is-invalid');

            statusEl.title = 'This list is already included in another field.';
            if (metaEl) {
                metaEl.textContent = 'Duplicate entry. Already included.';
                metaEl.classList.add('is-visible');
                inputEl.classList.add('has-meta');
            }
            return;
        }
    }

    statusEl.classList.remove('is-invalid');
    statusEl.removeAttribute('title');
    inputEl.classList.remove('is-invalid');

    const isExplicitWatchlistSuffix = !isExplicitList && (
        (parts.length === 2 && parts[1] === 'watchlist') || val.includes('/watchlist')
    );

    if (isWatchlist) {
        statusEl.textContent = 'Watchlist';
        statusEl.title = 'This is a Letterboxd watchlist';
        statusEl.classList.add('is-visible');
        if (metaEl) {
            const user = parts[0];
            const hint = isExplicitWatchlistSuffix ? ' · username alone is sufficient' : '';
            metaEl.textContent = `https://letterboxd.com/${user}/watchlist/${hint}`;
            metaEl.classList.add('is-visible');
            inputEl.classList.add('has-meta');
        }
    } else if (
        (isExplicitList && parts.length >= 3 && isValidIdentifier(parts[0]) && isValidIdentifier(parts[2])) ||
        (parts.length === 2 && parts.every(isValidIdentifier) && !RESERVED_SLUGS.includes(parts[1]) && parts[1] !== 'watchlist')
    ) {
        statusEl.textContent = 'List';
        statusEl.title = 'This is a Letterboxd list';
        statusEl.classList.add('is-visible');
        if (metaEl) {
            const user = parts[0];
            const list = isExplicitList ? parts[2] : parts[1];
            metaEl.textContent = `https://letterboxd.com/${user}/list/${list}/`;
            metaEl.classList.add('is-visible');
            inputEl.classList.add('has-meta');
        }
    } else {
        statusEl.textContent = 'Invalid';
        const typeHint = parts.length <= 1 ? 'username' : 'list';
        statusEl.title = `Unrecognized Letterboxd ${typeHint}`;
        statusEl.classList.add('is-visible', 'is-invalid');
        inputEl.classList.add('is-invalid');
        if (metaEl) metaEl.classList.remove('is-visible');
        inputEl.classList.remove('has-meta');
    }
};
