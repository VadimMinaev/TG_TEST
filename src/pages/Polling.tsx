import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { api, Poll } from '../lib/api';
import { useAuth } from '../lib/auth-context';
import { Copy, Download, Pencil, Play, Plus, RefreshCw, Trash2, Upload, Info } from 'lucide-react';
import { TemplateHelp } from '../components/TemplateHelp';
import { ExportModal } from '../components/ExportModal';
import { StatusRadio } from '../components/StatusRadio';
import { EntityStateSwitch } from '../components/StateToggle';
import { ToolbarToggle } from '../components/ToolbarToggle';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../components/ui/tooltip';
import { useToast } from '../components/ToastNotification';

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

const isDraftPoll = (poll: Partial<Poll>) =>
  !poll.enabled && (
    String(poll.name || '').toLowerCase().startsWith('черновик') ||
    String(poll.chatId || '').trim() === '0' ||
    String(poll.url || '').trim() === 'https://example.com/health'
  );

export function Polling() {
  const { user } = useAuth();
  const canEdit = user?.role !== 'auditor';
  const [searchParams, setSearchParams] = useSearchParams();
  const [polls, setPolls] = useState<Poll[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPollId, setSelectedPollId] = useState<number | null>(null);
  const [editingPollId, setEditingPollId] = useState<number | null>(null);
  const [form, setForm] = useState(DEFAULT_FORM);
  const { addToast } = useToast();
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [togglingPollId, setTogglingPollId] = useState<number | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  // РђРІС‚РѕРјР°С‚РёС‡РµСЃРєРё СЃРєСЂС‹РІР°С‚СЊ СѓРІРµРґРѕРјР»РµРЅРёРµ С‡РµСЂРµР· 4 СЃРµРєСѓРЅРґС‹

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
      addToast(error.message || 'РќРµ СѓРґР°Р»РѕСЃСЊ Р·Р°РіСЂСѓР·РёС‚СЊ РїСѓР»Р»РёРЅРі', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPolls();
  }, []);

  // РџСЂРѕРІРµСЂСЏРµРј РїР°СЂР°РјРµС‚СЂС‹ create Рё select РІ URL
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
    // Clear message is no longer needed with toast system

    // Basic validation - name, URL and chatId are always required
    if (!form.name || !form.url || !form.chatId) {
      addToast('РЈРєР°Р¶РёС‚Рµ РЅР°Р·РІР°РЅРёРµ, URL Рё Chat ID', 'error');
      return;
    }

    // If Telegram notification is enabled (both chatId and botToken are present), validate them
    // If only one of them is present, it's an error
    if (!!form.chatId !== !!form.botToken) {
      addToast('Р”Р»СЏ Telegram СѓРІРµРґРѕРјР»РµРЅРёСЏ СѓРєР°Р¶РёС‚Рµ Рё Chat ID, Рё Bot Token', 'error');
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
        addToast('РџСѓР»Р»РёРЅРі РѕР±РЅРѕРІР»С‘РЅ', 'success');
        // РџРµСЂРµР·Р°РіСЂСѓР¶Р°РµРј СЃРїРёСЃРѕРє РґР»СЏ СЃРёРЅС…СЂРѕРЅРёР·Р°С†РёРё
        await loadPolls();
      } else {
        const created = await api.createPoll(payload);
        setEditingPollId(null);
        setSelectedPollId(created.id);
        addToast('РџСѓР»Р»РёРЅРі СЃРѕР·РґР°РЅ', 'success');
        // РџРµСЂРµР·Р°РіСЂСѓР¶Р°РµРј СЃРїРёСЃРѕРє РґР»СЏ СЃРёРЅС…СЂРѕРЅРёР·Р°С†РёРё
        await loadPolls();
      }
    } catch (error: any) {
      addToast(error.message || 'РќРµ СѓРґР°Р»РѕСЃСЊ СЃРѕС…СЂР°РЅРёС‚СЊ РїСѓР»Р»РёРЅРі', 'error');
    }
  };

  const handleDuplicatePoll = async (poll: Poll) => {
    try {
      const copyPayload = {
        ...normalizeForm(poll),
        name: `${poll.name} (РєРѕРїРёСЏ)`,
        enabled: false,
      };
      const created = await api.createPoll(copyPayload);
      setPolls((prev) => [created, ...prev]);
      setSelectedPollId(created.id);
        addToast('РџСѓР»Р»РёРЅРі РїСЂРѕРґСѓР±Р»РёСЂРѕРІР°РЅ', 'success');
    } catch (error: any) {
      addToast(error.message || 'РќРµ СѓРґР°Р»РѕСЃСЊ РґСѓР±Р»РёСЂРѕРІР°С‚СЊ РїСѓР»Р»РёРЅРі', 'error');
    }
  };

  const handleDeletePoll = async (poll: Poll) => {
    if (!confirm(`РЈРґР°Р»РёС‚СЊ РїСѓР»Р»РёРЅРі "${poll.name}"?`)) return;
    try {
      await api.deletePoll(poll.id);
      setPolls((prev) => prev.filter((p) => p.id !== poll.id));
      if (selectedPollId === poll.id) {
        setSelectedPollId(null);
        setEditingPollId(null);
      }
      addToast('РџСѓР»Р»РёРЅРі СѓРґР°Р»С‘РЅ', 'success');
    } catch (error: any) {
      addToast(error.message || 'РќРµ СѓРґР°Р»РѕСЃСЊ СѓРґР°Р»РёС‚СЊ РїСѓР»Р»РёРЅРі', 'error');
    }
  };

  const handleRunPoll = async (poll: Poll) => {
    try {
      await api.runPoll(poll.id);
      addToast('Р—Р°РїСѓСЃРє РІС‹РїРѕР»РЅРµРЅ', 'success');
    } catch (error: any) {
      addToast(error.message || 'РќРµ СѓРґР°Р»РѕСЃСЊ Р·Р°РїСѓСЃС‚РёС‚СЊ РїСѓР»Р»РёРЅРі', 'error');
    }
  };

  const handleTogglePollEnabled = async (poll: Poll) => {
    const nextEnabled = !poll.enabled;
    try {
      setTogglingPollId(poll.id);
      const updated = await api.updatePoll(poll.id, { enabled: nextEnabled });
      const mergedUpdated = { ...poll, ...updated, id: poll.id };
      setPolls((prev) => prev.map((p) => (p.id === poll.id ? mergedUpdated : p)));
      addToast(nextEnabled ? 'РџСѓР»Р»РёРЅРі РІРєР»СЋС‡РµРЅ' : 'РџСѓР»Р»РёРЅРі РІС‹РєР»СЋС‡РµРЅ', 'success');
    } catch (error: any) {
      addToast(error.message || 'РќРµ СѓРґР°Р»РѕСЃСЊ РѕР±РЅРѕРІРёС‚СЊ СЃС‚Р°С‚СѓСЃ РїСѓР»Р»РёРЅРіР°', 'error');
    } finally {
      setTogglingPollId(null);
    }
  };

  const normalizeImportedPoll = (raw: any, index: number): { payload: Partial<Poll>; drafted: boolean } => {
    const name = String(raw.name ?? '').trim();
    const url = String(raw.url ?? '').trim();
    const chatId = String(raw.chatId ?? '').trim();
    const drafted = !name || !url || !chatId;
    return {
      payload: {
        name: name || `Черновик пулинга ${index + 1}`,
        url: url || 'https://example.com/health',
        method: raw.method || 'GET',
        headersJson: raw.headersJson != null ? String(raw.headersJson) : undefined,
        bodyJson: raw.bodyJson != null ? String(raw.bodyJson) : undefined,
        conditionJson: raw.conditionJson != null ? String(raw.conditionJson) : undefined,
        intervalSec: Number(raw.intervalSec) || 60,
        timeoutSec: Number(raw.timeoutSec) || 10,
        chatId: chatId || '0',
        botToken: raw.botToken ? String(raw.botToken).trim() : undefined,
        messageTemplate: raw.messageTemplate ? String(raw.messageTemplate) : undefined,
        enabled: drafted ? false : (raw.enabled ?? true),
        onlyOnChange: raw.onlyOnChange ?? false,
        continueAfterMatch: raw.continueAfterMatch ?? false,
      },
      drafted,
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
      if (!items.length) throw new Error('Р¤Р°Р№Р» РЅРµ СЃРѕРґРµСЂР¶РёС‚ РїСѓР»Р»РёРЅРіРѕРІ');

      let created = 0;
      let failed = 0;
      let draftedCount = 0;
      let lastError = '';
      for (const [index, item] of items.entries()) {
        const { payload, drafted } = normalizeImportedPoll(item, index);
        if (drafted) draftedCount += 1;
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
          ? draftedCount > 0
            ? `Импортировано пулингов: ${created}, черновиков: ${draftedCount}`
            : `Импортировано пулингов: ${created}`
          : lastError
            ? `Импортировано: ${created}, черновиков: ${draftedCount}, ошибок: ${failed}. Причина: ${lastError}`
            : `Импортировано: ${created}, черновиков: ${draftedCount}, ошибок: ${failed}`;
      addToast(messageText, failed === 0 ? 'success' : 'info');
    } catch (error: any) {
      addToast(error.message || 'РћС€РёР±РєР° РёРјРїРѕСЂС‚Р° РїСѓР»Р»РёРЅРіРѕРІ', 'error');
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
        <h2 className="text-xl font-semibold">рџ”Ѓ РџСѓР»Р»РёРЅРі</h2>
        <div className="flex items-center gap-2">
          {canEdit && selectedPoll && !editingPollId && (
            <>
              <button
                onClick={() => handleRunPoll(selectedPoll)}
                className="icon-button text-[hsl(var(--success))] hover:bg-[hsl(var(--success)_/_0.1)]"
                title="Р—Р°РїСѓСЃС‚РёС‚СЊ"
              >
                <Play className="h-4 w-4" />
              </button>
              <button
                onClick={() => handleEditPoll(selectedPoll)}
                className="icon-button"
                title="Р РµРґР°РєС‚РёСЂРѕРІР°С‚СЊ"
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                onClick={() => handleDuplicatePoll(selectedPoll)}
                className="icon-button"
                title="Р”СѓР±Р»РёСЂРѕРІР°С‚СЊ"
              >
                <Copy className="h-4 w-4" />
              </button>
              <button
                onClick={() => handleDeletePoll(selectedPoll)}
                className="icon-button text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive)_/_0.1)]"
                title="РЈРґР°Р»РёС‚СЊ"
              >
                <Trash2 className="h-4 w-4" />
              </button>
              <ToolbarToggle
                enabled={polls.find(p => p.id === selectedPollId)?.enabled ?? false}
                onChange={() => {
                  const poll = polls.find(p => p.id === selectedPollId);
                  if (poll) handleTogglePollEnabled(poll);
                }}
                title={polls.find(p => p.id === selectedPollId)?.enabled ? 'Р’С‹РєР»СЋС‡РёС‚СЊ РїСѓР»Р»РёРЅРі' : 'Р’РєР»СЋС‡РёС‚СЊ РїСѓР»Р»РёРЅРі'}
              />
              <div className="mx-1 h-6 w-px bg-[hsl(var(--border))]" />
            </>
          )}
          <button
            onClick={() => loadPolls()}
            className="icon-button"
            title="РћР±РЅРѕРІРёС‚СЊ СЃРїРёСЃРѕРє"
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
                title="РРјРїРѕСЂС‚ РїСѓР»Р»РёРЅРіРѕРІ"
              >
                <Upload className="h-4 w-4" />
              </button>
              <button
                onClick={() => setExportModalOpen(true)}
                className="icon-button"
                title="Р­РєСЃРїРѕСЂС‚ РїСѓР»Р»РёРЅРіРѕРІ"
              >
                <Download className="h-4 w-4" />
              </button>
              <button
                onClick={handleStartCreate}
                className="icon-button"
                title="РЎРѕР·РґР°С‚СЊ РїСѓР»Р»РёРЅРі"
              >
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
              <h3 className="text-sm font-semibold">рџ“‹ РЎРїРёСЃРѕРє Р·Р°РґР°С‡</h3>
              <button
                onClick={() => loadPolls()}
                className="rounded border border-[hsl(var(--border))] px-2 py-1 text-xs"
              >
                РћР±РЅРѕРІРёС‚СЊ
              </button>
            </div>
            {loading ? (
              <div className="flex items-center justify-center py-10">
                <div className="h-6 w-6 animate-spin rounded-full border-4 border-[hsl(var(--primary))] border-t-transparent" />
              </div>
            ) : polls.length === 0 ? (
              <p className="py-10 text-center text-sm text-[hsl(var(--muted-foreground))]">Р—Р°РґР°С‡Рё РЅРµ РЅР°Р№РґРµРЅС‹</p>
            ) : (
              <div className="entity-list-scroll scrollbar-thin">
                <table className="table-basic w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-[hsl(var(--border))] text-left text-xs">
                      <th className="px-2 py-2">РќР°Р·РІР°РЅРёРµ</th>
                      <th className="px-2 py-2">РРЅС‚РµСЂРІР°Р»</th>
                      <th className="px-2 py-2">РЎС‚Р°С‚СѓСЃ</th>
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
                        <td className="px-2 py-2 font-medium">
                          <span className="inline-flex items-center gap-2">
                            <span>{poll.name}</span>
                            {isDraftPoll(poll) && (
                              <span className="rounded-full bg-[hsl(var(--muted))] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                                Черновик
                              </span>
                            )}
                          </span>
                        </td>
                        <td className="px-2 py-2">{poll.intervalSec}s</td>
                        <td className="px-2 py-2">{poll.enabled ? 'вњ… Р’РєР»' : 'вЏёпёЏ Р’С‹РєР»'}</td>
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
            <div className="panel entity-edit-panel">
              <h3 className="mb-4 text-lg font-semibold">
                {editingPollId === -1 ? 'РЎРѕР·РґР°РЅРёРµ Р·Р°РґР°С‡Рё' : 'Р РµРґР°РєС‚РёСЂРѕРІР°РЅРёРµ Р·Р°РґР°С‡Рё'}
              </h3>
              <form className="entity-edit-form" onSubmit={handleSavePoll} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div className="grid grid-cols-2 gap-4">
                <div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', fontSize: '14px', fontWeight: 500 }}>РќР°Р·РІР°РЅРёРµ
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
                        <TooltipContent side="top" className="max-w-xs text-left">
                          <div className="space-y-2">
                            <p>РЈРЅРёРєР°Р»СЊРЅРѕРµ РёРјСЏ РґР»СЏ РёРґРµРЅС‚РёС„РёРєР°С†РёРё РїСѓР»Р»РёРЅРіР° РІ СЃРїРёСЃРєРµ.</p>
                            <p>Р РµРєРѕРјРµРЅРґСѓРµС‚СЃСЏ РёСЃРїРѕР»СЊР·РѕРІР°С‚СЊ РїРѕРЅСЏС‚РЅС‹Рµ РЅР°Р·РІР°РЅРёСЏ, РЅР°РїСЂРёРјРµСЂ: В«РџСЂРѕРІРµСЂРєР° СЃС‚Р°С‚СѓСЃР° Р·Р°РєР°Р·Р°В» РёР»Рё В«РњРѕРЅРёС‚РѕСЂРёРЅРі СЃРµСЂРІРµСЂР°В».</p>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    </label>
                  <input
                      style={{ padding: '12px 16px', width: '100%', borderRadius: '8px', border: '1px solid hsl(var(--input))', background: 'hsl(var(--background))' }}
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="РќР°РїСЂРёРјРµСЂ: РџСЂРѕРІРµСЂРєР° СЃС‚Р°С‚СѓСЃР° Р·Р°РєР°Р·Р°"
                  />
                </div>
                <div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', fontSize: '14px', fontWeight: 500 }}>URL
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
                        <TooltipContent side="top" className="max-w-xs text-left">
                          <div className="space-y-2">
                            <p>РђРґСЂРµСЃ API, РєРѕС‚РѕСЂС‹Р№ Р±СѓРґРµС‚ РѕРїСЂР°С€РёРІР°С‚СЊСЃСЏ РїРѕ Р·Р°РґР°РЅРЅРѕРјСѓ РёРЅС‚РµСЂРІР°Р»Сѓ.</p>
                            <p>РџРѕРґРґРµСЂР¶РёРІР°СЋС‚СЃСЏ HTTP Рё HTTPS РїСЂРѕС‚РѕРєРѕР»С‹.</p>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    </label>
                  <input
                      style={{ padding: '12px 16px', width: '100%', borderRadius: '8px', border: '1px solid hsl(var(--input))', background: 'hsl(var(--background))' }}
                    value={form.url}
                    onChange={(e) => setForm({ ...form, url: e.target.value })}
                    placeholder="https://api.example.com/status"
                  />
                </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                <div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', fontSize: '14px', fontWeight: 500 }}>РњРµС‚РѕРґ
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
                        <TooltipContent side="top" className="max-w-xs text-left">
                          <div className="space-y-2">
                            <p>HTTP РјРµС‚РѕРґ РґР»СЏ Р·Р°РїСЂРѕСЃР° Рє API.</p>
                            <p><strong>GET:</strong> РґР»СЏ РїРѕР»СѓС‡РµРЅРёСЏ РґР°РЅРЅС‹С…</p>
                            <p><strong>POST:</strong> РґР»СЏ РѕС‚РїСЂР°РІРєРё РґР°РЅРЅС‹С…</p>
                            <p><strong>PUT/PATCH:</strong> РґР»СЏ РѕР±РЅРѕРІР»РµРЅРёСЏ РґР°РЅРЅС‹С…</p>
                            <p><strong>DELETE:</strong> РґР»СЏ СѓРґР°Р»РµРЅРёСЏ РґР°РЅРЅС‹С…</p>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    </label>
                  <select
                      style={{ padding: '12px 16px', width: '100%', borderRadius: '8px', border: '1px solid hsl(var(--input))', background: 'hsl(var(--background))' }}
                    value={form.method}
                    onChange={(e) => setForm({ ...form, method: e.target.value })}
                  >
                    <option value="GET">GET</option>
                    <option value="POST">POST</option>
                    <option value="PUT">PUT</option>
                    <option value="PATCH">PATCH</option>
                    <option value="DELETE">DELETE</option>
                  </select>
                </div>
                <div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', fontSize: '14px', fontWeight: 500 }}>Chat ID
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
                        <TooltipContent side="top" className="max-w-xs text-left">
                          <div className="space-y-2">
                            <p>Р§РёСЃР»РѕРІРѕР№ РёРґРµРЅС‚РёС„РёРєР°С‚РѕСЂ С‡Р°С‚Р°/РєР°РЅР°Р»Р° РІ Telegram.</p>
                            <p><strong>РљР°Рє РїРѕР»СѓС‡РёС‚СЊ:</strong></p>
                            <ul className="list-disc list-inside">
                              <li>Р”РѕР±Р°РІСЊС‚Рµ Р±РѕС‚Р° <code className="rounded bg-[hsl(var(--muted))] px-1">@userinfobot</code> РІ С‡Р°С‚</li>
                              <li>РР»Рё РїРµСЂРµС€Р»РёС‚Рµ СЃРѕРѕР±С‰РµРЅРёРµ Р±РѕС‚Сѓ <code className="rounded bg-[hsl(var(--muted))] px-1">@getmyid_bot</code></li>
                            </ul>
                            <p><strong>Р¤РѕСЂРјР°С‚:</strong> РґР»СЏ РіСЂСѓРїРї/РєР°РЅР°Р»РѕРІ ID РЅР°С‡РёРЅР°РµС‚СЃСЏ СЃ <code className="rounded bg-[hsl(var(--muted))] px-1">-100</code></p>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    </label>
                  <input
                      style={{ padding: '12px 16px', width: '100%', borderRadius: '8px', border: '1px solid hsl(var(--input))', background: 'hsl(var(--background))' }}
                    value={form.chatId}
                    onChange={(e) => setForm({ ...form, chatId: e.target.value })}
                    placeholder="-1001234567890"
                  />
                </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                <div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', fontSize: '14px', fontWeight: 500 }}>РРЅС‚РµСЂРІР°Р» (СЃРµРє)
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
                        <TooltipContent side="top" className="max-w-xs text-left">
                          <div className="space-y-2">
                            <p>РРЅС‚РµСЂРІР°Р» РјРµР¶РґСѓ Р·Р°РїСЂРѕСЃР°РјРё Рє API РІ СЃРµРєСѓРЅРґР°С….</p>
                            <p><strong>РњРёРЅРёРјР°Р»СЊРЅРѕРµ Р·РЅР°С‡РµРЅРёРµ:</strong> 5 СЃРµРєСѓРЅРґ</p>
                            <p>Р‘РѕР»СЊС€РµРµ Р·РЅР°С‡РµРЅРёРµ СЌРєРѕРЅРѕРјРёС‚ СЂРµСЃСѓСЂСЃС‹, РјРµРЅСЊС€РµРµ - РѕР±РµСЃРїРµС‡РёРІР°РµС‚ Р±РѕР»РµРµ С‡Р°СЃС‚РѕРµ РѕР±РЅРѕРІР»РµРЅРёРµ РґР°РЅРЅС‹С….</p>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    </label>
                  <input
                    type="number"
                    min={5}
                      style={{ padding: '12px 16px', width: '100%', borderRadius: '8px', border: '1px solid hsl(var(--input))', background: 'hsl(var(--background))' }}
                    value={form.intervalSec}
                    onChange={(e) => setForm({ ...form, intervalSec: Number(e.target.value) })}
                  />
                </div>
                <div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', fontSize: '14px', fontWeight: 500 }}>РўР°Р№РјР°СѓС‚ (СЃРµРє)
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
                        <TooltipContent side="top" className="max-w-xs text-left">
                          <div className="space-y-2">
                            <p>Р’СЂРµРјСЏ РѕР¶РёРґР°РЅРёСЏ РѕС‚РІРµС‚Р° РѕС‚ API РІ СЃРµРєСѓРЅРґР°С….</p>
                            <p><strong>РњРёРЅРёРјР°Р»СЊРЅРѕРµ Р·РЅР°С‡РµРЅРёРµ:</strong> 3 СЃРµРєСѓРЅРґС‹</p>
                            <p>Р•СЃР»Рё API РЅРµ РѕС‚РІРµС‡Р°РµС‚ РІ С‚РµС‡РµРЅРёРµ СЌС‚РѕРіРѕ РІСЂРµРјРµРЅРё, Р·Р°РїСЂРѕСЃ СЃС‡РёС‚Р°РµС‚СЃСЏ РЅРµСѓРґР°С‡РЅС‹Рј.</p>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    </label>
                  <input
                    type="number"
                    min={3}
                      style={{ padding: '12px 16px', width: '100%', borderRadius: '8px', border: '1px solid hsl(var(--input))', background: 'hsl(var(--background))' }}
                    value={form.timeoutSec}
                    onChange={(e) => setForm({ ...form, timeoutSec: Number(e.target.value) })}
                  />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', fontSize: '14px', fontWeight: 500 }}>Headers (JSON)
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
                      <TooltipContent side="top" className="max-w-xs text-left">
                        <div className="space-y-2">
                          <p>Р—Р°РіРѕР»РѕРІРєРё HTTP Р·Р°РїСЂРѕСЃР° РІ С„РѕСЂРјР°С‚Рµ JSON.</p>
                          <p>РСЃРїРѕР»СЊР·СѓСЋС‚СЃСЏ РґР»СЏ Р°РІС‚РѕСЂРёР·Р°С†РёРё Рё РїРµСЂРµРґР°С‡Рё РјРµС‚Р°РґР°РЅРЅС‹С….</p>
                          <p><strong>РџСЂРёРјРµСЂ:</strong></p>
                          <pre className="bg-[hsl(var(--muted))] p-2 rounded text-xs overflow-x-auto">
                            {"{\n  \"Authorization\": \"Bearer your_token_here\",\n  \"Content-Type\": \"application/json\"\n}"}
                          </pre>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  </label>
                  <textarea
                    rows={3}
                    style={{ padding: '12px 16px', width: '100%', borderRadius: '8px', border: '1px solid hsl(var(--input))', background: 'hsl(var(--background))', fontFamily: 'monospace', fontSize: '14px', resize: 'vertical' }}
                    value={form.headersJson}
                    onChange={(e) => setForm({ ...form, headersJson: e.target.value })}
                    placeholder='{"Authorization": "Bearer token"}'
                  />
                  <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
                    РџСЂРёРјРµСЂ: <code>{'{"Authorization":"Bearer <TOKEN>","Content-Type":"application/json"}'}</code>
                  </p>
                </div>

                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', fontSize: '14px', fontWeight: 500 }}>Body (JSON)
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
                      <TooltipContent side="top" className="max-w-xs text-left">
                        <div className="space-y-2">
                          <p>РўРµР»Рѕ HTTP Р·Р°РїСЂРѕСЃР° РІ С„РѕСЂРјР°С‚Рµ JSON.</p>
                          <p>РСЃРїРѕР»СЊР·СѓРµС‚СЃСЏ РґР»СЏ РїРµСЂРµРґР°С‡Рё РґР°РЅРЅС‹С… РІ POST/PUT/PATCH Р·Р°РїСЂРѕСЃР°С….</p>
                          <p><strong>РџСЂРёРјРµСЂ:</strong></p>
                          <pre className="bg-[hsl(var(--muted))] p-2 rounded text-xs overflow-x-auto">
                            {"{\n  \"query\": \"status\",\n  \"filters\": {\n    \"active\": true\n  }\n}"}
                          </pre>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  </label>
                  <textarea
                    rows={3}
                    style={{ padding: '12px 16px', width: '100%', borderRadius: '8px', border: '1px solid hsl(var(--input))', background: 'hsl(var(--background))', fontFamily: 'monospace', fontSize: '14px', resize: 'vertical' }}
                    value={form.bodyJson}
                    onChange={(e) => setForm({ ...form, bodyJson: e.target.value })}
                    placeholder='{"id": 123}'
                  />
                </div>

                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', fontSize: '14px', fontWeight: 500 }}>РЈСЃР»РѕРІРёСЏ (JSON)
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
                      <TooltipContent side="top" className="max-w-xs text-left">
                        <div className="space-y-2">
                          <p>РЈСЃР»РѕРІРёСЏ РґР»СЏ РїСЂРѕРІРµСЂРєРё РѕС‚РІРµС‚Р° API РІ С„РѕСЂРјР°С‚Рµ JSON.</p>
                          <p>РџСѓР»Р»РёРЅРі СЃСЂР°Р±РѕС‚Р°РµС‚, РєРѕРіРґР° СѓСЃР»РѕРІРёСЏ Р±СѓРґСѓС‚ РІС‹РїРѕР»РЅРµРЅС‹.</p>
                          <p><strong>РџРѕР»СЏ:</strong></p>
                          <ul className="list-disc list-inside text-xs">
                            <li><code>logic</code> вЂ” Р»РѕРіРёС‡РµСЃРєРёР№ РѕРїРµСЂР°С‚РѕСЂ (AND/OR)</li>
                            <li><code>conditions</code> вЂ” РјР°СЃСЃРёРІ СѓСЃР»РѕРІРёР№ РїСЂРѕРІРµСЂРєРё</li>
                            <li><code>path</code> вЂ” РїСѓС‚СЊ Рє Р·РЅР°С‡РµРЅРёСЋ РІ РѕС‚РІРµС‚Рµ</li>
                            <li><code>op</code> вЂ” РѕРїРµСЂР°С‚РѕСЂ СЃСЂР°РІРЅРµРЅРёСЏ (==, !=, &gt;, &lt;, &gt;=, &lt;=, includes, exists)</li>
                            <li><code>value</code> вЂ” Р·РЅР°С‡РµРЅРёРµ РґР»СЏ СЃСЂР°РІРЅРµРЅРёСЏ</li>
                          </ul>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  </label>
                  <textarea
                    rows={4}
                    style={{ padding: '12px 16px', width: '100%', borderRadius: '8px', border: '1px solid hsl(var(--input))', background: 'hsl(var(--background))', fontFamily: 'monospace', fontSize: '14px', resize: 'vertical' }}
                    value={form.conditionJson}
                    onChange={(e) => setForm({ ...form, conditionJson: e.target.value })}
                    placeholder='{"logic":"AND","conditions":[{"path":"data.status","op":"==","value":"ok"}]}'
                  />
                  <div style={{ padding: '12px 16px', marginTop: '8px' }} className="rounded-lg border border-[hsl(var(--border)_/_0.6)] bg-[hsl(var(--muted)_/_0.2)] text-xs">
                    <div className="mb-1 font-semibold">РџСЂРёРјРµСЂ:</div>
                    <pre className="whitespace-pre-wrap">{`{"logic":"AND","conditions":[{"path":"data.status","op":"==","value":"ok"},{"path":"data.priority","op":">=","value":3}]}`}</pre>
                    <div className="mt-2 text-[hsl(var(--muted-foreground))]">
                      <code>logic</code> вЂ” AND/OR. <code>conditions</code> вЂ” РјР°СЃСЃРёРІ РїСЂРѕРІРµСЂРѕРє. <code>path</code> вЂ” РїСѓС‚СЊ Рє
                      РїРѕР»СЋ. <code>op</code> вЂ” РѕРїРµСЂР°С‚РѕСЂ (==, !=, &gt;, &lt;, &gt;=, &lt;=, includes, exists).
                    </div>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'flex', alignItems: 'center', marginBottom: '16px', fontSize: '14px', fontWeight: 500 }}>
                    РЁР°Р±Р»РѕРЅ СЃРѕРѕР±С‰РµРЅРёСЏ (РѕРїС†РёРѕРЅР°Р»СЊРЅРѕ)
                    <TemplateHelp context="poll" />
                  </label>
                  <textarea
                    rows={3}
                    style={{ padding: '12px 16px', width: '100%', borderRadius: '8px', border: '1px solid hsl(var(--input))', background: 'hsl(var(--background))', fontFamily: 'monospace', fontSize: '14px', resize: 'vertical' }}
                    value={form.messageTemplate}
                    onChange={(e) => setForm({ ...form, messageTemplate: e.target.value })}
                    placeholder="${payload.name} вЂ” ${payload.status}"
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginTop: '4px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', cursor: 'pointer' }}>
                    <EntityStateSwitch
                      idPrefix="poll-edit"
                      enabled={form.enabled}
                      onChange={(nextEnabled) => setForm({ ...form, enabled: nextEnabled })}
                    />
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={form.onlyOnChange}
                      onChange={(e) => setForm({ ...form, onlyOnChange: e.target.checked })}
                      style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                    />
                    РўРѕР»СЊРєРѕ РїСЂРё РёР·РјРµРЅРµРЅРёРё
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
                        <TooltipContent side="top" className="max-w-xs text-left">
                          <div className="space-y-2">
                            <p>РћС‚РїСЂР°РІР»СЏС‚СЊ СѓРІРµРґРѕРјР»РµРЅРёРµ С‚РѕР»СЊРєРѕ РїСЂРё РёР·РјРµРЅРµРЅРёРё РґР°РЅРЅС‹С….</p>
                            <p>Р•СЃР»Рё РІРєР»СЋС‡РµРЅРѕ, СѓРІРµРґРѕРјР»РµРЅРёРµ Р±СѓРґРµС‚ РѕС‚РїСЂР°РІР»РµРЅРѕ С‚РѕР»СЊРєРѕ РїСЂРё РёР·РјРµРЅРµРЅРёРё Р·РЅР°С‡РµРЅРёСЏ РІ РѕС‚РІРµС‚Рµ API.</p>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={form.continueAfterMatch}
                      onChange={(e) => setForm({ ...form, continueAfterMatch: e.target.checked })}
                      style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                    />
                    РџСЂРѕРґРѕР»Р¶Р°С‚СЊ РїРѕСЃР»Рµ СЃРѕРІРїР°РґРµРЅРёСЏ
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
                        <TooltipContent side="top" className="max-w-xs text-left">
                          <div className="space-y-2">
                            <p>РџСЂРѕРґРѕР»Р¶Р°С‚СЊ РІС‹РїРѕР»РЅРµРЅРёРµ РїСѓР»Р»РёРЅРіР° РїРѕСЃР»Рµ СЃСЂР°Р±Р°С‚С‹РІР°РЅРёСЏ.</p>
                            <p>Р•СЃР»Рё РІС‹РєР»СЋС‡РµРЅРѕ, РїСѓР»Р»РёРЅРі РѕСЃС‚Р°РЅРѕРІРёС‚СЃСЏ РїРѕСЃР»Рµ РїРµСЂРІРѕРіРѕ СЃРѕРІРїР°РґРµРЅРёСЏ.</p>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </label>
                </div>

                <div style={{ borderTop: '1px solid hsl(var(--border))', paddingTop: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                    <input
                      type="checkbox"
                      id="sendToTelegram"
                      checked={!!form.botToken}
                      onChange={(e) => {
                        if (!e.target.checked) {
                          setForm({ ...form, botToken: '' });
                        } else {
                          setForm({ ...form, botToken: form.botToken || '' });
                        }
                      }}
                      style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                    />
                    <label htmlFor="sendToTelegram" style={{ fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
                      рџ“± Telegram СѓРІРµРґРѕРјР»РµРЅРёРµ
                    </label>
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
                        <TooltipContent side="top" className="max-w-xs text-left">
                          <div className="space-y-2">
                            <p>Р’РєР»СЋС‡РёС‚СЊ РѕС‚РїСЂР°РІРєСѓ СѓРІРµРґРѕРјР»РµРЅРёР№ РІ Telegram.</p>
                            <p>Р”Р»СЏ СЂР°Р±РѕС‚С‹ СѓРІРµРґРѕРјР»РµРЅРёР№ СѓРєР°Р¶РёС‚Рµ Bot Token. Chat ID Р±РµСЂРµС‚СЃСЏ РёР· РѕСЃРЅРѕРІРЅС‹С… РЅР°СЃС‚СЂРѕРµРє.</p>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>

                  {!!form.botToken && (
                    <div style={{ paddingLeft: '30px', opacity: 1 }}>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', fontSize: '14px', fontWeight: 500 }}>Chat ID
                          <TooltipProvider delayDuration={200}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  type="button"
                                  className="ml-1.5 flex h-6 w-6 items-center justify-center rounded-full text-[hsl(var(--muted-foreground))] transition-colors hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--accent-foreground))]"
                                  aria-label="РџРѕРєР°Р·Р°С‚СЊ РїРѕРґСЃРєР°Р·РєСѓ"
                                >
                                  <Info className="h-4 w-4" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-xs text-left">
                                <div className="space-y-2">
                                  <p>Р§РёСЃР»РѕРІРѕР№ РёРґРµРЅС‚РёС„РёРєР°С‚РѕСЂ С‡Р°С‚Р°/РєР°РЅР°Р»Р° РІ Telegram (Р±РµСЂРµС‚СЃСЏ РёР· РѕСЃРЅРѕРІРЅС‹С… РЅР°СЃС‚СЂРѕРµРє).</p>
                                  <p>РСЃРїРѕР»СЊР·СѓРµС‚СЃСЏ РґР»СЏ РѕС‚РїСЂР°РІРєРё СѓРІРµРґРѕРјР»РµРЅРёР№ РїСЂРё СЃСЂР°Р±Р°С‚С‹РІР°РЅРёРё РїСѓР»Р»РёРЅРіР°.</p>
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          </label>
                          <input
                            style={{ padding: '12px 16px', width: '100%', borderRadius: '8px', border: '1px solid hsl(var(--input))', background: 'hsl(var(--background))' }}
                            value={form.chatId}
                            onChange={(e) => setForm({ ...form, chatId: e.target.value })}
                            placeholder="-1001234567890"
                          />
                        </div>
                        <div>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', fontSize: '14px', fontWeight: 500 }}>Bot Token
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
                              <TooltipContent side="top" className="max-w-xs text-left">
                                <div className="space-y-2">
                                  <p>РўРѕРєРµРЅ Telegram Р±РѕС‚Р° РґР»СЏ РѕС‚РїСЂР°РІРєРё СЃРѕРѕР±С‰РµРЅРёР№.</p>
                                  <p><strong>РљР°Рє РїРѕР»СѓС‡РёС‚СЊ:</strong></p>
                                  <ul className="list-disc list-inside">
                                    <li>РЎРѕР·РґР°Р№С‚Рµ Р±РѕС‚Р° С‡РµСЂРµР· <code className="rounded bg-[hsl(var(--muted))] px-1">@BotFather</code></li>
                                    <li>РЎРєРѕРїРёСЂСѓР№С‚Рµ С‚РѕРєРµРЅ РёР· СЃРѕРѕР±С‰РµРЅРёСЏ</li>
                                  </ul>
                                  <p>Р¤РѕСЂРјР°С‚: <code className="rounded bg-[hsl(var(--muted))] px-1">123456789:ABCdefGHIjklMNOpqrSTUvwxYZ</code></p>
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          </label>
                          <input
                            style={{ padding: '12px 16px', width: '100%', borderRadius: '8px', border: '1px solid hsl(var(--input))', background: 'hsl(var(--background))' }}
                            value={form.botToken}
                            onChange={(e) => setForm({ ...form, botToken: e.target.value })}
                            placeholder="123456789:ABCdefGHIjklMNOpqrSTUvwxYZ"
                          />
                        </div>
                      </div>
                      <div style={{ marginTop: '16px' }}>
                        <label style={{ display: 'flex', alignItems: 'center', marginBottom: '16px', fontSize: '14px', fontWeight: 500 }}>
                          РЁР°Р±Р»РѕРЅ СЃРѕРѕР±С‰РµРЅРёСЏ
                          <TemplateHelp context="poll" />
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
                      setEditingPollId(null);
                      if (selectedPoll) {
                        setForm(normalizeForm(selectedPoll));
                      }
                    }}
                    style={{ flex: 1, padding: '14px 24px', borderRadius: '8px', background: 'hsl(var(--secondary))', color: 'hsl(var(--secondary-foreground))', fontWeight: 600, cursor: 'pointer', border: 'none' }}
                  >
                    РћС‚РјРµРЅР°
                  </button>
                </div>
              </form>
            </div>
          ) : selectedPoll ? (
            <div>
              <div className="space-y-4">
                <div>
                  <h4 className="mb-2 text-sm font-medium text-[hsl(var(--muted-foreground))]">РРЅС„РѕСЂРјР°С†РёСЏ Рѕ Р·Р°РґР°С‡Рµ</h4>
                  <div style={{ padding: '16px' }} className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))]">
                    <div style={{ marginBottom: '12px' }}>
                      <strong>ID:</strong> <code style={{ padding: '4px 8px', marginLeft: '8px' }} className="rounded bg-[hsl(var(--muted)_/_0.5)]">{selectedPoll.id}</code>
              </div>
                    <div style={{ marginBottom: '12px' }}>
                  <strong>РќР°Р·РІР°РЅРёРµ:</strong> {selectedPoll.name}
                </div>
                    <div style={{ marginBottom: '12px' }}>
                      <strong>РЎС‚Р°С‚СѓСЃ:</strong>{' '}
                      <span
                        style={{ padding: '4px 8px' }}
                        className={`rounded text-xs ${
                          selectedPoll.enabled
                            ? 'bg-[hsl(var(--success)_/_0.15)] text-[hsl(var(--success))]'
                            : 'bg-[hsl(var(--destructive)_/_0.1)] text-[hsl(var(--destructive))]'
                        }`}
                      >
                        {selectedPoll.enabled ? 'вњ… Р’РєР»СЋС‡РµРЅРѕ' : 'вЏёпёЏ РћС‚РєР»СЋС‡РµРЅРѕ'}
                      </span>
                    </div>
                  </div>
                </div>


                <div>
                  <h4 className="mb-2 text-sm font-medium text-[hsl(var(--muted-foreground))]">РќР°СЃС‚СЂРѕР№РєРё РѕРїСЂРѕСЃР°</h4>
                  <div style={{ padding: '16px' }} className="space-y-3 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))]">
                    <div>
                      <strong>URL:</strong>{' '}
                      <code style={{ padding: '4px 8px', marginLeft: '8px' }} className="rounded bg-[hsl(var(--muted)_/_0.5)]">{selectedPoll.url}</code>
                    </div>
                    <div>
                      <strong>РњРµС‚РѕРґ:</strong>{' '}
                      <code style={{ padding: '4px 8px', marginLeft: '8px' }} className="rounded bg-[hsl(var(--muted)_/_0.5)]">{selectedPoll.method}</code>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <strong>РРЅС‚РµСЂРІР°Р»:</strong>{' '}
                        <code style={{ padding: '4px 8px', marginLeft: '8px' }} className="rounded bg-[hsl(var(--muted)_/_0.5)]">{selectedPoll.intervalSec}s</code>
                      </div>
                      <div>
                        <strong>РўР°Р№РјР°СѓС‚:</strong>{' '}
                        <code style={{ padding: '4px 8px', marginLeft: '8px' }} className="rounded bg-[hsl(var(--muted)_/_0.5)]">{selectedPoll.timeoutSec}s</code>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="mb-2 text-sm font-medium text-[hsl(var(--muted-foreground))]">рџ“± Telegram СѓРІРµРґРѕРјР»РµРЅРёРµ</h4>
                  <div style={{ padding: '16px' }} className="space-y-3 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))]">
                    <div>
                      <strong>РЎС‚Р°С‚СѓСЃ:</strong>{' '}
                      <span
                        style={{ padding: '4px 8px' }}
                        className={`rounded text-xs ${
                          selectedPoll.chatId && selectedPoll.botToken
                            ? 'bg-[hsl(var(--success)_/_0.15)] text-[hsl(var(--success))]'
                            : 'bg-[hsl(var(--muted)_/_0.3)] text-[hsl(var(--muted-foreground))]'
                        }`}
                      >
                        {selectedPoll.chatId && selectedPoll.botToken ? 'вњ… Р’РєР»СЋС‡РµРЅРѕ' : 'вЏёпёЏ РћС‚РєР»СЋС‡РµРЅРѕ'}
                      </span>
                    </div>
                    {selectedPoll.chatId && (
                      <div>
                        <strong>Chat ID:</strong>{' '}
                        <code style={{ padding: '4px 8px', marginLeft: '8px' }} className="rounded bg-[hsl(var(--muted)_/_0.5)]">{selectedPoll.chatId}</code>
                      </div>
                    )}
                    {selectedPoll.botToken && (
                      <div>
                        <strong>Bot Token:</strong>{' '}
                        <code style={{ padding: '4px 8px', marginLeft: '8px' }} className="rounded bg-[hsl(var(--muted)_/_0.5)]">***РЅР°СЃС‚СЂРѕРµРЅ***</code>
                      </div>
                    )}
                    {selectedPoll.messageTemplate && (
                      <div>
                        <strong>РЁР°Р±Р»РѕРЅ СЃРѕРѕР±С‰РµРЅРёСЏ:</strong>
                        <div style={{ padding: '16px', marginTop: '8px' }} className="whitespace-pre-wrap rounded-lg bg-[hsl(var(--muted)_/_0.3)] text-sm">
                          {selectedPoll.messageTemplate}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-lg border border-[hsl(var(--border)_/_0.6)] bg-[hsl(var(--card))] p-10 text-center text-[hsl(var(--muted-foreground))]">
              <p className="mb-4">Р’С‹Р±РµСЂРёС‚Рµ Р·Р°РґР°С‡Сѓ СЃР»РµРІР° РёР»Рё СЃРѕР·РґР°Р№С‚Рµ РЅРѕРІСѓСЋ</p>
              <button
                onClick={handleStartCreate}
                className="inline-flex items-center gap-2 rounded bg-[hsl(var(--primary))] px-4 py-2 font-semibold text-[hsl(var(--primary-foreground))]"
              >
                <Plus className="h-4 w-4" /> РЎРѕР·РґР°С‚СЊ Р·Р°РґР°С‡Сѓ
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Export Modal */}
      <ExportModal
        isOpen={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        title="Р­РєСЃРїРѕСЂС‚ РїСѓР»Р»РёРЅРіРѕРІ"
        description="Р’С‹Р±РµСЂРёС‚Рµ РїСѓР»Р»РёРЅРіРё РґР»СЏ СЌРєСЃРїРѕСЂС‚Р°"
        items={polls.map((p) => ({ id: p.id, name: p.name, enabled: p.enabled }))}
        loading={loading}
        exportFileName="polls-export.json"
        exportType="polls"
        onExportSuccess={(count) => addToast(`Р­РєСЃРїРѕСЂС‚РёСЂРѕРІР°РЅРѕ РїСѓР»Р»РёРЅРіРѕРІ: ${count}`, 'success')}
      />
    </div>
  );
}


