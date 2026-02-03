import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { api, Integration, Rule, Poll } from '../lib/api';
import { Copy, Pencil, Play, Plus, RefreshCw, Trash2 } from 'lucide-react';

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
  actionUrl: '',
  actionMethod: 'POST',
  actionHeaders: '',
  actionBody: '',
  timeoutSec: 30,
  chatId: '',
  botToken: '',
  messageTemplate: '',
};

export function Integrations() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);
  const [polls, setPolls] = useState<Poll[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [selectedSourceId, setSelectedSourceId] = useState<string>('');
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [running, setRunning] = useState(false);

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
      setMessage({ text: error.message || 'Не удалось загрузить данные', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadIntegrations();
  }, []);

  // Применить настройки из выбранного правила или поллинга
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
      actionUrl: integration.actionUrl || '',
      actionMethod: integration.actionMethod || 'POST',
      actionHeaders: integration.actionHeaders || '',
      actionBody: integration.actionBody || '',
      timeoutSec: integration.timeoutSec || 30,
      chatId: integration.chatId || '',
      botToken: integration.botToken || '',
      messageTemplate: integration.messageTemplate || '',
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (!form.name) {
      setMessage({ text: 'Укажите название', type: 'error' });
      return;
    }

    try {
      if (editingId && editingId !== -1) {
        const updated = await api.updateIntegration(editingId, form);
        setIntegrations((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
        setSelectedId(updated.id);
        setEditingId(null);
        setMessage({ text: 'Интеграция обновлена', type: 'success' });
      } else {
        const created = await api.createIntegration(form);
        setIntegrations((prev) => [created, ...prev]);
        setSelectedId(created.id);
        setEditingId(null);
        setMessage({ text: 'Интеграция создана', type: 'success' });
      }
    } catch (error: any) {
      setMessage({ text: error.message || 'Ошибка сохранения', type: 'error' });
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
      setMessage({ text: 'Интеграция удалена', type: 'success' });
    } catch (error: any) {
      setMessage({ text: error.message, type: 'error' });
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
      setMessage({ text: 'Интеграция дублирована', type: 'success' });
    } catch (error: any) {
      setMessage({ text: error.message, type: 'error' });
    }
  };

  const handleRun = async (id: number) => {
    setRunning(true);
    try {
      const result = await api.runIntegration(id);
      if (result.status === 'success') {
        setMessage({ text: 'Интеграция выполнена успешно', type: 'success' });
      } else {
        setMessage({ text: `Ошибка: ${result.errorMessage || 'Неизвестная ошибка'}`, type: 'error' });
      }
    } catch (error: any) {
      setMessage({ text: error.message, type: 'error' });
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="card">
      <div className="card-header">
        <h2 className="text-xl font-semibold">🔗 Интегратор</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={loadIntegrations}
            className="rounded border border-[hsl(var(--border))] bg-[hsl(var(--secondary))] p-2 transition-all hover:bg-[hsl(var(--accent))]"
            title="Обновить"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <button
            onClick={handleStartCreate}
            className="inline-flex items-center gap-2 rounded bg-[hsl(var(--primary))] px-4 py-2 text-sm font-semibold text-[hsl(var(--primary-foreground))] transition-all hover:bg-[hsl(var(--primary)_/_0.9)]"
          >
            <Plus className="h-4 w-4" />
            Создать
          </button>
        </div>
      </div>

      {message && (
        <div
          className={`mx-6 mt-4 animate-fade-in rounded border p-3 text-sm ${
            message.type === 'success'
              ? 'border-[hsl(var(--success)_/_0.3)] bg-[hsl(var(--success)_/_0.15)] text-[hsl(var(--success))]'
              : message.type === 'error'
              ? 'border-[hsl(var(--destructive)_/_0.2)] bg-[hsl(var(--destructive)_/_0.1)] text-[hsl(var(--destructive))]'
              : 'border-[hsl(var(--info)_/_0.3)] bg-[hsl(var(--info)_/_0.1)] text-[hsl(var(--info))]'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="split-layout p-6">
        <div className="split-left">
          <div className="panel">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold">📋 Список интеграций</h3>
              <span className="text-xs text-[hsl(var(--muted-foreground))]">{integrations.length}</span>
            </div>
            {loading ? (
              <div className="flex items-center justify-center py-10">
                <div className="h-6 w-6 animate-spin rounded-full border-4 border-[hsl(var(--primary))] border-t-transparent" />
              </div>
            ) : integrations.length === 0 ? (
              <p className="py-10 text-center text-sm text-[hsl(var(--muted-foreground))]">Интеграции не найдены</p>
            ) : (
              <div className="max-h-[calc(100vh-380px)] overflow-y-auto scrollbar-thin">
                <table className="table-basic w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-[hsl(var(--border))] text-left text-xs">
                      <th className="px-2 py-2">Название</th>
                      <th className="px-2 py-2">Триггер</th>
                      <th className="px-2 py-2">Статус</th>
                    </tr>
                  </thead>
                  <tbody>
                    {integrations.map((integration) => (
                      <tr
                        key={integration.id}
                        onClick={() => handleSelect(integration.id)}
                        className={`cursor-pointer border-b border-[hsl(var(--border))] transition-colors hover:bg-[hsl(var(--accent))] ${
                          selectedId === integration.id ? 'bg-[hsl(var(--accent))]' : ''
                        }`}
                      >
                        <td className="px-2 py-2 font-medium">{integration.name}</td>
                        <td className="px-2 py-2 text-xs">
                          {integration.triggerType === 'webhook' ? '📥 Webhook' : '🔄 Polling'}
                        </td>
                        <td className="px-2 py-2">{integration.enabled ? '✅ Вкл' : '⏸️ Выкл'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="split-right">
          <div className="panel">
            {editingId !== null ? (
              <>
                <h3 className="mb-4 text-lg font-semibold">
                  {editingId === -1 ? 'Создание интеграции' : 'Редактирование'}
                </h3>
                <form onSubmit={handleSave} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="mb-1 block text-sm font-medium">Название</label>
                      <input
                        className="w-full rounded border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm"
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        placeholder="Моя интеграция"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium">Тип триггера</label>
                      <select
                        className="w-full rounded border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm"
                        value={form.triggerType}
                        onChange={(e) => {
                          setForm({ ...form, triggerType: e.target.value as 'webhook' | 'polling' });
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
                          <label className="mb-1 block text-sm font-medium">📋 Использовать правило</label>
                          <select
                            className="w-full rounded border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm"
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
                            Выберите существующее правило для копирования настроек
                          </p>
                        </div>
                      )}
                      <div>
                        <label className="mb-1 block text-sm font-medium">Условие срабатывания</label>
                        <input
                          className="w-full rounded border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm font-mono"
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
                          <label className="mb-1 block text-sm font-medium">🔄 Использовать поллинг</label>
                          <select
                            className="w-full rounded border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm"
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
                            Выберите существующий поллинг для копирования настроек
                          </p>
                        </div>
                      )}
                      <div className="grid grid-cols-3 gap-4">
                        <div className="col-span-2">
                          <label className="mb-1 block text-sm font-medium">URL для опроса</label>
                          <input
                            className="w-full rounded border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm"
                            value={form.pollingUrl}
                            onChange={(e) => setForm({ ...form, pollingUrl: e.target.value })}
                            placeholder="https://api.example.com/status"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-sm font-medium">Метод</label>
                          <select
                            className="w-full rounded border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm"
                            value={form.pollingMethod}
                            onChange={(e) => setForm({ ...form, pollingMethod: e.target.value })}
                          >
                            <option value="GET">GET</option>
                            <option value="POST">POST</option>
                            <option value="PUT">PUT</option>
                          </select>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="mb-1 block text-sm font-medium">Интервал (сек)</label>
                          <input
                            type="number"
                            min={5}
                            className="w-full rounded border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm"
                            value={form.pollingInterval}
                            onChange={(e) => setForm({ ...form, pollingInterval: Number(e.target.value) })}
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-sm font-medium">Таймаут (сек)</label>
                          <input
                            type="number"
                            min={1}
                            className="w-full rounded border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm"
                            value={form.timeoutSec}
                            onChange={(e) => setForm({ ...form, timeoutSec: Number(e.target.value) })}
                          />
                        </div>
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-medium">Headers (JSON)</label>
                        <textarea
                          rows={2}
                          className="w-full rounded border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm font-mono"
                          value={form.pollingHeaders}
                          onChange={(e) => setForm({ ...form, pollingHeaders: e.target.value })}
                          placeholder='{"Authorization": "Bearer token"}'
                        />
                      </div>
                      {form.pollingMethod !== 'GET' && (
                        <div>
                          <label className="mb-1 block text-sm font-medium">Body (JSON)</label>
                          <textarea
                            rows={2}
                            className="w-full rounded border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm font-mono"
                            value={form.pollingBody}
                            onChange={(e) => setForm({ ...form, pollingBody: e.target.value })}
                            placeholder='{"query": "status"}'
                          />
                        </div>
                      )}
                      <div>
                        <label className="mb-1 block text-sm font-medium">Условие срабатывания</label>
                        <input
                          className="w-full rounded border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm font-mono"
                          value={form.pollingCondition}
                          onChange={(e) => setForm({ ...form, pollingCondition: e.target.value })}
                          placeholder='response.status === "ready"'
                        />
                      </div>
                    </>
                  )}

                  <div className="border-t border-[hsl(var(--border))] pt-4">
                    <h4 className="mb-3 text-sm font-semibold">🚀 Action (вызов API)</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="mb-1 block text-sm font-medium">URL</label>
                        <input
                          className="w-full rounded border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm"
                          value={form.actionUrl}
                          onChange={(e) => setForm({ ...form, actionUrl: e.target.value })}
                          placeholder="https://api.example.com/action"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-medium">Метод</label>
                        <select
                          className="w-full rounded border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm"
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
                    <div className="mt-3">
                      <label className="mb-1 block text-sm font-medium">Headers (JSON)</label>
                      <textarea
                        rows={2}
                        className="w-full rounded border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm font-mono"
                        value={form.actionHeaders}
                        onChange={(e) => setForm({ ...form, actionHeaders: e.target.value })}
                        placeholder='{"Authorization": "Bearer token", "X-Api-Key": "key"}'
                      />
                      <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
                        Дополнительные заголовки запроса. Content-Type добавляется автоматически.
                      </p>
                    </div>
                    {form.actionMethod !== 'GET' && (
                      <div className="mt-3">
                        <label className="mb-1 block text-sm font-medium">Body (JSON)</label>
                        <textarea
                          rows={3}
                          className="w-full rounded border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm font-mono"
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

                  <div className="border-t border-[hsl(var(--border))] pt-4">
                    <h4 className="mb-3 text-sm font-semibold">📱 Telegram уведомление</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="mb-1 block text-sm font-medium">Chat ID</label>
                        <input
                          className="w-full rounded border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm"
                          value={form.chatId}
                          onChange={(e) => setForm({ ...form, chatId: e.target.value })}
                          placeholder="-1001234567890"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-medium">Bot Token (опц.)</label>
                        <input
                          className="w-full rounded border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm"
                          value={form.botToken}
                          onChange={(e) => setForm({ ...form, botToken: e.target.value })}
                          placeholder="Глобальный токен"
                        />
                      </div>
                    </div>
                    <div className="mt-3">
                      <label className="mb-1 block text-sm font-medium">Шаблон сообщения</label>
                      <textarea
                        rows={2}
                        className="w-full rounded border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm"
                        value={form.messageTemplate}
                        onChange={(e) => setForm({ ...form, messageTemplate: e.target.value })}
                        placeholder="Заказ {{payload.id}} обработан"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={form.enabled}
                        onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
                        className="rounded"
                      />
                      Включена
                    </label>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      type="submit"
                      className="rounded bg-[hsl(var(--primary))] px-4 py-2 text-sm font-medium text-[hsl(var(--primary-foreground))]"
                    >
                      Сохранить
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(null);
                        if (!selectedId) setForm(DEFAULT_FORM);
                      }}
                      className="rounded border border-[hsl(var(--border))] px-4 py-2 text-sm"
                    >
                      Отмена
                    </button>
                  </div>
                </form>
              </>
            ) : selectedIntegration ? (
              <>
                <div className="mb-4 flex flex-wrap gap-2">
                  <button
                    onClick={() => handleRun(selectedIntegration.id)}
                    disabled={running}
                    className="flex items-center gap-2 rounded bg-[hsl(var(--success))] px-3 py-1 text-sm text-white disabled:opacity-50"
                  >
                    <Play className="h-4 w-4" />
                    {running ? 'Выполняется...' : 'Запустить'}
                  </button>
                  <button
                    onClick={() => handleEdit(selectedIntegration)}
                    className="flex items-center gap-2 rounded bg-[hsl(var(--primary))] px-3 py-1 text-sm text-[hsl(var(--primary-foreground))]"
                  >
                    <Pencil className="h-4 w-4" />
                    Редактировать
                  </button>
                  <button
                    onClick={() => handleDuplicate(selectedIntegration)}
                    className="flex items-center gap-2 rounded border border-[hsl(var(--border))] px-3 py-1 text-sm"
                  >
                    <Copy className="h-4 w-4" />
                    Дублировать
                  </button>
                  <button
                    onClick={() => handleDelete(selectedIntegration.id)}
                    className="flex items-center gap-2 rounded bg-[hsl(var(--destructive))] px-3 py-1 text-sm text-white"
                  >
                    <Trash2 className="h-4 w-4" />
                    Удалить
                  </button>
                </div>

                <div className="space-y-3 text-sm max-h-[calc(100vh-300px)] overflow-y-auto scrollbar-thin">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-xs font-medium text-[hsl(var(--muted-foreground))]">Название</div>
                      <div className="font-medium">{selectedIntegration.name}</div>
                    </div>
                    <div>
                      <div className="text-xs font-medium text-[hsl(var(--muted-foreground))]">Статус</div>
                      <div>{selectedIntegration.enabled ? '✅ Включена' : '⏸️ Выключена'}</div>
                    </div>
                  </div>

                  <div className="border-t border-[hsl(var(--border))] pt-3">
                    <div className="text-xs font-semibold text-[hsl(var(--muted-foreground))] mb-2">
                      {selectedIntegration.triggerType === 'webhook' ? '📥 Триггер: Webhook' : '🔄 Триггер: Polling'}
                    </div>
                    {selectedIntegration.triggerType === 'webhook' ? (
                      <>
                        {selectedIntegration.triggerCondition && (
                          <div>
                            <div className="text-xs text-[hsl(var(--muted-foreground))]">Условие</div>
                            <code className="text-xs break-all">{selectedIntegration.triggerCondition}</code>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="space-y-2">
                        {selectedIntegration.pollingUrl && (
                          <div>
                            <div className="text-xs text-[hsl(var(--muted-foreground))]">URL</div>
                            <code className="text-xs break-all">{selectedIntegration.pollingMethod || 'GET'} {selectedIntegration.pollingUrl}</code>
                          </div>
                        )}
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <div className="text-xs text-[hsl(var(--muted-foreground))]">Интервал</div>
                            <span>{selectedIntegration.pollingInterval || 60}s</span>
                          </div>
                          <div>
                            <div className="text-xs text-[hsl(var(--muted-foreground))]">Таймаут</div>
                            <span>{selectedIntegration.timeoutSec || 30}s</span>
                          </div>
                        </div>
                        {selectedIntegration.pollingHeaders && (
                          <div>
                            <div className="text-xs text-[hsl(var(--muted-foreground))]">Headers</div>
                            <code className="text-xs break-all">{selectedIntegration.pollingHeaders}</code>
                          </div>
                        )}
                        {selectedIntegration.pollingBody && (
                          <div>
                            <div className="text-xs text-[hsl(var(--muted-foreground))]">Body</div>
                            <code className="text-xs break-all">{selectedIntegration.pollingBody}</code>
                          </div>
                        )}
                        {selectedIntegration.pollingCondition && (
                          <div>
                            <div className="text-xs text-[hsl(var(--muted-foreground))]">Условие</div>
                            <code className="text-xs break-all">{selectedIntegration.pollingCondition}</code>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {selectedIntegration.actionUrl && (
                    <div className="border-t border-[hsl(var(--border))] pt-3">
                      <div className="text-xs font-semibold text-[hsl(var(--muted-foreground))] mb-2">🚀 Action (API)</div>
                      <div className="space-y-2">
                        <div>
                          <div className="text-xs text-[hsl(var(--muted-foreground))]">URL</div>
                          <code className="text-xs break-all">{selectedIntegration.actionMethod || 'POST'} {selectedIntegration.actionUrl}</code>
                        </div>
                        {selectedIntegration.actionHeaders && (
                          <div>
                            <div className="text-xs text-[hsl(var(--muted-foreground))]">Headers</div>
                            <code className="text-xs break-all">{selectedIntegration.actionHeaders}</code>
                          </div>
                        )}
                        {selectedIntegration.actionBody && (
                          <div>
                            <div className="text-xs text-[hsl(var(--muted-foreground))]">Body</div>
                            <code className="text-xs break-all">{selectedIntegration.actionBody}</code>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {(selectedIntegration.chatId || selectedIntegration.messageTemplate) && (
                    <div className="border-t border-[hsl(var(--border))] pt-3">
                      <div className="text-xs font-semibold text-[hsl(var(--muted-foreground))] mb-2">📱 Telegram</div>
                      <div className="space-y-2">
                        {selectedIntegration.chatId && (
                          <div>
                            <div className="text-xs text-[hsl(var(--muted-foreground))]">Chat ID</div>
                            <code className="text-xs">{selectedIntegration.chatId}</code>
                          </div>
                        )}
                        {selectedIntegration.botToken && (
                          <div>
                            <div className="text-xs text-[hsl(var(--muted-foreground))]">Bot Token</div>
                            <code className="text-xs">***настроен***</code>
                          </div>
                        )}
                        {selectedIntegration.messageTemplate && (
                          <div>
                            <div className="text-xs text-[hsl(var(--muted-foreground))]">Шаблон сообщения</div>
                            <pre className="text-xs whitespace-pre-wrap bg-[hsl(var(--muted)_/_0.3)] p-2 rounded mt-1">{selectedIntegration.messageTemplate}</pre>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </>
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
    </div>
  );
}
