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
import { TelegramPreviewWithToggle } from './TelegramPreviewWithToggle';

function InfoTooltip({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip open={open} onOpenChange={setOpen}>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setOpen((prev) => !prev);
            }}
            className="ml-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] transition-colors hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--accent-foreground))]"
            aria-label="Показать подсказку"
          >
            <Info className="h-3 w-3" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" className="max-w-xs text-left" onPointerDownOutside={() => setOpen(false)}>
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

  // Пример payload для предварительного просмотра
  const payloadExample = {
    id: 12345,
    subject: 'Новая заявка в техподдержку',
    status: 'open',
    category: 'incident',
    priority: 'high',
    impact: 'medium',
    team_name: 'Support Team',
    requested_by: {
      name: 'Иван Петров',
      account: {
        name: 'Acme Corp'
      }
    },
    note: [
      {
        person: { name: 'Алексей Сидоров' },
        text: 'Проверяю проблему',
        created_at: '2023-05-15T10:30:00Z'
      }
    ]
  };

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
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {error && (
        <div style={{ padding: '12px 16px', borderRadius: '8px', border: '1px solid hsl(var(--destructive) / 0.2)', background: 'hsl(var(--destructive) / 0.1)', color: 'hsl(var(--destructive))', fontSize: '14px' }}>
          {error}
        </div>
      )}

      <div>
        <label htmlFor="ruleName" style={{ display: 'flex', alignItems: 'center', marginBottom: '16px', fontSize: '14px', fontWeight: 500 }}>
          Название Webhook
          <InfoTooltip>
            Уникальное имя для идентификации Webhook в списке. Рекомендуется использовать понятные названия, например: «Инциденты в основной чат» или «Уведомления о задачах».
          </InfoTooltip>
        </label>
        <input
          type="text"
          id="ruleName"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Например: Отправить в основной чат"
          required
          style={{ padding: '12px 16px', width: '100%', borderRadius: '8px', border: '1px solid hsl(var(--input))', background: 'hsl(var(--background))' }}
        />
      </div>

      <div>
        <label htmlFor="condition" style={{ display: 'flex', alignItems: 'center', marginBottom: '16px', fontSize: '14px', fontWeight: 500 }}>
          Условие (JavaScript выражение)
          <InfoTooltip>
            <div className="space-y-2">
              <p>JavaScript выражение, которое должно вернуть <code className="rounded bg-[hsl(var(--muted))] px-1">true</code> для срабатывания Webhook.</p>
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
          style={{ padding: '12px 16px', width: '100%', borderRadius: '8px', border: '1px solid hsl(var(--input))', background: 'hsl(var(--background))', fontFamily: 'monospace', fontSize: '14px', resize: 'vertical' }}
        />
      </div>

      <div>
        <label htmlFor="chatId" style={{ display: 'flex', alignItems: 'center', marginBottom: '16px', fontSize: '14px', fontWeight: 500 }}>
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
          style={{ padding: '12px 16px', width: '100%', borderRadius: '8px', border: '1px solid hsl(var(--input))', background: 'hsl(var(--background))' }}
        />
      </div>

      <div>
        <label htmlFor="botToken" style={{ display: 'flex', alignItems: 'center', marginBottom: '16px', fontSize: '14px', fontWeight: 500 }}>
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
          style={{ padding: '12px 16px', width: '100%', borderRadius: '8px', border: '1px solid hsl(var(--input))', background: 'hsl(var(--background))' }}
        />
      </div>

      <div>
        <label htmlFor="messageTemplate" style={{ display: 'flex', alignItems: 'center', marginBottom: '16px', fontSize: '14px', fontWeight: 500 }}>
          Шаблон сообщения
          <TemplateHelp context="rule" />
        </label>
        <textarea
          id="messageTemplate"
          value={messageTemplate}
          onChange={(e) => setMessageTemplate(e.target.value)}
          placeholder="Оставьте пусто для автоформатирования"
          rows={4}
          style={{ padding: '12px 16px', width: '100%', borderRadius: '8px', border: '1px solid hsl(var(--input))', background: 'hsl(var(--background))', fontFamily: 'monospace', fontSize: '14px', resize: 'vertical' }}
        />
      </div>

      <div>
        <TelegramPreviewWithToggle
          message={messageTemplate}
          payload={payloadExample}
          context="rule"
        />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '4px' }}>
        <input
          type="checkbox"
          id="enabled"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          style={{ width: '18px', height: '18px', cursor: 'pointer' }}
        />
        <label htmlFor="enabled" style={{ cursor: 'pointer', fontSize: '14px', fontWeight: 500 }}>
          Включено
        </label>
      </div>

      <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
        <button
          type="submit"
          disabled={loading}
          style={{ flex: 1, padding: '14px 24px', borderRadius: '8px', background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))', fontWeight: 600, cursor: 'pointer', border: 'none', opacity: loading ? 0.5 : 1 }}
        >
          {loading ? 'Сохранение...' : 'Сохранить Webhook'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          style={{ flex: 1, padding: '14px 24px', borderRadius: '8px', background: 'hsl(var(--secondary))', color: 'hsl(var(--secondary-foreground))', fontWeight: 600, cursor: 'pointer', border: 'none' }}
        >
          Отмена
        </button>
      </div>
    </form>
  );
}
