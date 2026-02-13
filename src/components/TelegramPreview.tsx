import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

interface TelegramPreviewProps {
  message: string;
}

export function TelegramPreview({ message }: TelegramPreviewProps) {
  return (
    <Card className="border border-[hsl(var(--border))] bg-[hsl(var(--muted))]">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <span className="text-blue-500">📱</span>
          Предварительный просмотр сообщения
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="bg-blue-500 rounded-full w-8 h-8 flex items-center justify-center text-white text-sm font-medium">
              B
            </div>
            <div className="flex-1">
              <div className="font-medium text-sm mb-1">Webhook Bot</div>
              <div className="text-gray-800 text-sm whitespace-pre-wrap break-words">
                {message}
              </div>
              <div className="text-xs text-gray-500 mt-1">Только что</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}