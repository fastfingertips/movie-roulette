import { $, elements } from './dom.js';
import { escapeHtml, copyToClipboard } from './utils.js';

let lastResult = null;

export const initStatsModal = (setView) => {
    const btnOverview = $('tab-btn-overview');
    const btnRaw = $('tab-btn-raw');
    const panelOverview = $('stats-tab-overview');
    const panelRaw = $('stats-tab-raw');

    if (btnOverview && btnRaw && panelOverview && panelRaw) {
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
    }

    if (elements.statsBtn) {
        elements.statsBtn.addEventListener('click', () => {
            if (lastResult) {
                setView('stats');
            }
        });
    }

    const closeBtn = $('close-stats-btn');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => setView('result'));
    }

    if (elements.statsModal) {
        elements.statsModal.addEventListener('click', (e) => {
            if (e.target === elements.statsModal) setView('result');
        });
    }

    if (elements.copyStatsBtn && elements.statsJson) {
        elements.copyStatsBtn.addEventListener('click', async () => {
            const success = await copyToClipboard(elements.statsJson.textContent);
            if (success) {
                const originalText = elements.copyStatsBtn.innerHTML;
                elements.copyStatsBtn.innerHTML = '<i data-lucide="check"></i> Copied!';
                if (window.lucide) window.lucide.createIcons();
                setTimeout(() => {
                    elements.copyStatsBtn.innerHTML = originalText;
                    if (window.lucide) window.lucide.createIcons();
                }, 2000);
            }
        });
    }
};

export const renderStatsModal = (data) => {
    if (!data || !data.stats) return;
    lastResult = data;

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
};
