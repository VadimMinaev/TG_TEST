import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { api, Integration, Rule, Poll } from '../lib/api';
import { useAuth } from '../lib/auth-context';
import { Copy, Download, Pencil, Play, Plus, RefreshCw, Trash2, Upload } from 'lucide-react';
import { TemplateHelp } from '../components/TemplateHelp';
import { ExportModal } from '../components/ExportModal';
import { Switch } from '../components/ui/switch';

const DEFAULT_FORM: Omit<Integration, 'id'> = {
  name: '',
  enabled: true,
  triggerType: 'webhook',
  triggerCondition: '',
  pollingUrl: '',
  pollingMethod: 'GET',
  pollingHeaders: '',
  pollingBody: '',
  pollingInterval: 60,
  pollingCondition: '',
  pollingContinueAfterMatch: false,
  actionUrl: '',
  actionMethod: 'POST',
  actionHeaders: '',
  actionBody: '',
  timeoutSec: 30,
  sendToTelegram: false,
  chatId: '',
  botToken: '',
  messageTemplate: '',
};

export function Integrations() {
  const { user } = useAuth();
  const canEdit = user?.role !== 'auditor';
  const [searchParams, setSearchParams] = useSearchParams();
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);
  const [polls, setPolls] = useState<Poll[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [selectedSourceId, setSelectedSourceId] = useState<string>('');
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [running, setRunning] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [togglingIntegrationId, setTogglingIntegrationId] = useState<number | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  // РђРІС‚РѕРјР°С‚РёС‡РµСЃРєРё СЃРєСЂС‹РІР°С‚СЊ СѓРІРµРґРѕРјР»РµРЅРёРµ С‡РµСЂРµР· 4 СЃРµРєСѓРЅРґС‹
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  const selectedIntegration = useMemo(
    () => integrations.find((i) => i.id === selectedId) || null,
    [integrations, selectedId]
  );

  const loadIntegrations = async () => {
    try {
      setLoading(true);
      const [integrationsData, rulesData, pollsData] = await Promise.all([
        api.getIntegrations(),
        api.getRules(),
        api.getPolls(),
      ]);
      setIntegrations(integrationsData);
      setRules(rulesData);
      setPolls(pollsData);
    } catch (error: any) {
      setMessage({ text: error.message || 'РќРµ СѓРґР°Р»РѕСЃСЊ Р·Р°РіСЂСѓР·РёС‚СЊ РґР°РЅРЅС‹Рµ', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadIntegrations();
  }, []);

  // РџСЂРёРјРµРЅРёС‚СЊ РЅР°СЃС‚СЂРѕР№РєРё РёР· РІС‹Р±СЂР°РЅРЅРѕРіРѕ Webhook РёР»Рё РїСѓР»Р»РёРЅРіР°
  const handleApplySource = (sourceId: string) => {
    setSelectedSourceId(sourceId);
    if (!sourceId) return;

    if (form.triggerType === 'webhook') {
      const rule = rules.find((r) => String(r.id) === sourceId);
      if (rule) {
        setForm({
          ...form,
          triggerCondition: rule.condition || '',
          chatId: rule.chatId || '',
          botToken: rule.botToken || '',
          messageTemplate: rule.messageTemplate || '',
        });
      }
    } else {
      const poll = polls.find((p) => String(p.id) === sourceId);
      if (poll) {
        setForm({
          ...form,
          pollingUrl: poll.url || '',
          pollingMethod: poll.method || 'GET',
          pollingHeaders: poll.headersJson || '',
          pollingBody: poll.bodyJson || '',
          pollingInterval: poll.intervalSec || 60,
          pollingCondition: poll.conditionJson || '',
          chatId: poll.chatId || '',
          botToken: poll.botToken || '',
          messageTemplate: poll.messageTemplate || '',
          timeoutSec: poll.timeoutSec || 30,
        });
      }
    }
  };

  useEffect(() => {
    const createParam = searchParams.get('create');
    const selectParam = searchParams.get('select');
    
    if (createParam === 'true') {
      setSelectedId(null);
      setEditingId(-1);
      setForm(DEFAULT_FORM);
      setSearchParams({}, { replace: true });
    } else if (selectParam) {
      const id = parseInt(selectParam, 10);
      if (!isNaN(id)) {
        setSelectedId(id);
        setEditingId(null);
      }
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const handleSelect = (id: number) => {
    setSelectedId(id);
    setEditingId(null);
  };

  const handleStartCreate = () => {
    setSelectedId(null);
    setEditingId(-1);
    setForm(DEFAULT_FORM);
    setSelectedSourceId('');
  };

  const handleEdit = (integration: Integration) => {
    setSelectedId(integration.id);
    setEditingId(integration.id);
    setSelectedSourceId('');
    setForm({
      name: integration.name || '',
      enabled: integration.enabled ?? true,
      triggerType: integration.triggerType || 'webhook',
      triggerCondition: integration.triggerCondition || '',
      pollingUrl: integration.pollingUrl || '',
      pollingMethod: integration.pollingMethod || 'GET',
      pollingHeaders: integration.pollingHeaders || '',
      pollingBody: integration.pollingBody || '',
      pollingInterval: integration.pollingInterval || 60,
      pollingCondition: integration.pollingCondition || '',
      pollingContinueAfterMatch: integration.pollingContinueAfterMatch ?? false,
      actionUrl: integration.actionUrl || '',
      actionMethod: integration.actionMethod || 'POST',
      actionHeaders: integration.actionHeaders || '',
      actionBody: integration.actionBody || '',
      timeoutSec: integration.timeoutSec || 30,
      sendToTelegram: integration.sendToTelegram ?? false,
      chatId: integration.chatId || '',
      botToken: integration.botToken || '',
      messageTemplate: integration.messageTemplate || '',
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (!form.name) {
      setMessage({ text: 'РЈРєР°Р¶РёС‚Рµ РЅР°Р·РІР°РЅРёРµ', type: 'error' });
      return;
    }

    // Р”Р»СЏ webhook С‚СЂРёРіРіРµСЂР° РїРѕР»Рµ pollingContinueAfterMatch РґРѕР»Р¶РЅРѕ Р±С‹С‚СЊ null РІ Р‘Р”
    const dataToSave = {
      ...form,
      pollingContinueAfterMatch: form.triggerType === 'webhook' ? undefined : form.pollingContinueAfterMatch,
    };

    try {
      if (editingId && editingId !== -1) {
        const updated = await api.updateIntegration(editingId, dataToSave);
        setEditingId(null);
        setSelectedId(updated.id);
        setMessage({ text: 'РРЅС‚РµРіСЂР°С†РёСЏ РѕР±РЅРѕРІР»РµРЅР°', type: 'success' });
        // РџРµСЂРµР·Р°РіСЂСѓР¶Р°РµРј СЃРїРёСЃРѕРє РґР»СЏ СЃРёРЅС…СЂРѕРЅРёР·Р°С†РёРё
        await loadIntegrations();
      } else {
        const created = await api.createIntegration(dataToSave);
        setEditingId(null);
        setSelectedId(created.id);
        setMessage({ text: 'РРЅС‚РµРіСЂР°С†РёСЏ СЃРѕР·РґР°РЅР°', type: 'success' });
        // РџРµСЂРµР·Р°РіСЂСѓР¶Р°РµРј СЃРїРёСЃРѕРє РґР»СЏ СЃРёРЅС…СЂРѕРЅРёР·Р°С†РёРё
        await loadIntegrations();
      }
    } catch (error: any) {
      setMessage({ text: error.message || 'РћС€РёР±РєР° СЃРѕС…СЂР°РЅРµРЅРёСЏ', type: 'error' });
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('РЈРґР°Р»РёС‚СЊ РёРЅС‚РµРіСЂР°С†РёСЋ?')) return;
    try {
      await api.deleteIntegration(id);
      setIntegrations((prev) => prev.filter((i) => i.id !== id));
      if (selectedId === id) {
        setSelectedId(null);
        setEditingId(null);
      }
      setMessage({ text: 'РРЅС‚РµРіСЂР°С†РёСЏ СѓРґР°Р»РµРЅР°', type: 'success' });
    } catch (error: any) {
      setMessage({ text: error.message, type: 'error' });
    }
  };

  const handleDuplicate = async (integration: Integration) => {
    try {
      const { id, ...data } = integration;
      const created = await api.createIntegration({
        ...data,
        name: `${data.name} (РєРѕРїРёСЏ)`,
        enabled: false,
      });
      setIntegrations((prev) => [created, ...prev]);
      setSelectedId(created.id);
      setMessage({ text: 'РРЅС‚РµРіСЂР°С†РёСЏ РґСѓР±Р»РёСЂРѕРІР°РЅР°', type: 'success' });
    } catch (error: any) {
      setMessage({ text: error.message, type: 'error' });
    }
  };

  const handleRun = async (id: number) => {
    setRunning(true);
    try {
      const result = await api.runIntegration(id);
      if (result.status === 'success') {
        setMessage({ text: 'РРЅС‚РµРіСЂР°С†РёСЏ РІС‹РїРѕР»РЅРµРЅР° СѓСЃРїРµС€РЅРѕ', type: 'success' });
      } else {
        setMessage({ text: `РћС€РёР±РєР°: ${result.errorMessage || 'РќРµРёР·РІРµСЃС‚РЅР°СЏ РѕС€РёР±РєР°'}`, type: 'error' });
      }
    } catch (error: any) {
      setMessage({ text: error.message, type: 'error' });
    } finally {
      setRunning(false);
    }
  };

  const handleToggleIntegrationEnabled = async (integration: Integration) => {
    const nextEnabled = !integration.enabled;
    try {
      setTogglingIntegrationId(integration.id);
      const updated = await api.updateIntegration(integration.id, { enabled: nextEnabled });
      setIntegrations((prev) => prev.map((item) => (item.id === integration.id ? updated : item)));
      setMessage({
        text: nextEnabled ? 'РРЅС‚РµРіСЂР°С†РёСЏ РІРєР»СЋС‡РµРЅР°' : 'РРЅС‚РµРіСЂР°С†РёСЏ РІС‹РєР»СЋС‡РµРЅР°',
        type: 'success',
      });
    } catch (error: any) {
      setMessage({ text: error.message || 'РќРµ СѓРґР°Р»РѕСЃСЊ РѕР±РЅРѕРІРёС‚СЊ СЃС‚Р°С‚СѓСЃ РёРЅС‚РµРіСЂР°С†РёРё', type: 'error' });
    } finally {
      setTogglingIntegrationId(null);
    }
  };

  const normalizeImportedIntegration = (raw: any): Partial<Integration> => {
    const triggerType = raw.triggerType === 'polling' ? 'polling' : 'webhook';
    return {
      name: String(raw.name ?? '').trim(),
      enabled: raw.enabled ?? true,
      triggerType,
      triggerCondition: String(raw.triggerCondition ?? '').trim(),
      pollingUrl: raw.pollingUrl != null ? String(raw.pollingUrl) : undefined,
      pollingMethod: raw.pollingMethod || 'GET',
      pollingHeaders: raw.pollingHeaders != null ? String(raw.pollingHeaders) : undefined,
      pollingBody: raw.pollingBody != null ? String(raw.pollingBody) : undefined,
      pollingInterval: Number(raw.pollingInterval) || 60,
      pollingCondition: raw.pollingCondition != null ? String(raw.pollingCondition) : undefined,
      // Р”Р»СЏ webhook С‚СЂРёРіРіРµСЂР° РїРѕР»Рµ pollingContinueAfterMatch РґРѕР»Р¶РЅРѕ Р±С‹С‚СЊ null РІ Р‘Р”
      pollingContinueAfterMatch: triggerType === 'webhook' ? undefined : (raw.pollingContinueAfterMatch ?? false),
      actionUrl: raw.actionUrl != null ? String(raw.actionUrl) : undefined,
      actionMethod: raw.actionMethod || 'POST',
      actionHeaders: raw.actionHeaders != null ? String(raw.actionHeaders) : undefined,
      actionBody: raw.actionBody != null ? String(raw.actionBody) : undefined,
      timeoutSec: Number(raw.timeoutSec) || 30,
      sendToTelegram: raw.sendToTelegram ?? false,
      chatId: raw.chatId != null ? String(raw.chatId) : undefined,
      botToken: raw.botToken ? String(raw.botToken) : undefined,
      messageTemplate: raw.messageTemplate ? String(raw.messageTemplate) : undefined,
    };
  };

  const handleImportIntegrations = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const items = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.integrations) ? parsed.integrations : [];
      if (!items.length) throw new Error('Р¤Р°Р№Р» РЅРµ СЃРѕРґРµСЂР¶РёС‚ РёРЅС‚РµРіСЂР°С†РёР№');

      let created = 0;
      let failed = 0;
      let lastError = '';
      for (const item of items) {
        const payload = normalizeImportedIntegration(item);
        if (!payload.name) {
          failed += 1;
          if (!lastError) lastError = 'РќРµ Р·Р°РїРѕР»РЅРµРЅРѕ РЅР°Р·РІР°РЅРёРµ';
          continue;
        }
        try {
          const createdIntegration = await api.createIntegration(payload);
          created += 1;
          setIntegrations((prev) => [...prev, createdIntegration]);
        } catch (err: any) {
          failed += 1;
          if (!lastError) lastError = err?.message || 'РћС€РёР±РєР° СЃРѕР·РґР°РЅРёСЏ';
        }
      }

      const messageText =
        failed === 0
          ? `РРјРїРѕСЂС‚РёСЂРѕРІР°РЅРѕ РёРЅС‚РµРіСЂР°С†РёР№: ${created}`
          : lastError
            ? `РРјРїРѕСЂС‚РёСЂРѕРІР°РЅРѕ: ${created}, РїСЂРѕРїСѓС‰РµРЅРѕ: ${failed}. РџСЂРёС‡РёРЅР°: ${lastError}`
            : `РРјРїРѕСЂС‚РёСЂРѕРІР°РЅРѕ: ${created}, РїСЂРѕРїСѓС‰РµРЅРѕ: ${failed}`;
      setMessage({ text: messageText, type: failed === 0 ? 'success' : 'info' });
    } catch (error: any) {
      setMessage({ text: error.message || 'РћС€РёР±РєР° РёРјРїРѕСЂС‚Р° РёРЅС‚РµРіСЂР°С†РёР№', type: 'error' });
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
        <h2 className="text-xl font-semibold">рџ”— РРЅС‚РµРіСЂР°С‚РѕСЂ</h2>
        <div className="flex items-center gap-2">
          {canEdit && selectedIntegration && !editingId && (
            <>
              <button
                onClick={() => handleRun(selectedIntegration.id)}
                disabled={running}
                className="icon-button text-[hsl(var(--success))] hover:bg-[hsl(var(--success)_/_0.1)] disabled:opacity-50"
                title={running ? 'Р’С‹РїРѕР»РЅСЏРµС‚СЃСЏ...' : 'Р—Р°РїСѓСЃС‚РёС‚СЊ'}
              >
                <Play className="h-4 w-4" />
              </button>
              <button
                onClick={() => handleEdit(selectedIntegration)}
                className="icon-button"
                title="Р РµРґР°РєС‚РёСЂРѕРІР°С‚СЊ"
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                onClick={() => handleDuplicate(selectedIntegration)}
                className="icon-button"
                title="Р”СѓР±Р»РёСЂРѕРІР°С‚СЊ"
              >
                <Copy className="h-4 w-4" />
              </button>
              <button
                onClick={() => handleDelete(selectedIntegration.id)}
                className="icon-button text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive)_/_0.1)]"
                title="РЈРґР°Р»РёС‚СЊ"
              >
                <Trash2 className="h-4 w-4" />
              </button>
              <div className="mx-1 h-6 w-px bg-[hsl(var(--border))]" />
            </>
          )}
          <button
            onClick={loadIntegrations}
            className="icon-button"
            title="РћР±РЅРѕРІРёС‚СЊ"
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
                onChange={handleImportIntegrations}
              />
              <button
                onClick={() => importInputRef.current?.click()}
                disabled={importing}
                className="icon-button disabled:cursor-not-allowed disabled:opacity-60"
                title="РРјРїРѕСЂС‚ РёРЅС‚РµРіСЂР°С†РёР№"
              >
                <Upload className="h-4 w-4" />
              </button>
              <button
                onClick={() => setExportModalOpen(true)}
                className="icon-button"
                title="Р­РєСЃРїРѕСЂС‚ РёРЅС‚РµРіСЂР°С†РёР№"
              >
                <Download className="h-4 w-4" />
              </button>
              <button
                onClick={handleStartCreate}
                className="icon-button"
                title="РЎРѕР·РґР°С‚СЊ"
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
              <h3 className="text-sm font-semibold">рџ“‹ РЎРїРёСЃРѕРє РёРЅС‚РµРіСЂР°С†РёР№</h3>
              <span className="text-xs text-[hsl(var(--muted-foreground))]">{integrations.length}</span>
            </div>
            {loading ? (
              <div className="flex items-center justify-center py-10">
                <div className="h-6 w-6 animate-spin rounded-full border-4 border-[hsl(var(--primary))] border-t-transparent" />
              </div>
            ) : integrations.length === 0 ? (
              <p className="py-10 text-center text-sm text-[hsl(var(--muted-foreground))]">РРЅС‚РµРіСЂР°С†РёРё РЅРµ РЅР°Р№РґРµРЅС‹</p>
            ) : (
              <div className="entity-list-scroll scrollbar-thin">
                <table className="table-basic w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-[hsl(var(--border))] text-left text-xs">
                      <th className="px-2 py-2">РќР°Р·РІР°РЅРёРµ</th>
                      <th className="px-2 py-2">РўСЂРёРіРіРµСЂ</th>
                      <th className="px-2 py-2">РЎС‚Р°С‚СѓСЃ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {integrations.map((integration) => (
                      <tr
                        key={integration.id}
                        onClick={() => handleSelect(integration.id)}
                        className={`cursor-pointer border-b border-[hsl(var(--border))] transition-colors hover:bg-[hsl(var(--accent))] ${
                          selectedId === integration.id ? 'bg-[hsl(var(--accent))]' : ''
                        }`}
                      >
                        <td className="px-2 py-2 font-medium">{integration.name}</td>
                        <td className="px-2 py-2 text-xs">
                          {integration.triggerType === 'webhook' ? 'рџ“Ґ Webhook' : 'рџ”„ Polling'}
                        </td>
                        <td className="px-2 py-2">{integration.enabled ? 'вњ… Р’РєР»' : 'вЏёпёЏ Р’С‹РєР»'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="split-right">
          <div className="panel">
            {editingId !== null ? (
              <>
                <h3 className="mb-4 text-lg font-semibold">
                  {editingId === -1 ? 'РЎРѕР·РґР°РЅРёРµ РёРЅС‚РµРіСЂР°С†РёРё' : 'Р РµРґР°РєС‚РёСЂРѕРІР°РЅРёРµ'}
                </h3>
                <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label style={{ display: 'block', marginBottom: '16px', fontSize: '14px', fontWeight: 500 }}>РќР°Р·РІР°РЅРёРµ</label>
                      <input
                        style={{ padding: '12px 16px', width: '100%', borderRadius: '8px', border: '1px solid hsl(var(--input))', background: 'hsl(var(--background))' }}
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        placeholder="РњРѕСЏ РёРЅС‚РµРіСЂР°С†РёСЏ"
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '16px', fontSize: '14px', fontWeight: 500 }}>РўРёРї С‚СЂРёРіРіРµСЂР°</label>
                      <select
                        style={{ padding: '12px 16px', width: '100%', borderRadius: '8px', border: '1px solid hsl(var(--input))', background: 'hsl(var(--background))' }}
                        value={form.triggerType}
                        onChange={(e) => {
                          const newTriggerType = e.target.value as 'webhook' | 'polling';
                          setForm({
                            ...form,
                            triggerType: newTriggerType,
                            // РЎР±СЂР°СЃС‹РІР°РµРј pollingContinueAfterMatch РїСЂРё РїРµСЂРµРєР»СЋС‡РµРЅРёРё РЅР° webhook
                            pollingContinueAfterMatch: newTriggerType === 'webhook' ? false : form.pollingContinueAfterMatch,
                          });
                          setSelectedSourceId('');
                        }}
                      >
                        <option value="webhook">Webhook (РІС…РѕРґСЏС‰РёР№)</option>
                        <option value="polling">Polling (РѕРїСЂРѕСЃ)</option>
                      </select>
                    </div>
                  </div>

                  {form.triggerType === 'webhook' && (
                    <>
                      {rules.length > 0 && (
                        <div>
                          <label style={{ display: 'block', marginBottom: '16px', fontSize: '14px', fontWeight: 500 }}>рџ“Ґ РСЃРїРѕР»СЊР·РѕРІР°С‚СЊ Webhook</label>
                          <select
                            style={{ padding: '12px 16px', width: '100%', borderRadius: '8px', border: '1px solid hsl(var(--input))', background: 'hsl(var(--background))' }}
                            value={selectedSourceId}
                            onChange={(e) => handleApplySource(e.target.value)}
                          >
                            <option value="">вЂ” РќР°СЃС‚СЂРѕРёС‚СЊ РІСЂСѓС‡РЅСѓСЋ вЂ”</option>
                            {rules.map((rule) => (
                              <option key={rule.id} value={rule.id}>
                                {rule.name} {rule.enabled ? 'вњ…' : 'вЏёпёЏ'}
                              </option>
                            ))}
                          </select>
                          <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
                            Р’С‹Р±РµСЂРёС‚Рµ СЃСѓС‰РµСЃС‚РІСѓСЋС‰РёР№ Webhook РґР»СЏ РєРѕРїРёСЂРѕРІР°РЅРёСЏ РЅР°СЃС‚СЂРѕРµРє
                          </p>
                        </div>
                      )}
                      <div>
                        <label style={{ display: 'block', marginBottom: '16px', fontSize: '14px', fontWeight: 500 }}>РЈСЃР»РѕРІРёРµ СЃСЂР°Р±Р°С‚С‹РІР°РЅРёСЏ</label>
                        <input
                          style={{ padding: '12px 16px', width: '100%', borderRadius: '8px', border: '1px solid hsl(var(--input))', background: 'hsl(var(--background))', fontFamily: 'monospace' }}
                          value={form.triggerCondition}
                          onChange={(e) => setForm({ ...form, triggerCondition: e.target.value })}
                          placeholder='payload.type === "order"'
                        />
                        <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
                          JavaScript-РІС‹СЂР°Р¶РµРЅРёРµ. Р”РѕСЃС‚СѓРїРЅР° РїРµСЂРµРјРµРЅРЅР°СЏ <code>payload</code>
                        </p>
                      </div>
                    </>
                  )}

                  {form.triggerType === 'polling' && (
                    <>
                      {polls.length > 0 && (
                        <div>
                          <label style={{ display: 'block', marginBottom: '16px', fontSize: '14px', fontWeight: 500 }}>рџ”„ РСЃРїРѕР»СЊР·РѕРІР°С‚СЊ РїСѓР»Р»РёРЅРі</label>
                          <select
                            style={{ padding: '12px 16px', width: '100%', borderRadius: '8px', border: '1px solid hsl(var(--input))', background: 'hsl(var(--background))' }}
                            value={selectedSourceId}
                            onChange={(e) => handleApplySource(e.target.value)}
                          >
                            <option value="">вЂ” РќР°СЃС‚СЂРѕРёС‚СЊ РІСЂСѓС‡РЅСѓСЋ вЂ”</option>
                            {polls.map((poll) => (
                              <option key={poll.id} value={poll.id}>
                                {poll.name} {poll.enabled ? 'вњ…' : 'вЏёпёЏ'}
                              </option>
                            ))}
                          </select>
                          <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
                            Р’С‹Р±РµСЂРёС‚Рµ СЃСѓС‰РµСЃС‚РІСѓСЋС‰РёР№ РїСѓР»Р»РёРЅРі РґР»СЏ РєРѕРїРёСЂРѕРІР°РЅРёСЏ РЅР°СЃС‚СЂРѕРµРє
                          </p>
                        </div>
                      )}
                      <div className="grid grid-cols-3 gap-4">
                        <div className="col-span-2">
                          <label style={{ display: 'block', marginBottom: '16px', fontSize: '14px', fontWeight: 500 }}>URL РґР»СЏ РѕРїСЂРѕСЃР°</label>
                          <input
                            style={{ padding: '12px 16px', width: '100%', borderRadius: '8px', border: '1px solid hsl(var(--input))', background: 'hsl(var(--background))' }}
                            value={form.pollingUrl}
                            onChange={(e) => setForm({ ...form, pollingUrl: e.target.value })}
                            placeholder="https://api.example.com/status"
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', marginBottom: '16px', fontSize: '14px', fontWeight: 500 }}>РњРµС‚РѕРґ</label>
                          <select
                            style={{ padding: '12px 16px', width: '100%', borderRadius: '8px', border: '1px solid hsl(var(--input))', background: 'hsl(var(--background))' }}
                            value={form.pollingMethod}
                            onChange={(e) => setForm({ ...form, pollingMethod: e.target.value })}
                          >
                            <option value="GET">GET</option>
                            <option value="POST">POST</option>
                            <option value="PUT">PUT</option>
                          </select>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label style={{ display: 'block', marginBottom: '16px', fontSize: '14px', fontWeight: 500 }}>РРЅС‚РµСЂРІР°Р» (СЃРµРє)</label>
                          <input
                            type="number"
                            min={5}
                            style={{ padding: '12px 16px', width: '100%', borderRadius: '8px', border: '1px solid hsl(var(--input))', background: 'hsl(var(--background))' }}
                            value={form.pollingInterval}
                            onChange={(e) => setForm({ ...form, pollingInterval: Number(e.target.value) })}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', marginBottom: '16px', fontSize: '14px', fontWeight: 500 }}>РўР°Р№РјР°СѓС‚ (СЃРµРє)</label>
                          <input
                            type="number"
                            min={1}
                            style={{ padding: '12px 16px', width: '100%', borderRadius: '8px', border: '1px solid hsl(var(--input))', background: 'hsl(var(--background))' }}
                            value={form.timeoutSec}
                            onChange={(e) => setForm({ ...form, timeoutSec: Number(e.target.value) })}
                          />
                        </div>
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '16px', fontSize: '14px', fontWeight: 500 }}>Headers (JSON)</label>
                        <textarea
                          rows={2}
                          style={{ padding: '12px 16px', width: '100%', borderRadius: '8px', border: '1px solid hsl(var(--input))', background: 'hsl(var(--background))', fontFamily: 'monospace', fontSize: '14px', resize: 'vertical' }}
                          value={form.pollingHeaders}
                          onChange={(e) => setForm({ ...form, pollingHeaders: e.target.value })}
                          placeholder='{"Authorization": "Bearer token"}'
                        />
                      </div>
                      {form.pollingMethod !== 'GET' && (
                        <div>
                          <label style={{ display: 'block', marginBottom: '16px', fontSize: '14px', fontWeight: 500 }}>Body (JSON)</label>
                          <textarea
                            rows={2}
                            style={{ padding: '12px 16px', width: '100%', borderRadius: '8px', border: '1px solid hsl(var(--input))', background: 'hsl(var(--background))', fontFamily: 'monospace', fontSize: '14px', resize: 'vertical' }}
                            value={form.pollingBody}
                            onChange={(e) => setForm({ ...form, pollingBody: e.target.value })}
                            placeholder='{"query": "status"}'
                          />
                        </div>
                      )}
                      <div>
                        <label style={{ display: 'block', marginBottom: '16px', fontSize: '14px', fontWeight: 500 }}>РЈСЃР»РѕРІРёРµ СЃСЂР°Р±Р°С‚С‹РІР°РЅРёСЏ</label>
                        <input
                          style={{ padding: '12px 16px', width: '100%', borderRadius: '8px', border: '1px solid hsl(var(--input))', background: 'hsl(var(--background))', fontFamily: 'monospace' }}
                          value={form.pollingCondition}
                          onChange={(e) => setForm({ ...form, pollingCondition: e.target.value })}
                          placeholder='response.status === "ready"'
                        />
                      </div>
                      <div>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={form.pollingContinueAfterMatch}
                            onChange={(e) => setForm({ ...form, pollingContinueAfterMatch: e.target.checked })}
                            style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                          />
                          РџСЂРѕРґРѕР»Р¶Р°С‚СЊ РїРѕСЃР»Рµ СЃРѕРІРїР°РґРµРЅРёСЏ
                        </label>
                      </div>
                    </>
                  )}

                  <div style={{ borderTop: '1px solid hsl(var(--border))', paddingTop: '20px' }}>
                    <h4 style={{ marginBottom: '16px', fontSize: '14px', fontWeight: 600 }}>рџљЂ Action (РІС‹Р·РѕРІ API)</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label style={{ display: 'block', marginBottom: '16px', fontSize: '14px', fontWeight: 500 }}>URL</label>
                        <input
                          style={{ padding: '12px 16px', width: '100%', borderRadius: '8px', border: '1px solid hsl(var(--input))', background: 'hsl(var(--background))' }}
                          value={form.actionUrl}
                          onChange={(e) => setForm({ ...form, actionUrl: e.target.value })}
                          placeholder="https://api.example.com/action"
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '16px', fontSize: '14px', fontWeight: 500 }}>РњРµС‚РѕРґ</label>
                        <select
                          style={{ padding: '12px 16px', width: '100%', borderRadius: '8px', border: '1px solid hsl(var(--input))', background: 'hsl(var(--background))' }}
                          value={form.actionMethod}
                          onChange={(e) => setForm({ ...form, actionMethod: e.target.value })}
                        >
                          <option value="GET">GET</option>
                          <option value="POST">POST</option>
                          <option value="PUT">PUT</option>
                          <option value="PATCH">PATCH</option>
                          <option value="DELETE">DELETE</option>
                        </select>
                      </div>
                    </div>
                    <div style={{ marginTop: '16px' }}>
                      <label style={{ display: 'block', marginBottom: '16px', fontSize: '14px', fontWeight: 500 }}>Headers (JSON)</label>
                      <textarea
                        rows={2}
                        style={{ padding: '12px 16px', width: '100%', borderRadius: '8px', border: '1px solid hsl(var(--input))', background: 'hsl(var(--background))', fontFamily: 'monospace', fontSize: '14px', resize: 'vertical' }}
                        value={form.actionHeaders}
                        onChange={(e) => setForm({ ...form, actionHeaders: e.target.value })}
                        placeholder='{"Authorization": "Bearer token", "X-Api-Key": "key"}'
                      />
                      <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
                        Р”РѕРїРѕР»РЅРёС‚РµР»СЊРЅС‹Рµ Р·Р°РіРѕР»РѕРІРєРё Р·Р°РїСЂРѕСЃР°. Content-Type РґРѕР±Р°РІР»СЏРµС‚СЃСЏ Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРё.
                      </p>
                    </div>
                    {form.actionMethod !== 'GET' && (
                      <div style={{ marginTop: '16px' }}>
                        <label style={{ display: 'block', marginBottom: '16px', fontSize: '14px', fontWeight: 500 }}>Body (JSON)</label>
                        <textarea
                          rows={3}
                          style={{ padding: '12px 16px', width: '100%', borderRadius: '8px', border: '1px solid hsl(var(--input))', background: 'hsl(var(--background))', fontFamily: 'monospace', fontSize: '14px', resize: 'vertical' }}
                          value={form.actionBody}
                          onChange={(e) => setForm({ ...form, actionBody: e.target.value })}
                          placeholder={'{"orderId": "{{payload.id}}"}'}
                        />
                        <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
                          РСЃРїРѕР»СЊР·СѓР№С‚Рµ <code>{'{{payload.field}}'}</code> РґР»СЏ РїРѕРґСЃС‚Р°РЅРѕРІРєРё РґР°РЅРЅС‹С…
                        </p>
                      </div>
                    )}
                  </div>

                  <div style={{ borderTop: '1px solid hsl(var(--border))', paddingTop: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                      <input
                        type="checkbox"
                        id="sendToTelegram"
                        checked={form.sendToTelegram}
                        onChange={(e) => setForm({ ...form, sendToTelegram: e.target.checked })}
                        style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                      />
                      <label htmlFor="sendToTelegram" style={{ fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
                        рџ“± Telegram СѓРІРµРґРѕРјР»РµРЅРёРµ
                      </label>
                    </div>
                    
                    {form.sendToTelegram && (
                      <div style={{ paddingLeft: '30px', opacity: form.sendToTelegram ? 1 : 0.5 }}>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label style={{ display: 'block', marginBottom: '16px', fontSize: '14px', fontWeight: 500 }}>Chat ID</label>
                            <input
                              style={{ padding: '12px 16px', width: '100%', borderRadius: '8px', border: '1px solid hsl(var(--input))', background: 'hsl(var(--background))' }}
                              value={form.chatId}
                              onChange={(e) => setForm({ ...form, chatId: e.target.value })}
                              placeholder="-1001234567890"
                            />
                          </div>
                          <div>
                            <label style={{ display: 'block', marginBottom: '16px', fontSize: '14px', fontWeight: 500 }}>Bot Token (РѕРїС†.)</label>
                            <input
                              style={{ padding: '12px 16px', width: '100%', borderRadius: '8px', border: '1px solid hsl(var(--input))', background: 'hsl(var(--background))' }}
                              value={form.botToken}
                              onChange={(e) => setForm({ ...form, botToken: e.target.value })}
                              placeholder="Р“Р»РѕР±Р°Р»СЊРЅС‹Р№ С‚РѕРєРµРЅ"
                            />
                          </div>
                        </div>
                        <div style={{ marginTop: '16px' }}>
                          <label style={{ display: 'flex', alignItems: 'center', marginBottom: '16px', fontSize: '14px', fontWeight: 500 }}>
                            РЁР°Р±Р»РѕРЅ СЃРѕРѕР±С‰РµРЅРёСЏ
                            <TemplateHelp context="integration" />
                          </label>
                          <textarea
                            rows={2}
                            style={{ padding: '12px 16px', width: '100%', borderRadius: '8px', border: '1px solid hsl(var(--input))', background: 'hsl(var(--background))', fontFamily: 'monospace', fontSize: '14px', resize: 'vertical' }}
                            value={form.messageTemplate}
                            onChange={(e) => setForm({ ...form, messageTemplate: e.target.value })}
                            placeholder="${payload.name} вЂ” ${payload.status}"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '4px' }}>
                    <input
                      type="checkbox"
                      id="enabled"
                      checked={form.enabled}
                      onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
                      style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                    />
                    <label htmlFor="enabled" style={{ cursor: 'pointer', fontSize: '14px', fontWeight: 500 }}>
                      Р’РєР»СЋС‡РµРЅР°
                    </label>
                  </div>

                  <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                    <button
                      type="submit"
                      style={{ flex: 1, padding: '14px 24px', borderRadius: '8px', background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))', fontWeight: 600, cursor: 'pointer', border: 'none' }}
                    >
                      РЎРѕС…СЂР°РЅРёС‚СЊ
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(null);
                        if (!selectedId) setForm(DEFAULT_FORM);
                      }}
                      style={{ flex: 1, padding: '14px 24px', borderRadius: '8px', background: 'hsl(var(--secondary))', color: 'hsl(var(--secondary-foreground))', fontWeight: 600, cursor: 'pointer', border: 'none' }}
                    >
                      РћС‚РјРµРЅР°
                    </button>
                  </div>
                </form>
              </>
            ) : selectedIntegration ? (
              <div>
                <div className="space-y-4">
                  <div>
                    <h4 className="mb-2 text-sm font-medium text-[hsl(var(--muted-foreground))]">РРЅС„РѕСЂРјР°С†РёСЏ РѕР± РёРЅС‚РµРіСЂР°С†РёРё</h4>
                    <div style={{ padding: '16px' }} className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))]">
                      <div style={{ marginBottom: '12px' }}>
                        <strong>ID:</strong> <code style={{ padding: '4px 8px', marginLeft: '8px' }} className="rounded bg-[hsl(var(--muted)_/_0.5)]">{selectedIntegration.id}</code>
                      </div>
                      <div style={{ marginBottom: '12px' }}>
                        <strong>РќР°Р·РІР°РЅРёРµ:</strong> {selectedIntegration.name}
                      </div>
                      <div style={{ marginBottom: '12px' }}>
                        <strong>РЎС‚Р°С‚СѓСЃ:</strong>{' '}
                        <span
                          style={{ padding: '4px 8px' }}
                          className={`rounded text-xs ${
                            selectedIntegration.enabled
                              ? 'bg-[hsl(var(--success)_/_0.15)] text-[hsl(var(--success))]'
                              : 'bg-[hsl(var(--destructive)_/_0.1)] text-[hsl(var(--destructive))]'
                          }`}
                        >
                          {selectedIntegration.enabled ? 'вњ… Р’РєР»СЋС‡РµРЅР°' : 'вЏёпёЏ РћС‚РєР»СЋС‡РµРЅР°'}
                        </span>
                      </div>
                      <div>
                        <strong>РўРёРї С‚СЂРёРіРіРµСЂР°:</strong>{' '}
                        <span style={{ padding: '4px 8px' }} className="rounded bg-[hsl(var(--muted)_/_0.5)] text-xs">
                          {selectedIntegration.triggerType === 'webhook' ? 'рџ“Ґ Webhook' : 'рџ”„ Polling'}
                        </span>
                      </div>
                    </div>
                  </div>

                {canEdit && (
                  <div>
                    <h4 className="mb-2 text-sm font-medium text-[hsl(var(--muted-foreground))]">Контроль статуса</h4>
                    <div style={{ padding: '16px' }} className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))]">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                        <Switch
                          id="integration-enabled-view"
                          checked={selectedIntegration.enabled}
                          disabled={togglingIntegrationId === selectedIntegration.id}
                          onCheckedChange={(checked) => {
                            if (checked !== selectedIntegration.enabled) handleToggleIntegrationEnabled(selectedIntegration);
                          }}
                          aria-label="Включено"
                        />
                        <label htmlFor="integration-enabled-view" style={{ cursor: 'pointer', fontSize: '28px', fontWeight: 700, lineHeight: 1 }}>
                          Enabled
                        </label>
                      </div>
                    </div>
                  </div>
                )}

                  {selectedIntegration.triggerType === 'webhook' ? (
                    selectedIntegration.triggerCondition && (
                      <div>
                        <h4 className="mb-2 text-sm font-medium text-[hsl(var(--muted-foreground))]">РЈСЃР»РѕРІРёРµ СЃСЂР°Р±Р°С‚С‹РІР°РЅРёСЏ</h4>
                        <div style={{ padding: '16px' }} className="overflow-x-auto rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted)_/_0.3)]">
                          <code className="block whitespace-pre-wrap break-words text-sm">{selectedIntegration.triggerCondition}</code>
                        </div>
                      </div>
                    )
                  ) : (
                    <div>
                      <h4 className="mb-2 text-sm font-medium text-[hsl(var(--muted-foreground))]">РќР°СЃС‚СЂРѕР№РєРё Polling</h4>
                      <div style={{ padding: '16px' }} className="space-y-3 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))]">
                        {selectedIntegration.pollingUrl && (
                          <div>
                            <strong>URL:</strong>{' '}
                            <code style={{ padding: '4px 8px', marginLeft: '8px' }} className="rounded bg-[hsl(var(--muted)_/_0.5)]">
                              {selectedIntegration.pollingMethod || 'GET'} {selectedIntegration.pollingUrl}
                            </code>
                          </div>
                        )}
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <strong>РРЅС‚РµСЂРІР°Р»:</strong>{' '}
                            <code style={{ padding: '4px 8px', marginLeft: '8px' }} className="rounded bg-[hsl(var(--muted)_/_0.5)]">{selectedIntegration.pollingInterval || 60}s</code>
                          </div>
                          <div>
                            <strong>РўР°Р№РјР°СѓС‚:</strong>{' '}
                            <code style={{ padding: '4px 8px', marginLeft: '8px' }} className="rounded bg-[hsl(var(--muted)_/_0.5)]">{selectedIntegration.timeoutSec || 30}s</code>
                          </div>
                        </div>
                        {selectedIntegration.pollingCondition && (
                          <div>
                            <strong>РЈСЃР»РѕРІРёРµ:</strong>
                            <div style={{ padding: '12px', marginTop: '8px' }} className="rounded-lg bg-[hsl(var(--muted)_/_0.3)]">
                              <code className="text-sm break-all">{selectedIntegration.pollingCondition}</code>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {selectedIntegration.actionUrl && (
                    <div>
                      <h4 className="mb-2 text-sm font-medium text-[hsl(var(--muted-foreground))]">рџљЂ Action (API)</h4>
                      <div style={{ padding: '16px' }} className="space-y-3 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))]">
                        <div>
                          <strong>URL:</strong>
                          <div style={{ padding: '12px', marginTop: '8px', wordBreak: 'break-word', overflowWrap: 'anywhere' }} className="rounded-lg bg-[hsl(var(--muted)_/_0.3)]">
                            <code style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }} className="text-sm">
                              {selectedIntegration.actionMethod || 'POST'} {selectedIntegration.actionUrl}
                            </code>
                          </div>
                        </div>
                        {selectedIntegration.actionHeaders && (
                          <div>
                            <strong>Headers:</strong>
                            <div style={{ padding: '12px', marginTop: '8px', wordBreak: 'break-word', overflowWrap: 'anywhere' }} className="rounded-lg bg-[hsl(var(--muted)_/_0.3)]">
                              <code style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }} className="text-sm">{selectedIntegration.actionHeaders}</code>
                            </div>
                          </div>
                        )}
                        {selectedIntegration.actionBody && (
                          <div>
                            <strong>Body:</strong>
                            <div style={{ padding: '12px', marginTop: '8px', wordBreak: 'break-word', overflowWrap: 'anywhere' }} className="rounded-lg bg-[hsl(var(--muted)_/_0.3)]">
                              <code style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }} className="text-sm">{selectedIntegration.actionBody}</code>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div>
                    <h4 className="mb-2 text-sm font-medium text-[hsl(var(--muted-foreground))]">рџ“± Telegram СѓРІРµРґРѕРјР»РµРЅРёРµ</h4>
                    <div style={{ padding: '16px' }} className="space-y-3 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))]">
                      <div>
                        <strong>РЎС‚Р°С‚СѓСЃ:</strong>{' '}
                        <span
                          style={{ padding: '4px 8px' }}
                          className={`rounded text-xs ${
                            selectedIntegration.sendToTelegram
                              ? 'bg-[hsl(var(--success)_/_0.15)] text-[hsl(var(--success))]'
                              : 'bg-[hsl(var(--muted)_/_0.3)] text-[hsl(var(--muted-foreground))]'
                          }`}
                        >
                          {selectedIntegration.sendToTelegram ? 'вњ… Р’РєР»СЋС‡РµРЅРѕ' : 'вЏёпёЏ РћС‚РєР»СЋС‡РµРЅРѕ'}
                        </span>
                      </div>
                      {selectedIntegration.sendToTelegram && (
                        <>
                          {selectedIntegration.chatId && (
                            <div>
                              <strong>Chat ID:</strong>{' '}
                              <code style={{ padding: '4px 8px', marginLeft: '8px' }} className="rounded bg-[hsl(var(--muted)_/_0.5)]">{selectedIntegration.chatId}</code>
                            </div>
                          )}
                          {selectedIntegration.botToken && (
                            <div>
                              <strong>Bot Token:</strong>{' '}
                              <code style={{ padding: '4px 8px', marginLeft: '8px' }} className="rounded bg-[hsl(var(--muted)_/_0.5)]">***РЅР°СЃС‚СЂРѕРµРЅ***</code>
                            </div>
                          )}
                          {selectedIntegration.messageTemplate && (
                            <div>
                              <strong>РЁР°Р±Р»РѕРЅ СЃРѕРѕР±С‰РµРЅРёСЏ:</strong>
                              <div style={{ padding: '16px', marginTop: '8px' }} className="whitespace-pre-wrap rounded-lg bg-[hsl(var(--muted)_/_0.3)] text-sm">
                                {selectedIntegration.messageTemplate}
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center text-[hsl(var(--muted-foreground))]">
                <p className="mb-4">Р’С‹Р±РµСЂРёС‚Рµ РёРЅС‚РµРіСЂР°С†РёСЋ РёР»Рё СЃРѕР·РґР°Р№С‚Рµ РЅРѕРІСѓСЋ</p>
                <button
                  onClick={handleStartCreate}
                  className="inline-flex items-center gap-2 rounded bg-[hsl(var(--primary))] px-4 py-2 font-semibold text-[hsl(var(--primary-foreground))]"
                >
                  <Plus className="h-4 w-4" />
                  РЎРѕР·РґР°С‚СЊ РёРЅС‚РµРіСЂР°С†РёСЋ
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
        title="Р­РєСЃРїРѕСЂС‚ РёРЅС‚РµРіСЂР°С†РёР№"
        description="Р’С‹Р±РµСЂРёС‚Рµ РёРЅС‚РµРіСЂР°С†РёРё РґР»СЏ СЌРєСЃРїРѕСЂС‚Р°"
        items={integrations.map((i) => ({ id: i.id, name: i.name, enabled: i.enabled }))}
        loading={loading}
        exportFileName="integrations-export.json"
        exportType="integrations"
        onExportSuccess={(count) => setMessage({ text: `Р­РєСЃРїРѕСЂС‚РёСЂРѕРІР°РЅРѕ РёРЅС‚РµРіСЂР°С†РёР№: ${count}`, type: 'success' })}
      />
    </div>
  );
}

