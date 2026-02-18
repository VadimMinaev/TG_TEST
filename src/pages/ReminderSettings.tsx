import { useState, useEffect } from 'react';
import { useToast } from '../components/ToastNotification';
import { Save, Bot, Key, Link as LinkIcon } from 'lucide-react';

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
      <div className="p-6">
        <div className="flex items-center gap-2 text-gray-500">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
          Загрузка...
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <Bot className="w-6 h-6" />
          Настройки бота напоминаний
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Отдельный бот для системы напоминаний
        </p>
      </div>

      {/* Bot Token Card */}
      <div className="mb-6 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <h2 className="font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
          <Key className="w-5 h-5" />
          Токен бота
        </h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Токен из @BotFather
            </label>
            <div className="flex gap-2">
              <input
                type="password"
                value={settings.botToken === '*****' ? '' : settings.botToken}
                onChange={(e) => setSettings({ ...settings, botToken: e.target.value })}
                placeholder="123456789:ABCdefGHIjkl..."
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm font-mono"
              />
              <button
                onClick={handleSaveToken}
                disabled={saving}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-md text-sm font-medium flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                Сохранить
              </button>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Токен хранится в базе данных и используется только для напоминаний
            </p>
          </div>

          {settings.botUsername && (
            <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md">
              <p className="text-sm text-green-800 dark:text-green-200">
                ✅ Бот: <strong>@{settings.botUsername}</strong>
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Webhook Card */}
      <div className="mb-6 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <h2 className="font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
          <LinkIcon className="w-5 h-5" />
          Webhook
        </h2>

        <div className="space-y-4">
          <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-md">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              URL для получения сообщений от Telegram:
            </p>
            <code className="block mt-1 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-xs font-mono break-all">
              {window.location.origin}/api/telegram/webhook
            </code>
          </div>

          {settings.webhookSet ? (
            <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md">
              <p className="text-sm text-green-800 dark:text-green-200 mb-2">
                ✅ Webhook установлен
              </p>
              <button
                onClick={handleDeleteWebhook}
                disabled={saving}
                className="px-3 py-1.5 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white rounded-md text-xs font-medium"
              >
                Удалить webhook
              </button>
            </div>
          ) : (
            <button
              onClick={handleSetWebhook}
              disabled={saving || !settings.botToken}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-md text-sm font-medium"
            >
              Установить webhook
            </button>
          )}
        </div>
      </div>

      {/* Instructions */}
      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
        <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-3">
          📖 Как настроить:
        </h3>
        <ol className="space-y-2 text-sm text-blue-800 dark:text-blue-200">
          <li>1. Создайте бота в @BotFather (команда /newbot)</li>
          <li>2. Скопируйте токен и вставьте в поле выше</li>
          <li>3. Нажмите «Сохранить»</li>
          <li>4. Нажмите «Установить webhook»</li>
          <li>5. Откройте бота в Telegram и нажмите /start</li>
        </ol>
      </div>
    </div>
  );
}
