import { useState } from 'react';
import { ChevronLeft, Eye, EyeOff, Plus, RefreshCw } from 'lucide-react';

/* ─── Types ────────────────────────────────────────────────────────────── */

export interface FormPageItem {
  id: number;
  name: string;
  subtitle?: string;
  avatar?: string;
  enabled?: boolean;
  webhookSet?: boolean;
}

export type FormField =
  | { type: 'input'; label: string; value: string; span2?: boolean; mono?: boolean; placeholder?: string; required?: boolean; onChange?: (v: string) => void; hint?: string; link?: string; linkLabel?: string; error?: string }
  | { type: 'select'; label: string; value: string; options: { value: string; label: string }[]; onChange?: (v: string) => void; span2?: boolean }
  | { type: 'textarea'; label: string; value: string; span2?: boolean; placeholder?: string; rows?: number; onChange?: (v: string) => void; hint?: string }
  | { type: 'password'; label: string; value: string; placeholder?: string; required?: boolean; onChange?: (v: string) => void; hint?: string; link?: string; linkLabel?: string }
  | { type: 'toggle'; label: string; description?: string; checked: boolean; onChange?: (v: boolean) => void }
  | { type: 'checkbox'; label: string; checked: boolean; onChange?: (v: boolean) => void; disabled?: boolean }
  | { type: 'view'; label: string; value: string; span2?: boolean; mono?: boolean; multiline?: boolean; secret?: boolean; empty?: string }
  | { type: 'badge'; label: string; value: string; active: boolean }
  | { type: 'date'; label: string; value: string }
  | { type: 'custom'; span2?: boolean; content: React.ReactNode };

export interface FormSection {
  title: string;
  fields: FormField[];
}

export interface FormPageProps {
  title: string;
  items: FormPageItem[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  onRefresh: () => void;
  onCreate?: () => void;
  loading?: boolean;
  canEdit?: boolean;
  view?: {
    avatar?: string;
    name: string;
    subtitle: string;
    sections: FormSection[];
    actions?: React.ReactNode;
  } | null;
  edit?: {
    title: string;
    subtitle?: string;
    sections: FormSection[];
    onDelete?: () => void;
    onSave?: () => void;
    saving?: boolean;
  } | null;
  onExitEdit?: () => void;
  empty?: React.ReactNode;
}

/* ─── Helpers ──────────────────────────────────────────────────────────── */

function getInitial(name: string) { return (name || '?')[0].toUpperCase(); }

function SecretValue({ value }: { value: string }) {
  const [show, setShow] = useState(false);
  if (!value) return <span className="fv-empty">—</span>;
  const masked = `${value.slice(0, 4)}${'•'.repeat(Math.max(0, value.length - 8))}${value.slice(-4)}`;
  return (
    <span className="fv-secret">
      <span className="fv-secret-dots">{show ? value : masked}</span>
      <button type="button" className="fv-secret-reveal" onClick={() => setShow(!show)}>
        {show ? <EyeOff size={14} /> : <Eye size={14} />}
      </button>
    </span>
  );
}

/* ─── Field renderers ──────────────────────────────────────────────────── */

function EditField({ field }: { field: FormField }) {
  if (field.type === 'input') {
    return (
      <div className={`fp-field ${field.span2 ? 'span2' : ''}`}>
        <label className="fp-label">{field.label} {field.required && <span className="fp-required">*</span>}</label>
        <input className={`fp-input ${field.mono ? 'mono' : ''} ${field.error ? 'has-error' : ''}`} value={field.value} onChange={(e) => field.onChange?.(e.target.value)} placeholder={field.placeholder} />
        {field.hint && <span className="fp-hint">{field.hint}</span>}
        {field.error && <span className="fp-error">{field.error}</span>}
      </div>
    );
  }
  if (field.type === 'password') {
    return (
      <div className="fp-field">
        <label className="fp-label">{field.label} {field.required && <span className="fp-required">*</span>}</label>
        <PasswordInput value={field.value} onChange={field.onChange} placeholder={field.placeholder} />
        {field.hint && <span className="fp-hint">{field.hint}</span>}
      </div>
    );
  }
  if (field.type === 'select') {
    return (
      <div className={`fp-field ${field.span2 ? 'span2' : ''}`}>
        <label className="fp-label">{field.label}</label>
        <select className="fp-select" value={field.value} onChange={(e) => field.onChange?.(e.target.value)}>
          {field.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
    );
  }
  if (field.type === 'textarea') {
    return (
      <div className={`fp-field ${field.span2 ? 'span2' : ''}`}>
        <label className="fp-label">{field.label}</label>
        <textarea className="fp-textarea" rows={field.rows || 4} value={field.value} onChange={(e) => field.onChange?.(e.target.value)} placeholder={field.placeholder} />
        {field.hint && <span className="fp-hint">{field.hint}</span>}
      </div>
    );
  }
  if (field.type === 'toggle') {
    return (
      <div className="fp-toggle-row">
        <div className="fp-toggle-info">
          <div className="fp-toggle-name">{field.label}</div>
          {field.description && <div className="fp-toggle-desc">{field.description}</div>}
        </div>
        <label className="fp-toggle">
          <input type="checkbox" checked={field.checked} onChange={(e) => field.onChange?.(e.target.checked)} />
          <div className="fp-toggle-track"><div className="fp-toggle-thumb" /></div>
        </label>
      </div>
    );
  }
  if (field.type === 'view') {
    const val = field.value || field.empty || '—';
    const isEmpty = !field.value;
    if (field.secret) {
      return (
        <div className={`fp-field ${field.span2 ? 'span2' : ''}`}>
          <div className="fp-label">{field.label}</div>
          <div className="fp-fv secret"><SecretValue value={field.value} /></div>
        </div>
      );
    }
    return (
      <div className={`fp-field ${field.span2 ? 'span2' : ''}`}>
        <div className="fp-label">{field.label}</div>
        <div className={`fp-fv ${field.mono ? 'mono' : ''} ${field.multiline ? 'multiline' : ''} ${isEmpty ? 'empty' : ''}`}>{val}</div>
      </div>
    );
  }
  if (field.type === 'badge') {
    return (
      <div className="fp-status-item">
        <div className="fp-label">{field.label}</div>
        <span className={`fp-badge ${field.active ? 'on' : 'off'}`}><span className="fp-badge-dot" />{field.value}</span>
      </div>
    );
  }
  if (field.type === 'date') {
    return (
      <div className="fp-status-item">
        <div className="fp-label">{field.label}</div>
        <span style={{ fontSize: 13, color: 'var(--form-text-secondary, #6b7080)' }}>{field.value}</span>
      </div>
    );
  }
  if (field.type === 'checkbox') {
    return (
      <label className={`fp-checkbox ${field.disabled ? 'disabled' : ''}`}>
        <input type="checkbox" checked={field.checked} onChange={(e) => field.onChange?.(e.target.checked)} disabled={field.disabled} />
        <span className="fp-checkbox-box" />
        <span className="fp-checkbox-label">{field.label}</span>
      </label>
    );
  }
  if (field.type === 'custom') {
    return <div className={`fp-field ${field.span2 ? 'span2' : ''}`}>{field.content}</div>;
  }
  return null;
}

function PasswordInput({ value, onChange, placeholder }: { value: string; onChange?: (v: string) => void; placeholder?: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="fp-input-wrap">
      <input className="fp-input mono" type={show ? 'text' : 'password'} value={value} onChange={(e) => onChange?.(e.target.value)} placeholder={placeholder} />
      <button type="button" className="fp-eye" onClick={() => setShow(!show)}>{show ? <EyeOff size={14} /> : <Eye size={14} />}</button>
    </div>
  );
}

/* ─── Main Component ───────────────────────────────────────────────────── */

export function FormPage({ title, items, selectedId, onSelect, onRefresh, onCreate, loading, canEdit, view, edit, onExitEdit, empty }: FormPageProps) {
  return (
    <div className="fp">
      {/* Sidebar */}
      <aside className="fp-sidebar">
        <div className="fp-sidebar-head">
          <span className="fp-sidebar-title">{title}</span>
          <div className="fp-sidebar-actions">
            {canEdit && onCreate && <button className="fp-icon-btn" onClick={onCreate} title="Добавить"><Plus size={13} /></button>}
            <button className="fp-icon-btn" onClick={onRefresh} title="Обновить"><RefreshCw size={13} /></button>
          </div>
        </div>
        <div className="fp-bot-list">
          {loading ? (
            <div className="fp-loading"><div className="fp-spinner" /></div>
          ) : items.length === 0 ? (
            <div className="fp-empty">Нет элементов</div>
          ) : items.map((item) => (
            <div key={item.id} className={`fp-bot-item ${selectedId === item.id ? 'active' : ''}`} onClick={() => onSelect(item.id)}>
              <div className="fp-bot-avatar">{item.avatar || getInitial(item.name)}</div>
              <div className="fp-bot-info">
                <div className="fp-bot-name">{item.name}</div>
                {item.subtitle && <div className="fp-bot-model">{item.subtitle}</div>}
              </div>
              <div className={`fp-dot ${item.enabled !== false ? 'on' : ''}`} />
            </div>
          ))}
        </div>
      </aside>

      {/* Panel */}
      <div className="fp-panel">
        {edit ? (
          /* ═══ EDIT MODE ═══ */
          <>
            <div className="fp-panel-head">
              <button className="fp-back" onClick={() => onExitEdit?.()}><ChevronLeft size={14} /></button>
              <div className="fp-panel-meta">
                <div className="fp-panel-name">{edit.title}</div>
                {edit.subtitle && <div className="fp-panel-sub">{edit.subtitle}</div>}
              </div>
            </div>

            <div className="fp-form-body">
              {edit.sections.map((section) => (
                <div key={section.title} className="fp-section">
                  <div className="fp-section-title">{section.title}</div>
                  <div className="fp-fields-grid">
                    {section.fields.map((field, i) => <EditField key={`${section.title}-${i}`} field={field} />)}
                  </div>
                </div>
              ))}
            </div>

            <div className="fp-footer">
              {edit.onDelete && <button type="button" className="fp-btn fp-btn-danger" onClick={edit.onDelete}><span className="fp-btn-text">Удалить</span></button>}
              <button type="button" className="fp-btn fp-btn-ghost" onClick={() => onExitEdit?.()}>Отмена</button>
              {edit.onSave && (
                <button type="button" className="fp-btn fp-btn-primary" disabled={edit.saving} onClick={edit.onSave}>
                  {edit.saving ? 'Сохранение...' : 'Сохранить'}
                </button>
              )}
            </div>
          </>
        ) : view ? (
          /* ═══ VIEW MODE ═══ */
          <>
            <div className="fp-panel-head">
              <div className="fp-panel-avatar">{view.avatar || getInitial(view.name)}</div>
              <div className="fp-panel-meta">
                <div className="fp-panel-name">{view.name}</div>
                <div className="fp-panel-sub">{view.subtitle}</div>
              </div>
              {view.actions && <div className="fp-panel-actions">{view.actions}</div>}
            </div>

            <div className="fp-form-body">
              {view.sections.map((section) => (
                <div key={section.title} className="fp-section">
                  <div className="fp-section-title">{section.title}</div>
                  {section.fields.some((f) => f.type === 'badge' || f.type === 'date') ? (
                    <div className="fp-status-row">
                      {section.fields.map((field, i) => <EditField key={`${section.title}-${i}`} field={field} />)}
                    </div>
                  ) : (
                    <div className="fp-fields-grid">
                      {section.fields.map((field, i) => <EditField key={`${section.title}-${i}`} field={field} />)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        ) : (
          /* ═══ EMPTY STATE ═══ */
          <div className="fp-placeholder">
            {empty || <p>Выберите элемент или создайте нового</p>}
          </div>
        )}
      </div>
    </div>
  );
}
