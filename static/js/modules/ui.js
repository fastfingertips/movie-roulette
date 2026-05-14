import { $, elements, showToast } from './dom.js';
import { getHistory, getLists } from './storage.js';
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

    // Attach event listeners instead of inline onclick handlers
    const listItems = listTarget.querySelectorAll('.history-item');
    listItems.forEach(item => {
        item.addEventListener('click', () => {
            useListCallback(item.getAttribute('data-url'));
        });
    });

    if (window.lucide) window.lucide.createIcons();
};

export const renderResult = (data) => {
    // 1. Text & Links
    elements.resMovie.textContent = data.movie.name;
    elements.resMeta.innerHTML = `<strong>${data.movie.year || ''}</strong> from ${data.list.title}`;
    
    // Tagline
    if (data.movie.tagline) {
        elements.resTagline.textContent = data.movie.tagline;
        elements.resTagline.classList.add('is-visible');
    } else {
        elements.resTagline.classList.remove('is-visible');
    }

    // Description
    elements.resDescription.textContent = data.movie.description || '';

    elements.resLink.href = data.movie.url;
    elements.resPosterLink.href = data.movie.url;
    
    // 2. Stars rendering
    if (data.movie.rating) {
        const rating = parseFloat(data.movie.rating);
        let starsHtml = '';
        for (let i = 1; i <= 5; i++) {
            if (rating >= i) starsHtml += '<i data-lucide="star" class="star-full"></i>';
            else if (rating >= i - 0.5) starsHtml += '<i data-lucide="star-half" class="star-half"></i>';
            else starsHtml += '<i data-lucide="star" style="opacity: 0.2;"></i>';
        }
        elements.resStars.innerHTML = `${starsHtml} <span class="result-rating-num">${rating.toFixed(2)}</span>`;
        elements.resStars.classList.remove('is-hidden');
    } else {
        elements.resStars.classList.add('is-hidden');
    }

    // 3. Poster
    if (data.movie.poster) {
        elements.resPoster.src = data.movie.poster;
        elements.resPoster.classList.remove('is-hidden');
    } else {
        elements.resPoster.src = '';
        elements.resPoster.classList.add('is-hidden');
    }
    
    // 4. Stats
    if (elements.statPool) elements.statPool.textContent = data.stats.total_pool.toLocaleString();
    if (elements.statProb) elements.statProb.textContent = data.stats.probability;

    // Trigger notification
    const statsMsg = `Chosen from ${data.stats.total_pool.toLocaleString()} movies (${data.stats.probability}%)`;
    showToast(statsMsg, 'info');

    // 5. Tech Cache
    window.lastResultData = {
        movie: data.movie.name,
        slug: data.movie.slug,
        rating: data.movie.rating,
        stats: data.stats
    };

    if (window.lucide) window.lucide.createIcons();
};

