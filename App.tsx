import React, { useState, useEffect, useMemo } from 'react';
import { InputSection } from './components/InputSection';
import { ReportTable } from './components/ReportTable';
import { Dashboard } from './components/Dashboard';
import { parseDingTalkLogs } from './services/geminiService';
import { exportToExcel } from './utils/exportUtils';
import { ReportItem, ParsingStatus } from './types';
import { Download, LayoutDashboard, MessageSquareText, RefreshCw, Calendar as CalendarIcon, Filter, Cloud, CloudOff, AlertTriangle, X, History } from 'lucide-react';
import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, deleteDoc, doc, writeBatch, getDocs, where } from "firebase/firestore";

// ------------------------------------------------------------------
// Firebase Configuration
// ------------------------------------------------------------------
// Priority:
// 1. Environment Variables (Recommended for Vercel/Production Security)
// 2. Hardcoded values (For local testing - replace placeholders if needed)
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "YOUR_FIREBASE_API_KEY",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "your-project-id.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "your-project-id",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "your-project-id.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "YOUR_SENDER_ID",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "YOUR_APP_ID",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-MEASUREMENT_ID"
};

// Initialize Firebase only if config is valid (not default placeholders)
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

// Helper to get date string YYYY-MM-DD for X days ago
const getDateDaysAgo = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const App: React.FC = () => {
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [status, setStatus] = useState<ParsingStatus>(ParsingStatus.IDLE);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // Date Range Filtering State
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Performance Optimization: Only load full history if requested
  const [isFullHistory, setIsFullHistory] = useState<boolean>(false);

  // Auto-switch to full history if a start date is selected
  useEffect(() => {
    if (startDate && !isFullHistory) {
      setIsFullHistory(true);
    }
  }, [startDate, isFullHistory]);

  // 1. Real-time Cloud Sync (Firebase)
  useEffect(() => {
    if (!isConfigured || !db) return;

    let q;

    if (isFullHistory) {
      // Load ALL data
      q = query(collection(db, "reports"), orderBy("date", "desc"));
    } else {
      // DEFAULT: Load only last 14 days for performance
      const fourteenDaysAgo = getDateDaysAgo(14);
      q = query(
        collection(db, "reports"), 
        where("date", ">=", fourteenDaysAgo),
        orderBy("date", "desc")
      );
    }
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const cloudReports = snapshot.docs.map(doc => ({
        id: doc.id, // Use Cloud ID
        ...doc.data()
      })) as ReportItem[];
      setReports(cloudReports);
    }, (error) => {
      console.error("Sync error:", error);
      // Only show error if it's likely a permission issue
      if (error.code === 'permission-denied') {
        setErrorMsg("Cloud sync failed: Permission denied. Please check Firestore Rules.");
      }
    });

    return () => unsubscribe();
  }, [isFullHistory]); // Re-run effect when mode changes

  const handleAnalyze = async (text: string) => {
    setStatus(ParsingStatus.ANALYZING);
    setErrorMsg(null);
    try {
      const newReports = await parseDingTalkLogs(text);
      
      if (isConfigured && db) {
        // Cloud Mode: Upload one by one
        // We don't manually setReports here, the onSnapshot listener will do it automatically
        const uploadPromises = newReports.map(item => {
          // Remove temporary ID, let Firebase generate one
          const { id, ...data } = item;
          return addDoc(collection(db, "reports"), data);
        });
        await Promise.all(uploadPromises);
      } else {
        // Fallback Local Mode (if config missing)
        setReports(prev => {
          const updated = [...newReports, ...prev];
          return updated.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        });
      }
      
      setStatus(ParsingStatus.SUCCESS);
    } catch (e) {
      console.error(e);
      setStatus(ParsingStatus.ERROR);
      setErrorMsg("Failed to parse the text. Please check your AI API key or text format.");
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
      setReports(prev => prev.filter(r => r.id !== id));
    }
  };

  // Compute filtered reports based on Date Range
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
      // PASSWORD CHECK
      const password = prompt("请输入管理员密码以执行清空操作:");
      if (password !== "admin888") {
        if (password !== null) alert("密码错误，操作已取消。");
        return;
      }

      if (isConfigured && db) {
        // Batch delete for Cloud
        try {
          setStatus(ParsingStatus.ANALYZING); // Show spinner
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
        // Local Mode
        setReports([]);
        setStatus(ParsingStatus.IDLE);
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 pb-20">
      {/* Configuration Warning Banner */}
      {!isConfigured && (
        <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-3 text-sm text-yellow-800">
          <div className="flex items-start gap-3 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-yellow-600" />
            <div className="flex-1">
              <h3 className="font-semibold text-yellow-900">Cloud Sync Inactive (Local Mode Only)</h3>
              <p className="mt-1 text-yellow-800">
                To enable multi-device sync, you need to configure Firebase.
              </p>
              <div className="mt-2 text-xs bg-yellow-100 p-3 rounded border border-yellow-200 font-mono overflow-x-auto text-yellow-900">
                 <p className="font-bold mb-1">Option 1: Vercel Environment Variables (Secure)</p>
                 <p>Set: VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, VITE_FIREBASE_PROJECT_ID ...</p>
                 
                 <p className="font-bold mt-2 mb-1">Option 2: Edit Code (Easy for Local)</p>
                 <p>Open <code>App.tsx</code> and replace "YOUR_FIREBASE_API_KEY" with your actual config.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white shrink-0">
              <MessageSquareText className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-gray-900 truncate hidden sm:block">Riyadh DingTalk Parser</h1>
            <div className={`hidden md:flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium border ${isConfigured ? 'bg-green-50 text-green-700 border-green-100' : 'bg-gray-100 text-gray-600 border-gray-200'}`}>
               {isConfigured ? <Cloud className="w-3 h-3" /> : <CloudOff className="w-3 h-3" />}
               <span>{isConfigured ? 'Cloud Connected' : 'Local Mode'}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
             {/* Date Range Filter */}
             <div className="flex items-center bg-gray-50 border border-gray-300 rounded-lg px-2 py-1.5 shadow-sm focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 transition-all">
                <div className="relative group flex items-center gap-1">
                   <span className="text-xs text-gray-400 font-medium hidden sm:block">From</span>
                   <input 
                     type="date"
                     value={startDate}
                     onChange={(e) => setStartDate(e.target.value)}
                     className="w-28 sm:w-auto bg-transparent border-none p-0 text-sm text-gray-700 focus:ring-0 font-medium outline-none"
                     placeholder="Start"
                   />
                </div>
                <span className="mx-1 text-gray-300">|</span>
                <div className="relative group flex items-center gap-1">
                   <span className="text-xs text-gray-400 font-medium hidden sm:block">To</span>
                   <input 
                     type="date"
                     value={endDate}
                     onChange={(e) => setEndDate(e.target.value)}
                     className="w-28 sm:w-auto bg-transparent border-none p-0 text-sm text-gray-700 focus:ring-0 font-medium outline-none"
                     placeholder="End"
                   />
                </div>
                
                {(startDate || endDate) && (
                  <button
                    onClick={() => { setStartDate(''); setEndDate(''); }}
                    className="ml-1 p-0.5 text-gray-400 hover:text-red-500 rounded-full hover:bg-gray-100 transition-colors"
                    title="Clear filter"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
             </div>

             {reports.length > 0 && (
               <div className="flex items-center gap-2 border-l border-gray-200 pl-2 sm:pl-4 ml-1">
                  <button
                    onClick={handleExport}
                    className="p-2 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                    title="Export Current View to Excel"
                  >
                    <Download className="w-5 h-5" />
                  </button>
                  <button
                    onClick={handleReset}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors hidden sm:block"
                    title="Clear All History (Danger)"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
               </div>
             )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Input Section - Hide when actively filtering history to focus on the report view */}
        {!isFiltered && (
          <InputSection 
            onAnalyze={handleAnalyze} 
            isAnalyzing={status === ParsingStatus.ANALYZING} 
          />
        )}

        {errorMsg && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 flex items-center gap-2">
            <span className="font-semibold">Error:</span> {errorMsg}
          </div>
        )}

        {reports.length > 0 && (
          <>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <LayoutDashboard className="w-5 h-5 text-gray-500" />
                <h2 className="text-lg font-semibold text-gray-800">
                  {isFiltered 
                    ? `Dashboard (${startDate || 'Start'} - ${endDate || 'Now'})` 
                    : 'All Time Overview'}
                </h2>
              </div>
              <div className="flex items-center gap-4">
                {/* Visual Indicator for Data Load Status */}
                {!isFullHistory && !isFiltered && (
                  <div className="flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-700 text-xs rounded-full border border-blue-100">
                    <History className="w-3.5 h-3.5" />
                    <span>Showing last 14 days</span>
                  </div>
                )}
                <div className="text-sm text-gray-500 hidden sm:block">
                  Total Records: {reports.length} {isFiltered && `(Showing ${displayedReports.length})`}
                </div>
              </div>
            </div>

            {/* Pass filtered reports to Dashboard so charts update based on date selection */}
            <Dashboard reports={displayedReports} />

            <div className="flex items-center justify-between mb-4 mt-8">
               <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                 <CalendarIcon className="w-5 h-5 text-gray-500" />
                 {isFiltered 
                    ? `Records (${startDate || '...'} to ${endDate || '...'})` 
                    : 'Historical Records'}
               </h2>
               
               {/* Manual Load All Button (optional but helpful if user just wants to scroll) */}
               {!isFullHistory && !isFiltered && (
                 <button 
                   onClick={() => setIsFullHistory(true)}
                   className="text-sm text-blue-600 hover:text-blue-800 font-medium hover:underline"
                 >
                   Load older history...
                 </button>
               )}
            </div>
            
            {displayedReports.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-2xl border border-gray-200 border-dashed">
                 <p className="text-gray-500">No records found for this date range.</p>
                 <button onClick={() => {setStartDate(''); setEndDate('');}} className="mt-2 text-blue-600 hover:underline">Clear Filter</button>
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

// Quick helper for trash icon in header
function Trash2(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
      <line x1="10" x2="10" y1="11" y2="17" />
      <line x1="14" x2="14" y1="11" y2="17" />
    </svg>
  )
}

export default App;