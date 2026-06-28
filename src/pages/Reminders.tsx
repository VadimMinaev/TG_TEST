import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { api, Reminder, ReminderLog } from '../lib/api';
import { useToast } from '../components/ToastNotification';
import { useAuth } from '../lib/auth-context';
import { FormPage, FormPageItem } from '../components/FormPage';

type ReminderForm = { message: string; runAtLocal: string; repeatType: 'none' | 'interval' | 'cron'; intervalMinutes: string; cronExpression: string; isActive: boolean };

function toDateTimeLocal(val?: string) { if (!val) return ''; const d = new Date(val); if (Number.isNaN(d.getTime())) return ''; return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); }
function fmt(val?: string) { if (!val) return '-'; const d = new Date(val); if (Number.isNaN(d.getTime())) return '-'; return d.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
function ownerLabel(r: Reminder) { if (r.username) return `@${r.username}`; const fn = [r.first_name, r.last_name].filter(Boolean).join(' '); if (fn) return fn; if (r.telegram_id) return `ID ${r.telegram_id}`; return `User ${r.telegram_user_id}`; }
function schedLabel(r: Reminder) { if (r.repeat_type === 'interval') return `Каждые ${Math.max(1, Math.round(Number(r.repeat_config?.interval_seconds || 0) / 60))} мин`; if (r.repeat_type === 'cron') return `Cron: ${r.repeat_config?.cron || '-'}`; return fmt(r.run_at); }
function normForm(r: Reminder): ReminderForm { return { message: r.message || '', runAtLocal: toDateTimeLocal(r.run_at), repeatType: r.repeat_type || 'none', intervalMinutes: r.repeat_type === 'interval' ? String(Math.max(1, Math.round(Number(r.repeat_config?.interval_seconds || 60) / 60))) : '60', cronExpression: r.repeat_type === 'cron' ? String(r.repeat_config?.cron || '') : '', isActive: r.is_active }; }

export function Reminders() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const canEdit = user?.role !== 'auditor';
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<ReminderForm>({ message: '', runAtLocal: '', repeatType: 'none', intervalMinutes: '60', cronExpression: '', isActive: true });
  const [history, setHistory] = useState<ReminderLog[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const selected = useMemo(() => reminders.find((r) => r.id === selectedId) || null, [reminders, selectedId]);

  const load = async () => {
    try {
      setLoading(true);
      const d = await api.getReminders();
      setReminders(d);
      const isMobile = typeof window !== 'undefined' && window.innerWidth < 860;
      if (d.length) {
        if (!isMobile && (selectedId == null || !d.some((r) => r.id === selectedId))) {
          setSelectedId(d[0].id);
        }
      } else {
        setSelectedId(null);
        setEditingId(null);
      }
    }
    catch (e: any) { addToast(e.message || 'Ошибка', 'error'); } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const sp = searchParams.get('select');
    if (sp) { const id = Number(sp); if (Number.isInteger(id) && id > 0) { setSelectedId(id); setEditingId(null); } setSearchParams({}, { replace: true }); }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (!selectedId) { setHistory([]); return; }
    (async () => { try { setHistoryLoading(true); setHistory(await api.getReminderHistory(selectedId)); } catch { setHistory([]); } finally { setHistoryLoading(false); } })();
  }, [selectedId]);

  const startEdit = (r: Reminder) => { setSelectedId(r.id); setEditingId(r.id); setForm(normForm(r)); };

  const handleSave = async () => {
    if (!selected || editingId == null) return;
    if (!form.message.trim()) { addToast('Введите текст', 'error'); return; }
    if (!form.runAtLocal) { addToast('Укажите дату', 'error'); return; }
    const runAt = new Date(form.runAtLocal); if (Number.isNaN(runAt.getTime())) { addToast('Некорректная дата', 'error'); return; }
    let repeatConfig: any = null;
    if (form.repeatType === 'interval') { const m = Number(form.intervalMinutes); if (!Number.isFinite(m) || m < 1) { addToast('Интервал > 0', 'error'); return; } repeatConfig = { interval_seconds: Math.round(m * 60) }; }
    else if (form.repeatType === 'cron') { const c = form.cronExpression.trim(); if (!c) { addToast('Введите cron', 'error'); return; } repeatConfig = { cron: c }; }
    try {
      setSaving(true);
      const u = await api.updateReminder(selected.id, { message: form.message.trim(), runAt: runAt.toISOString(), nextRunAt: runAt.toISOString(), repeatType: form.repeatType, repeatConfig, isActive: form.isActive });
      setReminders((p) => p.map((r) => r.id === u.id ? { ...r, ...u } : r));
      setEditingId(null); addToast('Сохранено', 'success');
    } catch (e: any) { addToast(e.message || 'Ошибка', 'error'); } finally { setSaving(false); }
  };

  const handleToggle = async (r: Reminder) => {
    try { const u = await api.updateReminder(r.id, { isActive: !r.is_active }); setReminders((p) => p.map((x) => x.id === r.id ? { ...x, ...u } : x)); addToast('Статус изменен', 'success'); }
    catch (e: any) { addToast(e.message || 'Ошибка', 'error'); }
  };

  const handleDelete = async (r: Reminder) => {
    if (!confirm(`Деактивировать "${r.message}"?`)) return;
    try { await api.deleteReminder(r.id); setReminders((p) => p.map((x) => x.id === r.id ? { ...x, is_active: false } : x)); if (selectedId === r.id) setEditingId(null); addToast('Деактивировано', 'success'); }
    catch (e: any) { addToast(e.message || 'Ошибка', 'error'); }
  };

  const items: FormPageItem[] = reminders.map((r) => ({ id: r.id, name: r.message.slice(0, 40), subtitle: `${ownerLabel(r)} · ${schedLabel(r)}`, enabled: r.is_active }));

  const repeatOptions = [{ value: 'none', label: 'Однократно' }, { value: 'interval', label: 'Интервал' }, { value: 'cron', label: 'Cron' }];

  const editData = editingId !== null && selected ? {
    title: 'Редактирование', sections: [
      { title: 'Текст', fields: [
        { type: 'textarea' as const, label: 'Текст напоминания', value: form.message, rows: 3, placeholder: 'Текст напоминания', onChange: (v: string) => setForm((p) => ({ ...p, message: v })), span2: true },
      ] },
      { title: 'Расписание', fields: [
        { type: 'input' as const, label: 'Дата и время', value: form.runAtLocal, onChange: (v: string) => setForm((p) => ({ ...p, runAtLocal: v })), span2: true },
        { type: 'select' as const, label: 'Тип повтора', value: form.repeatType, options: repeatOptions, onChange: (v: string) => setForm((p) => ({ ...p, repeatType: v as any })) },
        ...(form.repeatType === 'interval' ? [{ type: 'input' as const, label: 'Интервал (мин)', value: form.intervalMinutes, onChange: (v: string) => setForm((p) => ({ ...p, intervalMinutes: v })) }] : []),
        ...(form.repeatType === 'cron' ? [{ type: 'input' as const, label: 'Cron', value: form.cronExpression, mono: true, placeholder: '0 9 * * *', onChange: (v: string) => setForm((p) => ({ ...p, cronExpression: v })), span2: true }] : []),
      ] },
      { title: 'Состояние', fields: [
        { type: 'toggle' as const, label: 'Активно', checked: form.isActive, onChange: (v: boolean) => setForm((p) => ({ ...p, isActive: v })) },
      ] },
    ],
    onSave: handleSave, saving,
  } : null;

  const historyContent = historyLoading ? <div style={{ color: 'var(--form-text-secondary)', fontSize: 13 }}>Загрузка...</div>
    : history.length === 0 ? <div style={{ color: 'var(--form-text-secondary)', fontSize: 13 }}>Нет записей</div>
    : <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {history.map((h) => (
        <div key={h.id} style={{ border: '1px solid var(--form-border-subtle, rgba(0,0,0,.06))', borderRadius: 8, padding: '8px 12px', fontSize: 13 }}>
          <div><strong>{h.status === 'sent' ? '✅' : '❌'} {h.status}</strong> {fmt(h.sent_at)}</div>
          {h.error_message && <div style={{ color: 'var(--form-danger)', marginTop: 4, fontSize: 12 }}>{h.error_message}</div>}
        </div>
      ))}
    </div>;

  const viewData = selected ? {
    name: selected.message.slice(0, 40),
    subtitle: ownerLabel(selected),
    avatar: (ownerLabel(selected)[0] || '?'),
    actions: canEdit ? (
      <>
        <button className="fp-btn fp-btn-ghost" onClick={() => handleToggle(selected)} title={selected.is_active ? 'Выкл' : 'Вкл'}>{selected.is_active ? '⏸️' : '▶️'}</button>
        <button className="fp-btn fp-btn-ghost" onClick={() => startEdit(selected)} title="Редактировать">✏️</button>
        <button className="fp-btn fp-btn-danger" onClick={() => handleDelete(selected)} title="Деактивировать">🗑️</button>
      </>
    ) : undefined,
    sections: [
      { title: 'Информация', fields: [
        { type: 'view' as const, label: 'ID', value: `#${selected.id}` },
        { type: 'view' as const, label: 'Пользователь', value: ownerLabel(selected) },
        { type: 'badge' as const, label: 'Статус', value: selected.is_active ? 'Активно' : 'Неактивно', active: selected.is_active },
        { type: 'view' as const, label: 'Текст', value: selected.message, span2: true, multiline: true },
      ] },
      { title: 'Расписание', fields: [
        { type: 'view' as const, label: 'Запуск', value: fmt(selected.run_at) },
        { type: 'view' as const, label: 'Следующий', value: fmt(selected.next_run_at) },
        { type: 'view' as const, label: 'Тип', value: selected.repeat_type, mono: true },
        ...(selected.repeat_type === 'interval' ? [{ type: 'view' as const, label: 'Интервал', value: `${Math.max(1, Math.round(Number(selected.repeat_config?.interval_seconds || 0) / 60))} мин` }] : []),
        ...(selected.repeat_type === 'cron' ? [{ type: 'view' as const, label: 'Cron', value: selected.repeat_config?.cron || '-', mono: true }] : []),
      ] },
      { title: 'Мета', fields: [
        { type: 'date' as const, label: 'Создано', value: fmt(selected.created_at) },
        { type: 'date' as const, label: 'Обновлено', value: fmt(selected.updated_at) },
      ] },
      { title: 'История отправок', fields: [
        { type: 'custom' as const, span2: true, content: historyContent },
      ] },
    ],
  } : null;

  return (
    <FormPage
      title="Напоминания"
      items={items}
      selectedId={editingId !== null ? null : selectedId}
      onSelect={(id) => { setSelectedId(id); setEditingId(null); }}
      onRefresh={load}
      loading={loading}
      canEdit={canEdit}
      view={viewData}
      edit={editData}
      onExitEdit={() => setEditingId(null)}
    />
  );
}
