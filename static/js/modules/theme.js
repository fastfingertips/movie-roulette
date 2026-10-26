
export const THEME_MIGRATION_MAP = {
    light: 'classic-light',
    'light-2': 'pine-orchid',
    'light-3': 'citron-berry',
    'light-4': 'forest-lime',
    dark: 'classic-dark',
    'dark-2': 'amoled',
    'dark-3': 'midnight-lime'
};

export const THEMES = [
    { id: 'classic-light', name: 'Classic Light', mode: 'light', bg: '#f8fafc', colors: ['#10b981', '#3b82f6', '#f8fafc'] },
    { id: 'pine-orchid', name: 'Pine & Orchid', mode: 'light', bg: '#faeef5', colors: ['#2c6058', '#d384ee', '#faeef5'] },
    { id: 'citron-berry', name: 'Citron & Berry', mode: 'light', bg: '#f5f3e6', colors: ['#3f7483', '#b32459', '#f5f3e6'] },
    { id: 'forest-lime', name: 'Forest & Lime', mode: 'light', bg: '#f6f8f5', colors: ['#163300', '#9fe870', '#f6f8f5'] },
    { id: 'classic-dark', name: 'Classic Dark', mode: 'dark', bg: '#0f1117', colors: ['#3d7e5e', '#58a6ff', '#0f1117'] },
    { id: 'amoled', name: 'AMOLED Black', mode: 'dark', bg: '#000000', colors: ['#2ea043', '#40a9ff', '#000000'] },
    { id: 'midnight-lime', name: 'Midnight Lime', mode: 'dark', bg: '#121511', colors: ['#9fe870', '#a0e1e1', '#121511'] }
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

/** Default light and dark themes (used for system scheme and quick toggle) */
export const SYSTEM_THEME = { light: 'forest-lime', dark: 'midnight-lime' };

const systemQuery = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

export const getSystemTheme = () => (systemQuery && systemQuery.matches ? SYSTEM_THEME.dark : SYSTEM_THEME.light);

export const resolveTheme = (themeId) => {
    if (!themeId) return null;
    const migratedId = THEME_MIGRATION_MAP[themeId] || themeId;
    return THEMES.find(t => t.id === migratedId) || null;
};

export const getStoredTheme = () => {
    if (typeof localStorage === 'undefined') return null;
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    const resolved = resolveTheme(stored);
    return resolved ? resolved.id : null;
};

/**
 * Apply a theme with the circular reveal transition.
 * @param {string} newTheme Theme id
 * @param {{x: number, y: number}|null} originCoords Reveal origin; defaults to the toggle button
 * @param {{persist?: boolean}} options Pass persist: false to apply without saving the choice
 */
export const applyTheme = (newTheme, originCoords = null, { persist = true } = {}) => {
    const resolvedTheme = resolveTheme(newTheme);
    const targetThemeId = resolvedTheme ? resolvedTheme.id : newTheme;
    const currentTheme = document.documentElement.getAttribute('data-theme') || SYSTEM_THEME.light;
    if (targetThemeId === currentTheme) return;

    const targetMode = resolvedTheme ? resolvedTheme.mode : (targetThemeId.includes('dark') || targetThemeId === 'amoled' ? 'dark' : 'light');

    let x = window.innerWidth - 40;
    let y = 30;
    if (originCoords && typeof originCoords.x === 'number') {
        x = originCoords.x;
        y = originCoords.y;
    } else {
        const toggleBtn = document.getElementById('theme-toggle');
        if (toggleBtn) {
            const rect = toggleBtn.getBoundingClientRect();
            x = rect.left + rect.width / 2;
            y = rect.top + rect.height / 2;
        }
    }

    const performToggle = () => {
        document.documentElement.setAttribute('data-theme', targetThemeId);
        document.documentElement.setAttribute('data-mode', targetMode);
        if (persist) localStorage.setItem(THEME_STORAGE_KEY, targetThemeId);
        updateActiveThemeInMenu(targetThemeId);
        if (window.lucide) window.lucide.createIcons();
    };

    if (!document.startViewTransition) {
        // Fallback for browsers without View Transitions support
        const overlay = document.createElement('div');
        overlay.style.position = 'fixed';
        overlay.style.inset = '0';
        overlay.style.zIndex = '9999';
        overlay.style.background = resolvedTheme ? resolvedTheme.bg : (targetMode === 'dark' ? '#0f1117' : '#f8fafc');
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
    const menu = document.getElementById('theme-menu');
    const btn = document.getElementById('theme-toggle');
    if (!menu || !btn) return;

    const shouldShow = force !== null ? force : menu.classList.contains('is-hidden');
    menu.classList.toggle('is-hidden', !shouldShow);
    btn.setAttribute('aria-expanded', shouldShow ? 'true' : 'false');
};

const closeThemeMenu = () => {
    toggleThemeMenu(false);
};

export const initTheme = () => {
    // Explicit user choice wins; otherwise follow the system color scheme
    const initialTheme = getStoredTheme() || getSystemTheme();
    const resolved = resolveTheme(initialTheme);
    const mode = resolved ? resolved.mode : 'light';

    document.documentElement.setAttribute('data-theme', initialTheme);
    document.documentElement.setAttribute('data-mode', mode);
    updateActiveThemeInMenu(initialTheme);

    // Keep following the system until the user picks a theme manually
    if (systemQuery) {
        systemQuery.addEventListener('change', () => {
            if (getStoredTheme()) return;
            applyTheme(getSystemTheme(), null, { persist: false });
        });
    }

    const themeBtn = document.getElementById('theme-toggle');
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
