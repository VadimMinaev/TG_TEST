import { useState, useEffect } from 'react';
import { useToast } from '../components/ToastNotification';
import { Save, Bot, Key, Link as LinkIcon, RefreshCw, Check, Copy, Trash2 } from 'lucide-react';
import { useSearchParams } from 'react-router';

interface ReminderSettings {
  botToken: string;
  botUsername: string;
  webhookUrl: string;
  webhookSet: boolean;
}

export function ReminderSettingsPage() {
  const { addToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tokenCopied, setTokenCopied] = useState(false);
  const [webhookCopied, setWebhookCopied] = useState(false);
  const [settings, setSettings] = useState<ReminderSettings>({
    botToken: '',
    botUsername: '',
    webhookUrl: '',
    webhookSet: false,
  });

  const loadSettings = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/reminders/settings', {
        headers: { Authorization: `Bearer ${localStorage.getItem('authToken')}` }
      });
      if (response.ok) {
        const data = await response.json();
        setSettings(prev => ({
          ...prev,
          botToken: data.botToken || '',
          botUsername: data.botUsername || '',
          webhookUrl: data.webhookUrl || '',
          webhookSet: data.webhookSet || false,
        }));
      }
    } catch (error: any) {
      addToast(error.message || 'Не удалось загрузить настройки', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadSettings(); }, []);

  const handleSaveToken = async () => {
    if (!settings.botToken || settings.botToken === 'YOUR_TOKEN') {
      addToast('Введите корректный токен бота', 'error');
      return;
    }
    try {
      setSaving(true);
      const response = await fetch('/api/reminders/settings/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({ botToken: settings.botToken })
      });
      if (response.ok) {
        const data = await response.json();
        setSettings(prev => ({ ...prev, botUsername: data.botUsername }));
        addToast('Токен сохранён', 'success');
      } else {
        const error = await response.json();
        addToast(error.error || 'Ошибка сохранения', 'error');
      }
    } catch (error: any) {
      addToast(error.message || 'Ошибка сохранения токена', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSetWebhook = async () => {
    if (!settings.botToken || settings.botToken === 'YOUR_TOKEN') {
      addToast('Сначала сохраните токен бота', 'error');
      return;
    }
    try {
      setSaving(true);
      const response = await fetch('/api/reminders/settings/webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({})
      });
      if (response.ok) {
        const data = await response.json();
        setSettings(prev => ({ ...prev, webhookUrl: data.webhookUrl, webhookSet: data.ok }));
        addToast(`Webhook установлен: ${data.webhookUrl}`, 'success');
      } else {
        const error = await response.json();
        addToast(error.error || 'Ошибка установки webhook', 'error');
      }
    } catch (error: any) {
      addToast(error.message || 'Ошибка установки webhook', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteWebhook = async () => {
    if (!window.confirm('Удалить webhook? Бот перестанет получать сообщения.')) return;
    try {
      setSaving(true);
      const response = await fetch('/api/reminders/settings/webhook', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('authToken')}` }
      });
      if (response.ok) {
        setSettings(prev => ({ ...prev, webhookSet: false }));
        addToast('Webhook удалён', 'success');
      } else {
        const error = await response.json();
        addToast(error.error || 'Ошибка', 'error');
      }
    } catch (error: any) {
      addToast(error.message || 'Ошибка', 'error');
    } finally {
      setSaving(false);
    }
  };

  const webhookUrl = `${window.location.origin}/api/telegram/webhook`;

  const handleCopyWebhook = () => {
    navigator.clipboard?.writeText(webhookUrl).then(() => {
      setWebhookCopied(true);
      setTimeout(() => setWebhookCopied(false), 2000);
    });
  };

  const tabs = [
    { id: 'automation', label: 'Автоматизация', icon: 'bolt' },
    { id: 'ai-bots', label: 'AI-боты', icon: 'robot' },
    { id: 'reminders', label: 'Напоминания', icon: 'clock', active: true },
    { id: 'reminders-settings', label: 'К напоминаниям', icon: 'settings' },
  ];

  const switchTab = (id: string) => {
    const next = new URLSearchParams(searchParams);
    if (id === 'reminders-settings') {
      next.set('tab', 'reminders');
      next.set('settings', 'true');
    } else if (id === 'reminders') {
      next.set('tab', 'reminders');
      next.delete('settings');
    } else {
      next.set('tab', id);
      next.delete('settings');
    }
    setSearchParams(next);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-current border-t-transparent" style={{ color: 'hsl(var(--muted-foreground))' }} />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '680px' }}>
      {/* Card */}
      <div style={{
        background: 'hsl(var(--card))',
        border: '1px solid hsl(var(--border) / 0.5)',
        borderRadius: '12px',
        padding: '24px',
      }}>
        {/* Card title */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '15px',
          fontWeight: 500,
          color: 'hsl(var(--foreground))',
          marginBottom: '24px',
        }}>
          <Bot size={17} style={{ color: 'hsl(var(--muted-foreground))' }} />
          Настройки бота напоминаний
        </div>

        {/* Токен бота */}
        <div style={{
          fontSize: '11px',
          fontWeight: 600,
          color: 'hsl(var(--muted-foreground))',
          letterSpacing: '0.06em',
          textTransform: 'uppercase' as const,
          marginBottom: '5px',
        }}>
          Токен бота
        </div>
        <div style={{
          fontSize: '12px',
          color: 'hsl(var(--muted-foreground) / 0.6)',
          marginBottom: '10px',
          lineHeight: 1.5,
        }}>
          Токен из @BotFather — хранится только в базе данных
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <input
            type="password"
            value={settings.botToken === '*****' ? '' : settings.botToken}
            onChange={(e) => setSettings({ ...settings, botToken: e.target.value })}
            placeholder="Вставьте токен из @BotFather"
            style={{
              flex: 1,
              height: '36px',
              background: 'hsl(var(--background))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px',
              padding: '0 12px',
              fontSize: '13px',
              fontFamily: 'var(--font-mono)',
              color: 'hsl(var(--foreground))',
              outline: 'none',
              transition: 'border-color 0.15s',
            }}
          />
          <button
            onClick={handleSaveToken}
            disabled={saving}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              height: '36px',
              padding: '0 16px',
              background: saving ? 'hsl(var(--primary) / 0.6)' : 'hsl(var(--primary))',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 500,
              cursor: saving ? 'not-allowed' : 'pointer',
              whiteSpace: 'nowrap' as const,
              flexShrink: 0,
              transition: 'background 0.15s',
            }}
          >
            {saving ? <RefreshCw size={15} className="animate-spin" /> : <Save size={15} />}
            Сохранить
          </button>
        </div>

        {settings.botUsername && (
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            marginTop: '10px',
            padding: '4px 10px',
            background: 'hsl(var(--success) / 0.1)',
            border: '1px solid hsl(var(--success) / 0.25)',
            borderRadius: '20px',
            fontSize: '12px',
            color: 'hsl(var(--success))',
            fontWeight: 500,
          }}>
            <Check size={14} />
            @{settings.botUsername} подключён
          </div>
        )}

        {/* Divider */}
        <hr style={{ border: 'none', borderTop: '1px solid hsl(var(--border) / 0.5)', margin: '22px 0' }} />

        {/* Webhook */}
        <div style={{
          fontSize: '11px',
          fontWeight: 600,
          color: 'hsl(var(--muted-foreground))',
          letterSpacing: '0.06em',
          textTransform: 'uppercase' as const,
          marginBottom: '5px',
        }}>
          Webhook
        </div>
        <div style={{
          fontSize: '12px',
          color: 'hsl(var(--muted-foreground) / 0.6)',
          marginBottom: '10px',
          lineHeight: 1.5,
        }}>
          URL для входящих сообщений от Telegram
        </div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'hsl(var(--background))',
          border: '1px solid hsl(var(--border) / 0.5)',
          borderRadius: '8px',
          padding: '10px 14px',
          gap: '12px',
        }}>
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '12px',
            color: 'hsl(var(--muted-foreground))',
            wordBreak: 'break-all',
            lineHeight: 1.5,
          }}>
            {webhookUrl}
          </span>
          <button
            onClick={handleCopyWebhook}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              height: '28px',
              padding: '0 10px',
              background: 'transparent',
              border: '1px solid hsl(var(--border))',
              borderRadius: '6px',
              fontSize: '12px',
              color: webhookCopied ? 'hsl(var(--success))' : 'hsl(var(--muted-foreground))',
              cursor: 'pointer',
              whiteSpace: 'nowrap' as const,
              flexShrink: 0,
              transition: 'all 0.15s',
            }}
          >
            {webhookCopied ? <Check size={14} /> : <Copy size={14} />}
            {webhookCopied ? 'Скопировано' : 'Копировать'}
          </button>
        </div>

        {/* Webhook row */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: '12px',
          flexWrap: 'wrap' as const,
          gap: '8px',
        }}>
          {settings.webhookSet ? (
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              padding: '4px 10px',
              background: 'hsl(var(--success) / 0.1)',
              border: '1px solid hsl(var(--success) / 0.25)',
              borderRadius: '20px',
              fontSize: '12px',
              color: 'hsl(var(--success))',
              fontWeight: 500,
            }}>
              <Check size={14} />
              Webhook установлен
            </div>
          ) : (
            <div />
          )}

          <div style={{ display: 'flex', gap: '8px' }}>
            {settings.webhookSet ? (
              <button
                onClick={handleDeleteWebhook}
                disabled={saving}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  height: '30px',
                  padding: '0 12px',
                  background: 'transparent',
                  border: '1px solid hsl(var(--destructive) / 0.3)',
                  borderRadius: '6px',
                  fontSize: '12px',
                  color: 'hsl(var(--destructive))',
                  cursor: saving ? 'not-allowed' : 'pointer',
                  transition: 'background 0.15s',
                  opacity: saving ? 0.6 : 1,
                }}
              >
                <Trash2 size={14} />
                Удалить webhook
              </button>
            ) : (
              <button
                onClick={handleSetWebhook}
                disabled={saving || !settings.botToken}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  height: '30px',
                  padding: '0 12px',
                  background: 'transparent',
                  border: '1px solid hsl(var(--success) / 0.3)',
                  borderRadius: '6px',
                  fontSize: '12px',
                  color: 'hsl(var(--success))',
                  cursor: saving || !settings.botToken ? 'not-allowed' : 'pointer',
                  transition: 'background 0.15s',
                  opacity: saving || !settings.botToken ? 0.6 : 1,
                }}
              >
                Установить webhook
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
