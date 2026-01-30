import { useEffect, useState } from 'react';
import { api, Rule } from '../lib/api';

interface RuleFormProps {
  ruleId: number | null;
  onSave: (rule: Partial<Rule>) => Promise<void>;
  onCancel: () => void;
}

export function RuleForm({ ruleId, onSave, onCancel }: RuleFormProps) {
  const [name, setName] = useState('');
  const [condition, setCondition] = useState('payload.category === "incident"');
  const [chatId, setChatId] = useState('');
  const [botToken, setBotToken] = useState('');
  const [messageTemplate, setMessageTemplate] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (ruleId) {
      loadRule();
    }
  }, [ruleId]);

  const loadRule = async () => {
    if (!ruleId) return;
    try {
      const rule = await api.getRule(ruleId);
      setName(rule.name);
      setCondition(rule.condition);
      setChatId(rule.chatId);
      setBotToken(rule.botToken || '');
      setMessageTemplate(rule.messageTemplate || '');
      setEnabled(rule.enabled);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name || !condition || !chatId) {
      setError('Заполните все обязательные поля');
      return;
    }

    setLoading(true);
    try {
      await onSave({
        name,
        condition,
        chatId,
        botToken: botToken || undefined,
        messageTemplate: messageTemplate || undefined,
        enabled,
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="animate-fade-in rounded border border-[hsl(var(--destructive)_/_0.2)] bg-[hsl(var(--destructive)_/_0.1)] p-3 text-sm text-[hsl(var(--destructive))]">
          {error}
        </div>
      )}

      <div>
        <label htmlFor="ruleName" className="mb-2 block text-sm font-medium">
          Название правила
        </label>
        <input
          type="text"
          id="ruleName"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Например: Отправить в основной чат"
          required
          className="w-full rounded border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 transition-all focus:border-[hsl(var(--ring))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring)_/_0.2)]"
        />
        <small className="mt-1 block text-xs text-[hsl(var(--muted-foreground))]">
          Краткое описание правила для быстрой идентификации
        </small>
      </div>

      <div>
        <label htmlFor="condition" className="mb-2 block text-sm font-medium">
          Условие (JavaScript выражение)
        </label>
        <textarea
          id="condition"
          value={condition}
          onChange={(e) => setCondition(e.target.value)}
          placeholder='payload.category === "incident"'
          required
          rows={4}
          className="w-full rounded border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 font-mono text-sm transition-all focus:border-[hsl(var(--ring))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring)_/_0.2)]"
        />
        <small className="mt-1 block text-xs text-[hsl(var(--muted-foreground))]">
          Доступна переменная <code>payload</code> с данными вебхука
        </small>
      </div>

      <div>
        <label htmlFor="chatId" className="mb-2 block text-sm font-medium">
          ID Telegram чата
        </label>
        <input
          type="text"
          id="chatId"
          value={chatId}
          onChange={(e) => setChatId(e.target.value)}
          placeholder="Например: -1001234567890"
          required
          className="w-full rounded border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 transition-all focus:border-[hsl(var(--ring))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring)_/_0.2)]"
        />
        <small className="mt-1 block text-xs text-[hsl(var(--muted-foreground))]">
          Для группы/канала используйте отрицательное число
        </small>
      </div>

      <div>
        <label htmlFor="botToken" className="mb-2 block text-sm font-medium">
          Токен Telegram бота (опционально)
        </label>
        <input
          type="password"
          id="botToken"
          value={botToken}
          onChange={(e) => setBotToken(e.target.value)}
          placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
          className="w-full rounded border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 transition-all focus:border-[hsl(var(--ring))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring)_/_0.2)]"
        />
        <small className="mt-1 block text-xs text-[hsl(var(--muted-foreground))]">
          Оставьте пустым, чтобы использовать глобальный токен
        </small>
      </div>

      <div>
        <label htmlFor="messageTemplate" className="mb-2 block text-sm font-medium">
          Шаблон сообщения (опционально)
        </label>
        <textarea
          id="messageTemplate"
          value={messageTemplate}
          onChange={(e) => setMessageTemplate(e.target.value)}
          placeholder="Оставьте пусто для отправки полного payload"
          rows={4}
          className="w-full rounded border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 font-mono text-sm transition-all focus:border-[hsl(var(--ring))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring)_/_0.2)]"
        />
        <small className="mt-1 block text-xs text-[hsl(var(--muted-foreground))]">
          Используйте <code>{'${payload}'}</code> для вставки данных
        </small>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="enabled"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="h-4 w-4 cursor-pointer"
        />
        <label htmlFor="enabled" className="cursor-pointer text-sm font-medium">
          Включено
        </label>
      </div>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={loading}
          className="flex-1 rounded bg-[hsl(var(--primary))] px-4 py-2 font-semibold text-[hsl(var(--primary-foreground))] transition-all hover:bg-[hsl(var(--primary)_/_0.9)] disabled:opacity-50"
        >
          {loading ? 'Сохранение...' : 'Сохранить правило'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded bg-[hsl(var(--secondary))] px-4 py-2 font-semibold text-[hsl(var(--secondary-foreground))] transition-all hover:bg-[hsl(var(--accent))]"
        >
          Отмена
        </button>
      </div>
    </form>
  );
}
