'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeReferenceName, findBestReferenceMatches } = require('./r-service-reference-match');

test('normalizes case, yo and word order', () => {
    assert.equal(normalizeReferenceName('  Валерий  Афанасенко '), normalizeReferenceName('афанасенко ВАЛЕРИЙ'));
    assert.equal(normalizeReferenceName('Алёна Ёлкина'), normalizeReferenceName('елкина алена'));
});

test('finds one case-insensitive person', () => {
    const matches = findBestReferenceMatches('Валерий афанасенко', [
        { id: 1, name: 'Иван Петров' },
        { id: 2, name: 'Афанасенко Валерий' }
    ]);
    assert.deepEqual(matches, [{ id: 2, name: 'Афанасенко Валерий' }]);
});

test('keeps equally strong duplicates ambiguous', () => {
    const matches = findBestReferenceMatches('Валерий Афанасенко', [
        { id: 2, name: 'Валерий Афанасенко' },
        { id: 7, name: 'Афанасенко Валерий' }
    ]);
    assert.equal(matches.length, 2);
});
