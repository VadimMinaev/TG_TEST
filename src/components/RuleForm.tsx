import { useEffect, useState } from 'react';
import { Info } from 'lucide-react';
import { api, Rule } from '../lib/api';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './ui/tooltip';
import { TemplateHelp } from './TemplateHelp';

function InfoTooltip({ children }: { children: React.ReactNode }) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="ml-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] transition-colors hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--accent-foreground))]"
          >
            <Info className="h-3 w-3" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" className="max-w-xs text-left">
          {children}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

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
        <label htmlFor="ruleName" className="mb-2 flex items-center text-sm font-medium">
          Название правила
          <InfoTooltip>
            Уникальное имя для идентификации правила в списке. Рекомендуется использовать понятные названия, например: «Инциденты в основной чат» или «Уведомления о задачах».
          </InfoTooltip>
        </label>
        <input
          type="text"
          id="ruleName"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Например: Отправить в основной чат"
          required
          style={{ padding: '12px 16px' }}
          className="w-full rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--background))] transition-all focus:border-[hsl(var(--ring))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring)_/_0.2)]"
        />
      </div>

      <div>
        <label htmlFor="condition" className="mb-2 flex items-center text-sm font-medium">
          Условие (JavaScript выражение)
          <InfoTooltip>
            <div className="space-y-2">
              <p>JavaScript выражение, которое должно вернуть <code className="rounded bg-[hsl(var(--muted))] px-1">true</code> для срабатывания правила.</p>
              <p><strong>Доступные переменные:</strong></p>
              <ul className="list-inside list-disc">
                <li><code className="rounded bg-[hsl(var(--muted))] px-1">payload</code> — данные вебхука</li>
              </ul>
              <p><strong>Примеры:</strong></p>
              <ul className="list-inside list-disc">
                <li><code className="rounded bg-[hsl(var(--muted))] px-1">payload.status === "open"</code></li>
                <li><code className="rounded bg-[hsl(var(--muted))] px-1">payload.priority &gt; 3</code></li>
                <li><code className="rounded bg-[hsl(var(--muted))] px-1">payload.category === "incident"</code></li>
              </ul>
            </div>
          </InfoTooltip>
        </label>
        <textarea
          id="condition"
          value={condition}
          onChange={(e) => setCondition(e.target.value)}
          placeholder='payload.category === "incident"'
          required
          rows={4}
          style={{ padding: '12px 16px' }}
          className="w-full rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--background))] font-mono text-sm transition-all focus:border-[hsl(var(--ring))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring)_/_0.2)]"
        />
      </div>

      <div>
        <label htmlFor="chatId" className="mb-2 flex items-center text-sm font-medium">
          ID Telegram чата
          <InfoTooltip>
            <div className="space-y-2">
              <p>Числовой идентификатор чата/канала в Telegram.</p>
              <p><strong>Как получить:</strong></p>
              <ul className="list-inside list-disc">
                <li>Добавьте бота <code className="rounded bg-[hsl(var(--muted))] px-1">@userinfobot</code> в чат</li>
                <li>Или перешлите сообщение боту <code className="rounded bg-[hsl(var(--muted))] px-1">@getmyid_bot</code></li>
              </ul>
              <p><strong>Формат:</strong> для групп/каналов ID начинается с <code className="rounded bg-[hsl(var(--muted))] px-1">-100</code></p>
            </div>
          </InfoTooltip>
        </label>
        <input
          type="text"
          id="chatId"
          value={chatId}
          onChange={(e) => setChatId(e.target.value)}
          placeholder="Например: -1001234567890"
          required
          style={{ padding: '12px 16px' }}
          className="w-full rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--background))] transition-all focus:border-[hsl(var(--ring))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring)_/_0.2)]"
        />
      </div>

      <div>
        <label htmlFor="botToken" className="mb-2 flex items-center text-sm font-medium">
          Токен Telegram бота
          <InfoTooltip>
            <div className="space-y-2">
              <p>Токен бота для отправки сообщений. Если оставить пустым — используется глобальный токен из настроек.</p>
              <p><strong>Как получить:</strong></p>
              <ul className="list-inside list-disc">
                <li>Создайте бота через <code className="rounded bg-[hsl(var(--muted))] px-1">@BotFather</code></li>
                <li>Скопируйте токен из сообщения</li>
              </ul>
              <p>Формат: <code className="rounded bg-[hsl(var(--muted))] px-1">123456789:ABC...</code></p>
            </div>
          </InfoTooltip>
        </label>
        <input
          type="password"
          id="botToken"
          value={botToken}
          onChange={(e) => setBotToken(e.target.value)}
          placeholder="Оставьте пустым для глобального токена"
          style={{ padding: '12px 16px' }}
          className="w-full rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--background))] transition-all focus:border-[hsl(var(--ring))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring)_/_0.2)]"
        />
      </div>

      <div>
        <label htmlFor="messageTemplate" className="mb-2 flex items-center text-sm font-medium">
          Шаблон сообщения
          <TemplateHelp context="rule" />
        </label>
        <textarea
          id="messageTemplate"
          value={messageTemplate}
          onChange={(e) => setMessageTemplate(e.target.value)}
          placeholder="Оставьте пусто для автоформатирования"
          rows={4}
          style={{ padding: '12px 16px' }}
          className="w-full rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--background))] font-mono text-sm transition-all focus:border-[hsl(var(--ring))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring)_/_0.2)]"
        />
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
          style={{ padding: '12px 24px' }}
          className="flex-1 rounded-lg bg-[hsl(var(--primary))] font-semibold text-[hsl(var(--primary-foreground))] transition-all hover:bg-[hsl(var(--primary)_/_0.9)] disabled:opacity-50"
        >
          {loading ? 'Сохранение...' : 'Сохранить правило'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          style={{ padding: '12px 24px' }}
          className="flex-1 rounded-lg bg-[hsl(var(--secondary))] font-semibold text-[hsl(var(--secondary-foreground))] transition-all hover:bg-[hsl(var(--accent))]"
        >
          Отмена
        </button>
      </div>
    </form>
  );
}
