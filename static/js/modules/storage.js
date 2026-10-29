export const getHistory = () => JSON.parse(localStorage.getItem('lb_history') || '[]');
export const getLists = () => JSON.parse(localStorage.getItem('lb_recent_lists') || '[]');

export const saveHistory = (data) => {
    if (getHistoryDisabled()) return;
    const h = getHistory();
    const newHistory = [{...data, timestamp: Date.now()}, ...h].slice(0, 4);
    localStorage.setItem('lb_history', JSON.stringify(newHistory));
};

export const saveRecentLists = (urls) => {
    if (getHistoryDisabled()) return;
    const l = getLists();
    urls.forEach(url => {
        if (!l.includes(url)) l.unshift(url);
    });
    localStorage.setItem('lb_recent_lists', JSON.stringify(l.slice(0, 5)));
};

export const clearHistory = () => localStorage.removeItem('lb_history');
export const clearRecentLists = () => localStorage.removeItem('lb_recent_lists');

export const getSamplingMode = () => localStorage.getItem('lb_sampling_mode') || 'proportional';
export const saveSamplingMode = (mode) => localStorage.setItem('lb_sampling_mode', mode);

export const getRandomMode = () => localStorage.getItem('lb_random_mode') || 'custom';
export const saveRandomMode = (mode) => localStorage.setItem('lb_random_mode', mode);

export const getHistoryDisabled = () => localStorage.getItem('lb_history_disabled') === 'true';
export const saveHistoryDisabled = (enabled) => localStorage.setItem('lb_history_disabled', enabled ? 'true' : 'false');

export const getDebugMode = () => localStorage.getItem('movie_roulette_debug') === 'true';
export const saveDebugMode = (enabled) => localStorage.setItem('movie_roulette_debug', enabled ? 'true' : 'false');

export const getTranslucentMode = () => localStorage.getItem('movie_roulette_translucent') !== 'false';
export const saveTranslucentMode = (enabled) => localStorage.setItem('movie_roulette_translucent', enabled ? 'true' : 'false');

