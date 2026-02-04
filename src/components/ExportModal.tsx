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
  exportType: string; // "rules" | "polls" | "integrations"
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

  // Сбрасываем выбор при открытии
  useEffect(() => {
    if (isOpen) {
      setSelectedIds(new Set());
    }
  }, [isOpen]);

  const handleToggleItem = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
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

    if (itemsToExport.length === 0) {
      return;
    }

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

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '100px',
        zIndex: 9999,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'hsl(var(--card))',
          borderRadius: '12px',
          padding: '24px',
          width: '100%',
          maxWidth: '450px',
          maxHeight: 'calc(100vh - 150px)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          border: '1px solid hsl(var(--border))',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ marginBottom: '16px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '4px' }}>{title}</h2>
          <p style={{ fontSize: '14px', color: 'hsl(var(--muted-foreground))' }}>{description}</p>
        </div>

        <div style={{ maxHeight: '300px', overflow: 'auto', borderRadius: '8px', border: '1px solid hsl(var(--border))', flex: 1 }}>
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
                    style={{ 
                      width: '20px', height: '20px', borderRadius: '4px', border: '2px solid',
                      borderColor: selectedIds.size === items.length ? 'hsl(var(--primary))' : 'hsl(var(--input))',
                      background: selectedIds.size === items.length ? 'hsl(var(--primary))' : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}
                  >
                    {selectedIds.size === items.length && items.length > 0 && (
                      <Check className="h-3 w-3" style={{ color: 'hsl(var(--primary-foreground))' }} />
                    )}
                  </div>
                  <span style={{ fontWeight: 500 }}>Выбрать все ({items.length})</span>
                </div>
              </div>

              {items.map((item) => (
                <div
                  key={item.id}
                  style={{ padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid hsl(var(--border))' }}
                  onClick={() => handleToggleItem(item.id)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div
                      style={{ 
                        width: '20px', height: '20px', borderRadius: '4px', border: '2px solid', flexShrink: 0,
                        borderColor: selectedIds.has(item.id) ? 'hsl(var(--primary))' : 'hsl(var(--input))',
                        background: selectedIds.has(item.id) ? 'hsl(var(--primary))' : 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                      }}
                    >
                      {selectedIds.has(item.id) && <Check className="h-3 w-3" style={{ color: 'hsl(var(--primary-foreground))' }} />}
                    </div>
                    <div style={{ flex: 1, overflow: 'hidden' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {item.enabled !== undefined && (
                          <span
                            style={{ 
                              padding: '2px 6px', borderRadius: '4px', fontSize: '11px',
                              background: item.enabled ? 'hsl(var(--success) / 0.15)' : 'hsl(var(--destructive) / 0.1)',
                              color: item.enabled ? 'hsl(var(--success))' : 'hsl(var(--destructive))'
                            }}
                          >
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

        <div style={{ marginTop: '16px', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{ padding: '10px 16px', borderRadius: '8px', border: '1px solid hsl(var(--border))', background: 'hsl(var(--secondary))', cursor: 'pointer', fontSize: '14px' }}
          >
            Отмена
          </button>
          <button
            onClick={handleExport}
            disabled={selectedIds.size === 0}
            style={{ padding: '10px 16px', borderRadius: '8px', background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))', cursor: 'pointer', fontSize: '14px', fontWeight: 500, opacity: selectedIds.size === 0 ? 0.5 : 1 }}
          >
            Экспорт ({selectedIds.size})
          </button>
        </div>
      </div>
    </div>
  );
}
