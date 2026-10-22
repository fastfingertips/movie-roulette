import { formatListUrl, escapeHtml } from '../modules/utils.js';

export const createRecentListItem = (url, activeIndex) => {
    const isActive = activeIndex !== -1;
    const { name, type } = formatListUrl(url);
    const actionTooltip = isActive ? 'Click to remove from list' : 'Click to add to list';
    const ariaLabel = isActive ? `Remove ${name} from list` : `Add ${name} to list`;
    
    return `
        <div class="history-item ${isActive ? 'is-active-list' : ''}" style="cursor: pointer;" data-url="${escapeHtml(url)}" data-active-index="${activeIndex}" title="${actionTooltip}" role="button" tabindex="0" aria-label="${escapeHtml(ariaLabel)}">
            <div class="history-item__body">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span class="history-item__name" style="font-size: 11px; font-family: monospace;">${escapeHtml(name)}</span>
                    ${type ? `<span class="field__status is-visible" style="position: static; font-size: 9px; padding: 1px 4px;">${type}</span>` : ''}
                </div>
            </div>
            <div class="history-item__action" style="color: ${isActive ? 'var(--color-green)' : 'inherit'}; font-weight: 800; font-family: monospace; font-size: 10px;" title="${actionTooltip}">
                ${isActive ? `<span class="icon-default">#${activeIndex + 1}</span><i data-lucide="minus" class="icon-hover"></i>` : '<i data-lucide="plus"></i>'}
            </div>
        </div>
    `;
};
