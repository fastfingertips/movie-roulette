import { $, elements, setView, showToast, hideToast } from './modules/dom.js';
import { renderHistory, renderResult } from './modules/ui.js';

import { saveHistory, saveRecentLists, clearHistory, clearRecentLists } from './modules/storage.js';
import { addField, renumberFields, getUrlCount, setUrlCount } from './modules/fields.js';
import { checkUrlParams } from './modules/utils.js';
import { CONFIG } from './constants.js';
import { initKeyboardShortcuts } from './modules/keyboard.js';

let bgIntervals = { slot: null, prg: null };
let currentUrlsForRetry = [];

// --- Theme Logic ---
const initTheme = () => {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
};

const toggleTheme = () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    
    const toggleBtn = $('theme-toggle');
    const rect = toggleBtn.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;

    const performToggle = () => {
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        if (window.lucide) window.lucide.createIcons();
    };

    if (!document.startViewTransition) {
        // Fallback for browsers that don't support View Transitions
        const overlay = document.createElement('div');
        overlay.style.position = 'fixed';
        overlay.style.inset = '0';
        overlay.style.zIndex = '9999';
        overlay.style.pointerEvents = 'none';
        overlay.style.background = newTheme === 'light' ? '#f8fafc' : '#12151f';
        overlay.style.clipPath = `circle(0% at ${x}px ${y}px)`;
        overlay.style.transition = 'clip-path 0.5s ease-in-out';
        document.body.appendChild(overlay);
        
        overlay.offsetWidth; // reflow
        overlay.style.clipPath = `circle(150% at ${x}px ${y}px)`;
        
        setTimeout(() => {
            performToggle();
            overlay.style.opacity = '0';
            overlay.style.transition = 'opacity 0.3s ease';
            setTimeout(() => overlay.remove(), 300);
        }, 500);
        return;
    }

    // Modern View Transitions API
    const transition = document.startViewTransition(performToggle);
    transition.ready.then(() => {
        const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
        document.documentElement.animate(
            {
                clipPath: [
                    `circle(0% at ${x}px ${y}px)`,
                    `circle(${radius}px at ${x}px ${y}px)`,
                ],
            },
            {
                duration: 500,
                easing: 'ease-in-out',
                pseudoElement: '::view-transition-new(root)',
            }
        );
    });
};

initTheme();

// --- Animated URL Shortening ---
let isAnimating = false;

const shortenUrl = (raw) => {
    let val = raw.trim().replace(/\/$/, '').toLowerCase();
    val = val.replace(/^https?:\/\/(www\.)?letterboxd\.com\//, '');
    const parts = val.split('/').filter(p => p);
    // user/watchlist -> user
    if (parts.length === 2 && parts[1] === 'watchlist') return parts[0];
    // user/list/slug -> user/slug
    if (parts.length >= 3 && parts[1] === 'list') return `${parts[0]}/${parts[2]}`;
    // user/slug -> user/slug
    if (parts.length === 2) return `${parts[0]}/${parts[1]}`;
    // user -> user
    if (parts.length === 1) return parts[0];
    return null;
};

const updateBackdrop = (url) => {
    if (!elements.backdrop || !elements.backdropImg) return;
    
    if (url) {
        // Start fade out current backdrop if any
        elements.backdrop.classList.remove('loaded');
        
        // Preload new image
        const img = new Image();
        img.src = url;
        img.onload = () => {
            elements.backdropImg.style.backgroundImage = `url('${url}')`;
            elements.backdrop.classList.add('loaded');
        };
    } else {
        elements.backdrop.classList.remove('loaded');
        setTimeout(() => {
            if (!elements.backdrop.classList.contains('loaded')) {
                elements.backdropImg.style.backgroundImage = 'none';
            }
        }, 1000);
    }
};

const animateShorten = (inputEl, shortForm) => {
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

const detectFieldType = (inputEl) => {
    if (isAnimating) return;

    let rawVal = inputEl.value.trim().toLowerCase();
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
        const short = shortenUrl(rawVal);
        if (short) {
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
    let val = rawVal.replace(/^https?:\/\/(www\.)?letterboxd\.com\//, "");
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

    if (val.includes('/watchlist/') || (parts.length === 1 && isValidIdentifier(parts[0]))) {
        statusEl.textContent = 'Watchlist';
        statusEl.classList.add('is-visible');
        if (metaEl) {
            const user = parts[0];
            metaEl.textContent = `https://letterboxd.com/${user}/watchlist/`;
            metaEl.classList.add('is-visible');
            inputEl.classList.add('has-meta');
        }
    } else if (val.includes('/list/') || (parts.length === 2 && parts.every(isValidIdentifier))) {
        statusEl.textContent = 'List';
        statusEl.classList.add('is-visible');
        if (metaEl) {
            const user = parts[0];
            const list = parts[1] || parts[2];
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

// --- Global UI Logic ---

const updateUI = () => {
    renderHistory(handleUseList);
    const inputs = document.querySelectorAll('.field__input');
    inputs.forEach(detectFieldType);

    // Disable spin button if no URLs are entered
    const hasValue = Array.from(inputs).some(i => i.value.trim() !== '');
    const submitBtn = elements.formArea.querySelector('button[type="submit"]');
    if (submitBtn) {
        submitBtn.disabled = !hasValue;
    }
};

const handleUseList = (url) => {
    const inputs = Array.from($('randomize-form').querySelectorAll('input'));
    const existingInput = inputs.find(i => i.value.trim() === url);

    if (existingInput) {
        if (inputs.length > 1) {
            existingInput.closest('.field').remove();
            setUrlCount(getUrlCount() - 1);
            renumberFields();
        } else {
            existingInput.value = '';
        }
    } else {
        const emptyInput = inputs.find(i => i.value === '');
        if (emptyInput) {
            emptyInput.value = url;
        } else if (getUrlCount() < CONFIG.MAX_URLS) {
            addField(updateUI, url);
        } else {
            inputs[0].value = url;
        }
    }
    updateUI();
};

// --- Debug Logging ---
const Log = {
    info: (msg, data = '') => console.log(`%c[INFO] ${msg}`, 'color: #007aff; font-weight: bold;', data),
    success: (msg, data = '') => console.log(`%c[OK] ${msg}`, 'color: #34c759; font-weight: bold;', data),
    warn: (msg, data = '') => console.warn(`%c[WARN] ${msg}`, 'color: #ff9500; font-weight: bold;', data),
    error: (msg, data = '') => console.error(`%c[FAIL] ${msg}`, 'color: #ff3b30; font-weight: bold;', data),
    step: (name) => console.log(`%c>> ${name}`, 'background: #007aff; color: white; padding: 2px 5px; border-radius: 3px; font-size: 10px; font-weight: bold;')
};


// --- API Execution ---

// --- Sequential Cleanup ---

const cleanEmptyFields = async () => {
    const fields = Array.from(document.querySelectorAll('.field'));
    const emptyFields = fields.filter(f => f.querySelector('input').value.trim() === '');
    
    // Don't remove if it's the only field
    if (emptyFields.length === 0 || fields.length === 1) return;

    Log.info(`Cleaning ${emptyFields.length} empty fields sequentially...`);

    // Remove empty fields one-by-one with staggered animation
    for (const f of emptyFields) {
        f.classList.add('is-removing');
        renumberFields();
        updateUI();

        f.style.maxHeight = f.scrollHeight + 'px';
        f.style.overflow = 'hidden';
        f.style.transition = 'all 1.2s cubic-bezier(0.4, 0, 0.2, 1)';
        f.offsetHeight;

        requestAnimationFrame(() => {
            f.style.opacity = '0';
            f.style.transform = 'translateX(60px) scale(0.9)';
            f.style.filter = 'blur(20px)';
            f.style.maxHeight = '0';
            f.style.marginTop = '0';
            f.style.marginBottom = '0';
            f.style.paddingTop = '0';
            f.style.paddingBottom = '0';
            f.style.pointerEvents = 'none';
        });

        await new Promise(r => setTimeout(r, 600));
    }

    await new Promise(r => setTimeout(r, 700));

    emptyFields.forEach(f => f.remove());
    setUrlCount(document.querySelectorAll('.field').length);
    renumberFields();
    
    await new Promise(r => setTimeout(r, 600));
};

export const performRandomize = async (urls) => {
    // 0. Start UI Cleanup AND Metadata Fetch in parallel
    const cleanupTask = cleanEmptyFields();
    
    // Start Step 1 fetch immediately (optimistic start)
    const metaFetchPromise = fetch('/api/metadata', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ urls }) 
    });

    Log.info('Booting Randomizer...', { urls });
    currentUrlsForRetry = urls;
    const submitBtn = elements.formArea.querySelector('button[type="submit"]');
    const resultBtns = elements.resultArea.querySelectorAll('.action-btn');
    
    // UI Loading state (button only for now)
    submitBtn.disabled = true;
    const btnTextNode = submitBtn.querySelector('.btn-text');
    if (btnTextNode) btnTextNode.textContent = 'Processing...';
    resultBtns.forEach(btn => { btn.style.pointerEvents = 'none'; btn.style.opacity = '0.5'; });

    // WAIT for the animation to finish before showing the full loading view
    await cleanupTask;

    elements.bar.style.width = '0%';
    setView('loading');
    
    let p = 0;
    bgIntervals.prg = setInterval(() => {
        if (p < 95) elements.bar.style.width = `${p += (100 - p) * 0.05}%`;
        else clearInterval(bgIntervals.prg);
    }, CONFIG.ANIMATION.PROGRESS_INTERVAL_MS);

    try {
        const startTime = Date.now();

        // 1. Await Metadata (Started earlier)
        Log.step('1. FETCH METADATA');
        elements.slot.textContent = CONFIG.LOADING_MESSAGES[1];
        Log.info('Awaiting metadata fetch result...');
        
        const metaRes = await metaFetchPromise;
        
        Log.info(`Response Status: ${metaRes.status}`);
        
        if (!metaRes.ok) {
            const text = await metaRes.text();
            Log.error('Metadata request failed', { status: metaRes.status, response: text });
            let errorMessage = 'Metadata failed';
            try { 
                const errData = JSON.parse(text); 
                errorMessage = errData.error || errorMessage;
            } catch { 
                errorMessage = `Server Error (${metaRes.status})`; 
            }
            throw { userFacing: true, message: errorMessage };
        }
        const metaData = await metaRes.json();
        Log.success('Metadata received', metaData);
        
        // 2. Selection (Honest Progress)
        Log.step('2. SELECT RANDOM MOVIE');
        elements.slot.textContent = CONFIG.LOADING_MESSAGES[2];
        Log.info('Picking from pool...', { lists: metaData.lists, total: metaData.total });

        const selectRes = await fetch('/api/select', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lists: metaData.lists, total: metaData.total })
        });
        
        Log.info(`Response Status: ${selectRes.status}`);

        if (!selectRes.ok) {
            const text = await selectRes.text();
            Log.error('Selection failed', { status: selectRes.status, response: text });
            let errorMessage = 'Selection failed';
            try { 
                const errData = JSON.parse(text); 
                errorMessage = errData.error || errorMessage;
            } catch { 
                errorMessage = `Server Error (${selectRes.status})`; 
            }
            throw { userFacing: true, message: errorMessage };
        }
        const selectData = await selectRes.json();
        Log.success('Selection complete', selectData);
        
        // 3. Details (Honest Progress)
        Log.step('3. FETCH MOVIE DETAILS');
        elements.slot.textContent = CONFIG.LOADING_MESSAGES[3];
        Log.info(`Requesting details for ${selectData.meta.slug}...`);

        const detailRes = await fetch('/api/details', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ slug: selectData.meta.slug })
        });
        
        Log.info(`Response Status: ${detailRes.status}`);

        if (!detailRes.ok) {
            const text = await detailRes.text();
            Log.error('Detail fetch failed', { status: detailRes.status, response: text });
            let errorMessage = 'Details failed';
            try { 
                const errData = JSON.parse(text); 
                errorMessage = errData.error || errorMessage;
            } catch { 
                errorMessage = `Server Error (${detailRes.status})`; 
            }
            throw { userFacing: true, message: errorMessage };
        }
        const detailData = await detailRes.json();
        Log.success('Details received', detailData);
        updateBackdrop(detailData.movie.backdrop);

        // 4. Finalizing
        Log.step('4. FINALIZING UI');
        elements.slot.textContent = CONFIG.LOADING_MESSAGES[4];
        clearInterval(bgIntervals.prg);
        elements.bar.style.width = '100%';
        await new Promise(r => setTimeout(r, 400));

        // Assemble final data for rendering
        const totalDuration = (Date.now() - startTime) / 1000;
        const probability = (1 / metaData.total) * 100;

        const finalData = {
            movie: detailData.movie,
            list: selectData.list,
            stats: {
                total_pool: metaData.total,
                probability: probability < 0.01 ? probability.toFixed(4) : probability.toFixed(2),
                timing: { total: `${totalDuration.toFixed(2)}s` }
            }
        };

        Log.info('Rendering result...', finalData);
        renderResult(finalData);
        updateShareButtonText();
        setView('result');
        saveHistory(finalData);
        saveRecentLists(urls);
        updateUI();

    } catch (err) {
        clearInterval(bgIntervals.prg);
        setView('form');
        showToast(err.message || 'Processing failed');
        Log.error('Randomization Flow Interrupted', err);
    } finally {
        const btnTextNode = submitBtn.querySelector('.btn-text');
        if (btnTextNode) btnTextNode.textContent = 'Spin the wheel';
        resultBtns.forEach(btn => { btn.style.pointerEvents = 'auto'; btn.style.opacity = '1'; });
        updateUI();
        Log.info('Flow End / Cleaned up.');
    }
};


// --- Listeners & Boots ---

$('remove-url-1').addEventListener('click', () => {
    const input = $('url-1');
    if (input.value !== '') {
        input.value = '';
        renumberFields();
    } else if (getUrlCount() > 1) {
        input.closest('.field').remove();
        setUrlCount(getUrlCount() - 1);
        renumberFields();
    }
    updateUI();
});

$('url-1').addEventListener('input', () => {
    renumberFields(); // Sync tooltips as user types
    updateUI();
});

$('info-btn').addEventListener('click', () => setView('info'));
$('close-modal-btn').addEventListener('click', () => setView('form'));
elements.infoModal.addEventListener('click', (e) => { 
    if(e.target === elements.infoModal) setView('form'); 
});

$('clear-history').addEventListener('click', () => { clearHistory(); updateUI(); });
$('clear-lists').addEventListener('click', () => { clearRecentLists(); updateUI(); });

elements.statsBtn.addEventListener('click', () => {
    if (window.lastResultData) {
        elements.statsJson.textContent = JSON.stringify(window.lastResultData, null, 2);
        setView('stats');
    }
});

$('theme-toggle').addEventListener('click', toggleTheme);

$('close-stats-btn').addEventListener('click', () => setView('result'));
elements.statsModal.addEventListener('click', (e) => { 
    if(e.target === elements.statsModal) setView('result'); 
});

elements.copyStatsBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(elements.statsJson.textContent).then(() => {
        const originalText = elements.copyStatsBtn.innerHTML;
        elements.copyStatsBtn.innerHTML = '<i data-lucide="check"></i> Copied!';
        if (window.lucide) window.lucide.createIcons();
        setTimeout(() => {
            elements.copyStatsBtn.innerHTML = originalText;
            if (window.lucide) window.lucide.createIcons();
        }, 2000);
    });
});

const handleAddField = () => {
    addField(updateUI);
    const inputs = document.querySelectorAll('.field__input');
    const lastInput = inputs[inputs.length - 1];
    if (lastInput) lastInput.focus();
};

const handleFormSubmit = async () => {
    hideToast();
    const urls = Array.from($('randomize-form').querySelectorAll('input'))
        .map(i => i.value.trim())
        .filter(v => v !== '');
    
    if (urls.length === 0) {
        showToast("Please paste at least one list URL to continue.");
        return;
    }
    await performRandomize(urls);
};

$('randomize-form').addEventListener('submit', (e) => {
    e.preventDefault();
    handleFormSubmit();
});

const handleShareMix = () => {
    const urls = Array.from($('randomize-form').querySelectorAll('input'))
        .map(i => i.value.trim())
        .filter(v => v !== '');
    
    if (urls.length === 0) return;

    const baseUrl = window.location.origin + window.location.pathname;
    const shareUrl = `${baseUrl}?url=${encodeURIComponent(urls.join(','))}`;

    navigator.clipboard.writeText(shareUrl).then(() => {
        const isMix = urls.length > 1;
        showToast(`${isMix ? 'Mix' : 'Link'} copied to clipboard!`, 'info');
        
        const shareBtn = $('share-blend-btn');
        const btnTextNode = shareBtn.querySelector('.btn-text');
        if (btnTextNode) {
            const originalText = btnTextNode.textContent;
            btnTextNode.textContent = 'Copied!';
            setTimeout(() => {
                btnTextNode.textContent = originalText;
            }, 2000);
        }
    });
};

const updateShareButtonText = () => {
    const urls = Array.from($('randomize-form').querySelectorAll('input'))
        .map(i => i.value.trim())
        .filter(v => v !== '');
    
    const shareBtn = $('share-blend-btn');
    const btnTextNode = shareBtn.querySelector('.btn-text');
    if (shareBtn && btnTextNode) {
        const isMix = urls.length > 1;
        btnTextNode.textContent = isMix ? 'Share this Mix' : 'Share';
        shareBtn.title = isMix ? 'Share this Mix' : 'Share';
    }
};

$('share-blend-btn').addEventListener('click', () => handleShareMix());
$('try-again-btn').addEventListener('click', () => performRandomize(currentUrlsForRetry));
$('back-btn').addEventListener('click', () => {
    setView('form');
    updateBackdrop(null); // Dim the backdrop when returning to form
});
$('add-url-btn').addEventListener('click', () => handleAddField());

// --- Initialization ---
initKeyboardShortcuts({
    onBack: () => {
        setView('form');
        updateBackdrop(null);
    },
    onRetry: () => performRandomize(currentUrlsForRetry),
    onOpen: () => {
        const link = $('result-link');
        if (link && link.href) window.open(link.href, '_blank');
    },
    onShare: () => handleShareMix(),
    onAddField: () => handleAddField(),
    onSubmit: () => handleFormSubmit()
});

updateUI();
checkUrlParams(({ urls, shouldRun }) => {
    if (shouldRun) performRandomize(urls);
});
if (window.lucide) window.lucide.createIcons();
