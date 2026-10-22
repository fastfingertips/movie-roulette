import { $ } from './dom.js';

export const THEMES = [
    { id: 'light', name: 'Classic Light', mode: 'light', bg: '#f8fafc', colors: ['#10b981', '#3b82f6', '#f8fafc'] },
    { id: 'light-2', name: 'Pine & Orchid', mode: 'light', bg: '#faeef5', colors: ['#2c6058', '#d384ee', '#faeef5'] },
    { id: 'light-3', name: 'Citron & Berry', mode: 'light', bg: '#f5f3e6', colors: ['#3f7483', '#b32459', '#f5f3e6'] },
    { id: 'light-4', name: 'Forest & Lime', mode: 'light', bg: '#f6f8f5', colors: ['#163300', '#9fe870', '#f6f8f5'] },
    { id: 'dark', name: 'Classic Dark', mode: 'dark', bg: '#0f1117', colors: ['#3d7e5e', '#58a6ff', '#0f1117'] },
    { id: 'dark-2', name: 'AMOLED Black', mode: 'dark', bg: '#000000', colors: ['#2ea043', '#40a9ff', '#000000'] },
    { id: 'dark-3', name: 'Midnight Lime', mode: 'dark', bg: '#121511', colors: ['#9fe870', '#a0e1e1', '#121511'] }
];

const updateActiveThemeInMenu = (themeId) => {
    const options = document.querySelectorAll('.theme-option');
    options.forEach(opt => {
        const isActive = opt.getAttribute('data-theme-id') === themeId;
        opt.classList.toggle('is-active', isActive);
        opt.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });
};

const THEME_STORAGE_KEY = 'theme';

/** Theme used when following the system color scheme */
const SYSTEM_THEME = { light: 'light', dark: 'dark' };

const systemQuery = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

const getSystemTheme = () => (systemQuery && systemQuery.matches ? SYSTEM_THEME.dark : SYSTEM_THEME.light);

const getStoredTheme = () => {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return THEMES.some(t => t.id === stored) ? stored : null;
};

/**
 * Apply a theme with the circular reveal transition.
 * @param {string} newTheme Theme id
 * @param {{x: number, y: number}|null} originCoords Reveal origin; defaults to the toggle button
 * @param {{persist?: boolean}} options Pass persist: false to apply without saving the choice
 */
export const applyTheme = (newTheme, originCoords = null, { persist = true } = {}) => {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    if (newTheme === currentTheme) return;

    let x = window.innerWidth - 40;
    let y = 30;
    if (originCoords && typeof originCoords.x === 'number') {
        x = originCoords.x;
        y = originCoords.y;
    } else {
        const toggleBtn = $('theme-toggle');
        if (toggleBtn) {
            const rect = toggleBtn.getBoundingClientRect();
            x = rect.left + rect.width / 2;
            y = rect.top + rect.height / 2;
        }
    }

    const performToggle = () => {
        document.documentElement.setAttribute('data-theme', newTheme);
        if (persist) localStorage.setItem(THEME_STORAGE_KEY, newTheme);
        updateActiveThemeInMenu(newTheme);
        if (window.lucide) window.lucide.createIcons();
    };

    if (!document.startViewTransition) {
        // Fallback for browsers without View Transitions support
        const overlay = document.createElement('div');
        overlay.style.position = 'fixed';
        overlay.style.inset = '0';
        overlay.style.zIndex = '9999';
        const themeObj = THEMES.find(t => t.id === newTheme);
        overlay.style.background = themeObj ? themeObj.bg : (newTheme.startsWith('dark') ? '#0f1117' : '#f8fafc');
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

export const toggleThemeMenu = (force = null) => {
    const menu = $('theme-menu');
    const btn = $('theme-toggle');
    if (!menu || !btn) return;

    const shouldShow = force !== null ? force : menu.classList.contains('is-hidden');
    menu.classList.toggle('is-hidden', !shouldShow);
    btn.setAttribute('aria-expanded', shouldShow ? 'true' : 'false');
};

export const closeThemeMenu = () => {
    toggleThemeMenu(false);
};

export const toggleTheme = () => {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    const isDark = currentTheme.startsWith('dark');
    const targetTheme = isDark ? 'light' : 'dark';
    applyTheme(targetTheme);
};

export const initTheme = () => {
    // Explicit user choice wins; otherwise follow the system color scheme
    const initialTheme = getStoredTheme() || getSystemTheme();

    document.documentElement.setAttribute('data-theme', initialTheme);
    updateActiveThemeInMenu(initialTheme);

    // Keep following the system until the user picks a theme manually
    if (systemQuery) {
        systemQuery.addEventListener('change', () => {
            if (getStoredTheme()) return;
            applyTheme(getSystemTheme(), null, { persist: false });
        });
    }

    const themeBtn = $('theme-toggle');
    if (themeBtn) {
        themeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleThemeMenu();
        });
    }

    const options = document.querySelectorAll('.theme-option');
    options.forEach(opt => {
        opt.addEventListener('click', () => {
            const themeId = opt.getAttribute('data-theme-id');
            const rect = opt.getBoundingClientRect();
            closeThemeMenu();
            applyTheme(themeId, {
                x: rect.left + rect.width / 2,
                y: rect.top + rect.height / 2
            });
        });
    });

    document.addEventListener('click', (e) => {
        const wrapper = e.target.closest('.theme-picker-wrapper');
        if (!wrapper) closeThemeMenu();
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeThemeMenu();
    });
};
