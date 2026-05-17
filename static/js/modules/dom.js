export const $ = (id) => document.getElementById(id);

export const elements = {
    formArea: $('form-panel'),
    loadingArea: $('loading-panel'),
    resultArea: $('result-panel'),
    infoModal: $('info-modal'),
    slot: $('slot-text'),
    bar: $('bar-fill'),
    historyList: $('history-list'),
    resMovie: $('result-movie'),
    resMeta: $('result-meta'),
    resTagline: $('result-tagline'),
    resDescription: $('result-description'),
    resDetails: $('result-details'),
    resDirector: $('result-director'),
    resCast: $('result-cast'),
    resGenres: $('result-genres'),
    resStars: $('result-stars'),
    resPoster: $('result-poster'),
    resPosterLink: $('result-poster-link'),
    resLink: $('result-link'),
    resBodyBlock: $('result-body-block'),
    resInfo: $('result-info'),
    statPool: $('stat-pool'),
    statProb: $('stat-prob'),
    statsModal: $('stats-modal'),
    statsBtn: $('stats-btn'),
    statsJson: $('stats-json'),
    copyStatsBtn: $('copy-stats-btn'),
    error: $('error-msg'),
    errorText: $('error-text'),
    backdrop: $('backdrop'),
    backdropImg: document.querySelector('.backdropimage')
};

export const setView = (view) => {
    elements.infoModal.classList.toggle('is-hidden', view !== 'info');
    elements.statsModal.classList.toggle('is-hidden', view !== 'stats');
    elements.formArea.classList.toggle('is-hidden', view !== 'form');
    elements.loadingArea.classList.toggle('is-hidden', view !== 'loading');
    elements.resultArea.classList.toggle('is-hidden', view !== 'result');
};


export const showToast = (msg, type = 'error') => {
    if (!elements.error || !elements.errorText) return;
    
    elements.errorText.textContent = msg;
    elements.error.classList.remove('type-info', 'type-error');
    elements.error.classList.add(`type-${type}`);
    elements.error.classList.add('is-active');
    
    const icon = elements.error.querySelector('i');
    if (icon) {
        icon.setAttribute('data-lucide', type === 'error' ? 'alert-circle' : 'info');
        if (window.lucide) window.lucide.createIcons();
    }

    if (window.toastTimeout) clearTimeout(window.toastTimeout);
    window.toastTimeout = setTimeout(() => {
        elements.error.classList.remove('is-active');
    }, 4000);
};

export const hideToast = () => {
    if (elements.error) elements.error.classList.remove('is-active');
};
