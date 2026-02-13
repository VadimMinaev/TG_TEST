import { useState } from 'react';
import { MultiStepForm } from './MultiStepForm';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Checkbox } from './ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { TelegramPreviewWithToggle } from './TelegramPreviewWithToggle';

interface IntegrationFormData {
  name: string;
  enabled: boolean;
  triggerType: 'webhook' | 'polling';
  triggerCondition: string;
  pollingUrl: string;
  pollingMethod: string;
  pollingHeaders: string;
  pollingBody: string;
  pollingInterval: number;
  pollingCondition: string;
  pollingContinueAfterMatch: boolean;
  actionUrl: string;
  actionMethod: string;
  actionHeaders: string;
  actionBody: string;
  timeoutSec: number;
  sendToTelegram: boolean;
  chatId: string;
  botToken: string;
  messageTemplate: string;
}

interface IntegrationWizardProps {
  initialData?: Partial<IntegrationFormData>;
  onComplete: (data: IntegrationFormData) => void;
  onCancel: () => void;
}

export function IntegrationWizard({ initialData, onComplete, onCancel }: IntegrationWizardProps) {
  const [formData, setFormData] = useState<IntegrationFormData>({
    name: initialData?.name || '',
    enabled: initialData?.enabled ?? true,
    triggerType: initialData?.triggerType || 'webhook',
    triggerCondition: initialData?.triggerCondition || '',
    pollingUrl: initialData?.pollingUrl || '',
    pollingMethod: initialData?.pollingMethod || 'GET',
    pollingHeaders: initialData?.pollingHeaders || '',
    pollingBody: initialData?.pollingBody || '',
    pollingInterval: initialData?.pollingInterval || 60,
    pollingCondition: initialData?.pollingCondition || '',
    pollingContinueAfterMatch: initialData?.pollingContinueAfterMatch ?? false,
    actionUrl: initialData?.actionUrl || '',
    actionMethod: initialData?.actionMethod || 'POST',
    actionHeaders: initialData?.actionHeaders || '',
    actionBody: initialData?.actionBody || '',
    timeoutSec: initialData?.timeoutSec || 30,
    sendToTelegram: initialData?.sendToTelegram ?? false,
    chatId: initialData?.chatId || '',
    botToken: initialData?.botToken || '',
    messageTemplate: initialData?.messageTemplate || '',
  });

  const handleChange = (field: keyof IntegrationFormData, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const steps = [
    { title: 'Основная информация', description: 'Название и тип интеграции' },
    { title: 'Триггер', description: 'Настройка срабатывания' },
    { title: 'Действие', description: 'Настройка выполнения' },
    { title: 'Уведомления', description: 'Настройка отправки в Telegram' },
    { title: 'Подтверждение', description: 'Проверка настроек' }
  ];

  // Пример payload для предварительного просмотра
  const payloadExample = {
    id: 12345,
    name: formData.name || 'Пример интеграции',
    status: 'success',
    result: 'completed',
    timestamp: new Date().toISOString(),
    data: {
      processed: 5,
      errors: 0,
      duration: '2.5s'
    }
  };

  // Генерация предварительного просмотра сообщения
  const previewMessage = formData.messageTemplate || `Интеграция "${formData.name}" выполнена успешно`;

  return (
    <MultiStepForm
      steps={steps}
      onComplete={() => onComplete(formData)}
      onCancel={onCancel}
    >
      {/* Шаг 1: Основная информация */}
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Название интеграции</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => handleChange('name', e.target.value)}
            placeholder="Например: Интеграция с CRM"
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
        
        <div className="space-y-2">
          <Label>Тип триггера</Label>
          <Select 
            value={formData.triggerType} 
            onValueChange={(value: 'webhook' | 'polling') => handleChange('triggerType', value)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="webhook">Webhook (входящий)</SelectItem>
              <SelectItem value="polling">Polling (опрос)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Шаг 2: Триггер */}
      <div className="space-y-4">
        {formData.triggerType === 'webhook' ? (
          <div className="space-y-2">
            <Label htmlFor="triggerCondition">Условие срабатывания</Label>
            <Textarea
              id="triggerCondition"
              value={formData.triggerCondition}
              onChange={(e) => handleChange('triggerCondition', e.target.value)}
              placeholder='payload.type === "order"'
              rows={4}
            />
            <p className="text-xs text-muted-foreground">
              JavaScript-выражение. Доступна переменная <code>payload</code>
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="pollingUrl">URL для опроса</Label>
                <Input
                  id="pollingUrl"
                  value={formData.pollingUrl}
                  onChange={(e) => handleChange('pollingUrl', e.target.value)}
                  placeholder="https://api.example.com/status"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pollingMethod">Метод</Label>
                <Select 
                  value={formData.pollingMethod} 
                  onValueChange={(value) => handleChange('pollingMethod', value)}
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
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="pollingHeaders">Headers (JSON)</Label>
              <Textarea
                id="pollingHeaders"
                value={formData.pollingHeaders}
                onChange={(e) => handleChange('pollingHeaders', e.target.value)}
                placeholder='{"Authorization": "Bearer token"}'
                rows={2}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="pollingBody">Body (JSON)</Label>
              <Textarea
                id="pollingBody"
                value={formData.pollingBody}
                onChange={(e) => handleChange('pollingBody', e.target.value)}
                placeholder='{"id": 123}'
                rows={2}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="pollingInterval">Интервал (сек)</Label>
                <Input
                  id="pollingInterval"
                  type="number"
                  min="5"
                  value={formData.pollingInterval}
                  onChange={(e) => handleChange('pollingInterval', Number(e.target.value))}
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
            
            <div className="space-y-2">
              <Label htmlFor="pollingCondition">Условие срабатывания</Label>
              <Textarea
                id="pollingCondition"
                value={formData.pollingCondition}
                onChange={(e) => handleChange('pollingCondition', e.target.value)}
                placeholder='{"logic":"AND","conditions":[{"path":"data.status","op":"==","value":"ok"}]}'
                rows={3}
              />
            </div>
            
            <div className="flex items-center space-x-2 pt-2">
              <Checkbox
                id="pollingContinueAfterMatch"
                checked={formData.pollingContinueAfterMatch}
                onCheckedChange={(checked) => handleChange('pollingContinueAfterMatch', checked)}
              />
              <Label htmlFor="pollingContinueAfterMatch">Продолжать после совпадения</Label>
            </div>
          </div>
        )}
      </div>

      {/* Шаг 3: Действие */}
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="actionUrl">URL действия</Label>
          <Input
            id="actionUrl"
            value={formData.actionUrl}
            onChange={(e) => handleChange('actionUrl', e.target.value)}
            placeholder="https://api.example.com/action"
          />
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="actionMethod">Метод действия</Label>
            <Select 
              value={formData.actionMethod} 
              onValueChange={(value) => handleChange('actionMethod', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="POST">POST</SelectItem>
                <SelectItem value="GET">GET</SelectItem>
                <SelectItem value="PUT">PUT</SelectItem>
                <SelectItem value="PATCH">PATCH</SelectItem>
                <SelectItem value="DELETE">DELETE</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="actionHeaders">Headers действия (JSON)</Label>
          <Textarea
            id="actionHeaders"
            value={formData.actionHeaders}
            onChange={(e) => handleChange('actionHeaders', e.target.value)}
            placeholder='{"Authorization": "Bearer token"}'
            rows={2}
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="actionBody">Body действия (JSON)</Label>
          <Textarea
            id="actionBody"
            value={formData.actionBody}
            onChange={(e) => handleChange('actionBody', e.target.value)}
            placeholder='{"status": "processed"}'
            rows={3}
          />
        </div>
      </div>

      {/* Шаг 4: Уведомления */}
      <div className="space-y-4">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="sendToTelegram"
            checked={formData.sendToTelegram}
            onCheckedChange={(checked) => handleChange('sendToTelegram', checked)}
          />
          <Label htmlFor="sendToTelegram">Отправлять результат в Telegram</Label>
        </div>
        
        {formData.sendToTelegram && (
          <>
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
              <Label htmlFor="messageTemplate">Шаблон сообщения</Label>
              <Textarea
                id="messageTemplate"
                value={formData.messageTemplate}
                onChange={(e) => handleChange('messageTemplate', e.target.value)}
                placeholder="Интеграция '${payload.name}' выполнена"
                rows={3}
              />
            </div>
          </>
        )}
      </div>

      {/* Шаг 5: Подтверждение */}
      <div className="space-y-6">
        <div className="border rounded-lg p-4 bg-muted">
          <h3 className="font-medium mb-2">Проверьте настройки интеграции</h3>
          <div className="text-sm space-y-1">
            <p><span className="font-medium">Название:</span> {formData.name}</p>
            <p><span className="font-medium">Статус:</span> {formData.enabled ? 'Активна' : 'Неактивна'}</p>
            <p><span className="font-medium">Тип триггера:</span> {formData.triggerType === 'webhook' ? 'Webhook' : 'Polling'}</p>
            <p><span className="font-medium">Отправка в Telegram:</span> {formData.sendToTelegram ? 'Да' : 'Нет'}</p>
          </div>
        </div>
        
        {formData.sendToTelegram && (
          <TelegramPreviewWithToggle 
            message={formData.messageTemplate || previewMessage} 
            payload={payloadExample} 
            context="integration" 
          />
        )}
      </div>
    </MultiStepForm>
  );
}