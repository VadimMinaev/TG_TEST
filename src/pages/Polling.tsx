import { useEffect, useMemo, useState } from 'react';
import { api, Poll } from '../lib/api';
import { Copy, Pencil, Play, Plus, RefreshCw, Trash2 } from 'lucide-react';

const DEFAULT_FORM = {
  name: '',
  url: '',
  method: 'GET',
  headersJson: '',
  bodyJson: '',
  conditionJson: '',
  intervalSec: 60,
  timeoutSec: 10,
  chatId: '',
  botToken: '',
  messageTemplate: '',
  enabled: true,
  onlyOnChange: false,
  continueAfterMatch: false,
};

const normalizeForm = (poll?: Poll) => ({
  name: poll?.name || '',
  url: poll?.url || '',
  method: poll?.method || 'GET',
  headersJson: poll?.headersJson || '',
  bodyJson: poll?.bodyJson || '',
  conditionJson: poll?.conditionJson || '',
  intervalSec: poll?.intervalSec ?? 60,
  timeoutSec: poll?.timeoutSec ?? 10,
  chatId: poll?.chatId || '',
  botToken: poll?.botToken || '',
  messageTemplate: poll?.messageTemplate || '',
  enabled: poll?.enabled ?? true,
  onlyOnChange: poll?.onlyOnChange ?? false,
  continueAfterMatch: poll?.continueAfterMatch ?? false,
});

export function Polling() {
  const [polls, setPolls] = useState<Poll[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPollId, setSelectedPollId] = useState<number | null>(null);
  const [editingPollId, setEditingPollId] = useState<number | null>(null);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  const selectedPoll = useMemo(
    () => polls.find((poll) => poll.id === selectedPollId) || null,
    [polls, selectedPollId]
  );

  const loadPolls = async () => {
    try {
      setLoading(true);
      const data = await api.getPolls();
      setPolls(data);
    } catch (error: any) {
      setMessage({ text: error.message || 'Не удалось загрузить пуллинг', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPolls();
  }, []);

  const handleSelectPoll = (id: number) => {
    setSelectedPollId(id);
    setEditingPollId(null);
  };

  const handleStartCreate = () => {
    setSelectedPollId(null);
    setEditingPollId(-1);
    setForm(DEFAULT_FORM);
  };

  const handleEditPoll = (poll: Poll) => {
    setSelectedPollId(poll.id);
    setEditingPollId(poll.id);
    setForm(normalizeForm(poll));
  };

  const handleSavePoll = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage(null);

    if (!form.name || !form.url || !form.chatId) {
      setMessage({ text: 'Укажите название, URL и chatId', type: 'error' });
      return;
    }

    try {
      const payload = {
        ...form,
        intervalSec: Number(form.intervalSec) || 60,
        timeoutSec: Number(form.timeoutSec) || 10,
        headersJson: form.headersJson || undefined,
        bodyJson: form.bodyJson || undefined,
        conditionJson: form.conditionJson || undefined,
        botToken: form.botToken || undefined,
        messageTemplate: form.messageTemplate || undefined,
      };

      if (editingPollId && editingPollId !== -1) {
        const updated = await api.updatePoll(editingPollId, payload);
        setPolls((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
        setSelectedPollId(updated.id);
        setEditingPollId(null);
        setMessage({ text: 'Пуллинг обновлён', type: 'success' });
      } else {
        const created = await api.createPoll(payload);
        setPolls((prev) => [created, ...prev]);
        setSelectedPollId(created.id);
        setEditingPollId(null);
        setMessage({ text: 'Пуллинг создан', type: 'success' });
      }
    } catch (error: any) {
      setMessage({ text: error.message || 'Не удалось сохранить пуллинг', type: 'error' });
    }
  };

  const handleDuplicatePoll = async (poll: Poll) => {
    try {
      const copyPayload = {
        ...normalizeForm(poll),
        name: `${poll.name} (копия)`,
        enabled: false,
      };
      const created = await api.createPoll(copyPayload);
      setPolls((prev) => [created, ...prev]);
      setSelectedPollId(created.id);
      setMessage({ text: 'Пуллинг продублирован', type: 'success' });
    } catch (error: any) {
      setMessage({ text: error.message || 'Не удалось дублировать пуллинг', type: 'error' });
    }
  };

  const handleDeletePoll = async (poll: Poll) => {
    if (!confirm(`Удалить пуллинг "${poll.name}"?`)) return;
    try {
      await api.deletePoll(poll.id);
      setPolls((prev) => prev.filter((p) => p.id !== poll.id));
      if (selectedPollId === poll.id) {
        setSelectedPollId(null);
        setEditingPollId(null);
      }
      setMessage({ text: 'Пуллинг удалён', type: 'success' });
    } catch (error: any) {
      setMessage({ text: error.message || 'Не удалось удалить пуллинг', type: 'error' });
    }
  };

  const handleRunPoll = async (poll: Poll) => {
    try {
      await api.runPoll(poll.id);
      setMessage({ text: 'Запуск выполнен', type: 'success' });
    } catch (error: any) {
      setMessage({ text: error.message || 'Не удалось запустить пуллинг', type: 'error' });
    }
  };

  return (
    <div className="card">
      <div className="card-header">
        <h2 className="text-xl font-semibold">🔁 Пуллинг</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => loadPolls()}
            className="rounded border border-[hsl(var(--border))] bg-[hsl(var(--secondary))] p-2 transition-all hover:bg-[hsl(var(--accent))]"
            title="Обновить список"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <button
            onClick={handleStartCreate}
            className="inline-flex items-center gap-2 rounded bg-[hsl(var(--primary))] px-4 py-2 text-sm font-semibold text-[hsl(var(--primary-foreground))] transition-all hover:bg-[hsl(var(--primary)_/_0.9)]"
          >
            <Plus className="h-4 w-4" />
            Создать пуллинг
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
              <h3 className="text-sm font-semibold">📋 Список задач</h3>
              <button
                onClick={() => loadPolls()}
                className="rounded border border-[hsl(var(--border))] px-2 py-1 text-xs"
              >
                Обновить
              </button>
            </div>
            {loading ? (
              <div className="flex items-center justify-center py-10">
                <div className="h-6 w-6 animate-spin rounded-full border-4 border-[hsl(var(--primary))] border-t-transparent" />
              </div>
            ) : polls.length === 0 ? (
              <p className="py-10 text-center text-sm text-[hsl(var(--muted-foreground))]">Задачи не найдены</p>
            ) : (
              <div className="max-h-[calc(100vh-320px)] overflow-y-auto">
                <table className="table-basic w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-[hsl(var(--border))] text-left text-xs">
                      <th className="px-2 py-2">Название</th>
                      <th className="px-2 py-2">Интервал</th>
                      <th className="px-2 py-2">Статус</th>
                    </tr>
                  </thead>
                  <tbody>
                    {polls.map((poll) => (
                      <tr
                        key={poll.id}
                        onClick={() => handleSelectPoll(poll.id)}
                        className={`cursor-pointer border-b border-[hsl(var(--border))] transition-colors hover:bg-[hsl(var(--accent))] ${
                          selectedPollId === poll.id ? 'bg-[hsl(var(--accent))]' : ''
                        }`}
                      >
                        <td className="px-2 py-2 font-medium">{poll.name}</td>
                        <td className="px-2 py-2">{poll.intervalSec}s</td>
                        <td className="px-2 py-2">{poll.enabled ? '✅ Вкл' : '⏸️ Выкл'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="split-right">
          {editingPollId !== null ? (
            <div className="panel">
              <h3 className="mb-4 text-lg font-semibold">
                {editingPollId === -1 ? 'Создание задачи' : 'Редактирование задачи'}
              </h3>
              <form onSubmit={handleSavePoll} className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-2 block text-sm font-medium">Название</label>
                  <input
                    className="w-full rounded border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Например: Проверка статуса заказа"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium">URL</label>
                  <input
                    className="w-full rounded border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm"
                    value={form.url}
                    onChange={(e) => setForm({ ...form, url: e.target.value })}
                    placeholder="https://api.example.com/status"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium">Chat ID</label>
                  <input
                    className="w-full rounded border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm"
                    value={form.chatId}
                    onChange={(e) => setForm({ ...form, chatId: e.target.value })}
                    placeholder="-1001234567890"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium">Метод</label>
                  <select
                    className="w-full rounded border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm"
                    value={form.method}
                    onChange={(e) => setForm({ ...form, method: e.target.value })}
                  >
                    <option value="GET">GET</option>
                    <option value="POST">POST</option>
                    <option value="PUT">PUT</option>
                    <option value="PATCH">PATCH</option>
                    <option value="DELETE">DELETE</option>
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium">Интервал (сек)</label>
                  <input
                    type="number"
                    min={5}
                    className="w-full rounded border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm"
                    value={form.intervalSec}
                    onChange={(e) => setForm({ ...form, intervalSec: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium">Таймаут (сек)</label>
                  <input
                    type="number"
                    min={3}
                    className="w-full rounded border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm"
                    value={form.timeoutSec}
                    onChange={(e) => setForm({ ...form, timeoutSec: Number(e.target.value) })}
                  />
                </div>
                <div className="col-span-2">
                  <label className="mb-2 block text-sm font-medium">Headers (JSON)</label>
                  <textarea
                    rows={3}
                    className="w-full rounded border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm font-mono"
                    value={form.headersJson}
                    onChange={(e) => setForm({ ...form, headersJson: e.target.value })}
                    placeholder='{"Authorization": "Bearer token"}'
                  />
                  <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
                    Пример: <code>{'{"Authorization":"Bearer <TOKEN>","Content-Type":"application/json"}'}</code>
                  </p>
                </div>
                <div className="col-span-2">
                  <label className="mb-2 block text-sm font-medium">Body (JSON)</label>
                  <textarea
                    rows={3}
                    className="w-full rounded border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm font-mono"
                    value={form.bodyJson}
                    onChange={(e) => setForm({ ...form, bodyJson: e.target.value })}
                    placeholder='{"id": 123}'
                  />
                </div>
                <div className="col-span-2">
                  <label className="mb-2 block text-sm font-medium">Условия (JSON)</label>
                  <textarea
                    rows={4}
                    className="w-full rounded border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm font-mono"
                    value={form.conditionJson}
                    onChange={(e) => setForm({ ...form, conditionJson: e.target.value })}
                    placeholder='{"logic":"AND","conditions":[{"path":"data.status","op":"==","value":"ok"}]}'
                  />
                  <div className="mt-2 rounded border border-[hsl(var(--border)_/_0.6)] bg-[hsl(var(--muted)_/_0.2)] p-3 text-xs">
                    <div className="mb-1 font-semibold">Пример:</div>
                    <pre className="whitespace-pre-wrap">{`{"logic":"AND","conditions":[{"path":"data.status","op":"==","value":"ok"},{"path":"data.priority","op":">=","value":3}]}`}</pre>
                    <div className="mt-2 text-[hsl(var(--muted-foreground))]">
                      <code>logic</code> — AND/OR. <code>conditions</code> — массив проверок. <code>path</code> — путь к
                      полю. <code>op</code> — оператор (==, !=, &gt;, &lt;, &gt;=, &lt;=, includes, exists).
                    </div>
                  </div>
                </div>
                <div className="col-span-2">
                  <label className="mb-2 block text-sm font-medium">Шаблон сообщения (опционально)</label>
                  <textarea
                    rows={3}
                    className="w-full rounded border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm"
                    value={form.messageTemplate}
                    onChange={(e) => setForm({ ...form, messageTemplate: e.target.value })}
                    placeholder="Оставьте пусто для полного payload"
                  />
                </div>
                <div className="col-span-2 flex items-center gap-4">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={form.enabled}
                      onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
                    />
                    Включено
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={form.onlyOnChange}
                      onChange={(e) => setForm({ ...form, onlyOnChange: e.target.checked })}
                    />
                    Только при изменении
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={form.continueAfterMatch}
                      onChange={(e) => setForm({ ...form, continueAfterMatch: e.target.checked })}
                    />
                    Продолжать после совпадения
                  </label>
                </div>
                <div className="col-span-2 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingPollId(null);
                      if (selectedPoll) {
                        setForm(normalizeForm(selectedPoll));
                      }
                    }}
                    className="rounded border border-[hsl(var(--border))] px-4 py-2 text-sm"
                  >
                    Отмена
                  </button>
                  <button
                    type="submit"
                    className="rounded bg-[hsl(var(--primary))] px-4 py-2 text-sm font-semibold text-[hsl(var(--primary-foreground))]"
                  >
                    Сохранить
                  </button>
                </div>
              </form>
            </div>
          ) : selectedPoll ? (
            <div className="space-y-4 rounded-lg border border-[hsl(var(--border)_/_0.6)] bg-[hsl(var(--card))] p-5">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => handleRunPoll(selectedPoll)}
                  className="flex items-center gap-2 rounded border border-[hsl(var(--border))] px-3 py-2 text-sm"
                >
                  <Play className="h-4 w-4" /> Запустить
                </button>
                <button
                  onClick={() => handleEditPoll(selectedPoll)}
                  className="flex items-center gap-2 rounded border border-[hsl(var(--border))] px-3 py-2 text-sm"
                >
                  <Pencil className="h-4 w-4" /> Редактировать
                </button>
                <button
                  onClick={() => handleDuplicatePoll(selectedPoll)}
                  className="flex items-center gap-2 rounded border border-[hsl(var(--border))] px-3 py-2 text-sm"
                >
                  <Copy className="h-4 w-4" /> Дублировать
                </button>
                <button
                  onClick={() => handleDeletePoll(selectedPoll)}
                  className="flex items-center gap-2 rounded border border-[hsl(var(--destructive))] px-3 py-2 text-sm text-[hsl(var(--destructive))]"
                >
                  <Trash2 className="h-4 w-4" /> Удалить
                </button>
              </div>

              <div className="rounded border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 text-sm">
                <div className="mb-2">
                  <strong>ID:</strong> <code>{selectedPoll.id}</code>
                </div>
                <div className="mb-2">
                  <strong>Название:</strong> {selectedPoll.name}
                </div>
                <div className="mb-2">
                  <strong>URL:</strong> <code>{selectedPoll.url}</code>
                </div>
                <div className="mb-2">
                  <strong>Метод:</strong> {selectedPoll.method}
                </div>
                <div className="mb-2">
                  <strong>Интервал:</strong> {selectedPoll.intervalSec}s
                </div>
                <div className="mb-2">
                  <strong>Таймаут:</strong> {selectedPoll.timeoutSec}s
                </div>
                <div className="mb-2">
                  <strong>Chat ID:</strong> <code>{selectedPoll.chatId}</code>
                </div>
                <div className="mb-2">
                  <strong>Статус:</strong> {selectedPoll.enabled ? '✅ Включено' : '⏸️ Выключено'}
                </div>
              </div>

              {selectedPoll.messageTemplate && (
                <div className="rounded border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
                  <div className="mb-2 text-sm font-medium">Шаблон сообщения</div>
                  <pre className="whitespace-pre-wrap text-xs">{selectedPoll.messageTemplate}</pre>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-lg border border-[hsl(var(--border)_/_0.6)] bg-[hsl(var(--card))] p-10 text-center text-[hsl(var(--muted-foreground))]">
              <p className="mb-4">Выберите задачу слева или создайте новую</p>
              <button
                onClick={handleStartCreate}
                className="inline-flex items-center gap-2 rounded bg-[hsl(var(--primary))] px-4 py-2 font-semibold text-[hsl(var(--primary-foreground))]"
              >
                <Plus className="h-4 w-4" /> Создать задачу
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
