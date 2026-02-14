import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, LabelList, Legend } from 'recharts';
import { ReportItem } from '../types';

interface DashboardProps {
  reports: ReportItem[];
}

const COLORS = ['#F97316', '#3B82F6', '#22C55E', '#EF4444', '#8B5CF6', '#EC4899', '#6B7280'];

export const Dashboard: React.FC<DashboardProps> = ({ reports }) => {
  // 1. Department Data Processing
  const deptData = useMemo(() => {
    const counts: Record<string, number> = {};
    
    reports.forEach(r => {
      const dept = r.department ? r.department.trim() : 'Unknown';
      counts[dept] = (counts[dept] || 0) + 1;
    });

    return Object.keys(counts)
      .map(key => ({ name: key, value: counts[key] }))
      .sort((a, b) => b.value - a.value);
  }, [reports]);

  // 2. Employee Workload Processing
  const workloadData = useMemo(() => {
    const groups: Record<string, { count: number; displayName: string }> = {};
    
    reports.forEach(r => {
      const originalName = r.employeeName ? r.employeeName.trim() : 'Unknown';
      const chinesePart = originalName.replace(/[^\u4e00-\u9fa5]/g, '');
      const key = chinesePart.length > 0 ? chinesePart : originalName;

      if (!groups[key]) {
        groups[key] = { count: 0, displayName: originalName };
      }

      groups[key].count += 1;

      if (originalName.length > groups[key].displayName.length) {
        groups[key].displayName = originalName;
      }
    });

    return Object.values(groups)
      .map(group => ({ name: group.displayName, count: group.count }))
      .sort((a, b) => b.count - a.count);
  }, [reports]);

  if (reports.length === 0) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
      {/* Department Distribution (Pie Chart) */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 flex flex-col">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">
          各部门汇报次数统计 (Reports by Dept)
        </h3>
        <p className="text-xs text-gray-400 mb-4">
          统计所选时间段内的实际提交总数
        </p>
        <div className="w-full h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={deptData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={2}
                dataKey="value"
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                labelLine={false}
              >
                {deptData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip 
                formatter={(value: number) => [`${value} 条汇报`, '提交数量']}
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
              />
              <Legend verticalAlign="bottom" height={36}/>
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Reports per Employee (Horizontal Bar Chart) */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 flex flex-col">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">
          员工汇报数量 (Reports by Person)
        </h3>
        <p className="text-xs text-gray-400 mb-4">
          按提交次数从高到低排列
        </p>
        
        <div className="w-full" style={{ height: Math.max(300, workloadData.length * 40) }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              layout="vertical"
              data={workloadData}
              margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f3f4f6" />
              <XAxis type="number" hide={true} />
              <YAxis 
                dataKey="name" 
                type="category" 
                width={140}
                tick={{ fontSize: 12, fill: '#374151' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip 
                cursor={{ fill: '#f9fafb' }}
                formatter={(value: number) => [`${value} 次`, '汇报次数']}
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
              />
              <Bar 
                dataKey="count" 
                fill="#6366f1" 
                radius={[0, 4, 4, 0]} 
                barSize={20}
              >
                <LabelList dataKey="count" position="right" fill="#6B7280" fontSize={12} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
