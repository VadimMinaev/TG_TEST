'use strict';

const REQUEST_FIELDS = [
    'id', 'source', 'sourceID', 'subject', 'category', 'impact', 'status', 'workflow',
    'next_target_at', 'completed_at', 'created_by', 'grouping', 'grouped_into',
    'knowledge_article', 'requested_by', 'requested_for', 'service_instance',
    'supplier_requestID', 'created_at', 'updated_at', 'team', 'member', 'template',
    'major_incident_status', 'organization', 'response_target_at', 'resolution_target_at',
    'desired_completion_at', 'urgent'
];

function compactIdentifier(value) {
    return String(value || '').replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase().replace(/[^a-z0-9]/g, '');
}

const FIELD_BY_COMPACT_NAME = new Map(REQUEST_FIELDS.map(field => [compactIdentifier(field), field]));
const FIELD_ALIASES = new Map([
    ['nexttarget', 'next_target_at'],
    ['nextdeadline', 'next_target_at'],
    ['deadline', 'next_target_at'],
    ['duetime', 'next_target_at'],
    ['responsetarget', 'response_target_at'],
    ['reactiontarget', 'response_target_at'],
    ['responsedeadline', 'response_target_at'],
    ['reactiondeadline', 'response_target_at'],
    ['resolutiontarget', 'resolution_target_at'],
    ['resolutiondeadline', 'resolution_target_at'],
    ['desiredcompletion', 'desired_completion_at']
]);

function canonicalizeRServiceField(value) {
    const compact = compactIdentifier(value);
    return FIELD_BY_COMPACT_NAME.get(compact) || FIELD_ALIASES.get(compact) || String(value || '').trim();
}

function normalizeEnumText(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/ё/g, 'е')
        .replace(/[_-]+/g, ' ')
        .replace(/\s+/g, ' ');
}

const STATUS_ALIASES = new Map([
    ['declined', 'declined'], ['отклонен', 'declined'], ['отклонено', 'declined'],
    ['on backlog', 'on_backlog'], ['backlog', 'on_backlog'], ['в бэклоге', 'on_backlog'], ['в беклоге', 'on_backlog'],
    ['assigned', 'assigned'], ['назначен', 'assigned'], ['назначено', 'assigned'],
    ['accepted', 'accepted'], ['принят', 'accepted'], ['принято', 'accepted'],
    ['in progress', 'in_progress'], ['в работе', 'in_progress'], ['в процессе', 'in_progress'],
    ['waiting for', 'waiting_for'], ['ожидает', 'waiting_for'], ['ожидание', 'waiting_for'],
    ['waiting for customer', 'waiting_for_customer'], ['ожидает клиента', 'waiting_for_customer'], ['ожидание клиента', 'waiting_for_customer'],
    ['reservation pending', 'reservation_pending'], ['ожидает резервирования', 'reservation_pending'],
    ['workflow pending', 'workflow_pending'], ['ожидает workflow', 'workflow_pending'], ['ожидает процесса', 'workflow_pending'],
    ['project pending', 'project_pending'], ['ожидает проекта', 'project_pending'],
    ['completed', 'completed'], ['завершен', 'completed'], ['завершено', 'completed'], ['закрыт', 'completed'], ['закрыто', 'completed'], ['выполнен', 'completed'], ['выполнено', 'completed']
]);

function normalizeRServiceFilterValue(field, value) {
    if (Array.isArray(value)) return value.map(item => normalizeRServiceFilterValue(field, item));
    if (field !== 'status' || typeof value !== 'string') return value;
    return STATUS_ALIASES.get(normalizeEnumText(value)) || value;
}

module.exports = { canonicalizeRServiceField, normalizeRServiceFilterValue };
