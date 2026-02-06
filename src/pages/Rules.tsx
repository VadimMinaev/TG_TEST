import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { api, Rule } from '../lib/api';
import { Plus, Search, Download, Upload, Info, Copy, CheckCheck } from 'lucide-react';
import { RulesList } from '../components/RulesList';
import { RuleDetails } from '../components/RuleDetails';
import { RuleForm } from '../components/RuleForm';
import { ExportModal } from '../components/ExportModal';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../components/ui/tooltip';

export function Rules() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRuleId, setSelectedRuleId] = useState<number | null>(null);
  const [editingRuleId, setEditingRuleId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [importing, setImporting] = useState(false);

  // Автоматически скрывать уведомление через 4 секунды
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [message]);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [webhookUrlCopied, setWebhookUrlCopied] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);

  // Проверяем параметры create и select в URL
  useEffect(() => {
    const createParam = searchParams.get('create');
    const selectParam = searchParams.get('select');
    
    if (createParam === 'true') {
      setSelectedRuleId(null);
      setEditingRuleId(-1);
      setSearchParams({}, { replace: true });
    } else if (selectParam) {
      const id = parseInt(selectParam, 10);
      if (!isNaN(id)) {
        setSelectedRuleId(id);
        setEditingRuleId(null);
      }
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // Формируем полный URL вебхука
  const webhookUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/webhook`
    : '/webhook';

  const handleCopyWebhookUrl = async () => {
    try {
      await navigator.clipboard.writeText(webhookUrl);
      setWebhookUrlCopied(true);
      setTimeout(() => setWebhookUrlCopied(false), 2000);
    } catch {
      // Fallback для старых браузеров
      const textArea = document.createElement('textarea');
      textArea.value = webhookUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setWebhookUrlCopied(true);
      setTimeout(() => setWebhookUrlCopied(false), 2000);
    }
  };

  useEffect(() => {
    loadRules();
  }, []);

  const loadRules = async () => {
    try {
      setLoading(true);
      const data = await api.getRules();
      setRules(data);
    } catch (error: any) {
      setMessage({ text: error.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const filteredRules = rules.filter((rule) => {
    const query = searchQuery.toLowerCase();
    return (
      (rule.name ?? '').toLowerCase().includes(query) ||
      (rule.condition ?? '').toLowerCase().includes(query) ||
      String(rule.chatId ?? '').includes(searchQuery)
  );
  });

  const handleSelectRule = (id: number) => {
    setSelectedRuleId(id);
    setEditingRuleId(null);
  };

  const handleEditRule = (id: number) => {
    setSelectedRuleId(id);
    setEditingRuleId(id);
  };

  const handleCreateNew = () => {
    setSelectedRuleId(null);
    setEditingRuleId(null);
  };

  const handleStartCreate = () => {
    setSelectedRuleId(null);
    setEditingRuleId(-1); // -1 indicates creating new
  };

  const handleDeleteRule = async (id: number) => {
    if (!confirm('Вы уверены, что хотите удалить это правило?')) return;

    try {
      await api.deleteRule(id);
      setMessage({ text: 'Правило успешно удалено', type: 'success' });
      setRules(rules.filter((r) => r.id !== id));
      if (selectedRuleId === id) {
        setSelectedRuleId(null);
        setEditingRuleId(null);
      }
    } catch (error: any) {
      setMessage({ text: error.message, type: 'error' });
    }
  };

  const handleDuplicateRule = async (id: number) => {
    try {
      const original = await api.getRule(id);
      const duplicate = {
        ...original,
        name: `${original.name} (копия)`,
        enabled: false,
      };
      delete (duplicate as any).id;
      
      const created = await api.createRule(duplicate);
      setMessage({ text: 'Правило успешно дублировано', type: 'success' });
      setRules([...rules, created]);
      setSelectedRuleId(created.id);
    } catch (error: any) {
      setMessage({ text: error.message, type: 'error' });
    }
  };

  const handleSaveRule = async (rule: Partial<Rule>) => {
    try {
      if (editingRuleId && editingRuleId !== -1) {
        const updated = await api.updateRule(editingRuleId, rule);
        setMessage({ text: 'Правило успешно обновлено', type: 'success' });
        setRules(rules.map((r) => (r.id === editingRuleId ? updated : r)));
        setSelectedRuleId(updated.id);
        setEditingRuleId(null);
      } else {
        const created = await api.createRule(rule);
        setMessage({ text: 'Правило успешно создано', type: 'success' });
        setRules([...rules, created]);
        setSelectedRuleId(created.id);
        setEditingRuleId(null);
      }
    } catch (error: any) {
      setMessage({ text: error.message, type: 'error' });
      throw error;
    }
  };

  const normalizeImportedRule = (raw: any): Partial<Rule> => {
    const chatIds = Array.isArray(raw.chatIds) ? raw.chatIds : raw.chatId;
    const chatId = Array.isArray(chatIds) ? chatIds.join(',') : chatIds;
    return {
      name: String(raw.name ?? '').trim(),
      condition: String(raw.condition ?? '').trim(),
      chatId: chatId != null ? String(chatId).trim() : '',
      botToken: raw.botToken ? String(raw.botToken).trim() : undefined,
      messageTemplate: raw.messageTemplate ? String(raw.messageTemplate) : undefined,
      enabled: raw.enabled ?? true,
    };
  };

  const handleImportRules = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const items = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.rules) ? parsed.rules : [];
      if (!items.length) throw new Error('Файл не содержит правил');

      let created = 0;
      let failed = 0;
      for (const item of items) {
        const payload = normalizeImportedRule(item);
        if (!payload.name || !payload.condition || !payload.chatId) {
          failed += 1;
          continue;
        }
        try {
          const createdRule = await api.createRule(payload);
          created += 1;
          setRules((prev) => [...prev, createdRule]);
        } catch {
          failed += 1;
        }
      }

      const messageText =
        failed === 0
          ? `Импортировано правил: ${created}`
          : `Импортировано: ${created}, пропущено: ${failed}`;
      setMessage({ text: messageText, type: failed === 0 ? 'success' : 'info' });
    } catch (error: any) {
      setMessage({ text: error.message || 'Ошибка импорта правил', type: 'error' });
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
        <div className="flex items-center gap-3">
        <h2 className="text-xl font-semibold">📋 Правила</h2>
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="flex h-6 w-6 items-center justify-center rounded-full bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] transition-colors hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--accent-foreground))]"
                >
                  <Info className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-sm">
                <div className="space-y-3">
                  <div>
                    <p className="mb-2 font-medium">Адрес вебхука для внешних систем:</p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 rounded bg-[hsl(var(--muted))] px-2 py-1 break-all">
                        {webhookUrl}
                      </code>
                      <button
                        onClick={handleCopyWebhookUrl}
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] transition-colors hover:bg-[hsl(var(--primary)_/_0.9)]"
                        title="Копировать"
                      >
                        {webhookUrlCopied ? (
                          <CheckCheck className="h-3.5 w-3.5" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                  <div className="text-[hsl(var(--muted-foreground))]">
                    <p className="mb-1"><strong>Метод:</strong> POST</p>
                    <p className="mb-1"><strong>Content-Type:</strong> application/json</p>
                    <p>Укажите этот URL в настройках вебхуков вашей внешней системы (ITSM, CRM и т.д.)</p>
                  </div>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <div className="flex items-center gap-2">
          <div className="rules-search flex items-center gap-2 rounded border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm transition-all focus-within:border-[hsl(var(--ring))] focus-within:ring-2 focus-within:ring-[hsl(var(--ring)_/_0.2)]">
            <Search className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
            <input
              type="text"
              placeholder="Поиск правил..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-56 bg-transparent text-sm outline-none placeholder:text-[hsl(var(--muted-foreground))]"
            />
          </div>
          <input
            ref={importInputRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={handleImportRules}
          />
          <button
            onClick={() => importInputRef.current?.click()}
            disabled={importing}
            className="rounded border border-[hsl(var(--border))] bg-[hsl(var(--secondary))] p-2 transition-all hover:bg-[hsl(var(--accent))] disabled:cursor-not-allowed disabled:opacity-60"
            title="Импорт правил"
          >
            <Upload className="h-4 w-4" />
          </button>
          <button
            onClick={() => setExportModalOpen(true)}
            className="rounded border border-[hsl(var(--border))] bg-[hsl(var(--secondary))] p-2 transition-all hover:bg-[hsl(var(--accent))]"
            title="Экспорт правил"
          >
            <Download className="h-4 w-4" />
          </button>
        </div>
      </div>

      {message && (
        <div
          className={`mx-4 mt-4 animate-fade-in rounded border p-3 text-sm ${
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
              <h3 className="text-sm font-semibold">📋 Список правил</h3>
              <button
                onClick={loadRules}
                className="rounded border border-[hsl(var(--border))] px-2 py-1 text-xs hover:bg-[hsl(var(--accent))]"
              >
                Обновить
              </button>
            </div>
          <RulesList
            rules={filteredRules}
            selectedId={selectedRuleId}
            onSelect={handleSelectRule}
            loading={loading}
          />
          </div>
        </div>

        <div className="split-right">
          <div className="panel">
          {editingRuleId !== null ? (
            <RuleForm
              ruleId={editingRuleId === -1 ? null : editingRuleId}
              onSave={handleSaveRule}
              onCancel={() => {
                if (selectedRuleId) {
                  setEditingRuleId(null);
                } else {
                  handleCreateNew();
                }
              }}
            />
          ) : selectedRuleId ? (
            <RuleDetails
              ruleId={selectedRuleId}
              onEdit={handleEditRule}
              onDelete={handleDeleteRule}
              onDuplicate={handleDuplicateRule}
              onCreateNew={handleStartCreate}
            />
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center text-[hsl(var(--muted-foreground))]">
              <p className="mb-4">Выберите правило из списка слева для редактирования или просмотра</p>
              <button
                onClick={handleStartCreate}
                className="inline-flex items-center gap-2 rounded bg-[hsl(var(--primary))] px-4 py-2 font-semibold text-[hsl(var(--primary-foreground))] transition-all hover:bg-[hsl(var(--primary)_/_0.9)]"
              >
                <Plus className="h-4 w-4" />
                Создать новое правило
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
        title="Экспорт правил"
        description="Выберите правила для экспорта"
        items={rules.map((r) => ({ id: r.id, name: r.name, enabled: r.enabled }))}
        loading={loading}
        exportFileName={`rules-${new Date().toISOString().slice(0, 10)}.json`}
        exportType="rules"
        onExportSuccess={(count) => setMessage({ text: `Экспортировано правил: ${count}`, type: 'success' })}
      />
    </div>
  );
}
