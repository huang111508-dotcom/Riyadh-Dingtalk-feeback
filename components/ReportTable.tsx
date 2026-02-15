import React, { useMemo, useState, useEffect } from 'react';
import { ReportItem } from '../types';
import { Trash2, Calendar, X, User, MapPin, AlignLeft, Maximize2, Copy, Check } from 'lucide-react';

interface ReportTableProps {
  reports: ReportItem[];
  onDelete: (id: string) => void;
}

const DEPARTMENTS = ['蔬果', '水产', '肉品冻品', '熟食', '烘焙', '食百', '后勤', '仓库'] as const;

export const ReportTable: React.FC<ReportTableProps> = ({ reports, onDelete }) => {
  const [selectedReport, setSelectedReport] = useState<ReportItem | null>(null);
  const [copied, setCopied] = useState(false);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (selectedReport) {
      document.body.style.overflow = 'hidden';
      setCopied(false);
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [selectedReport]);

  const handleCopy = async () => {
    if (!selectedReport) return;
    try {
      await navigator.clipboard.writeText(selectedReport.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

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
    <>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 animate-in fade-in slide-in-from-bottom-4 duration-500 overflow-auto relative max-h-[80vh]">
        {/* Scroll hint gradient for right side */}
        <div className="absolute top-0 right-0 bottom-0 w-4 bg-gradient-to-l from-black/5 to-transparent pointer-events-none z-40 sm:hidden"></div>
        
        <table className="w-full text-sm text-left border-collapse">
          <thead>
            <tr className="bg-gray-100 text-gray-700 font-bold border-b border-gray-300">
              <th className="px-3 py-4 w-28 border-r border-gray-200 sticky left-0 top-0 bg-gray-100 z-30 text-center shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                日期
              </th>
              {DEPARTMENTS.map(dept => (
                <th key={dept} className="px-2 py-4 border-r border-gray-200 text-center min-w-[120px] sticky top-0 bg-gray-100 z-20 shadow-[0_2px_2px_-1px_rgba(0,0,0,0.05)]">
                  {dept}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {groupedData.map(([date, deptData]) => (
              <tr key={date} className="hover:bg-blue-50/30 transition-colors">
                {/* Date Column */}
                <td className="px-3 py-4 font-mono font-medium text-gray-900 border-r border-gray-100 bg-white sticky left-0 z-10 text-center align-middle shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
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
                    <td key={`${date}-${dept}`} className="px-2 py-3 border-r border-gray-100 align-top relative group min-w-[120px]">
                      {!hasItems ? (
                        <div className="flex items-center justify-center h-full min-h-[60px]">
                          {/* Replaced '-' with large '缺' character */}
                          <span className="text-gray-200 font-bold text-3xl select-none">缺</span>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-3">
                          {items.map(report => (
                            <div 
                              key={report.id} 
                              role="button"
                              tabIndex={0}
                              onClick={() => setSelectedReport(report)}
                              className="relative bg-gray-50 rounded-lg p-3 border border-gray-200 cursor-pointer active:bg-blue-50 transition-colors group/card hover:border-blue-300 hover:shadow-sm select-none"
                            >
                              <div className="font-bold text-xs text-blue-700 mb-2 flex justify-between items-center border-b border-gray-200 pb-1.5">
                                <span className="truncate max-w-[80px]">{report.employeeName}</span>
                                <div className="flex items-center gap-1">
                                   {/* Hint icon for expand */}
                                   <Maximize2 className="w-3 h-3 text-gray-400 opacity-60 group-hover/card:opacity-100" />
                                   
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
                              </div>
                              <div className="text-gray-700 text-xs whitespace-pre-wrap break-words leading-5 font-mono line-clamp-4 overflow-hidden max-h-[5rem]">
                                {report.content}
                              </div>
                              <div className="absolute bottom-1 left-0 w-full h-4 bg-gradient-to-t from-gray-50 to-transparent pointer-events-none"></div>
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

      {/* Full Screen Details Modal */}
      {selectedReport && (
        <div 
          className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4 animate-in fade-in duration-200"
          onClick={() => setSelectedReport(null)}
        >
          {/* Modal Container */}
          <div 
            className="bg-white w-full h-[85vh] sm:h-auto sm:max-w-2xl sm:max-h-[85vh] rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in slide-in-from-bottom-10 sm:zoom-in-95 duration-300 relative"
            onClick={(e) => e.stopPropagation()}
          >
             {/* Drag Handle for Mobile */}
             <div className="w-12 h-1.5 bg-gray-300 rounded-full mx-auto mt-3 mb-1 sm:hidden shrink-0" />

            {/* Modal Header */}
            <div className="px-6 py-4 bg-white border-b border-gray-100 flex items-center justify-between shrink-0">
              <div className="flex flex-col">
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <User className="w-5 h-5 text-blue-600" />
                  {selectedReport.employeeName}
                </h3>
                <div className="flex items-center gap-3 text-sm text-gray-500 mt-1">
                   <div className="flex items-center gap-1">
                     <MapPin className="w-3.5 h-3.5" />
                     {selectedReport.department}
                   </div>
                   <div className="flex items-center gap-1">
                     <Calendar className="w-3.5 h-3.5" />
                     {selectedReport.date}
                   </div>
                </div>
              </div>
              <button 
                onClick={() => setSelectedReport(null)}
                className="p-2 bg-gray-100 hover:bg-gray-200 rounded-full text-gray-600 transition-colors"
                aria-label="Close"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Modal Content - Scrollable */}
            <div className="p-6 overflow-y-auto overscroll-contain flex-1 bg-white">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-gray-400 text-sm uppercase tracking-wider font-semibold">
                  <AlignLeft className="w-4 h-4" />
                  汇报详情
                </div>
                <button 
                  onClick={handleCopy}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${copied ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? '已复制' : '复制文本'}
                </button>
              </div>
              
              <div className="bg-gray-50 p-5 rounded-xl border border-gray-100 text-gray-800 text-base leading-relaxed whitespace-pre-wrap font-mono selection:bg-blue-100 selection:text-blue-900">
                {selectedReport.content}
              </div>
            </div>

            {/* Modal Footer - Fixed at bottom */}
            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3 shrink-0 pb-8 sm:pb-4 safe-area-bottom">
               <button
                  onClick={() => {
                    if (confirm(`确认删除 ${selectedReport.employeeName} 的这条汇报吗?`)) {
                      const password = prompt("请输入管理员密码进行删除:");
                      if (password === "admin888") {
                        onDelete(selectedReport.id);
                        setSelectedReport(null); 
                      } else if (password !== null) {
                        alert("密码错误，无法删除");
                      }
                    }
                  }}
                  className="flex items-center gap-2 px-4 py-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg text-sm font-medium transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  删除
                </button>
              <button 
                onClick={() => setSelectedReport(null)}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors shadow-lg shadow-blue-500/20 active:scale-95"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};