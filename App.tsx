import React, { useState, useEffect, useMemo } from 'react';
import { InputSection } from './components/InputSection';
import { ReportTable } from './components/ReportTable';
import { Dashboard } from './components/Dashboard';
import { parseDingTalkLogs } from './services/geminiService';
import { exportToExcel } from './utils/exportUtils';
import { ReportItem, ParsingStatus } from './types';
import { Download, LayoutDashboard, MessageSquareText, RefreshCw, Calendar as CalendarIcon, Filter, Cloud, CloudOff, AlertTriangle, X, History, Smartphone, Share, Trash2 } from 'lucide-react';
import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, deleteDoc, doc, writeBatch, getDocs, where } from "firebase/firestore";

// ------------------------------------------------------------------
// Firebase Configuration
// ------------------------------------------------------------------
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyB60RoAnYkY7GRbApw7cztr4t2mQTLbxj0",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "riyadh-dingtalk-feeback.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "riyadh-dingtalk-feeback",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "riyadh-dingtalk-feeback.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "568013950248",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:568013950248:web:83fb340f6589a0e7e0d41d",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || ""
};

const isConfigured = 
  firebaseConfig.apiKey && 
  firebaseConfig.apiKey !== "YOUR_FIREBASE_API_KEY" && 
  firebaseConfig.apiKey !== "";

let db: any = null;

if (isConfigured) {
  try {
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
  } catch (e) {
    console.error("Firebase init error:", e);
  }
}

const getDateDaysAgo = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const LOCAL_STORAGE_KEY = 'dingtalk_reports_data';

const App: React.FC = () => {
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [status, setStatus] = useState<ParsingStatus>(ParsingStatus.IDLE);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showBanner, setShowBanner] = useState<boolean>(!isConfigured);
  
  // Date Range Filtering State
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Performance Optimization
  const [isFullHistory, setIsFullHistory] = useState<boolean>(false);

  // PWA Install State
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSHint, setShowIOSHint] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  // PWA & iOS Detection
  useEffect(() => {
    // Check if already installed/standalone
    const checkStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
    setIsStandalone(!!checkStandalone);

    // Detect iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIosDevice);

    // Capture install prompt (Android/Desktop)
    const handler = (e: any) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = () => {
    if (isIOS) {
      setShowIOSHint(true);
    } else if (installPrompt) {
      installPrompt.prompt();
      installPrompt.userChoice.then((choiceResult: any) => {
        if (choiceResult.outcome === 'accepted') {
          setInstallPrompt(null);
        }
      });
    }
  };

  useEffect(() => {
    if (startDate && !isFullHistory) {
      setIsFullHistory(true);
    }
  }, [startDate, isFullHistory]);

  // Cloud Sync
  useEffect(() => {
    if (!isConfigured || !db) return;

    let q;
    if (isFullHistory) {
      q = query(collection(db, "reports"), orderBy("date", "desc"));
    } else {
      const fourteenDaysAgo = getDateDaysAgo(14);
      q = query(
        collection(db, "reports"), 
        where("date", ">=", fourteenDaysAgo),
        orderBy("date", "desc")
      );
    }
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const cloudReports = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ReportItem[];
      setReports(cloudReports);
    }, (error) => {
      console.error("Sync error:", error);
      if (error.code === 'permission-denied') {
        setErrorMsg("Cloud sync failed: Permission denied. Please check Firestore Rules.");
      }
    });

    return () => unsubscribe();
  }, [isFullHistory]);

  // Local Sync
  useEffect(() => {
    if (isConfigured) return;
    try {
      const savedData = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (savedData) {
        const parsed = JSON.parse(savedData);
        setReports(parsed);
      }
    } catch (e) {
      console.error("Failed to load local data", e);
    }
  }, []);

  useEffect(() => {
    if (isConfigured) return;
    if (reports.length > 0) {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(reports));
    }
  }, [reports]);

  const handleAnalyze = async (text: string) => {
    setStatus(ParsingStatus.ANALYZING);
    setErrorMsg(null);
    try {
      const newReports = await parseDingTalkLogs(text);
      if (isConfigured && db) {
        const uploadPromises = newReports.map(item => {
          const { id, ...data } = item;
          return addDoc(collection(db, "reports"), data);
        });
        await Promise.all(uploadPromises);
      } else {
        setReports(prev => {
          const updated = [...newReports, ...prev];
          return updated.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        });
      }
      setStatus(ParsingStatus.SUCCESS);
    } catch (e: any) {
      console.error(e);
      setStatus(ParsingStatus.ERROR);
      // Show the actual error message
      setErrorMsg(e.message || "Failed to parse the text. Please check your AI API key or text format.");
    }
  };

  const handleDelete = async (id: string) => {
    if (isConfigured && db) {
      try {
        await deleteDoc(doc(db, "reports", id));
      } catch (e) {
        console.error("Delete failed", e);
        alert("Failed to delete from cloud. Check permissions.");
      }
    } else {
      const newReports = reports.filter(r => r.id !== id);
      setReports(newReports);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newReports));
    }
  };

  const displayedReports = useMemo(() => {
    if (!startDate && !endDate) return reports;
    return reports.filter(r => {
      let isValid = true;
      if (startDate && r.date < startDate) isValid = false;
      if (endDate && r.date > endDate) isValid = false;
      return isValid;
    });
  }, [reports, startDate, endDate]);

  const isFiltered = !!(startDate || endDate);

  const handleExport = () => {
    let filename = 'DingTalk_Summary';
    if (startDate && endDate) {
      filename += `_${startDate}_to_${endDate}`;
    } else if (startDate) {
      filename += `_from_${startDate}`;
    } else if (endDate) {
      filename += `_until_${endDate}`;
    } else {
      filename += `_All_Time`;
    }
    exportToExcel(displayedReports, `${filename}.xlsx`);
  };

  const handleReset = async () => {
    const confirmMsg = isConfigured 
      ? "警告：这将永久删除云端数据库中的【所有】记录，且不可恢复！继续？" 
      : "确定要清空本地所有数据吗？";

    if (confirm(confirmMsg)) {
      const password = prompt("请输入管理员密码以执行清空操作:");
      if (password !== "admin888") {
        if (password !== null) alert("密码错误，操作已取消。");
        return;
      }

      if (isConfigured && db) {
        try {
          setStatus(ParsingStatus.ANALYZING);
          const q = query(collection(db, "reports"));
          const snapshot = await getDocs(q);
          const batch = writeBatch(db);
          snapshot.docs.forEach((doc) => {
            batch.delete(doc.ref);
          });
          await batch.commit();
          setStatus(ParsingStatus.IDLE);
        } catch (e) {
          console.error("Batch delete failed", e);
          alert("Failed to clear cloud data.");
          setStatus(ParsingStatus.IDLE);
        }
      } else {
        setReports([]);
        localStorage.removeItem(LOCAL_STORAGE_KEY);
        setStatus(ParsingStatus.IDLE);
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 pb-20">
      
      {/* iOS Install Hint Modal */}
      {showIOSHint && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-sm rounded-2xl p-6 relative shadow-2xl animate-in slide-in-from-bottom-10 duration-300">
            <button 
              onClick={() => setShowIOSHint(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              <X className="w-6 h-6" />
            </button>
            <h3 className="text-lg font-bold text-gray-900 mb-2">安装到 iPhone/iPad</h3>
            <p className="text-sm text-gray-600 mb-4">
              iOS 不支持自动安装。请按以下步骤手动添加：
            </p>
            <div className="space-y-4 text-sm">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center shrink-0">
                  <Share className="w-4 h-4 text-blue-600" />
                </div>
                <span>1. 点击浏览器底部的 <strong>"分享"</strong> 按钮</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center shrink-0">
                  <div className="w-4 h-4 border-2 border-gray-400 rounded-sm flex items-center justify-center">
                    <span className="text-xs font-bold">+</span>
                  </div>
                </div>
                <span>2. 向下滑动并选择 <strong>"添加到主屏幕"</strong></span>
              </div>
            </div>
            <div className="mt-6 text-center">
              <button 
                onClick={() => setShowIOSHint(false)}
                className="text-blue-600 font-medium hover:underline"
              >
                我知道了
              </button>
            </div>
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-white rotate-45 transform sm:hidden"></div>
          </div>
        </div>
      )}

      {/* Configuration Warning Banner */}
      {!isConfigured && showBanner && (
        <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-3 text-sm text-yellow-800 relative">
          <div className="flex items-start gap-3 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-yellow-600" />
            <div className="flex-1 pr-8">
              <h3 className="font-semibold text-yellow-900">使用本地模式 (Local Mode)</h3>
              <p className="mt-1 text-yellow-800">
                未检测到 Firebase 配置，数据保存在本地缓存中。
              </p>
            </div>
            <button 
              onClick={() => setShowBanner(false)}
              className="absolute top-2 right-2 p-1.5 text-yellow-700 hover:bg-yellow-100 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-20 safe-area-top">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2">
          {/* Logo Section - Hidden title on mobile to save space */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white shrink-0 shadow-sm shadow-blue-500/30">
              <MessageSquareText className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-gray-900 truncate hidden md:block">日报助手</h1>
            <div className={`hidden lg:flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium border ${isConfigured ? 'bg-green-50 text-green-700 border-green-100' : 'bg-gray-100 text-gray-600 border-gray-200'}`}>
               {isConfigured ? <Cloud className="w-3 h-3" /> : <CloudOff className="w-3 h-3" />}
               <span>{isConfigured ? 'Sync' : 'Local'}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-1 justify-end">
             {/* Install App Button */}
             {!isStandalone && (installPrompt || isIOS) && (
               <button
                 onClick={handleInstallClick}
                 className="flex items-center gap-2 bg-blue-50 text-blue-700 px-2 py-1.5 sm:px-3 rounded-lg text-sm font-medium hover:bg-blue-100 transition-colors animate-pulse whitespace-nowrap"
               >
                 <Smartphone className="w-4 h-4" />
                 <span className="hidden sm:inline">安装 App</span>
               </button>
             )}

             {/* Date Range Filter - Compact for Mobile */}
             <div className="flex items-center bg-gray-50 border border-gray-300 rounded-lg px-2 py-1.5 shadow-sm focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 transition-all">
                <div className="relative group flex items-center gap-1">
                   <input 
                     type="date"
                     value={startDate}
                     onChange={(e) => setStartDate(e.target.value)}
                     className="w-24 sm:w-auto bg-transparent border-none p-0 text-sm text-gray-700 focus:ring-0 font-medium outline-none"
                   />
                </div>
                <span className="mx-1 text-gray-300">|</span>
                <div className="relative group flex items-center gap-1">
                   <input 
                     type="date"
                     value={endDate}
                     onChange={(e) => setEndDate(e.target.value)}
                     className="w-24 sm:w-auto bg-transparent border-none p-0 text-sm text-gray-700 focus:ring-0 font-medium outline-none"
                   />
                </div>
                
                {(startDate || endDate) && (
                  <button
                    onClick={() => { setStartDate(''); setEndDate(''); }}
                    className="ml-1 p-0.5 text-gray-400 hover:text-red-500 rounded-full hover:bg-gray-100 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
             </div>

             {reports.length > 0 && (
               <div className="flex items-center gap-1 sm:gap-2 border-l border-gray-200 pl-2 sm:pl-4 ml-1">
                  <button
                    onClick={handleExport}
                    className="p-2 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                    title="Export Excel"
                  >
                    <Download className="w-5 h-5" />
                  </button>
                  <button
                    onClick={handleReset}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors hidden sm:block"
                    title="Clear All"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
               </div>
             )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {!isFiltered && (
          <InputSection 
            onAnalyze={handleAnalyze} 
            isAnalyzing={status === ParsingStatus.ANALYZING} 
          />
        )}

        {errorMsg && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 flex items-center gap-2 text-sm">
            <span className="font-semibold">错误:</span> {errorMsg}
          </div>
        )}

        {reports.length > 0 && (
          <>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <LayoutDashboard className="w-5 h-5 text-gray-500" />
                <h2 className="text-lg font-semibold text-gray-800">
                  {isFiltered ? '筛选结果' : '数据概览'}
                </h2>
              </div>
              <div className="flex items-center gap-4">
                {!isFullHistory && !isFiltered && (
                  <div className="flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-700 text-xs rounded-full border border-blue-100">
                    <History className="w-3.5 h-3.5" />
                    <span>近14天数据</span>
                  </div>
                )}
                <div className="text-sm text-gray-500 hidden sm:block">
                  共 {reports.length} 条
                </div>
              </div>
            </div>

            <Dashboard reports={displayedReports} />

            <div className="flex items-center justify-between mb-4 mt-8">
               <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                 <CalendarIcon className="w-5 h-5 text-gray-500" />
                 {isFiltered ? '详细记录' : '历史记录'}
               </h2>
               
               {!isFullHistory && !isFiltered && (
                 <button 
                   onClick={() => setIsFullHistory(true)}
                   className="text-sm text-blue-600 hover:text-blue-800 font-medium hover:underline"
                 >
                   加载更多历史...
                 </button>
               )}
            </div>
            
            {displayedReports.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-2xl border border-gray-200 border-dashed">
                 <p className="text-gray-500">当前筛选日期内无记录。</p>
                 <button onClick={() => {setStartDate(''); setEndDate('');}} className="mt-2 text-blue-600 hover:underline text-sm">清除筛选</button>
              </div>
            ) : (
              <ReportTable reports={displayedReports} onDelete={handleDelete} />
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default App;