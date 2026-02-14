import React, { useMemo } from 'react';
import { ReportItem } from '../types';
import { Trash2, Calendar } from 'lucide-react';

interface ReportTableProps {
  reports: ReportItem[];
  onDelete: (id: string) => void;
}

// Fixed department order as requested
const DEPARTMENTS = ['蔬果', '水产', '肉品冻品', '熟食', '烘焙', '食百', '后勤', '仓库'] as const;

export const ReportTable: React.FC<ReportTableProps> = ({ reports, onDelete }) => {
  if (reports.length === 0) return null;

  // Group data by Date -> Department
  const groupedData = useMemo(() => {
    const groups: Record<string, Record<string, ReportItem[]>> = {};
    
    reports.forEach(report => {
      const date = report.date;
      if (!groups[date]) groups[date] = {};
      
      const dept = report.department;
      if (!groups[date][dept]) groups[date][dept] = [];
      
      groups[date][dept].push(report);
    });

    // Sort dates descending
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  }, [reports]);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500 overflow-x-auto">
      <table className="w-full text-sm text-left border-collapse min-w-[1200px]">
        <thead>
          <tr className="bg-gray-100 text-gray-700 font-bold border-b border-gray-300">
            <th className="px-4 py-4 w-32 border-r border-gray-200 sticky left-0 bg-gray-100 z-10 text-center">
              日期
            </th>
            {DEPARTMENTS.map(dept => (
              <th key={dept} className="px-4 py-4 border-r border-gray-200 text-center min-w-[180px]">
                {dept}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {groupedData.map(([date, deptData]) => (
            <tr key={date} className="hover:bg-blue-50/30 transition-colors">
              {/* Date Column */}
              <td className="px-4 py-4 font-mono font-medium text-gray-900 border-r border-gray-100 bg-white sticky left-0 z-10 text-center align-middle shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                <div className="flex flex-col items-center justify-center gap-1">
                  <Calendar className="w-4 h-4 text-blue-500" />
                  <span>{date}</span>
                </div>
              </td>

              {/* Department Columns */}
              {DEPARTMENTS.map(dept => {
                const items = deptData[dept];
                const hasItems = items && items.length > 0;

                return (
                  <td key={`${date}-${dept}`} className="px-3 py-3 border-r border-gray-100 align-top relative group">
                    {!hasItems ? (
                      <div className="flex items-center justify-center h-full min-h-[60px]">
                        <span className="text-red-500 font-extrabold text-3xl opacity-80 select-none">缺</span>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-3">
                        {items.map(report => (
                          <div key={report.id} className="relative bg-gray-50 rounded-lg p-3 border border-gray-100 hover:border-blue-200 hover:bg-white transition-all">
                            <div className="font-bold text-xs text-blue-700 mb-2 flex justify-between items-center border-b border-gray-100 pb-1">
                              <span>{report.employeeName}</span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (confirm(`确认删除 ${report.employeeName} 的这条汇报吗?`)) {
                                    const password = prompt("请输入管理员密码进行删除:");
                                    if (password === "admin888") {
                                      onDelete(report.id);
                                    } else if (password !== null) {
                                      alert("密码错误，无法删除");
                                    }
                                  }
                                }}
                                className="text-gray-300 hover:text-red-500 transition-colors p-1"
                                title="删除此条"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                            {/* Improved typography for lists: leading-relaxed and strict whitespace handling */}
                            <div className="text-gray-700 text-xs whitespace-pre-wrap break-words leading-6 font-mono">
                              {report.content}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};