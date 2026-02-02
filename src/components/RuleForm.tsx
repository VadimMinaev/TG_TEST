import { useEffect, useState } from 'react';
import { Info } from 'lucide-react';
import { api, Rule } from '../lib/api';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './ui/tooltip';

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
          <InfoTooltip>Понятное имя для идентификации правила</InfoTooltip>
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
      </div>

      <div>
        <label htmlFor="condition" className="mb-2 flex items-center text-sm font-medium">
          Условие (JavaScript выражение)
          <InfoTooltip>
            <div>
              <code className="text-[10px]">payload.status === "open"</code>
              <br />
              <code className="text-[10px]">payload.category === "incident"</code>
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
          className="w-full rounded border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 font-mono text-sm transition-all focus:border-[hsl(var(--ring))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring)_/_0.2)]"
        />
      </div>

      <div>
        <label htmlFor="chatId" className="mb-2 flex items-center text-sm font-medium">
          ID Telegram чата
          <InfoTooltip>
            Получить через @userinfobot или @getmyid_bot
          </InfoTooltip>
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
      </div>

      <div>
        <label htmlFor="botToken" className="mb-2 flex items-center text-sm font-medium">
          Токен Telegram бота
          <InfoTooltip>
            Пустое = глобальный токен. Получить через @BotFather
          </InfoTooltip>
        </label>
        <input
          type="password"
          id="botToken"
          value={botToken}
          onChange={(e) => setBotToken(e.target.value)}
          placeholder="Оставьте пустым для глобального токена"
          className="w-full rounded border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 transition-all focus:border-[hsl(var(--ring))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring)_/_0.2)]"
        />
      </div>

      <div>
        <label htmlFor="messageTemplate" className="mb-2 flex items-center text-sm font-medium">
          Шаблон сообщения
          <InfoTooltip>
            Пустое = авто. Пример: {`\${payload.subject}`}
          </InfoTooltip>
        </label>
        <textarea
          id="messageTemplate"
          value={messageTemplate}
          onChange={(e) => setMessageTemplate(e.target.value)}
          placeholder="Оставьте пусто для автоформатирования"
          rows={4}
          className="w-full rounded border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 font-mono text-sm transition-all focus:border-[hsl(var(--ring))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring)_/_0.2)]"
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
