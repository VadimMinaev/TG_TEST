import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { api, Integration, Rule, Poll } from '../lib/api';
import { useAuth } from '../lib/auth-context';
import { Copy, Download, Pencil, Play, Plus, RefreshCw, Trash2, Upload, ChevronLeft } from 'lucide-react';
import { TemplateHelp } from '../components/TemplateHelp';
import { ExportModal } from '../components/ExportModal';
import { StatusRadio } from '../components/StatusRadio';
import { EntityStateSwitch } from '../components/StateToggle';
import { ToolbarToggle } from '../components/ToolbarToggle';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../components/ui/tooltip';
import { useToast } from '../components/ToastNotification';

const DEFAULT_FORM: Omit<Integration, 'id'> = {
  name: '',
  enabled: true,
  triggerType: 'webhook',
  triggerCondition: '',
  pollingUrl: '',
  pollingMethod: 'GET',
  pollingHeaders: '',
  pollingBody: '',
  pollingInterval: 60,
  pollingCondition: '',
  pollingContinueAfterMatch: false,
  actionUrl: '',
  actionMethod: 'POST',
  actionHeaders: '',
  actionBody: '',
  timeoutSec: 30,
  sendToTelegram: false,
  chatId: '',
  botToken: '',
  messageTemplate: '',
};

const isDraftIntegration = (integration: Partial<Integration>) =>
  !integration.enabled && String(integration.name || '').toLowerCase().startsWith('черновик');

export function Integrations() {
  const { user } = useAuth();
  const canEdit = user?.role !== 'auditor';
  const [searchParams, setSearchParams] = useSearchParams();
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);
  const [polls, setPolls] = useState<Poll[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [accountBotToken, setAccountBotToken] = useState<string | null>(null);
  const [accountBotTokenLoading, setAccountBotTokenLoading] = useState(true);
  const [selectedSourceId, setSelectedSourceId] = useState<string>('');
  const { addToast } = useToast();
  const [running, setRunning] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [togglingIntegrationId, setTogglingIntegrationId] = useState<number | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  // Автоматически скрывать уведомление через 4 секунды

  const selectedIntegration = useMemo(
    () => integrations.find((i) => i.id === selectedId) || null,
    [integrations, selectedId]
  );

  const loadIntegrations = async () => {
    try {
      setLoading(true);
      const [integrationsData, rulesData, pollsData] = await Promise.all([
        api.getIntegrations(),
        api.getRules(),
        api.getPolls(),
      ]);
      setIntegrations(integrationsData);
      setRules(rulesData);
      setPolls(pollsData);
    } catch (error: any) {
      addToast(error.message || 'Не удалось загрузить данные', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadIntegrations();
    // Load account bot token
    api.getAccountBotToken()
      .then(data => {
        setAccountBotToken(data.isSet ? data.botToken : null);
      })
      .catch(() => {
        setAccountBotToken(null);
      })
      .finally(() => {
        setAccountBotTokenLoading(false);
      });
  }, []);

  // Применить настройки из выбранного Webhook или пуллинга
  const handleApplySource = (sourceId: string) => {
    setSelectedSourceId(sourceId);
    if (!sourceId) return;

    if (form.triggerType === 'webhook') {
      const rule = rules.find((r) => String(r.id) === sourceId);
      if (rule) {
        setForm({
          ...form,
          triggerCondition: rule.condition || '',
          chatId: rule.chatId || '',
          botToken: rule.botToken || '',
          messageTemplate: rule.messageTemplate || '',
        });
      }
    } else {
      const poll = polls.find((p) => String(p.id) === sourceId);
      if (poll) {
        setForm({
          ...form,
          pollingUrl: poll.url || '',
          pollingMethod: poll.method || 'GET',
          pollingHeaders: poll.headersJson || '',
          pollingBody: poll.bodyJson || '',
          pollingInterval: poll.intervalSec || 60,
          pollingCondition: poll.conditionJson || '',
          chatId: poll.chatId || '',
          botToken: poll.botToken || '',
          messageTemplate: poll.messageTemplate || '',
          timeoutSec: poll.timeoutSec || 30,
        });
      }
    }
  };

  useEffect(() => {
    const createParam = searchParams.get('create');
    const selectParam = searchParams.get('select');
    
    if (createParam === 'true') {
      setSelectedId(null);
      setEditingId(-1);
      setForm(DEFAULT_FORM);
      setSearchParams({}, { replace: true });
    } else if (selectParam) {
      const id = parseInt(selectParam, 10);
      if (!isNaN(id)) {
        setSelectedId(id);
        setEditingId(null);
      }
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const handleSelect = (id: number) => {
    setSelectedId(id);
    setEditingId(null);
  };

  const handleStartCreate = () => {
    setSelectedId(null);
    setEditingId(-1);
    setForm(DEFAULT_FORM);
    setSelectedSourceId('');
  };

  const handleEdit = (integration: Integration) => {
    setSelectedId(integration.id);
    setEditingId(integration.id);
    setSelectedSourceId('');
    setForm({
      name: integration.name || '',
      enabled: integration.enabled ?? true,
      triggerType: integration.triggerType || 'webhook',
      triggerCondition: integration.triggerCondition || '',
      pollingUrl: integration.pollingUrl || '',
      pollingMethod: integration.pollingMethod || 'GET',
      pollingHeaders: integration.pollingHeaders || '',
      pollingBody: integration.pollingBody || '',
      pollingInterval: integration.pollingInterval || 60,
      pollingCondition: integration.pollingCondition || '',
      pollingContinueAfterMatch: integration.pollingContinueAfterMatch ?? false,
      actionUrl: integration.actionUrl || '',
      actionMethod: integration.actionMethod || 'POST',
      actionHeaders: integration.actionHeaders || '',
      actionBody: integration.actionBody || '',
      timeoutSec: integration.timeoutSec || 30,
      sendToTelegram: integration.sendToTelegram ?? false,
      chatId: integration.chatId || '',
      botToken: integration.botToken || '',
      messageTemplate: integration.messageTemplate || '',
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    // Clear message is no longer needed with toast system

    if (!form.name) {
      addToast('Укажите название', 'error');
      return;
    }

    // Для webhook триггера поле pollingContinueAfterMatch должно быть null в БД
    const dataToSave = {
      ...form,
      pollingContinueAfterMatch: form.triggerType === 'webhook' ? undefined : form.pollingContinueAfterMatch,
      botToken: form.botToken?.trim() ? form.botToken : undefined,
    };

    try {
      if (editingId && editingId !== -1) {
        const updated = await api.updateIntegration(editingId, dataToSave);
        setEditingId(null);
        setSelectedId(updated.id);
        addToast('Интеграция обновлена', 'success');
        // Перезагружаем список для синхронизации
        await loadIntegrations();
      } else {
        const created = await api.createIntegration(dataToSave);
        setEditingId(null);
        setSelectedId(created.id);
        addToast('Интеграция создана', 'success');
        // Перезагружаем список для синхронизации
        await loadIntegrations();
      }
    } catch (error: any) {
      addToast(error.message || 'Ошибка сохранения', 'error');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Удалить интеграцию?')) return;
    try {
      await api.deleteIntegration(id);
      setIntegrations((prev) => prev.filter((i) => i.id !== id));
      if (selectedId === id) {
        setSelectedId(null);
        setEditingId(null);
      }
      addToast('Интеграция удалена', 'success');
    } catch (error: any) {
      addToast(error.message, 'error');
    }
  };

  const handleDuplicate = async (integration: Integration) => {
    try {
      const { id, ...data } = integration;
      const created = await api.createIntegration({
        ...data,
        name: `${data.name} (копия)`,
        enabled: false,
      });
      setIntegrations((prev) => [created, ...prev]);
      setSelectedId(created.id);
      addToast('Интеграция дублирована', 'success');
    } catch (error: any) {
      addToast(error.message, 'error');
    }
  };

  const handleRun = async (id: number) => {
    setRunning(true);
    try {
      const result = await api.runIntegration(id);
      if (result.status === 'success') {
        addToast('Интеграция выполнена успешно', 'success');
      } else {
        addToast(`Ошибка: ${result.errorMessage || 'Неизвестная ошибка'}`, 'error');
      }
    } catch (error: any) {
      addToast(error.message, 'error');
    } finally {
      setRunning(false);
    }
  };

  const handleToggleIntegrationEnabled = async (integration: Integration) => {
    const nextEnabled = !integration.enabled;
    try {
      setTogglingIntegrationId(integration.id);
      const updated = await api.updateIntegration(integration.id, { enabled: nextEnabled });
      const mergedUpdated = { ...integration, ...updated, id: integration.id };
      setIntegrations((prev) => prev.map((item) => (item.id === integration.id ? mergedUpdated : item)));
      addToast(nextEnabled ? 'Интеграция включена' : 'Интеграция выключена', 'success');
    } catch (error: any) {
      addToast(error.message || 'Не удалось обновить статус интеграции', 'error');
    } finally {
      setTogglingIntegrationId(null);
    }
  };

  const normalizeImportedIntegration = (raw: any, index: number): { payload: Partial<Integration>; drafted: boolean } => {
    const triggerType = raw.triggerType === 'polling' ? 'polling' : 'webhook';
    const name = String(raw.name ?? '').trim();
    const drafted = !name;
    return {
      payload: {
        name: name || `Черновик интеграции ${index + 1}`,
        enabled: drafted ? false : (raw.enabled ?? true),
        triggerType,
        triggerCondition: String(raw.triggerCondition ?? '').trim(),
        pollingUrl: raw.pollingUrl != null ? String(raw.pollingUrl) : undefined,
        pollingMethod: raw.pollingMethod || 'GET',
        pollingHeaders: raw.pollingHeaders != null ? String(raw.pollingHeaders) : undefined,
        pollingBody: raw.pollingBody != null ? String(raw.pollingBody) : undefined,
        pollingInterval: Number(raw.pollingInterval) || 60,
        pollingCondition: raw.pollingCondition != null ? String(raw.pollingCondition) : undefined,
        // Для webhook триггера поле pollingContinueAfterMatch должно быть null в БД
        pollingContinueAfterMatch: triggerType === 'webhook' ? undefined : (raw.pollingContinueAfterMatch ?? false),
        actionUrl: raw.actionUrl != null ? String(raw.actionUrl) : undefined,
        actionMethod: raw.actionMethod || 'POST',
        actionHeaders: raw.actionHeaders != null ? String(raw.actionHeaders) : undefined,
        actionBody: raw.actionBody != null ? String(raw.actionBody) : undefined,
        timeoutSec: Number(raw.timeoutSec) || 30,
        sendToTelegram: raw.sendToTelegram ?? false,
        chatId: raw.chatId != null ? String(raw.chatId) : undefined,
        botToken: raw.botToken ? String(raw.botToken) : undefined,
        messageTemplate: raw.messageTemplate ? String(raw.messageTemplate) : undefined,
      },
      drafted,
    };
  };

  const handleImportIntegrations = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const items = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.integrations) ? parsed.integrations : [];
      if (!items.length) throw new Error('Файл не содержит интеграций');

      let created = 0;
      let failed = 0;
      let draftedCount = 0;
      let lastError = '';
      for (const [index, item] of items.entries()) {
        const { payload, drafted } = normalizeImportedIntegration(item, index);
        if (drafted) draftedCount += 1;
        try {
          const createdIntegration = await api.createIntegration(payload);
          created += 1;
          setIntegrations((prev) => [...prev, createdIntegration]);
        } catch (err: any) {
          failed += 1;
          if (!lastError) lastError = err?.message || 'Ошибка создания';
        }
      }

      const messageText =
        failed === 0
          ? draftedCount > 0
            ? `Импортировано интеграций: ${created}, черновиков: ${draftedCount}`
            : `Импортировано интеграций: ${created}`
          : lastError
            ? `Импортировано: ${created}, черновиков: ${draftedCount}, ошибок: ${failed}. Причина: ${lastError}`
            : `Импортировано: ${created}, черновиков: ${draftedCount}, ошибок: ${failed}`;
      addToast(messageText, failed === 0 ? 'success' : 'info');
    } catch (error: any) {
      addToast(error.message || 'Ошибка импорта интеграций', 'error');
    } finally {
      setImporting(false);
      if (importInputRef.current) {
        importInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="card">
      <div className="card-header">
        <h2 className="text-xl font-semibold">🔗 Интегратор</h2>
        <div className="flex items-center gap-2">
          {canEdit && selectedIntegration && !editingId && (
            <>
              <button
                onClick={() => handleRun(selectedIntegration.id)}
                disabled={running}
                className="icon-button text-[hsl(var(--success))] hover:bg-[hsl(var(--success)_/_0.1)] disabled:opacity-50"
                title={running ? 'Выполняется...' : 'Запустить'}
              >
                <Play className="h-4 w-4" />
              </button>
              <button
                onClick={() => handleEdit(selectedIntegration)}
                className="icon-button"
                title="Редактировать"
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                onClick={() => handleDuplicate(selectedIntegration)}
                className="icon-button"
                title="Дублировать"
              >
                <Copy className="h-4 w-4" />
              </button>
              <button
                onClick={() => handleDelete(selectedIntegration.id)}
                className="icon-button text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive)_/_0.1)]"
                title="Удалить"
              >
                <Trash2 className="h-4 w-4" />
              </button>
              <ToolbarToggle
                enabled={integrations.find(i => i.id === selectedId)?.enabled ?? false}
                onChange={() => {
                  const integration = integrations.find(i => i.id === selectedId);
                  if (integration) handleToggleIntegrationEnabled(integration);
                }}
                title={integrations.find(i => i.id === selectedId)?.enabled ? 'Выключить интеграцию' : 'Включить интеграцию'}
              />
              <div className="mx-1 h-6 w-px bg-[hsl(var(--border))]" />
            </>
          )}
          <button
            onClick={loadIntegrations}
            className="icon-button"
            title="Обновить"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          {canEdit && (
            <>
              <input
                ref={importInputRef}
                type="file"
                accept="application/json"
                className="hidden"
                onChange={handleImportIntegrations}
              />
              <button
                onClick={() => importInputRef.current?.click()}
                disabled={importing}
                className="icon-button disabled:cursor-not-allowed disabled:opacity-60"
                title="Импорт интеграций"
              >
                <Upload className="h-4 w-4" />
              </button>
              <button
                onClick={() => setExportModalOpen(true)}
                className="icon-button"
                title="Экспорт интеграций"
              >
                <Download className="h-4 w-4" />
              </button>
              <button
                onClick={handleStartCreate}
                className="icon-button"
                title="Создать"
              >
                <Plus className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
      </div>


      <div className={`fp ${selectedId !== null || editingId !== null ? 'fp-has-selection' : ''}`}>
        <div className="fp-sidebar">
          <div className="fp-sidebar-head">
            <span className="fp-sidebar-title">Интеграции</span>
            <div className="fp-sidebar-actions">
              {canEdit && <button className="fp-icon-btn" onClick={handleStartCreate} title="Создать"><Plus size={13} /></button>}
              <button className="fp-icon-btn" onClick={loadIntegrations} title="Обновить"><RefreshCw size={13} /></button>
            </div>
          </div>
          <div className="fp-bot-list">
            {loading ? (
              <div className="fp-loading"><div className="fp-spinner" /></div>
            ) : integrations.length === 0 ? (
              <div className="fp-empty">Нет интеграций</div>
            ) : integrations.map((int) => (
              <div key={int.id} className={`fp-bot-item ${selectedId === int.id ? 'active' : ''}`} onClick={() => handleSelect(int.id)}>
                <div className="fp-bot-avatar">{(int.name || '?')[0]}</div>
                <div className="fp-bot-info">
                  <div className="fp-bot-name">{int.name}</div>
                  <div className="fp-bot-model">{int.triggerType}</div>
                </div>
                <div className={`fp-dot ${int.enabled ? 'on' : ''}`} />
              </div>
            ))}
          </div>
        </div>

        <div className="fp-panel">
          <div className="fp-panel-head">
            {(selectedId !== null || editingId !== null) && (
              <button 
                type="button"
                className="fp-back fp-back-mobile" 
                onClick={() => {
                  if (editingId !== null && editingId !== -1 && selectedId !== null) {
                    setEditingId(null);
                  } else {
                    setSelectedId(null);
                    setEditingId(null);
                  }
                }}
                style={{ marginRight: '8px' }}
              >
                <ChevronLeft size={14} />
              </button>
            )}
            <div className="fp-panel-meta">
              <div className="fp-panel-name">{editingId !== null ? (editingId === -1 ? 'Создание интеграции' : 'Редактирование') : selectedId ? 'Просмотр интеграции' : 'Интеграции'}</div>
            </div>
          </div>

          <div className="fp-form-body">
            {editingId !== null ? (
              <>
                <h3 className="mb-4 text-lg font-semibold">
                  {editingId === -1 ? 'Создание интеграции' : 'Редактирование'}
                </h3>
                <form className="entity-edit-form flex flex-col gap-5" onSubmit={handleSave}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label style={{ display: 'block', marginBottom: '16px', fontSize: '14px', fontWeight: 500 }}>Название</label>
                      <input
                        style={{ padding: '12px 16px', width: '100%', borderRadius: '8px', border: '1px solid hsl(var(--input))', background: 'hsl(var(--background))' }}
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        placeholder="Моя интеграция"
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '16px', fontSize: '14px', fontWeight: 500 }}>Тип триггера</label>
                      <select
                        style={{ padding: '12px 16px', width: '100%', borderRadius: '8px', border: '1px solid hsl(var(--input))', background: 'hsl(var(--background))' }}
                        value={form.triggerType}
                        onChange={(e) => {
                          const newTriggerType = e.target.value as 'webhook' | 'polling';
                          setForm({
                            ...form,
                            triggerType: newTriggerType,
                            // Сбрасываем pollingContinueAfterMatch при переключении на webhook
                            pollingContinueAfterMatch: newTriggerType === 'webhook' ? false : form.pollingContinueAfterMatch,
                          });
                          setSelectedSourceId('');
                        }}
                      >
                        <option value="webhook">Webhook (входящий)</option>
                        <option value="polling">Polling (опрос)</option>
                      </select>
                    </div>
                  </div>

                  {form.triggerType === 'webhook' && (
                    <>
                      {rules.length > 0 && (
                        <div>
                          <label style={{ display: 'block', marginBottom: '16px', fontSize: '14px', fontWeight: 500 }}>📥 Использовать Webhook</label>
                          <select
                            style={{ padding: '12px 16px', width: '100%', borderRadius: '8px', border: '1px solid hsl(var(--input))', background: 'hsl(var(--background))' }}
                            value={selectedSourceId}
                            onChange={(e) => handleApplySource(e.target.value)}
                          >
                            <option value="">— Настроить вручную —</option>
                            {rules.map((rule) => (
                              <option key={rule.id} value={rule.id}>
                                {rule.name} {rule.enabled ? '✅' : '⏸️'}
                              </option>
                            ))}
                          </select>
                          <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
                            Выберите существующий Webhook для копирования настроек
                          </p>
                        </div>
                      )}
                      <div>
                        <label style={{ display: 'block', marginBottom: '16px', fontSize: '14px', fontWeight: 500 }}>Условие срабатывания</label>
                        <input
                          style={{ padding: '12px 16px', width: '100%', borderRadius: '8px', border: '1px solid hsl(var(--input))', background: 'hsl(var(--background))', fontFamily: 'monospace' }}
                          value={form.triggerCondition}
                          onChange={(e) => setForm({ ...form, triggerCondition: e.target.value })}
                          placeholder='payload.type === "order"'
                        />
                        <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
                          JavaScript-выражение. Доступна переменная <code>payload</code>
                        </p>
                      </div>
                    </>
                  )}

                  {form.triggerType === 'polling' && (
                    <>
                      {polls.length > 0 && (
                        <div>
                          <label style={{ display: 'block', marginBottom: '16px', fontSize: '14px', fontWeight: 500 }}>🔄 Использовать пуллинг</label>
                          <select
                            style={{ padding: '12px 16px', width: '100%', borderRadius: '8px', border: '1px solid hsl(var(--input))', background: 'hsl(var(--background))' }}
                            value={selectedSourceId}
                            onChange={(e) => handleApplySource(e.target.value)}
                          >
                            <option value="">— Настроить вручную —</option>
                            {polls.map((poll) => (
                              <option key={poll.id} value={poll.id}>
                                {poll.name} {poll.enabled ? '✅' : '⏸️'}
                              </option>
                            ))}
                          </select>
                          <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
                            Выберите существующий пуллинг для копирования настроек
                          </p>
                        </div>
                      )}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="md:col-span-2">
                          <label style={{ display: 'block', marginBottom: '16px', fontSize: '14px', fontWeight: 500 }}>URL для опроса</label>
                          <input
                            style={{ padding: '12px 16px', width: '100%', borderRadius: '8px', border: '1px solid hsl(var(--input))', background: 'hsl(var(--background))' }}
                            value={form.pollingUrl}
                            onChange={(e) => setForm({ ...form, pollingUrl: e.target.value })}
                            placeholder="https://api.example.com/status"
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', marginBottom: '16px', fontSize: '14px', fontWeight: 500 }}>Метод</label>
                          <select
                            style={{ padding: '12px 16px', width: '100%', borderRadius: '8px', border: '1px solid hsl(var(--input))', background: 'hsl(var(--background))' }}
                            value={form.pollingMethod}
                            onChange={(e) => setForm({ ...form, pollingMethod: e.target.value })}
                          >
                            <option value="GET">GET</option>
                            <option value="POST">POST</option>
                            <option value="PUT">PUT</option>
                          </select>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label style={{ display: 'block', marginBottom: '16px', fontSize: '14px', fontWeight: 500 }}>Интервал (сек)</label>
                          <input
                            type="number"
                            min={5}
                            style={{ padding: '12px 16px', width: '100%', borderRadius: '8px', border: '1px solid hsl(var(--input))', background: 'hsl(var(--background))' }}
                            value={form.pollingInterval}
                            onChange={(e) => setForm({ ...form, pollingInterval: Number(e.target.value) })}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', marginBottom: '16px', fontSize: '14px', fontWeight: 500 }}>Таймаут (сек)</label>
                          <input
                            type="number"
                            min={1}
                            style={{ padding: '12px 16px', width: '100%', borderRadius: '8px', border: '1px solid hsl(var(--input))', background: 'hsl(var(--background))' }}
                            value={form.timeoutSec}
                            onChange={(e) => setForm({ ...form, timeoutSec: Number(e.target.value) })}
                          />
                        </div>
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '16px', fontSize: '14px', fontWeight: 500 }}>Headers (JSON)</label>
                        <textarea
                          rows={2}
                          style={{ padding: '12px 16px', width: '100%', borderRadius: '8px', border: '1px solid hsl(var(--input))', background: 'hsl(var(--background))', fontFamily: 'monospace', fontSize: '14px', resize: 'vertical' }}
                          value={form.pollingHeaders}
                          onChange={(e) => setForm({ ...form, pollingHeaders: e.target.value })}
                          placeholder='{"Authorization": "Bearer token"}'
                        />
                      </div>
                      {form.pollingMethod !== 'GET' && (
                        <div>
                          <label style={{ display: 'block', marginBottom: '16px', fontSize: '14px', fontWeight: 500 }}>Body (JSON)</label>
                          <textarea
                            rows={2}
                            style={{ padding: '12px 16px', width: '100%', borderRadius: '8px', border: '1px solid hsl(var(--input))', background: 'hsl(var(--background))', fontFamily: 'monospace', fontSize: '14px', resize: 'vertical' }}
                            value={form.pollingBody}
                            onChange={(e) => setForm({ ...form, pollingBody: e.target.value })}
                            placeholder='{"query": "status"}'
                          />
                        </div>
                      )}
                      <div>
                        <label style={{ display: 'block', marginBottom: '16px', fontSize: '14px', fontWeight: 500 }}>Условие срабатывания</label>
                        <input
                          style={{ padding: '12px 16px', width: '100%', borderRadius: '8px', border: '1px solid hsl(var(--input))', background: 'hsl(var(--background))', fontFamily: 'monospace' }}
                          value={form.pollingCondition}
                          onChange={(e) => setForm({ ...form, pollingCondition: e.target.value })}
                          placeholder='response.status === "ready"'
                        />
                      </div>
                      <div>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={form.pollingContinueAfterMatch}
                            onChange={(e) => setForm({ ...form, pollingContinueAfterMatch: e.target.checked })}
                            style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                          />
                          Продолжать после совпадения
                        </label>
                      </div>
                    </>
                  )}

                  <div style={{ borderTop: '1px solid hsl(var(--border))', paddingTop: '20px' }}>
                    <h4 style={{ marginBottom: '16px', fontSize: '14px', fontWeight: 600 }}>🚀 Action (вызов API)</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label style={{ display: 'block', marginBottom: '16px', fontSize: '14px', fontWeight: 500 }}>URL</label>
                        <input
                          style={{ padding: '12px 16px', width: '100%', borderRadius: '8px', border: '1px solid hsl(var(--input))', background: 'hsl(var(--background))' }}
                          value={form.actionUrl}
                          onChange={(e) => setForm({ ...form, actionUrl: e.target.value })}
                          placeholder="https://api.example.com/action"
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '16px', fontSize: '14px', fontWeight: 500 }}>Метод</label>
                        <select
                          style={{ padding: '12px 16px', width: '100%', borderRadius: '8px', border: '1px solid hsl(var(--input))', background: 'hsl(var(--background))' }}
                          value={form.actionMethod}
                          onChange={(e) => setForm({ ...form, actionMethod: e.target.value })}
                        >
                          <option value="GET">GET</option>
                          <option value="POST">POST</option>
                          <option value="PUT">PUT</option>
                          <option value="PATCH">PATCH</option>
                          <option value="DELETE">DELETE</option>
                        </select>
                      </div>
                    </div>
                    <div style={{ marginTop: '16px' }}>
                      <label style={{ display: 'block', marginBottom: '16px', fontSize: '14px', fontWeight: 500 }}>Headers (JSON)</label>
                      <textarea
                        rows={2}
                        style={{ padding: '12px 16px', width: '100%', borderRadius: '8px', border: '1px solid hsl(var(--input))', background: 'hsl(var(--background))', fontFamily: 'monospace', fontSize: '14px', resize: 'vertical' }}
                        value={form.actionHeaders}
                        onChange={(e) => setForm({ ...form, actionHeaders: e.target.value })}
                        placeholder='{"Authorization": "Bearer token", "X-Api-Key": "key"}'
                      />
                      <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
                        Дополнительные заголовки запроса. Content-Type добавляется автоматически.
                      </p>
                    </div>
                    {form.actionMethod !== 'GET' && (
                      <div style={{ marginTop: '16px' }}>
                        <label style={{ display: 'block', marginBottom: '16px', fontSize: '14px', fontWeight: 500 }}>Body (JSON)</label>
                        <textarea
                          rows={3}
                          style={{ padding: '12px 16px', width: '100%', borderRadius: '8px', border: '1px solid hsl(var(--input))', background: 'hsl(var(--background))', fontFamily: 'monospace', fontSize: '14px', resize: 'vertical' }}
                          value={form.actionBody}
                          onChange={(e) => setForm({ ...form, actionBody: e.target.value })}
                          placeholder={'{"orderId": "{{payload.id}}"}'}
                        />
                        <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
                          Используйте <code>{'{{payload.field}}'}</code> для подстановки данных
                        </p>
                      </div>
                    )}
                  </div>

                  <div style={{ borderTop: '1px solid hsl(var(--border))', paddingTop: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                      <input
                        type="checkbox"
                        id="sendToTelegram"
                        checked={form.sendToTelegram}
                        onChange={(e) => setForm({ ...form, sendToTelegram: e.target.checked })}
                        style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                      />
                      <label htmlFor="sendToTelegram" style={{ fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
                        📱 Telegram уведомление
                      </label>
                    </div>
                    
                    {form.sendToTelegram && (
                      <div style={{ paddingLeft: '30px', opacity: form.sendToTelegram ? 1 : 0.5 }}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label style={{ display: 'block', marginBottom: '16px', fontSize: '14px', fontWeight: 500 }}>Chat ID</label>
                            <input
                              style={{ padding: '12px 16px', width: '100%', borderRadius: '8px', border: '1px solid hsl(var(--input))', background: 'hsl(var(--background))' }}
                              value={form.chatId}
                              onChange={(e) => setForm({ ...form, chatId: e.target.value })}
                              placeholder="-1001234567890"
                            />
                          </div>
                          <div>
                            <label style={{ display: 'block', marginBottom: '16px', fontSize: '14px', fontWeight: 500 }}>Bot Token (опц.)</label>
                            <input
                              style={{ padding: '12px 16px', width: '100%', borderRadius: '8px', border: '1px solid hsl(var(--input))', background: 'hsl(var(--background))' }}
                              value={form.botToken}
                              onChange={(e) => setForm({ ...form, botToken: e.target.value })}
                              placeholder={accountBotTokenLoading ? 'Загрузка...' : (accountBotToken ? 'Используется токен аккаунта' : 'Оставьте пустым для использования токена аккаунта')}
                              disabled={accountBotTokenLoading}
                            />
                            {!accountBotTokenLoading && accountBotToken && (
                              <div style={{ marginTop: '8px', fontSize: '13px', color: 'hsl(var(--muted-foreground))' }}>
                                ✓ Токен аккаунта установлен. Оставьте поле пустым для его использования или введите локальный токен.
                              </div>
                            )}
                            {!accountBotTokenLoading && !accountBotToken && (
                              <div style={{ marginTop: '8px', fontSize: '13px', color: 'hsl(var(--muted-foreground))' }}>
                                ⚠ Токен аккаунта не установлен. Укажите токен в настройках аккаунта или введите локальный токен.
                              </div>
                            )}
                          </div>
                        </div>
                        <div style={{ marginTop: '16px' }}>
                          <label style={{ display: 'flex', alignItems: 'center', marginBottom: '16px', fontSize: '14px', fontWeight: 500 }}>
                            Шаблон сообщения
                            <TemplateHelp context="integration" />
                          </label>
                          <textarea
                            rows={2}
                            style={{ padding: '12px 16px', width: '100%', borderRadius: '8px', border: '1px solid hsl(var(--input))', background: 'hsl(var(--background))', fontFamily: 'monospace', fontSize: '14px', resize: 'vertical' }}
                            value={form.messageTemplate}
                            onChange={(e) => setForm({ ...form, messageTemplate: e.target.value })}
                            placeholder="${payload.name} — ${payload.status}"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '4px' }}>
                    <EntityStateSwitch
                      idPrefix="integration-edit"
                      enabled={form.enabled}
                      onChange={(nextEnabled) => setForm({ ...form, enabled: nextEnabled })}
                    />
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      type="submit"
                      className="flex-1 rounded bg-[hsl(var(--primary))] px-4 py-2 font-semibold text-[hsl(var(--primary-foreground))]"
                    >
                      Сохранить
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(null);
                        if (!selectedId) setForm(DEFAULT_FORM);
                      }}
                      className="flex-1 rounded bg-[hsl(var(--secondary))] px-4 py-2 font-semibold text-[hsl(var(--secondary-foreground))]"
                    >
                      Отмена
                    </button>
                  </div>
                </form>
              </>
            ) : selectedIntegration ? (
              <div>
                <div className="entity-view">
                  <div>
                    <h4 className="entity-view-title">Информация об интеграции</h4>
                    <div className="entity-view-card">
                      <div style={{ marginBottom: '12px' }}>
                        <strong>ID:</strong> <code style={{ padding: '4px 8px', marginLeft: '8px' }} className="rounded bg-[hsl(var(--muted)_/_0.5)]">{selectedIntegration.id}</code>
                      </div>
                      <div style={{ marginBottom: '12px' }}>
                        <strong>Название:</strong> {selectedIntegration.name}
                      </div>
                      <div style={{ marginBottom: '12px' }}>
                        <strong>Статус:</strong>{' '}
                        <span
                          style={{ padding: '4px 8px' }}
                          className={`rounded text-xs ${
                            selectedIntegration.enabled
                              ? 'bg-[hsl(var(--success)_/_0.15)] text-[hsl(var(--success))]'
                              : 'bg-[hsl(var(--destructive)_/_0.1)] text-[hsl(var(--destructive))]'
                          }`}
                        >
                          {selectedIntegration.enabled ? '✅ Включена' : '⏸️ Отключена'}
                        </span>
                      </div>
                      <div>
                        <strong>Тип триггера:</strong>{' '}
                        <span style={{ padding: '4px 8px' }} className="rounded bg-[hsl(var(--muted)_/_0.5)] text-xs">
                          {selectedIntegration.triggerType === 'webhook' ? '📥 Webhook' : '🔄 Polling'}
                        </span>
                      </div>
                    </div>
                  </div>


                  {selectedIntegration.triggerType === 'webhook' ? (
                    selectedIntegration.triggerCondition && (
                      <div>
                        <h4 className="entity-view-title">Условие срабатывания</h4>
                        <div className="entity-view-card-muted overflow-x-auto">
                          <code className="block whitespace-pre-wrap break-words text-sm">{selectedIntegration.triggerCondition}</code>
                        </div>
                      </div>
                    )
                  ) : (
                    <div>
                      <h4 className="entity-view-title">Настройки Polling</h4>
                      <div className="entity-view-card space-y-3">
                        {selectedIntegration.pollingUrl && (
                          <div>
                            <strong>URL:</strong>{' '}
                            <code style={{ padding: '4px 8px', marginLeft: '8px' }} className="rounded bg-[hsl(var(--muted)_/_0.5)]">
                              {selectedIntegration.pollingMethod || 'GET'} {selectedIntegration.pollingUrl}
                            </code>
                          </div>
                        )}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <strong>Интервал:</strong>{' '}
                            <code style={{ padding: '4px 8px', marginLeft: '8px' }} className="rounded bg-[hsl(var(--muted)_/_0.5)]">{selectedIntegration.pollingInterval || 60}s</code>
                          </div>
                          <div>
                            <strong>Таймаут:</strong>{' '}
                            <code style={{ padding: '4px 8px', marginLeft: '8px' }} className="rounded bg-[hsl(var(--muted)_/_0.5)]">{selectedIntegration.timeoutSec || 30}s</code>
                          </div>
                        </div>
                        {selectedIntegration.pollingCondition && (
                          <div>
                            <strong>Условие:</strong>
                            <div style={{ padding: '12px', marginTop: '8px' }} className="rounded-lg bg-[hsl(var(--muted)_/_0.3)]">
                              <code className="text-sm break-all">{selectedIntegration.pollingCondition}</code>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {selectedIntegration.actionUrl && (
                    <div>
                      <h4 className="entity-view-title">🚀 Action (API)</h4>
                      <div className="entity-view-card space-y-3">
                        <div>
                          <strong>URL:</strong>
                          <div style={{ padding: '12px', marginTop: '8px', wordBreak: 'break-word', overflowWrap: 'anywhere' }} className="rounded-lg bg-[hsl(var(--muted)_/_0.3)]">
                            <code style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }} className="text-sm">
                              {selectedIntegration.actionMethod || 'POST'} {selectedIntegration.actionUrl}
                            </code>
                          </div>
                        </div>
                        {selectedIntegration.actionHeaders && (
                          <div>
                            <strong>Headers:</strong>
                            <div style={{ padding: '12px', marginTop: '8px', wordBreak: 'break-word', overflowWrap: 'anywhere' }} className="rounded-lg bg-[hsl(var(--muted)_/_0.3)]">
                              <code style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }} className="text-sm">{selectedIntegration.actionHeaders}</code>
                            </div>
                          </div>
                        )}
                        {selectedIntegration.actionBody && (
                          <div>
                            <strong>Body:</strong>
                            <div style={{ padding: '12px', marginTop: '8px', wordBreak: 'break-word', overflowWrap: 'anywhere' }} className="rounded-lg bg-[hsl(var(--muted)_/_0.3)]">
                              <code style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }} className="text-sm">{selectedIntegration.actionBody}</code>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div>
                    <h4 className="entity-view-title">📱 Telegram уведомление</h4>
                    <div className="entity-view-card space-y-3">
                      <div>
                        <strong>Статус:</strong>{' '}
                        <span
                          style={{ padding: '4px 8px' }}
                          className={`rounded text-xs ${
                            selectedIntegration.sendToTelegram
                              ? 'bg-[hsl(var(--success)_/_0.15)] text-[hsl(var(--success))]'
                              : 'bg-[hsl(var(--muted)_/_0.3)] text-[hsl(var(--muted-foreground))]'
                          }`}
                        >
                          {selectedIntegration.sendToTelegram ? '✅ Включено' : '⏸️ Отключено'}
                        </span>
                      </div>
                      {selectedIntegration.sendToTelegram && (
                        <>
                          {selectedIntegration.chatId && (
                            <div>
                              <strong>Chat ID:</strong>{' '}
                              <code style={{ padding: '4px 8px', marginLeft: '8px' }} className="rounded bg-[hsl(var(--muted)_/_0.5)]">{selectedIntegration.chatId}</code>
                            </div>
                          )}
                          {selectedIntegration.botToken && (
                            <div>
                              <strong>Bot Token:</strong>{' '}
                              <code style={{ padding: '4px 8px', marginLeft: '8px' }} className="rounded bg-[hsl(var(--muted)_/_0.5)]">***настроен***</code>
                            </div>
                          )}
                          {selectedIntegration.messageTemplate && (
                            <div>
                              <strong>Шаблон сообщения:</strong>
                              <div style={{ padding: '16px', marginTop: '8px' }} className="whitespace-pre-wrap rounded-lg bg-[hsl(var(--muted)_/_0.3)] text-sm">
                                {selectedIntegration.messageTemplate}
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center text-[hsl(var(--muted-foreground))]">
                <p className="mb-4">Выберите интеграцию или создайте новую</p>
                <button
                  onClick={handleStartCreate}
                  className="inline-flex items-center gap-2 rounded bg-[hsl(var(--primary))] px-4 py-2 font-semibold text-[hsl(var(--primary-foreground))]"
                >
                  <Plus className="h-4 w-4" />
                  Создать интеграцию
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Export Modal */}
      <ExportModal
        isOpen={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        title="Экспорт интеграций"
        description="Выберите интеграции для экспорта"
        items={integrations.map((i) => ({ id: i.id, name: i.name, enabled: i.enabled }))}
        loading={loading}
        exportFileName="integrations-export.json"
        exportType="integrations"
        onExportSuccess={(count) => addToast(`Экспортировано интеграций: ${count}`, 'success')}
      />
    </div>
  );
}
