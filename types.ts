export interface ReportItem {
  id: string;
  employeeName: string;
  date: string;
  department: '蔬果' | '水产' | '肉品冻品' | '熟食' | '烘焙' | '食百' | '后勤' | '仓库';
  content: string;
}

export interface ParseResult {
  reports: ReportItem[];
  summary: string;
}

export enum ParsingStatus {
  IDLE = 'IDLE',
  ANALYZING = 'ANALYZING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR'
}