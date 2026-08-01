'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { parseSimpleRServiceCountIntent, parseSimpleRServiceCountFollowUp } = require('./r-service-count-intent');

test('recognizes simple open, completed and total count questions', () => {
    assert.deepEqual(parseSimpleRServiceCountIntent('Сколько всего открытых запросов?'), {
        type: 'count', queries: [{ scope: 'open', filters: [] }]
    });
    assert.deepEqual(parseSimpleRServiceCountIntent('Сколько завершённых запросов?'), {
        type: 'count', queries: [{ scope: 'completed', filters: [] }]
    });
    assert.deepEqual(parseSimpleRServiceCountIntent('Какое количество запросов всего?'), {
        type: 'count', queries: [{ scope: 'all', filters: [] }]
    });
});

test('leaves filtered count questions to the AI query planner', () => {
    assert.equal(parseSimpleRServiceCountIntent('Сколько запросов, где инициатор Валерий?'), null);
    assert.equal(parseSimpleRServiceCountIntent('Сколько открытых запросов на участнике Ренат Валиулин?'), null);
});

test('recognizes a leading slash and a count assigned to the current user', () => {
    assert.deepEqual(parseSimpleRServiceCountIntent('\\Сколько мне завершённых запросов?'), {
        type: 'count',
        queries: [{
            scope: 'completed',
            filters: [{ field: 'member', operator: 'eq', value: '__SELF__' }]
        }]
    });
});

test('continues the previous count scope while preserving filters', () => {
    const previous = {
        type: 'count',
        queries: [{ scope: 'completed', filters: [{ field: 'member', operator: 'eq', value: '__SELF__' }] }]
    };
    assert.deepEqual(parseSimpleRServiceCountFollowUp('а открытых', previous), {
        type: 'count',
        queries: [{ scope: 'open', filters: previous.queries[0].filters }]
    });
});
