import { useState, useEffect } from 'react';
import { useToast } from '../components/ToastNotification';
import { Save, Bot, Key, Link as LinkIcon, RefreshCw } from 'lucide-react';
import { Breadcrumb } from '../components/Breadcrumb';

interface ReminderSettings {
  botToken: string;
  botUsername: string;
  webhookUrl: string;
  webhookSet: boolean;
}

export function ReminderSettingsPage() {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<ReminderSettings>({
    botToken: '',
    botUsername: '',
    webhookUrl: '',
    webhookSet: false,
  });

  const loadSettings = async () => {
    try {
      setLoading(true);
      // Пока загружаем только маску токена
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

  useEffect(() => {
    loadSettings();
  }, []);

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
        addToast('✅ Токен сохранён!', 'success');
      } else {
        const error = await response.json();
        addToast(`❌ ${error.error || 'Ошибка сохранения'}`, 'error');
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
        setSettings(prev => ({
          ...prev,
          webhookUrl: data.webhookUrl,
          webhookSet: data.ok,
        }));
        addToast(`✅ Webhook установлен: ${data.webhookUrl}`, 'success');
      } else {
        const error = await response.json();
        addToast(`❌ ${error.error || 'Ошибка установки webhook'}`, 'error');
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
        addToast('✅ Webhook удалён', 'success');
      } else {
        const error = await response.json();
        addToast(`❌ ${error.error || 'Ошибка'}`, 'error');
      }
    } catch (error: any) {
      addToast(error.message || 'Ошибка', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="card">
        <div className="p-6">
          <div className="flex items-center gap-2 text-[hsl(var(--muted-foreground))]">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
            Загрузка...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-header">
        <div className="flex flex-col gap-2">
          <div>
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Bot className="h-5 w-5" />
              Настройки бота напоминаний
            </h2>
            <div className="mt-1">
              <Breadcrumb
                items={[
                  { label: 'Главная', path: '/' },
                  { label: 'Напоминания', path: '/reminders' },
                  { label: 'Настройки', active: true },
                ]}
              />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={loadSettings} className="icon-button" title="Обновить">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="p-6">
        <div className="panel max-w-4xl">
          <div className="mb-4 text-sm text-[hsl(var(--muted-foreground))]">
            Отдельный бот для системы напоминаний
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <h3 className="mb-3 text-lg font-semibold flex items-center gap-2">
                <Key className="h-5 w-5" />
                Токен бота
              </h3>
              <label style={{ display: 'block', marginBottom: '12px', fontSize: '14px', fontWeight: 500 }}>
                Токен из @BotFather
              </label>
              <div className="grid grid-cols-[1fr_auto] gap-3">
                <input
                  type="password"
                  value={settings.botToken === '*****' ? '' : settings.botToken}
                  onChange={(e) => setSettings({ ...settings, botToken: e.target.value })}
                  placeholder="123456789:ABCdefGHIjkl..."
                  style={{ padding: '12px 16px', width: '100%', borderRadius: '8px', border: '1px solid hsl(var(--input))', background: 'hsl(var(--background))', fontFamily: 'monospace' }}
                />
                <button
                  onClick={handleSaveToken}
                  disabled={saving}
                  style={{ padding: '12px 18px', borderRadius: '8px', background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))', fontWeight: 600, cursor: 'pointer', border: 'none', opacity: saving ? 0.65 : 1 }}
                >
                  <span className="inline-flex items-center gap-2">
                    <Save className="h-4 w-4" />
                    Сохранить
                  </span>
                </button>
              </div>
              <p className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">
                Токен хранится в базе данных и используется только для напоминаний
              </p>
            </div>

            {settings.botUsername && (
              <div className="rounded-lg border border-[hsl(var(--success)_/_0.35)] bg-[hsl(var(--success)_/_0.08)] p-3 text-sm text-[hsl(var(--success))]">
                ✅ Бот: <strong>@{settings.botUsername}</strong>
              </div>
            )}

            <div className="h-px bg-[hsl(var(--border))]" />

            <div>
              <h3 className="mb-3 text-lg font-semibold flex items-center gap-2">
                <LinkIcon className="h-5 w-5" />
                Webhook
              </h3>
              <div style={{ padding: '12px 14px', borderRadius: '8px', border: '1px solid hsl(var(--input))', background: 'hsl(var(--background))' }}>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                  URL для сообщений от Telegram:
                </p>
                <code className="mt-1 block break-all rounded bg-[hsl(var(--muted)_/_0.35)] px-2 py-1 text-xs font-mono">
                  {window.location.origin}/api/telegram/webhook
                </code>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-3">
                {settings.webhookSet ? (
                  <>
                    <span className="rounded bg-[hsl(var(--success)_/_0.15)] px-2 py-1 text-xs text-[hsl(var(--success))]">
                      ✅ Webhook установлен
                    </span>
                    <button
                      onClick={handleDeleteWebhook}
                      disabled={saving}
                      style={{ padding: '10px 14px', borderRadius: '8px', background: 'hsl(var(--destructive))', color: 'white', fontWeight: 600, cursor: 'pointer', border: 'none', opacity: saving ? 0.65 : 1 }}
                    >
                      Удалить webhook
                    </button>
                  </>
                ) : (
                  <button
                    onClick={handleSetWebhook}
                    disabled={saving || !settings.botToken}
                    style={{ padding: '10px 14px', borderRadius: '8px', background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))', fontWeight: 600, cursor: 'pointer', border: 'none', opacity: saving || !settings.botToken ? 0.65 : 1 }}
                  >
                    Установить webhook
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
