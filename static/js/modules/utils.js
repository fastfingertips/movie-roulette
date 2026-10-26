/** Slugs that represent Letterboxd profile sections, not user identifiers */
export const RESERVED_SLUGS = ['films', 'following', 'followers', 'reviews', 'lists', 'activity', 'members'];

/** Strip the Letterboxd origin + trailing slashes from a URL/slug */
export const stripOrigin = (raw) =>
    String(raw || '').trim().toLowerCase()
        .replace(/^https?:\/\/(www\.)?letterboxd\.com\//, '')
        .replace(/\/+$/, '');

export const escapeHtml = (str) => {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
};

/**
 * Derive a canonical dedup key from any Letterboxd input.
 *   username          → username/watchlist
 *   username/watchlist → username/watchlist
 *   user/list/slug    → user/list/slug
 *   user/slug         → user/list/slug
 */
export const canonicalKey = (raw) => {
    const val = stripOrigin(raw);
    const parts = val.split('/').filter(Boolean);
    const [user, second, third] = parts;

    if (!user || RESERVED_SLUGS.includes(user)) return null;

    // username  OR  username/watchlist  →  username/watchlist
    if (parts.length <= 2 && (!second || second === 'watchlist')) return `${user}/watchlist`;
    // user/list/slug  →  user/list/slug
    if (parts.length >= 3 && second === 'list') return `${user}/list/${third}`;
    // user/slug (shorthand)  →  user/list/slug
    if (parts.length === 2 && !RESERVED_SLUGS.includes(second)) return `${user}/list/${second}`;

    return null;
};

/**
 * Parse list sources from a query string. Pure: does not touch the DOM or history.
 * Duplicates (by canonical key) are dropped and `user/watchlist` is normalized to `user`.
 * @param {string} search Query string, e.g. window.location.search
 * @param {number} maxUrls Maximum number of sources to return
 * @returns {{urls: string[], shouldRun: boolean, hasDuplicateWatchlist: boolean}}
 */
export const parseUrlParams = (search, maxUrls = 5) => {
    const params = new URLSearchParams(search);
    const rawTokens = [];

    const shouldRun = params.get('run') !== '0' && params.get('auto') !== '0';
    const shouldRedirect = params.get('redirect') === '1' || params.get('redirect') === 'true';
    const randomParam = params.get('random')?.toLowerCase();
    const shuffleParam = params.get('shuffle')?.toLowerCase();
    const randomMode = (shuffleParam === '1' || shuffleParam === 'true' || randomParam === 'letterboxd' || randomParam === 'shuffle')
        ? 'letterboxd'
        : (randomParam === 'custom' || randomParam === 'deep' ? 'custom' : null);

    ['url', 'urls', 'src', 'sources', 'list', 'lists'].forEach(key => {
        params.getAll(key).forEach(val => {
            val.split(',').forEach(v => {
                if (v.trim()) rawTokens.push(v.trim());
            });
        });
    });

    const seenCanonical = new Set();
    const urlsToRun = [];
    let hasDuplicateWatchlist = false;

    rawTokens.forEach(raw => {
        const key = canonicalKey(raw) || raw.toLowerCase();
        if (seenCanonical.has(key)) {
            if (key.endsWith('/watchlist')) hasDuplicateWatchlist = true;
            return;
        }
        seenCanonical.add(key);

        // Normalize watchlist URLs: user/watchlist → username only
        const parts = stripOrigin(raw).split('/');
        if (parts.length === 2 && parts[1] === 'watchlist') {
            hasDuplicateWatchlist = true;
            urlsToRun.push(parts[0]);
        } else {
            urlsToRun.push(raw);
        }
    });

    const debugParam = params.get('debug')?.toLowerCase();
    const isDebug = debugParam === '1' || debugParam === 'true';

    return { urls: urlsToRun.slice(0, maxUrls), shouldRun, shouldRedirect, randomMode, isDebug, hasDuplicateWatchlist };
};

export const formatListUrl = (url) => {
    if (!url) return { name: '', type: '' };
    const val = stripOrigin(url);
    const parts = val.split('/').filter(Boolean);
    
    // Format: user (Watchlist)
    if (parts.length === 1) return { name: parts[0], type: 'Watchlist' };
    // Format: user/watchlist (Watchlist)
    if (parts.length === 2 && parts[1] === "watchlist") return { name: parts[0], type: 'Watchlist' };
    // Format: user/list/slug (user/slug)
    if (parts.length >= 3 && parts[1] === "list") {
        if (parts[2] === "watchlist") {
            return { name: `${parts[0]}/list/watchlist`, type: 'List' };
        }
        return { name: `${parts[0]}/${parts[2]}`, type: 'List' };
    }
    // Format: user/slug (user/slug)
    if (parts.length === 2) return { name: `${parts[0]}/${parts[1]}`, type: 'List' };
    
    return { name: url, type: '' };
};

export const copyToClipboard = async (text) => {
    try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(text);
            return true;
        }
    } catch {
        // Fall back to document.execCommand
    }
    try {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        const successful = document.execCommand('copy');
        document.body.removeChild(textarea);
        return successful;
    } catch {
        return false;
    }
};

export const buildSpinResult = ({
    metaData,
    selectData,
    detailData,
    samplingMode,
    randomMode,
    urls,
    timings,
}) => {
    const isModeEqual = (selectData.mode || samplingMode) === 'equal';
    const resolvedRandomMode = selectData.random_mode || selectData.meta?.strategy || randomMode || 'letterboxd';
    const numLists = (metaData.lists || []).length || 1;
    const selectedListCount = selectData.list?.count || 1;
    const probability = isModeEqual
        ? ((1 / numLists) * (1 / selectedListCount)) * 100
        : (1 / metaData.total) * 100;
    const oddsText = isModeEqual
        ? `1 in ${(numLists * selectedListCount).toLocaleString()} (${numLists} lists × ${selectedListCount.toLocaleString()} films)`
        : `1 in ${metaData.total.toLocaleString()}`;

    return {
        movie: detailData.movie,
        list: selectData.list,
        page: selectData.meta?.page || 1,
        stats: {
            total_pool: metaData.total,
            probability: probability < 0.001 ? probability.toFixed(4) : probability.toFixed(2),
            odds: oddsText,
            sampling_mode: isModeEqual ? 'equal' : 'proportional',
            random_mode: resolvedRandomMode,
            timing: {
                metadata: timings.metadata.toFixed(2),
                selection: timings.selection.toFixed(2),
                details: timings.details.toFixed(2),
                total: timings.total.toFixed(2),
            },
            lists: (metaData.lists || []).map(l => {
                const isWinner = l.user === selectData.list.user
                    && l.slug === selectData.list.slug
                    && (Boolean(l.is_watchlist) === Boolean(selectData.list.is_watchlist));
                return {
                    title: l.title || `${l.user}'s List`,
                    user: l.user,
                    slug: l.slug,
                    count: l.count,
                    is_watchlist: Boolean(l.is_watchlist),
                    type: l.is_watchlist ? 'Watchlist' : 'List',
                    percentage: isModeEqual
                        ? Number((100 / numLists).toFixed(1))
                        : Number(((l.count / metaData.total) * 100).toFixed(1)),
                    is_winner: isWinner,
                };
            }),
            inputs: urls,
            timestamp: new Date().toISOString(),
        },
    };
};
