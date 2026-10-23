import { formatListUrl, escapeHtml } from '../modules/utils.js';

export const createRecentListItem = (url, activeIndex) => {
    const isActive = activeIndex !== -1;
    const { name, type } = formatListUrl(url);
    const actionTooltip = isActive ? 'Click to remove from list' : 'Click to add to list';
    const ariaLabel = isActive ? `Remove ${name} from list` : `Add ${name} to list`;
    
    return `
        <div class="history-item history-item--recent ${isActive ? 'is-active-list' : ''}" data-url="${escapeHtml(url)}" data-active-index="${activeIndex}" title="${actionTooltip}" role="button" tabindex="0" aria-label="${escapeHtml(ariaLabel)}">
            <div class="history-item__body">
                <div class="history-item__row">
                    <span class="history-item__name history-item__name--mono">${escapeHtml(name)}</span>
                    ${type ? `<span class="field__status field__status--inline is-visible">${type}</span>` : ''}
                </div>
            </div>
            <div class="history-item__action" title="${actionTooltip}">
                ${isActive ? `<span class="icon-default">#${activeIndex + 1}</span><i data-lucide="minus" class="icon-hover"></i>` : '<i data-lucide="plus"></i>'}
            </div>
        </div>
    `;
};
