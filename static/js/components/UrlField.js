import { escapeHtml } from '../modules/utils.js';

export const createUrlField = (number, value = '') => {
    const div = document.createElement('div');
    div.className = 'field is-optional';
    div.innerHTML = `
        <div class="field__number">${number}</div>
        <div class="field__row">
            <div class="field__input-wrapper">
                <input class="field__input" type="text" placeholder="(Optional) URL, username, or slug…" value="${escapeHtml(value)}"/>
                <span class="field__meta"></span>
                <div class="field__badges">
                    <span class="field__status"></span>
                    <span class="field__ratio"></span>
                </div>
            </div>
            <button type="button" class="field__remove" name="remove-field" title="Remove"><i data-lucide="trash-2"></i></button>
        </div>
    `;
    return div;
};
