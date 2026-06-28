import { Rule } from '../lib/api';

interface RulesListProps {
  rules: Rule[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  loading: boolean;
}

const isDraftRule = (rule: Rule) =>
  !rule.enabled && (
    String(rule.name || '').toLowerCase().startsWith('черновик') ||
    String(rule.chatId || '').trim() === '0'
  );

export function RulesList({ rules, selectedId, onSelect, loading }: RulesListProps) {
  if (loading) {
    return (
      <div className="fp-loading">
        <div className="fp-spinner" />
      </div>
    );
  }

  if (rules.length === 0) {
    return (
      <div className="fp-empty">Webhook не найден</div>
    );
  }

  return (
    <div className="fp-bot-list">
      {rules.map((rule) => (
        <div
          key={rule.id}
          className={`fp-bot-item ${selectedId === rule.id ? 'active' : ''}`}
          onClick={() => onSelect(rule.id)}
        >
          <div className="fp-bot-avatar">
            {(rule.name || '?')[0]}
          </div>
          <div className="fp-bot-info">
            <div className="fp-bot-name">
              {rule.name}
              {isDraftRule(rule) && (
                <span className="ml-2 inline-block rounded-full bg-[hsl(var(--muted))] px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                  черновик
                </span>
              )}
            </div>
            <div className="fp-bot-model" title={rule.condition || ''}>
              {rule.condition || 'Без условия'}
            </div>
          </div>
          <div className={`fp-dot ${rule.enabled ? 'on' : ''}`} />
        </div>
      ))}
    </div>
  );
}
