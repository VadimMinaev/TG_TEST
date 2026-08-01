'use strict';

function normalizeReferenceName(value) {
    return String(value || '')
        .normalize('NFKC')
        .toLocaleLowerCase('ru-RU')
        .replace(/ё/g, 'е')
        .replace(/[^a-zа-я0-9]+/gi, ' ')
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b, 'ru'))
        .join(' ');
}

function levenshtein(left, right) {
    const a = String(left || '');
    const b = String(right || '');
    const row = Array.from({ length: b.length + 1 }, (_, index) => index);
    for (let i = 1; i <= a.length; i += 1) {
        let previous = row[0];
        row[0] = i;
        for (let j = 1; j <= b.length; j += 1) {
            const old = row[j];
            row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1));
            previous = old;
        }
    }
    return row[b.length];
}

function scoreReferenceName(query, candidate) {
    const normalizedQuery = normalizeReferenceName(query);
    const normalizedCandidate = normalizeReferenceName(candidate);
    if (!normalizedQuery || !normalizedCandidate) return 0;
    if (normalizedQuery === normalizedCandidate) return 100;

    const queryTokens = normalizedQuery.split(' ');
    const candidateTokens = normalizedCandidate.split(' ');
    if (queryTokens.every(token => candidateTokens.includes(token))) return 94;

    const distance = levenshtein(normalizedQuery, normalizedCandidate);
    const maxLength = Math.max(normalizedQuery.length, normalizedCandidate.length);
    if (distance <= 1) return 90;
    if (maxLength >= 10 && distance <= 2) return 84;
    return 0;
}

function findBestReferenceMatches(query, items) {
    const scored = (Array.isArray(items) ? items : [])
        .map(item => ({ item, score: scoreReferenceName(query, item?.name || item?.subject || '') }))
        .filter(entry => entry.score >= 84)
        .sort((a, b) => b.score - a.score || Number(a.item?.id || 0) - Number(b.item?.id || 0));
    if (!scored.length) return [];
    const bestScore = scored[0].score;
    return scored.filter(entry => entry.score === bestScore).map(entry => entry.item);
}

module.exports = { normalizeReferenceName, scoreReferenceName, findBestReferenceMatches };
