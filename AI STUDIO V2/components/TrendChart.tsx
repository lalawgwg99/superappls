import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { ChartDataPoint } from '../types';

interface TrendChartProps {
  data: ChartDataPoint[];
}

const TrendChart: React.FC<TrendChartProps> = ({ data }) => {
  // We need to pivot the data for Recharts if we have multiple categories per month
  // Or, we can just filter top categories. 
  // For simplicity given the AI output structure, let's group by month for the X-axis 
  // and have different lines for categories.

  // 1. Get unique categories
  const categories: string[] = Array.from(new Set(data.map(d => d.category))) as string[];
  const months: string[] = (Array.from(new Set(data.map(d => d.month))) as string[]).sort();

  // 2. Transform to Recharts format: { month: '2025-01', 'Heating': 120, 'Cooling': 10 }
  const chartData = months.map(month => {
    const entry: any = { month };
    categories.forEach((cat: string) => {
      const point = data.find(d => d.month === month && d.category === cat);
      entry[cat] = point ? point.sales : 0;
    });
    return entry;
  });

  // Color palette for lines
  const colors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];

  return (
    <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100 mb-8">
      <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
        歷史銷售趨勢分析
      </h3>
      <div className="h-[350px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{
              top: 5,
              right: 30,
              left: 20,
              bottom: 5,
            }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="month" stroke="#6b7280" />
            <YAxis stroke="#6b7280" />
            <Tooltip 
              contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
            />
            <Legend wrapperStyle={{ paddingTop: '20px' }} />
            {categories.map((cat, index) => (
              <Line
                key={cat}
                type="monotone"
                dataKey={cat}
                name={cat}
                stroke={colors[index % colors.length]}
                strokeWidth={3}
                dot={{ r: 4, strokeWidth: 2 }}
                activeDot={{ r: 6 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-4 text-sm text-gray-500 text-center">
        * 數據基於您提供的歷史資料，由 AI 自動聚合生成。
      </p>
    </div>
  );
};

export default TrendChart;