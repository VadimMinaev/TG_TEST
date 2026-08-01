'use strict';

const MARKER_RE = /\[\[RSERVICE_(ASSIGNED_REQUESTS|REQUEST|QUERY|PAGE|COUNT):([\s\S]*?)\]\]/g;

function parseRServiceActions(text) {
    const actions = [];
    const source = String(text || '').replace(/[\u200B-\u200D\u2060\uFEFF]/g, '');
    let match;
    while ((match = MARKER_RE.exec(source)) !== null) {
        try {
            const payload = JSON.parse(match[2]);
            if (match[1] === 'ASSIGNED_REQUESTS') {
                const limit = Math.min(20, Math.max(1, Number(payload.limit) || 10));
                actions.push({ type: 'assigned', limit });
            } else if (match[1] === 'REQUEST') {
                const id = Number(payload.id);
                if (Number.isInteger(id) && id > 0) actions.push({ type: 'request', id });
            } else if (match[1] === 'PAGE') {
                const mode = payload.mode === 'all' ? 'all' : payload.mode === 'next' ? 'next' : '';
                if (mode) actions.push({ type: 'page', mode });
            } else if (match[1] === 'COUNT') {
                const queries = Array.isArray(payload.queries) ? payload.queries.slice(0, 5) : [];
                if (queries.length) actions.push({ type: 'count', queries });
            } else if (payload && typeof payload === 'object') {
                actions.push({ type: 'query', query: payload });
            }
        } catch (_) {
            // An invalid model marker is ignored instead of executing an uncertain request.
        }
    }
    return actions;
}

function stripRServiceMarkers(text) {
    return String(text || '')
        .replace(/[\u200B-\u200D\u2060\uFEFF]/g, '')
        .replace(MARKER_RE, '')
        .replace(/\[\[\s*RSERVICE_[A-Z_]+\s*:[\s\S]*?\]\]/gi, '')
        .trim();
}

module.exports = { parseRServiceActions, stripRServiceMarkers };
