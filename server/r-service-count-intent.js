'use strict';

function normalizeText(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/ё/g, 'е')
        .replace(/^[^a-zа-я0-9]+/i, '')
        .replace(/[?!.,:;]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function parseSimpleRServiceCountIntent(text) {
    const value = normalizeText(text);
    if (!value || !(value.startsWith('сколько ') || value.includes('количество')) || !value.includes('запрос')) return null;
    const simpleWord = /^(?:сколько|какое|количество|всего|открыт\S*|завершен\S*|закрыт\S*|выполнен\S*|запрос\S*|в|систем\S*|сейчас|на|текущ\S*|момент|мне|у|меня|мои\S*)$/;
    if (value.split(' ').some(word => !simpleWord.test(word))) return null;

    const isOpen = value.includes('открыт');
    const isCompleted = /(?:завершен|закрыт|выполнен)/.test(value);
    const isMine = /(?:мне|у меня|на меня|мои)/.test(value);
    const filters = isMine ? [{ field: 'member', operator: 'eq', value: '__SELF__' }] : [];
    const queries = [];
    if (isOpen && isCompleted) queries.push({ scope: 'all', filters });
    if (isOpen) queries.push({ scope: 'open', filters });
    if (isCompleted) queries.push({ scope: 'completed', filters });
    if (!isOpen && !isCompleted) queries.push({ scope: 'all', filters });
    return { type: 'count', queries };
}

function parseSimpleRServiceCountFollowUp(text, previousAction) {
    if (!previousAction || !Array.isArray(previousAction.queries) || !previousAction.queries.length) return null;
    const value = normalizeText(text);
    if (!/^а\s+/.test(value) || value.split(' ').length > 5) return null;
    const previousFilters = previousAction.queries[previousAction.queries.length - 1]?.filters || [];
    if (value.includes('открыт')) return { type: 'count', queries: [{ scope: 'open', filters: previousFilters }] };
    if (/(?:завершен|закрыт|выполнен)/.test(value)) return { type: 'count', queries: [{ scope: 'completed', filters: previousFilters }] };
    if (value.includes('всего')) return { type: 'count', queries: [{ scope: 'all', filters: previousFilters }] };
    return null;
}

module.exports = { parseSimpleRServiceCountIntent, parseSimpleRServiceCountFollowUp };
