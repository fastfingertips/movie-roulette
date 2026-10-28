import { $, elements, hydrateModal, refreshIcons } from './dom.js';
import { escapeHtml } from './utils.js';

const displayToast = (msg, type = 'success') => {
    const toast = elements.error || $('error-msg');
    const text = elements.errorText || $('error-text');
    if (toast && text) {
        text.textContent = msg;
        toast.className = `toast is-visible ${type === 'success' ? 'toast--success' : ''}`;
        setTimeout(() => toast.classList.remove('is-visible'), 2500);
    }
};

export const normalizeItem = (item) => {
    let clean = item.trim();
    if (!clean) return '';
    clean = clean.replace(/^https?:\/\/(?:www\.)?letterboxd\.com\/?/i, '');
    const listMatch = clean.match(/^([a-zA-Z0-9_-]+)\/list\/([a-zA-Z0-9_-]+)\/?/);
    if (listMatch) {
        return `${listMatch[1]}/${listMatch[2]}`;
    }
    const watchlistMatch = clean.match(/^([a-zA-Z0-9_-]+)\/watchlist\/?/);
    if (watchlistMatch) {
        return `${watchlistMatch[1]}/watchlist`;
    }
    const userMatch = clean.match(/^([a-zA-Z0-9_-]+)\/?$/);
    if (userMatch) {
        return userMatch[1];
    }
    return clean.replace(/^\/+|\/+$/g, '');
};

export const normalizeSourceInput = (rawInput) => {
    if (!rawInput || typeof rawInput !== 'string') return '';
    const tokens = rawInput
        .split(/[\n,]+/)
        .map(t => normalizeItem(t))
        .filter(Boolean);
    return tokens.join(',');
};

export const getSourceMeta = (item) => {
    const normalized = normalizeItem(item);
    if (!normalized) return null;

    if (normalized.endsWith('/watchlist')) {
        const username = normalized.replace(/\/watchlist$/, '');
        return {
            raw: item,
            normalized,
            type: 'user',
            label: 'Watchlist',
            display: `@${username}`
        };
    }

    if (normalized.includes('/')) {
        return {
            raw: item,
            normalized,
            type: 'list',
            label: 'Custom List',
            display: normalized
        };
    }

    return {
        raw: item,
        normalized,
        type: 'user',
        label: 'Watchlist',
        display: `@${normalized}`
    };
};

export const parseSourceTokens = (rawInput) => {
    if (!rawInput || typeof rawInput !== 'string') return [];
    const tokens = rawInput
        .split(/[\n,]+/)
        .map(t => t.trim())
        .filter(Boolean);

    const seen = new Set();
    const result = [];

    tokens.forEach((raw) => {
        const meta = getSourceMeta(raw);
        if (meta && !seen.has(meta.normalized)) {
            seen.add(meta.normalized);
            result.push(meta);
        }
    });

    return result;
};

export const renderSourceList = (sourcesListEl, sourcesCountEl, sourceBadgeEl, parsedSources = []) => {
    const count = parsedSources.length;

    if (sourceBadgeEl) {
        sourceBadgeEl.textContent = count === 1 ? '1 source' : `${count} sources`;
    }

    if (sourcesCountEl) {
        if (count === 0) {
            sourcesCountEl.textContent = 'No sources detected';
        } else if (count === 1) {
            sourcesCountEl.textContent = '1 source detected';
        } else {
            sourcesCountEl.textContent = `${count} sources detected`;
        }
    }

    if (!sourcesListEl) return;

    if (count === 0) {
        sourcesListEl.innerHTML = `
            <div class="generator-source-empty">
                <i data-lucide="list-plus"></i>
                <span>No sources detected yet. Enter usernames or list links above.</span>
            </div>
        `;
        refreshIcons(sourcesListEl);
        return;
    }

    sourcesListEl.innerHTML = parsedSources.map((item) => `
        <div class="generator-source-item" data-source="${escapeHtml(item.normalized)}">
            <div class="generator-source-info">
                <i data-lucide="${item.type === 'user' ? 'user' : 'film'}" class="generator-source-icon"></i>
                <span class="generator-source-name">${escapeHtml(item.display)}</span>
            </div>
            <div class="generator-source-actions">
                <span class="generator-source-badge">${escapeHtml(item.label)}</span>
                <button type="button" class="generator-source-remove-btn" data-remove="${escapeHtml(item.normalized)}" title="Remove ${escapeHtml(item.display)}" aria-label="Remove ${escapeHtml(item.display)}">
                    <i data-lucide="x"></i>
                </button>
            </div>
        </div>
    `).join('');

    refreshIcons(sourcesListEl);
};

export const buildGeneratorOutput = ({
    sources = '',
    count = null,
    actionType = 'redirect',
    shuffle = false,
    strategy = 'custom',
    mode = 'proportional',
    autoRoll = true,
    format = 'default',
    label = 'Random Movie',
    origin = typeof window !== 'undefined' ? window.location.origin : 'https://roulette.bugra.co'
} = {}) => {
    const normalizedSources = normalizeSourceInput(sources);
    const sourceList = normalizedSources ? normalizedSources.split(',') : [];
    const isSingle = sourceList.length === 1;
    const baseOrigin = origin.replace(/\/+$/, '');

    let path;
    const params = new URLSearchParams();

    if (actionType === 'redirect') {
        if (isSingle) {
            path = `/r/${sourceList[0]}`;
        } else {
            path = '/r';
            if (normalizedSources) {
                params.set('url', normalizedSources);
            }
        }
    } else {
        path = '/';
        if (normalizedSources) {
            params.set('url', normalizedSources);
        }
        if (!autoRoll) {
            params.set('run', '0');
        }
    }

    if (count && Number(count) > 0 && isSingle && actionType === 'redirect') {
        params.set('count', String(count));
    }

    if (shuffle || strategy === 'letterboxd') {
        params.set('shuffle', '1');
    }

    if (sourceList.length > 1 && mode === 'equal') {
        params.set('mode', 'equal');
    }

    if (format === 'json') {
        params.set('format', 'json');
    }

    const queryString = params.toString().replace(/%2F/g, '/').replace(/%2C/g, ',');
    const finalUrl = `${baseOrigin}${path}${queryString ? `?${queryString}` : ''}`;
    const cleanLabel = (label || 'Random Movie').trim();

    return {
        url: finalUrl,
        html: `<a href="${finalUrl}">${cleanLabel}</a>`,
        markdown: `[${cleanLabel}](${finalUrl})`
    };
};

export const copyToClipboard = async (text, successMsg = 'Copied to clipboard') => {
    try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(text);
        } else {
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
        }
        displayToast(successMsg);
        return true;
    } catch {
        displayToast('Failed to copy to clipboard');
        return false;
    }
};

export const GENERATOR_DOCS_MARKDOWN = `# Movie Roulette - URL Redirect & API Specification

Movie Roulette is a high-speed, stateless Letterboxd roulette redirect engine. It samples Letterboxd watchlists and custom lists in real time and issues an instant HTTP 302 Found redirect directly to a randomly selected Letterboxd film.

## Base Endpoints
- Web App: https://roulette.bugra.co/
- Direct Redirect: https://roulette.bugra.co/r

## Clean URL Endpoints (HTTP 302 Redirect)
- Single Watchlist:
  /r/:username
  Example: /r/bugracoskun
  Picks a random film from the user's public Letterboxd watchlist.

- Single Custom List:
  /r/:username/:list_slug
  Example: /r/official/letterboxds-top-500-films
  Picks a random film from the specified public list.

- Multi-Source Blend:
  /r?url=list1,list2
  Example: /r?url=bugracoskun,official/letterboxds-top-500-films
  Blends multiple users or lists into a single lottery pool.

- Web Roulette Interface:
  /?url=list1,list2
  Example: /?url=bugracoskun,official/letterboxds-top-500-films
  Opens the Movie Roulette web app with lists pre-loaded into the form.

## Query Parameters
- count (integer, optional):
  Total film count hint for 1-hop sampling (e.g. ?count=500). Skips initial page calculation requests. Only valid for single sources.
- shuffle (1 | 0, default 0):
  When shuffle=1, queries Letterboxd's native /by/shuffle/ view (Page 1 only). Default is 0 (samples across all pages).
- mode (proportional | equal, default proportional):
  Multi-list odds balancing.
  - proportional: Probabilities are weighted by total list size.
  - equal: Gives each list equal 50/50 odds regardless of size.
- format (json, optional):
  When format=json, returns a raw JSON payload instead of an HTTP 302 redirect.
  Response: {"movie": "Persona", "year": "1966", "url": "https://letterboxd.com/film/persona/", "source": "bugracoskun"}
- run (1 | 0, default 1):
  In Web App view (/?url=...), run=0 prevents auto-spinning the wheel on page load.

## Headless CLI / cURL Examples
- Fetch JSON film pick:
  curl -L "https://roulette.bugra.co/r/bugracoskun?format=json"

- Direct browser redirect:
  curl -I "https://roulette.bugra.co/r/official/top-250-films?count=250"
`;

export const initDocsPagination = (modal) => {
    if (!modal) return null;
    const tabs = Array.from(modal.querySelectorAll('.generator-docs-tab'));
    const pages = Array.from(modal.querySelectorAll('.generator-docs-page'));
    const prevBtn = modal.querySelector('#gen-docs-prev');
    const nextBtn = modal.querySelector('#gen-docs-next');
    const currentPageEl = modal.querySelector('#gen-docs-current-page');
    const dots = Array.from(modal.querySelectorAll('.generator-page-dot'));

    if (pages.length === 0) return null;

    let currentIndex = 0;

    const setPage = (index) => {
        if (index < 0 || index >= pages.length) return;
        currentIndex = index;

        pages.forEach((page, i) => {
            const isActive = i === currentIndex;
            page.classList.toggle('is-active', isActive);
            if (isActive) {
                page.removeAttribute('hidden');
            } else {
                page.setAttribute('hidden', '');
            }
        });

        tabs.forEach((tab, i) => {
            const isActive = i === currentIndex;
            tab.classList.toggle('is-active', isActive);
            tab.setAttribute('aria-selected', String(isActive));
        });

        dots.forEach((dot, i) => {
            dot.classList.toggle('is-active', i === currentIndex);
        });

        if (currentPageEl) {
            currentPageEl.textContent = String(currentIndex + 1);
        }

        if (prevBtn) {
            prevBtn.disabled = currentIndex === 0;
        }

        if (nextBtn) {
            nextBtn.disabled = currentIndex === pages.length - 1;
        }
    };

    tabs.forEach((tab, idx) => {
        tab.addEventListener('click', () => setPage(idx));
    });

    dots.forEach((dot, idx) => {
        dot.addEventListener('click', () => setPage(idx));
    });

    if (prevBtn) {
        prevBtn.addEventListener('click', () => setPage(currentIndex - 1));
    }

    if (nextBtn) {
        nextBtn.addEventListener('click', () => setPage(currentIndex + 1));
    }

    setPage(0);

    return {
        setPage,
        getCurrentIndex: () => currentIndex
    };
};

export const initGenerator = () => {
    const modal = elements.generatorModal || $('generator-modal');
    const openBtn = elements.generatorBtn || $('generator-btn');

    if (!modal) return;

    let isSetup = false;
    let docsPagination = null;
    let modalContent = null;
    let toggleDocs = () => {};
    let updatePreview = () => {};

    const closeModal = () => {
        modal.classList.add('is-hidden');
        toggleDocs(false);
        if (window.location.pathname === '/generator') {
            window.history.pushState({}, '', '/');
        }
    };

    const ensureGeneratorSetup = () => {
        if (isSetup) return;
        isSetup = true;

        hydrateModal(modal);

        docsPagination = initDocsPagination(modal);

        const closeBtn = $('close-generator-btn');
        const sourcesInput = $('gen-sources-input');
        const sourcesListEl = $('gen-sources-list');
        const sourcesCountEl = $('gen-sources-count');
        const sourceBadgeEl = $('gen-source-badge');
        const countInput = $('gen-count-input');
        const actionSelect = $('gen-action-type');
        const shuffleCheck = $('gen-shuffle');
        const modeSelect = $('gen-mode');
        const autoRollCheck = $('gen-autoroll');
        const formatCheck = $('gen-format');
        const labelInput = $('gen-label-input');
        const useActiveBtn = $('gen-use-active-btn');
        const resultUrlEl = $('gen-result-url');
        const resultHtmlEl = $('gen-result-html');
        const resultMarkdownEl = $('gen-result-markdown');
        const testLinkEl = $('gen-test-link');
        const copyUrlBtn = $('gen-copy-url-btn');
        const copyHtmlBtn = $('gen-copy-html-btn');
        const copyMarkdownBtn = $('gen-copy-markdown-btn');
        const copyDocsBtn = $('gen-copy-docs-btn');
        const docsToggleBtn = $('gen-toggle-docs-btn');
        const docsPane = $('gen-docs-pane');
        const advancedToggle = $('gen-advanced-toggle');
        const advancedPanel = $('gen-advanced-panel');
        const presetBtns = Array.from(modal.querySelectorAll('.generator-preset-btn'));

        modalContent = modal.querySelector('.modal-content--generator');

        if (closeBtn) closeBtn.addEventListener('click', closeModal);

        if (sourcesListEl) {
            sourcesListEl.addEventListener('click', (e) => {
                const removeBtn = e.target.closest('.generator-source-remove-btn');
                if (!removeBtn || !sourcesInput) return;
                const targetNormalized = removeBtn.getAttribute('data-remove');
                if (!targetNormalized) return;

                const currentTokens = sourcesInput.value
                    .split(/[\n,]+/)
                    .map(t => t.trim())
                    .filter(Boolean);

                const remaining = currentTokens.filter(t => normalizeItem(t) !== targetNormalized);
                sourcesInput.value = remaining.join(', ');
                updatePreview();
            });
        }

        toggleDocs = (forceState) => {
            if (!docsPane || !modalContent) return;
            const isCurrentlyOpen = modalContent.classList.contains('has-docs-open');
            const nextOpen = typeof forceState === 'boolean' ? forceState : !isCurrentlyOpen;

            modalContent.classList.toggle('has-docs-open', nextOpen);
            docsPane.setAttribute('aria-hidden', String(!nextOpen));
            if (docsToggleBtn) {
                docsToggleBtn.setAttribute('aria-expanded', String(nextOpen));
                docsToggleBtn.classList.toggle('is-active', nextOpen);
                docsToggleBtn.setAttribute(
                    'title',
                    nextOpen
                        ? 'Collapse Documentation (Closes to left)'
                        : 'Toggle Documentation (Expands right)'
                );
            }
        };

        if (docsToggleBtn) {
            docsToggleBtn.addEventListener('click', () => toggleDocs());
        }

        const syncPresetButtons = () => {
            const isJson = formatCheck && formatCheck.checked;
            const action = actionSelect ? actionSelect.value : 'redirect';
            let activePreset = null;
            if (isJson) {
                activePreset = 'json';
            } else if (action === 'app') {
                activePreset = 'app';
            } else if (action === 'redirect') {
                activePreset = 'redirect';
            }
            presetBtns.forEach(btn => {
                btn.classList.toggle('is-active', btn.dataset.preset === activePreset);
            });
        };

        const applyPreset = (presetName) => {
            if (presetName === 'redirect') {
                if (actionSelect) actionSelect.value = 'redirect';
                if (formatCheck) formatCheck.checked = false;
            } else if (presetName === 'app') {
                if (actionSelect) actionSelect.value = 'app';
                if (formatCheck) formatCheck.checked = false;
            } else if (presetName === 'json') {
                if (actionSelect) actionSelect.value = 'redirect';
                if (formatCheck) formatCheck.checked = true;
            }
            if (shuffleCheck) shuffleCheck.checked = false;
            presetBtns.forEach(btn => {
                btn.classList.toggle('is-active', btn.dataset.preset === presetName);
            });
            updatePreview();
        };

        presetBtns.forEach(btn => {
            btn.addEventListener('click', () => applyPreset(btn.dataset.preset));
        });

        if (advancedToggle && advancedPanel) {
            const stateLabel = advancedToggle.querySelector('.generator-advanced-state-label');
            advancedToggle.addEventListener('click', () => {
                const isExpanded = advancedToggle.getAttribute('aria-expanded') === 'true';
                const nextExpanded = !isExpanded;
                advancedToggle.setAttribute('aria-expanded', String(nextExpanded));
                advancedPanel.classList.toggle('is-hidden', isExpanded);
                if (stateLabel) {
                    stateLabel.textContent = nextExpanded ? 'Hide' : 'Show';
                }
            });
        }

        updatePreview = () => {
            const rawSources = sourcesInput ? sourcesInput.value : '';
            const out = buildGeneratorOutput({
                sources: rawSources,
                count: countInput && countInput.value ? parseInt(countInput.value, 10) : null,
                actionType: actionSelect ? actionSelect.value : 'redirect',
                shuffle: shuffleCheck ? shuffleCheck.checked : false,
                mode: modeSelect ? modeSelect.value : 'proportional',
                autoRoll: autoRollCheck ? autoRollCheck.checked : true,
                format: formatCheck && formatCheck.checked ? 'json' : 'default',
                label: labelInput ? labelInput.value : 'Random Movie',
                origin: window.location.origin
            });

            if (resultUrlEl) resultUrlEl.textContent = out.url;
            if (resultHtmlEl) resultHtmlEl.textContent = out.html;
            if (resultMarkdownEl) resultMarkdownEl.textContent = out.markdown;
            if (testLinkEl) {
                testLinkEl.href = out.url;
            }

            const parsedSources = parseSourceTokens(rawSources);
            renderSourceList(sourcesListEl, sourcesCountEl, sourceBadgeEl, parsedSources);

            syncPresetButtons();
        };

        if (useActiveBtn) {
            useActiveBtn.addEventListener('click', () => {
                const fieldInputs = Array.from(document.querySelectorAll('.field__input'))
                    .map(input => input.value.trim())
                    .filter(Boolean);
                if (fieldInputs.length > 0 && sourcesInput) {
                    sourcesInput.value = fieldInputs.join(', ');
                    const randomToggle = elements.randomToggle || $('random-toggle');
                    if (shuffleCheck && randomToggle) {
                        shuffleCheck.checked = randomToggle.checked;
                    }
                    updatePreview();
                    displayToast('Imported active lists from form');
                } else {
                    displayToast('No lists currently entered in form');
                }
            });
        }

        const interactiveEls = [
            sourcesInput,
            countInput,
            actionSelect,
            shuffleCheck,
            modeSelect,
            autoRollCheck,
            formatCheck,
            labelInput
        ];

        interactiveEls.forEach(el => {
            if (el) {
                el.addEventListener('input', updatePreview);
                el.addEventListener('change', updatePreview);
            }
        });

        const handleCopy = (btn, text, label) => {
            if (!text) return;
            copyToClipboard(text, `${label} copied to clipboard`);
            const originalHtml = btn.innerHTML;
            btn.innerHTML = '<i data-lucide="check"></i> Copied!';
            refreshIcons(btn);
            setTimeout(() => {
                btn.innerHTML = originalHtml;
                refreshIcons(btn);
            }, 1500);
        };

        if (copyUrlBtn) {
            copyUrlBtn.addEventListener('click', () => {
                if (resultUrlEl) handleCopy(copyUrlBtn, resultUrlEl.textContent, 'URL');
            });
        }

        if (copyHtmlBtn) {
            copyHtmlBtn.addEventListener('click', () => {
                if (resultHtmlEl) handleCopy(copyHtmlBtn, resultHtmlEl.textContent, 'HTML snippet');
            });
        }

        if (copyMarkdownBtn) {
            copyMarkdownBtn.addEventListener('click', () => {
                if (resultMarkdownEl) handleCopy(copyMarkdownBtn, resultMarkdownEl.textContent, 'Markdown snippet');
            });
        }

        if (copyDocsBtn) {
            copyDocsBtn.addEventListener('click', () => {
                handleCopy(copyDocsBtn, GENERATOR_DOCS_MARKDOWN, 'Documentation');
            });
        }
    };

    const openModal = () => {
        ensureGeneratorSetup();
        modal.classList.remove('is-hidden');
        updatePreview();
        const currentParams = new URLSearchParams(window.location.search);
        if (currentParams.has('docs')) {
            toggleDocs(true);
        } else {
            toggleDocs(false);
        }
    };

    if (openBtn) openBtn.addEventListener('click', openModal);

    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal();
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !modal.classList.contains('is-hidden')) {
            closeModal();
            return;
        }
        if (
            docsPagination &&
            modalContent &&
            modalContent.classList.contains('has-docs-open') &&
            !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)
        ) {
            if (e.key === 'ArrowRight') {
                docsPagination.setPage(docsPagination.getCurrentIndex() + 1);
            } else if (e.key === 'ArrowLeft') {
                docsPagination.setPage(docsPagination.getCurrentIndex() - 1);
            }
        }
    });

    // Auto-open if navigating directly to /generator or ?generator=1
    const params = new URLSearchParams(window.location.search);
    if (window.location.pathname === '/generator' || params.has('generator')) {
        openModal();
    }
};
