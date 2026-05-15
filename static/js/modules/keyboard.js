import { elements, setView } from './dom.js';

/**
 * Initializes global keyboard shortcuts
 * @param {Object} handlers - Action handlers passed from main controller
 */
export const initKeyboardShortcuts = (handlers) => {
    window.addEventListener('keydown', (e) => {
        // Navigation & Modal Controls
        if (e.key === 'Escape') {
            const isInfoVisible = !elements.infoModal.classList.contains('is-hidden');
            const isStatsVisible = !elements.statsModal.classList.contains('is-hidden');
            const isResultVisible = !elements.resultArea.classList.contains('is-hidden');
            
            if (isInfoVisible) setView('form');
            else if (isStatsVisible) setView('result');
            else if (isResultVisible && handlers.onBack) {
                handlers.onBack();
            }
        }

        // Result View Shortcuts
        const isResultActive = !elements.resultArea.classList.contains('is-hidden');
        if (isResultActive) {
            if (e.key.toLowerCase() === 'r' && handlers.onRetry) {
                handlers.onRetry();
            }
            if (e.key.toLowerCase() === 'l' && handlers.onOpen) {
                handlers.onOpen();
            }
            if (e.key.toLowerCase() === 's' && handlers.onShare) {
                handlers.onShare();
            }
        }

        // Shift + Enter: Add another list
        if (e.shiftKey && e.key === 'Enter') {
            // Avoid double-trigger if button is focused
            if (e.target.id === 'add-url-btn') return;

            const isFormVisible = !elements.formArea.classList.contains('is-hidden');
            if (isFormVisible && handlers.onAddField) {
                e.preventDefault();
                e.stopImmediatePropagation();
                handlers.onAddField();
            }
        }

        // Global Enter: Spin the wheel (if form is valid and not already submitting)
        if (e.key === 'Enter' && !e.shiftKey) {
            const isFormVisible = !elements.formArea.classList.contains('is-hidden');
            const submitBtn = elements.formArea.querySelector('button[type="submit"]');
            
            // Only trigger if form is visible and submit button is enabled (at least one URL)
            if (isFormVisible && submitBtn && !submitBtn.disabled) {
                // If focus is already on an input/button, browser handles it; 
                // but if focus is on body/elsewhere, we trigger it manually.
                if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'BUTTON') {
                    e.preventDefault();
                    if (handlers.onSubmit) handlers.onSubmit();
                }
            }
        }
    });
};
