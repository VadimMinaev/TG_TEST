import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { api, Bot } from '../lib/api';
import { useAuth } from '../lib/auth-context';
import { Copy, Download, Pencil, Play, Plus, RefreshCw, Trash2, Upload, ChevronLeft } from 'lucide-react';
import { ExportModal } from '../components/ExportModal';
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
  const [accountBotToken, setAccountBotToken] = useState<string | null>(null);
  const [accountBotTokenLoading, setAccountBotTokenLoading] = useState(true);
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
    // Load account bot token
    api.getAccountBotToken()
      .then(data => {
        setAccountBotToken(data.isSet ? data.botToken : null);
      })
      .catch(() => {
        setAccountBotToken(null);
      })
      .finally(() => {
        setAccountBotTokenLoading(false);
      });
  }, []);

  // URL params
  useEffect(() => {
    const createParam = searchParams.get('create');
    const selectParam = searchParams.get('select');

    if (createParam === 'true') {
      setSelectedBotId(null);
      setEditingBotId(-1);
      setForm(DEFAULT_FORM);
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete('create');
        next.delete('select');
        return next;
      }, { replace: true });
    } else if (selectParam) {
      const id = parseInt(selectParam, 10);
      if (!isNaN(id)) {
        setSelectedBotId(id);
        setEditingBotId(null);
      }
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete('create');
        next.delete('select');
        return next;
      }, { replace: true });
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
        botToken: form.botToken.trim() ? form.botToken : undefined,
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
    <div className="card" style={{ overflow: 'clip' }}>
      <div className="card-header">
        <div className="flex flex-col gap-2">
          <h2 className="text-xl font-semibold">Bots</h2>
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


      <div className={`fp ${selectedBotId !== null || editingBotId !== null ? 'fp-has-selection' : ''}`}>
        <div className="fp-sidebar">
          <div className="fp-sidebar-head">
            <span className="fp-sidebar-title">Телеграм боты</span>
            <div className="fp-sidebar-actions">
              {canEdit && <button className="fp-icon-btn" onClick={handleStartCreate} title="Создать"><Plus size={13} /></button>}
              <button className="fp-icon-btn" onClick={() => loadBots()} title="Обновить"><RefreshCw size={13} /></button>
            </div>
          </div>
          <div className="fp-bot-list">
            {loading ? (
              <div className="fp-loading"><div className="fp-spinner" /></div>
            ) : bots.length === 0 ? (
              <div className="fp-empty">Ботов нет</div>
            ) : bots.map((bot) => (
              <div key={bot.id} className={`fp-bot-item ${selectedBotId === bot.id ? 'active' : ''}`} onClick={() => handleSelectBot(bot.id)}>
                <div className="fp-bot-avatar">{(bot.name || '?')[0]}</div>
                <div className="fp-bot-info">
                  <div className="fp-bot-name">{bot.name}</div>
                  <div className="fp-bot-model">{bot.messageType === 'poll' ? 'Poll' : 'Message'} · {formatSchedule(bot)}</div>
                </div>
                <div className={`fp-dot ${bot.enabled ? 'on' : ''}`} />
              </div>
            ))}
          </div>
        </div>

        <div className="fp-panel">
          <div className="fp-panel-head">
            {(selectedBotId !== null || editingBotId !== null) && (
              <button 
                type="button"
                className="fp-back fp-back-mobile" 
                onClick={() => {
                  if (editingBotId !== null && editingBotId !== -1 && selectedBotId !== null) {
                    setEditingBotId(null);
                  } else {
                    setSelectedBotId(null);
                    setEditingBotId(null);
                  }
                }}
                style={{ marginRight: '8px' }}
              >
                <ChevronLeft size={14} />
              </button>
            )}
            <div className="fp-panel-meta">
              <div className="fp-panel-name">{editingBotId !== null ? (editingBotId === -1 ? 'Создание бота' : 'Редактирование') : selectedBotId ? 'Просмотр' : 'Телеграм боты'}</div>
            </div>
          </div>

          <div className="fp-form-body">
          {editingBotId !== null ? (
            <>
              <h3 className="mb-4 text-lg font-semibold">
                {editingBotId === -1 ? 'Создание бота' : 'Редактирование бота'}
              </h3>
              <form onSubmit={handleSaveBot} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {/* Название и Chat ID */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="form-label-simple">
                      Название
                    </label>
                    <input
                      className="input-field"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      placeholder="Голосование в школьный чат"
                    />
                  </div>
                  <div>
                    <label className="form-label-simple">
                      Chat ID
                    </label>
                    <input
                      className="input-field"
                      value={form.chatId}
                      onChange={(e) => setForm({ ...form, chatId: e.target.value })}
                      placeholder="-1001234567890"
                    />
                  </div>
                </div>

                {/* Тип сообщения */}
                <div>
                  <label className="form-label-simple">
                    Тип сообщения
                  </label>
                  <div className="form-row">
                    <label
                      className={`radio-card ${form.messageType === 'poll' ? 'selected' : ''}`}
                    >
                      <input
                        type="radio"
                        checked={form.messageType === 'poll'}
                        onChange={() => setForm({ ...form, messageType: 'poll' })}
                      />
                      <span>📊 Голосование</span>
                    </label>
                    <label
                      className={`radio-card ${form.messageType === 'text' ? 'selected' : ''}`}
                    >
                      <input
                        type="radio"
                        checked={form.messageType === 'text'}
                        onChange={() => setForm({ ...form, messageType: 'text' })}
                      />
                      <span>💬 Текстовое сообщение</span>
                    </label>
                  </div>
                </div>

                {/* Poll-specific fields */}
                {form.messageType === 'poll' && (
                  <>
                    <div>
                    <label className="form-label-simple">
                      Вопрос голосования
                    </label>
                    <input
                      className="input-field"
                        value={form.pollQuestion}
                        onChange={(e) => setForm({ ...form, pollQuestion: e.target.value })}
                        placeholder="Кто сегодня забирает ребёнка из школы?"
                      />
                    </div>

                    <div className="fp-section">
                      <div className="fp-fields-grid">
                        {getPollOptionsArray().map((opt, idx) => (
                          <div key={idx} className="fp-field" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <span className="form-hint" style={{ minWidth: '24px', marginTop: 0 }}>{idx + 1}.</span>
                            <input
                              className="input-field"
                              style={{ flex: 1 }}
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
                                className="remove-option-btn"
                              >
                                ✕
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                      {getPollOptionsArray().length < 10 && (
                        <button
                          type="button"
                          onClick={() => {
                            const opts = getPollOptionsArray();
                            opts.push('');
                            setPollOptionsArray(opts);
                          }}
                          className="add-option-btn"
                        >
                          + Добавить вариант
                        </button>
                      )}
                    </div>

                    <div className="form-checkbox-row">
                      <label className="form-checkbox-label">
                        <input
                          type="checkbox"
                          checked={form.pollIsAnonymous}
                          onChange={(e) => setForm({ ...form, pollIsAnonymous: e.target.checked })}
                          className="form-checkbox"
                        />
                        Анонимное
                      </label>
                      <label className="form-checkbox-label">
                        <input
                          type="checkbox"
                          checked={form.pollAllowsMultipleAnswers}
                          onChange={(e) => setForm({ ...form, pollAllowsMultipleAnswers: e.target.checked })}
                          className="form-checkbox"
                        />
                        Множественный выбор
                      </label>
                    </div>
                  </>
                )}

                {/* Text message field */}
                {form.messageType === 'text' && (
                  <div>
                    <label className="form-label-simple">
                      Текст сообщения
                    </label>
                    <textarea
                      rows={4}
                      className="textarea-field input-field-mono"
                      value={form.messageText}
                      onChange={(e) => setForm({ ...form, messageText: e.target.value })}
                      placeholder="Доброе утро! 🌅 Напоминание..."
                    />
                  </div>
                )}

                {/* Schedule section */}
                <div>
                    <label className="form-label-simple">
                      📅 Расписание
                    </label>
                  <div className="schedule-container">
                    {/* Schedule type selector */}
                    <div className="radio-card-group" style={{ marginBottom: '16px' }}>
                      <label className={`radio-card radio-card-sm ${form.scheduleType === 'recurring' ? 'selected' : ''}`}>
                        <input
                          type="radio"
                          checked={form.scheduleType === 'recurring'}
                          onChange={() => setForm({ ...form, scheduleType: 'recurring' })}
                        />
                        🔄 По дням недели
                      </label>
                      <label className={`radio-card radio-card-sm ${form.scheduleType === 'once' ? 'selected' : ''}`}>
                        <input
                          type="radio"
                          checked={form.scheduleType === 'once'}
                          onChange={() => setForm({ ...form, scheduleType: 'once' })}
                        />
                        📆 На конкретную дату
                      </label>
                    </div>

                    {/* Days of week (recurring) */}
                    {form.scheduleType === 'recurring' && (
                      <div style={{ marginBottom: '16px' }}>
                        <div className="form-checkbox-row" style={{ marginBottom: '12px' }}>
                          <span className="form-hint" style={{ margin: 0 }}>Дни недели:</span>
                          <button type="button" onClick={setWeekdays} className="quick-link-btn">Будни</button>
                          <button type="button" onClick={setAllDays} className="quick-link-btn">Все дни</button>
                        </div>
                        <div className="day-picker">
                          {[1, 2, 3, 4, 5, 6, 0].map((day) => (
                            <button
                              key={day}
                              type="button"
                              onClick={() => toggleDay(day)}
                              className={`day-btn ${form.scheduleDays.includes(day) ? 'active' : ''}`}
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
                        <label className="form-label-simple">
                          Дата запуска
                        </label>
                        <input
                          type="date"
                          className="input-field"
                          value={form.scheduleDate}
                          onChange={(e) => setForm({ ...form, scheduleDate: e.target.value })}
                        />
                      </div>
                    )}

                    {/* Time and timezone */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="form-hint">
                          Время отправки
                        </label>
                        <input
                          type="time"
                          className="input-field"
                          value={form.scheduleTime}
                          onChange={(e) => setForm({ ...form, scheduleTime: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="form-hint">
                          Часовой пояс
                        </label>
                        <select
                          className="input-field"
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
                  <label className="form-label-simple">
                    Bot Token (опционально)
                  </label>
                  <input
                    className="input-field input-field-mono"
                    value={form.botToken}
                    onChange={(e) => setForm({ ...form, botToken: e.target.value })}
                    placeholder={accountBotTokenLoading ? 'Загрузка...' : (accountBotToken ? 'Используется токен аккаунта' : 'Оставьте пустым для использования токена аккаунта')}
                    disabled={accountBotTokenLoading}
                  />
                  {!accountBotTokenLoading && accountBotToken && (
                    <div className="form-hint">
                      ✓ Токен аккаунта установлен. Оставьте поле пустым для его использования или введите локальный токен.
                    </div>
                  )}
                  {!accountBotTokenLoading && !accountBotToken && (
                    <div className="form-hint">
                      ⚠ Токен аккаунта не установлен. Укажите токен в настройках аккаунта или введите локальный токен.
                    </div>
                  )}
                </div>

                {/* Enabled toggle */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '4px' }}>
                  <label className="form-checkbox-label">
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
                    className="btn-primary"
                  >
                    Сохранить
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingBotId(null);
                      if (selectedBot) setForm(normalizeForm(selectedBot));
                    }}
                    className="btn-secondary"
                  >
                    Отмена
                  </button>
                </div>
              </form>
            </>
          ) : selectedBot ? (
            <div>
              <div className="entity-view">
                <div>
                  <h4 className="entity-view-title">Информация о боте</h4>
                  <div className="entity-view-card">
                    <div className="view-field">
                      <strong>ID:</strong>{' '}
                      <code className="view-code">{selectedBot.id}</code>
                    </div>
                    <div className="view-field">
                      <strong>Название:</strong> {selectedBot.name}
                    </div>
                    <div className="view-field">
                      <strong>Статус:</strong>{' '}
                      <span className={`view-badge ${selectedBot.enabled ? 'view-badge-success' : 'view-badge-error'}`}>
                        {selectedBot.enabled ? '✅ Включено' : '⏸️ Отключено'}
                      </span>
                    </div>
                    <div className="view-field">
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
                      <span className="view-badge view-badge-neutral">
                        {selectedBot.scheduleType === 'once' ? '📆 Одноразовый' : '🔄 Повторяющийся'}
                      </span>
                    </div>
                    {selectedBot.scheduleType === 'once' ? (
                      <div>
                        <strong>Дата:</strong>{' '}
                        <code className="view-code">
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
                      <code className="view-code">
                        {selectedBot.scheduleTime}
                      </code>
                    </div>
                    <div>
                      <strong>Часовой пояс:</strong>{' '}
                      <code className="view-code">
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
                      <code className="view-code">
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
            <div className="fp-placeholder">
              <p>Выберите бота слева или создайте нового</p>
              <button onClick={handleStartCreate} className="fp-btn fp-btn-primary">
                <Plus size={14} /> Создать бота
              </button>
            </div>
          )}
          </div>
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
