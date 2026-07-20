'use strict';

function extractMarkerJson(source, markerNames) {
    for (const markerName of markerNames) {
        const prefix = `[[${markerName}:`;
        const markerIndex = source.indexOf(prefix);
        if (markerIndex === -1) continue;
        const jsonStart = markerIndex + prefix.length;
        if (source[jsonStart] !== '{') continue;

        let depth = 0;
        let inString = false;
        let escaped = false;
        for (let index = jsonStart; index < source.length; index += 1) {
            const char = source[index];
            if (inString) {
                if (escaped) escaped = false;
                else if (char === '\\') escaped = true;
                else if (char === '"') inString = false;
                continue;
            }
            if (char === '"') inString = true;
            else if (char === '{') depth += 1;
            else if (char === '}') {
                depth -= 1;
                if (depth === 0 && source.slice(index + 1, index + 3) === ']]') {
                    return source.slice(jsonStart, index + 1);
                }
            }
        }
    }
    return null;
}

function parseReminderActions(text) {
    const source = String(text || '');
    const actions = [];
    const createJson = extractMarkerJson(source, ['REMINDER_CREATE', 'REMINDER']);
    if (createJson) {
        try {
            const data = JSON.parse(createJson);
            const runAtDate = new Date(data.runAt);
            const message = String(data.message || '').trim().slice(0, 1000);
            if (message && !Number.isNaN(runAtDate.getTime())) {
                actions.push({ type: 'create', message, runAt: runAtDate.toISOString() });
            }
        } catch (_error) {
            // Invalid model output is ignored and remains ordinary assistant text.
        }
    }

    if (/\[\[REMINDER_LIST\]\]/.test(source)) {
        actions.push({ type: 'list' });
    }

    const deleteJson = extractMarkerJson(source, ['REMINDER_DELETE']);
    if (deleteJson) {
        try {
            const data = JSON.parse(deleteJson);
            const id = Number(data.id);
            if (Number.isInteger(id) && id > 0) {
                actions.push({ type: 'delete', id });
            }
        } catch (_error) {
            // Invalid model output is ignored and remains ordinary assistant text.
        }
    }

    // Exactly one reminder operation is allowed per user turn.
    return actions.slice(0, 1);
}

function stripReminderMarkers(text) {
    return String(text || '')
        .replace(/\[\[REMINDER(?:_CREATE)?:\{.*?\}\]\]/gs, '')
        .replace(/\[\[REMINDER_LIST\]\]/g, '')
        .replace(/\[\[REMINDER_DELETE:\{.*?\}\]\]/gs, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

module.exports = { parseReminderActions, stripReminderMarkers };
