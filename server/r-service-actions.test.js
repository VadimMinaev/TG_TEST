'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { parseRServiceActions, stripRServiceMarkers } = require('./r-service-actions');

test('parses assigned requests and clamps the limit', () => {
    assert.deepEqual(parseRServiceActions('[[RSERVICE_ASSIGNED_REQUESTS:{"limit":99}]]'), [
        { type: 'assigned', limit: 20 }
    ]);
});

test('parses a request id and rejects invalid ids', () => {
    assert.deepEqual(parseRServiceActions('[[RSERVICE_REQUEST:{"id":70470}]]'), [
        { type: 'request', id: 70470 }
    ]);
    assert.deepEqual(parseRServiceActions('[[RSERVICE_REQUEST:{"id":"nope"}]]'), []);
});

test('strips action markers from the visible response', () => {
    assert.equal(stripRServiceMarkers('[[RSERVICE_REQUEST:{"id":7}]]\nГотово'), 'Готово');
});

test('parses a structured free-form query without interpreting its values', () => {
    const query = { scope: 'open', filters: [{ field: 'team', operator: 'eq', value: 'Service Desk' }], limit: 5 };
    assert.deepEqual(parseRServiceActions(`[[RSERVICE_QUERY:${JSON.stringify(query)}]]`), [{ type: 'query', query }]);
});

test('parses pagination commands for the previous R-Service query', () => {
    assert.deepEqual(parseRServiceActions('[[RSERVICE_PAGE:{"mode":"next"}]]'), [
        { type: 'page', mode: 'next' }
    ]);
    assert.deepEqual(parseRServiceActions('[[RSERVICE_PAGE:{"mode":"all"}]]'), [
        { type: 'page', mode: 'all' }
    ]);
});
