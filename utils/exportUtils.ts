import * as XLSX from 'xlsx';
import { ReportItem } from '../types';

// Updated list
const DEPARTMENTS = ['蔬果', '水产', '肉品冻品', '熟食', '烘焙', '食百', '后勤', '仓库'];

export const exportToExcel = (reports: ReportItem[], filename: string = 'DingTalk_Summary.xlsx') => {
  // 1. Group data by Date -> Department
  const grouped: Record<string, Record<string, string[]>> = {};

  reports.forEach(r => {
    if (!grouped[r.date]) grouped[r.date] = {};
    if (!grouped[r.date][r.department]) grouped[r.date][r.department] = [];
    
    // Format: [Name]: Content
    const content = `【${r.employeeName}】\n${r.content}`;
    grouped[r.date][r.department].push(content);
  });

  // 2. Transform to Flat Array for Excel
  // Get all unique dates and sort them
  const dates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  const worksheetData = dates.map(date => {
    const row: any = { '日期': date };
    
    DEPARTMENTS.forEach(dept => {
      const entries = grouped[date][dept];
      if (entries && entries.length > 0) {
        // Join multiple people's reports with double newline
        row[dept] = entries.join('\n\n-------------------\n\n');
      } else {
        row[dept] = '缺'; // Explicitly mark as missing
      }
    });

    return row;
  });

  // 3. Create Workbook
  const worksheet = XLSX.utils.json_to_sheet(worksheetData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Daily Summary");
  
  // 4. Set Column Widths
  const wscols = [
    { wch: 15 }, // Date
    { wch: 30 }, // 蔬果
    { wch: 30 }, // 水产
    { wch: 30 }, // 肉品冻品
    { wch: 30 }, // 熟食
    { wch: 30 }, // 烘焙
    { wch: 30 }, // 食百
    { wch: 30 }, // 后勤
    { wch: 30 }, // 仓库
  ];
  worksheet['!cols'] = wscols;

  // 5. Write File
  XLSX.writeFile(workbook, filename);
};