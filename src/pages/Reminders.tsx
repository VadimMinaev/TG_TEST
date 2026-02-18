import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useToast } from '../components/ToastNotification';
import { useAuth } from '../lib/auth-context';
import { Clock, Plus, Trash2, Repeat, Calendar, Settings } from 'lucide-react';

interface Reminder {
  id: number;
  message: string;
  run_at: string;
  repeat_type: 'none' | 'interval' | 'cron';
  repeat_config: any;
  is_active: boolean;
  next_run_at?: string;
}

export function Reminders() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [showInfo, setShowInfo] = useState(true);

  const loadReminders = async () => {
    try {
      setLoading(true);
      // Пока API возвращает пустой массив - напоминания управляются через бота
      // В будущем можно добавить связь Telegram user с web user
      setReminders([]);
    } catch (error: any) {
      addToast(error.message || 'Не удалось загрузить напоминания', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReminders();
  }, []);

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getRepeatLabel = (reminder: Reminder) => {
    if (reminder.repeat_type === 'interval') {
      const minutes = Math.round(reminder.repeat_config?.interval_seconds / 60);
      return `Каждые ${minutes} мин`;
    }
    if (reminder.repeat_type === 'cron') {
      return 'По расписанию';
    }
    return 'Однократно';
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Напоминания Telegram
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Управление напоминаниями через Telegram-бота
          </p>
        </div>
        <Link
          to="/reminders/settings"
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium flex items-center gap-2"
        >
          <Settings className="w-4 h-4" />
          Настройки бота
        </Link>
      </div>

      {/* Info Block */}
      {showInfo && (
        <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="font-semibold text-blue-900 dark:text-blue-100 flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Как использовать напоминания
              </h3>
              <div className="mt-3 text-sm text-blue-800 dark:text-blue-200 space-y-2">
                <p>📱 Напоминания управляются через Telegram-бота:</p>
                <ol className="list-decimal list-inside space-y-1 ml-2">
                  <li>Откройте диалог с ботом в Telegram</li>
                  <li>Отправьте <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">/start</code> для начала работы</li>
                  <li>Используйте команду <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">/remind</code> для создания напоминания</li>
                </ol>
                
                <div className="mt-3 p-3 bg-blue-100 dark:bg-blue-800/30 rounded text-xs font-mono">
                  <p className="font-semibold mb-2">Примеры команд:</p>
                  <p>/remind 10m Купить молоко</p>
                  <p>/remind 1h Встреча с клиентом</p>
                  <p>/remind 2025-02-20 14:00 Совещание</p>
                  <p>/remind every 1h Принять лекарство</p>
                </div>

                <div className="mt-3">
                  <p className="font-semibold mb-1">Доступные команды:</p>
                  <ul className="grid grid-cols-2 gap-2 text-xs">
                    <li><code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">/remind</code> — создать напоминание</li>
                    <li><code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">/myreminders</code> — мои напоминания</li>
                    <li><code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">/delete</code> — удалить напоминание</li>
                    <li><code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">/help</code> — справка</li>
                  </ul>
                </div>
              </div>
            </div>
            <button
              onClick={() => setShowInfo(false)}
              className="ml-4 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200"
            >
              <span className="sr-only">Закрыть</span>
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Show Info Button (if hidden) */}
      {!showInfo && (
        <button
          onClick={() => setShowInfo(true)}
          className="mb-4 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200 flex items-center gap-1"
        >
          <Clock className="w-4 h-4" />
          Показать справку
        </button>
      )}

      {/* Reminders List */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Ваши напоминания
          </h2>
          <button
            onClick={loadReminders}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            title="Обновить"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>

        <div className="p-4">
          {loading ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              Загрузка...
            </div>
          ) : reminders.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Нет напоминаний</p>
              <p className="text-sm mt-1">
                Используйте <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">/myreminders</code> в Telegram для просмотра
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {reminders.map((reminder) => (
                <div
                  key={reminder.id}
                  className={`p-4 rounded-lg border ${
                    reminder.is_active
                      ? 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50'
                      : 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 opacity-60'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        {reminder.repeat_type !== 'none' ? (
                          <Repeat className="w-4 h-4 text-blue-500" />
                        ) : (
                          <Clock className="w-4 h-4 text-gray-500" />
                        )}
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                          {getRepeatLabel(reminder)}
                        </span>
                      </div>
                      <p className="text-gray-900 dark:text-gray-100 mb-2">
                        {reminder.message}
                      </p>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        <p>
                          Запуск: {formatDateTime(reminder.run_at)}
                        </p>
                        {reminder.next_run_at && (
                          <p>
                            Следующий: {formatDateTime(reminder.next_run_at)}
                          </p>
                        )}
                      </div>
                    </div>
                    {!reminder.is_active && (
                      <span className="text-xs text-red-500 font-medium">
                        Неактивно
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick Setup Guide */}
      <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700">
        <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
          <Plus className="w-5 h-5" />
          Быстрый старт
        </h3>
        <div className="grid md:grid-cols-3 gap-4 text-sm">
          <div className="p-3 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
            <div className="text-lg font-bold text-blue-600 dark:text-blue-400 mb-1">1</div>
            <p className="text-gray-700 dark:text-gray-300">
              Откройте Telegram и найдите вашего бота
            </p>
          </div>
          <div className="p-3 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
            <div className="text-lg font-bold text-blue-600 dark:text-blue-400 mb-1">2</div>
            <p className="text-gray-700 dark:text-gray-300">
              Отправьте <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">/start</code>
            </p>
          </div>
          <div className="p-3 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
            <div className="text-lg font-bold text-blue-600 dark:text-blue-400 mb-1">3</div>
            <p className="text-gray-700 dark:text-gray-300">
              Используйте <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">/remind</code> для создания
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
