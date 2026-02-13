import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { MessageCircle, Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';

interface TelegramPreviewWithToggleProps {
  message: string;
  payload?: any;
  context?: 'rule' | 'poll' | 'integration' | 'bot';
}

export function TelegramPreviewWithToggle({ message, payload, context = 'rule' }: TelegramPreviewWithToggleProps) {
  const [isVisible, setIsVisible] = useState(true);
  
  // Формируем сообщение на основе шаблона и payload
  const formatMessage = (template: string, data: any) => {
    if (!template || typeof template !== 'string') {
      // Используем стандартный формат для отображения
      if (data && typeof data === 'object') {
        const parts = [];
        if (data.subject) parts.push(`📋 ${data.subject}`);
        if (data.requested_by?.name) parts.push(`👤 ${data.requested_by.name}`);
        if (data.status) parts.push(`📊 ${data.status}`);
        if (data.team_name) parts.push(`👥 ${data.team_name}`);
        if (data.category) parts.push(`🏷️ ${data.category}`);
        if (data.priority) parts.push(`🔺 ${data.priority}`);
        if (parts.length > 0) return parts.join('\n');
      }
      return 'Предварительный просмотр сообщения';
    }

    try {
      // Заменяем шаблонные переменные вроде ${payload.field} или {{payload.field}}
      let formatted = template;
      
      // Поддержка шаблонов вида ${payload.field} или {{payload.field}}
      const templateRegex = /\$\{([^}]+)\}|{{([^}]+)}}/g;
      let match;
      
      while ((match = templateRegex.exec(formatted)) !== null) {
        const fullMatch = match[0];
        const path1 = match[1]; // для ${}
        const path2 = match[2]; // для {{}}
        const path = path1 || path2;
        
        if (path && data) {
          // Разбиваем путь на части (например, payload.requested_by.name)
          const pathParts = path.split('.').filter(part => part !== 'payload' && part !== 'response' && part !== 'trigger');
          let value = data;
          
          for (const part of pathParts) {
            if (value && typeof value === 'object') {
              value = value[part];
            } else {
              value = undefined;
              break;
            }
          }
          
          if (value !== undefined && value !== null) {
            formatted = formatted.replace(fullMatch, String(value));
          }
        }
      }
      
      return formatted;
    } catch (e) {
      console.error('Error formatting message:', e);
      return template;
    }
  };

  const previewMessage = payload ? formatMessage(message, payload) : message;

  return (
    <Card className="border border-[hsl(var(--border))] bg-[hsl(var(--muted))]">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <MessageCircle className="h-4 w-4" />
            Предварительный просмотр сообщения
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsVisible(!isVisible)}
            className="h-8 w-8 p-0"
          >
            {isVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isVisible ? (
          <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="bg-blue-500 rounded-full w-8 h-8 flex items-center justify-center text-white text-sm font-medium">
                B
              </div>
              <div className="flex-1">
                <div className="font-medium text-sm mb-1">Webhook Bot</div>
                <div className="text-gray-800 text-sm whitespace-pre-wrap break-words">
                  {previewMessage}
                </div>
                <div className="text-xs text-gray-500 mt-1">Только что</div>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-4 text-sm text-[hsl(var(--muted-foreground))]">
            Предварительный просмотр скрыт
          </div>
        )}
      </CardContent>
    </Card>
  );
}