import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Bot, Eye, EyeOff, RefreshCw, Save, Trash2, ChevronLeft, Plus } from 'lucide-react';
import { api, AiBot } from '../lib/api';
import { useAuth } from '../lib/auth-context';
import { useToast } from '../components/ToastNotification';

type AiBotForm = Omit<AiBot, 'id'>;

const PROVIDER_MODELS: Record<'gemini' | 'groq' | 'openai' | 'openrouter' | 'custom', string> = {
  gemini: 'gemini-2.0-flash',
  groq: 'llama-3.3-70b-versatile',
  openai: 'gpt-4o-mini',
  openrouter: 'openai/gpt-4o-mini',
  custom: '',
};

const MODEL_OPTIONS: Record<'gemini' | 'groq' | 'openai' | 'openrouter' | 'custom', string[]> = {
  gemini: ['gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-1.5-flash', 'gemini-1.5-pro'],
  groq: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768', 'gemma2-9b-it'],
  openai: ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini', 'gpt-4.1'],
  openrouter: ['openai/gpt-4o-mini', 'openai/gpt-4o', 'anthropic/claude-3.5-sonnet', 'google/gemini-2.0-flash-001'],
  custom: [],
};

const DEFAULT_FORM: AiBotForm = {
  name: '',
  enabled: true,
  provider: 'gemini',
  telegramBotToken: '',
  apiKey: '',
  model: PROVIDER_MODELS.gemini,
  apiBase: '',
  systemPrompt: '',
  allowVoice: true,
  webhookUrl: '',
  webhookSet: false,
};

function getInitial(name: string) {
  return (name || '?')[0].toUpperCase();
}

export function AiBots() {
  const { user } = useAuth();
  const canEdit = user?.role !== 'auditor';
  const { addToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [bots, setBots] = useState<AiBot[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<AiBotForm>(DEFAULT_FORM);
  const [forceCustomModelInput, setForceCustomModelInput] = useState(false);
  const [openRouterModels, setOpenRouterModels] = useState<string[]>([]);
  const [openRouterModelsLoaded, setOpenRouterModelsLoaded] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [showToken, setShowToken] = useState(false);

  const provider = (form.provider || 'gemini') as 'gemini' | 'groq' | 'openai' | 'openrouter' | 'custom';
  const providerModels = provider === 'openrouter'
    ? (openRouterModels.length ? openRouterModels : MODEL_OPTIONS.openrouter)
    : (MODEL_OPTIONS[provider] || []);
  const isCustomModel = form.model ? !providerModels.includes(form.model) : false;
  const showCustomModelInput = forceCustomModelInput || isCustomModel;

  const selectedBot = useMemo(() => bots.find((bot) => bot.id === selectedId) || null, [bots, selectedId]);

  const loadBots = async () => {
    try {
      setLoading(true);
      const data = await api.getAiBots();
      setBots(data);
      if (data.length && (selectedId == null || !data.some((item) => item.id === selectedId))) {
        setSelectedId(data[0].id);
      }
      if (!data.length) {
        setSelectedId(null);
        setEditingId(null);
      }
    } catch (error: any) {
      addToast(error.message || 'Не удалось загрузить AI ботов', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadBots(); }, []);

  useEffect(() => {
    if (provider !== 'openrouter' || openRouterModelsLoaded) return;
    (async () => {
      try {
        const models = await api.getAiProviderModels('openrouter');
        if (models.length > 0) setOpenRouterModels(models);
      } catch { /* keep fallback */ } finally {
        setOpenRouterModelsLoaded(true);
      }
    })();
  }, [provider, openRouterModelsLoaded]);

  useEffect(() => {
    const createParam = searchParams.get('create');
    const selectParam = searchParams.get('select');
    if (createParam === 'true') {
      setSelectedId(null);
      setEditingId(-1);
      setForm(DEFAULT_FORM);
      setSearchParams((prev) => { const n = new URLSearchParams(prev); n.delete('create'); n.delete('select'); return n; }, { replace: true });
      return;
    }
    if (selectParam) {
      const parsedId = Number(selectParam);
      if (Number.isInteger(parsedId) && parsedId > 0) {
        setSelectedId(parsedId);
        setEditingId(null);
      }
      setSearchParams((prev) => { const n = new URLSearchParams(prev); n.delete('create'); n.delete('select'); return n; }, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const handleStartCreate = () => {
    setSelectedId(null);
    setEditingId(-1);
    setForm(DEFAULT_FORM);
    setForceCustomModelInput(false);
    setShowApiKey(false);
    setShowToken(false);
  };

  const handleEdit = (bot: AiBot) => {
    const prov = bot.provider || 'gemini';
    setSelectedId(bot.id);
    setEditingId(bot.id);
    setForceCustomModelInput(false);
    setShowApiKey(false);
    setShowToken(false);
    setForm({
      name: bot.name || '',
      enabled: bot.enabled ?? true,
      provider: prov,
      telegramBotToken: bot.telegramBotToken || '',
      apiKey: bot.apiKey || bot.geminiApiKey || '',
      model: bot.model || bot.geminiModel || PROVIDER_MODELS[prov],
      apiBase: bot.apiBase || '',
      systemPrompt: bot.systemPrompt || '',
      allowVoice: bot.allowVoice ?? true,
      webhookSet: bot.webhookSet ?? false,
      webhookUrl: bot.webhookUrl || '',
      created_at: bot.created_at,
      updated_at: bot.updated_at,
      authorId: bot.authorId,
      geminiApiKey: bot.geminiApiKey,
      geminiModel: bot.geminiModel,
    });
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.name.trim()) { addToast('Введите название', 'error'); return; }
    if (!form.telegramBotToken.trim()) { addToast('Введите Telegram Bot Token', 'error'); return; }
    if (!form.apiKey.trim()) { addToast('Введите API Key провайдера', 'error'); return; }
    if (form.provider === 'custom' && !(form.apiBase || '').trim()) { addToast('Введите URL API (Base URL)', 'error'); return; }
    if (!form.model.trim()) { addToast('Введите модель', 'error'); return; }

    const payload = {
      name: form.name.trim(),
      enabled: !!form.enabled,
      provider: (form.provider || 'gemini') as 'gemini' | 'groq' | 'openai' | 'openrouter' | 'custom',
      telegramBotToken: form.telegramBotToken.trim(),
      apiKey: form.apiKey.trim(),
      model: form.model.trim(),
      apiBase: form.apiBase?.trim() || '',
      systemPrompt: (form.systemPrompt || '').trim(),
      allowVoice: !!form.allowVoice,
    };

    try {
      setSaving(true);
      if (editingId && editingId !== -1) {
        const updated = await api.updateAiBot(editingId, payload);
        setBots((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
        setSelectedId(updated.id);
        setEditingId(null);
        addToast('AI бот обновлен', 'success');
      } else {
        const created = await api.createAiBot(payload);
        setBots((prev) => [created, ...prev]);
        setSelectedId(created.id);
        setEditingId(null);
        addToast('AI бот создан', 'success');
      }
    } catch (error: any) {
      addToast(error.message || 'Не удалось сохранить AI бота', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (bot: AiBot) => {
    if (!confirm(`Удалить AI бота "${bot.name}"?`)) return;
    try {
      await api.deleteAiBot(bot.id);
      setBots((prev) => prev.filter((item) => item.id !== bot.id));
      if (selectedId === bot.id) { setSelectedId(null); setEditingId(null); }
      addToast('AI бот удален', 'success');
    } catch (error: any) {
      addToast(error.message || 'Не удалось удалить AI бота', 'error');
    }
  };

  const handleDeleteFromForm = async () => {
    if (!selectedBot) return;
    await handleDelete(selectedBot);
  };

  return (
    <div className="form-page">
      {/* Sidebar */}
      <aside className="form-sidebar">
        <div className="form-sidebar-header">
          <span className="form-sidebar-title">AI Боты</span>
          <div className="flex gap-1">
            {canEdit && (
              <button className="form-btn-icon" onClick={handleStartCreate} title="Создать">
                <Plus size={14} />
              </button>
            )}
            <button className="form-btn-icon" onClick={loadBots} title="Обновить">
              <RefreshCw size={14} />
            </button>
          </div>
        </div>
        <div className="form-bot-list">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--form-accent)] border-t-transparent" />
            </div>
          ) : bots.length === 0 ? (
            <p className="py-10 text-center text-xs" style={{ color: 'var(--form-text-secondary)' }}>AI ботов нет</p>
          ) : (
            bots.map((bot) => (
              <div
                key={bot.id}
                className={`form-bot-item ${selectedId === bot.id ? 'active' : ''}`}
                onClick={() => { setSelectedId(bot.id); setEditingId(null); }}
              >
                <div className="form-bot-avatar">{getInitial(bot.name)}</div>
                <div className="form-bot-info">
                  <div className="form-bot-name">{bot.name}</div>
                  <div className="form-bot-model">{bot.provider || 'gemini'} / {bot.model || bot.geminiModel || '—'}</div>
                </div>
                <div className={`form-status-dot ${bot.enabled ? 'on' : ''}`} />
              </div>
            ))
          )}
        </div>
      </aside>

      {/* Panel */}
      <div className="form-panel">
        {editingId !== null ? (
          <>
            <div className="form-panel-header">
              <button className="form-panel-back" onClick={() => setEditingId(null)} title="Назад">
                <ChevronLeft size={14} />
              </button>
              <div>
                <div className="form-panel-title">{editingId === -1 ? 'Создание AI бота' : 'Редактирование AI бота'}</div>
                {editingId !== -1 && selectedBot && (
                  <div className="form-panel-subtitle">{selectedBot.name} · {selectedBot.provider || 'gemini'} / {selectedBot.model || '—'}</div>
                )}
              </div>
            </div>

            <form onSubmit={handleSave} className="form-body">
              {/* Группа: Общее */}
              <div className="field-group">
                <div className="group-label">Общее</div>

                <div className="form-field">
                  <label className="form-field-label">Название <span className="required">*</span></label>
                  <input
                    className="form-input"
                    value={form.name}
                    onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="Введите название бота"
                  />
                </div>

                <div className="form-field">
                  <label className="form-field-label">Провайдер</label>
                  <select
                    className="form-select"
                    value={form.provider || 'gemini'}
                    onChange={(e) => {
                      setForceCustomModelInput(false);
                      setForm((prev) => {
                        const next = (e.target.value as typeof prev.provider) || 'gemini';
                        return { ...prev, provider: next, model: PROVIDER_MODELS[next], apiBase: next === 'custom' ? prev.apiBase : '' };
                      });
                    }}
                  >
                    <option value="gemini">Gemini</option>
                    <option value="groq">Groq</option>
                    <option value="openai">OpenAI</option>
                    <option value="openrouter">OpenRouter</option>
                    <option value="custom">Свой (OpenAI)</option>
                  </select>
                </div>
              </div>

              {/* Группа: Подключение */}
              <div className="field-group">
                <div className="group-label">Подключение</div>

                {form.provider === 'custom' && (
                  <div className="form-field">
                    <label className="form-field-label">URL API (Base URL)</label>
                    <input
                      className="form-input mono"
                      value={form.apiBase || ''}
                      onChange={(e) => setForm((prev) => ({ ...prev, apiBase: e.target.value }))}
                      placeholder="https://example.com/v1"
                    />
                    <span className="form-field-hint">Базовый адрес OpenAI-совместимого API</span>
                  </div>
                )}

                <div className="form-field">
                  <label className="form-field-label">Telegram Bot Token</label>
                  <div className="form-input-wrap">
                    <input
                      className="form-input mono"
                      type={showToken ? 'text' : 'password'}
                      value={form.telegramBotToken}
                      onChange={(e) => setForm((prev) => ({ ...prev, telegramBotToken: e.target.value }))}
                      placeholder="123456789:ABCdef..."
                    />
                    <button type="button" className="input-icon-right" onClick={() => setShowToken(!showToken)} title="Показать/скрыть">
                      {showToken ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <span className="form-field-hint">Получить токен можно у <a href="https://t.me/BotFather" target="_blank" rel="noopener" style={{ color: 'var(--form-accent)', textDecoration: 'none' }}>@BotFather</a></span>
                </div>

                <div className="form-field">
                  <label className="form-field-label">API Key <span className="required">*</span></label>
                  <div className="form-input-wrap">
                    <input
                      className="form-input mono"
                      type={showApiKey ? 'text' : 'password'}
                      value={form.apiKey}
                      onChange={(e) => setForm((prev) => ({ ...prev, apiKey: e.target.value }))}
                      placeholder={form.provider === 'groq' ? 'gsk_...' : form.provider === 'openai' ? 'sk-...' : form.provider === 'openrouter' ? 'sk-or-v1-...' : form.provider === 'custom' ? 'sk-...' : 'AIza...'}
                    />
                    <button type="button" className="input-icon-right" onClick={() => setShowApiKey(!showApiKey)} title="Показать/скрыть">
                      {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {form.provider === 'custom' ? (
                  <div className="form-field">
                    <label className="form-field-label">Название модели</label>
                    <input
                      className="form-input mono"
                      value={form.model}
                      onChange={(e) => setForm((prev) => ({ ...prev, model: e.target.value }))}
                      placeholder="qwen3-72b, llama-3.1-405b..."
                    />
                  </div>
                ) : (
                  <div className="form-field">
                    <label className="form-field-label">Модель</label>
                    <select
                      className="form-select"
                      value={showCustomModelInput ? '__custom__' : form.model}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v === '__custom__') { setForceCustomModelInput(true); return; }
                        setForceCustomModelInput(false);
                        setForm((prev) => ({ ...prev, model: v }));
                      }}
                    >
                      {providerModels.map((m) => <option key={m} value={m}>{m}</option>)}
                      <option value="__custom__">Своя модель...</option>
                    </select>
                    {showCustomModelInput && (
                      <input
                        className="form-input mono mt-2"
                        value={form.model}
                        onChange={(e) => {
                          const v = e.target.value;
                          setForm((prev) => ({ ...prev, model: v }));
                          if (providerModels.includes(v)) setForceCustomModelInput(false);
                        }}
                        placeholder="Введите имя модели"
                      />
                    )}
                  </div>
                )}
              </div>

              {/* Группа: Поведение */}
              <div className="field-group">
                <div className="group-label">Поведение</div>

                <div className="form-field">
                  <label className="form-field-label">System Prompt</label>
                  <textarea
                    className="form-textarea"
                    rows={4}
                    value={form.systemPrompt || ''}
                    onChange={(e) => setForm((prev) => ({ ...prev, systemPrompt: e.target.value }))}
                    placeholder="Инструкции для бота..."
                  />
                  <span className="form-field-hint">Контекст, который будет добавляться перед каждым диалогом</span>
                </div>
              </div>

              {/* Группа: Состояние */}
              <div className="field-group">
                <div className="group-label">Состояние</div>

                <div className="form-toggle-row">
                  <div className="form-toggle-info">
                    <div className="form-toggle-name">Бот активен</div>
                    <div className="form-toggle-desc">Принимает и обрабатывает входящие сообщения</div>
                  </div>
                  <label className="form-toggle">
                    <input type="checkbox" checked={!!form.enabled} onChange={(e) => setForm((prev) => ({ ...prev, enabled: e.target.checked }))} />
                    <div className="form-toggle-track"><div className="form-toggle-thumb" /></div>
                  </label>
                </div>

                <div className="form-toggle-row">
                  <div className="form-toggle-info">
                    <div className="form-toggle-name">Голосовые сообщения</div>
                    <div className="form-toggle-desc">Распознавание и обработка голосовых вложений</div>
                  </div>
                  <label className="form-toggle">
                    <input type="checkbox" checked={!!form.allowVoice} onChange={(e) => setForm((prev) => ({ ...prev, allowVoice: e.target.checked }))} />
                    <div className="form-toggle-track"><div className="form-toggle-thumb" /></div>
                  </label>
                </div>
              </div>
            </form>

            <div className="form-footer">
              {editingId !== -1 && canEdit && (
                <button type="button" className="form-btn form-btn-danger" onClick={handleDeleteFromForm}>
                  <Trash2 size={15} /> Удалить
                </button>
              )}
              <button type="button" className="form-btn form-btn-ghost" onClick={() => setEditingId(null)}>Отмена</button>
              <button type="submit" form={undefined} className="form-btn form-btn-primary" disabled={saving} onClick={(e) => { e.preventDefault(); document.querySelector<HTMLFormElement>('.form-body')?.requestSubmit(); }}>
                <Save size={15} /> {saving ? 'Сохранение...' : 'Сохранить'}
              </button>
            </div>
          </>
        ) : selectedBot ? (
          <>
            <div className="form-panel-header">
              <div>
                <div className="form-panel-title">{selectedBot.name}</div>
                <div className="form-panel-subtitle">{selectedBot.provider || 'gemini'} / {selectedBot.model || selectedBot.geminiModel || '—'}</div>
              </div>
              <div className="ml-auto flex gap-2">
                {canEdit && (
                  <button className="form-btn form-btn-primary" onClick={() => handleEdit(selectedBot)}>
                    Редактировать
                  </button>
                )}
              </div>
            </div>

            <div className="form-body">
              <div className="field-group">
                <div className="group-label">Общее</div>
                <div className="form-field">
                  <label className="form-field-label">Название</label>
                  <div className="form-input" style={{ background: 'var(--form-elevated)', cursor: 'default' }}>{selectedBot.name}</div>
                </div>
                <div className="form-field">
                  <label className="form-field-label">Провайдер</label>
                  <div className="form-input" style={{ background: 'var(--form-elevated)', cursor: 'default' }}>{selectedBot.provider || 'gemini'}</div>
                </div>
                <div className="form-field">
                  <label className="form-field-label">Модель</label>
                  <div className="form-input mono" style={{ background: 'var(--form-elevated)', cursor: 'default' }}>{selectedBot.model || selectedBot.geminiModel || '—'}</div>
                </div>
              </div>

              <div className="field-group">
                <div className="group-label">Подключение</div>
                {selectedBot.provider === 'custom' && selectedBot.apiBase && (
                  <div className="form-field">
                    <label className="form-field-label">API Base URL</label>
                    <div className="form-input mono" style={{ background: 'var(--form-elevated)', cursor: 'default' }}>{selectedBot.apiBase}</div>
                  </div>
                )}
                <div className="form-field">
                  <label className="form-field-label">Telegram Token</label>
                  <div className="form-input mono" style={{ background: 'var(--form-elevated)', cursor: 'default' }}>
                    {selectedBot.telegramBotToken ? `${selectedBot.telegramBotToken.slice(0, 8)}...${selectedBot.telegramBotToken.slice(-4)}` : '—'}
                  </div>
                </div>
                <div className="form-field">
                  <label className="form-field-label">API Key</label>
                  <div className="form-input mono" style={{ background: 'var(--form-elevated)', cursor: 'default' }}>
                    {selectedBot.apiKey ? `${selectedBot.apiKey.slice(0, 4)}...${selectedBot.apiKey.slice(-4)}` : '—'}
                  </div>
                </div>
              </div>

              <div className="field-group">
                <div className="group-label">Поведение</div>
                <div className="form-field">
                  <label className="form-field-label">System Prompt</label>
                  <div className="form-textarea" style={{ background: 'var(--form-elevated)', cursor: 'default', minHeight: 'auto' }}>{selectedBot.systemPrompt || '—'}</div>
                </div>
              </div>

              <div className="field-group">
                <div className="group-label">Состояние</div>
                <div className="form-toggle-row">
                  <div className="form-toggle-info">
                    <div className="form-toggle-name">Бот активен</div>
                    <div className="form-toggle-desc">{selectedBot.enabled ? 'Включен' : 'Выключен'}</div>
                  </div>
                  <div className={`form-status-dot ${selectedBot.enabled ? 'on' : ''}`} />
                </div>
                <div className="form-toggle-row">
                  <div className="form-toggle-info">
                    <div className="form-toggle-name">Webhook</div>
                    <div className="form-toggle-desc">{selectedBot.webhookSet ? 'Установлен' : 'Не установлен'}</div>
                  </div>
                  <div className={`form-status-dot ${selectedBot.webhookSet ? 'on' : ''}`} />
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center flex-1" style={{ color: 'var(--form-text-secondary)' }}>
            <Bot size={40} strokeWidth={1.5} style={{ opacity: 0.4, marginBottom: 12 }} />
            <p className="text-sm">Выберите AI бота или создайте нового</p>
          </div>
        )}
      </div>
    </div>
  );
}
