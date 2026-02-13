import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { api, Poll } from '../lib/api';
import { useAuth } from '../lib/auth-context';
import { Copy, Download, Pencil, Play, Plus, RefreshCw, Trash2, Upload } from 'lucide-react';
import { TemplateHelp } from '../components/TemplateHelp';
import { ExportModal } from '../components/ExportModal';
import { Breadcrumb } from '../components/Breadcrumb';
import { PollWizard } from '../components/PollWizard';

const DEFAULT_FORM = {
  name: '',
  url: '',
  method: 'GET',
  headersJson: '',
  bodyJson: '',
  conditionJson: '',
  intervalSec: 60,
  timeoutSec: 10,
  chatId: '',
  botToken: '',
  messageTemplate: '',
  enabled: true,
  onlyOnChange: false,
  continueAfterMatch: false,
};

const normalizeForm = (poll?: Poll) => ({
  name: poll?.name || '',
  url: poll?.url || '',
  method: poll?.method || 'GET',
  headersJson: poll?.headersJson || '',
  bodyJson: poll?.bodyJson || '',
  conditionJson: poll?.conditionJson || '',
  intervalSec: poll?.intervalSec ?? 60,
  timeoutSec: poll?.timeoutSec ?? 10,
  chatId: poll?.chatId || '',
  botToken: poll?.botToken || '',
  messageTemplate: poll?.messageTemplate || '',
  enabled: poll?.enabled ?? true,
  onlyOnChange: poll?.onlyOnChange ?? false,
  continueAfterMatch: poll?.continueAfterMatch ?? false,
});

export function Polling() {
  const { user } = useAuth();
  const canEdit = user?.role !== 'auditor';
  const [searchParams, setSearchParams] = useSearchParams();
  const [polls, setPolls] = useState<Poll[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPollId, setSelectedPollId] = useState<number | null>(null);
  const [editingPollId, setEditingPollId] = useState<number | null>(null);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);

  // Автоматически скрывать уведомление через 4 секунды
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  const selectedPoll = useMemo(
    () => polls.find((poll) => poll.id === selectedPollId) || null,
    [polls, selectedPollId]
  );

  const loadPolls = async () => {
    try {
      setLoading(true);
      const data = await api.getPolls();
      setPolls(data);
    } catch (error: any) {
      setMessage({ text: error.message || 'Не удалось загрузить пуллинг', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPolls();
  }, []);

  // Проверяем параметры create и select в URL
  useEffect(() => {
    const createParam = searchParams.get('create');
    const selectParam = searchParams.get('select');
    
    if (createParam === 'true') {
      setSelectedPollId(null);
      setEditingPollId(-1);
      setForm(DEFAULT_FORM);
      setSearchParams({}, { replace: true });
    } else if (selectParam) {
      const id = parseInt(selectParam, 10);
      if (!isNaN(id)) {
        setSelectedPollId(id);
        setEditingPollId(null);
      }
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const handleSelectPoll = (id: number) => {
    setSelectedPollId(id);
    setEditingPollId(null);
  };

  const handleStartCreate = () => {
    setSelectedPollId(null);
    setEditingPollId(-1);
    setForm(DEFAULT_FORM);
  };

  const handleEditPoll = (poll: Poll) => {
    setSelectedPollId(poll.id);
    setEditingPollId(poll.id);
    setForm(normalizeForm(poll));
  };

  const handleSavePoll = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage(null);

    if (!form.name || !form.url || !form.chatId) {
      setMessage({ text: 'Укажите название, URL и chatId', type: 'error' });
      return;
    }

    try {
      const payload = {
        ...form,
        intervalSec: Number(form.intervalSec) || 60,
        timeoutSec: Number(form.timeoutSec) || 10,
        headersJson: form.headersJson || undefined,
        bodyJson: form.bodyJson || undefined,
        conditionJson: form.conditionJson || undefined,
        botToken: form.botToken || undefined,
        messageTemplate: form.messageTemplate || undefined,
      };

      if (editingPollId && editingPollId !== -1) {
        const updated = await api.updatePoll(editingPollId, payload);
        setEditingPollId(null);
        setSelectedPollId(updated.id);
        setMessage({ text: 'Пуллинг обновлён', type: 'success' });
        // Перезагружаем список для синхронизации
        await loadPolls();
      } else {
        const created = await api.createPoll(payload);
        setEditingPollId(null);
        setSelectedPollId(created.id);
        setMessage({ text: 'Пуллинг создан', type: 'success' });
        // Перезагружаем список для синхронизации
        await loadPolls();
      }
    } catch (error: any) {
      setMessage({ text: error.message || 'Не удалось сохранить пуллинг', type: 'error' });
    }
  };

  const handleDuplicatePoll = async (poll: Poll) => {
    try {
      const copyPayload = {
        ...normalizeForm(poll),
        name: `${poll.name} (копия)`,
        enabled: false,
      };
      const created = await api.createPoll(copyPayload);
      setPolls((prev) => [created, ...prev]);
      setSelectedPollId(created.id);
      setMessage({ text: 'Пуллинг продублирован', type: 'success' });
    } catch (error: any) {
      setMessage({ text: error.message || 'Не удалось дублировать пуллинг', type: 'error' });
    }
  };

  const handleDeletePoll = async (poll: Poll) => {
    if (!confirm(`Удалить пуллинг "${poll.name}"?`)) return;
    try {
      await api.deletePoll(poll.id);
      setPolls((prev) => prev.filter((p) => p.id !== poll.id));
      if (selectedPollId === poll.id) {
        setSelectedPollId(null);
        setEditingPollId(null);
      }
      setMessage({ text: 'Пуллинг удалён', type: 'success' });
    } catch (error: any) {
      setMessage({ text: error.message || 'Не удалось удалить пуллинг', type: 'error' });
    }
  };

  const handleRunPoll = async (poll: Poll) => {
    try {
      await api.runPoll(poll.id);
      setMessage({ text: 'Запуск выполнен', type: 'success' });
    } catch (error: any) {
      setMessage({ text: error.message || 'Не удалось запустить пуллинг', type: 'error' });
    }
  };

  const normalizeImportedPoll = (raw: any): Partial<Poll> => {
    return {
      name: String(raw.name ?? '').trim(),
      url: String(raw.url ?? '').trim(),
      method: raw.method || 'GET',
      headersJson: raw.headersJson != null ? String(raw.headersJson) : undefined,
      bodyJson: raw.bodyJson != null ? String(raw.bodyJson) : undefined,
      conditionJson: raw.conditionJson != null ? String(raw.conditionJson) : undefined,
      intervalSec: Number(raw.intervalSec) || 60,
      timeoutSec: Number(raw.timeoutSec) ?? 10,
      chatId: String(raw.chatId ?? '').trim(),
      botToken: raw.botToken ? String(raw.botToken).trim() : undefined,
      messageTemplate: raw.messageTemplate ? String(raw.messageTemplate) : undefined,
      enabled: raw.enabled ?? true,
      onlyOnChange: raw.onlyOnChange ?? false,
      continueAfterMatch: raw.continueAfterMatch ?? false,
    };
  };

  const handleImportPolls = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const items = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.polls) ? parsed.polls : [];
      if (!items.length) throw new Error('Файл не содержит пуллингов');

      let created = 0;
      let failed = 0;
      let lastError = '';
      for (const item of items) {
        const payload = normalizeImportedPoll(item);
        if (!payload.name || !payload.url || !payload.chatId) {
          failed += 1;
          if (!lastError) lastError = 'Не заполнены название, URL или chatId';
          continue;
        }
        try {
          const createdPoll = await api.createPoll(payload);
          created += 1;
          setPolls((prev) => [...prev, createdPoll]);
        } catch (err: any) {
          failed += 1;
          if (!lastError) lastError = err?.message || 'Ошибка создания';
        }
      }

      const messageText =
        failed === 0
          ? `Импортировано пуллингов: ${created}`
          : lastError
            ? `Импортировано: ${created}, пропущено: ${failed}. Причина: ${lastError}`
            : `Импортировано: ${created}, пропущено: ${failed}`;
      setMessage({ text: messageText, type: failed === 0 ? 'success' : 'info' });
    } catch (error: any) {
      setMessage({ text: error.message || 'Ошибка импорта пуллингов', type: 'error' });
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
            <h2 className="text-xl font-semibold">🔁 Пуллинг</h2>
            <div className="mt-1">
              <Breadcrumb 
                items={[
                  { label: 'Главная', path: '/' },
                  { label: 'Пуллинг', active: true }
                ]} 
              />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canEdit && selectedPoll && !editingPollId && (
            <>
              <button
                onClick={() => handleRunPoll(selectedPoll)}
                className="icon-button text-[hsl(var(--success))] hover:bg-[hsl(var(--success)_/_0.1)]"
                title="Запустить"
              >
                <Play className="h-4 w-4" />
              </button>
              <button
                onClick={() => handleEditPoll(selectedPoll)}
                className="icon-button"
                title="Редактировать"
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                onClick={() => handleDuplicatePoll(selectedPoll)}
                className="icon-button"
                title="Дублировать"
              >
                <Copy className="h-4 w-4" />
              </button>
              <button
                onClick={() => handleDeletePoll(selectedPoll)}
                className="icon-button text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive)_/_0.1)]"
                title="Удалить"
              >
                <Trash2 className="h-4 w-4" />
              </button>
              <div className="mx-1 h-6 w-px bg-[hsl(var(--border))]" />
            </>
          )}
          <button
            onClick={() => loadPolls()}
            className="icon-button"
            title="Обновить список"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          {canEdit && (
            <>
              <input
                ref={importInputRef}
                type="file"
                accept="application/json"
                className="hidden"
                onChange={handleImportPolls}
              />
              <button
                onClick={() => importInputRef.current?.click()}
                disabled={importing}
                className="icon-button disabled:cursor-not-allowed disabled:opacity-60"
                title="Импорт пуллингов"
              >
                <Upload className="h-4 w-4" />
              </button>
              <button
                onClick={() => setExportModalOpen(true)}
                className="icon-button"
                title="Экспорт пуллингов"
              >
                <Download className="h-4 w-4" />
              </button>
              <button
                onClick={handleStartCreate}
                className="icon-button"
                title="Создать пуллинг"
              >
                <Plus className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
      </div>

      {message && (
        <div
          className={`mx-6 mt-4 animate-fade-in rounded border p-3 text-sm ${
            message.type === 'success'
              ? 'border-[hsl(var(--success)_/_0.3)] bg-[hsl(var(--success)_/_0.15)] text-[hsl(var(--success))]'
              : message.type === 'error'
              ? 'border-[hsl(var(--destructive)_/_0.2)] bg-[hsl(var(--destructive)_/_0.1)] text-[hsl(var(--destructive))]'
              : 'border-[hsl(var(--info)_/_0.3)] bg-[hsl(var(--info)_/_0.1)] text-[hsl(var(--info))]'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="split-layout p-6">
        <div className="split-left">
          <div className="panel">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold">📋 Список задач</h3>
              <button
                onClick={() => loadPolls()}
                className="rounded border border-[hsl(var(--border))] px-2 py-1 text-xs"
              >
                Обновить
              </button>
            </div>
            {loading ? (
              <div className="flex items-center justify-center py-10">
                <div className="h-6 w-6 animate-spin rounded-full border-4 border-[hsl(var(--primary))] border-t-transparent" />
              </div>
            ) : polls.length === 0 ? (
              <p className="py-10 text-center text-sm text-[hsl(var(--muted-foreground))]">Задачи не найдены</p>
            ) : (
              <div className="max-h-[calc(100vh-320px)] overflow-y-auto">
                <table className="table-basic w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-[hsl(var(--border))] text-left text-xs">
                      <th className="px-2 py-2">Название</th>
                      <th className="px-2 py-2">Интервал</th>
                      <th className="px-2 py-2">Статус</th>
                    </tr>
                  </thead>
                  <tbody>
                    {polls.map((poll) => (
                      <tr
                        key={poll.id}
                        onClick={() => handleSelectPoll(poll.id)}
                        className={`cursor-pointer border-b border-[hsl(var(--border))] transition-colors hover:bg-[hsl(var(--accent))] ${
                          selectedPollId === poll.id ? 'bg-[hsl(var(--accent))]' : ''
                        }`}
                      >
                        <td className="px-2 py-2 font-medium">{poll.name}</td>
                        <td className="px-2 py-2">{poll.intervalSec}s</td>
                        <td className="px-2 py-2">{poll.enabled ? '✅ Вкл' : '⏸️ Выкл'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="split-right">
          {editingPollId !== null ? (
            <div className="panel">
              <h3 className="mb-4 text-lg font-semibold">
                {editingPollId === -1 ? 'Создание задачи' : 'Редактирование задачи'}
              </h3>
              <PollWizard
                initialData={editingPollId === -1 ? undefined : selectedPoll}
                onComplete={async (data) => {
                  try {
                    const payload = {
                      ...data,
                      intervalSec: Number(data.intervalSec) || 60,
                      timeoutSec: Number(data.timeoutSec) || 10,
                      headersJson: data.headersJson || undefined,
                      bodyJson: data.bodyJson || undefined,
                      conditionJson: data.conditionJson || undefined,
                      botToken: data.botToken || undefined,
                      messageTemplate: data.messageTemplate || undefined,
                    };

                    if (editingPollId && editingPollId !== -1) {
                      const updated = await api.updatePoll(editingPollId, payload);
                      setEditingPollId(null);
                      setSelectedPollId(updated.id);
                      setMessage({ text: 'Пуллинг обновлён', type: 'success' });
                      // Перезагружаем список для синхронизации
                      await loadPolls();
                    } else {
                      const created = await api.createPoll(payload);
                      setEditingPollId(null);
                      setSelectedPollId(created.id);
                      setMessage({ text: 'Пуллинг создан', type: 'success' });
                      // Перезагружаем список для синхронизации
                      await loadPolls();
                    }
                  } catch (error: any) {
                    setMessage({ text: error.message || 'Не удалось сохранить пуллинг', type: 'error' });
                  }
                }}
                onCancel={() => {
                  if (selectedPollId) {
                    setEditingPollId(null);
                  } else {
                    handleStartCreate();
                  }
                }}
              />
            </div>
          ) : selectedPoll ? (
            <div>
              <div className="space-y-4">
                <div>
                  <h4 className="mb-2 text-sm font-medium text-[hsl(var(--muted-foreground))]">Информация о задаче</h4>
                  <div style={{ padding: '16px' }} className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))]">
                    <div style={{ marginBottom: '12px' }}>
                      <strong>ID:</strong> <code style={{ padding: '4px 8px', marginLeft: '8px' }} className="rounded bg-[hsl(var(--muted)_/_0.5)]">{selectedPoll.id}</code>
              </div>
                    <div style={{ marginBottom: '12px' }}>
                  <strong>Название:</strong> {selectedPoll.name}
                </div>
                    <div style={{ marginBottom: '12px' }}>
                      <strong>Статус:</strong>{' '}
                      <span
                        style={{ padding: '4px 8px' }}
                        className={`rounded text-xs ${
                          selectedPoll.enabled
                            ? 'bg-[hsl(var(--success)_/_0.15)] text-[hsl(var(--success))]'
                            : 'bg-[hsl(var(--destructive)_/_0.1)] text-[hsl(var(--destructive))]'
                        }`}
                      >
                        {selectedPoll.enabled ? '✅ Включено' : '⏸️ Отключено'}
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="mb-2 text-sm font-medium text-[hsl(var(--muted-foreground))]">Настройки опроса</h4>
                  <div style={{ padding: '16px' }} className="space-y-3 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))]">
                    <div>
                      <strong>URL:</strong>{' '}
                      <code style={{ padding: '4px 8px', marginLeft: '8px' }} className="rounded bg-[hsl(var(--muted)_/_0.5)]">{selectedPoll.url}</code>
                    </div>
                    <div>
                      <strong>Метод:</strong>{' '}
                      <code style={{ padding: '4px 8px', marginLeft: '8px' }} className="rounded bg-[hsl(var(--muted)_/_0.5)]">{selectedPoll.method}</code>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <strong>Интервал:</strong>{' '}
                        <code style={{ padding: '4px 8px', marginLeft: '8px' }} className="rounded bg-[hsl(var(--muted)_/_0.5)]">{selectedPoll.intervalSec}s</code>
                      </div>
                      <div>
                        <strong>Таймаут:</strong>{' '}
                        <code style={{ padding: '4px 8px', marginLeft: '8px' }} className="rounded bg-[hsl(var(--muted)_/_0.5)]">{selectedPoll.timeoutSec}s</code>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="mb-2 text-sm font-medium text-[hsl(var(--muted-foreground))]">Настройки отправки</h4>
                  <div style={{ padding: '16px' }} className="space-y-3 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))]">
                    <div>
                      <strong>Chat ID:</strong>{' '}
                      <code style={{ padding: '4px 8px', marginLeft: '8px' }} className="rounded bg-[hsl(var(--muted)_/_0.5)]">{selectedPoll.chatId}</code>
                    </div>
                    {selectedPoll.messageTemplate ? (
                      <div>
                        <strong>Шаблон сообщения:</strong>
                        <div style={{ padding: '16px', marginTop: '8px' }} className="whitespace-pre-wrap rounded-lg bg-[hsl(var(--muted)_/_0.3)] text-sm">
                          {selectedPoll.messageTemplate}
                </div>
                </div>
                    ) : (
                      <div className="text-[hsl(var(--muted-foreground))]">Используется шаблон по умолчанию</div>
                    )}
                </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-lg border border-[hsl(var(--border)_/_0.6)] bg-[hsl(var(--card))] p-10 text-center text-[hsl(var(--muted-foreground))]">
              <p className="mb-4">Выберите задачу слева или создайте новую</p>
              <button
                onClick={handleStartCreate}
                className="inline-flex items-center gap-2 rounded bg-[hsl(var(--primary))] px-4 py-2 font-semibold text-[hsl(var(--primary-foreground))]"
              >
                <Plus className="h-4 w-4" /> Создать задачу
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Export Modal */}
      <ExportModal
        isOpen={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        title="Экспорт пуллингов"
        description="Выберите пуллинги для экспорта"
        items={polls.map((p) => ({ id: p.id, name: p.name, enabled: p.enabled }))}
        loading={loading}
        exportFileName="polls-export.json"
        exportType="polls"
        onExportSuccess={(count) => setMessage({ text: `Экспортировано пуллингов: ${count}`, type: 'success' })}
      />
    </div>
  );
}
