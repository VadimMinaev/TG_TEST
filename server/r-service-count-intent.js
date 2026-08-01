'use strict';

function normalizeText(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/ё/g, 'е')
        .replace(/[?!.,:;]+/g, ' ')
        .replace(/\s+/g, ' ');
}

function parseSimpleRServiceCountIntent(text) {
    const value = normalizeText(text);
    if (!value || !(value.startsWith('сколько ') || value.includes('количество')) || !value.includes('запрос')) return null;
    if (/(?:где|инициатор|исполнитель|команд|пользовател|для кого|на мне|на меня|назначен)/.test(value)) return null;

    const isOpen = value.includes('открыт');
    const isCompleted = /(?:завершен|закрыт|выполнен)/.test(value);
    const queries = [];
    if (isOpen && isCompleted) queries.push({ scope: 'all', filters: [] });
    if (isOpen) queries.push({ scope: 'open', filters: [] });
    if (isCompleted) queries.push({ scope: 'completed', filters: [] });
    if (!isOpen && !isCompleted) queries.push({ scope: 'all', filters: [] });
    return { type: 'count', queries };
}

module.exports = { parseSimpleRServiceCountIntent };
