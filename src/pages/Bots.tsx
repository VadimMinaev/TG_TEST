import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { api, Bot } from '../lib/api';
import { useAuth } from '../lib/auth-context';
import { Copy, Download, Pencil, Play, Plus, RefreshCw, Trash2, Upload } from 'lucide-react';
import { ExportModal } from '../components/ExportModal';
import { Breadcrumb } from '../components/Breadcrumb';
import { StatusRadio } from '../components/StatusRadio';
import { EntityStateSwitch } from '../components/StateToggle';
import { ToolbarToggle } from '../components/ToolbarToggle';
import { useToast } from '../components/ToastNotification';

const DAY_NAMES = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
const DAY_NAMES_FULL = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];

const DEFAULT_FORM = {
  name: '',
  chatId: '',
  botToken: '',
  messageType: 'poll' as 'text' | 'poll',
  messageText: '',
  pollQuestion: '',
  pollOptions: '["Вариант 1", "Вариант 2", "Вариант 3"]',
  pollIsAnonymous: true,
  pollAllowsMultipleAnswers: false,
  scheduleType: 'recurring' as 'recurring' | 'once',
  scheduleDays: [1, 2, 3, 4, 5], // Пн-Пт
  scheduleDate: '',
  scheduleTime: '09:00',
  scheduleTimezone: 'Europe/Moscow',
  enabled: true,
};

const normalizeForm = (bot?: Bot) => ({
  name: bot?.name || '',
  chatId: bot?.chatId || '',
  botToken: bot?.botToken || '',
  messageType: bot?.messageType || 'poll',
  messageText: bot?.messageText || '',
  pollQuestion: bot?.pollQuestion || '',
  pollOptions: bot?.pollOptions || '["Вариант 1", "Вариант 2", "Вариант 3"]',
  pollIsAnonymous: bot?.pollIsAnonymous ?? true,
  pollAllowsMultipleAnswers: bot?.pollAllowsMultipleAnswers ?? false,
  scheduleType: bot?.scheduleType || 'recurring',
  scheduleDays: bot?.scheduleDays || [1, 2, 3, 4, 5],
  scheduleDate: bot?.scheduleDate || '',
  scheduleTime: bot?.scheduleTime || '09:00',
  scheduleTimezone: bot?.scheduleTimezone || 'Europe/Moscow',
  enabled: bot?.enabled ?? true,
});

const TIMEZONES = [
  'Europe/Moscow',
  'Europe/Kaliningrad',
  'Asia/Yekaterinburg',
  'Asia/Omsk',
  'Asia/Krasnoyarsk',
  'Asia/Irkutsk',
  'Asia/Yakutsk',
  'Asia/Vladivostok',
  'Asia/Magadan',
  'Asia/Kamchatka',
  'UTC',
];

const isDraftBot = (bot: Partial<Bot>) =>
  !bot.enabled && (
    String(bot.name || '').toLowerCase().startsWith('черновик') ||
    String(bot.chatId || '').trim() === '0'
  );

export function Bots() {
  const { user } = useAuth();
  const canEdit = user?.role !== 'auditor';
  const [searchParams, setSearchParams] = useSearchParams();
  const [bots, setBots] = useState<Bot[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBotId, setSelectedBotId] = useState<number | null>(null);
  const [editingBotId, setEditingBotId] = useState<number | null>(null);
  const [form, setForm] = useState(DEFAULT_FORM);
  const { addToast } = useToast();
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [togglingBotId, setTogglingBotId] = useState<number | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);


  const selectedBot = useMemo(
    () => bots.find((b) => b.id === selectedBotId) || null,
    [bots, selectedBotId]
  );

  const loadBots = async () => {
    try {
      setLoading(true);
      const data = await api.getBots();
      setBots(data);
    } catch (error: any) {
      addToast(error.message || 'Не удалось загрузить ботов', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBots();
  }, []);

  // URL params
  useEffect(() => {
    const createParam = searchParams.get('create');
    const selectParam = searchParams.get('select');

    if (createParam === 'true') {
      setSelectedBotId(null);
      setEditingBotId(-1);
      setForm(DEFAULT_FORM);
      setSearchParams({}, { replace: true });
    } else if (selectParam) {
      const id = parseInt(selectParam, 10);
      if (!isNaN(id)) {
        setSelectedBotId(id);
        setEditingBotId(null);
      }
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const handleSelectBot = (id: number) => {
    setSelectedBotId(id);
    setEditingBotId(null);
  };

  const handleStartCreate = () => {
    setSelectedBotId(null);
    setEditingBotId(-1);
    setForm(DEFAULT_FORM);
  };

  const handleEditBot = (bot: Bot) => {
    setSelectedBotId(bot.id);
    setEditingBotId(bot.id);
    setForm(normalizeForm(bot));
  };

  const handleSaveBot = async (event: React.FormEvent) => {
    event.preventDefault();
    // Clear message is no longer needed with toast system

    if (!form.name || !form.chatId) {
      addToast('Укажите название и Chat ID', 'error');
      return;
    }

    if (form.messageType === 'poll' && !form.pollQuestion) {
      addToast('Укажите вопрос для голосования', 'error');
      return;
    }

    if (form.messageType === 'text' && !form.messageText) {
      addToast('Укажите текст сообщения', 'error');
      return;
    }

    if (form.scheduleType === 'recurring' && form.scheduleDays.length === 0) {
      addToast('Выберите хотя бы один день недели', 'error');
      return;
    }

    if (form.scheduleType === 'once' && !form.scheduleDate) {
      addToast('Укажите дату запуска', 'error');
      return;
    }

    // Validate poll options
    if (form.messageType === 'poll') {
      try {
        const opts = JSON.parse(form.pollOptions);
        if (!Array.isArray(opts) || opts.length < 2) {
          addToast('Нужно минимум 2 варианта ответа', 'error');
          return;
        }
      } catch {
        addToast('Некорректный JSON для вариантов ответа', 'error');
        return;
      }
    }

    try {
      const payload = {
        ...form,
        botToken: form.botToken || undefined,
      };

      if (editingBotId && editingBotId !== -1) {
        const updated = await api.updateBot(editingBotId, payload);
        setEditingBotId(null);
        setSelectedBotId(updated.id);
        addToast('Бот обновлён', 'success');
        await loadBots();
      } else {
        const created = await api.createBot(payload);
        setEditingBotId(null);
        setSelectedBotId(created.id);
        addToast('Бот создан', 'success');
        await loadBots();
      }
    } catch (error: any) {
      addToast(error.message || 'Не удалось сохранить бота', 'error');
    }
  };

  const handleDuplicateBot = async (bot: Bot) => {
    try {
      const copyPayload = {
        ...normalizeForm(bot),
        name: `${bot.name} (копия)`,
        enabled: false,
      };
      const created = await api.createBot(copyPayload);
      setBots((prev) => [created, ...prev]);
      setSelectedBotId(created.id);
      addToast('Бот продублирован', 'success');
    } catch (error: any) {
      addToast(error.message || 'Не удалось дублировать бота', 'error');
    }
  };

  const handleDeleteBot = async (bot: Bot) => {
    if (!confirm(`Удалить бота "${bot.name}"?`)) return;
    try {
      await api.deleteBot(bot.id);
      setBots((prev) => prev.filter((b) => b.id !== bot.id));
      if (selectedBotId === bot.id) {
        setSelectedBotId(null);
        setEditingBotId(null);
      }
      addToast('Бот удалён', 'success');
    } catch (error: any) {
      addToast(error.message || 'Не удалось удалить бота', 'error');
    }
  };

  const handleRunBot = async (bot: Bot) => {
    try {
      await api.runBot(bot.id);
      addToast('Бот запущен вручную', 'success');
    } catch (error: any) {
      addToast(error.message || 'Не удалось запустить бота', 'error');
    }
  };

  const handleToggleBotEnabled = async (bot: Bot) => {
    const nextEnabled = !bot.enabled;
    try {
      setTogglingBotId(bot.id);
      const updated = await api.updateBot(bot.id, { enabled: nextEnabled });
      const mergedUpdated = { ...bot, ...updated, id: bot.id };
      setBots((prev) => prev.map((b) => (b.id === bot.id ? mergedUpdated : b)));
      addToast(nextEnabled ? 'Бот включен' : 'Бот выключен', 'success');
    } catch (error: any) {
      addToast(error.message || 'Не удалось обновить статус бота', 'error');
    } finally {
      setTogglingBotId(null);
    }
  };

  const toggleDay = (day: number) => {
    setForm((prev) => {
      const days = prev.scheduleDays.includes(day)
        ? prev.scheduleDays.filter((d) => d !== day)
        : [...prev.scheduleDays, day].sort();
      return { ...prev, scheduleDays: days };
    });
  };

  const setWeekdays = () => {
    setForm((prev) => ({ ...prev, scheduleDays: [1, 2, 3, 4, 5] }));
  };

  const setAllDays = () => {
    setForm((prev) => ({ ...prev, scheduleDays: [0, 1, 2, 3, 4, 5, 6] }));
  };

  const formatSchedule = (bot: Bot) => {
    if (bot.scheduleType === 'once') {
      return `📆 ${bot.scheduleDate || '???'} в ${bot.scheduleTime || '??:??'}`;
    }
    const days = (bot.scheduleDays || []).map((d) => DAY_NAMES[d]).join(', ');
    return `${days} в ${bot.scheduleTime || '??:??'}`;
  };

  // Add/remove poll option helpers
  const getPollOptionsArray = (): string[] => {
    try {
      return JSON.parse(form.pollOptions);
    } catch {
      return [''];
    }
  };

  const setPollOptionsArray = (opts: string[]) => {
    setForm((prev) => ({ ...prev, pollOptions: JSON.stringify(opts) }));
  };

  const normalizeImportedBot = (raw: any, index: number): { payload: Partial<Bot>; drafted: boolean } => {
    const name = String(raw.name ?? '').trim();
    const chatId = String(raw.chatId ?? '').trim();
    const drafted = !name || !chatId;
    const scheduleDays = Array.isArray(raw.scheduleDays)
      ? raw.scheduleDays
      : [1, 2, 3, 4, 5];
    return {
      payload: {
        name: name || `Черновик бот ${index + 1}`,
        chatId: chatId || '0',
        botToken: raw.botToken ? String(raw.botToken).trim() : undefined,
        messageType: raw.messageType === 'text' ? 'text' : 'poll',
        messageText: raw.messageText != null ? String(raw.messageText) : undefined,
        pollQuestion: raw.pollQuestion != null ? String(raw.pollQuestion) : undefined,
        pollOptions: typeof raw.pollOptions === 'string' ? raw.pollOptions : JSON.stringify(raw.pollOptions || ['Вариант 1', 'Вариант 2', 'Вариант 3']),
        pollIsAnonymous: raw.pollIsAnonymous ?? true,
        pollAllowsMultipleAnswers: raw.pollAllowsMultipleAnswers ?? false,
        scheduleType: raw.scheduleType === 'once' ? 'once' : 'recurring',
        scheduleDays,
        scheduleDate: raw.scheduleDate != null ? String(raw.scheduleDate) : undefined,
        scheduleTime: String(raw.scheduleTime ?? '09:00'),
        scheduleTimezone: String(raw.scheduleTimezone ?? 'Europe/Moscow'),
        enabled: drafted ? false : (raw.enabled ?? true),
      },
      drafted,
    };
  };

  const handleImportBots = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const items = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.bots) ? parsed.bots : [];
      if (!items.length) throw new Error('Файл не содержит ботов');

      let created = 0;
      let failed = 0;
      let draftedCount = 0;
      let lastError = '';
      for (const [index, item] of items.entries()) {
        const { payload, drafted } = normalizeImportedBot(item, index);
        if (drafted) draftedCount += 1;
        try {
          const createdBot = await api.createBot(payload);
          created += 1;
          setBots((prev) => [...prev, createdBot]);
        } catch (err: any) {
          failed += 1;
          if (!lastError) lastError = err?.message || 'Ошибка создания';
        }
      }

      const messageText =
        failed === 0
          ? draftedCount > 0
            ? `Импортировано ботов: ${created}, черновиков: ${draftedCount}`
            : `Импортировано ботов: ${created}`
          : lastError
            ? `Импортировано: ${created}, черновиков: ${draftedCount}, ошибок: ${failed}. Причина: ${lastError}`
            : `Импортировано: ${created}, черновиков: ${draftedCount}, ошибок: ${failed}`;
      addToast(messageText, failed === 0 ? 'success' : 'info');
    } catch (error: any) {
      addToast(error.message || 'Ошибка импорта ботов', 'error');
    } finally {
      setImporting(false);
      if (importInputRef.current) {
        importInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="card">
      <div className="card-header">
        <div className="flex flex-col gap-2">
          <div>
            <h2 className="text-xl font-semibold">🤖 Боты</h2>
            <div className="mt-1">
              <Breadcrumb 
                items={[
                  { label: 'Главная', path: '/' },
                  { label: 'Боты', active: true }
                ]} 
              />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canEdit && selectedBot && !editingBotId && (
            <>
              <button
                onClick={() => handleRunBot(selectedBot)}
                className="icon-button text-[hsl(var(--success))] hover:bg-[hsl(var(--success)_/_0.1)]"
                title="Запустить сейчас"
              >
                <Play className="h-4 w-4" />
              </button>
              <button
                onClick={() => handleEditBot(selectedBot)}
                className="icon-button"
                title="Редактировать"
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                onClick={() => handleDuplicateBot(selectedBot)}
                className="icon-button"
                title="Дублировать"
              >
                <Copy className="h-4 w-4" />
              </button>
              <button
                onClick={() => handleDeleteBot(selectedBot)}
                className="icon-button text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive)_/_0.1)]"
                title="Удалить"
              >
                <Trash2 className="h-4 w-4" />
              </button>
              <ToolbarToggle
                enabled={bots.find(b => b.id === selectedBotId)?.enabled ?? false}
                onChange={() => {
                  const bot = bots.find(b => b.id === selectedBotId);
                  if (bot) handleToggleBotEnabled(bot);
                }}
                title={bots.find(b => b.id === selectedBotId)?.enabled ? 'Выключить бота' : 'Включить бота'}
              />
              <div className="mx-1 h-6 w-px bg-[hsl(var(--border))]" />
            </>
          )}
          <button onClick={() => loadBots()} className="icon-button" title="Обновить список">
            <RefreshCw className="h-4 w-4" />
          </button>
          {canEdit && (
            <>
              <input
                ref={importInputRef}
                type="file"
                accept="application/json"
                className="hidden"
                onChange={handleImportBots}
              />
              <button
                onClick={() => importInputRef.current?.click()}
                disabled={importing}
                className="icon-button disabled:cursor-not-allowed disabled:opacity-60"
                title="Импорт ботов"
              >
                <Upload className="h-4 w-4" />
              </button>
              <button onClick={() => setExportModalOpen(true)} className="icon-button" title="Экспорт ботов">
                <Download className="h-4 w-4" />
              </button>
              <button onClick={handleStartCreate} className="icon-button" title="Создать бота">
                <Plus className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
      </div>


      <div className="split-layout p-6">
        <div className="split-left">
          <div className="panel">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold">📋 Список ботов</h3>
              <button
                onClick={() => loadBots()}
                className="rounded border border-[hsl(var(--border))] px-2 py-1 text-xs"
              >
                Обновить
              </button>
            </div>
            {loading ? (
              <div className="flex items-center justify-center py-10">
                <div className="h-6 w-6 animate-spin rounded-full border-4 border-[hsl(var(--primary))] border-t-transparent" />
              </div>
            ) : bots.length === 0 ? (
              <p className="py-10 text-center text-sm text-[hsl(var(--muted-foreground))]">Боты не найдены</p>
            ) : (
              <div className="entity-list-scroll scrollbar-thin">
                <table className="table-basic w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-[hsl(var(--border))] text-left text-xs">
                      <th className="px-2 py-2">Название</th>
                      <th className="px-2 py-2">Тип</th>
                      <th className="px-2 py-2">Расписание</th>
                      <th className="px-2 py-2">Статус</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bots.map((bot) => (
                      <tr
                        key={bot.id}
                        onClick={() => handleSelectBot(bot.id)}
                        className={`cursor-pointer border-b border-[hsl(var(--border))] transition-colors hover:bg-[hsl(var(--accent))] ${
                          selectedBotId === bot.id ? 'bg-[hsl(var(--accent))]' : ''
                        }`}
                      >
                        <td className="px-2 py-2 font-medium">
                          <span className="inline-flex items-center gap-2">
                            <span>{bot.name}</span>
                            {isDraftBot(bot) && (
                              <span className="rounded-full bg-[hsl(var(--muted))] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                                Черновик
                              </span>
                            )}
                          </span>
                        </td>
                        <td className="px-2 py-2">{bot.messageType === 'poll' ? '📊' : '💬'}</td>
                        <td className="px-2 py-2 text-xs">{formatSchedule(bot)}</td>
                        <td className="px-2 py-2">{bot.enabled ? '✅' : '⏸️'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="split-right">
          {editingBotId !== null ? (
            <div className="panel">
              <h3 className="mb-4 text-lg font-semibold">
                {editingBotId === -1 ? 'Создание бота' : 'Редактирование бота'}
              </h3>
              <form onSubmit={handleSaveBot} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {/* Название и Chat ID */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label style={{ display: 'block', marginBottom: '16px', fontSize: '14px', fontWeight: 500 }}>
                      Название
                    </label>
                    <input
                      style={{ padding: '12px 16px', width: '100%', borderRadius: '8px', border: '1px solid hsl(var(--input))', background: 'hsl(var(--background))' }}
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      placeholder="Голосование в школьный чат"
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '16px', fontSize: '14px', fontWeight: 500 }}>
                      Chat ID
                    </label>
                    <input
                      style={{ padding: '12px 16px', width: '100%', borderRadius: '8px', border: '1px solid hsl(var(--input))', background: 'hsl(var(--background))' }}
                      value={form.chatId}
                      onChange={(e) => setForm({ ...form, chatId: e.target.value })}
                      placeholder="-1001234567890"
                    />
                  </div>
                </div>

                {/* Тип сообщения */}
                <div>
                  <label style={{ display: 'block', marginBottom: '16px', fontSize: '14px', fontWeight: 500 }}>
                    Тип сообщения
                  </label>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <label
                      style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '12px 16px',
                        borderRadius: '8px',
                        border: `2px solid ${form.messageType === 'poll' ? 'hsl(var(--primary))' : 'hsl(var(--input))'}`,
                        cursor: 'pointer',
                        background: form.messageType === 'poll' ? 'hsl(var(--primary) / 0.05)' : 'hsl(var(--background))',
                      }}
                    >
                      <input
                        type="radio"
                        checked={form.messageType === 'poll'}
                        onChange={() => setForm({ ...form, messageType: 'poll' })}
                        style={{ width: '18px', height: '18px' }}
                      />
                      <span>📊 Голосование</span>
                    </label>
                    <label
                      style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '12px 16px',
                        borderRadius: '8px',
                        border: `2px solid ${form.messageType === 'text' ? 'hsl(var(--primary))' : 'hsl(var(--input))'}`,
                        cursor: 'pointer',
                        background: form.messageType === 'text' ? 'hsl(var(--primary) / 0.05)' : 'hsl(var(--background))',
                      }}
                    >
                      <input
                        type="radio"
                        checked={form.messageType === 'text'}
                        onChange={() => setForm({ ...form, messageType: 'text' })}
                        style={{ width: '18px', height: '18px' }}
                      />
                      <span>💬 Текстовое сообщение</span>
                    </label>
                  </div>
                </div>

                {/* Poll-specific fields */}
                {form.messageType === 'poll' && (
                  <>
                    <div>
                      <label style={{ display: 'block', marginBottom: '16px', fontSize: '14px', fontWeight: 500 }}>
                        Вопрос голосования
                      </label>
                      <input
                        style={{ padding: '12px 16px', width: '100%', borderRadius: '8px', border: '1px solid hsl(var(--input))', background: 'hsl(var(--background))' }}
                        value={form.pollQuestion}
                        onChange={(e) => setForm({ ...form, pollQuestion: e.target.value })}
                        placeholder="Кто сегодня забирает ребёнка из школы?"
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', marginBottom: '16px', fontSize: '14px', fontWeight: 500 }}>
                        Варианты ответа
                      </label>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {getPollOptionsArray().map((opt, idx) => (
                          <div key={idx} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <span style={{ minWidth: '24px', fontSize: '13px', color: 'hsl(var(--muted-foreground))' }}>{idx + 1}.</span>
                            <input
                              style={{ padding: '10px 14px', flex: 1, borderRadius: '8px', border: '1px solid hsl(var(--input))', background: 'hsl(var(--background))' }}
                              value={opt}
                              onChange={(e) => {
                                const opts = getPollOptionsArray();
                                opts[idx] = e.target.value;
                                setPollOptionsArray(opts);
                              }}
                              placeholder={`Вариант ${idx + 1}`}
                            />
                            {getPollOptionsArray().length > 2 && (
                              <button
                                type="button"
                                onClick={() => {
                                  const opts = getPollOptionsArray();
                                  opts.splice(idx, 1);
                                  setPollOptionsArray(opts);
                                }}
                                style={{ padding: '8px', borderRadius: '6px', border: '1px solid hsl(var(--border))', cursor: 'pointer', background: 'transparent', color: 'hsl(var(--destructive))' }}
                              >
                                ✕
                              </button>
                            )}
                          </div>
                        ))}
                        {getPollOptionsArray().length < 10 && (
                          <button
                            type="button"
                            onClick={() => {
                              const opts = getPollOptionsArray();
                              opts.push('');
                              setPollOptionsArray(opts);
                            }}
                            style={{ padding: '10px 14px', borderRadius: '8px', border: '1px dashed hsl(var(--border))', cursor: 'pointer', background: 'transparent', fontSize: '14px', color: 'hsl(var(--muted-foreground))' }}
                          >
                            + Добавить вариант
                          </button>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={form.pollIsAnonymous}
                          onChange={(e) => setForm({ ...form, pollIsAnonymous: e.target.checked })}
                          style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                        />
                        Анонимное
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={form.pollAllowsMultipleAnswers}
                          onChange={(e) => setForm({ ...form, pollAllowsMultipleAnswers: e.target.checked })}
                          style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                        />
                        Множественный выбор
                      </label>
                    </div>
                  </>
                )}

                {/* Text message field */}
                {form.messageType === 'text' && (
                  <div>
                    <label style={{ display: 'block', marginBottom: '16px', fontSize: '14px', fontWeight: 500 }}>
                      Текст сообщения
                    </label>
                    <textarea
                      rows={4}
                      style={{ padding: '12px 16px', width: '100%', borderRadius: '8px', border: '1px solid hsl(var(--input))', background: 'hsl(var(--background))', fontFamily: 'monospace', fontSize: '14px', resize: 'vertical' }}
                      value={form.messageText}
                      onChange={(e) => setForm({ ...form, messageText: e.target.value })}
                      placeholder="Доброе утро! 🌅 Напоминание..."
                    />
                  </div>
                )}

                {/* Schedule section */}
                <div>
                  <label style={{ display: 'block', marginBottom: '16px', fontSize: '14px', fontWeight: 500 }}>
                    📅 Расписание
                  </label>
                  <div style={{ padding: '16px', borderRadius: '8px', border: '1px solid hsl(var(--input))', background: 'hsl(var(--background))' }}>
                    {/* Schedule type selector */}
                    <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                      <label
                        style={{
                          flex: 1,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          padding: '10px 14px',
                          borderRadius: '8px',
                          border: `2px solid ${form.scheduleType === 'recurring' ? 'hsl(var(--primary))' : 'hsl(var(--input))'}`,
                          cursor: 'pointer',
                          background: form.scheduleType === 'recurring' ? 'hsl(var(--primary) / 0.05)' : 'transparent',
                          fontSize: '13px',
                        }}
                      >
                        <input
                          type="radio"
                          checked={form.scheduleType === 'recurring'}
                          onChange={() => setForm({ ...form, scheduleType: 'recurring' })}
                          style={{ width: '16px', height: '16px' }}
                        />
                        🔄 По дням недели
                      </label>
                      <label
                        style={{
                          flex: 1,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          padding: '10px 14px',
                          borderRadius: '8px',
                          border: `2px solid ${form.scheduleType === 'once' ? 'hsl(var(--primary))' : 'hsl(var(--input))'}`,
                          cursor: 'pointer',
                          background: form.scheduleType === 'once' ? 'hsl(var(--primary) / 0.05)' : 'transparent',
                          fontSize: '13px',
                        }}
                      >
                        <input
                          type="radio"
                          checked={form.scheduleType === 'once'}
                          onChange={() => setForm({ ...form, scheduleType: 'once' })}
                          style={{ width: '16px', height: '16px' }}
                        />
                        📆 На конкретную дату
                      </label>
                    </div>

                    {/* Days of week (recurring) */}
                    {form.scheduleType === 'recurring' && (
                      <div style={{ marginBottom: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                          <span style={{ fontSize: '13px', color: 'hsl(var(--muted-foreground))' }}>Дни недели:</span>
                          <button
                            type="button"
                            onClick={setWeekdays}
                            style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid hsl(var(--border))', cursor: 'pointer', background: 'transparent', fontSize: '12px', color: 'hsl(var(--primary))' }}
                          >
                            Будни
                          </button>
                          <button
                            type="button"
                            onClick={setAllDays}
                            style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid hsl(var(--border))', cursor: 'pointer', background: 'transparent', fontSize: '12px', color: 'hsl(var(--primary))' }}
                          >
                            Все дни
                          </button>
                        </div>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          {[1, 2, 3, 4, 5, 6, 0].map((day) => (
                            <button
                              key={day}
                              type="button"
                              onClick={() => toggleDay(day)}
                              style={{
                                flex: 1,
                                padding: '10px 4px',
                                borderRadius: '8px',
                                border: `2px solid ${form.scheduleDays.includes(day) ? 'hsl(var(--primary))' : 'hsl(var(--input))'}`,
                                cursor: 'pointer',
                                background: form.scheduleDays.includes(day) ? 'hsl(var(--primary))' : 'transparent',
                                color: form.scheduleDays.includes(day) ? 'hsl(var(--primary-foreground))' : 'inherit',
                                fontWeight: form.scheduleDays.includes(day) ? 600 : 400,
                                fontSize: '13px',
                                transition: 'all 0.15s ease',
                              }}
                            >
                              {DAY_NAMES[day]}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Date picker (once) */}
                    {form.scheduleType === 'once' && (
                      <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', color: 'hsl(var(--muted-foreground))' }}>
                          Дата запуска
                        </label>
                        <input
                          type="date"
                          style={{ padding: '10px 14px', width: '100%', borderRadius: '8px', border: '1px solid hsl(var(--input))', background: 'hsl(var(--background))' }}
                          value={form.scheduleDate}
                          onChange={(e) => setForm({ ...form, scheduleDate: e.target.value })}
                        />
                      </div>
                    )}

                    {/* Time and timezone */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', color: 'hsl(var(--muted-foreground))' }}>
                          Время отправки
                        </label>
                        <input
                          type="time"
                          style={{ padding: '10px 14px', width: '100%', borderRadius: '8px', border: '1px solid hsl(var(--input))', background: 'hsl(var(--background))' }}
                          value={form.scheduleTime}
                          onChange={(e) => setForm({ ...form, scheduleTime: e.target.value })}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', color: 'hsl(var(--muted-foreground))' }}>
                          Часовой пояс
                        </label>
                        <select
                          style={{ padding: '10px 14px', width: '100%', borderRadius: '8px', border: '1px solid hsl(var(--input))', background: 'hsl(var(--background))' }}
                          value={form.scheduleTimezone}
                          onChange={(e) => setForm({ ...form, scheduleTimezone: e.target.value })}
                        >
                          {TIMEZONES.map((tz) => (
                            <option key={tz} value={tz}>{tz}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bot token (optional) */}
                <div>
                  <label style={{ display: 'block', marginBottom: '16px', fontSize: '14px', fontWeight: 500 }}>
                    Bot Token (опционально)
                  </label>
                  <input
                    style={{ padding: '12px 16px', width: '100%', borderRadius: '8px', border: '1px solid hsl(var(--input))', background: 'hsl(var(--background))', fontFamily: 'monospace' }}
                    value={form.botToken}
                    onChange={(e) => setForm({ ...form, botToken: e.target.value })}
                    placeholder="Оставьте пустым для глобального токена"
                  />
                </div>

                {/* Enabled toggle */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '4px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', cursor: 'pointer' }}>
                    <EntityStateSwitch
                      idPrefix="bot-edit"
                      enabled={form.enabled}
                      onChange={(nextEnabled) => setForm({ ...form, enabled: nextEnabled })}
                    />
                  </label>
                </div>

                {/* Submit buttons */}
                <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                  <button
                    type="submit"
                    style={{ flex: 1, padding: '14px 24px', borderRadius: '8px', background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))', fontWeight: 600, cursor: 'pointer', border: 'none' }}
                  >
                    Сохранить
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingBotId(null);
                      if (selectedBot) setForm(normalizeForm(selectedBot));
                    }}
                    style={{ flex: 1, padding: '14px 24px', borderRadius: '8px', background: 'hsl(var(--secondary))', color: 'hsl(var(--secondary-foreground))', fontWeight: 600, cursor: 'pointer', border: 'none' }}
                  >
                    Отмена
                  </button>
                </div>
              </form>
            </div>
          ) : selectedBot ? (
            <div>
              <div className="entity-view">
                <div>
                  <h4 className="entity-view-title">Информация о боте</h4>
                  <div className="entity-view-card">
                    <div style={{ marginBottom: '12px' }}>
                      <strong>ID:</strong>{' '}
                      <code style={{ padding: '4px 8px', marginLeft: '8px' }} className="rounded bg-[hsl(var(--muted)_/_0.5)]">
                        {selectedBot.id}
                      </code>
                    </div>
                    <div style={{ marginBottom: '12px' }}>
                      <strong>Название:</strong> {selectedBot.name}
                    </div>
                    <div style={{ marginBottom: '12px' }}>
                      <strong>Статус:</strong>{' '}
                      <span
                        style={{ padding: '4px 8px' }}
                        className={`rounded text-xs ${
                          selectedBot.enabled
                            ? 'bg-[hsl(var(--success)_/_0.15)] text-[hsl(var(--success))]'
                            : 'bg-[hsl(var(--destructive)_/_0.1)] text-[hsl(var(--destructive))]'
                        }`}
                      >
                        {selectedBot.enabled ? '✅ Включено' : '⏸️ Отключено'}
                      </span>
                    </div>
                    <div style={{ marginBottom: '12px' }}>
                      <strong>Тип:</strong>{' '}
                      {selectedBot.messageType === 'poll' ? '📊 Голосование' : '💬 Текст'}
                    </div>
                  </div>
                </div>


                {selectedBot.messageType === 'poll' && (
                  <div>
                    <h4 className="entity-view-title">Голосование</h4>
                    <div className="entity-view-card space-y-3">
                      <div>
                        <strong>Вопрос:</strong> {selectedBot.pollQuestion}
                      </div>
                      <div>
                        <strong>Варианты:</strong>
                        <ul style={{ marginTop: '8px', paddingLeft: '20px' }}>
                          {(() => {
                            try {
                              return JSON.parse(selectedBot.pollOptions || '[]').map((opt: string, i: number) => (
                                <li key={i} style={{ marginBottom: '4px' }}>{opt}</li>
                              ));
                            } catch {
                              return <li>Ошибка парсинга</li>;
                            }
                          })()}
                        </ul>
                      </div>
                      <div>
                        <strong>Анонимное:</strong> {selectedBot.pollIsAnonymous ? 'Да' : 'Нет'} |{' '}
                        <strong>Множественный выбор:</strong> {selectedBot.pollAllowsMultipleAnswers ? 'Да' : 'Нет'}
                      </div>
                    </div>
                  </div>
                )}

                {selectedBot.messageType === 'text' && selectedBot.messageText && (
                  <div>
                    <h4 className="entity-view-title">Сообщение</h4>
                    <div className="entity-view-card">
                      <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{selectedBot.messageText}</div>
                    </div>
                  </div>
                )}

                <div>
                  <h4 className="entity-view-title">Расписание</h4>
                  <div className="entity-view-card space-y-3">
                    <div>
                      <strong>Режим:</strong>{' '}
                      <span style={{ padding: '4px 8px' }} className="rounded bg-[hsl(var(--muted)_/_0.3)] text-xs">
                        {selectedBot.scheduleType === 'once' ? '📆 Одноразовый' : '🔄 Повторяющийся'}
                      </span>
                    </div>
                    {selectedBot.scheduleType === 'once' ? (
                      <div>
                        <strong>Дата:</strong>{' '}
                        <code style={{ padding: '4px 8px', marginLeft: '8px' }} className="rounded bg-[hsl(var(--muted)_/_0.5)]">
                          {selectedBot.scheduleDate || '—'}
                        </code>
                      </div>
                    ) : (
                      <div>
                        <strong>Дни:</strong>{' '}
                        {(selectedBot.scheduleDays || []).map((d) => DAY_NAMES_FULL[d]).join(', ')}
                      </div>
                    )}
                    <div>
                      <strong>Время:</strong>{' '}
                      <code style={{ padding: '4px 8px', marginLeft: '8px' }} className="rounded bg-[hsl(var(--muted)_/_0.5)]">
                        {selectedBot.scheduleTime}
                      </code>
                    </div>
                    <div>
                      <strong>Часовой пояс:</strong>{' '}
                      <code style={{ padding: '4px 8px', marginLeft: '8px' }} className="rounded bg-[hsl(var(--muted)_/_0.5)]">
                        {selectedBot.scheduleTimezone}
                      </code>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="entity-view-title">Отправка</h4>
                  <div className="entity-view-card space-y-3">
                    <div>
                      <strong>Chat ID:</strong>{' '}
                      <code style={{ padding: '4px 8px', marginLeft: '8px' }} className="rounded bg-[hsl(var(--muted)_/_0.5)]">
                        {selectedBot.chatId}
                      </code>
                    </div>
                    {selectedBot.lastRunAt && (
                      <div>
                        <strong>Последний запуск:</strong>{' '}
                        {new Date(selectedBot.lastRunAt).toLocaleString('ru-RU')}
                      </div>
                    )}
                    {selectedBot.lastError && (
                      <div className="text-[hsl(var(--destructive))]">
                        <strong>Последняя ошибка:</strong> {selectedBot.lastError}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-lg border border-[hsl(var(--border)_/_0.6)] bg-[hsl(var(--card))] p-10 text-center text-[hsl(var(--muted-foreground))]">
              <p className="mb-4">Выберите бота слева или создайте нового</p>
              <button
                onClick={handleStartCreate}
                className="inline-flex items-center gap-2 rounded bg-[hsl(var(--primary))] px-4 py-2 font-semibold text-[hsl(var(--primary-foreground))]"
              >
                <Plus className="h-4 w-4" /> Создать бота
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Export Modal */}
      <ExportModal
        isOpen={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        title="Экспорт ботов"
        description="Выберите ботов для экспорта"
        items={bots.map((b) => ({ id: b.id, name: b.name, enabled: b.enabled }))}
        loading={loading}
        exportFileName="bots-export.json"
        exportType="bots"
        onExportSuccess={(count) => addToast(`Экспортировано ботов: ${count}`, 'success')}
      />
    </div>
  );
}
