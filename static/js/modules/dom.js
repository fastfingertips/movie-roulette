export const $ = (id) => (typeof document !== 'undefined' ? document.getElementById(id) : null);

export const refreshIcons = (root = typeof document !== 'undefined' ? document : null) => {
    if (typeof window === 'undefined' || !window.lucide || !root) return;
    if (root !== document && typeof root.querySelector === 'function' && !root.querySelector('[data-lucide]')) {
        return;
    }
    window.lucide.createIcons();
};

export const hydrateModal = (modalEl) => {
    if (!modalEl || typeof modalEl.querySelector !== 'function') return false;
    const tpl = modalEl.querySelector('template');
    if (!tpl || !tpl.content) return false;
    modalEl.appendChild(tpl.content.cloneNode(true));
    tpl.remove();
    refreshIcons(modalEl);
    return true;
};

export const elements = {
    // Header & Theme
    themeToggle: $('theme-toggle'),
    themeMenu: $('theme-menu'),
    themeMenuOptions: $('theme-menu-options'),
    themeTranslucentToggle: $('theme-menu-translucent-toggle'),
    themeTranslucentRow: $('theme-menu-translucent-row'),
    generatorBtn: $('generator-btn'),
    infoBtn: $('info-btn'),

    // Form & Main Area
    formArea: $('form-panel'),
    randomizeForm: $('randomize-form'),
    urlFields: $('url-fields'),
    addUrlBtn: $('add-url-btn'),
    samplingToggleWrapper: $('sampling-toggle-wrapper'),
    samplingToggle: $('sampling-toggle'),
    loadingArea: $('loading-panel'),
    slot: $('slot-text'),
    bar: $('bar-fill'),

    // Result Area
    resultArea: $('result-panel'),
    backBtn: $('back-btn'),
    tryAgainBtn: $('try-again-btn'),
    shareBlendBtn: $('share-blend-btn'),
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
    resListLink: $('result-list-link'),
    resBodyBlock: $('result-body-block'),
    resInfo: $('result-info'),
    statsBtn: $('stats-btn'),
    statsPopToast: $('stats-pop-toast'),

    // History & Recent Lists
    historyGrid: $('history-grid'),
    recentListsSection: $('recent-lists-section'),
    recentListsList: $('recent-lists-list'),
    clearListsBtn: $('clear-lists'),
    historySection: $('history-section'),
    historyList: $('history-list'),
    clearHistoryBtn: $('clear-history'),

    // Footer Toggles & Global UI
    randomToggleWrapper: $('random-toggle-wrapper'),
    randomToggle: $('random-toggle'),
    consoleToggleWrapper: $('console-toggle-wrapper'),
    debugToggle: $('debug-toggle'),
    historyToggleWrapper: $('history-toggle-wrapper'),
    historyToggle: $('history-toggle'),
    error: $('error-msg'),
    errorText: $('error-text'),
    backdrop: $('backdrop'),
    backdropImg: typeof document !== 'undefined' ? document.querySelector('.backdropimage') : null,

    // Modals
    infoModal: $('info-modal'),
    generatorModal: $('generator-modal'),
    statsModal: $('stats-modal')
};
