import { $, elements } from './modules/dom.js';
import { renderHistory, renderResult, renderStatsModal, initStatsTabs, setView, showToast, hideToast } from './modules/ui.js';

import { saveHistory, saveRecentLists, clearHistory, clearRecentLists, getSamplingMode, saveSamplingMode } from './modules/storage.js';
import { addField, renumberFields, getUrlCount, setUrlCount, detectFieldType, getActiveUrls, initFieldStats, attachWatchlistWatcher, checkAndResolveWatchlistSuffix } from './modules/fields.js';
import { applyRatios, refreshAllCounts, primeCounts } from './modules/listStats.js';
import { checkUrlParams, stripOrigin } from './modules/utils.js';
import { initTheme } from './modules/theme.js';
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
        const urls = getActiveUrls();
        
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

    // Disable spin button if no URLs are entered or if any field is invalid/duplicate
    const hasValue = getActiveUrls().length > 0;
    const hasInvalid = Array.from(document.querySelectorAll('.field__status.is-invalid')).length > 0;
    const submitBtn = elements.formArea.querySelector('button[type="submit"]');
    if (submitBtn) {
        submitBtn.disabled = !hasValue || hasInvalid;
    }

    applyRatios();
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
    refreshAllCounts();
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

let activeAbortController = null;

export const performRandomize = async (urls) => {
    // Abort any existing in-flight randomize requests to prevent race conditions
    if (activeAbortController) {
        activeAbortController.abort();
    }
    activeAbortController = new AbortController();
    const { signal } = activeAbortController;

    // 0. Start UI Cleanup AND Metadata Fetch in parallel
    const cleanupTask = cleanEmptyFields();
    
    // Start Step 1 fetch immediately (optimistic start)
    const metaFetchPromise = startMetadataFetch(urls, signal);

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
        const metaStart = Date.now();
        const metaData = await parseApiResponse(metaFetchPromise, 'Metadata failed');
        const metaDuration = (Date.now() - metaStart) / 1000;
        Log.success('Metadata received', metaData);
        primeCounts(urls, metaData.lists);
        
        // 2. Selection (Honest Progress)
        Log.step('2. SELECT RANDOM MOVIE');
        elements.slot.textContent = CONFIG.LOADING_MESSAGES[2];
        const samplingMode = elements.samplingToggle && elements.samplingToggle.checked ? 'equal' : 'proportional';
        Log.info('Picking from pool...', { lists: metaData.lists, total: metaData.total, mode: samplingMode });

        const selectStart = Date.now();
        const selectData = await selectRandomMovie(metaData.lists, metaData.total, signal, samplingMode);
        const selectDuration = (Date.now() - selectStart) / 1000;
        Log.success('Selection complete', selectData);
        
        // 3. Details (Honest Progress)
        Log.step('3. FETCH MOVIE DETAILS');
        elements.slot.textContent = CONFIG.LOADING_MESSAGES[3];
        Log.info(`Requesting details for ${selectData.meta.slug}...`);

        const detailStart = Date.now();
        const detailData = await fetchMovieDetails(selectData.meta.slug, signal);
        const detailDuration = (Date.now() - detailStart) / 1000;
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
        const isModeEqual = (selectData.mode || samplingMode) === 'equal';
        const numLists = (metaData.lists || []).length || 1;
        const selectedListCount = selectData.list?.count || 1;
        const probability = isModeEqual
            ? ((1 / numLists) * (1 / selectedListCount)) * 100
            : (1 / metaData.total) * 100;
        const oddsText = isModeEqual
            ? `1 in ${(numLists * selectedListCount).toLocaleString()} (${numLists} lists × ${selectedListCount.toLocaleString()} films)`
            : `1 in ${metaData.total.toLocaleString()}`;

        const finalData = {
            movie: detailData.movie,
            list: selectData.list,
            page: selectData.meta?.page || 1,
            stats: {
                total_pool: metaData.total,
                probability: probability < 0.001 ? probability.toFixed(4) : probability.toFixed(2),
                odds: oddsText,
                sampling_mode: isModeEqual ? 'equal' : 'proportional',
                timing: {
                    metadata: metaDuration.toFixed(2),
                    selection: selectDuration.toFixed(2),
                    details: detailDuration.toFixed(2),
                    total: totalDuration.toFixed(2)
                },
                lists: (metaData.lists || []).map(l => {
                    const isWinner = l.user === selectData.list.user
                        && l.slug === selectData.list.slug
                        && (Boolean(l.is_watchlist) === Boolean(selectData.list.is_watchlist));
                    return {
                        title: l.title || `${l.user}'s List`,
                        user: l.user,
                        slug: l.slug,
                        count: l.count,
                        is_watchlist: Boolean(l.is_watchlist),
                        type: l.is_watchlist ? 'Watchlist' : 'List',
                        percentage: isModeEqual
                            ? Number((100 / numLists).toFixed(1))
                            : Number(((l.count / metaData.total) * 100).toFixed(1)),
                        is_winner: isWinner
                    };
                }),
                inputs: urls,
                timestamp: new Date().toISOString()
            }
        };

        window.lastFullResult = finalData;

        Log.info('Rendering result...', finalData);
        renderResult(finalData);
        updateShareButtonText();
        setView('result');
        saveHistory(finalData);
        saveRecentLists(urls);
        updateUI();

    } catch (err) {
        if (signal.aborted || err.name === 'AbortError') {
            Log.info('Previous spin cancelled by newer request');
            return;
        }
        clearInterval(bgIntervals.prg);
        setView('form');
        showToast(err.message || 'Processing failed');
        Log.error('Randomization Flow Interrupted', err);

        // Highlight the offending field if a list was not found, is private, or is empty
        if (err.status === 404 || err.status === 403 || err.status === 422 || err.message?.toLowerCase().includes('empty')) {
            const inputs = Array.from(document.querySelectorAll('.field__input'));
            inputs.forEach(inp => {
                const parts = stripOrigin(inp.value).split('/').filter(Boolean);
                const user = parts[0];
                const slug = parts[1] === 'list' ? parts[2] : (parts[1] || 'watchlist');
                const isMatch = (user && err.message && err.message.includes(user)) ||
                                (slug && err.message && err.message.includes(slug)) ||
                                inputs.length === 1;
                if (isMatch) {
                    const isWatchlist = parts.length === 1 || (parts.length === 2 && parts[1] === 'watchlist') || inp.value.includes('/watchlist');
                    const typeLower = isWatchlist ? 'watchlist' : 'list';
                    const isEmpty = err.status === 422 || err.message?.toLowerCase().includes('empty');

                    const badgeText = isEmpty ? 'Empty' : (err.status === 403 ? 'Private' : 'Not Found');
                    const defaultMsg = err.message || (isEmpty
                        ? `The ${typeLower} for '${user}' is empty on Letterboxd`
                        : (err.status === 403 ? `This ${typeLower} is private on Letterboxd` : `This ${typeLower} could not be found on Letterboxd`));

                    inp.dataset.serverError = badgeText;
                    inp.dataset.serverErrorVal = inp.value.trim().toLowerCase();
                    inp.dataset.serverErrorMsg = defaultMsg;

                    inp.classList.add('is-invalid');
                    const statusEl = inp.closest('.field__input-wrapper')?.querySelector('.field__status');
                    if (statusEl) {
                        statusEl.textContent = badgeText;
                        statusEl.title = defaultMsg;
                        statusEl.classList.add('is-visible', 'is-invalid');
                    }
                    const metaEl = inp.closest('.field__input-wrapper')?.querySelector('.field__meta');
                    if (metaEl) {
                        metaEl.textContent = defaultMsg;
                        metaEl.classList.add('is-visible');
                        inp.classList.add('has-meta');
                    }
                }
            });
        }
    } finally {
        if (!signal.aborted) {
            const btnTextNode = submitBtn.querySelector('.btn-text');
            if (btnTextNode) btnTextNode.textContent = 'Spin the wheel';
            resultBtns.forEach(btn => { btn.style.pointerEvents = 'auto'; btn.style.opacity = '1'; });
            updateUI();
            Log.info('Flow End / Cleaned up.');
        }
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
attachWatchlistWatcher($('url-1'), updateUI);

$('info-btn').addEventListener('click', () => setView('info'));
$('close-modal-btn').addEventListener('click', () => setView('form'));
elements.infoModal.addEventListener('click', (e) => { 
    if(e.target === elements.infoModal) setView('form'); 
});

$('clear-history').addEventListener('click', () => { clearHistory(); updateUI(); });
$('clear-lists').addEventListener('click', () => { clearRecentLists(); updateUI(); });

if (elements.samplingToggle) {
    elements.samplingToggle.addEventListener('change', () => {
        const isChecked = elements.samplingToggle.checked;
        const mode = isChecked ? 'equal' : 'proportional';
        saveSamplingMode(mode);
        applyRatios();
        if (elements.samplingToggleWrapper) {
            elements.samplingToggleWrapper.classList.toggle('is-active', isChecked);
        }
        if (elements.samplingToggleDesc) {
            elements.samplingToggleDesc.textContent = isChecked
                ? 'Pick a list with equal 1/N odds, ignoring film counts'
                : 'Films have equal odds across pool (weighted by list size)';
        }
    });

    const savedMode = getSamplingMode();
    if (savedMode === 'equal') {
        elements.samplingToggle.checked = true;
        if (elements.samplingToggleWrapper) {
            elements.samplingToggleWrapper.classList.add('is-active');
        }
        if (elements.samplingToggleDesc) {
            elements.samplingToggleDesc.textContent = 'Pick a list with equal 1/N odds, ignoring film counts';
        }
    }

    if (elements.samplingToggleWrapper) {
        elements.samplingToggleWrapper.addEventListener('click', (e) => {
            if (e.target.closest('.switch')) return;
            elements.samplingToggle.checked = !elements.samplingToggle.checked;
            elements.samplingToggle.dispatchEvent(new Event('change'));
        });
    }
}

elements.statsBtn.addEventListener('click', () => {
    if (window.lastFullResult) {
        renderStatsModal(window.lastFullResult);
        setView('stats');
    }
});


$('close-stats-btn').addEventListener('click', () => setView('result'));
elements.statsModal.addEventListener('click', (e) => { 
    if(e.target === elements.statsModal) setView('result'); 
});

const copyToClipboard = async (text) => {
    try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(text);
            return true;
        }
    } catch {
        // Fall back to document.execCommand
    }
    try {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        const successful = document.execCommand('copy');
        document.body.removeChild(textarea);
        return successful;
    } catch {
        return false;
    }
};

elements.copyStatsBtn.addEventListener('click', async () => {
    const success = await copyToClipboard(elements.statsJson.textContent);
    if (success) {
        const originalText = elements.copyStatsBtn.innerHTML;
        elements.copyStatsBtn.innerHTML = '<i data-lucide="check"></i> Copied!';
        if (window.lucide) window.lucide.createIcons();
        setTimeout(() => {
            elements.copyStatsBtn.innerHTML = originalText;
            if (window.lucide) window.lucide.createIcons();
        }, 2000);
    }
});

const handleAddField = () => {
    addField(updateUI);
    const inputs = document.querySelectorAll('.field__input');
    const lastInput = inputs[inputs.length - 1];
    if (lastInput) lastInput.focus();
};

const handleFormSubmit = async () => {
    hideToast();

    // If any input currently has 'username/watchlist', resolve it first before submitting
    const pendingInputs = Array.from(document.querySelectorAll('.field__input')).filter(inp => {
        const parts = inp.value.trim().toLowerCase().replace(/^https?:\/\/(www\.)?letterboxd\.com\//, '').replace(/\/+$/, '').split('/').filter(Boolean);
        return parts.length === 2 && parts[1] === 'watchlist';
    });
    for (const inp of pendingInputs) {
        await checkAndResolveWatchlistSuffix(inp, updateUI);
    }

    const urls = getActiveUrls();
    
    if (urls.length === 0) {
        showToast("Please paste at least one list URL to continue.");
        return;
    }

    const invalidStatus = Array.from(document.querySelectorAll('.field__status.is-invalid'))[0];
    if (invalidStatus) {
        showToast(invalidStatus.title || "Please resolve duplicate or invalid lists.");
        return;
    }

    await performRandomize(urls);
};

$('randomize-form').addEventListener('submit', (e) => {
    e.preventDefault();
    handleFormSubmit();
});

const handleShareMix = async () => {
    const urls = getActiveUrls();
    
    if (urls.length === 0) return;

    const baseUrl = window.location.origin + window.location.pathname;
    const shareUrl = `${baseUrl}?url=${encodeURIComponent(urls.join(','))}`;

    const success = await copyToClipboard(shareUrl);
    if (success) {
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
    }
};

const updateShareButtonText = () => {
    const urls = getActiveUrls();
    
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
    onViewInList: () => {
        const listLink = $('result-list-link');
        if (listLink && listLink.href) window.open(listLink.href, '_blank');
    },
    onShare: () => handleShareMix(),
    onAddField: () => handleAddField(),
    onSubmit: () => handleFormSubmit()
});

initFieldStats(updateUI);
updateUI();
checkUrlParams(({ urls, shouldRun, hasDuplicateWatchlist }) => {
    updateUI();
    if (hasDuplicateWatchlist) {
        showToast("Duplicate list was excluded.");
    }
    if (urls.length > 0) refreshAllCounts();
    if (shouldRun) performRandomize(urls);
});
initStatsTabs();
if (window.lucide) window.lucide.createIcons();
