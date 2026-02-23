import { Bot, Clock, MessageSquareText, Settings, Sparkles } from 'lucide-react';
import { useMemo } from 'react';
import { useSearchParams } from 'react-router';
import { AiBots } from './AiBots';
import { Bots } from './Bots';
import { ReminderSettingsPage } from './ReminderSettings';
import { Reminders } from './Reminders';

type TelegramTab = 'automation' | 'ai-bots' | 'reminders';

function parseTab(rawTab: string | null): TelegramTab {
  if (rawTab === 'ai-bots') return 'ai-bots';
  if (rawTab === 'reminders') return 'reminders';
  return 'automation';
}

export function Telegram() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = parseTab(searchParams.get('tab'));
  const showReminderSettings = tab === 'reminders' && searchParams.get('settings') === 'true';

  const tabs = useMemo(
    () => [
      { id: 'automation' as const, label: 'Автоматизация / Уведомления', icon: <Bot className="h-4 w-4" /> },
      { id: 'ai-bots' as const, label: 'AI-боты', icon: <Sparkles className="h-4 w-4" /> },
      { id: 'reminders' as const, label: 'Напоминания', icon: <Clock className="h-4 w-4" /> },
    ],
    []
  );

  const switchTab = (nextTab: TelegramTab) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', nextTab);
    if (nextTab !== 'reminders') {
      next.delete('settings');
    }
    setSearchParams(next);
  };

  return (
    <div className="space-y-3">
      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <MessageSquareText className="h-5 w-5" />
              Telegram
            </h2>
            <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
              Единая точка управления Telegram-ботами, AI-ботами и напоминаниями.
            </p>
          </div>
        </div>
        <div className="px-4 pb-4">
          <div className="flex flex-wrap gap-2">
            {tabs.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => switchTab(item.id)}
                className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors ${
                  tab === item.id
                    ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary)_/_0.12)] text-[hsl(var(--primary))]'
                    : 'border-[hsl(var(--border))] hover:bg-[hsl(var(--accent))]'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            ))}

            {tab === 'reminders' && (
              <button
                type="button"
                onClick={() => {
                  const next = new URLSearchParams(searchParams);
                  next.set('tab', 'reminders');
                  next.set('settings', showReminderSettings ? 'false' : 'true');
                  setSearchParams(next);
                }}
                className="ml-auto inline-flex items-center gap-2 rounded-md border border-[hsl(var(--border))] px-3 py-2 text-sm hover:bg-[hsl(var(--accent))]"
                title={showReminderSettings ? 'К списку напоминаний' : 'Настройки бота напоминаний'}
              >
                <Settings className="h-4 w-4" />
                <span>{showReminderSettings ? 'К напоминаниям' : 'Настройки напоминаний'}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {tab === 'automation' && <Bots />}
      {tab === 'ai-bots' && <AiBots />}
      {tab === 'reminders' && (showReminderSettings ? <ReminderSettingsPage /> : <Reminders />)}
    </div>
  );
}
