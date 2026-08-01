'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { parseSimpleRServiceCountIntent } = require('./r-service-count-intent');

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
    assert.equal(parseSimpleRServiceCountIntent('Сколько запросов назначено на меня?'), null);
});
