const parseResponse = async (responsePromiseOrObject, fallbackError) => {
    const res = await responsePromiseOrObject;
    if (!res.ok) {
        const text = await res.text();
        let errorMessage = fallbackError;
        try {
            const errData = JSON.parse(text);
            errorMessage = errData.error || errorMessage;
        } catch {
            errorMessage = `Server Error (${res.status})`;
        }
        throw { userFacing: true, message: errorMessage, status: res.status, raw: text };
    }
    return await res.json();
};

const postJson = async (endpoint, payload, fallbackError) => {
    const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    return parseResponse(res, fallbackError);
};

export const startMetadataFetch = (urls) => fetch('/api/metadata', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ urls })
});

export const parseApiResponse = (responsePromise, fallbackError) => parseResponse(responsePromise, fallbackError);

export const fetchMetadata = (urls) => postJson('/api/metadata', { urls }, 'Metadata failed');

export const selectRandomMovie = (lists, total) => postJson('/api/select', { lists, total }, 'Selection failed');

export const fetchMovieDetails = (slug) => postJson('/api/details', { slug }, 'Details failed');
