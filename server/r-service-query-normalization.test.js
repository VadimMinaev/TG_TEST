'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { canonicalizeRServiceField } = require('./r-service-query-normalization');

test('normalizes camelCase and compact API field names', () => {
    assert.equal(canonicalizeRServiceField('resolutionTargetAt'), 'resolution_target_at');
    assert.equal(canonicalizeRServiceField('nexttargetat'), 'next_target_at');
    assert.equal(canonicalizeRServiceField('requestedBy'), 'requested_by');
});

test('accepts safe deadline aliases emitted by a model', () => {
    assert.equal(canonicalizeRServiceField('resolutiontarget'), 'resolution_target_at');
    assert.equal(canonicalizeRServiceField('response_deadline'), 'response_target_at');
    assert.equal(canonicalizeRServiceField('deadline'), 'next_target_at');
});
