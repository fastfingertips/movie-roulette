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

const postJson = async (endpoint, payload, fallbackError, signal = null) => {
    const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: signal || undefined
    });
    return parseResponse(res, fallbackError);
};

export const startMetadataFetch = (urls, signal = null) => fetch('/api/metadata', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ urls }),
    signal: signal || undefined
});

export const parseApiResponse = (responsePromise, fallbackError) => parseResponse(responsePromise, fallbackError);

export const fetchMetadata = (urls, signal = null) => postJson('/api/metadata', { urls }, 'Metadata failed', signal);

export const selectRandomMovie = (lists, total, signal = null) => postJson('/api/select', { lists, total }, 'Selection failed', signal);

export const fetchMovieDetails = (slug, signal = null) => postJson('/api/details', { slug }, 'Details failed', signal);
