import { $ } from './dom.js';
import { addField } from './fields.js';

export const checkUrlParams = (onReady) => {
    const params = new URLSearchParams(window.location.search);
    const providedUrls = new Set();
    
    ['url', 'urls', 'list', 'lists'].forEach(key => {
        params.getAll(key).forEach(val => {
            val.split(',').forEach(v => {
                if (v.trim()) providedUrls.add(v.trim());
            });
        });
    });

    const urlsToRun = Array.from(providedUrls).slice(0, 5);
    
    if (urlsToRun.length > 0) {
        const inputs = Array.from($('randomize-form').querySelectorAll('input'));
        
        urlsToRun.forEach((url, index) => {
            if (index === 0) {
                inputs[0].value = url;
            } else {
                addField(() => {}, url);
            }
        });
        
        // Clean up URL to prevent accidental re-runs on refresh
        window.history.replaceState({}, document.title, window.location.pathname);
        
        // Trigger the callback with the extracted URLs
        onReady(urlsToRun);
    }
};

export const formatListUrl = (url) => {
    if (!url) return { name: '', type: '' };
    let val = url.trim().replace(/\/$/, "");
    val = val.replace(/^https?:\/\/(www\.)?letterboxd\.com\//, "");
    
    const parts = val.split("/").filter(p => p);
    
    // Format: user (Watchlist)
    if (parts.length === 1) return { name: parts[0], type: 'Watchlist' };
    // Format: user/watchlist (Watchlist)
    if (parts.length === 2 && parts[1] === "watchlist") return { name: parts[0], type: 'Watchlist' };
    // Format: user/list/slug (user's slug)
    if (parts.length >= 3 && parts[1] === "list") return { name: parts[0], type: parts[2] };
    // Format: user/slug (user's slug)
    if (parts.length === 2) return { name: parts[0], type: parts[1] };
    
    return { name: url, type: '' };
};
