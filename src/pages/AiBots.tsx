import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Bot, KeyRound, Pencil, RefreshCw, Save, Trash2, Unplug, Webhook } from 'lucide-react';
import { api, AiBot } from '../lib/api';
import { useAuth } from '../lib/auth-context';
import { useToast } from '../components/ToastNotification';
import { ToolbarToggle } from '../components/ToolbarToggle';
import { EntityStateSwitch } from '../components/StateToggle';

type AiBotForm = Omit<AiBot, 'id'>;

const PROVIDER_MODELS: Record<'gemini' | 'groq', string> = {
  gemini: 'gemini-2.0-flash',
  groq: 'llama-3.3-70b-versatile',
};

const DEFAULT_FORM: AiBotForm = {
  name: '',
  enabled: true,
  provider: 'gemini',
  telegramBotToken: '',
  apiKey: '',
  model: PROVIDER_MODELS.gemini,
  systemPrompt: '',
  allowVoice: true,
  webhookUrl: '',
  webhookSet: false,
};

function maskSecret(secret?: string) {
  const value = String(secret || '').trim();
  if (!value) return '—';
  if (value.length <= 8) return '********';
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
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
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [webhookBusy, setWebhookBusy] = useState(false);
  const [form, setForm] = useState<AiBotForm>(DEFAULT_FORM);

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

  useEffect(() => {
    loadBots();
  }, []);

  useEffect(() => {
    const createParam = searchParams.get('create');
    const selectParam = searchParams.get('select');
    if (createParam === 'true') {
      setSelectedId(null);
      setEditingId(-1);
      setForm(DEFAULT_FORM);
      setSearchParams({}, { replace: true });
      return;
    }

    if (selectParam) {
      const parsedId = Number(selectParam);
      if (Number.isInteger(parsedId) && parsedId > 0) {
        setSelectedId(parsedId);
        setEditingId(null);
      }
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const handleStartCreate = () => {
    setSelectedId(null);
    setEditingId(-1);
    setForm(DEFAULT_FORM);
  };

  const handleEdit = (bot: AiBot) => {
    const provider = bot.provider || 'gemini';
    setSelectedId(bot.id);
    setEditingId(bot.id);
    setForm({
      name: bot.name || '',
      enabled: bot.enabled ?? true,
      provider,
      telegramBotToken: bot.telegramBotToken || '',
      apiKey: bot.apiKey || bot.geminiApiKey || '',
      model: bot.model || bot.geminiModel || PROVIDER_MODELS[provider],
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

    if (!form.name.trim()) {
      addToast('Введите название', 'error');
      return;
    }
    if (!form.telegramBotToken.trim()) {
      addToast('Введите Telegram Bot Token', 'error');
      return;
    }
    if (!form.apiKey.trim()) {
      addToast('Введите API Key провайдера', 'error');
      return;
    }
    if (!form.model.trim()) {
      addToast('Введите модель', 'error');
      return;
    }

    const payload = {
      name: form.name.trim(),
      enabled: !!form.enabled,
      provider: (form.provider || 'gemini') as 'gemini' | 'groq',
      telegramBotToken: form.telegramBotToken.trim(),
      apiKey: form.apiKey.trim(),
      model: form.model.trim(),
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
      if (selectedId === bot.id) {
        setSelectedId(null);
        setEditingId(null);
      }
      addToast('AI бот удален', 'success');
    } catch (error: any) {
      addToast(error.message || 'Не удалось удалить AI бота', 'error');
    }
  };

  const handleToggleEnabled = async (bot: AiBot) => {
    const nextEnabled = !bot.enabled;
    try {
      setTogglingId(bot.id);
      const updated = await api.updateAiBot(bot.id, { enabled: nextEnabled });
      setBots((prev) => prev.map((item) => (item.id === bot.id ? updated : item)));
      addToast(nextEnabled ? 'AI бот включен' : 'AI бот выключен', 'success');
    } catch (error: any) {
      addToast(error.message || 'Не удалось изменить статус AI бота', 'error');
    } finally {
      setTogglingId(null);
    }
  };

  const handleSetWebhook = async (bot: AiBot) => {
    try {
      setWebhookBusy(true);
      const response = await api.setAiBotWebhook(bot.id);
      setBots((prev) =>
        prev.map((item) => (item.id === bot.id ? { ...item, webhookSet: true, webhookUrl: response.webhookUrl } : item))
      );
      addToast('Webhook установлен', 'success');
    } catch (error: any) {
      addToast(error.message || 'Не удалось установить webhook', 'error');
    } finally {
      setWebhookBusy(false);
    }
  };

  const handleDeleteWebhook = async (bot: AiBot) => {
    if (!confirm('Удалить webhook для AI бота?')) return;
    try {
      setWebhookBusy(true);
      await api.deleteAiBotWebhook(bot.id);
      setBots((prev) =>
        prev.map((item) => (item.id === bot.id ? { ...item, webhookSet: false, webhookUrl: '' } : item))
      );
      addToast('Webhook удален', 'success');
    } catch (error: any) {
      addToast(error.message || 'Не удалось удалить webhook', 'error');
    } finally {
      setWebhookBusy(false);
    }
  };

  return (
    <div className="card">
      <div className="card-header">
        <div className="flex flex-col gap-2">
          <h2 className="text-xl font-semibold">AI Бот</h2>
        </div>
        <div className="flex items-center gap-2">
          {canEdit && selectedBot && editingId === null && (
            <>
              <button onClick={() => handleEdit(selectedBot)} className="icon-button" title="Редактировать">
                <Pencil className="h-4 w-4" />
              </button>
              <button
                onClick={() => handleDelete(selectedBot)}
                className="icon-button text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive)_/_0.1)]"
                title="Удалить"
              >
                <Trash2 className="h-4 w-4" />
              </button>
              <ToolbarToggle
                enabled={selectedBot.enabled}
                disabled={togglingId === selectedBot.id}
                onChange={() => handleToggleEnabled(selectedBot)}
                title={selectedBot.enabled ? 'Выключить AI бота' : 'Включить AI бота'}
              />
              {!selectedBot.webhookSet ? (
                <button
                  onClick={() => handleSetWebhook(selectedBot)}
                  className="icon-button"
                  title="Установить webhook"
                  disabled={webhookBusy}
                >
                  <Webhook className="h-4 w-4" />
                </button>
              ) : (
                <button
                  onClick={() => handleDeleteWebhook(selectedBot)}
                  className="icon-button"
                  title="Удалить webhook"
                  disabled={webhookBusy}
                >
                  <Unplug className="h-4 w-4" />
                </button>
              )}
              <div className="mx-1 h-6 w-px bg-[hsl(var(--border))]" />
            </>
          )}
          {canEdit && (
            <button onClick={handleStartCreate} className="icon-button" title="Создать AI бота">
              <Bot className="h-4 w-4" />
            </button>
          )}
          <button onClick={loadBots} className="icon-button" title="Обновить список">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="split-layout p-6">
        <div className="split-left">
          <div className="panel">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold">Список AI ботов</h3>
              <button onClick={loadBots} className="rounded border border-[hsl(var(--border))] px-2 py-1 text-xs">
                Обновить
              </button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-10">
                <div className="h-6 w-6 animate-spin rounded-full border-4 border-[hsl(var(--primary))] border-t-transparent" />
              </div>
            ) : bots.length === 0 ? (
              <p className="py-10 text-center text-sm text-[hsl(var(--muted-foreground))]">AI ботов нет</p>
            ) : (
              <div className="entity-list-scroll scrollbar-thin">
                <table className="table-basic w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-[hsl(var(--border))] text-left text-xs">
                      <th className="px-2 py-2">Название</th>
                      <th className="px-2 py-2">Провайдер / модель</th>
                      <th className="px-2 py-2">Webhook</th>
                      <th className="px-2 py-2">Статус</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bots.map((bot) => (
                      <tr
                        key={bot.id}
                        onClick={() => {
                          setSelectedId(bot.id);
                          setEditingId(null);
                        }}
                        className={`cursor-pointer border-b border-[hsl(var(--border))] transition-colors hover:bg-[hsl(var(--accent))] ${
                          selectedId === bot.id ? 'bg-[hsl(var(--accent))]' : ''
                        }`}
                      >
                        <td className="max-w-[220px] truncate px-2 py-2 font-medium">{bot.name}</td>
                        <td className="px-2 py-2 text-xs">{(bot.provider || 'gemini') + ' / ' + (bot.model || bot.geminiModel || '—')}</td>
                        <td className="px-2 py-2 text-xs">{bot.webhookSet ? '✅' : '—'}</td>
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
          <div className={`panel ${editingId !== null ? 'entity-edit-panel' : ''}`}>
            {editingId !== null ? (
              <form onSubmit={handleSave} className="flex flex-col gap-5">
                <h3 className="text-lg font-semibold">{editingId === -1 ? 'Создание AI бота' : 'Редактирование AI бота'}</h3>

                <div>
                  <label className="mb-2 block text-sm font-medium">Название</label>
                  <input
                    value={form.name}
                    onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                    className="w-full rounded border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2"
                    placeholder="AI Ассистент"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">Провайдер</label>
                  <select
                    value={form.provider || 'gemini'}
                    onChange={(event) =>
                      setForm((prev) => {
                        const nextProvider = (event.target.value as 'gemini' | 'groq') || 'gemini';
                        const keepModel = String(prev.model || '').trim();
                        return {
                          ...prev,
                          provider: nextProvider,
                          model: keepModel || PROVIDER_MODELS[nextProvider],
                        };
                      })
                    }
                    className="w-full rounded border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2"
                  >
                    <option value="gemini">Gemini</option>
                    <option value="groq">Groq</option>
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">Telegram Bot Token</label>
                  <input
                    value={form.telegramBotToken}
                    onChange={(event) => setForm((prev) => ({ ...prev, telegramBotToken: event.target.value }))}
                    className="w-full rounded border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 font-mono"
                    placeholder="123456789:ABCdef..."
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">API Key ({form.provider === 'groq' ? 'Groq' : 'Gemini'})</label>
                  <input
                    value={form.apiKey}
                    onChange={(event) => setForm((prev) => ({ ...prev, apiKey: event.target.value }))}
                    className="w-full rounded border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 font-mono"
                    placeholder={form.provider === 'groq' ? 'gsk_...' : 'AIza...'}
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">Модель</label>
                  <input
                    value={form.model}
                    onChange={(event) => setForm((prev) => ({ ...prev, model: event.target.value }))}
                    className="w-full rounded border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2"
                    placeholder={form.provider === 'groq' ? PROVIDER_MODELS.groq : PROVIDER_MODELS.gemini}
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">System Prompt (опционально)</label>
                  <textarea
                    rows={4}
                    value={form.systemPrompt || ''}
                    onChange={(event) => setForm((prev) => ({ ...prev, systemPrompt: event.target.value }))}
                    className="w-full rounded border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2"
                    placeholder="Короткая системная инструкция..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <EntityStateSwitch
                    idPrefix="ai-bot-enabled"
                    enabled={!!form.enabled}
                    onChange={(next) => setForm((prev) => ({ ...prev, enabled: next }))}
                  />
                  <EntityStateSwitch
                    idPrefix="ai-bot-voice"
                    enabled={!!form.allowVoice}
                    onChange={(next) => setForm((prev) => ({ ...prev, allowVoice: next }))}
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 rounded bg-[hsl(var(--primary))] px-4 py-2 font-semibold text-[hsl(var(--primary-foreground))] disabled:opacity-60"
                  >
                    <span className="inline-flex items-center gap-2">
                      <Save className="h-4 w-4" />
                      {saving ? 'Сохранение...' : 'Сохранить'}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                    className="flex-1 rounded bg-[hsl(var(--secondary))] px-4 py-2 font-semibold text-[hsl(var(--secondary-foreground))]"
                  >
                    Отмена
                  </button>
                </div>
              </form>
            ) : selectedBot ? (
              <div className="entity-view">
                <h4 className="entity-view-title">Информация</h4>
                <div className="entity-view-card space-y-3">
                  <div>
                    <strong>ID:</strong> <code className="rounded bg-[hsl(var(--muted)_/_0.5)] px-2 py-1">{selectedBot.id}</code>
                  </div>
                  <div>
                    <strong>Название:</strong> {selectedBot.name}
                  </div>
                  <div>
                    <strong>Провайдер:</strong> <code>{selectedBot.provider || 'gemini'}</code>
                  </div>
                  <div>
                    <strong>Статус:</strong>{' '}
                    <span
                      className={`rounded px-2 py-1 text-xs ${
                        selectedBot.enabled
                          ? 'bg-[hsl(var(--success)_/_0.15)] text-[hsl(var(--success))]'
                          : 'bg-[hsl(var(--destructive)_/_0.1)] text-[hsl(var(--destructive))]'
                      }`}
                    >
                      {selectedBot.enabled ? '✅ Включен' : '⏸️ Выключен'}
                    </span>
                  </div>
                  <div>
                    <strong>Голос:</strong> {selectedBot.allowVoice ? 'Включен' : 'Выключен'}
                  </div>
                </div>

                <h4 className="entity-view-title">Ключи и модель</h4>
                <div className="entity-view-card space-y-3">
                  <div className="flex items-center gap-2">
                    <KeyRound className="h-4 w-4" />
                    <strong>Telegram Token:</strong> <code>{maskSecret(selectedBot.telegramBotToken)}</code>
                  </div>
                  <div className="flex items-center gap-2">
                    <KeyRound className="h-4 w-4" />
                    <strong>Provider API Key:</strong> <code>{maskSecret(selectedBot.apiKey || selectedBot.geminiApiKey)}</code>
                  </div>
                  <div>
                    <strong>Модель:</strong> <code>{selectedBot.model || selectedBot.geminiModel}</code>
                  </div>
                </div>

                <h4 className="entity-view-title">Webhook</h4>
                <div className="entity-view-card space-y-3">
                  <div>
                    <strong>Состояние:</strong> {selectedBot.webhookSet ? '✅ Установлен' : '— Не установлен'}
                  </div>
                  <div className="break-all text-xs text-[hsl(var(--muted-foreground))]">
                    {selectedBot.webhookUrl || `Будет установлен как ${window.location.origin}/api/telegram/ai/${selectedBot.id}/webhook`}
                  </div>
                </div>

                <h4 className="entity-view-title">System Prompt</h4>
                <div className="entity-view-card whitespace-pre-wrap break-words">{selectedBot.systemPrompt || '—'}</div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center rounded-lg border border-[hsl(var(--border)_/_0.6)] bg-[hsl(var(--card))] p-10 text-center text-[hsl(var(--muted-foreground))]">
                Выберите AI бота слева или создайте нового.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
