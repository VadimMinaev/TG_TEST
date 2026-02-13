import { useState } from 'react';
import { MultiStepForm } from './MultiStepForm';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Checkbox } from './ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { TelegramPreviewWithToggle } from './TelegramPreviewWithToggle';

interface PollFormData {
  name: string;
  url: string;
  method: string;
  headersJson: string;
  bodyJson: string;
  conditionJson: string;
  intervalSec: number;
  timeoutSec: number;
  chatId: string;
  botToken: string;
  messageTemplate: string;
  enabled: boolean;
  onlyOnChange: boolean;
  continueAfterMatch: boolean;
}

interface PollWizardProps {
  initialData?: Partial<PollFormData>;
  onComplete: (data: PollFormData) => void;
  onCancel: () => void;
}

export function PollWizard({ initialData, onComplete, onCancel }: PollWizardProps) {
  const [formData, setFormData] = useState<PollFormData>({
    name: initialData?.name || '',
    url: initialData?.url || '',
    method: initialData?.method || 'GET',
    headersJson: initialData?.headersJson || '',
    bodyJson: initialData?.bodyJson || '',
    conditionJson: initialData?.conditionJson || '',
    intervalSec: initialData?.intervalSec || 60,
    timeoutSec: initialData?.timeoutSec || 10,
    chatId: initialData?.chatId || '',
    botToken: initialData?.botToken || '',
    messageTemplate: initialData?.messageTemplate || '',
    enabled: initialData?.enabled ?? true,
    onlyOnChange: initialData?.onlyOnChange ?? false,
    continueAfterMatch: initialData?.continueAfterMatch ?? false,
  });

  const handleChange = (field: keyof PollFormData, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const steps = [
    { title: 'Основная информация', description: 'Название и URL' },
    { title: 'Запрос', description: 'Настройка HTTP запроса' },
    { title: 'Условия', description: 'Настройка условий срабатывания' },
    { title: 'Уведомления', description: 'Настройка отправки в Telegram' },
    { title: 'Дополнительно', description: 'Дополнительные настройки' }
  ];

  // Пример payload для предварительного просмотра
  const payloadExample = {
    id: 12345,
    name: formData.name || 'Пример пуллинга',
    status: 'success',
    data: {
      status: 'ok',
      priority: 3,
      timestamp: new Date().toISOString()
    }
  };

  // Генерация предварительного просмотра сообщения
  const previewMessage = formData.messageTemplate || `Пуллинг "${formData.name}" сработал`;

  return (
    <MultiStepForm
      steps={steps}
      onComplete={() => onComplete(formData)}
      onCancel={onCancel}
    >
      {/* Шаг 1: Основная информация */}
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Название задачи</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => handleChange('name', e.target.value)}
            placeholder="Например: Проверка статуса заказа"
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="url">URL для опроса</Label>
          <Input
            id="url"
            value={formData.url}
            onChange={(e) => handleChange('url', e.target.value)}
            placeholder="https://api.example.com/status"
          />
        </div>
        
        <div className="flex items-center space-x-2 pt-2">
          <Checkbox
            id="enabled"
            checked={formData.enabled}
            onCheckedChange={(checked) => handleChange('enabled', checked)}
          />
          <Label htmlFor="enabled">Активна</Label>
        </div>
      </div>

      {/* Шаг 2: Запрос */}
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="method">HTTP метод</Label>
          <Select 
            value={formData.method} 
            onValueChange={(value) => handleChange('method', value)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="GET">GET</SelectItem>
              <SelectItem value="POST">POST</SelectItem>
              <SelectItem value="PUT">PUT</SelectItem>
              <SelectItem value="PATCH">PATCH</SelectItem>
              <SelectItem value="DELETE">DELETE</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="headersJson">Headers (JSON)</Label>
          <Textarea
            id="headersJson"
            value={formData.headersJson}
            onChange={(e) => handleChange('headersJson', e.target.value)}
            placeholder='{"Authorization": "Bearer token"}'
            rows={3}
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="bodyJson">Body (JSON)</Label>
          <Textarea
            id="bodyJson"
            value={formData.bodyJson}
            onChange={(e) => handleChange('bodyJson', e.target.value)}
            placeholder='{"id": 123}'
            rows={3}
          />
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="intervalSec">Интервал (сек)</Label>
            <Input
              id="intervalSec"
              type="number"
              min="5"
              value={formData.intervalSec}
              onChange={(e) => handleChange('intervalSec', Number(e.target.value))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="timeoutSec">Таймаут (сек)</Label>
            <Input
              id="timeoutSec"
              type="number"
              min="3"
              value={formData.timeoutSec}
              onChange={(e) => handleChange('timeoutSec', Number(e.target.value))}
            />
          </div>
        </div>
      </div>

      {/* Шаг 3: Условия */}
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="conditionJson">Условия (JSON)</Label>
          <Textarea
            id="conditionJson"
            value={formData.conditionJson}
            onChange={(e) => handleChange('conditionJson', e.target.value)}
            placeholder='{"logic":"AND","conditions":[{"path":"data.status","op":"==","value":"ok"}]}'
            rows={5}
          />
          <div className="text-xs text-muted-foreground">
            <p className="font-medium">Пример:</p>
            <pre className="bg-muted p-2 rounded mt-1">
{`{
  "logic": "AND",
  "conditions": [
    {
      "path": "data.status",
      "op": "==",
      "value": "ok"
    },
    {
      "path": "data.priority",
      "op": ">=",
      "value": 3
    }
  ]
}`}
            </pre>
            <p className="mt-1">logic — AND/OR. conditions — массив проверок. path — путь к полю. op — оператор (==, !=, &gt;, &lt;, &gt;=, &lt;=, includes, exists).</p>
          </div>
        </div>
      </div>

      {/* Шаг 4: Уведомления */}
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="chatId">Chat ID</Label>
          <Input
            id="chatId"
            value={formData.chatId}
            onChange={(e) => handleChange('chatId', e.target.value)}
            placeholder="-1001234567890"
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="botToken">Токен бота (опционально)</Label>
          <Input
            id="botToken"
            type="password"
            value={formData.botToken}
            onChange={(e) => handleChange('botToken', e.target.value)}
            placeholder="Оставьте пустым для использования глобального токена"
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="messageTemplate">Шаблон сообщения (опционально)</Label>
          <Textarea
            id="messageTemplate"
            value={formData.messageTemplate}
            onChange={(e) => handleChange('messageTemplate', e.target.value)}
            placeholder="${payload.name} — ${payload.status}"
            rows={3}
          />
        </div>
        
        <TelegramPreviewWithToggle 
          message={formData.messageTemplate || previewMessage} 
          payload={payloadExample} 
          context="poll" 
        />
      </div>

      {/* Шаг 5: Дополнительно */}
      <div className="space-y-4">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="onlyOnChange"
            checked={formData.onlyOnChange}
            onCheckedChange={(checked) => handleChange('onlyOnChange', checked)}
          />
          <Label htmlFor="onlyOnChange">Только при изменении</Label>
        </div>
        
        <div className="flex items-center space-x-2">
          <Checkbox
            id="continueAfterMatch"
            checked={formData.continueAfterMatch}
            onCheckedChange={(checked) => handleChange('continueAfterMatch', checked)}
          />
          <Label htmlFor="continueAfterMatch">Продолжать после совпадения</Label>
        </div>
        
        <div className="border rounded-lg p-4 bg-muted">
          <h3 className="font-medium mb-2">Проверьте настройки пуллинга</h3>
          <div className="text-sm space-y-1">
            <p><span className="font-medium">Название:</span> {formData.name}</p>
            <p><span className="font-medium">Статус:</span> {formData.enabled ? 'Активна' : 'Неактивна'}</p>
            <p><span className="font-medium">Интервал:</span> {formData.intervalSec} сек</p>
            <p><span className="font-medium">Только при изменении:</span> {formData.onlyOnChange ? 'Да' : 'Нет'}</p>
          </div>
        </div>
      </div>
    </MultiStepForm>
  );
}
