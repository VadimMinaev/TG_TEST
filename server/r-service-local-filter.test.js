'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { applyLocalFilters } = require('./r-service-local-filter');

const requests = [
    { id: 1, requested_by: { id: 28, name: 'Афанасенко Валерий' }, resolution_target_at: '2026-08-01T12:30:00Z' },
    { id: 2, requested_by: { id: 31, name: 'Иванова Алёна' }, resolution_target_at: '2026-08-03T12:30:00Z' }
];

test('filters a reference locally without person:Read', () => {
    const result = applyLocalFilters(requests, [{ kind: 'reference', field: 'requested_by', operator: 'eq', value: 'валерий афанасенко' }]);
    assert.deepEqual(result.map(item => item.id), [1]);
});

test('filters an unsupported REST deadline locally', () => {
    const result = applyLocalFilters(requests, [{
        kind: 'deadline', field: 'resolution_target_at', operator: 'within',
        start: new Date('2026-08-01T12:00:00Z'), end: new Date('2026-08-02T12:00:00Z')
    }]);
    assert.deepEqual(result.map(item => item.id), [1]);
});
