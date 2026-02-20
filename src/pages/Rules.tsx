import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { api, Rule } from '../lib/api';
import { useAuth } from '../lib/auth-context';
import { Plus, Search, Download, Upload, Info, Copy, CheckCheck, Pencil, Trash2 } from 'lucide-react';
import { RulesList } from '../components/RulesList';
import { RuleDetails } from '../components/RuleDetails';
import { RuleForm } from '../components/RuleForm';
import { ExportModal } from '../components/ExportModal';
import { EntityStateSwitch } from '../components/StateToggle';
import { ToolbarToggle } from '../components/ToolbarToggle';
import { useToast } from '../components/ToastNotification';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../components/ui/tooltip';

export function Rules() {
  const { user } = useAuth();
  const canEdit = user?.role !== 'auditor';
  const [searchParams, setSearchParams] = useSearchParams();
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRuleId, setSelectedRuleId] = useState<number | null>(null);
  const [editingRuleId, setEditingRuleId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const { addToast } = useToast();
  const [importing, setImporting] = useState(false);
  const [togglingRuleId, setTogglingRuleId] = useState<number | null>(null);

  // РђРІС‚РѕРјР°С‚РёС‡РµСЃРєРё СЃРєСЂС‹РІР°С‚СЊ СѓРІРµРґРѕРјР»РµРЅРёРµ С‡РµСЂРµР· 4 СЃРµРєСѓРЅРґС‹
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [webhookUrlCopied, setWebhookUrlCopied] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);

  // РџСЂРѕРІРµСЂСЏРµРј РїР°СЂР°РјРµС‚СЂС‹ create Рё select РІ URL
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

  // Р¤РѕСЂРјРёСЂСѓРµРј РїРѕР»РЅС‹Р№ URL РІРµР±С…СѓРєР°
  const webhookUrl = typeof window !== 'undefined'
    ? (user?.accountSlug
        ? `${window.location.origin}/webhook/${user.accountSlug}`
        : `${window.location.origin}/webhook`)
    : '/webhook';

  const handleCopyWebhookUrl = async () => {
    try {
      await navigator.clipboard.writeText(webhookUrl);
      setWebhookUrlCopied(true);
      setTimeout(() => setWebhookUrlCopied(false), 2000);
    } catch {
      // Fallback РґР»СЏ СЃС‚Р°СЂС‹С… Р±СЂР°СѓР·РµСЂРѕРІ
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
      addToast(error.message, 'error');
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
    if (!confirm('Р’С‹ СѓРІРµСЂРµРЅС‹, С‡С‚Рѕ С…РѕС‚РёС‚Рµ СѓРґР°Р»РёС‚СЊ СЌС‚РѕС‚ Webhook?')) return;

    try {
      await api.deleteRule(id);
      addToast('Webhook СѓРґР°Р»С‘РЅ', 'success');
      setRules(rules.filter((r) => r.id !== id));
      if (selectedRuleId === id) {
        setSelectedRuleId(null);
        setEditingRuleId(null);
      }
    } catch (error: any) {
      addToast(error.message, 'error');
    }
  };

  const handleDuplicateRule = async (id: number) => {
    try {
      const original = await api.getRule(id);
      const duplicate = {
        ...original,
        name: `${original.name} (РєРѕРїРёСЏ)`,
        enabled: false,
      };
      delete (duplicate as any).id;
      
      const created = await api.createRule(duplicate);
      addToast('Webhook РґСѓР±Р»РёСЂРѕРІР°РЅ', 'success');
      setRules([...rules, created]);
      setSelectedRuleId(created.id);
    } catch (error: any) {
      addToast(error.message, 'error');
    }
  };

  const handleSaveRule = async (rule: Partial<Rule>) => {
    try {
      if (editingRuleId && editingRuleId !== -1) {
        const updated = await api.updateRule(editingRuleId, rule);
        addToast('Webhook РѕР±РЅРѕРІР»С‘РЅ', 'success');
        setRules(rules.map((r) => (r.id === editingRuleId ? updated : r)));
        setSelectedRuleId(updated.id);
        setEditingRuleId(null);
      } else {
        const created = await api.createRule(rule);
        addToast('Webhook СЃРѕР·РґР°РЅ', 'success');
        setRules([...rules, created]);
        setSelectedRuleId(created.id);
        setEditingRuleId(null);
      }
    } catch (error: any) {
      addToast(error.message, 'error');
      throw error;
    }
  };

  const handleToggleRuleEnabled = async (rule: Rule, forcedNextEnabled?: boolean) => {
    const nextEnabled = typeof forcedNextEnabled === 'boolean' ? forcedNextEnabled : !rule.enabled;
    try {
      setTogglingRuleId(rule.id);
      const updated = await api.updateRule(rule.id, { enabled: nextEnabled });
      const mergedUpdated = { ...rule, ...updated, id: rule.id };
      setRules((prev) => prev.map((r) => (r.id === rule.id ? mergedUpdated : r)));
      addToast(nextEnabled ? 'Webhook РІРєР»СЋС‡РµРЅ' : 'Webhook РІС‹РєР»СЋС‡РµРЅ', 'success');
    } catch (error: any) {
      addToast(error.message || 'РќРµ СѓРґР°Р»РѕСЃСЊ РѕР±РЅРѕРІРёС‚СЊ СЃС‚Р°С‚СѓСЃ Webhook', 'error');
    } finally {
      setTogglingRuleId(null);
    }
  };

  const normalizeImportedRule = (raw: any, index: number): { payload: Partial<Rule>; drafted: boolean } => {
    const chatIds = Array.isArray(raw.chatIds) ? raw.chatIds : raw.chatId;
    const chatIdRaw = Array.isArray(chatIds) ? chatIds.join(',') : chatIds;
    const name = String(raw.name ?? '').trim();
    const condition = String(raw.condition ?? '').trim();
    const chatId = chatIdRaw != null ? String(chatIdRaw).trim() : '';
    const drafted = !name || !condition || !chatId;
    return {
      payload: {
        name: name || `Черновик webhook ${index + 1}`,
        condition: condition || 'true',
        chatId: chatId || '0',
        botToken: raw.botToken ? String(raw.botToken).trim() : undefined,
        messageTemplate: raw.messageTemplate ? String(raw.messageTemplate) : undefined,
        enabled: drafted ? false : (raw.enabled ?? true),
      },
      drafted,
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
      if (!items.length) throw new Error('Р¤Р°Р№Р» РЅРµ СЃРѕРґРµСЂР¶РёС‚ Webhook');

      let created = 0;
      let failed = 0;
      let draftedCount = 0;
      let lastError = '';
      for (const [index, item] of items.entries()) {
        const { payload, drafted } = normalizeImportedRule(item, index);
        if (drafted) draftedCount += 1;
        try {
          const createdRule = await api.createRule(payload);
          created += 1;
          setRules((prev) => [...prev, createdRule]);
        } catch (err: any) {
          failed += 1;
          if (!lastError) lastError = err?.message || 'Ошибка создания';
        }
      }

      const messageText =
        failed === 0
          ? draftedCount > 0
            ? `Импортировано webhook: ${created}, черновиков: ${draftedCount}`
            : `Импортировано webhook: ${created}`
          : lastError
            ? `Импортировано: ${created}, черновиков: ${draftedCount}, ошибок: ${failed}. Причина: ${lastError}`
            : `Импортировано: ${created}, черновиков: ${draftedCount}, ошибок: ${failed}`;
      addToast(messageText, failed === 0 ? 'success' : 'info');
    } catch (error: any) {
      addToast(error.message || 'РћС€РёР±РєР° РёРјРїРѕСЂС‚Р° Webhook', 'error');
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
        <h2 className="text-xl font-semibold">рџ“Ґ Webhook</h2>
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="flex h-6 w-6 items-center justify-center rounded-full text-[hsl(var(--muted-foreground))] transition-colors hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--accent-foreground))]"
                >
                  <Info className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-sm">
                <div className="space-y-3">
                  <div>
                    <p className="mb-2 font-medium">РђРґСЂРµСЃ РІРµР±С…СѓРєР° РґР»СЏ РІРЅРµС€РЅРёС… СЃРёСЃС‚РµРј:</p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 rounded bg-[hsl(var(--muted))] px-2 py-1 break-all">
                        {webhookUrl}
                      </code>
                      <button
                        onClick={handleCopyWebhookUrl}
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] transition-colors hover:bg-[hsl(var(--primary)_/_0.9)]"
                        title="РљРѕРїРёСЂРѕРІР°С‚СЊ"
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
                    <p className="mb-1"><strong>РњРµС‚РѕРґ:</strong> POST</p>
                    <p className="mb-1"><strong>Content-Type:</strong> application/json</p>
                    <p>РЈРєР°Р¶РёС‚Рµ СЌС‚РѕС‚ URL РІ РЅР°СЃС‚СЂРѕР№РєР°С… РІРµР±С…СѓРєРѕРІ РІР°С€РµР№ РІРЅРµС€РЅРµР№ СЃРёСЃС‚РµРјС‹ (ITSM, CRM Рё С‚.Рґ.)</p>
                  </div>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <div className="flex items-center gap-2">
          {canEdit && selectedRuleId && !editingRuleId && (
            <>
              <button
                onClick={() => handleEditRule(selectedRuleId)}
                className="icon-button"
                title="Р РµРґР°РєС‚РёСЂРѕРІР°С‚СЊ"
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                onClick={() => handleDuplicateRule(selectedRuleId)}
                className="icon-button"
                title="Р”СѓР±Р»РёСЂРѕРІР°С‚СЊ"
              >
                <Copy className="h-4 w-4" />
              </button>
              <button
                onClick={() => handleDeleteRule(selectedRuleId)}
                className="icon-button text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive)_/_0.1)]"
                title="РЈРґР°Р»РёС‚СЊ"
              >
                <Trash2 className="h-4 w-4" />
              </button>
              <ToolbarToggle
                enabled={rules.find(r => r.id === selectedRuleId)?.enabled ?? false}
                disabled={togglingRuleId === selectedRuleId}
                onChange={(nextEnabled) => {
                  const rule = rules.find(r => r.id === selectedRuleId);
                  if (rule) {
                    void handleToggleRuleEnabled(rule, nextEnabled);
                  } else {
                    addToast('РќРµ СѓРґР°Р»РѕСЃСЊ РѕРїСЂРµРґРµР»РёС‚СЊ РІС‹Р±СЂР°РЅРЅС‹Р№ Webhook', 'error');
                  }
                }}
                title={rules.find(r => r.id === selectedRuleId)?.enabled ? 'Р’С‹РєР»СЋС‡РёС‚СЊ Webhook' : 'Р’РєР»СЋС‡РёС‚СЊ Webhook'}
              />
              <div className="mx-1 h-6 w-px bg-[hsl(var(--border))]" />
            </>
          )}
          <div className="rules-search flex items-center gap-2 rounded border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm transition-all focus-within:border-[hsl(var(--ring))] focus-within:ring-2 focus-within:ring-[hsl(var(--ring)_/_0.2)]">
            <Search className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
            <input
              type="text"
              placeholder="РџРѕРёСЃРє Webhook..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-56 bg-transparent text-sm outline-none placeholder:text-[hsl(var(--muted-foreground))]"
            />
          </div>
          {canEdit && (
            <>
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
                className="icon-button disabled:cursor-not-allowed disabled:opacity-60"
                title="РРјРїРѕСЂС‚ Webhook"
              >
                <Upload className="h-4 w-4" />
              </button>
              <button
                onClick={() => setExportModalOpen(true)}
                className="icon-button"
                title="Р­РєСЃРїРѕСЂС‚ Webhook"
              >
                <Download className="h-4 w-4" />
              </button>
              <button
                onClick={handleStartCreate}
                className="icon-button"
                title="РЎРѕР·РґР°С‚СЊ Webhook"
              >
                <Plus className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
      </div>


      <div className="split-layout p-6">
        <div className="split-left">
          <div className={`panel ${editingRuleId !== null ? 'entity-edit-panel' : ''}`}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold">рџ“‹ РЎРїРёСЃРѕРє Webhook</h3>
              <button
                onClick={loadRules}
                className="rounded border border-[hsl(var(--border))] px-2 py-1 text-xs hover:bg-[hsl(var(--accent))]"
              >
                РћР±РЅРѕРІРёС‚СЊ
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
              canEdit={canEdit}
              onToggleEnabled={handleToggleRuleEnabled}
              toggling={togglingRuleId === selectedRuleId}
            />
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center text-[hsl(var(--muted-foreground))]">
              <p className="mb-4">Р’С‹Р±РµСЂРёС‚Рµ Webhook РёР· СЃРїРёСЃРєР° СЃР»РµРІР° РґР»СЏ СЂРµРґР°РєС‚РёСЂРѕРІР°РЅРёСЏ РёР»Рё РїСЂРѕСЃРјРѕС‚СЂР°</p>
              <button
                onClick={handleStartCreate}
                className="inline-flex items-center gap-2 rounded bg-[hsl(var(--primary))] px-4 py-2 font-semibold text-[hsl(var(--primary-foreground))] transition-all hover:bg-[hsl(var(--primary)_/_0.9)]"
              >
                <Plus className="h-4 w-4" />
                РЎРѕР·РґР°С‚СЊ Webhook
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
        title="Р­РєСЃРїРѕСЂС‚ Webhook"
        description="Р’С‹Р±РµСЂРёС‚Рµ Webhook РґР»СЏ СЌРєСЃРїРѕСЂС‚Р°"
        items={rules.map((r) => ({ id: r.id, name: r.name, enabled: r.enabled }))}
        loading={loading}
        exportFileName={`rules-${new Date().toISOString().slice(0, 10)}.json`}
        exportType="rules"
        onExportSuccess={(count) => addToast(`Р­РєСЃРїРѕСЂС‚РёСЂРѕРІР°РЅРѕ Webhook: ${count}`, 'success')}
      />
    </div>
  );
}


