import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Calendar, Clock, MessageSquare, Bot, Repeat, Link2 } from 'lucide-react';

interface TimelineEvent {
  id: number;
  title: string;
  description: string;
  timestamp: string;
  type: 'webhook' | 'polling' | 'integration' | 'bot' | 'message';
  status: 'success' | 'error' | 'warning' | 'pending';
}

interface TimelineProps {
  title: string;
  events: TimelineEvent[];
}

export function Timeline({ title, events }: TimelineProps) {
  const getEventTypeIcon = (type: string) => {
    switch (type) {
      case 'webhook': return <MessageSquare className="h-4 w-4" />;
      case 'polling': return <Repeat className="h-4 w-4" />;
      case 'integration': return <Link2 className="h-4 w-4" />;
      case 'bot': return <Bot className="h-4 w-4" />;
      default: return <MessageSquare className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return 'bg-[hsl(var(--success))]';
      case 'error': return 'bg-[hsl(var(--destructive))]';
      case 'warning': return 'bg-[hsl(var(--warning))]';
      case 'pending': return 'bg-[hsl(var(--muted-foreground))]';
      default: return 'bg-[hsl(var(--muted-foreground))]';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {events.map((event, index) => (
            <div key={event.id} className="relative pl-8 pb-6 last:pb-0">
              {/* Vertical line */}
              {index !== events.length - 1 && (
                <div className="absolute left-4 top-8 w-0.5 h-full bg-[hsl(var(--border))] -translate-x-1/2"></div>
              )}
              
              {/* Event marker */}
              <div className="absolute left-0 top-0 flex items-center justify-center w-8 h-8 rounded-full bg-[hsl(var(--card))] border border-[hsl(var(--border))]">
                <div className={`w-3 h-3 rounded-full ${getStatusColor(event.status)}`}></div>
              </div>
              
              {/* Event content */}
              <div className="pl-2">
                <div className="flex items-start justify-between">
                  <h4 className="font-medium text-sm">{event.title}</h4>
                  <Badge variant="outline" className="text-xs capitalize">
                    {event.status}
                  </Badge>
                </div>
                
                <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1 mb-2">
                  {event.description}
                </p>
                
                <div className="flex items-center gap-4 text-xs text-[hsl(var(--muted-foreground))]">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {new Date(event.timestamp).toLocaleDateString('ru-RU')}
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {new Date(event.timestamp).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <div className="flex items-center gap-1">
                    {getEventTypeIcon(event.type)}
                    <span className="capitalize">{event.type}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}