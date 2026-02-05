import React, { useState } from 'react';
import { Clipboard, Sparkles, FileText } from 'lucide-react';

interface InputSectionProps {
  onAnalyze: (text: string) => void;
  isAnalyzing: boolean;
}

export const InputSection: React.FC<InputSectionProps> = ({ onAnalyze, isAnalyzing }) => {
  const [text, setText] = useState('');

  const handlePaste = async () => {
    try {
      const clipboardText = await navigator.clipboard.readText();
      setText(clipboardText);
    } catch (err) {
      console.error('Failed to read clipboard contents: ', err);
    }
  };

  const handleAnalyzeClick = () => {
    if (text.trim()) {
      onAnalyze(text);
    }
  };

  // Updated placeholder to match the new department structure
  const placeholder = `请粘贴钉钉/微信群的日报内容 (示例):

王强 (蔬果课) 2023-10-27
1. 今日西瓜到货500斤，质量良好，已全部上架。
2. 处理叶菜损耗，共计20斤。

李芳 (肉品冻品)
- 冻品展柜温度异常，已报修
- 猪肉销售情况稳定，需补前腿肉

张伟 (仓库)
1. 完成今日到货入库清点
2. 整理B区货架，腾出空位`;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
          <FileText className="w-5 h-5 text-blue-600" />
          工作汇报输入 (Data Input)
        </h2>
        <button
          onClick={handlePaste}
          className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1 transition-colors"
        >
          <Clipboard className="w-4 h-4" />
          粘贴内容 (Paste)
        </button>
      </div>
      
      <div className="relative">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={placeholder}
          className="w-full h-48 p-4 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all resize-none text-sm font-mono text-gray-700"
        />
        <div className="absolute bottom-4 right-4">
          <button
            onClick={handleAnalyzeClick}
            disabled={isAnalyzing || !text.trim()}
            className={`
              flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium text-white shadow-lg shadow-blue-500/30 transition-all
              ${isAnalyzing || !text.trim() 
                ? 'bg-gray-400 cursor-not-allowed shadow-none' 
                : 'bg-blue-600 hover:bg-blue-700 hover:scale-105 active:scale-95'}
            `}
          >
            {isAnalyzing ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                正在整理...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                智能汇总 (Generate)
              </>
            )}
          </button>
        </div>
      </div>
      <p className="mt-3 text-xs text-gray-500">
        提示：支持多选聊天记录合并转发，直接复制粘贴到这里。AI 将自动按部门归类。
      </p>
    </div>
  );
};