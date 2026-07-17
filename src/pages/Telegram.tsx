import { Bot, Clock, Settings, Sparkles } from 'lucide-react';
import type { ReactNode } from 'react';
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

  const tabs: Array<{ id: TelegramTab; label: string; icon: ReactNode }> = [
    { id: 'automation', label: 'Автоматизация', icon: <Bot className="h-4 w-4" /> },
    { id: 'ai-bots', label: 'AI-боты', icon: <Sparkles className="h-4 w-4" /> },
    { id: 'reminders', label: 'Напоминания', icon: <Clock className="h-4 w-4" /> },
  ];

  const updateTab = (nextTab: TelegramTab, settings = false) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', nextTab);
    if (nextTab === 'reminders' && settings) next.set('settings', 'true');
    else next.delete('settings');
    setSearchParams(next);
  };

  return (
    <div className="operations-page telegram-page">
      <div className="card operations-tabs-card telegram-tabs-card">
        <div className="card-body">
          <div className="operations-tabbar" role="tablist" aria-label="Разделы Telegram">
            {tabs.map((item) => (
              <button key={item.id} type="button" role="tab" aria-selected={tab === item.id && !showReminderSettings} onClick={() => updateTab(item.id)} className={`operations-tab-btn ${tab === item.id && !showReminderSettings ? 'operations-tab-btn-active' : ''}`}>
                <span className="inline-flex items-center gap-2">{item.icon}{item.label}</span>
              </button>
            ))}
            {tab === 'reminders' && (
              <button type="button" role="tab" aria-selected={showReminderSettings} onClick={() => updateTab('reminders', !showReminderSettings)} className={`operations-tab-btn telegram-settings-tab ${showReminderSettings ? 'operations-tab-btn-active' : ''}`} title={showReminderSettings ? 'К списку напоминаний' : 'Настройки бота напоминаний'}>
                <span className="inline-flex items-center gap-2"><Settings className="h-4 w-4" />{showReminderSettings ? 'К напоминаниям' : 'Настройки'}</span>
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
