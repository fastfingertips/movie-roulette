import { elements, refreshIcons } from './modules/dom.js';
import { renderHistory, renderResult, setView, showToast, hideToast, updateBackdrop, updateShareButtonText } from './modules/ui.js';
import { initStatsModal } from './modules/statsModal.js';
import { initGenerator } from './modules/generator.js';

import { saveHistory, saveRecentLists, clearHistory, clearRecentLists, getSamplingMode, saveSamplingMode, getRandomMode, saveRandomMode, getDebugMode, saveDebugMode, getHistoryDisabled, saveHistoryDisabled } from './modules/storage.js';
import { addField, cleanEmptyFields, toggleFieldUrl, detectFieldType, getActiveUrls, initFieldStats, checkAndResolveWatchlistSuffix } from './modules/fields.js';
import { applyRatios, refreshAllCounts, primeCounts } from './modules/listStats.js';
import { parseUrlParams, stripOrigin, copyToClipboard, buildSpinResult } from './modules/utils.js';
import { initTheme } from './modules/theme.js';
import { applyServerError, classifyError } from './modules/fieldErrors.js';
import { startMetadataFetch, parseApiResponse, selectRandomMovie, fetchMovieDetails } from './modules/api.js';
import { CONFIG } from './constants.js';
import { initKeyboardShortcuts } from './modules/keyboard.js';

let bgIntervals = { slot: null, prg: null };
let currentUrlsForRetry = [];

initTheme();



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
        if (elements.randomToggle && elements.randomToggle.checked) {
            url.searchParams.set('shuffle', '1');
            url.searchParams.delete('random');
        } else {
            url.searchParams.delete('shuffle');
            url.searchParams.delete('random');
        }
        window.history.replaceState({}, '', url.toString());
    }, 300);
};

// --- Global UI Logic ---

const updateUI = () => {
    renderHistory(handleUseList);
    const inputs = document.querySelectorAll('.field__input');
    inputs.forEach(detectFieldType);

    const activeUrls = getActiveUrls();
    // Disable spin button if no URLs are entered or if any field is invalid/duplicate
    const hasValue = activeUrls.length > 0;
    const hasInvalid = Array.from(document.querySelectorAll('.field__status.is-invalid')).length > 0;
    const submitBtn = elements.formArea.querySelector('button[type="submit"]');
    if (submitBtn) {
        submitBtn.disabled = !hasValue || hasInvalid;
    }

    updateShareButtonText(activeUrls.length);
    applyRatios();
    syncUrlToAddressBar();
};

const handleUseList = (url) => {
    toggleFieldUrl(url, updateUI);
    updateUI();
    refreshAllCounts();
};

// --- Debug Logging ---
let isDebugEnabled = getDebugMode();

const Log = {
    isEnabled: () => isDebugEnabled,
    setDebug: (enabled) => {
        isDebugEnabled = Boolean(enabled);
        saveDebugMode(isDebugEnabled);
        if (typeof syncDebugCheckbox === 'function') {
            syncDebugCheckbox();
        }
        if (isDebugEnabled) {
            console.log(
                '%c[MovieRoulette] Debug logging active. Run MovieRoulette.disableDebug() to turn off.',
                'color: #007aff; font-weight: bold;'
            );
        }
    },
    info: (msg, data = '') => isDebugEnabled && console.log(`%c[INFO] ${msg}`, 'color: #007aff; font-weight: bold;', data),
    success: (msg, data = '') => isDebugEnabled && console.log(`%c[OK] ${msg}`, 'color: #34c759; font-weight: bold;', data),
    warn: (msg, data = '') => isDebugEnabled && console.warn(`%c[WARN] ${msg}`, 'color: #ff9500; font-weight: bold;', data),
    error: (msg, data = '') => console.error(`%c[FAIL] ${msg}`, 'color: #ff3b30; font-weight: bold;', data),
    step: (name) => isDebugEnabled && console.log(`%c>> ${name}`, 'background: #007aff; color: white; padding: 2px 5px; border-radius: 3px; font-size: 10px; font-weight: bold;')
};

if (typeof window !== 'undefined') {
    window.MovieRoulette = {
        enableDebug: () => Log.setDebug(true),
        disableDebug: () => Log.setDebug(false),
        isDebug: () => Log.isEnabled(),
        Log,
    };
}


// --- API Execution ---

let activeAbortController = null;

export const performRandomize = async (urls, options = {}) => {
    // Abort any existing in-flight randomize requests to prevent race conditions
    if (activeAbortController) {
        activeAbortController.abort();
    }
    activeAbortController = new AbortController();
    const { signal } = activeAbortController;

    // 0. Start UI Cleanup AND Metadata Fetch in parallel
    const cleanupTask = cleanEmptyFields(updateUI, Log.info);
    
    const samplingMode = elements.samplingToggle && elements.samplingToggle.checked ? 'equal' : 'proportional';
    const randomMode = elements.randomToggle && elements.randomToggle.checked ? 'letterboxd' : 'custom';

    // Start Step 1 fetch immediately (optimistic start)
    const metaFetchPromise = startMetadataFetch(urls, signal, samplingMode, randomMode);

    Log.info('Booting Randomizer...', { urls, samplingMode, randomMode });
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
        elements.slot.textContent = options.redirect
            ? 'Selecting a random film from your list...'
            : CONFIG.LOADING_MESSAGES[1];
        const metaStart = Date.now();
        const metaData = await parseApiResponse(metaFetchPromise, 'Metadata failed');
        const metaDuration = (Date.now() - metaStart) / 1000;
        const listCount = metaData.lists?.length || 0;
        const totalFilms = (metaData.total || 0).toLocaleString();
        Log.success(`Metadata received in ${metaDuration.toFixed(2)}s (${listCount} ${listCount === 1 ? 'list' : 'lists'}, ${totalFilms} movies)`, metaData);
        primeCounts(urls, metaData.lists);
        
        // 2. Selection (Honest Progress)
        Log.step('2. SELECT RANDOM MOVIE');
        elements.slot.textContent = CONFIG.LOADING_MESSAGES[2];
        Log.info('Picking from pool...', { lists: metaData.lists, total: metaData.total, mode: samplingMode, randomMode });

        let selectData;
        let selectDuration = 0;
        if (metaData.selected) {
            // Fast Shuffle: Winner pre-selected in metadata phase (0 additional HTTP requests!)
            selectData = metaData.selected;
            const filmName = selectData.meta?.name || selectData.meta?.slug;
            Log.success(`Selection pre-computed via shuffle in metadata step ("${filmName}")`, selectData);
        } else {
            const selectStart = Date.now();
            selectData = await selectRandomMovie(metaData.lists, metaData.total, signal, samplingMode, randomMode);
            selectDuration = (Date.now() - selectStart) / 1000;
            const filmName = selectData?.meta?.name || selectData?.meta?.slug;
            const strategy = selectData?.meta?.strategy || randomMode;
            Log.success(`Selection complete in ${selectDuration.toFixed(2)}s ("${filmName}", strategy: ${strategy})`, selectData);
        }

        if (options.redirect && selectData?.meta) {
            const filmUrl = selectData.meta.url || `https://letterboxd.com/film/${selectData.meta.slug}/`;
            const filmTitle = selectData.meta.name ? `"${selectData.meta.name}"` : 'film';
            elements.slot.textContent = `Redirecting to ${filmTitle} on Letterboxd...`;
            elements.bar.style.width = '100%';
            clearInterval(bgIntervals.prg);
            saveRecentLists(urls);
            Log.info('Direct redirect triggered:', filmUrl);
            window.location.replace(filmUrl);
            return;
        }
        
        // 3. Details (Honest Progress)
        Log.step('3. FETCH MOVIE DETAILS');
        elements.slot.textContent = CONFIG.LOADING_MESSAGES[3];
        Log.info(`Requesting details for ${selectData.meta.slug}...`);

        const detailStart = Date.now();
        const detailData = await fetchMovieDetails(selectData.meta.slug, signal);
        const detailDuration = (Date.now() - detailStart) / 1000;
        const movieYear = detailData.movie.year ? ` (${detailData.movie.year})` : '';
        Log.success(`Details received in ${detailDuration.toFixed(2)}s for "${detailData.movie.name}"${movieYear}`, detailData);
        updateBackdrop(detailData.movie.backdrop);

        // 4. Finalizing
        Log.step('4. FINALIZING UI');
        elements.slot.textContent = CONFIG.LOADING_MESSAGES[4];
        clearInterval(bgIntervals.prg);
        elements.bar.style.width = '100%';
        await new Promise(r => setTimeout(r, 400));

        // Assemble final data for rendering
        const totalDuration = (Date.now() - startTime) / 1000;
        const finalData = buildSpinResult({
            metaData,
            selectData,
            detailData,
            samplingMode,
            randomMode,
            urls,
            timings: {
                metadata: metaDuration,
                selection: selectDuration,
                details: detailDuration,
                total: totalDuration,
            },
        });

        Log.info(`Rendering result card (total flow: ${totalDuration.toFixed(2)}s)...`, finalData);
        renderResult(finalData);
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
        refreshAllCounts();
        Log.error('Randomization Flow Interrupted', err);

        // Highlight the offending field if a list was not found, is private, or is empty
        const info = classifyError(err);
        if (info) {
            const inputs = Array.from(document.querySelectorAll('.field__input'));
            inputs.forEach(inp => {
                const parts = stripOrigin(inp.value).split('/').filter(Boolean);
                const user = parts[0];
                const slug = parts[1] === 'list' ? parts[2] : (parts[1] || 'watchlist');

                // Use structured backend fields when available (avoids false matches
                // from substring matching e.g. "watchlist" appearing in the error message)
                let isMatch;
                if (err.errUser) {
                    isMatch = (user === err.errUser) && (!err.errSlug || slug === err.errSlug);
                } else {
                    isMatch = (user && err.message && err.message.includes(`'${user}'`)) || inputs.length === 1;
                }

                if (isMatch) applyServerError(inp, info.badge, err.message || info.defaultMessage);
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

const debugCheckbox = elements.debugToggle;
const debugWrapper = elements.consoleToggleWrapper;

function syncDebugCheckbox() {
    if (!debugCheckbox) return;
    const active = Log.isEnabled();
    debugCheckbox.checked = active;
    if (debugWrapper) {
        debugWrapper.classList.toggle('is-active', active);
        debugWrapper.title = active
            ? 'Console Logs: Enabled (click to disable)'
            : 'Console Logs: Disabled (click to enable)';
    }
}

if (debugCheckbox) {
    syncDebugCheckbox();
    debugCheckbox.addEventListener('change', () => {
        const nextState = debugCheckbox.checked;
        Log.setDebug(nextState);
        syncDebugCheckbox();
        if (nextState) {
            console.log(
                '%c[DEBUG] Console logs enabled. Randomizer steps will now appear here.',
                'color: #10b981; font-weight: bold;'
            );
        } else {
            console.clear();
        }
    });

    if (debugWrapper) {
        debugWrapper.addEventListener('click', (e) => {
            if (e.target.closest('.switch')) return;
            debugCheckbox.checked = !debugCheckbox.checked;
            debugCheckbox.dispatchEvent(new Event('change'));
        });
    }
}

if (elements.infoBtn) {
    elements.infoBtn.addEventListener('click', () => setView('info'));
}
if (elements.infoModal) {
    elements.infoModal.addEventListener('click', (e) => {
        if (e.target === elements.infoModal || e.target.closest('#close-modal-btn')) {
            setView('form');
        }
    });
}

if (elements.clearHistoryBtn) {
    elements.clearHistoryBtn.addEventListener('click', () => { clearHistory(); updateUI(); });
}
if (elements.clearListsBtn) {
    elements.clearListsBtn.addEventListener('click', () => { clearRecentLists(); updateUI(); });
}

if (elements.historyToggle) {
    const syncHistoryToggleUI = (disabled) => {
        elements.historyToggle.checked = disabled;
        if (elements.historyToggleWrapper) {
            elements.historyToggleWrapper.classList.toggle('is-active', disabled);
            elements.historyToggleWrapper.title = disabled
                ? 'Disable History: Active (click to enable saving history)'
                : 'Disable History: Off (click to disable saving history)';
        }
    };

    elements.historyToggle.addEventListener('change', () => {
        const isDisabled = elements.historyToggle.checked;
        saveHistoryDisabled(isDisabled);
        syncHistoryToggleUI(isDisabled);
        if (isDisabled) {
            clearHistory();
            clearRecentLists();
            updateUI();
        }
    });

    const isHistoryDisabled = getHistoryDisabled();
    syncHistoryToggleUI(isHistoryDisabled);

    if (elements.historyToggleWrapper) {
        elements.historyToggleWrapper.addEventListener('click', (e) => {
            if (e.target.closest('.switch')) return;
            elements.historyToggle.checked = !elements.historyToggle.checked;
            elements.historyToggle.dispatchEvent(new Event('change'));
        });
    }
}

if (elements.randomToggle) {
    const syncRandomToggleUI = (isShuffle) => {
        elements.randomToggle.checked = isShuffle;
        if (elements.randomToggleWrapper) {
            elements.randomToggleWrapper.classList.toggle('is-active', isShuffle);
            elements.randomToggleWrapper.title = isShuffle
                ? 'Use /shuffle (Active) — Fast shuffle using Letterboxd\'s /by/shuffle. Click to return to deep catalog sampling.'
                : 'Use /shuffle (Off) — Deep catalog sampling is active by default. Toggle to use Letterboxd\'s /shuffle (Page 1 only).';
        }
    };

    elements.randomToggle.addEventListener('change', () => {
        const isShuffle = elements.randomToggle.checked;
        const mode = isShuffle ? 'letterboxd' : 'custom';
        saveRandomMode(mode);
        syncRandomToggleUI(isShuffle);
        syncUrlToAddressBar();
    });

    const savedRandomMode = getRandomMode();
    syncRandomToggleUI(savedRandomMode === 'letterboxd');

    if (elements.randomToggleWrapper) {
        elements.randomToggleWrapper.addEventListener('click', (e) => {
            if (e.target.closest('.switch')) return;
            elements.randomToggle.checked = !elements.randomToggle.checked;
            elements.randomToggle.dispatchEvent(new Event('change'));
        });
    }
}

if (elements.samplingToggle) {
    elements.samplingToggle.addEventListener('change', () => {
        const isChecked = elements.samplingToggle.checked;
        const mode = isChecked ? 'equal' : 'proportional';
        saveSamplingMode(mode);
        applyRatios();
        if (elements.samplingToggleWrapper) {
            elements.samplingToggleWrapper.classList.toggle('is-active', isChecked);
        }
    });

    const savedMode = getSamplingMode();
    if (savedMode === 'equal') {
        elements.samplingToggle.checked = true;
        if (elements.samplingToggleWrapper) {
            elements.samplingToggleWrapper.classList.add('is-active');
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
        const parts = stripOrigin(inp.value).split('/').filter(Boolean);
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

if (elements.randomizeForm) {
    elements.randomizeForm.addEventListener('submit', (e) => {
        e.preventDefault();
        handleFormSubmit();
    });
}

const handleShareMix = async () => {
    const urls = getActiveUrls();
    
    if (urls.length === 0) return;

    const baseUrl = window.location.origin + window.location.pathname;
    const isShuffle = elements.randomToggle && elements.randomToggle.checked;
    const shuffleParam = isShuffle ? '&shuffle=1' : '';
    const shareUrl = `${baseUrl}?url=${encodeURIComponent(urls.join(','))}${shuffleParam}`;

    const success = await copyToClipboard(shareUrl);
    if (success) {
        const isMix = urls.length > 1;
        showToast(`${isMix ? 'Mix' : 'Link'} copied to clipboard!`, 'info');
        
        const shareBtn = elements.shareBlendBtn;
        const btnTextNode = shareBtn?.querySelector('.btn-text');
        if (btnTextNode) {
            const originalText = btnTextNode.textContent;
            btnTextNode.textContent = 'Copied!';
            setTimeout(() => {
                btnTextNode.textContent = originalText;
            }, 2000);
        }
    }
};

if (elements.shareBlendBtn) {
    elements.shareBlendBtn.addEventListener('click', () => handleShareMix());
}
if (elements.tryAgainBtn) {
    elements.tryAgainBtn.addEventListener('click', () => performRandomize(currentUrlsForRetry));
}
if (elements.backBtn) {
    elements.backBtn.addEventListener('click', () => {
        setView('form');
        updateBackdrop(null); // Dim the backdrop when returning to form
    });
}
if (elements.addUrlBtn) {
    elements.addUrlBtn.addEventListener('click', () => handleAddField());
}

// --- Initialization ---
initKeyboardShortcuts({
    onBack: () => {
        setView('form');
        updateBackdrop(null);
    },
    onRetry: () => performRandomize(currentUrlsForRetry),
    onOpen: () => {
        const link = elements.resLink;
        if (link && link.href) window.open(link.href, '_blank');
    },
    onViewInList: () => {
        const listLink = elements.resListLink;
        if (listLink && listLink.href) window.open(listLink.href, '_blank');
    },
    onShare: () => handleShareMix(),
    onAddField: () => handleAddField(),
    onSubmit: () => handleFormSubmit()
});

initFieldStats(updateUI);
updateUI();
/** Fill the form from URL query params, then optionally auto-run. */
const bootstrapFromUrl = () => {
    const { urls, shouldRun, shouldRedirect, randomMode, isDebug, hasDuplicateWatchlist, error } = parseUrlParams(window.location.search, CONFIG.MAX_URLS);
    if (isDebug) {
        Log.setDebug(true);
    }
    if (randomMode) {
        const isShuffle = randomMode === 'letterboxd';
        if (elements.randomToggle) {
            elements.randomToggle.checked = isShuffle;
            elements.randomToggle.dispatchEvent(new Event('change'));
        }
    }
    if (error) {
        showToast(error, 'error');
    }
    if (urls.length === 0) return;

    const firstInput = elements.randomizeForm?.querySelector('input');
    urls.forEach((url, index) => {
        if (index === 0 && firstInput) firstInput.value = url;
        else addField(updateUI, url);
    });

    // Clean up URL to prevent accidental re-runs on refresh
    window.history.replaceState({}, document.title, window.location.pathname);

    updateUI();
    if (hasDuplicateWatchlist) showToast("Duplicate list was excluded.");
    if (shouldRun && !error) {
        performRandomize(urls, { redirect: shouldRedirect });
    } else {
        refreshAllCounts();
    }
};

initGenerator();
bootstrapFromUrl();
initStatsModal(setView);
refreshIcons();
