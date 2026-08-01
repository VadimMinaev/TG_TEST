'use strict';

const { scoreReferenceName } = require('./r-service-reference-match');

function isPresent(value) {
    return value !== null && value !== undefined && value !== '';
}

function referenceMatches(actual, expected) {
    if (!isPresent(actual)) return false;
    const expectedNumber = Number(expected);
    if (Number.isInteger(expectedNumber) && expectedNumber > 0) return Number(actual?.id) === expectedNumber;
    return scoreReferenceName(expected, actual?.name || actual?.subject || '') >= 84;
}

function matchesLocalFilter(item, filter) {
    const actual = item?.[filter.field];
    const operator = filter.operator || 'eq';
    if (operator === 'present') return isPresent(actual);
    if (operator === 'empty') return !isPresent(actual);

    if (filter.kind === 'deadline') {
        const timestamp = new Date(actual).getTime();
        return Number.isFinite(timestamp) && timestamp >= filter.start.getTime() && timestamp < filter.end.getTime();
    }

    if (filter.kind === 'reference') {
        const values = Array.isArray(filter.value) ? filter.value : [filter.value];
        const anyMatch = values.some(value => referenceMatches(actual, value));
        return ['neq', 'not_in'].includes(operator) ? !anyMatch : anyMatch;
    }

    const values = Array.isArray(filter.value) ? filter.value : [filter.value];
    const comparableActual = typeof actual === 'boolean' ? String(actual) : actual;
    const anyEqual = values.some(value => String(comparableActual) === String(value));
    if (operator === 'eq' || operator === 'in') return anyEqual;
    if (operator === 'neq' || operator === 'not_in') return !anyEqual;
    const actualTime = new Date(actual).getTime();
    if (!Number.isFinite(actualTime)) return false;
    if (operator === 'lt') return actualTime < new Date(filter.value).getTime();
    if (operator === 'lte') return actualTime <= new Date(filter.value).getTime();
    if (operator === 'gt') return actualTime > new Date(filter.value).getTime();
    if (operator === 'gte') return actualTime >= new Date(filter.value).getTime();
    if (operator === 'between' && Array.isArray(filter.value) && filter.value.length === 2) {
        return actualTime >= new Date(filter.value[0]).getTime() && actualTime <= new Date(filter.value[1]).getTime();
    }
    return false;
}

function applyLocalFilters(items, filters) {
    return (Array.isArray(items) ? items : []).filter(item => filters.every(filter => matchesLocalFilter(item, filter)));
}

module.exports = { matchesLocalFilter, applyLocalFilters };
