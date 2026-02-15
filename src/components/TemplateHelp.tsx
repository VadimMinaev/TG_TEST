import { useState } from 'react';
import { Info, Copy, CheckCheck } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './ui/tooltip';

interface TemplateExample {
  code: string;
  description: string;
}

interface TemplateHelpProps {
  /** Тип контекста: 'rule' | 'poll' | 'integration' */
  context?: 'rule' | 'poll' | 'integration';
}

export function TemplateHelp({ context = 'integration' }: TemplateHelpProps) {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const handleCopy = async (code: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch {
      // Fallback
      const textArea = document.createElement('textarea');
      textArea.value = code;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    }
  };

  const baseExamples: TemplateExample[] = [
    { code: '${payload.name}', description: 'Имя' },
    { code: '${payload.status}', description: 'Статус' },
    { code: '${payload.id}', description: 'ID' },
    { code: '${payload?.field || "по умолчанию"}', description: 'С fallback' },
    { code: '${payload.items?.[0]?.name}', description: 'Первый элемент массива' },
  ];

  const integrationExamples: TemplateExample[] = [
    { code: '${response.name}', description: 'Из ответа Action API' },
    { code: '${trigger.id}', description: 'Из данных триггера' },
  ];

  const examples = context === 'integration' 
    ? [...baseExamples, ...integrationExamples]
    : baseExamples;

  const fullTemplate = context === 'integration'
    ? `👤 \${payload.name}
💼 \${payload.job_title || ''}
📍 \${payload.location || ''}
🆔 ID: \${payload.id}`
    : `🔔 Уведомление

📋 \${payload.subject || payload.name}
📊 Статус: \${payload.status}
🆔 ID: \${payload.id}`;

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip open={open} onOpenChange={setOpen}>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setOpen((prev) => !prev);
            }}
            className="ml-1.5 flex h-6 w-6 items-center justify-center rounded-full text-[hsl(var(--muted-foreground))] transition-colors hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--accent-foreground))]"
            aria-label="Показать подсказку по шаблонам"
          >
            <Info className="h-4 w-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="left" className="max-w-md text-left p-0" onPointerDownOutside={() => setOpen(false)}>
          <div className="p-3 space-y-3">
            <div>
              <p className="font-medium mb-2">Синтаксис шаблонов</p>
              <p className="text-xs text-[hsl(var(--muted-foreground))] mb-2">
                Используйте <code className="bg-[hsl(var(--muted))] px-1 rounded">${'{'}...{'}'}</code> для вставки данных. Кликните для копирования.
              </p>
            </div>
            
            <div className="space-y-1">
              <p className="text-xs font-medium text-[hsl(var(--muted-foreground))]">Примеры:</p>
              {examples.map((ex) => (
                <div
                  key={ex.code}
                  onClick={(e) => handleCopy(ex.code, e)}
                  className="flex items-center justify-between gap-2 p-1.5 rounded cursor-pointer hover:bg-[hsl(var(--accent))] transition-colors group"
                >
                  <code className="text-xs bg-[hsl(var(--muted))] px-1.5 py-0.5 rounded flex-1 overflow-hidden text-ellipsis">
                    {ex.code}
                  </code>
                  <span className="text-xs text-[hsl(var(--muted-foreground))] shrink-0">
                    {ex.description}
                  </span>
                  <span className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    {copiedCode === ex.code ? (
                      <CheckCheck className="h-3.5 w-3.5 text-[hsl(var(--success))]" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </span>
                </div>
              ))}
            </div>

            <div className="border-t border-[hsl(var(--border))] pt-2">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-medium text-[hsl(var(--muted-foreground))]">Полный пример:</p>
                <button
                  onClick={(e) => handleCopy(fullTemplate, e)}
                  className="flex items-center gap-1 text-xs text-[hsl(var(--primary))] hover:underline"
                >
                  {copiedCode === fullTemplate ? (
                    <>
                      <CheckCheck className="h-3 w-3" />
                      Скопировано
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" />
                      Копировать
                    </>
                  )}
                </button>
              </div>
              <pre className="text-xs bg-[hsl(var(--muted))] p-2 rounded overflow-x-auto whitespace-pre-wrap">
                {fullTemplate}
              </pre>
            </div>

            {context === 'integration' && (
              <div className="text-xs text-[hsl(var(--muted-foreground))] border-t border-[hsl(var(--border))] pt-2">
                <p className="font-medium mb-1">Доступные переменные:</p>
                <ul className="space-y-0.5">
                  <li><code className="bg-[hsl(var(--muted))] px-1 rounded">payload</code> — ответ Action API (или триггер)</li>
                  <li><code className="bg-[hsl(var(--muted))] px-1 rounded">response</code> — ответ Action API</li>
                  <li><code className="bg-[hsl(var(--muted))] px-1 rounded">trigger</code> — данные триггера</li>
                </ul>
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
