import { elements, refreshIcons } from './dom.js';
import { escapeHtml } from './utils.js';

export const THEMES = [
    { id: 'classic-light', name: 'Classic Light', label: 'Classic', pair: 'classic-dark', mode: 'light', bg: '#f8fafc', colors: ['#10b981', '#3b82f6', '#f8fafc'] },
    { id: 'pine-orchid', name: 'Pine & Orchid', label: 'Pine & Orchid', pair: 'pine-orchid-dark', mode: 'light', bg: '#faeef5', colors: ['#2c6058', '#d384ee', '#faeef5'] },
    { id: 'citron-berry', name: 'Citron & Berry', label: 'Citron & Berry', pair: 'citron-berry-dark', mode: 'light', bg: '#f5f3e6', colors: ['#3f7483', '#b32459', '#f5f3e6'] },
    { id: 'forest-lime', name: 'Forest & Lime', label: 'Forest & Lime', pair: 'midnight-lime', mode: 'light', bg: '#f6f8f5', colors: ['#163300', '#9fe870', '#f6f8f5'] },
    { id: 'letterboxd-light', name: 'Letterboxd Light', label: 'Letterboxd', pair: 'letterboxd-dark', mode: 'light', bg: '#f4f6f8', colors: ['#00a63e', '#ff8000', '#f4f6f8'] },
    { id: 'amoled-light', name: 'AMOLED Light', label: 'AMOLED', pair: 'amoled', mode: 'light', bg: '#ffffff', colors: ['#1a7f37', '#0969da', '#ffffff'] },
    { id: 'classic-dark', name: 'Classic Dark', label: 'Classic', pair: 'classic-light', mode: 'dark', bg: '#0f1117', colors: ['#3d7e5e', '#58a6ff', '#0f1117'] },
    { id: 'amoled', name: 'AMOLED Black', label: 'AMOLED', pair: 'amoled-light', mode: 'dark', bg: '#000000', colors: ['#2ea043', '#40a9ff', '#000000'] },
    { id: 'midnight-lime', name: 'Midnight Lime', label: 'Forest & Lime', pair: 'forest-lime', mode: 'dark', bg: '#121511', colors: ['#9fe870', '#a0e1e1', '#121511'] },
    { id: 'letterboxd-dark', name: 'Letterboxd Dark', label: 'Letterboxd', pair: 'letterboxd-light', mode: 'dark', bg: '#14181c', colors: ['#00e054', '#ff8000', '#14181c'] },
    { id: 'pine-orchid-dark', name: 'Pine & Orchid Dark', label: 'Pine & Orchid', pair: 'pine-orchid', mode: 'dark', bg: '#141016', colors: ['#6dd32c', '#d384ee', '#141016'] },
    { id: 'citron-berry-dark', name: 'Citron & Berry Dark', label: 'Citron & Berry', pair: 'citron-berry', mode: 'dark', bg: '#141512', colors: ['#e83e7c', '#4ea5bb', '#141512'] }
];

const renderThemeOptionHtml = (theme, idx, isActive = false) => {
    const swatches = theme.colors
        .map((color, colorIdx) => {
            const bgClass = colorIdx === 2 ? ' theme-dot--bg' : '';
            return `<span class="theme-dot${bgClass}" style="background: ${color}"></span>`;
        })
        .join('');
    const displayLabel = theme.label || theme.name;
    const activeClass = isActive ? ' is-active' : '';
    return `<button type="button" class="theme-option${activeClass}" data-theme-id="${escapeHtml(theme.id)}" data-palette-index="${idx}" role="menuitem" aria-selected="${isActive}"><span class="theme-option__swatches">${swatches}</span><span class="theme-option__name">${escapeHtml(displayLabel)}</span><i data-lucide="check" class="theme-option__check"></i></button>`;
};

export const buildThemeMenuHtml = (
    themes = THEMES,
    activeMode = 'light',
    activeThemeId = null,
    activeThemeMode = 'system'
) => {
    const basePalettes = themes.filter(t => t.mode === 'light');
    const modeThemes = basePalettes.map(t => {
        if (activeMode === 'dark' && t.pair) {
            return themes.find(d => d.id === t.pair) || t;
        }
        return t;
    });

    const isSystem = activeThemeMode === 'system';
    const isLight = activeThemeMode === 'light';
    const isDark = activeThemeMode === 'dark';

    const modeSwitchHtml = `<div class="theme-mode-switch" role="group" aria-label="Theme mode"><button type="button" class="theme-mode-btn${isSystem ? ' is-active' : ''}" data-mode-value="system" aria-pressed="${isSystem}"><i data-lucide="monitor"></i><span>System</span></button><button type="button" class="theme-mode-btn${isLight ? ' is-active' : ''}" data-mode-value="light" aria-pressed="${isLight}"><i data-lucide="sun"></i><span>Light</span></button><button type="button" class="theme-mode-btn${isDark ? ' is-active' : ''}" data-mode-value="dark" aria-pressed="${isDark}"><i data-lucide="moon"></i><span>Dark</span></button></div><div class="theme-menu__divider"></div>`;

    return [
        modeSwitchHtml,
        ...modeThemes.map((t, idx) => renderThemeOptionHtml(t, idx, t.id === activeThemeId))
    ].join('');
};

export const TRANSLUCENT_STORAGE_KEY = 'movie_roulette_translucent';

export const isTranslucent = () => {
    if (typeof localStorage === 'undefined') return true;
    return localStorage.getItem(TRANSLUCENT_STORAGE_KEY) !== 'false';
};

export const syncTranslucentToggles = (enabled) => {
    const toggle = elements.themeTranslucentToggle || (typeof document !== 'undefined' ? document.getElementById('theme-menu-translucent-toggle') : null);
    if (toggle) toggle.checked = enabled;
};

export const setTranslucent = (enabled, persist = true) => {
    if (typeof document !== 'undefined') {
        if (enabled) {
            document.documentElement.removeAttribute('data-solid-surfaces');
        } else {
            document.documentElement.setAttribute('data-solid-surfaces', 'true');
        }
    }
    if (persist && typeof localStorage !== 'undefined') {
        localStorage.setItem(TRANSLUCENT_STORAGE_KEY, enabled ? 'true' : 'false');
    }
    syncTranslucentToggles(enabled);
};

const THEME_STORAGE_KEY = 'theme';
export const THEME_MODE_STORAGE_KEY = 'theme_mode';

/** Default light and dark themes (used for system scheme and quick toggle) */
export const SYSTEM_THEME = { light: 'forest-lime', dark: 'midnight-lime' };

const systemQuery = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

export const getSystemMode = () => (systemQuery && systemQuery.matches ? 'dark' : 'light');

export const getSystemTheme = () => (getSystemMode() === 'dark' ? SYSTEM_THEME.dark : SYSTEM_THEME.light);

export const resolveTheme = (themeId) => {
    if (!themeId) return null;
    return THEMES.find(t => t.id === themeId) || null;
};

export const getStoredThemeMode = () => {
    if (typeof localStorage === 'undefined') return 'system';
    const stored = localStorage.getItem(THEME_MODE_STORAGE_KEY);
    return (stored === 'light' || stored === 'dark') ? stored : 'system';
};

export const setStoredThemeMode = (mode) => {
    if (typeof localStorage === 'undefined') return;
    if (mode === 'light' || mode === 'dark') {
        localStorage.setItem(THEME_MODE_STORAGE_KEY, mode);
    } else {
        localStorage.removeItem(THEME_MODE_STORAGE_KEY);
    }
};

export const getEffectiveMode = (themeMode = getStoredThemeMode()) => {
    if (themeMode === 'light' || themeMode === 'dark') return themeMode;
    return getSystemMode();
};

export const getCounterpartTheme = (themeId, targetMode = null) => {
    const current = resolveTheme(themeId);
    if (!current) {
        return targetMode === 'dark' ? SYSTEM_THEME.dark : SYSTEM_THEME.light;
    }
    if (targetMode && current.mode === targetMode) {
        return current.id;
    }
    return current.pair || (current.mode === 'light' ? SYSTEM_THEME.dark : SYSTEM_THEME.light);
};

export const getStoredTheme = () => {
    if (typeof localStorage === 'undefined') return null;
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    const resolved = resolveTheme(stored);
    return resolved ? resolved.id : null;
};

const updateActiveThemeInMenu = (themeId) => {
    if (typeof document === 'undefined') return;
    const root = elements.themeMenu || document;
    const activeTheme = resolveTheme(themeId) || resolveTheme(SYSTEM_THEME.light);
    const activeMode = activeTheme ? activeTheme.mode : 'light';
    const themeMode = getStoredThemeMode();
    const basePalettes = THEMES.filter(t => t.mode === 'light');

    const modeBtns = root.querySelectorAll('.theme-mode-btn');
    modeBtns.forEach(btn => {
        const val = btn.getAttribute('data-mode-value');
        const isActive = val === themeMode;
        btn.classList.toggle('is-active', isActive);
        btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });

    const options = root.querySelectorAll('.theme-option');
    options.forEach((opt, index) => {
        const paletteIdx = Number(opt.getAttribute('data-palette-index') ?? index);
        const lightTheme = basePalettes[paletteIdx];
        if (!lightTheme) return;

        const targetTheme = activeMode === 'dark' && lightTheme.pair
            ? (resolveTheme(lightTheme.pair) || lightTheme)
            : lightTheme;

        opt.setAttribute('data-theme-id', targetTheme.id);
        const isActive = targetTheme.id === activeTheme.id;
        opt.classList.toggle('is-active', isActive);
        opt.setAttribute('aria-selected', isActive ? 'true' : 'false');

        const dots = opt.querySelectorAll('.theme-dot');
        dots.forEach((dot, dotIdx) => {
            if (targetTheme.colors[dotIdx]) {
                dot.style.background = targetTheme.colors[dotIdx];
            }
        });
    });
};

/**
 * Apply a theme with the circular reveal transition.
 * @param {string} newTheme Theme id
 * @param {{x: number, y: number}|null} originCoords Reveal origin; defaults to the toggle button
 * @param {{persist?: boolean, themeMode?: string}} options Pass persist: false to apply without saving the choice
 */
export const applyTheme = (newTheme, originCoords = null, { persist = true, themeMode = null } = {}) => {
    const themeObj = resolveTheme(newTheme);
    if (!themeObj) return;

    if (themeMode !== null) {
        setStoredThemeMode(themeMode);
    }

    const currentTheme = document.documentElement.getAttribute('data-theme') || SYSTEM_THEME.light;
    const currentModePref = document.documentElement.getAttribute('data-theme-mode') || 'system';
    const effectiveThemeMode = getStoredThemeMode();

    if (themeObj.id === currentTheme && effectiveThemeMode === currentModePref) return;

    let x = window.innerWidth - 40;
    let y = 30;
    if (originCoords && typeof originCoords.x === 'number') {
        x = originCoords.x;
        y = originCoords.y;
    } else {
        const toggleBtn = elements.themeToggle || document.getElementById('theme-toggle');
        if (toggleBtn) {
            const rect = toggleBtn.getBoundingClientRect();
            x = rect.left + rect.width / 2;
            y = rect.top + rect.height / 2;
        }
    }

    const performToggle = () => {
        document.documentElement.setAttribute('data-theme', themeObj.id);
        document.documentElement.setAttribute('data-mode', themeObj.mode);
        document.documentElement.setAttribute('data-theme-mode', effectiveThemeMode);
        if (persist) localStorage.setItem(THEME_STORAGE_KEY, themeObj.id);
        updateActiveThemeInMenu(themeObj.id);
    };

    if (!document.startViewTransition) {
        // Fallback for browsers without View Transitions support
        const overlay = document.createElement('div');
        overlay.style.position = 'fixed';
        overlay.style.inset = '0';
        overlay.style.zIndex = '9999';
        overlay.style.background = themeObj.bg;
        overlay.style.clipPath = `circle(0% at ${x}px ${y}px)`;
        overlay.style.transition = 'clip-path 0.5s ease-in-out';
        document.body.appendChild(overlay);

        overlay.offsetWidth; // Force reflow
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
        const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
        document.documentElement.animate(
            {
                clipPath: [
                    `circle(0% at ${x}px ${y}px)`,
                    `circle(${radius}px at ${x}px ${y}px)`
                ]
            },
            {
                duration: 500,
                easing: 'ease-in-out',
                pseudoElement: '::view-transition-new(root)'
            }
        );
    });
};

const toggleThemeMenu = (force = null) => {
    const menu = elements.themeMenu || document.getElementById('theme-menu');
    const btn = elements.themeToggle || document.getElementById('theme-toggle');
    if (!menu || !btn) return;

    const shouldShow = force !== null ? force : menu.classList.contains('is-hidden');
    menu.classList.toggle('is-hidden', !shouldShow);
    btn.setAttribute('aria-expanded', shouldShow ? 'true' : 'false');
    if (shouldShow) {
        refreshIcons(menu);
    }
};

const closeThemeMenu = () => {
    toggleThemeMenu(false);
};

export const initTheme = () => {
    const themeMode = getStoredThemeMode();
    const effectiveMode = getEffectiveMode(themeMode);

    // Initial theme: respect user stored theme adapted to effective mode, or default to system theme
    const storedTheme = getStoredTheme();
    let initialTheme = storedTheme ? getCounterpartTheme(storedTheme, effectiveMode) : (effectiveMode === 'dark' ? SYSTEM_THEME.dark : SYSTEM_THEME.light);
    const resolved = resolveTheme(initialTheme);
    const mode = resolved ? resolved.mode : effectiveMode;

    const optionsContainer = elements.themeMenuOptions || document.getElementById('theme-menu-options');
    if (optionsContainer) {
        optionsContainer.innerHTML = buildThemeMenuHtml(THEMES, mode, initialTheme, themeMode);
    }

    document.documentElement.setAttribute('data-theme', initialTheme);
    document.documentElement.setAttribute('data-mode', mode);
    document.documentElement.setAttribute('data-theme-mode', themeMode);
    updateActiveThemeInMenu(initialTheme);

    // If in system mode, listen to OS scheme changes
    if (systemQuery) {
        systemQuery.addEventListener('change', () => {
            if (getStoredThemeMode() !== 'system') return;
            const currentTheme = document.documentElement.getAttribute('data-theme') || SYSTEM_THEME.light;
            const newMode = systemQuery.matches ? 'dark' : 'light';
            const targetTheme = getCounterpartTheme(currentTheme, newMode);
            applyTheme(targetTheme, null, { persist: true });
        });
    }

    const themeBtn = elements.themeToggle || document.getElementById('theme-toggle');
    if (themeBtn) {
        themeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleThemeMenu();
        });
    }

    const menuEl = elements.themeMenu || document.getElementById('theme-menu');
    if (menuEl) {
        menuEl.addEventListener('click', (e) => {
            const modeBtn = e.target.closest('.theme-mode-btn');
            if (modeBtn) {
                const targetModePref = modeBtn.getAttribute('data-mode-value');
                const targetEffectiveMode = targetModePref === 'system' ? getSystemMode() : targetModePref;
                const currentTheme = document.documentElement.getAttribute('data-theme') || SYSTEM_THEME.light;
                const nextTheme = getCounterpartTheme(currentTheme, targetEffectiveMode);
                const rect = modeBtn.getBoundingClientRect();
                applyTheme(nextTheme, {
                    x: rect.left + rect.width / 2,
                    y: rect.top + rect.height / 2
                }, {
                    persist: true,
                    themeMode: targetModePref
                });
                return;
            }

            const opt = e.target.closest('.theme-option');
            if (!opt) return;
            const themeId = opt.getAttribute('data-theme-id');
            const rect = opt.getBoundingClientRect();
            closeThemeMenu();
            applyTheme(themeId, {
                x: rect.left + rect.width / 2,
                y: rect.top + rect.height / 2
            }, {
                persist: true
            });
        });
    }

    document.addEventListener('click', (e) => {
        const wrapper = e.target.closest('.theme-picker-wrapper');
        if (!wrapper) closeThemeMenu();
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeThemeMenu();
    });

    // Initialize translucency (defaults to true)
    const initialTranslucent = isTranslucent();
    setTranslucent(initialTranslucent, false);

    const handleTranslucentChange = (checked) => {
        setTranslucent(checked, true);
    };

    const menuTranslucent = elements.themeTranslucentToggle || document.getElementById('theme-menu-translucent-toggle');
    if (menuTranslucent) {
        menuTranslucent.addEventListener('change', () => {
            handleTranslucentChange(menuTranslucent.checked);
        });
    }

    const menuRow = elements.themeTranslucentRow || document.getElementById('theme-menu-translucent-row');
    if (menuRow) {
        menuRow.addEventListener('click', (e) => {
            if (e.target.closest('.switch')) return;
            const next = !isTranslucent();
            handleTranslucentChange(next);
        });
    }
};
