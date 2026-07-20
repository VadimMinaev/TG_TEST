'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { parseReminderActions, stripReminderMarkers } = require('./ai-reminder-actions');

test('parses the current reminder create marker', () => {
    const input = '[[REMINDER_CREATE:{"message":"Позвонить маме","runAt":"2026-07-20T12:00:00Z"}]]';
    assert.deepEqual(parseReminderActions(input), [{
        type: 'create',
        message: 'Позвонить маме',
        runAt: '2026-07-20T12:00:00.000Z'
    }]);
});

test('keeps backward compatibility with the legacy create marker', () => {
    const input = '[[REMINDER:{"message":"Старый формат","runAt":"2026-07-20T13:00:00Z"}]]';
    assert.equal(parseReminderActions(input)[0]?.type, 'create');
});

test('parses braces and escaped quotes inside reminder text', () => {
    const input = '[[REMINDER_CREATE:{"message":"Проверить объект {\\"ok\\": true}","runAt":"2026-07-20T13:00:00Z"}]]';
    assert.equal(parseReminderActions(input)[0]?.message, 'Проверить объект {"ok": true}');
    assert.equal(stripReminderMarkers(input), '');
});

test('parses list and delete actions', () => {
    assert.deepEqual(parseReminderActions('[[REMINDER_LIST]]'), [{ type: 'list' }]);
    assert.deepEqual(parseReminderActions('[[REMINDER_DELETE:{"id":42}]]'), [{ type: 'delete', id: 42 }]);
});

test('rejects invalid delete ids and malformed create markers', () => {
    assert.deepEqual(parseReminderActions('[[REMINDER_DELETE:{"id":"bad"}]]'), []);
    assert.deepEqual(parseReminderActions('[[REMINDER_CREATE:{"message":"Тест"}]]'), []);
});

test('strips action markers but keeps user-facing text', () => {
    const input = '[[REMINDER_CREATE:{"message":"Тест","runAt":"2026-07-20T12:00:00Z"}]]\nГотово.';
    assert.equal(stripReminderMarkers(input), 'Готово.');
    assert.equal(stripReminderMarkers('[[REMINDER_LIST]]'), '');
    assert.equal(stripReminderMarkers('[[REMINDER_DELETE:{"id":42}]]'), '');
});
