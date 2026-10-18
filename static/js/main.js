import { $, elements } from './modules/dom.js';
import { renderHistory, renderResult, setView, showToast, hideToast } from './modules/ui.js';

import { saveHistory, saveRecentLists, clearHistory, clearRecentLists } from './modules/storage.js';
import { addField, renumberFields, getUrlCount, setUrlCount, detectFieldType } from './modules/fields.js';
import { checkUrlParams } from './modules/utils.js';
import { initTheme, toggleTheme } from './modules/theme.js';
import { startMetadataFetch, parseApiResponse, selectRandomMovie, fetchMovieDetails } from './modules/api.js';
import { CONFIG } from './constants.js';
import { initKeyboardShortcuts } from './modules/keyboard.js';

let bgIntervals = { slot: null, prg: null };
let currentUrlsForRetry = [];

initTheme();


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



// --- URL Sync ---
let urlSyncTimer = null;

const syncUrlToAddressBar = () => {
    clearTimeout(urlSyncTimer);
    urlSyncTimer = setTimeout(() => {
        const inputs = document.querySelectorAll('.field__input');
        const urls = Array.from(inputs)
            .map(i => i.value.trim())
            .filter(v => v !== '');
        
        const url = new URL(window.location.href);
        if (urls.length > 0) {
            url.searchParams.set('url', urls.join(','));
        } else {
            url.searchParams.delete('url');
        }
        window.history.replaceState({}, '', url.toString());
    }, 300);
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

    syncUrlToAddressBar();
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
    const metaFetchPromise = startMetadataFetch(urls);

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
        
        const metaData = await parseApiResponse(metaFetchPromise, 'Metadata failed');
        Log.success('Metadata received', metaData);
        
        // 2. Selection (Honest Progress)
        Log.step('2. SELECT RANDOM MOVIE');
        elements.slot.textContent = CONFIG.LOADING_MESSAGES[2];
        Log.info('Picking from pool...', { lists: metaData.lists, total: metaData.total });

        const selectData = await selectRandomMovie(metaData.lists, metaData.total);
        Log.success('Selection complete', selectData);
        
        // 3. Details (Honest Progress)
        Log.step('3. FETCH MOVIE DETAILS');
        elements.slot.textContent = CONFIG.LOADING_MESSAGES[3];
        Log.info(`Requesting details for ${selectData.meta.slug}...`);

        const detailData = await fetchMovieDetails(selectData.meta.slug);
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
