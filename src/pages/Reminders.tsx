import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { api, Reminder, ReminderLog } from '../lib/api';
import { useToast } from '../components/ToastNotification';
import { useAuth } from '../lib/auth-context';
import { Breadcrumb } from '../components/Breadcrumb';
import { EntityStateSwitch } from '../components/StateToggle';
import { ToolbarToggle } from '../components/ToolbarToggle';
import { Calendar, Pencil, RefreshCw, Settings, Trash2 } from 'lucide-react';

type ReminderForm = {
  message: string;
  runAtLocal: string;
  repeatType: 'none' | 'interval' | 'cron';
  intervalMinutes: string;
  cronExpression: string;
  isActive: boolean;
};

function toDateTimeLocal(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function formatDateTime(value?: string) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function reminderOwnerLabel(reminder: Reminder) {
  if (reminder.username) return `@${reminder.username}`;
  const fullName = [reminder.first_name, reminder.last_name].filter(Boolean).join(' ');
  if (fullName) return fullName;
  if (reminder.telegram_id) return `ID ${reminder.telegram_id}`;
  return `User ${reminder.telegram_user_id}`;
}

function reminderScheduleLabel(reminder: Reminder) {
  if (reminder.repeat_type === 'interval') {
    const seconds = Number(reminder.repeat_config?.interval_seconds || 0);
    const minutes = Math.max(1, Math.round(seconds / 60));
    return `Каждые ${minutes} мин`;
  }
  if (reminder.repeat_type === 'cron') {
    return `Cron: ${reminder.repeat_config?.cron || '—'}`;
  }
  return formatDateTime(reminder.run_at);
}

function normalizeForm(reminder: Reminder): ReminderForm {
  return {
    message: reminder.message || '',
    runAtLocal: toDateTimeLocal(reminder.run_at),
    repeatType: reminder.repeat_type || 'none',
    intervalMinutes:
      reminder.repeat_type === 'interval'
        ? String(Math.max(1, Math.round(Number(reminder.repeat_config?.interval_seconds || 60) / 60)))
        : '60',
    cronExpression: reminder.repeat_type === 'cron' ? String(reminder.repeat_config?.cron || '') : '',
    isActive: reminder.is_active,
  };
}

export function Reminders() {
  const { user } = useAuth();
  const canEdit = user?.role !== 'auditor';
  const { addToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [selectedReminderId, setSelectedReminderId] = useState<number | null>(null);
  const [editingReminderId, setEditingReminderId] = useState<number | null>(null);
  const [form, setForm] = useState<ReminderForm>({
    message: '',
    runAtLocal: '',
    repeatType: 'none',
    intervalMinutes: '60',
    cronExpression: '',
    isActive: true,
  });
  const [history, setHistory] = useState<ReminderLog[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const selectedReminder = useMemo(
    () => reminders.find((r) => r.id === selectedReminderId) || null,
    [reminders, selectedReminderId]
  );

  const loadReminders = async () => {
    try {
      setLoading(true);
      const data = await api.getReminders();
      setReminders(data);
      if (data.length && (selectedReminderId == null || !data.some((r) => r.id === selectedReminderId))) {
        setSelectedReminderId(data[0].id);
      }
      if (!data.length) {
        setSelectedReminderId(null);
        setEditingReminderId(null);
      }
    } catch (error: any) {
      addToast(error.message || 'Не удалось загрузить напоминания', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReminders();
  }, []);

  useEffect(() => {
    const loadHistory = async () => {
      if (!selectedReminderId) {
        setHistory([]);
        return;
      }
      try {
        setHistoryLoading(true);
        const data = await api.getReminderHistory(selectedReminderId);
        setHistory(data);
      } catch {
        setHistory([]);
      } finally {
        setHistoryLoading(false);
      }
    };
    loadHistory();
  }, [selectedReminderId]);

  const handleEditReminder = (reminder: Reminder) => {
    setSelectedReminderId(reminder.id);
    setEditingReminderId(reminder.id);
    setForm(normalizeForm(reminder));
  };

  const handleSaveReminder = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedReminder || editingReminderId == null) return;

    const message = form.message.trim();
    if (!message) {
      addToast('Введите текст напоминания', 'error');
      return;
    }

    if (!form.runAtLocal) {
      addToast('Укажите дату и время', 'error');
      return;
    }

    const runAtDate = new Date(form.runAtLocal);
    if (Number.isNaN(runAtDate.getTime())) {
      addToast('Некорректная дата и время', 'error');
      return;
    }

    let repeatConfig: any = null;
    if (form.repeatType === 'interval') {
      const minutes = Number(form.intervalMinutes);
      if (!Number.isFinite(minutes) || minutes < 1) {
        addToast('Интервал должен быть больше 0', 'error');
        return;
      }
      repeatConfig = { interval_seconds: Math.round(minutes * 60) };
    } else if (form.repeatType === 'cron') {
      const cron = form.cronExpression.trim();
      if (!cron) {
        addToast('Введите cron-выражение', 'error');
        return;
      }
      repeatConfig = { cron };
    }

    try {
      setSaving(true);
      const runAtIso = runAtDate.toISOString();
      const updated = await api.updateReminder(selectedReminder.id, {
        message,
        runAt: runAtIso,
        nextRunAt: runAtIso,
        repeatType: form.repeatType,
        repeatConfig,
        isActive: form.isActive,
      });

      setReminders((prev) => prev.map((r) => (r.id === updated.id ? { ...r, ...updated } : r)));
      setEditingReminderId(null);
      addToast('Напоминание обновлено', 'success');
    } catch (error: any) {
      addToast(error.message || 'Не удалось сохранить напоминание', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleReminder = async (reminder: Reminder) => {
    const nextActive = !reminder.is_active;
    try {
      const updated = await api.updateReminder(reminder.id, { isActive: nextActive });
      setReminders((prev) => prev.map((r) => (r.id === reminder.id ? { ...r, ...updated } : r)));
      addToast(nextActive ? 'Напоминание включено' : 'Напоминание выключено', 'success');
    } catch (error: any) {
      addToast(error.message || 'Не удалось изменить статус', 'error');
    }
  };

  const handleDeleteReminder = async (reminder: Reminder) => {
    if (!confirm(`Деактивировать напоминание "${reminder.message}"?`)) return;
    try {
      await api.deleteReminder(reminder.id);
      setReminders((prev) => prev.map((r) => (r.id === reminder.id ? { ...r, is_active: false } : r)));
      if (selectedReminderId === reminder.id) {
        setEditingReminderId(null);
      }
      addToast('Напоминание деактивировано', 'success');
    } catch (error: any) {
      addToast(error.message || 'Не удалось деактивировать напоминание', 'error');
    }
  };

  return (
    <div className="card">
      <div className="card-header">
        <div className="flex flex-col gap-2">
          <div>
            <h2 className="text-xl font-semibold">⏰ Напоминания</h2>
            <div className="mt-1">
              <Breadcrumb
                items={[
                  { label: 'Главная', path: '/' },
                  { label: 'Напоминания', active: true },
                ]}
              />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canEdit && selectedReminder && editingReminderId === null && (
            <>
              <button
                onClick={() => handleEditReminder(selectedReminder)}
                className="icon-button"
                title="Редактировать"
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                onClick={() => handleDeleteReminder(selectedReminder)}
                className="icon-button text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive)_/_0.1)]"
                title="Деактивировать"
              >
                <Trash2 className="h-4 w-4" />
              </button>
              <ToolbarToggle
                enabled={selectedReminder.is_active}
                onChange={() => handleToggleReminder(selectedReminder)}
                title={selectedReminder.is_active ? 'Отключить напоминание' : 'Включить напоминание'}
              />
              <div className="mx-1 h-6 w-px bg-[hsl(var(--border))]" />
            </>
          )}
          <button onClick={() => loadReminders()} className="icon-button" title="Обновить список">
            <RefreshCw className="h-4 w-4" />
          </button>
          <Link to="/reminders/settings" className="icon-button" title="Настройки бота напоминаний">
            <Settings className="h-4 w-4" />
          </Link>
        </div>
      </div>

      <div className="split-layout p-6">
        <div className="split-left">
          <div className="panel">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold">📋 Список напоминаний</h3>
              <button
                onClick={() => loadReminders()}
                className="rounded border border-[hsl(var(--border))] px-2 py-1 text-xs"
              >
                Обновить
              </button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-10">
                <div className="h-6 w-6 animate-spin rounded-full border-4 border-[hsl(var(--primary))] border-t-transparent" />
              </div>
            ) : reminders.length === 0 ? (
              <p className="py-10 text-center text-sm text-[hsl(var(--muted-foreground))]">Напоминаний нет</p>
            ) : (
              <div className="entity-list-scroll scrollbar-thin">
                <table className="table-basic w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-[hsl(var(--border))] text-left text-xs">
                      <th className="px-2 py-2">Текст</th>
                      <th className="px-2 py-2">Пользователь</th>
                      <th className="px-2 py-2">Расписание</th>
                      <th className="px-2 py-2">Статус</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reminders.map((reminder) => (
                      <tr
                        key={reminder.id}
                        onClick={() => {
                          setSelectedReminderId(reminder.id);
                          setEditingReminderId(null);
                        }}
                        className={`cursor-pointer border-b border-[hsl(var(--border))] transition-colors hover:bg-[hsl(var(--accent))] ${
                          selectedReminderId === reminder.id ? 'bg-[hsl(var(--accent))]' : ''
                        }`}
                      >
                        <td className="max-w-[220px] truncate px-2 py-2 font-medium">{reminder.message}</td>
                        <td className="px-2 py-2 text-xs">{reminderOwnerLabel(reminder)}</td>
                        <td className="px-2 py-2 text-xs">{reminderScheduleLabel(reminder)}</td>
                        <td className="px-2 py-2">{reminder.is_active ? '✅' : '⏸️'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="split-right">
          <div className={`panel ${editingReminderId !== null && selectedReminder ? 'entity-edit-panel' : ''}`}>
          {editingReminderId !== null && selectedReminder ? (
            <>
              <h3 className="mb-4 text-lg font-semibold">Редактирование напоминания</h3>
              <form onSubmit={handleSaveReminder} className="flex flex-col gap-5">
                <div>
                  <label className="mb-2 block text-sm font-medium">Текст</label>
                  <textarea
                    rows={3}
                    className="w-full rounded border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2"
                    value={form.message}
                    onChange={(e) => setForm((prev) => ({ ...prev, message: e.target.value }))}
                    placeholder="Текст напоминания"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-2 block text-sm font-medium">Дата и время</label>
                    <input
                      type="datetime-local"
                      className="w-full rounded border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2"
                      value={form.runAtLocal}
                      onChange={(e) => setForm((prev) => ({ ...prev, runAtLocal: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium">Тип повтора</label>
                    <select
                      className="w-full rounded border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2"
                      value={form.repeatType}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, repeatType: e.target.value as 'none' | 'interval' | 'cron' }))
                      }
                    >
                      <option value="none">Однократно</option>
                      <option value="interval">Интервал</option>
                      <option value="cron">Cron</option>
                    </select>
                  </div>
                </div>

                {form.repeatType === 'interval' && (
                  <div>
                    <label className="mb-2 block text-sm font-medium">Интервал (минуты)</label>
                    <input
                      type="number"
                      min={1}
                      className="w-full rounded border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2"
                      value={form.intervalMinutes}
                      onChange={(e) => setForm((prev) => ({ ...prev, intervalMinutes: e.target.value }))}
                    />
                  </div>
                )}

                {form.repeatType === 'cron' && (
                  <div>
                    <label className="mb-2 block text-sm font-medium">Cron выражение</label>
                    <input
                      className="w-full rounded border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 font-mono"
                      value={form.cronExpression}
                      onChange={(e) => setForm((prev) => ({ ...prev, cronExpression: e.target.value }))}
                      placeholder="0 9 * * *"
                    />
                  </div>
                )}

                <div>
                  <EntityStateSwitch
                    idPrefix="reminder-edit"
                    enabled={form.isActive}
                    onChange={(nextEnabled) => setForm((prev) => ({ ...prev, isActive: nextEnabled }))}
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 rounded bg-[hsl(var(--primary))] px-4 py-2 font-semibold text-[hsl(var(--primary-foreground))] disabled:opacity-60"
                  >
                    {saving ? 'Сохранение...' : 'Сохранить'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingReminderId(null)}
                    className="flex-1 rounded bg-[hsl(var(--secondary))] px-4 py-2 font-semibold text-[hsl(var(--secondary-foreground))]"
                  >
                    Отмена
                  </button>
                </div>
              </form>
            </>
          ) : selectedReminder ? (
            <div className="entity-view">
              <div>
                <h4 className="entity-view-title">Информация</h4>
                <div className="entity-view-card space-y-3">
                  <div>
                    <strong>ID:</strong>{' '}
                    <code className="rounded bg-[hsl(var(--muted)_/_0.5)] px-2 py-1">{selectedReminder.id}</code>
                  </div>
                  <div>
                    <strong>Пользователь:</strong> {reminderOwnerLabel(selectedReminder)}
                  </div>
                  <div>
                    <strong>Статус:</strong>{' '}
                    <span
                      className={`rounded px-2 py-1 text-xs ${
                        selectedReminder.is_active
                          ? 'bg-[hsl(var(--success)_/_0.15)] text-[hsl(var(--success))]'
                          : 'bg-[hsl(var(--destructive)_/_0.1)] text-[hsl(var(--destructive))]'
                      }`}
                    >
                      {selectedReminder.is_active ? '✅ Активно' : '⏸️ Неактивно'}
                    </span>
                  </div>
                  <div>
                    <strong>Текст:</strong>
                    <div className="mt-1 whitespace-pre-wrap break-words rounded bg-[hsl(var(--muted)_/_0.25)] p-2">
                      {selectedReminder.message}
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="entity-view-title">Расписание</h4>
                <div className="entity-view-card space-y-3">
                  <div>
                    <strong>Запуск:</strong> {formatDateTime(selectedReminder.run_at)}
                  </div>
                  <div>
                    <strong>Следующий запуск:</strong> {formatDateTime(selectedReminder.next_run_at)}
                  </div>
                  <div>
                    <strong>Тип:</strong>{' '}
                    <code className="rounded bg-[hsl(var(--muted)_/_0.5)] px-2 py-1">{selectedReminder.repeat_type}</code>
                  </div>
                  {selectedReminder.repeat_type === 'interval' && (
                    <div>
                      <strong>Интервал:</strong>{' '}
                      {Math.max(1, Math.round(Number(selectedReminder.repeat_config?.interval_seconds || 0) / 60))} мин
                    </div>
                  )}
                  {selectedReminder.repeat_type === 'cron' && (
                    <div>
                      <strong>Cron:</strong>{' '}
                      <code className="rounded bg-[hsl(var(--muted)_/_0.5)] px-2 py-1">
                        {selectedReminder.repeat_config?.cron || '—'}
                      </code>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <h4 className="entity-view-title">Мета</h4>
                <div className="entity-view-card space-y-3">
                  <div>
                    <strong>Создано:</strong> {formatDateTime(selectedReminder.created_at)}
                  </div>
                  <div>
                    <strong>Обновлено:</strong> {formatDateTime(selectedReminder.updated_at)}
                  </div>
                </div>
              </div>

              <div>
                <h4 className="entity-view-title">История отправок</h4>
                <div className="entity-view-card space-y-2 text-sm">
                  {historyLoading ? (
                    <div className="text-[hsl(var(--muted-foreground))]">Загрузка...</div>
                  ) : history.length === 0 ? (
                    <div className="text-[hsl(var(--muted-foreground))]">Нет записей</div>
                  ) : (
                    history.map((h) => (
                      <div key={h.id} className="rounded border border-[hsl(var(--border))] p-2">
                        <div>
                          <strong>{h.status === 'sent' ? '✅ sent' : '❌ failed'}</strong>{' '}
                          {formatDateTime(h.sent_at)}
                        </div>
                        {h.error_message && (
                          <div className="text-[hsl(var(--destructive))]">Ошибка: {h.error_message}</div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-lg border border-[hsl(var(--border)_/_0.6)] bg-[hsl(var(--card))] p-10 text-center text-[hsl(var(--muted-foreground))]">
              <Calendar className="mb-3 h-8 w-8" />
              <p>Выберите напоминание слева для просмотра и редактирования</p>
            </div>
          )}
          </div>
        </div>
      </div>
    </div>
  );
}
