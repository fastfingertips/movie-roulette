import { $, elements, setView, showError, hideError } from './modules/dom.js';
import { renderHistory, renderResult } from './modules/ui.js';

import { saveHistory, saveRecentLists, clearHistory, clearRecentLists } from './modules/storage.js';
import { addField, renumberFields, getUrlCount, setUrlCount } from './modules/fields.js';
import { checkUrlParams } from './modules/utils.js';
import { CONFIG } from './constants.js';

let bgIntervals = { slot: null, prg: null };
let currentUrlsForRetry = [];

// --- Theme Logic ---
const initTheme = () => {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
};

const toggleTheme = () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    if (window.lucide) window.lucide.createIcons();
};

initTheme();

// --- Global UI Logic ---

const updateUI = () => {
    renderHistory(handleUseList);
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

export const performRandomize = async (urls) => {
    Log.info('Booting Randomizer...', { urls });
    currentUrlsForRetry = urls;
    const submitBtn = elements.formArea.querySelector('button[type="submit"]');
    const resultBtns = elements.resultArea.querySelectorAll('.action-btn');
    
    // UI Loading state
    submitBtn.disabled = true;
    submitBtn.textContent = 'Processing...';
    resultBtns.forEach(btn => { btn.style.pointerEvents = 'none'; btn.style.opacity = '0.5'; });
    elements.bar.style.width = '0%';
    setView('loading');
    
    let p = 0;
    bgIntervals.prg = setInterval(() => {
        if (p < 95) elements.bar.style.width = `${p += (100 - p) * 0.05}%`;
        else clearInterval(bgIntervals.prg);
    }, CONFIG.ANIMATION.PROGRESS_INTERVAL_MS);

    try {
        const startTime = Date.now();

        // 1. Fetch Metadata (Honest Progress)
        Log.step('1. FETCH METADATA');
        elements.slot.textContent = CONFIG.LOADING_MESSAGES[1];
        Log.info('Requesting metadata...', { urls });
        
        const metaRes = await fetch('/api/metadata', { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ urls }) 
        });
        
        Log.info(`Response Status: ${metaRes.status}`);
        
        if (!metaRes.ok) {
            const text = await metaRes.text();
            Log.error('Metadata request failed', { status: metaRes.status, response: text });
            let errorMessage = 'Metadata failed';
            try { 
                const errData = JSON.parse(text); 
                errorMessage = errData.error || errorMessage;
            } catch(e) { 
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
            } catch(e) { 
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
            } catch(e) { 
                errorMessage = `Server Error (${detailRes.status})`; 
            }
            throw { userFacing: true, message: errorMessage };
        }
        const detailData = await detailRes.json();
        Log.success('Details received', detailData);

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
        setView('result');
        saveHistory(finalData);
        saveRecentLists(urls);
        updateUI();

    } catch (err) {
        clearInterval(bgIntervals.prg);
        setView('form');
        showError(err.message || 'Processing failed');
        Log.error('Randomization Flow Interrupted', err);
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Spin the wheel';
        resultBtns.forEach(btn => { btn.style.pointerEvents = 'auto'; btn.style.opacity = '1'; });
        Log.info('Flow End / Cleaned up.');
    }
};


// --- Listeners & Boots ---

$('add-url-btn').addEventListener('click', () => addField(updateUI));

$('remove-url-1').addEventListener('click', () => {
    if (getUrlCount() > 1) {
        $('remove-url-1').closest('.field').remove();
        setUrlCount(getUrlCount() - 1);
        renumberFields();
    } else {
        $('url-1').value = '';
    }
    updateUI();
});

$('url-1').addEventListener('input', () => updateUI());

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

$('randomize-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    hideError();
    const urls = Array.from($('randomize-form').querySelectorAll('input'))
        .map(i => i.value.trim())
        .filter(v => v !== '');
    
    if (urls.length === 0) {
        showError("Please paste at least one list URL to continue.");
        return;
    }
    await performRandomize(urls);
});

$('try-again-btn').addEventListener('click', () => performRandomize(currentUrlsForRetry));
$('back-btn').addEventListener('click', () => setView('form'));

// Init
updateUI();
checkUrlParams((urls) => performRandomize(urls));
if (window.lucide) window.lucide.createIcons();
