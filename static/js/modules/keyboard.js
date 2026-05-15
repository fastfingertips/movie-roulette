import { $, elements, setView } from './dom.js';

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
    });
};
