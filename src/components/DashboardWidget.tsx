import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { cn } from '../lib/utils';
import { LucideIcon } from 'lucide-react';

interface DashboardWidgetProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: LucideIcon;
  trend?: {
    value: number;
    label: string;
  };
  status?: 'positive' | 'negative' | 'neutral';
  className?: string;
}

export function DashboardWidget({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  status = 'neutral',
  className
}: DashboardWidgetProps) {
  const statusColors = {
    positive: 'text-[hsl(var(--success))] bg-[hsl(var(--success)_/_0.1)]',
    negative: 'text-[hsl(var(--destructive))] bg-[hsl(var(--destructive)_/_0.1)]',
    neutral: 'text-[hsl(var(--muted-foreground))] bg-[hsl(var(--muted)_/_0.1)]'
  };

  return (
    <Card className={cn('h-full', className)}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-[hsl(var(--muted-foreground))]">
          {title}
        </CardTitle>
        {Icon && <Icon className="h-5 w-5 text-[hsl(var(--muted-foreground))]" />}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {subtitle && <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">{subtitle}</p>}
        {trend && (
          <div className="mt-2">
            <Badge variant="outline" className={cn('text-xs', statusColors[status])}>
              {trend.value > 0 ? '+' : ''}{trend.value}% {trend.label}
            </Badge>
          </div>
        )}
      </CardContent>
    </Card>
  );
}