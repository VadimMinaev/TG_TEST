import React from 'react';
import { Bar, BarChart, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart, Line, LineChart } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

interface ChartDataPoint {
  name: string;
  value: number;
}

interface StatsChartProps {
  title: string;
  data: ChartDataPoint[];
  type?: 'bar' | 'area' | 'line';
  color?: string;
  height?: number;
}

export function StatsChart({ 
  title, 
  data, 
  type = 'bar', 
  color = 'hsl(var(--primary))', 
  height = 200 
}: StatsChartProps) {
  const chartComponents = {
    bar: BarChart,
    area: AreaChart,
    line: LineChart
  };

  const chartElements = {
    bar: <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} />,
    area: <Area type="monotone" dataKey="value" stroke={color} fill={color} fillOpacity={0.2} />,
    line: <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
  };

  const ChartComponent = chartComponents[type];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div style={{ height: `${height}px` }}>
          <ResponsiveContainer width="100%" height="100%">
            <ChartComponent data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis 
                dataKey="name" 
                stroke="hsl(var(--muted-foreground))" 
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <YAxis 
                stroke="hsl(var(--muted-foreground))" 
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  borderColor: 'hsl(var(--border))',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)'
                }}
                itemStyle={{ color: 'hsl(var(--foreground))' }}
                labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 'bold' }}
              />
              {chartElements[type]}
            </ChartComponent>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}