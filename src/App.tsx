import React, { useState, useEffect } from 'react';
import { 
  User as FirebaseUser 
} from 'firebase/auth';
import { 
  initAuth, googleSignIn, logoutUser, getAccessToken 
} from './firebase';
import { 
  fetchStudentsFromSheet, fetchTransactionsFromSheet 
} from './sheets';
import { Student, Transaction, UserRole } from './types';
import ParentPortal from './components/ParentPortal';
import AccountantPortal from './components/AccountantPortal';
import { 
  BookOpen, LogIn, LogOut, CheckCircle, Database, Users, ShieldAlert, Sparkles 
} from 'lucide-react';

export default function App() {
  // Roles and Auth state
  const [role, setRole] = useState<UserRole>('parent');
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Business state
  const [spreadsheetId, setSpreadsheetId] = useState('');
  const [students, setStudents] = useState<Student[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);

  // Bank Info state (reused across portals)
  const [bankInfo, setBankInfo] = useState({
    bankName: 'MBBank',
    bankAccount: '123456789',
    accountHolder: 'NGUYEN VAN A'
  });

  // Poll sheets version from server for real-time google sheet edits auto-update
  const [currentVersion, setCurrentVersion] = useState<number | null>(null);

  useEffect(() => {
    let intervalId: any;
    
    const checkVersion = async () => {
      try {
        const res = await fetch('/api/sheets-version');
        const data = await res.json();
        if (currentVersion !== null && data.version > currentVersion) {
          console.log(`[Sync] Google Sheet changed. Auto-refreshing student data! Old: ${currentVersion}, New: ${data.version}`);
          await refreshData(accessToken, spreadsheetId);
        }
        setCurrentVersion(data.version);
      } catch (e) {
        console.error('Error polling sheets version:', e);
      }
    };

    // Initialize version
    checkVersion();

    // Poll every 5 seconds
    intervalId = setInterval(checkVersion, 5000);

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [currentVersion, accessToken, spreadsheetId]);

  // Default sample data used as fallback if Google Sheet is not yet connected or configured
  const sampleFallbackStudents: Student[] = [
    { 
      id: 'K10HS00173', 
      name: 'DƯƠNG TUẤN TÚ', 
      grade: 'Khối 10', 
      className: '10', 
      teacher: 'Cô Nguyễn Thị Huyên Tú', 
      tuition: 1750000, 
      status: 'Chưa nộp', 
      month: '09/2026', 
      parentPhone: '0974717262', 
      deadline: '15/09/2026',
      sbd: 'K10HS00173',
      fatherName: 'DƯƠNG ĐÌNH TOÀN',
      motherName: 'DƯƠNG THỊ NƯƠNG',
      fatherPhone: '0901112223',
      basicLessonsCount: 35,
      basicLessonsDetail: 'Hóa - 17. NGUYEN THI HUYEN TU: 8 buổi\nLý - 10. DAO_NGOC_DUNG: 8 buổi\nToán - 18. NGUYEN THI HIEN: 13 buổi\nVăn - 20. PHAM HUYEN TRANG: 6 buổi',
      advancedLessonsCount: 0,
      advancedLessonsDetail: 'Không có',
      materialFee: 0,
      previousDebt: 0,
      paidAmount: 0
    },
    { 
      id: 'K07HS00146', 
      name: 'PHẠM ĐAN NGUYÊN', 
      grade: 'Khối 7', 
      className: '7', 
      teacher: 'Cô Trần Thị Linh', 
      tuition: 400000, 
      status: 'Đã nộp', 
      month: '09/2026', 
      parentPhone: '0398985999', 
      deadline: '15/09/2026',
      sbd: 'K07HS00146',
      fatherName: 'PHẠM MINH ĐỨC',
      motherName: 'NGUYỄN THỊ KHÁNH LY',
      fatherPhone: '0902223334',
      basicLessonsCount: 8,
      basicLessonsDetail: 'Anh - 23. TRAN THI LINH: 8 buổi',
      advancedLessonsCount: 0,
      advancedLessonsDetail: 'Không có',
      materialFee: 0,
      previousDebt: 0,
      paidAmount: 400000
    }
  ];

  const sampleFallbackTransactions: Transaction[] = [
    { id: 'TX1002', studentId: 'K07HS00146', studentName: 'PHẠM ĐAN NGUYÊN', amount: 400000, content: 'HP K07HS00146 đóng học phí tháng 9', timestamp: '07/09/2026, 16:52:44', status: 'Thành công', gateway: 'SePay' }
  ];

  // Fetch initial configurations from local Express server
  const loadConfigAndLocalTransactions = async () => {
    try {
      const res = await fetch('/api/config');
      const data = await res.json();
      if (data.spreadsheetId) {
        setSpreadsheetId(data.spreadsheetId);
      }
      setBankInfo({
        bankName: data.bankName || 'MBBank',
        bankAccount: data.bankAccount || '123456789',
        accountHolder: data.accountHolder || 'NGUYEN VAN A'
      });

      // Load local transactions logged via webhook
      const txRes = await fetch('/api/transactions');
      const txData = await txRes.json();
      if (txData && txData.length > 0) {
        setTransactions(txData);
      } else {
        setTransactions(sampleFallbackTransactions);
      }
    } catch (e) {
      console.error('Error loading config:', e);
    }
  };

  // Sync data with Google Sheets
  const refreshData = async (token = accessToken, sheetId = spreadsheetId) => {
    if (!token || !sheetId) {
      // Fallback to sample data if offline / not connected
      setStudents(sampleFallbackStudents);
      await loadConfigAndLocalTransactions();
      return;
    }

    setIsLoadingData(true);
    try {
      // 1. Fetch Students
      const { students: fetchedStudents, isUninitialized } = await fetchStudentsFromSheet(token, sheetId);
      
      if (isUninitialized) {
        console.info('Google Sheet is uninitialized. Using elegant fallback sample data.');
        setStudents(sampleFallbackStudents);
        setTransactions(sampleFallbackTransactions);
        setIsLoadingData(false);
        return;
      }
      
      // 2. Fetch Transactions from Sheets
      const sheetTxs = await fetchTransactionsFromSheet(token, sheetId);
      
      // 3. Fetch Local Transactions from Server Webhook
      const localTxsRes = await fetch('/api/transactions');
      const localTxs: Transaction[] = await localTxsRes.json();

      // Merge transactions (Sheet transactions + Local webhooks unique transactions)
      const mergedTxs = [...localTxs];
      sheetTxs.forEach((stx) => {
        if (!mergedTxs.some((ltx) => ltx.id === stx.id)) {
          mergedTxs.push(stx);
        }
      });

      // Update student statuses based on merged transactions (webhook updates students instantly)
      const updatedStudents = fetchedStudents.map((student) => {
        const isPaidLocally = mergedTxs.some(
          (tx) => tx.studentId.toLowerCase() === student.id.toLowerCase() && tx.status === 'Thành công'
        );
        if (isPaidLocally) {
          return { ...student, status: 'Đã nộp' as const };
        }
        return student;
      });

      setStudents(updatedStudents);
      setTransactions(mergedTxs);
    } catch (error) {
      console.error('Error syncing Google Sheets:', error);
      // Fallback gracefully to keep app working
      setStudents(sampleFallbackStudents);
      setTransactions(sampleFallbackTransactions);
    } finally {
      setIsLoadingData(false);
    }
  };

  // Initialize Auth state on mount
  useEffect(() => {
    loadConfigAndLocalTransactions().then(() => {
      initAuth(
        async (firebaseUser, token) => {
          setUser(firebaseUser);
          setAccessToken(token);
          setNeedsAuth(false);
          // Sync with Sheet once logged in
          await refreshData(token, spreadsheetId);
        },
        () => {
          setUser(null);
          setAccessToken(null);
          setNeedsAuth(true);
          // Sync fallback offline data
          refreshData(null, '');
        }
      );
    });
  }, [spreadsheetId]);

  // Handle Google Login action
  const handleLogin = async () => {
    setIsLoggingIn(true);
    try {
      const result = await googleSignIn();
      if (result) {
        setUser(result.user);
        setAccessToken(result.accessToken);
        setNeedsAuth(false);
        await refreshData(result.accessToken, spreadsheetId);
      }
    } catch (err) {
      console.error('Login failed:', err);
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Handle Google Logout action
  const handleLogout = async () => {
    const confirmLogout = window.confirm('Bạn có chắc chắn muốn đăng xuất tài khoản kế toán?');
    if (!confirmLogout) return;

    try {
      await logoutUser();
      setUser(null);
      setAccessToken(null);
      setNeedsAuth(true);
      setRole('parent'); // Switch parent view on log out
      await refreshData(null, '');
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans">
      {/* Upper Navigation Header Bar */}
      <header className="bg-white border-b border-slate-100 shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          
          {/* Logo Brand */}
          <div className="flex items-center gap-3">
            <div className="bg-emerald-600 text-white p-2.5 rounded-xl shadow-md shadow-emerald-100 flex items-center justify-center">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <span className="text-sm font-extrabold text-slate-900 tracking-tight block">Hệ thống Học phí SePay</span>
              <span className="text-[10px] text-emerald-600 font-bold block uppercase tracking-widest">Trường Liên Cấp</span>
            </div>
          </div>

          {/* Center Role Toggle buttons */}
          <div className="flex bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setRole('parent')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                role === 'parent'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Cổng Phụ Huynh
            </button>
            <button
              onClick={() => setRole('accountant')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                role === 'accountant'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Cổng Kế Toán
            </button>
          </div>

          {/* Right side Auth Action */}
          <div className="flex items-center gap-3">
            {user ? (
              <div className="flex items-center gap-3">
                <div className="hidden md:flex flex-col text-right">
                  <span className="text-xs font-bold text-slate-800">{user.displayName || 'Kế toán viên'}</span>
                  <span className="text-[10px] text-slate-400 font-semibold">{user.email}</span>
                </div>
                <img
                  src={user.photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80&fit=crop&auto=format'}
                  alt="Avatar"
                  className="w-8 h-8 rounded-full border border-slate-200"
                  referrerPolicy="no-referrer"
                />
                <button
                  onClick={handleLogout}
                  className="border border-slate-200 bg-slate-50 hover:bg-red-50 hover:text-red-600 text-slate-600 p-2.5 rounded-xl transition"
                  title="Đăng xuất"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : role === 'accountant' ? (
              /* Custom styled sign in button resembling the official standard */
              <button
                onClick={handleLogin}
                disabled={isLoggingIn}
                className="gsi-material-button text-xs"
                style={{
                  background: 'white',
                  border: '1px solid #dadce0',
                  borderRadius: '12px',
                  color: '#3c4043',
                  cursor: 'pointer',
                  fontFamily: 'Roboto, arial, sans-serif',
                  fontSize: '13px',
                  height: '40px',
                  letterSpacing: '0.25px',
                  outline: 'none',
                  overflow: 'hidden',
                  padding: '0 12px',
                  position: 'relative',
                  textAlign: 'center',
                  verticalAlign: 'middle',
                  whiteSpace: 'nowrap',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontWeight: 500,
                  boxShadow: '0 1px 2px 0 rgba(60,64,67,0.3), 0 1px 3px 1px rgba(60,64,67,0.15)'
                }}
              >
                <div className="gsi-material-button-icon" style={{ height: '20px', width: '20px', display: 'flex', alignItems: 'center' }}>
                  <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" style={{ display: 'block' }}>
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                    <path fill="none" d="M0 0h48v48H0z"></path>
                  </svg>
                </div>
                <span className="gsi-material-button-contents font-semibold">Đăng nhập Google Kế toán</span>
              </button>
            ) : null}
          </div>

        </div>
      </header>

      {/* Main Container Core View */}
      <main className="flex-1">
        {role === 'parent' ? (
          <ParentPortal students={students} bankInfo={bankInfo} />
        ) : (
          /* Accountant portal guard */
          needsAuth ? (
            <div id="auth-gate-splash" className="max-w-xl mx-auto px-4 py-20 text-center flex flex-col items-center gap-6">
              <div className="w-20 h-20 bg-slate-100 text-slate-800 rounded-full flex items-center justify-center shadow-inner relative overflow-hidden">
                <ShieldAlert className="w-10 h-10" />
                <Sparkles className="w-4 h-4 text-emerald-500 absolute top-4 right-4 animate-bounce" />
              </div>

              <div>
                <span className="bg-slate-100 text-slate-600 text-xs font-bold px-3 py-1.5 rounded-full uppercase tracking-wider">
                  Bảo mật quản trị viên
                </span>
                <h1 className="text-2xl font-black mt-3 text-slate-950 tracking-tight">Cổng Kiểm Soát Đối Chiếu Học Phí</h1>
                <p className="text-slate-500 text-sm mt-2 max-w-sm mx-auto">
                  Vui lòng đăng nhập bằng Tài khoản Google được phân quyền kế toán để liên kết tệp Google Sheets, xuất báo cáo tài chính, và lưu lịch sử an toàn.
                </p>
              </div>

              <button
                onClick={handleLogin}
                disabled={isLoggingIn}
                className="gsi-material-button font-semibold text-sm w-full py-4.5"
                style={{
                  background: 'white',
                  border: '1px solid #dadce0',
                  borderRadius: '16px',
                  color: '#3c4043',
                  cursor: 'pointer',
                  fontFamily: 'Roboto, arial, sans-serif',
                  letterSpacing: '0.25px',
                  outline: 'none',
                  overflow: 'hidden',
                  padding: '12px 24px',
                  position: 'relative',
                  textAlign: 'center',
                  verticalAlign: 'middle',
                  whiteSpace: 'nowrap',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '12px',
                  fontWeight: 600,
                  boxShadow: '0 2px 4px 0 rgba(60,64,67,0.2), 0 1px 3px 1px rgba(60,64,67,0.1)'
                }}
              >
                <div className="gsi-material-button-icon" style={{ height: '24px', width: '24px', display: 'flex', alignItems: 'center' }}>
                  <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" style={{ display: 'block' }}>
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                    <path fill="none" d="M0 0h48v48H0z"></path>
                  </svg>
                </div>
                <span>Đăng nhập qua tài khoản Google</span>
              </button>

              <div className="border-t border-slate-200 pt-5 w-full mt-4 flex items-center justify-center gap-6 text-xs text-slate-400 font-semibold">
                <span className="flex items-center gap-1"><Database className="w-4 h-4" /> Google Sheets DB</span>
                <span className="flex items-center gap-1"><Users className="w-4 h-4" /> Phân quyền quản trị</span>
              </div>
            </div>
          ) : (
            <AccountantPortal
              accessToken={accessToken}
              spreadsheetId={spreadsheetId}
              onUpdateSpreadsheetId={(id) => {
                setSpreadsheetId(id);
                refreshData(accessToken, id);
              }}
              students={students}
              transactions={transactions}
              onRefreshData={() => refreshData(accessToken, spreadsheetId)}
              bankInfo={bankInfo}
            />
          )
        )}
      </main>

      {/* Global Footer */}
      <footer className="bg-white border-t border-slate-100 py-6 text-center text-xs text-slate-400 mt-auto">
        <p>© 2026 Hệ thống Quản lý Học phí & Thanh toán SePay Trường Liên Cấp. Bản quyền thuộc sở hữu nhà trường.</p>
      </footer>
    </div>
  );
}
