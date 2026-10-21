import { $ } from './dom.js';
import { createUrlField } from '../components/UrlField.js';
import { CONFIG } from '../constants.js';
import { formatListUrl } from './utils.js';

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
                    }
                }, typeSpeed);
            }, 300);
        }
    }, eraseSpeed);
};

export const detectFieldType = (inputEl) => {
    if (isAnimating) return;

    const rawVal = inputEl.value.trim().toLowerCase();
    const wrapper = inputEl.closest('.field__input-wrapper');
    const statusEl = wrapper ? wrapper.querySelector('.field__status') : null;
    const metaEl = wrapper ? wrapper.querySelector('.field__meta') : null;
    
    if (!statusEl) return;
    
    if (!rawVal) {
        statusEl.classList.remove('is-visible', 'is-invalid');
        if (metaEl) {
            metaEl.classList.remove('is-visible');
            metaEl.textContent = '';
        }
        inputEl.classList.remove('has-meta');
        return;
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
        statusEl.classList.add('is-visible', 'is-invalid');
        return;
    }

    // Strict validation: Incomplete paths (user/) are invalid, but full paths or watchlist paths with trailing slashes are OK
    const val = rawVal.replace(/^https?:\/\/(www\.)?letterboxd\.com\//, "");
    const parts = val.split('/').filter(p => p);
    const isExplicitList = val.includes('/list/');

    // Invalid if:
    // 1. Single word + slash (e.g. nmcassa/)
    // 2. Ends with /list/ (incomplete)
    const isIncomplete = (parts.length === 1 && rawVal.endsWith('/')) || rawVal.endsWith('/list/');
    
    if (isIncomplete || (parts.length > 1 && !isExplicitList && parts.length !== 2)) {
        statusEl.textContent = 'Invalid';
        statusEl.classList.add('is-visible', 'is-invalid');
        return;
    }

    statusEl.classList.remove('is-invalid');

    // Letterboxd identifiers (usernames/slugs) are alphanumeric + underscores/dashes
    const isValidIdentifier = (s) => /^[a-z0-9_-]+$/.test(s);
    const RESERVED_SLUGS = ['films', 'following', 'followers', 'reviews', 'lists', 'activity', 'members'];

    const isWatchlist = (parts.length === 1 && isValidIdentifier(parts[0]) && !RESERVED_SLUGS.includes(parts[0])) ||
                        (parts.length === 2 && parts[1] === 'watchlist' && isValidIdentifier(parts[0])) ||
                        (val.includes('/watchlist') && isValidIdentifier(parts[0]));

    if (isWatchlist) {
        statusEl.textContent = 'Watchlist';
        statusEl.classList.add('is-visible');
        if (metaEl) {
            const user = parts[0];
            metaEl.textContent = `https://letterboxd.com/${user}/watchlist/`;
            metaEl.classList.add('is-visible');
            inputEl.classList.add('has-meta');
        }
    } else if (
        (val.includes('/list/') && parts.length >= 3 && isValidIdentifier(parts[0]) && isValidIdentifier(parts[2])) ||
        (parts.length === 2 && parts.every(isValidIdentifier) && !RESERVED_SLUGS.includes(parts[1]))
    ) {
        statusEl.textContent = 'List';
        statusEl.classList.add('is-visible');
        if (metaEl) {
            const user = parts[0];
            const list = parts[1] === 'list' ? parts[2] : parts[1];
            metaEl.textContent = `https://letterboxd.com/${user}/list/${list}/`;
            metaEl.classList.add('is-visible');
            inputEl.classList.add('has-meta');
        }
    } else {
        statusEl.textContent = 'Invalid';
        statusEl.classList.add('is-visible', 'is-invalid');
        if (metaEl) metaEl.classList.remove('is-visible');
        inputEl.classList.remove('has-meta');
    }
};
