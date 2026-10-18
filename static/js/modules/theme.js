import { $ } from './dom.js';

export const initTheme = () => {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
};

export const toggleTheme = () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    
    const toggleBtn = $('theme-toggle');
    if (!toggleBtn) return;

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
