import { useState, useEffect } from 'react';
import { Check } from 'lucide-react';

interface ExportItem {
  id: number;
  name: string;
  enabled?: boolean;
}

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description: string;
  items: ExportItem[];
  loading?: boolean;
  exportFileName: string;
  exportType: string;
  onExportSuccess?: (count: number) => void;
}

export function ExportModal({
  isOpen,
  onClose,
  title,
  description,
  items,
  loading = false,
  exportFileName,
  exportType,
  onExportSuccess,
}: ExportModalProps) {
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (isOpen) setSelectedIds(new Set());
  }, [isOpen]);

  const handleToggleItem = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === items.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.map((item) => item.id)));
    }
  };

  const handleExport = () => {
    const itemsToExport = items.filter((item) => selectedIds.has(item.id));
    if (itemsToExport.length === 0) return;

    const payload = {
      exportedAt: new Date().toISOString(),
      count: itemsToExport.length,
      [exportType]: itemsToExport,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = exportFileName;
    link.click();
    URL.revokeObjectURL(url);

    onExportSuccess?.(itemsToExport.length);
    onClose();
  };

  if (!isOpen) return null;

  const allSelected = selectedIds.size === items.length && items.length > 0;

  return (
    <div className="modal-overlay" style={{ paddingTop: '100px', alignItems: 'flex-start' }} onClick={onClose}>
      <div
        className="modal-content"
        style={{ maxWidth: '450px', maxHeight: 'calc(100vh - 150px)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header" style={{ borderBottom: '1px solid hsl(var(--border))' }}>
          <div>
            <h2 className="text-lg font-semibold">{title}</h2>
            <p className="text-sm" style={{ color: 'hsl(var(--muted-foreground))' }}>{description}</p>
          </div>
        </div>

        <div style={{ maxHeight: '300px', overflow: 'auto', flex: 1 }}>
          {loading ? (
            <div style={{ padding: '32px', textAlign: 'center' }}>
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-[hsl(var(--primary))] border-t-transparent" style={{ margin: '0 auto' }} />
            </div>
          ) : items.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center', color: 'hsl(var(--muted-foreground))' }}>
              Нет элементов для экспорта
            </div>
          ) : (
            <>
              <div
                style={{ padding: '12px 16px', cursor: 'pointer', position: 'sticky', top: 0, background: 'hsl(var(--muted))', borderBottom: '1px solid hsl(var(--border))' }}
                onClick={handleSelectAll}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div
                    className="fp-checkbox-box"
                    style={{
                      borderColor: allSelected ? 'hsl(var(--primary))' : undefined,
                      background: allSelected ? 'hsl(var(--primary))' : undefined,
                    }}
                  >
                    {allSelected && <Check className="h-3 w-3" style={{ color: '#fff' }} />}
                  </div>
                  <span style={{ fontWeight: 500 }}>Выбрать все ({items.length})</span>
                </div>
              </div>

              {items.map((item) => (
                <div
                  key={item.id}
                  style={{ padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid hsl(var(--border))', transition: 'background 0.15s' }}
                  onClick={() => handleToggleItem(item.id)}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'hsl(var(--accent) / 0.3)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div
                      className="fp-checkbox-box"
                      style={{
                        flexShrink: 0,
                        borderColor: selectedIds.has(item.id) ? 'hsl(var(--primary))' : undefined,
                        background: selectedIds.has(item.id) ? 'hsl(var(--primary))' : undefined,
                      }}
                    >
                      {selectedIds.has(item.id) && <Check className="h-3 w-3" style={{ color: '#fff' }} />}
                    </div>
                    <div style={{ flex: 1, overflow: 'hidden' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {item.enabled !== undefined && (
                          <span className={`badge ${item.enabled ? 'badge-success' : 'badge-error'}`}>
                            {item.enabled ? 'Вкл' : 'Выкл'}
                          </span>
                        )}
                        <span style={{ fontWeight: 500 }}>{item.name}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>

        <div className="modal-footer">
          <button onClick={onClose} className="btn-secondary">
            Отмена
          </button>
          <button
            onClick={handleExport}
            disabled={selectedIds.size === 0}
            className="btn-primary"
            style={{ opacity: selectedIds.size === 0 ? 0.5 : 1 }}
          >
            Экспорт ({selectedIds.size})
          </button>
        </div>
      </div>
    </div>
  );
}
