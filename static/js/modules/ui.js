import { $, elements } from './dom.js';
import { getHistory, getLists } from './storage.js';
import { escapeHtml } from './utils.js';
import { createHistoryItem } from '../components/HistoryItem.js';
import { createRecentListItem } from '../components/RecentListItem.js';

const formatTime = (ts) => {
    if (!ts) return '';
    const diff = Math.floor((Date.now() - ts) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
    if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
    return new Date(ts).toLocaleDateString([], { month: 'short', day: 'numeric' });
};

export const renderHistory = (useListCallback) => {
    const hist = getHistory();
    const lists = getLists();
    
    // Toggle grid visibility if anything exists
    $('history-grid').classList.toggle('is-hidden', hist.length === 0 && lists.length === 0);
    
    $('history-section').classList.toggle('is-hidden', hist.length === 0);
    elements.historyList.innerHTML = hist.map(item => createHistoryItem(item, formatTime)).join('');

    const currentInputs = Array.from($('randomize-form').querySelectorAll('input')).map(i => i.value.trim());
    const listSection = $('recent-lists-section');
    const listTarget = $('recent-lists-list');
    listSection.classList.toggle('is-hidden', lists.length === 0);
    
    // Build lists HTML first
    listTarget.innerHTML = lists.map(url => {
        const activeIndex = currentInputs.indexOf(url);
        return createRecentListItem(url, activeIndex);
    }).join('');

    // Reset any lingering pending-removal states
    document.querySelectorAll('.field.is-pending-removal').forEach(field => {
        field.classList.remove('is-pending-removal');
    });

    const setPendingRemoval = (url, isPending) => {
        if (!url) return;
        const form = $('randomize-form');
        if (!form) return;
        const inputs = form.querySelectorAll('.field__input');
        inputs.forEach(input => {
            if (input.value.trim() === url) {
                const field = input.closest('.field');
                if (field) {
                    field.classList.toggle('is-pending-removal', isPending);
                }
            }
        });
    };

    // Attach event listeners instead of inline onclick handlers
    const listItems = listTarget.querySelectorAll('.history-item');
    listItems.forEach(item => {
        const url = item.getAttribute('data-url');
        const isActive = item.classList.contains('is-active-list');

        const handleAction = () => {
            setPendingRemoval(url, false);
            useListCallback(url);
        };

        item.addEventListener('click', handleAction);
        item.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleAction();
            }
        });

        if (isActive) {
            item.addEventListener('mouseenter', () => setPendingRemoval(url, true));
            item.addEventListener('mouseleave', () => setPendingRemoval(url, false));
            item.addEventListener('focus', () => setPendingRemoval(url, true));
            item.addEventListener('blur', () => setPendingRemoval(url, false));
        }
    });

    if (window.lucide) window.lucide.createIcons();
};

const encodeTextFragment = (text) => {
    if (!text) return '';
    return encodeURIComponent(text)
        .replace(/-/g, '%2D')
        .replace(/,/g, '%2C');
};

const getListHighlightUrl = (list, movie, page = 1) => {
    if (!list || !list.user) return null;
    const isWatchlist = list.is_watchlist !== undefined ? list.is_watchlist : list.slug === 'watchlist';
    const pagePart = page && page > 1 ? `page/${page}/` : '';
    
    if (isWatchlist) {
        const hash = movie?.slug ? `#${movie.slug}` : '';
        return `https://letterboxd.com/${list.user}/watchlist/${pagePart}${hash}`;
    }
    
    const targetText = movie?.name ? `${movie.name}${movie.year || ''}` : '';
    const fragment = targetText ? `#:~:text=${encodeTextFragment(targetText)}` : '';
    return `https://letterboxd.com/${list.user}/list/${list.slug}/detail/${pagePart}${fragment}`;
};

export const renderResult = (data) => {
    // 1. Text & Links
    const listHighlightUrl = getListHighlightUrl(data.list, data.movie, data.page || data.list?.page || 1);

    // Render name and year inline (like Letterboxd)
    elements.resMovie.innerHTML = `${escapeHtml(data.movie.name)} <span class="result-year">${data.movie.year ? escapeHtml(data.movie.year) : ''}</span>`;
    
    if (listHighlightUrl) {
        elements.resMeta.innerHTML = `from <a href="${listHighlightUrl}" target="_blank" rel="noopener" class="result-list-link" title="Open in Letterboxd list with highlight">${escapeHtml(data.list.title)}</a>`;
    } else {
        elements.resMeta.innerHTML = `from ${escapeHtml(data.list.title)}`;
    }
    
    // Director (immediately under meta, styled inline/beautifully)
    if (elements.resDirector) {
        if (data.movie.directors?.length) {
            const directorLinks = data.movie.directors.map(d => 
                d.url ? `<a href="${d.url}" target="_blank" rel="noopener" class="detail-link">${escapeHtml(d.name)}</a>` : escapeHtml(d.name)
            ).join(', ');
            elements.resDirector.innerHTML = `<span class="detail-label">Directed by</span> ${directorLinks}`;
            elements.resDirector.classList.remove('is-hidden');
        } else {
            elements.resDirector.classList.add('is-hidden');
        }
    }

    // Tagline
    if (data.movie.tagline) {
        elements.resTagline.textContent = data.movie.tagline;
        elements.resTagline.classList.add('is-visible');
    } else {
        elements.resTagline.classList.remove('is-visible');
    }

    // Description
    elements.resDescription.textContent = data.movie.description || '';

    // Director, Cast, Genres section toggle
    const hasDetails = data.movie.cast?.length || data.movie.genres?.length;
    if (elements.resDetails) {
        elements.resDetails.classList.toggle('is-hidden', !hasDetails);
    }

    if (elements.resCast) {
        if (data.movie.cast?.length) {
            const castLinks = data.movie.cast.map(c => 
                c.url ? `<a href="${c.url}" target="_blank" rel="noopener" class="detail-link">${escapeHtml(c.name)}</a>` : escapeHtml(c.name)
            ).join(', ');
            elements.resCast.innerHTML = `<span class="detail-label">Cast</span> ${castLinks}`;
            elements.resCast.classList.remove('is-hidden');
        } else {
            elements.resCast.classList.add('is-hidden');
        }
    }

    if (elements.resGenres) {
        if (data.movie.genres?.length) {
            elements.resGenres.innerHTML = data.movie.genres.map(g =>
                g.url ? `<a href="${g.url}" target="_blank" rel="noopener" class="genre-pill">${escapeHtml(g.name)}</a>` : `<span class="genre-pill">${escapeHtml(g.name)}</span>`
            ).join('');
            elements.resGenres.classList.remove('is-hidden');
        } else {
            elements.resGenres.classList.add('is-hidden');
        }
    }

    elements.resLink.href = data.movie.url;
    elements.resPosterLink.href = data.movie.url;
    if (elements.resListLink) {
        if (listHighlightUrl) {
            elements.resListLink.href = listHighlightUrl;
            const btnText = elements.resListLink.querySelector('.btn-text');
            if (btnText) {
                btnText.textContent = data.list.slug === 'watchlist' ? 'Watchlist' : 'View in List';
            }
            elements.resListLink.title = data.list.slug === 'watchlist'
                ? 'Open watchlist page in Letterboxd'
                : 'View film highlighted in source list';
            elements.resListLink.classList.remove('is-hidden');
        } else {
            elements.resListLink.classList.add('is-hidden');
        }
    }
    
    // 2. Stars rendering
    if (data.movie.rating) {
        const rating = parseFloat(data.movie.rating);
        let starsHtml = '';
        for (let i = 1; i <= 5; i++) {
            if (rating >= i) starsHtml += '<i data-lucide="star" class="star-full"></i>';
            else if (rating >= i - 0.5) starsHtml += '<i data-lucide="star-half" class="star-half"></i>';
            else starsHtml += '<i data-lucide="star" class="star-empty"></i>';
        }
        elements.resStars.innerHTML = `${starsHtml} <span class="result-rating-num">${rating.toFixed(2)}</span>`;
        elements.resStars.classList.remove('is-hidden');
    } else {
        elements.resStars.classList.add('is-hidden');
    }

    // 3. Poster
    if (data.movie.poster) {
        if (data.movie.poster.includes('-0-600-0-900-crop')) {
            const smallPoster = data.movie.poster.replace('-0-600-0-900-crop', '-0-250-0-375-crop');
            elements.resPoster.srcset = `${smallPoster} 250w, ${data.movie.poster} 600w`;
            elements.resPoster.sizes = '(max-width: 480px) 125px, 120px';
            elements.resPoster.src = smallPoster;
        } else {
            elements.resPoster.removeAttribute('srcset');
            elements.resPoster.removeAttribute('sizes');
            elements.resPoster.src = data.movie.poster;
        }
        elements.resPoster.classList.remove('is-hidden');
    } else {
        elements.resPoster.removeAttribute('srcset');
        elements.resPoster.removeAttribute('sizes');
        elements.resPoster.src = '';
        elements.resPoster.classList.add('is-hidden');
    }

    // 4. Layout adjustment when no details are present (to horizontally center the poster)
    const hasAnyDetails = !!(data.movie.tagline || data.movie.description || data.movie.cast?.length || data.movie.genres?.length);
    if (elements.resInfo) {
        elements.resInfo.classList.toggle('is-hidden', !hasAnyDetails);
    }
    if (elements.resBodyBlock) {
        elements.resBodyBlock.classList.toggle('has-no-details', !hasAnyDetails);
    }
    
    // 4. Stats
    if (elements.statPool) elements.statPool.textContent = data.stats.total_pool.toLocaleString();
    if (elements.statProb) elements.statProb.textContent = data.stats.probability;

    // Trigger contextual notification from stats button with a slight delay
    const popToast = $('stats-pop-toast');
    if (popToast) {
        popToast.textContent = `Chosen from ${data.stats.total_pool.toLocaleString()} movies (${data.stats.probability}%)`;
        popToast.classList.remove('is-active', 'is-closing');
        
        if (window.statsPopTimeout) clearTimeout(window.statsPopTimeout);
        
        // Wait for result view transition to finish
        setTimeout(() => {
            popToast.classList.add('is-active');
            
            window.statsPopTimeout = setTimeout(() => {
                popToast.classList.remove('is-active');
                popToast.classList.add('is-closing');
                
                // Trigger swallow/gulp effect on the icon when toast arrives
                setTimeout(() => {
                    const btn = $('stats-btn');
                    if (btn) {
                        btn.classList.add('is-gulping');
                        setTimeout(() => btn.classList.remove('is-gulping'), 600);
                    }
                    popToast.classList.remove('is-closing');
                }, 450);
            }, 4000);
        }, 400);
    }

    // 5. Tech Cache
    window.lastResultData = {
        movie: data.movie.name,
        slug: data.movie.slug,
        rating: data.movie.rating,
        stats: data.stats
    };

    renderStatsModal(data);
    if (window.lucide) window.lucide.createIcons();
};

export const initStatsTabs = () => {
    const btnOverview = $('tab-btn-overview');
    const btnRaw = $('tab-btn-raw');
    const panelOverview = $('stats-tab-overview');
    const panelRaw = $('stats-tab-raw');

    if (!btnOverview || !btnRaw || !panelOverview || !panelRaw) return;

    btnOverview.addEventListener('click', () => {
        btnOverview.classList.add('is-active');
        btnOverview.setAttribute('aria-selected', 'true');
        btnRaw.classList.remove('is-active');
        btnRaw.setAttribute('aria-selected', 'false');

        panelOverview.classList.remove('is-hidden');
        panelRaw.classList.add('is-hidden');
    });

    btnRaw.addEventListener('click', () => {
        btnRaw.classList.add('is-active');
        btnRaw.setAttribute('aria-selected', 'true');
        btnOverview.classList.remove('is-active');
        btnOverview.setAttribute('aria-selected', 'false');

        panelRaw.classList.remove('is-hidden');
        panelOverview.classList.add('is-hidden');
    });
};

export const renderStatsModal = (data) => {
    if (!data || !data.stats) return;

    // 1. KPI Cards
    const kpiPool = $('stats-kpi-pool');
    const kpiOdds = $('stats-kpi-odds');
    const kpiOddsSub = $('stats-kpi-odds-sub');
    const kpiLatency = $('stats-kpi-latency');
    const kpiLatencySub = $('stats-kpi-latency-sub');
    const kpiSource = $('stats-kpi-source');
    const kpiSourceSub = $('stats-kpi-source-sub');

    const totalPool = data.stats.total_pool || 0;
    const timing = data.stats.timing || {};

    if (kpiPool) kpiPool.textContent = totalPool.toLocaleString();
    if (kpiOdds) kpiOdds.textContent = `${data.stats.probability}%`;
    if (kpiOddsSub) kpiOddsSub.textContent = data.stats.odds || `1 in ${totalPool.toLocaleString()}`;
    if (kpiLatency) kpiLatency.textContent = timing.total ? `${timing.total}s` : '-';
    if (kpiLatencySub) kpiLatencySub.textContent = timing.metadata ? `meta: ${timing.metadata}s` : 'end-to-end';
    
    if (kpiSource) {
        kpiSource.textContent = data.list ? (data.list.title || data.list.slug) : 'Letterboxd';
        kpiSource.title = kpiSource.textContent;
    }
    if (kpiSourceSub) {
        const typeLabel = data.list?.is_watchlist ? 'Watchlist' : 'List';
        kpiSourceSub.textContent = data.list ? `@${data.list.user} · ${typeLabel}` : 'random selection';
    }

    // 2. Pipeline Waterfall
    const waterfallEl = $('stats-waterfall');
    const totalTimeEl = $('stats-total-time');
    if (totalTimeEl) totalTimeEl.textContent = timing.total ? `${timing.total}s total` : '';

    if (waterfallEl) {
        const totalNum = parseFloat(timing.total) || 1;
        const metaTime = parseFloat(timing.metadata) || 0;
        const selectTime = parseFloat(timing.selection) || 0;
        const detailTime = parseFloat(timing.details) || 0;

        const isEqualMode = data.stats.sampling_mode === 'equal';
        const steps = [
            { label: '1. Metadata & Pool Fetch', time: metaTime },
            { label: isEqualMode ? '2. Equal Odds List Selection' : '2. Weighted Random Selection', time: selectTime },
            { label: '3. Film Profile Enrichment', time: detailTime }
        ];

        waterfallEl.innerHTML = steps.map(step => {
            const pct = Math.min(100, Math.max(10, Math.round((step.time / totalNum) * 100)));
            return `
                <div class="waterfall-row">
                    <div class="waterfall-info">
                        <span class="waterfall-name">${step.label}</span>
                        <span class="waterfall-time">${step.time.toFixed(2)}s</span>
                    </div>
                    <div class="waterfall-track">
                        <div class="waterfall-bar" style="width: ${pct}%"></div>
                    </div>
                </div>
            `;
        }).join('');
    }

    // 3. Pool Distribution
    const sourcesListEl = $('stats-sources-list');
    const poolMetaEl = $('stats-pool-meta');
    const lists = data.stats.lists || [];
    const modeTag = data.stats.sampling_mode === 'equal' ? ' (Equal Odds)' : ' (Proportional)';
    if (poolMetaEl) poolMetaEl.textContent = `${lists.length} source${lists.length === 1 ? '' : 's'}${modeTag}`;

    if (sourcesListEl) {
        if (lists.length === 0 && data.list) {
            const typeLabel = data.list.is_watchlist ? 'Watchlist' : 'List';
            sourcesListEl.innerHTML = `
                <div class="source-item is-winner">
                    <div class="source-item-header">
                        <div class="source-item-title-group">
                            <span class="source-item-title">${escapeHtml(data.list.title || data.list.slug)}</span>
                            <span class="source-item-user">@${escapeHtml(data.list.user)}</span>
                        </div>
                        <div class="source-item-badges">
                            <span class="stats-badge stats-badge--type">${typeLabel}</span>
                            <span class="stats-badge stats-badge--winner"><i data-lucide="check"></i> Winner</span>
                            <span class="stats-badge stats-badge--count">${totalPool.toLocaleString()} films (100%)</span>
                        </div>
                    </div>
                    <div class="source-track">
                        <div class="source-bar source-bar--winner" style="width: 100%"></div>
                    </div>
                </div>
            `;
        } else {
            sourcesListEl.innerHTML = lists.map(l => {
                const isSelected = l.is_winner;
                const typeLabel = l.is_watchlist ? 'Watchlist' : 'List';
                return `
                    <div class="source-item ${isSelected ? 'is-winner' : ''}">
                        <div class="source-item-header">
                            <div class="source-item-title-group">
                                <span class="source-item-title">${escapeHtml(l.title)}</span>
                                <span class="source-item-user">@${escapeHtml(l.user)}</span>
                            </div>
                            <div class="source-item-badges">
                                <span class="stats-badge stats-badge--type">${typeLabel}</span>
                                ${isSelected ? '<span class="stats-badge stats-badge--winner"><i data-lucide="check"></i> Winner</span>' : ''}
                                <span class="stats-badge stats-badge--count">${l.count.toLocaleString()} films (${l.percentage}%)</span>
                            </div>
                        </div>
                        <div class="source-track">
                            <div class="source-bar ${isSelected ? 'source-bar--winner' : ''}" style="width: ${l.percentage}%"></div>
                        </div>
                    </div>
                `;
            }).join('');
        }
    }

    // 4. Movie Specs Grid
    const specsEl = $('stats-specs-grid');
    if (specsEl && data.movie) {
        const m = data.movie;
        const genresStr = m.genres ? (Array.isArray(m.genres) ? m.genres.map(g => g.name || g).join(', ') : m.genres) : '-';
        const directorsStr = m.directors?.length ? m.directors.map(d => d.name || d).join(', ') : (m.director || 'N/A');
        specsEl.innerHTML = `
            <div class="spec-tile">
                <span class="spec-label">Title & Year</span>
                <span class="spec-val">${escapeHtml(m.name)} (${escapeHtml(m.year || 'N/A')})</span>
            </div>
            <div class="spec-tile">
                <span class="spec-label">Director</span>
                <span class="spec-val">${escapeHtml(directorsStr)}</span>
            </div>
            <div class="spec-tile">
                <span class="spec-label">Rating</span>
                <span class="spec-val">${m.rating ? `★ ${escapeHtml(m.rating)}` : 'Unrated'}</span>
            </div>
            <div class="spec-tile">
                <span class="spec-label">Genres</span>
                <span class="spec-val">${escapeHtml(genresStr)}</span>
            </div>
            <div class="spec-tile spec-tile--full">
                <span class="spec-label">Letterboxd Link</span>
                <a class="spec-val spec-link" href="${m.url || `https://letterboxd.com/film/${m.slug}/`}" target="_blank" rel="noopener">
                    ${escapeHtml(m.slug)} <i data-lucide="external-link"></i>
                </a>
            </div>
        `;
    }

    // 5. Raw JSON
    const jsonEl = $('stats-json');
    if (jsonEl) {
        const fullAuditData = {
            selected_film: {
                title: data.movie.name,
                year: data.movie.year,
                slug: data.movie.slug,
                rating: data.movie.rating,
                director: data.movie.directors?.length ? data.movie.directors.map(d => d.name || d).join(', ') : (data.movie.director || null),
                genres: data.movie.genres ? data.movie.genres.map(g => g.name || g) : [],
                letterboxd_url: data.movie.url || `https://letterboxd.com/film/${data.movie.slug}/`
            },
            sampling_math: {
                total_pool: totalPool,
                sampling_mode: data.stats.sampling_mode || 'proportional',
                probability_percent: Number(data.stats.probability),
                odds: data.stats.odds || `1 in ${totalPool.toLocaleString()}`,
                selected_from: data.list ? {
                    title: data.list.title || data.list.slug,
                    user: data.list.user,
                    slug: data.list.slug,
                    is_watchlist: Boolean(data.list.is_watchlist),
                    type: data.list.is_watchlist ? 'watchlist' : 'list'
                } : 'unknown'
            },
            pool_breakdown: lists,
            pipeline_timings_sec: timing,
            execution: {
                timestamp: data.stats.timestamp || new Date().toISOString(),
                input_sources: data.stats.inputs || []
            }
        };
        jsonEl.textContent = JSON.stringify(fullAuditData, null, 2);
    }

    if (window.lucide) window.lucide.createIcons();
};

export const setView = (view) => {
    elements.infoModal.classList.toggle('is-hidden', view !== 'info');
    elements.statsModal.classList.toggle('is-hidden', view !== 'stats');
    elements.formArea.classList.toggle('is-hidden', view !== 'form');
    elements.loadingArea.classList.toggle('is-hidden', view !== 'loading');
    elements.resultArea.classList.toggle('is-hidden', view !== 'result');
};

export const showToast = (msg, type = 'error') => {
    if (!elements.error || !elements.errorText) return;
    
    elements.errorText.textContent = msg;
    elements.error.classList.remove('type-info', 'type-error');
    elements.error.classList.add(`type-${type}`);
    elements.error.classList.add('is-active');
    
    const iconName = type === 'error' ? 'alert-circle' : 'info';
    const icon = elements.error.querySelector('[data-lucide], svg.lucide');
    if (icon) {
        if (icon.tagName.toLowerCase() === 'svg') {
            const newIcon = document.createElement('i');
            newIcon.setAttribute('data-lucide', iconName);
            icon.replaceWith(newIcon);
        } else {
            icon.setAttribute('data-lucide', iconName);
        }
        if (window.lucide) window.lucide.createIcons();
    }

    if (window.toastTimeout) clearTimeout(window.toastTimeout);
    window.toastTimeout = setTimeout(() => {
        elements.error.classList.remove('is-active');
    }, 4000);
};

export const hideToast = () => {
    if (elements.error) elements.error.classList.remove('is-active');
};

export const updateBackdrop = (url) => {
    if (!elements.backdrop || !elements.backdropImg) return;

    if (url) {
        // Start fade out current backdrop if any
        elements.backdrop.classList.remove('loaded');

        // Preload new image
        const img = new Image();
        img.src = url;
        img.onload = () => {
            elements.backdropImg.style.backgroundImage = `url('${url}')`;
            elements.backdrop.classList.add('loaded');
        };
    } else {
        elements.backdrop.classList.remove('loaded');
        setTimeout(() => {
            if (!elements.backdrop.classList.contains('loaded')) {
                elements.backdropImg.style.backgroundImage = 'none';
            }
        }, 1000);
    }
};

export const updateShareButtonText = (urlCount) => {
    const shareBtn = $('share-blend-btn');
    const btnTextNode = shareBtn?.querySelector('.btn-text');
    if (shareBtn && btnTextNode) {
        const isMix = urlCount > 1;
        btnTextNode.textContent = isMix ? 'Share this Mix' : 'Share';
        shareBtn.title = isMix ? 'Share this Mix' : 'Share';
    }
};
