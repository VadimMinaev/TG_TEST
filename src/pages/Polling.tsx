import { useEffect, useState } from 'react';
import { api, Poll } from '../lib/api';
import { Plus, RefreshCw } from 'lucide-react';

const DEFAULT_FORM = {
  name: '',
  url: '',
  method: 'GET',
  intervalSec: 60,
  timeoutSec: 10,
  chatId: '',
  botToken: '',
  messageTemplate: '',
  enabled: true,
  onlyOnChange: false,
  continueAfterMatch: false,
};

export function Polling() {
  const [polls, setPolls] = useState<Poll[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

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

  const handleCreatePoll = async (event: React.FormEvent) => {
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
        botToken: form.botToken || undefined,
        messageTemplate: form.messageTemplate || undefined,
      };
      const created = await api.createPoll(payload);
      setPolls((prev) => [created, ...prev]);
      setMessage({ text: 'Пуллинг создан', type: 'success' });
      setForm(DEFAULT_FORM);
      setCreating(false);
    } catch (error: any) {
      setMessage({ text: error.message || 'Не удалось создать пуллинг', type: 'error' });
    }
  };

  return (
    <div className="rounded-lg border border-[hsl(var(--border)_/_0.7)] bg-[hsl(var(--card)_/_0.9)] shadow-md backdrop-blur-sm">
      <div className="flex items-center justify-between border-b border-[hsl(var(--border))] p-4">
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
            onClick={() => setCreating((prev) => !prev)}
            className="inline-flex items-center gap-2 rounded bg-[hsl(var(--primary))] px-4 py-2 text-sm font-semibold text-[hsl(var(--primary-foreground))] transition-all hover:bg-[hsl(var(--primary)_/_0.9)]"
          >
            <Plus className="h-4 w-4" />
            Создать пуллинг
          </button>
        </div>
      </div>

      {message && (
        <div
          className={`mx-4 mt-4 animate-fade-in rounded border p-3 text-sm ${
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

      {creating && (
        <form onSubmit={handleCreatePoll} className="mx-4 mt-4 grid grid-cols-2 gap-4 rounded border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-4">
          <div>
            <label className="mb-2 block text-sm font-medium">Название</label>
            <input
              className="w-full rounded border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Например: Проверка статуса"
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
              onClick={() => setCreating(false)}
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
      )}

      <div className="p-4">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-[hsl(var(--primary))] border-t-transparent" />
          </div>
        ) : polls.length === 0 ? (
          <p className="text-center text-sm text-[hsl(var(--muted-foreground))]">Пуллинги не найдены</p>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b-2 border-[hsl(var(--border))] text-left text-sm">
                <th className="p-2">Название</th>
                <th className="p-2">URL</th>
                <th className="p-2">Интервал</th>
                <th className="p-2">Канал</th>
                <th className="p-2">Статус</th>
              </tr>
            </thead>
            <tbody>
              {polls.map((poll) => (
                <tr key={poll.id} className="border-b border-[hsl(var(--border))] text-sm">
                  <td className="p-2 font-medium">{poll.name}</td>
                  <td className="p-2">
                    <code className="text-xs">{poll.url}</code>
                  </td>
                  <td className="p-2">{poll.intervalSec}s</td>
                  <td className="p-2">
                    <code className="text-xs">{poll.chatId}</code>
                  </td>
                  <td className="p-2">{poll.enabled ? '✅ Вкл' : '⏸️ Выкл'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
