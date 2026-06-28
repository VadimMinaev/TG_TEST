import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Bot, Eye, EyeOff, RefreshCw, Save, Trash2, ChevronLeft, Plus, Pencil, Plug, Unplug } from 'lucide-react';
import { api, AiBot } from '../lib/api';
import { useAuth } from '../lib/auth-context';
import { useToast } from '../components/ToastNotification';
import { AiFieldAssist } from '../components/AIFieldAssist';

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
  name: '', enabled: true, provider: 'gemini', telegramBotToken: '', apiKey: '',
  model: PROVIDER_MODELS.gemini, apiBase: '', systemPrompt: '', allowVoice: true,
  webhookUrl: '', webhookSet: false,
};

function getInitial(name: string) { return (name || '?')[0].toUpperCase(); }

function SecretValue({ value }: { value: string }) {
  const [show, setShow] = useState(false);
  if (!value) return <span className="fv-empty">—</span>;
  const masked = `${value.slice(0, 4)}${'•'.repeat(Math.max(0, value.length - 8))}${value.slice(-4)}`;
  return (
    <span className="fv-secret">
      <span className="fv-secret-dots">{show ? value : masked}</span>
      <button type="button" className="fv-secret-reveal" onClick={() => setShow(!show)} title={show ? 'Скрыть' : 'Показать'}>
        {show ? <EyeOff size={14} /> : <Eye size={14} />}
      </button>
    </span>
  );
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
  const [webhookBusy, setWebhookBusy] = useState(false);

  const provider = (form.provider || 'gemini') as keyof typeof MODEL_OPTIONS;
  const providerModels = provider === 'openrouter'
    ? (openRouterModels.length ? openRouterModels : MODEL_OPTIONS.openrouter)
    : (MODEL_OPTIONS[provider] || []);
  const isCustomModel = form.model ? !providerModels.includes(form.model) : false;
  const showCustomModelInput = forceCustomModelInput || isCustomModel;
  const selectedBot = useMemo(() => bots.find((b) => b.id === selectedId) || null, [bots, selectedId]);

  const loadBots = async () => {
    try {
      setLoading(true);
      const data = await api.getAiBots();
      setBots(data);
      const isMobile = typeof window !== 'undefined' && window.innerWidth < 860;
      if (data.length) {
        if (!isMobile && (selectedId == null || !data.some((i) => i.id === selectedId))) {
          setSelectedId(data[0].id);
        }
      } else {
        setSelectedId(null);
        setEditingId(null);
      }
    } catch (e: any) { addToast(e.message || 'Ошибка загрузки', 'error'); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadBots(); }, []);

  useEffect(() => {
    if (provider !== 'openrouter' || openRouterModelsLoaded) return;
    (async () => {
      try { const m = await api.getAiProviderModels('openrouter'); if (m.length) setOpenRouterModels(m); }
      catch {} finally { setOpenRouterModelsLoaded(true); }
    })();
  }, [provider, openRouterModelsLoaded]);

  useEffect(() => {
    const cp = searchParams.get('create');
    const sp = searchParams.get('select');
    if (cp === 'true') {
      setSelectedId(null); setEditingId(-1); setForm(DEFAULT_FORM);
      setSearchParams((p) => { const n = new URLSearchParams(p); n.delete('create'); n.delete('select'); return n; }, { replace: true });
      return;
    }
    if (sp) {
      const id = Number(sp);
      if (Number.isInteger(id) && id > 0) { setSelectedId(id); setEditingId(null); }
      setSearchParams((p) => { const n = new URLSearchParams(p); n.delete('create'); n.delete('select'); return n; }, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const handleStartCreate = () => { setSelectedId(null); setEditingId(-1); setForm(DEFAULT_FORM); setForceCustomModelInput(false); setShowApiKey(false); setShowToken(false); };

  const handleEdit = (bot: AiBot) => {
    const p = bot.provider || 'gemini';
    setSelectedId(bot.id); setEditingId(bot.id); setForceCustomModelInput(false); setShowApiKey(false); setShowToken(false);
    setForm({
      name: bot.name || '', enabled: bot.enabled ?? true, provider: p,
      telegramBotToken: bot.telegramBotToken || '', apiKey: bot.apiKey || bot.geminiApiKey || '',
      model: bot.model || bot.geminiModel || PROVIDER_MODELS[p], apiBase: bot.apiBase || '',
      systemPrompt: bot.systemPrompt || '', allowVoice: bot.allowVoice ?? true,
      webhookSet: bot.webhookSet ?? false, webhookUrl: bot.webhookUrl || '',
      created_at: bot.created_at, updated_at: bot.updated_at, authorId: bot.authorId,
      geminiApiKey: bot.geminiApiKey, geminiModel: bot.geminiModel,
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { addToast('Введите название', 'error'); return; }
    if (!form.telegramBotToken.trim()) { addToast('Введите Telegram Bot Token', 'error'); return; }
    if (!form.apiKey.trim()) { addToast('Введите API Key', 'error'); return; }
    if (form.provider === 'custom' && !(form.apiBase || '').trim()) { addToast('Введите URL API', 'error'); return; }
    if (!form.model.trim()) { addToast('Введите модель', 'error'); return; }

    const payload = {
      name: form.name.trim(), enabled: !!form.enabled,
      provider: (form.provider || 'gemini') as AiBot['provider'],
      telegramBotToken: form.telegramBotToken.trim(), apiKey: form.apiKey.trim(),
      model: form.model.trim(), apiBase: form.apiBase?.trim() || '',
      systemPrompt: (form.systemPrompt || '').trim(), allowVoice: !!form.allowVoice,
    };

    try {
      setSaving(true);
      if (editingId && editingId !== -1) {
        const u = await api.updateAiBot(editingId, payload);
        setBots((p) => p.map((i) => i.id === u.id ? u : i)); setSelectedId(u.id); setEditingId(null);
        addToast('AI бот обновлен', 'success');
      } else {
        const c = await api.createAiBot(payload);
        setBots((p) => [c, ...p]); setSelectedId(c.id); setEditingId(null);
        addToast('AI бот создан', 'success');
      }
    } catch (err: any) { addToast(err.message || 'Ошибка сохранения', 'error'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (bot: AiBot) => {
    if (!confirm(`Удалить "${bot.name}"?`)) return;
    try { await api.deleteAiBot(bot.id); setBots((p) => p.filter((i) => i.id !== bot.id)); if (selectedId === bot.id) { setSelectedId(null); setEditingId(null); } addToast('Удален', 'success'); }
    catch (e: any) { addToast(e.message || 'Ошибка', 'error'); }
  };

  const handleSetWebhook = async () => {
    if (!selectedBot) return;
    try {
      setWebhookBusy(true);
      const r = await api.setAiBotWebhook(selectedBot.id);
      setBots((p) => p.map((i) => i.id === selectedBot.id ? { ...i, webhookSet: true, webhookUrl: r.webhookUrl } : i));
      addToast('Webhook установлен', 'success');
    } catch (e: any) { addToast(e.message || 'Ошибка webhook', 'error'); }
    finally { setWebhookBusy(false); }
  };

  const handleDeleteWebhook = async () => {
    if (!selectedBot || !confirm('Удалить webhook?')) return;
    try {
      setWebhookBusy(true);
      await api.deleteAiBotWebhook(selectedBot.id);
      setBots((p) => p.map((i) => i.id === selectedBot.id ? { ...i, webhookSet: false, webhookUrl: '' } : i));
      addToast('Webhook удален', 'success');
    } catch (e: any) { addToast(e.message || 'Ошибка', 'error'); }
    finally { setWebhookBusy(false); }
  };

  const webhookUrl = selectedBot
    ? (typeof window !== 'undefined' ? `${window.location.origin}/api/telegram/ai/${selectedBot.id}/webhook` : '')
    : '';

  const hasSelection = selectedId !== null || editingId !== null;
  return (
    <div className={`fp ${hasSelection ? 'fp-has-selection' : ''}`}>
      {/* ── Sidebar ── */}
      <aside className="fp-sidebar">
        <div className="fp-sidebar-head">
          <span className="fp-sidebar-title">AI Боты</span>
          <div className="fp-sidebar-actions">
            {canEdit && <button className="fp-icon-btn" onClick={handleStartCreate} title="Добавить"><Plus size={13} /></button>}
            <button className="fp-icon-btn" onClick={loadBots} title="Обновить"><RefreshCw size={13} /></button>
          </div>
        </div>
        <div className="fp-bot-list">
          {loading ? (
            <div className="fp-loading"><div className="fp-spinner" /></div>
          ) : bots.length === 0 ? (
            <div className="fp-empty">AI ботов нет</div>
          ) : bots.map((bot) => (
            <div key={bot.id} className={`fp-bot-item ${selectedId === bot.id ? 'active' : ''}`}
              onClick={() => { setSelectedId(bot.id); setEditingId(null); }}>
              <div className="fp-bot-avatar">{getInitial(bot.name)}</div>
              <div className="fp-bot-info">
                <div className="fp-bot-name">{bot.name}</div>
                <div className="fp-bot-model">{bot.provider || 'gemini'} / {bot.model || bot.geminiModel || '—'}</div>
              </div>
              <div className={`fp-dot ${bot.enabled ? 'on' : ''}`} />
            </div>
          ))}
        </div>
      </aside>

      {/* ── Panel ── */}
      <div className="fp-panel">
        {editingId !== null ? (
          /* ═══ EDIT MODE ═══ */
          <>
            <div className="fp-panel-head">
              <button 
                type="button" 
                className="fp-back" 
                onClick={() => {
                  if (editingId === -1) {
                    setSelectedId(null);
                    setEditingId(null);
                  } else {
                    setEditingId(null);
                  }
                }}
              >
                <ChevronLeft size={14} />
              </button>
              <div className="fp-panel-meta">
                <div className="fp-panel-name">{editingId === -1 ? 'Создание AI бота' : 'Редактирование'}</div>
                {editingId !== -1 && selectedBot && <div className="fp-panel-sub">{selectedBot.name} · {selectedBot.provider}/{selectedBot.model}</div>}
              </div>
            </div>

            <form onSubmit={handleSave} className="fp-form-body">
              <div className="fp-section">
                <div className="fp-section-title">Общее</div>
                <div className="fp-fields-grid">
                  <div className="fp-field">
                    <label className="fp-label">Название <span className="fp-required">*</span></label>
                    <input className="fp-input" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="Название бота" />
                  </div>
                  <div className="fp-field">
                    <label className="fp-label">Провайдер</label>
                    <select className="fp-select" value={form.provider || 'gemini'} onChange={(e) => {
                      setForceCustomModelInput(false);
                      setForm((p) => { const n = (e.target.value as typeof p.provider) || 'gemini'; return { ...p, provider: n, model: PROVIDER_MODELS[n], apiBase: n === 'custom' ? p.apiBase : '' }; });
                    }}>
                      <option value="gemini">Gemini</option><option value="groq">Groq</option><option value="openai">OpenAI</option><option value="openrouter">OpenRouter</option><option value="custom">Свой (OpenAI)</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="fp-section">
                <div className="fp-section-title">Подключение</div>
                <div className="fp-fields-grid">
                  {form.provider === 'custom' && (
                    <div className="fp-field span2">
                      <label className="fp-label">URL API (Base URL)</label>
                      <input className="fp-input mono" value={form.apiBase || ''} onChange={(e) => setForm((p) => ({ ...p, apiBase: e.target.value }))} placeholder="https://example.com/v1" />
                      <span className="fp-hint">Базовый адрес OpenAI-совместимого API</span>
                    </div>
                  )}
                  <div className="fp-field">
                    <label className="fp-label">Telegram Bot Token</label>
                    <div className="fp-input-wrap">
                      <input className="fp-input mono" type={showToken ? 'text' : 'password'} value={form.telegramBotToken} onChange={(e) => setForm((p) => ({ ...p, telegramBotToken: e.target.value }))} placeholder="123456789:ABCdef..." />
                      <button type="button" className="fp-eye" onClick={() => setShowToken(!showToken)}>{showToken ? <EyeOff size={14} /> : <Eye size={14} />}</button>
                    </div>
                    <span className="fp-hint">Получить у <a href="https://t.me/BotFather" target="_blank" rel="noopener" className="fp-link">@BotFather</a></span>
                  </div>
                  <div className="fp-field">
                    <label className="fp-label">API Key <span className="fp-required">*</span></label>
                    <div className="fp-input-wrap">
                      <input className="fp-input mono" type={showApiKey ? 'text' : 'password'} value={form.apiKey} onChange={(e) => setForm((p) => ({ ...p, apiKey: e.target.value }))}
                        placeholder={form.provider === 'groq' ? 'gsk_...' : form.provider === 'openai' ? 'sk-...' : form.provider === 'openrouter' ? 'sk-or-v1-...' : 'sk-...'} />
                      <button type="button" className="fp-eye" onClick={() => setShowApiKey(!showApiKey)}>{showApiKey ? <EyeOff size={14} /> : <Eye size={14} />}</button>
                    </div>
                  </div>
                  {form.provider === 'custom' ? (
                    <div className="fp-field">
                      <label className="fp-label">Название модели</label>
                      <input className="fp-input mono" value={form.model} onChange={(e) => setForm((p) => ({ ...p, model: e.target.value }))} placeholder="qwen3-72b, llama-3.1-405b..." />
                    </div>
                  ) : (
                    <div className="fp-field">
                      <label className="fp-label">Модель</label>
                      <select className="fp-select" value={showCustomModelInput ? '__custom__' : form.model} onChange={(e) => {
                        const v = e.target.value;
                        if (v === '__custom__') { setForceCustomModelInput(true); return; }
                        setForceCustomModelInput(false); setForm((p) => ({ ...p, model: v }));
                      }}>
                        {providerModels.map((m) => <option key={m} value={m}>{m}</option>)}
                        <option value="__custom__">Своя модель...</option>
                      </select>
                      {showCustomModelInput && <input className="fp-input mono fp-mt-2" value={form.model} onChange={(e) => { const v = e.target.value; setForm((p) => ({ ...p, model: v })); if (providerModels.includes(v)) setForceCustomModelInput(false); }} placeholder="Имя модели" />}
                    </div>
                  )}
                </div>
              </div>

              <div className="fp-section">
                <div className="fp-section-title">Поведение</div>
                <div className="fp-fields-grid">
                  <div className="fp-field span2">
                    <label className="fp-label" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span>System Prompt</span>
                      <AiFieldAssist fieldName="System Prompt" fieldDescription="Опиши поведение AI-бота на русском. Например: Ты консультант техподдержки, отвечай вежливо и по делу. Используй данные из диалога." currentValue={form.systemPrompt || ''} onApply={(v) => setForm((p) => ({ ...p, systemPrompt: v }))} />
                    </label>
                    <textarea className="fp-textarea" rows={4} value={form.systemPrompt || ''} onChange={(e) => setForm((p) => ({ ...p, systemPrompt: e.target.value }))} placeholder="Инструкции для бота..." />
                    <span className="fp-hint">Контекст перед каждым диалогом</span>
                  </div>
                </div>
              </div>

              <div className="fp-section">
                <div className="fp-section-title">Состояние</div>
                <div className="fp-toggle-row">
                  <div className="fp-toggle-info"><div className="fp-toggle-name">Бот активен</div><div className="fp-toggle-desc">Принимает входящие сообщения</div></div>
                  <label className="fp-toggle"><input type="checkbox" checked={!!form.enabled} onChange={(e) => setForm((p) => ({ ...p, enabled: e.target.checked }))} /><div className="fp-toggle-track"><div className="fp-toggle-thumb" /></div></label>
                </div>
                <div className="fp-toggle-row">
                  <div className="fp-toggle-info"><div className="fp-toggle-name">Голосовые сообщения</div><div className="fp-toggle-desc">Распознавание голосовых вложений</div></div>
                  <label className="fp-toggle"><input type="checkbox" checked={!!form.allowVoice} onChange={(e) => setForm((p) => ({ ...p, allowVoice: e.target.checked }))} /><div className="fp-toggle-track"><div className="fp-toggle-thumb" /></div></label>
                </div>
              </div>
            </form>

            <div className="fp-footer">
              {editingId !== -1 && canEdit && <button type="button" className="fp-btn fp-btn-danger" onClick={() => selectedBot && handleDelete(selectedBot)}><Trash2 size={14} /> Удалить</button>}
              <button type="button" className="fp-btn fp-btn-ghost" onClick={() => setEditingId(null)}>Отмена</button>
              <button type="button" className="fp-btn fp-btn-primary" disabled={saving} onClick={() => document.querySelector<HTMLFormElement>('.fp-form-body')?.requestSubmit()}>
                <Save size={14} /> {saving ? 'Сохранение...' : 'Сохранить'}
              </button>
            </div>
          </>
        ) : selectedBot ? (
          /* ═══ VIEW MODE ═══ */
          <>
            <div className="fp-panel-head">
              <button className="fp-back fp-back-mobile" style={{ marginRight: '8px' }} onClick={() => setSelectedId(null)}><ChevronLeft size={14} /></button>
              <div className="fp-panel-avatar">{getInitial(selectedBot.name)}</div>
              <div className="fp-panel-meta">
                <div className="fp-panel-name">{selectedBot.name}</div>
                <div className="fp-panel-sub">{selectedBot.provider || 'gemini'} / {selectedBot.model || selectedBot.geminiModel || '—'}</div>
              </div>
              <div className="fp-panel-actions">
                {selectedBot.webhookSet ? (
                  <button className="fp-btn fp-btn-ghost" onClick={handleDeleteWebhook} disabled={webhookBusy} title="Удалить webhook"><Unplug size={14} /></button>
                ) : (
                  <button className="fp-btn fp-btn-ghost" onClick={handleSetWebhook} disabled={webhookBusy} title="Установить webhook"><Plug size={14} /></button>
                )}
                {canEdit && <button className="fp-btn fp-btn-primary" onClick={() => handleEdit(selectedBot)}><Pencil size={14} /> <span className="fp-btn-text">Редактировать</span></button>}
              </div>
            </div>

            <div className="fp-form-body">
              <div className="fp-section">
                <div className="fp-section-title">Общее</div>
                <div className="fp-fields-grid">
                  <div className="fp-field"><div className="fp-label">Название</div><div className="fp-fv">{selectedBot.name}</div></div>
                  <div className="fp-field"><div className="fp-label">Провайдер</div><div className="fp-fv">{selectedBot.provider || 'gemini'}</div></div>
                  <div className="fp-field"><div className="fp-label">Модель</div><div className="fp-fv mono">{selectedBot.model || selectedBot.geminiModel || '—'}</div></div>
                </div>
              </div>

              <div className="fp-section">
                <div className="fp-section-title">Подключение</div>
                <div className="fp-fields-grid">
                  {(selectedBot.provider === 'custom' && selectedBot.apiBase) && (
                    <div className="fp-field span2"><div className="fp-label">API Base URL</div><div className="fp-fv mono">{selectedBot.apiBase}</div></div>
                  )}
                  <div className="fp-field"><div className="fp-label">Telegram Token</div><div className="fp-fv secret"><SecretValue value={selectedBot.telegramBotToken} /></div></div>
                  <div className="fp-field"><div className="fp-label">API Key</div><div className="fp-fv secret"><SecretValue value={selectedBot.apiKey || selectedBot.geminiApiKey || ''} /></div></div>
                </div>
              </div>

              <div className="fp-section">
                <div className="fp-section-title">Поведение</div>
                <div className="fp-fields-grid">
                  <div className="fp-field span2"><div className="fp-label">System Prompt</div><div className="fp-fv multiline">{selectedBot.systemPrompt || '—'}</div></div>
                </div>
              </div>

              <div className="fp-section">
                <div className="fp-section-title">Состояние</div>
                <div className="fp-status-row">
                  <div className="fp-status-item"><div className="fp-label">Бот</div><span className={`fp-badge ${selectedBot.enabled ? 'on' : 'off'}`}><span className="fp-badge-dot" />{selectedBot.enabled ? 'Активен' : 'Выключен'}</span></div>
                  <div className="fp-status-item"><div className="fp-label">Webhook</div><span className={`fp-badge ${selectedBot.webhookSet ? 'on' : 'off'}`}><span className="fp-badge-dot" />{selectedBot.webhookSet ? 'Установлен' : 'Не установлен'}</span></div>
                  {selectedBot.webhookSet && (
                    <div className="fp-status-item span2"><div className="fp-label">URL Webhook</div><div className="fp-fv mono small">{webhookUrl}</div></div>
                  )}
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="fp-placeholder"><Bot size={40} strokeWidth={1.5} /><p>Выберите AI бота или создайте нового</p></div>
        )}
      </div>
    </div>
  );
}
