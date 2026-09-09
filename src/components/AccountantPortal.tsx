import React, { useState, useEffect } from 'react';
import { 
  Database, RefreshCw, Plus, Users, DollarSign, AlertCircle, TrendingUp, CheckCircle,
  FileSpreadsheet, Image as ImageIcon, Settings, Bell, Zap, Trash2, Search, Filter, Play, LogIn
} from 'lucide-react';
import { Student, Transaction, AppConfig, RevenueReport } from '../types';
import { 
  createNewSpreadsheet, fetchStudentsFromSheet, fetchTransactionsFromSheet, 
  updateStudentStatusInSheet, addStudentToSheet, appendTransactionToSheet 
} from '../sheets';
import * as XLSX from 'xlsx';

interface AccountantPortalProps {
  accessToken: string | null;
  spreadsheetId: string;
  onUpdateSpreadsheetId: (id: string) => void;
  students: Student[];
  transactions: Transaction[];
  onRefreshData: () => Promise<void>;
  bankInfo: {
    bankName: string;
    bankAccount: string;
    accountHolder: string;
  };
  user?: any;
  onLoginGoogle?: () => void;
}

export default function AccountantPortal({
  accessToken,
  spreadsheetId,
  onUpdateSpreadsheetId,
  students,
  transactions,
  onRefreshData,
  bankInfo,
  user,
  onLoginGoogle
}: AccountantPortalProps) {
  // Config state
  const [config, setConfig] = useState<AppConfig>({
    spreadsheetId: '',
    bankName: '',
    bankAccount: '',
    accountHolder: '',
    sepayApiKey: '',
    sepayWebhookSecret: '',
    telegramBotToken: '',
    telegramChatId: '',
    zaloWebhookUrl: ''
  });

  // UI state
  const [activeTab, setActiveTab] = useState<'dashboard' | 'students' | 'reports' | 'simulation' | 'settings'>('dashboard');
  const [sheetIdInput, setSheetIdInput] = useState(spreadsheetId);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [isProvisioningSheet, setIsProvisioningSheet] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Student form state
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [newStudent, setNewStudent] = useState<Partial<Student>>({
    id: '',
    name: '',
    grade: 'Khối 1',
    className: '',
    teacher: '',
    tuition: 1500000,
    status: 'Chưa nộp',
    month: '09/2026',
    parentPhone: '',
    deadline: '15/09/2026'
  });

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [gradeFilter, setGradeFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');

  // Simulation state
  const [simStudentId, setSimStudentId] = useState('');
  const [simAmount, setSimAmount] = useState(1500000);
  const [simGateway, setSimGateway] = useState('MBBank');
  const [isSimulating, setIsSimulating] = useState(false);
  const [simResult, setSimResult] = useState<string | null>(null);

  // Load config on mount
  useEffect(() => {
    fetch('/api/config')
      .then((res) => {
        if (res.ok) return res.json();
        return null;
      })
      .then((data) => {
        if (data) {
          setConfig(data);
          if (data.spreadsheetId && !spreadsheetId) {
            onUpdateSpreadsheetId(data.spreadsheetId);
          }
        }
      })
      .catch((err) => console.log('Static host mode'));
  }, []);

  // Sync spreadsheetId local input when prop changes
  useEffect(() => {
    setSheetIdInput(spreadsheetId);
  }, [spreadsheetId]);

  // Sync Google Sheet ID in settings
  const handleSaveSheetId = async (idToSave = sheetIdInput) => {
    if (!idToSave.trim()) return;
    setIsSavingConfig(true);
    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spreadsheetId: idToSave.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        onUpdateSpreadsheetId(idToSave.trim());
        alert('Cập nhật mã Google Sheet thành công!');
      }
    } catch (e) {
      console.error(e);
      alert('Không thể lưu mã Google Sheet');
    } finally {
      setIsSavingConfig(false);
    }
  };

  // Create & Provision default Spreadsheet
  const handleCreateNewSheet = async () => {
    if (!accessToken) {
      alert('Vui lòng Đăng nhập tài khoản Google trước khi tạo file!');
      return;
    }
    const confirmCreate = window.confirm('Hệ thống sẽ tạo mới một file Google Sheet trong Drive của bạn và cấu hình toàn bộ dữ liệu mẫu học phí. Xác nhận tạo?');
    if (!confirmCreate) return;

    setIsProvisioningSheet(true);
    try {
      const newId = await createNewSpreadsheet(accessToken, 'Cơ sở dữ liệu Học phí & Thanh toán SePay');
      setSheetIdInput(newId);
      await handleSaveSheetId(newId);
      await onRefreshData();
      alert('Đã tạo và đồng bộ file Google Sheet mới thành công!');
    } catch (error: any) {
      alert(`Lỗi tạo file: ${error.message}`);
    } finally {
      setIsProvisioningSheet(false);
    }
  };

  // Refresh data wrapper
  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      await onRefreshData();
    } catch (e) {
      console.error(e);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Save Settings Config
  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingConfig(true);
    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      const data = await res.json();
      if (data.success) {
        alert('Lưu cấu hình hệ thống thành công!');
      }
    } catch (err: any) {
      alert(`Lỗi lưu cấu hình: ${err.message}`);
    } finally {
      setIsSavingConfig(false);
    }
  };

  // Sync Unsynced Transactions back to Google Sheet
  const handleSyncPendingTransactions = async () => {
    if (!accessToken) {
      alert('Vui lòng Đăng nhập tài khoản Google trước khi đồng bộ!');
      return;
    }
    
    // Fetch local transactions logged via Webhook
    try {
      const localTxsResponse = await fetch('/api/transactions');
      const localTxs: Transaction[] = await localTxsResponse.json();
      
      const sheetTxs = await fetchTransactionsFromSheet(accessToken, spreadsheetId);
      
      // Find transactions that exist locally but not in the Google Sheet yet
      const unsynced = localTxs.filter(local => !sheetTxs.some(sheet => sheet.id === local.id));
      
      if (unsynced.length === 0) {
        alert('Tất cả giao dịch SePay đã được đồng bộ khớp với Google Sheet!');
        return;
      }

      const confirmSync = window.confirm(`Phát hiện ${unsynced.length} giao dịch thanh toán mới chưa được cập nhật lên Google Sheets. Tiến hành đồng bộ tự động?`);
      if (!confirmSync) return;

      setIsRefreshing(true);
      
      // Update Google Sheets for each unsynced payment
      for (const tx of unsynced) {
        // Append transaction log row
        await appendTransactionToSheet(accessToken, spreadsheetId, tx);
        
        // Find index of student in spreadsheet to update status to 'Đã nộp'
        const sheetStudentData = await fetchStudentsFromSheet(accessToken, spreadsheetId);
        const studentIdx = sheetStudentData.students.findIndex(s => s.id === tx.studentId);
        if (studentIdx !== -1) {
          await updateStudentStatusInSheet(accessToken, spreadsheetId, studentIdx, 'Đã nộp');
        }
      }

      await onRefreshData();
      alert(`Đã đồng bộ thành công ${unsynced.length} giao dịch lên Google Sheets và cập nhật học bạ!`);
    } catch (error: any) {
      alert(`Lỗi đồng bộ: ${error.message}`);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Toggle Single Student Status directly in table
  const handleToggleStatus = async (studentId: string, currentStatus: 'Đã nộp' | 'Chưa nộp', index: number) => {
    const nextStatus = currentStatus === 'Đã nộp' ? 'Chưa nộp' : 'Đã nộp';
    const confirmed = window.confirm(
      `Xác nhận thay đổi trạng thái học phí của học sinh có mã ${studentId} sang "${nextStatus}"?`
    );
    if (!confirmed) return;

    if (accessToken && spreadsheetId) {
      setIsRefreshing(true);
      try {
        const success = await updateStudentStatusInSheet(accessToken, spreadsheetId, index, nextStatus);
        if (success) {
          await onRefreshData();
          return;
        }
      } catch (e: any) {
        console.warn('Lỗi ghi Google Sheet, lưu trạng thái cục bộ:', e);
      } finally {
        setIsRefreshing(false);
      }
    }

    // Local fallback persistence
    const currentList = students.map((s) => s.id === studentId ? { ...s, status: nextStatus as 'Đã nộp' | 'Chưa nộp' } : s);
    localStorage.setItem('hienthang_local_students', JSON.stringify(currentList));
    await onRefreshData();
  };

  // Add new student
  const handleAddStudentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newStudent.id || !newStudent.name || !newStudent.className || !newStudent.tuition) {
      alert('Vui lòng điền đầy đủ các thông tin bắt buộc (*)');
      return;
    }

    const s: Student = {
      id: newStudent.id,
      name: newStudent.name,
      grade: newStudent.grade || 'Khối 1',
      className: newStudent.className,
      teacher: newStudent.teacher || '',
      tuition: Number(newStudent.tuition),
      status: newStudent.status as 'Đã nộp' | 'Chưa nộp',
      month: newStudent.month || '09/2026',
      parentPhone: newStudent.parentPhone || '',
      deadline: newStudent.deadline || '',
    };

    if (accessToken && spreadsheetId) {
      setIsRefreshing(true);
      try {
        const success = await addStudentToSheet(accessToken, spreadsheetId, s);
        if (success) {
          setShowAddStudent(false);
          setNewStudent({
            id: '',
            name: '',
            grade: 'Khối 1',
            className: '',
            teacher: '',
            tuition: 1500000,
            status: 'Chưa nộp',
            month: '09/2026',
            parentPhone: '',
            deadline: '15/09/2026'
          });
          await onRefreshData();
          alert('Đã thêm học sinh mới thành công lên Google Sheet!');
          return;
        }
      } catch (err: any) {
        console.warn('Google Sheet ghi lỗi, lưu cục bộ:', err);
      } finally {
        setIsRefreshing(false);
      }
    }

    // Local fallback persistence
    const currentList = [...students, s];
    localStorage.setItem('hienthang_local_students', JSON.stringify(currentList));
    setShowAddStudent(false);
    setNewStudent({
      id: '',
      name: '',
      grade: 'Khối 1',
      className: '',
      teacher: '',
      tuition: 1500000,
      status: 'Chưa nộp',
      month: '09/2026',
      parentPhone: '',
      deadline: '15/09/2026'
    });
    await onRefreshData();
    alert('Đã thêm học sinh mới vào danh sách thành công!');
  };

  // Simulate payment callback
  const handleSimulatePayment = async () => {
    if (!simStudentId) {
      alert('Vui lòng chọn hoặc điền Mã học sinh để mô phỏng!');
      return;
    }
    
    setIsSimulating(true);
    setSimResult(null);

    const targetStudent = students.find(s => s.id === simStudentId);

    try {
      const res = await fetch('/api/simulate-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: simStudentId,
          studentName: targetStudent ? targetStudent.name : 'Học sinh mô phỏng',
          amount: simAmount,
          gateway: simGateway,
          content: `HP ${simStudentId} T09`
        })
      });
      const data = await res.json();
      if (data.success) {
        setSimResult(`Thành công! Giao dịch được ghi nhận dưới mã ${data.transaction.id}. Đã gửi thông báo Telegram đến Kế toán.`);
        await onRefreshData();
      } else {
        setSimResult(`Lỗi mô phỏng: ${data.error || 'Thao tác thất bại'}`);
      }
    } catch (err: any) {
      setSimResult(`Lỗi kết nối: ${err.message}`);
    } finally {
      setIsSimulating(false);
    }
  };

  // Test Telegram connection settings
  const handleTestTelegram = async () => {
    if (!config.telegramBotToken || !config.telegramChatId) {
      alert('Vui lòng điền đủ Bot Token và Chat ID trong cấu hình thông báo!');
      return;
    }
    try {
      const res = await fetch('/api/test-telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          botToken: config.telegramBotToken,
          chatId: config.telegramChatId
        })
      });
      const data = await res.json();
      if (data.success) {
        alert('Đã gửi tin nhắn test thành công! Hãy kiểm tra ứng dụng Telegram của bạn.');
      } else {
        alert(`Gửi test thất bại: ${data.error}`);
      }
    } catch (e: any) {
      alert(`Lỗi kết nối: ${e.message}`);
    }
  };

  // Canvas Roster Image Exporter
  const handleExportUnpaidImage = () => {
    const unpaid = students.filter(s => s.status === 'Chưa nộp');
    if (unpaid.length === 0) {
      alert('Chúc mừng! Không có học sinh chưa nộp học phí.');
      return;
    }

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rowHeight = 40;
    const headerHeight = 120;
    const footerHeight = 60;
    canvas.width = 900;
    canvas.height = headerHeight + (rowHeight * unpaid.length) + footerHeight;

    // Background white
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Premium header slate background
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, canvas.width, 90);

    // Header text
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px Arial, sans-serif';
    ctx.fillText('DANH SÁCH HỌC SINH CHƯA HOÀN THÀNH HỌC PHÍ', 30, 40);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '14px Arial, sans-serif';
    ctx.fillText(`Kỳ đối chiếu: Tháng ${unpaid[0]?.month || '09/2026'} | Tổng số học sinh: ${unpaid.length} em chưa nộp`, 30, 65);

    // Table Header values
    ctx.fillStyle = '#f1f5f9';
    ctx.fillRect(0, 90, canvas.width, 30);

    ctx.fillStyle = '#334155';
    ctx.font = 'bold 12px Arial, sans-serif';
    ctx.fillText('MÃ HS', 30, 110);
    ctx.fillText('HỌ VÀ TÊN', 110, 110);
    ctx.fillText('KHỐI', 320, 110);
    ctx.fillText('LỚP', 410, 110);
    ctx.fillText('GIÁO VIÊN CHỦ NHIỆM', 490, 110);
    ctx.fillText('HỌC PHÍ', 690, 110);
    ctx.fillText('SĐT PHỤ HUYNH', 780, 110);

    // Write table rows
    unpaid.forEach((s, idx) => {
      const y = headerHeight + (idx * rowHeight);

      // Zebra striping
      if (idx % 2 === 1) {
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(0, y, canvas.width, rowHeight);
      }

      // Border lines
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, y + rowHeight);
      ctx.lineTo(canvas.width, y + rowHeight);
      ctx.stroke();

      // Write values
      ctx.fillStyle = '#475569';
      ctx.font = '13px Arial, sans-serif';
      ctx.fillText(s.id, 30, y + 25);

      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 13px Arial, sans-serif';
      ctx.fillText(s.name, 110, y + 25);

      ctx.fillStyle = '#475569';
      ctx.font = '13px Arial, sans-serif';
      ctx.fillText(s.grade, 320, y + 25);
      ctx.fillText(s.className, 410, y + 25);
      ctx.fillText(s.teacher, 490, y + 25);

      ctx.fillStyle = '#ef4444'; // Red
      ctx.font = 'bold 13px Arial, sans-serif';
      ctx.fillText(s.tuition.toLocaleString('vi-VN') + ' đ', 690, y + 25);

      ctx.fillStyle = '#475569';
      ctx.font = '13px Arial, sans-serif';
      ctx.fillText(s.parentPhone, 780, y + 25);
    });

    // Draw Footer memo
    const footerY = canvas.height - 20;
    ctx.fillStyle = '#64748b';
    ctx.font = 'italic 11px Arial, sans-serif';
    ctx.fillText('* File xuất nợ tự động đối chiếu thông tin từ Google Sheets. Vui lòng liên hệ kế toán để hoàn tất.', 30, footerY);

    // Save triggers
    const link = document.createElement('a');
    link.download = `Danh_Sach_No_Hoc_Phi_Thang_${unpaid[0]?.month.replace('/', '_') || '09'}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  // Excel Multi-sheet exporter using xlsx SheetJS
  const handleExportDetailedExcel = () => {
    if (students.length === 0) {
      alert('Không có dữ liệu đối chiếu công nợ!');
      return;
    }

    // Sheet 1: Detailed student debt summary
    const studentsData = students.map((s) => ({
      'Mã Học Sinh': s.id,
      'Họ và Tên': s.name,
      'Khối': s.grade,
      'Lớp': s.className,
      'Giáo viên chủ nhiệm': s.teacher,
      'Tháng học phí': s.month,
      'Mức học phí (VND)': s.tuition,
      'Trạng thái': s.status,
      'SĐT Phụ huynh': s.parentPhone,
      'Hạn nộp': s.deadline || ''
    }));

    // Sheet 2: Ledger Transaction history
    const transactionsData = transactions.map((t) => ({
      'Mã giao dịch': t.id,
      'Mã học sinh': t.studentId,
      'Họ và tên học sinh': t.studentName,
      'Số tiền (VND)': t.amount,
      'Nội dung chuyển khoản': t.content,
      'Thời gian': t.timestamp,
      'Trạng thái': t.status,
      'Cổng thanh toán': t.gateway
    }));

    // Generate workbook
    const wb = XLSX.utils.book_new();
    const wsStudents = XLSX.utils.json_to_sheet(studentsData);
    const wsTransactions = XLSX.utils.json_to_sheet(transactionsData);

    // Formats sheet columns nicely
    XLSX.utils.book_append_sheet(wb, wsStudents, 'Chi tiết công nợ học sinh');
    XLSX.utils.book_append_sheet(wb, wsTransactions, 'Lịch sử giao dịch');

    const fileName = `Bao_Cao_Cong_No_Hoc_Phi_T${students[0]?.month.replace('/', '_') || '09_2026'}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  // Dynamic calculations for report tab
  const calculateReports = (groupBy: 'grade' | 'date' | 'month' | 'teacher'): RevenueReport[] => {
    const reportMap: Record<string, { total: number; paid: number; unpaid: number; pCount: number; uCount: number }> = {};

    students.forEach((s) => {
      let key = '';
      if (groupBy === 'grade') key = s.grade;
      else if (groupBy === 'teacher') key = s.teacher || 'Chưa phân công';
      else if (groupBy === 'month') key = `Tháng ${s.month}`;
      else if (groupBy === 'date') key = s.deadline || 'Không có hạn';

      if (!reportMap[key]) {
        reportMap[key] = { total: 0, paid: 0, unpaid: 0, pCount: 0, uCount: 0 };
      }

      reportMap[key].total += s.tuition;
      if (s.status === 'Đã nộp') {
        reportMap[key].paid += s.tuition;
        reportMap[key].pCount += 1;
      } else {
        reportMap[key].unpaid += s.tuition;
        reportMap[key].uCount += 1;
      }
    });

    return Object.entries(reportMap).map(([groupName, val]) => ({
      groupName,
      totalTuition: val.total,
      paidAmount: val.paid,
      unpaidAmount: val.unpaid,
      paidCount: val.pCount,
      unpaidCount: val.uCount
    }));
  };

  // Helper formatting currencies
  const formatVND = (num: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(num);
  };

  // Dashboard Aggregates
  const totalStudents = students.length;
  const paidCount = students.filter(s => s.status === 'Đã nộp').length;
  const unpaidCount = students.filter(s => s.status === 'Chưa nộp').length;
  
  const totalReceivable = students.reduce((sum, s) => sum + s.tuition, 0);
  const totalCollected = students.reduce((sum, s) => sum + (s.status === 'Đã nộp' ? s.tuition : 0), 0);
  const totalOutstanding = totalReceivable - totalCollected;

  const collectionRate = totalReceivable > 0 ? Math.round((totalCollected / totalReceivable) * 100) : 0;

  // Student filtering
  const filteredStudents = students.filter((s) => {
    const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          s.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          s.parentPhone.includes(searchTerm);
    const matchesGrade = gradeFilter === 'All' || s.grade === gradeFilter;
    const matchesStatus = statusFilter === 'All' || s.status === statusFilter;
    return matchesSearch && matchesGrade && matchesStatus;
  });

  // Get unique grades for filter dropdown
  const uniqueGrades = Array.from(new Set(students.map(s => s.grade)));

  return (
    <div id="accountant-portal-container" className="max-w-7xl mx-auto px-4 py-8">
      {/* Upper Sheets Connection Bar */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 mb-8 flex flex-col gap-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-xl ${accessToken ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
              <Database className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-800">Cơ sở dữ liệu Học Phí & Google Sheets</h2>
                {accessToken ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full">
                    <CheckCircle className="w-3.5 h-3.5" /> Đã kết nối Google Sheets
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-amber-100 text-amber-800 px-2.5 py-0.5 rounded-full">
                    Chế độ Quản trị Nội bộ / Excel
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {spreadsheetId ? `Mã Sheet liên kết: ${spreadsheetId}` : 'Mã Sheet mặc định: 1ll_BksTMMx1Rqes_2h50VlLxng-XFTsdCsG9g8UUBOs'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {!accessToken && onLoginGoogle && (
              <button
                onClick={onLoginGoogle}
                className="bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 font-semibold text-xs px-3.5 py-2.5 rounded-xl transition flex items-center gap-2 shadow-xs"
              >
                <LogIn className="w-4 h-4 text-emerald-600" />
                Đăng nhập Google Kế toán
              </button>
            )}
            <button
              onClick={handleCreateNewSheet}
              disabled={isProvisioningSheet}
              className="bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 font-bold text-xs px-3.5 py-2.5 rounded-xl transition flex items-center gap-1.5"
            >
              {isProvisioningSheet ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              Tạo Google Sheet mới
            </button>

            <button
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              className="border border-slate-200 hover:bg-slate-50 text-slate-700 p-2.5 rounded-xl transition"
              title="Đồng bộ lại dữ liệu"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-2 border-t border-slate-100">
          <input
            type="text"
            placeholder="Dán ID Google Sheet hoặc link vào đây (Ví dụ: 1ll_BksTMMx1Rqes_2h50VlLxng-XFTsdCsG9g8UUBOs)..."
            className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-slate-700 font-mono"
            value={sheetIdInput}
            onChange={(e) => setSheetIdInput(e.target.value)}
          />
          <button
            onClick={() => handleSaveSheetId()}
            disabled={isSavingConfig}
            className="bg-slate-800 hover:bg-slate-900 text-white font-semibold text-xs px-5 py-2.5 rounded-xl transition shadow-xs whitespace-nowrap"
          >
            Lưu liên kết Sheet
          </button>
        </div>
      </div>

      {/* Internal Navigation Tabs */}
      <div className="flex border-b border-slate-200 mb-8 overflow-x-auto gap-1">
        {[
          { id: 'dashboard', label: 'Dashboard Tổng quan', icon: TrendingUp },
          { id: 'students', label: 'Quản lý Học sinh', icon: Users },
          { id: 'reports', label: 'Báo cáo Doanh thu', icon: FileSpreadsheet },
          { id: 'simulation', label: 'Cổng SePay Sandbox', icon: Zap },
          { id: 'settings', label: 'Cấu hình hệ thống', icon: Settings },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-5 py-3.5 border-b-2 text-sm font-semibold transition whitespace-nowrap ${
                isActive 
                  ? 'border-emerald-600 text-emerald-600' 
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* --- DASHBOARD TAB --- */}
      {activeTab === 'dashboard' && (
        <div id="dashboard-tab" className="space-y-8 animate-fade-in">
          {/* Unsynced webhooks banner alerts */}
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex gap-3">
              <div className="bg-amber-100 text-amber-800 p-2.5 rounded-xl">
                <Bell className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-amber-900">Bảo mật & Đồng bộ Giao dịch</h3>
                <p className="text-xs text-amber-700 mt-1">
                  Mã webhook ghi nhận thanh toán tự động ngoại tuyến. Bấm đồng bộ để đẩy các hóa đơn SePay mới nhất lên tệp Google Sheets của trường.
                </p>
              </div>
            </div>
            <button
              onClick={handleSyncPendingTransactions}
              className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition shadow-sm whitespace-nowrap flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Đồng bộ lên Google Sheets
            </button>
          </div>

          {/* Metric Grid Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block">Tổng học phí đã thu</span>
                  <span className="text-2xl font-extrabold text-slate-800 mt-2 block">{formatVND(totalCollected)}</span>
                </div>
                <div className="bg-emerald-50 text-emerald-600 p-3 rounded-xl">
                  <DollarSign className="w-6 h-6" />
                </div>
              </div>
              <div className="mt-4 flex items-center gap-1 text-xs text-emerald-600 font-semibold">
                <TrendingUp className="w-3.5 h-3.5" />
                Tỉ lệ hoàn thành {collectionRate}%
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block">Công nợ còn nợ</span>
                  <span className="text-2xl font-extrabold text-red-600 mt-2 block">{formatVND(totalOutstanding)}</span>
                </div>
                <div className="bg-red-50 text-red-50 p-3 rounded-xl">
                  <AlertCircle className="w-6 h-6 text-red-600" />
                </div>
              </div>
              <div className="mt-4 flex items-center gap-1 text-xs text-slate-500">
                Từ {unpaidCount} học sinh chưa nộp học bạ
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block">Học sinh đã nộp</span>
                  <span className="text-2xl font-extrabold text-slate-800 mt-2 block">
                    {paidCount} <span className="text-sm font-medium text-slate-400">/ {totalStudents}</span>
                  </span>
                </div>
                <div className="bg-emerald-50 text-emerald-600 p-3 rounded-xl">
                  <CheckCircle className="w-6 h-6" />
                </div>
              </div>
              {/* Dynamic visual completion tracker */}
              <div className="mt-5 w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${collectionRate}%` }}></div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block">Chưa hoàn thành</span>
                  <span className="text-2xl font-extrabold text-slate-800 mt-2 block">
                    {unpaidCount} <span className="text-sm font-medium text-slate-400">em</span>
                  </span>
                </div>
                <div className="bg-amber-50 text-amber-600 p-3 rounded-xl">
                  <Users className="w-6 h-6" />
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2">
                <button
                  onClick={handleExportUnpaidImage}
                  className="text-xs text-emerald-600 hover:text-emerald-700 font-bold flex items-center gap-1 hover:underline"
                >
                  <ImageIcon className="w-3.5 h-3.5" /> Xuất ảnh gửi Zalo
                </button>
              </div>
            </div>
          </div>

          {/* Quick actions and ledger histories */}
          <div className="grid lg:grid-cols-12 gap-8">
            {/* Left side: Export & Print reconciliation buttons */}
            <div className="lg:col-span-4 space-y-6">
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
                <h3 className="text-base font-bold text-slate-800 mb-4">Thao tác nhanh cuối kỳ</h3>
                <div className="space-y-3">
                  <button
                    onClick={handleExportDetailedExcel}
                    className="w-full bg-slate-800 hover:bg-slate-900 text-white font-semibold text-sm py-3 px-4 rounded-xl transition flex items-center justify-center gap-2 shadow-sm"
                  >
                    <FileSpreadsheet className="w-4 h-4" /> Xuất Excel đối chiếu công nợ
                  </button>

                  <button
                    onClick={handleExportUnpaidImage}
                    className="w-full border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-sm py-3 px-4 rounded-xl transition flex items-center justify-center gap-2"
                  >
                    <ImageIcon className="w-4 h-4 text-slate-500" /> Xuất danh sách nợ dạng ảnh
                  </button>
                </div>
              </div>

              {/* Bank configuration summaries */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 text-slate-600 space-y-3 text-xs">
                <h3 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-2 mb-3">Thông tin tài khoản nhận</h3>
                <div className="flex justify-between">
                  <span>Ngân hàng:</span>
                  <span className="font-semibold text-slate-800">{bankInfo.bankName}</span>
                </div>
                <div className="flex justify-between">
                  <span>Số tài khoản:</span>
                  <span className="font-mono font-semibold text-slate-800">{bankInfo.bankAccount}</span>
                </div>
                <div className="flex justify-between">
                  <span>Chủ tài khoản:</span>
                  <span className="font-semibold text-slate-800 uppercase">{bankInfo.accountHolder}</span>
                </div>
              </div>
            </div>

            {/* Right side: Real-time ledger list */}
            <div className="lg:col-span-8 bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
              <h3 className="text-base font-bold text-slate-800 mb-4">Nhật ký giao dịch gần đây</h3>
              {transactions.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-slate-200 rounded-xl">
                  <p className="text-slate-400 text-sm">Chưa ghi nhận giao dịch nào từ cổng SePay.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left text-slate-600">
                    <thead className="bg-slate-50 text-slate-400 uppercase font-bold text-[10px] tracking-wider border-b border-slate-100">
                      <tr>
                        <th className="px-4 py-3.5">Mã GD</th>
                        <th className="px-4 py-3.5">Mã HS</th>
                        <th className="px-4 py-3.5">Họ và Tên</th>
                        <th className="px-4 py-3.5 text-right">Số tiền</th>
                        <th className="px-4 py-3.5">Nội dung</th>
                        <th className="px-4 py-3.5">Thời gian</th>
                        <th className="px-4 py-3.5">Cổng nhận</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {transactions.slice(0, 5).map((tx) => (
                        <tr key={tx.id} className="hover:bg-slate-50/50">
                          <td className="px-4 py-3.5 font-mono text-slate-900 font-bold">{tx.id}</td>
                          <td className="px-4 py-3.5">{tx.studentId}</td>
                          <td className="px-4 py-3.5 font-semibold text-slate-800">{tx.studentName}</td>
                          <td className="px-4 py-3.5 text-right font-extrabold text-emerald-600">{formatVND(tx.amount)}</td>
                          <td className="px-4 py-3.5 font-mono text-slate-500">{tx.content}</td>
                          <td className="px-4 py-3.5 text-slate-400">{tx.timestamp}</td>
                          <td className="px-4 py-3.5">
                            <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded font-semibold text-[10px] uppercase border border-emerald-100">
                              {tx.gateway}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- STUDENTS ROSTER TAB --- */}
      {activeTab === 'students' && (
        <div id="students-tab" className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 space-y-6 animate-fade-in">
          
          {/* Filters & Actions top-deck */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
            <div className="flex-1 flex flex-col sm:flex-row gap-2 max-w-2xl">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Tìm học sinh theo mã, họ tên hoặc SĐT..."
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-slate-700"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <div className="flex gap-2">
                <select
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-slate-600"
                  value={gradeFilter}
                  onChange={(e) => setGradeFilter(e.target.value)}
                >
                  <option value="All">Tất cả Khối</option>
                  {uniqueGrades.map(g => <option key={g} value={g}>{g}</option>)}
                </select>

                <select
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-slate-600"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="All">Tất cả Trạng thái</option>
                  <option value="Đã nộp">Đã nộp</option>
                  <option value="Chưa nộp">Chưa nộp</option>
                </select>
              </div>
            </div>

            <button
              onClick={() => setShowAddStudent(!showAddStudent)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm px-4 py-2.5 rounded-xl transition flex items-center gap-1.5 shadow-sm whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              Thêm học sinh
            </button>
          </div>

          {/* Inline Add Student Form */}
          {showAddStudent && (
            <form onSubmit={handleAddStudentSubmit} className="bg-slate-50 rounded-2xl border border-slate-200 p-6 space-y-4 animate-slide-down">
              <h3 className="text-sm font-bold text-slate-800">Thêm học sinh mới lên Google Sheets</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Mã Học Sinh *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ví dụ: HS007"
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    value={newStudent.id}
                    onChange={(e) => setNewStudent({ ...newStudent, id: e.target.value.toUpperCase() })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Họ và Tên *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ví dụ: Vũ Hoàng Nam"
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    value={newStudent.name}
                    onChange={(e) => setNewStudent({ ...newStudent, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Khối *</label>
                  <select
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    value={newStudent.grade}
                    onChange={(e) => setNewStudent({ ...newStudent, grade: e.target.value })}
                  >
                    <option value="Khối 1">Khối 1</option>
                    <option value="Khối 2">Khối 2</option>
                    <option value="Khối 3">Khối 3</option>
                    <option value="Khối 4">Khối 4</option>
                    <option value="Khối 5">Khối 5</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Lớp *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ví dụ: 1A2"
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    value={newStudent.className}
                    onChange={(e) => setNewStudent({ ...newStudent, className: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Giáo viên chủ nhiệm</label>
                  <input
                    type="text"
                    placeholder="Ví dụ: Cô Kim Chi"
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    value={newStudent.teacher}
                    onChange={(e) => setNewStudent({ ...newStudent, teacher: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Mức học phí (VND) *</label>
                  <input
                    type="number"
                    required
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    value={newStudent.tuition}
                    onChange={(e) => setNewStudent({ ...newStudent, tuition: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">SĐT Phụ huynh</label>
                  <input
                    type="text"
                    placeholder="Ví dụ: 0912..."
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    value={newStudent.parentPhone}
                    onChange={(e) => setNewStudent({ ...newStudent, parentPhone: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Hạn nộp</label>
                  <input
                    type="text"
                    placeholder="15/09/2026"
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    value={newStudent.deadline}
                    onChange={(e) => setNewStudent({ ...newStudent, deadline: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setShowAddStudent(false)}
                  className="border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold px-4 py-2 rounded-xl transition"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold px-4 py-2 rounded-xl transition"
                >
                  Xác nhận lưu
                </button>
              </div>
            </form>
          )}

          {/* Roster database Table */}
          <div className="overflow-x-auto rounded-xl border border-slate-100">
            <table className="w-full text-xs text-left text-slate-600">
              <thead className="bg-slate-50 text-slate-400 uppercase font-bold text-[10px] tracking-wider border-b border-slate-100">
                <tr>
                  <th className="px-4 py-3.5">Mã học sinh</th>
                  <th className="px-4 py-3.5">Họ và Tên</th>
                  <th className="px-4 py-3.5">Khối</th>
                  <th className="px-4 py-3.5">Lớp</th>
                  <th className="px-4 py-3.5">Giáo viên</th>
                  <th className="px-4 py-3.5 text-right">Học phí</th>
                  <th className="px-4 py-3.5">Trạng thái</th>
                  <th className="px-4 py-3.5">Tháng</th>
                  <th className="px-4 py-3.5">SĐT Phụ Huynh</th>
                  <th className="px-4 py-3.5 text-center">Hành động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredStudents.map((s, index) => (
                  <tr key={s.id} className="hover:bg-slate-50/30">
                    <td className="px-4 py-3.5 font-semibold text-slate-900">{s.id}</td>
                    <td className="px-4 py-3.5 font-bold text-slate-800">{s.name}</td>
                    <td className="px-4 py-3.5 text-slate-500">{s.grade}</td>
                    <td className="px-4 py-3.5 text-slate-500">{s.className}</td>
                    <td className="px-4 py-3.5 text-slate-500">{s.teacher}</td>
                    <td className="px-4 py-3.5 text-right font-extrabold text-slate-700">{formatVND(s.tuition)}</td>
                    <td className="px-4 py-3.5">
                      <span className={`px-2.5 py-1 rounded-full font-bold text-[10px] inline-flex items-center gap-1 border ${
                        s.status === 'Đã nộp'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                          : 'bg-amber-50 text-amber-700 border-amber-100'
                      }`}>
                        <span className={`w-1 h-1 rounded-full ${s.status === 'Đã nộp' ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                        {s.status}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-slate-400">{s.month}</td>
                    <td className="px-4 py-3.5 text-slate-500 font-mono">{s.parentPhone}</td>
                    <td className="px-4 py-3.5 text-center">
                      <button
                        onClick={() => handleToggleStatus(s.id, s.status, index)}
                        className={`text-[10px] font-bold px-2 py-1 rounded-md border transition ${
                          s.status === 'Đã nộp'
                            ? 'border-red-200 text-red-600 bg-red-50 hover:bg-red-100'
                            : 'border-emerald-200 text-emerald-600 bg-emerald-50 hover:bg-emerald-100'
                        }`}
                      >
                        {s.status === 'Đã nộp' ? 'Thu hồi' : 'Duyệt nộp'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filteredStudents.length === 0 && (
            <div className="text-center py-12 text-slate-400">
              Không tìm thấy học sinh nào phù hợp bộ lọc tìm kiếm.
            </div>
          )}
        </div>
      )}

      {/* --- PERIODIC REPORTS TAB --- */}
      {activeTab === 'reports' && (
        <div id="reports-tab" className="space-y-8 animate-fade-in">
          {/* Dynamic reports selection deck */}
          <div className="grid md:grid-cols-2 gap-8">
            
            {/* Block Group report (Theo khối) */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
              <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
                <span className="w-1.5 h-3 bg-emerald-500 rounded"></span>
                Báo cáo theo Khối
              </h3>
              <div className="space-y-4">
                {calculateReports('grade').map((r) => {
                  const pct = r.totalTuition > 0 ? Math.round((r.paidAmount / r.totalTuition) * 100) : 0;
                  return (
                    <div key={r.groupName} className="space-y-2 text-xs">
                      <div className="flex justify-between items-center text-slate-700">
                        <span className="font-bold">{r.groupName}</span>
                        <span>Đã thu {formatVND(r.paidAmount)} / {formatVND(r.totalTuition)} ({pct}%)</span>
                      </div>
                      <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden flex">
                        <div className="bg-emerald-500 h-full rounded-l-full" style={{ width: `${pct}%` }}></div>
                        <div className="bg-red-200 h-full rounded-r-full" style={{ width: `${100 - pct}%` }}></div>
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-400">
                        <span>{r.paidCount} học sinh đã nộp</span>
                        <span className="text-red-500 font-semibold">{r.unpaidCount} em còn nợ</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Teacher report (Theo giáo viên) */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
              <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
                <span className="w-1.5 h-3 bg-emerald-500 rounded"></span>
                Báo cáo theo Giáo viên chủ nhiệm
              </h3>
              <div className="space-y-4">
                {calculateReports('teacher').map((r) => {
                  const pct = r.totalTuition > 0 ? Math.round((r.paidAmount / r.totalTuition) * 100) : 0;
                  return (
                    <div key={r.groupName} className="space-y-2 text-xs">
                      <div className="flex justify-between items-center text-slate-700">
                        <span className="font-bold">{r.groupName}</span>
                        <span>Đã thu {formatVND(r.paidAmount)} / {formatVND(r.totalTuition)} ({pct}%)</span>
                      </div>
                      <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden flex">
                        <div className="bg-emerald-500 h-full rounded-l-full" style={{ width: `${pct}%` }}></div>
                        <div className="bg-red-200 h-full rounded-r-full" style={{ width: `${100 - pct}%` }}></div>
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-400">
                        <span>{r.paidCount} đã nộp</span>
                        <span className="text-red-500 font-semibold">{r.unpaidCount} còn nợ</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Month group report (Theo tháng) */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
              <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
                <span className="w-1.5 h-3 bg-emerald-500 rounded"></span>
                Báo cáo theo Tháng
              </h3>
              <div className="space-y-4">
                {calculateReports('month').map((r) => {
                  const pct = r.totalTuition > 0 ? Math.round((r.paidAmount / r.totalTuition) * 100) : 0;
                  return (
                    <div key={r.groupName} className="space-y-2 text-xs">
                      <div className="flex justify-between items-center text-slate-700">
                        <span className="font-bold">{r.groupName}</span>
                        <span>Đã thu {formatVND(r.paidAmount)} / {formatVND(r.totalTuition)} ({pct}%)</span>
                      </div>
                      <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden flex">
                        <div className="bg-emerald-500 h-full" style={{ width: `${pct}%` }}></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Date / Deadline report (Theo Ngày Hạn nộp) */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
              <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
                <span className="w-1.5 h-3 bg-emerald-500 rounded"></span>
                Báo cáo nợ theo Hạn nộp
              </h3>
              <div className="space-y-4">
                {calculateReports('date').map((r) => {
                  const pct = r.totalTuition > 0 ? Math.round((r.paidAmount / r.totalTuition) * 100) : 0;
                  return (
                    <div key={r.groupName} className="space-y-2 text-xs">
                      <div className="flex justify-between items-center text-slate-700">
                        <span className="font-semibold">Hạn: {r.groupName}</span>
                        <span>Còn nợ: <strong className="text-red-500">{formatVND(r.unpaidAmount)}</strong></span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- SEPAY WEBHOOK SIMULATOR TAB --- */}
      {activeTab === 'simulation' && (
        <div id="simulation-tab" className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 max-w-2xl mx-auto space-y-6 animate-fade-in">
          <div className="text-center">
            <span className="bg-purple-50 text-purple-700 border border-purple-100 text-xs font-semibold px-3 py-1.5 rounded-full">
              SePay Sandbox Testing
            </span>
            <h3 className="text-xl font-bold text-slate-800 mt-3">Trình mô phỏng thanh toán ngân hàng</h3>
            <p className="text-xs text-slate-500 mt-1">
              Do tệp webhook SePay thật phụ thuộc tài khoản ngân hàng thực tế, bạn có thể sử dụng trình giả lập này để gửi một tín hiệu thanh toán mock giống 100% gói tin API SePay.
            </p>
          </div>

          <div className="space-y-4 border-t border-slate-100 pt-5 text-xs">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Chọn học sinh nộp tiền *</label>
              <select
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-slate-800 font-semibold"
                value={simStudentId}
                onChange={(e) => {
                  const val = e.target.value;
                  setSimStudentId(val);
                  const matched = students.find(s => s.id === val);
                  if (matched) setSimAmount(matched.tuition);
                }}
              >
                <option value="">-- Chọn học sinh đóng tiền --</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.id} - {s.name} ({s.className}) - [Cần nộp: {formatVND(s.tuition)} - {s.status}]
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Số tiền chuyển (VND) *</label>
                <input
                  type="number"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none"
                  value={simAmount}
                  onChange={(e) => setSimAmount(Number(e.target.value))}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Ngân hàng chuyển hàng</label>
                <select
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none"
                  value={simGateway}
                  onChange={(e) => setSimGateway(e.target.value)}
                >
                  <option value="Vietcombank">Vietcombank</option>
                  <option value="MBBank">MBBank</option>
                  <option value="Agribank">Agribank</option>
                  <option value="BIDV">BIDV</option>
                  <option value="Techcombank">Techcombank</option>
                </select>
              </div>
            </div>

            <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 space-y-1.5 text-emerald-800 text-[11px]">
              <span className="font-bold">Quy trình mô phỏng khi bấm nút:</span>
              <p>1. Gửi gói tin HTTP POST SePay mock đến `/api/sepay-webhook` trên server.</p>
              <p>2. Server bóc tách mã học sinh từ nội dung chuyển khoản là <code className="bg-emerald-100 px-1 py-0.5 rounded font-bold">HP {simStudentId || '[Mã HS]'} T09</code>.</p>
              <p>3. Ghi nhận giao dịch vào lịch sử giao dịch địa phương.</p>
              <p>4. Bắn thông báo biến động số dư tức thì về Telegram của kế toán.</p>
              <p>5. Cổng phụ huynh đang mở tự động chuyển hướng sang biên lai xanh thành công ngay lập tức!</p>
            </div>

            <button
              onClick={handleSimulatePayment}
              disabled={isSimulating}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-4 rounded-xl transition flex items-center justify-center gap-2"
            >
              <Play className="w-4 h-4" />
              {isSimulating ? 'Đang thực thi mô phỏng...' : 'Kích hoạt thanh toán mô phỏng'}
            </button>

            {simResult && (
              <div className="bg-slate-100 border border-slate-200 rounded-xl p-4 font-semibold text-slate-700">
                {simResult}
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- SETTINGS TAB --- */}
      {activeTab === 'settings' && (
        <div id="settings-tab" className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 max-w-4xl mx-auto animate-fade-in">
          <form onSubmit={handleSaveConfig} className="space-y-6">
            <h3 className="text-base font-bold text-slate-800 border-b border-slate-100 pb-3 flex items-center gap-2">
              <Settings className="w-5 h-5 text-emerald-600" />
              Cấu hình Ngân hàng & Thông báo Kế toán
            </h3>

            {/* Row 1: Bank info */}
            <div>
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Tài khoản Ngân hàng nhận (SePay QR)</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Tên Ngân hàng</label>
                  <select
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs focus:outline-none"
                    value={config.bankName}
                    onChange={(e) => setConfig({ ...config, bankName: e.target.value })}
                  >
                    <option value="MBBank">MBBank (Quân Đội)</option>
                    <option value="Vietcombank">Vietcombank</option>
                    <option value="VietinBank">VietinBank</option>
                    <option value="BIDV">BIDV</option>
                    <option value="Agribank">Agribank</option>
                    <option value="Techcombank">Techcombank</option>
                    <option value="ACB">ACB</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Số tài khoản nhận</label>
                  <input
                    type="text"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs focus:outline-none"
                    value={config.bankAccount}
                    onChange={(e) => setConfig({ ...config, bankAccount: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Tên chủ tài khoản (Không dấu)</label>
                  <input
                    type="text"
                    placeholder="Ví dụ: NGUYEN VAN A"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs focus:outline-none uppercase"
                    value={config.accountHolder}
                    onChange={(e) => setConfig({ ...config, accountHolder: e.target.value.toUpperCase() })}
                  />
                </div>
              </div>
            </div>

            {/* Row 2: SePay keys */}
            <div className="border-t border-slate-100 pt-5">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Thông số Bảo mật SePay Webhook</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Mã bảo mật Webhook (Secret Key)</label>
                  <input
                    type="text"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs focus:outline-none"
                    value={config.sepayWebhookSecret}
                    onChange={(e) => setConfig({ ...config, sepayWebhookSecret: e.target.value })}
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Khi SePay gọi webhook, hệ thống sẽ kiểm soát mã này bảo mật.</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">SePay API Key (Tùy chọn)</label>
                  <input
                    type="password"
                    placeholder="se_api_..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs focus:outline-none"
                    value={config.sepayApiKey}
                    onChange={(e) => setConfig({ ...config, sepayApiKey: e.target.value })}
                  />
                </div>
              </div>
            </div>

            {/* Row 3: Telegram Bot */}
            <div className="border-t border-slate-100 pt-5">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Cấu hình báo cáo Telegram cho Kế toán</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Telegram Bot Token</label>
                  <input
                    type="password"
                    placeholder="Ví dụ: 123456789:ABCdefGhI..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs focus:outline-none font-mono"
                    value={config.telegramBotToken}
                    onChange={(e) => setConfig({ ...config, telegramBotToken: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Telegram Chat ID (ID nhóm nhận tin)</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Ví dụ: -1002345678"
                      className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs focus:outline-none font-mono"
                      value={config.telegramChatId}
                      onChange={(e) => setConfig({ ...config, telegramChatId: e.target.value })}
                    />
                    <button
                      type="button"
                      onClick={handleTestTelegram}
                      className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-3 py-2 rounded-xl border border-slate-200 transition"
                    >
                      Kiểm tra tin nhắn
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Row 4: Zalo Webhook */}
            <div className="border-t border-slate-100 pt-5">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Tích hợp Zalo API (Tùy chọn)</h4>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Đường dẫn Zalo Webhook / Forwarder URL</label>
                <input
                  type="text"
                  placeholder="https://oauth.zalo.me/... hoặc webhook tự tạo"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs focus:outline-none"
                  value={config.zaloWebhookUrl}
                  onChange={(e) => setConfig({ ...config, zaloWebhookUrl: e.target.value })}
                />
              </div>
            </div>

            {/* Guide details for Webhook integration */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs text-slate-600 space-y-2">
              <span className="font-bold text-slate-800">Hướng dẫn cài đặt trên SePay.vn:</span>
              <p>1. Đăng nhập vào tài khoản <a href="https://sepay.vn" target="_blank" rel="noreferrer" className="text-emerald-600 hover:underline">SePay.vn</a> của trường.</p>
              <p>
                2. Vào tab <strong>Tích hợp API/Webhook</strong> -&gt; Chọn <strong>Thêm Webhook</strong>.
              </p>
              <p>
                3. Dán đường dẫn Webhook URL sau:{' '}
                <code className="bg-slate-100 px-1.5 py-0.5 rounded font-bold text-slate-800 break-all select-all font-mono">
                  {window.location.origin}/api/sepay-webhook
                </code>
              </p>
              <p>
                4. Cài đặt Header xác minh:{' '}
                <code className="bg-slate-100 px-1.5 py-0.5 rounded font-mono">x-sepay-secret: {config.sepayWebhookSecret || 'Mã_Bí_Mật_Webhook'}</code>
              </p>
            </div>

            {/* Real-time Google Sheets automatic trigger guide */}
            <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 text-xs text-indigo-900 space-y-2">
              <span className="font-bold text-indigo-950 flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-ping"></span>
                Đồng bộ Tự Động Tức Thì khi Thay Đổi trên Google Sheets:
              </span>
              <p>Hệ thống hỗ trợ đồng bộ hóa dữ liệu ngay lập tức khi bạn chỉnh sửa trực tiếp trên Google Sheets. Hãy thiết lập một trigger Apps Script cực kỳ đơn giản theo các bước sau:</p>
              <p>1. Trong trang Google Sheet của bạn, vào menu <strong>Tiện ích mở rộng (Extensions)</strong> -&gt; Chọn <strong>Apps Script</strong>.</p>
              <p>2. Xóa hết code hiện có và dán đoạn mã sau vào:</p>
              <pre className="bg-indigo-950 text-indigo-200 p-3 rounded-xl overflow-x-auto font-mono text-[10px] leading-normal select-all">
{`function onChange(e) {
  var url = "${window.location.origin}/api/sheets-webhook";
  var payload = {
    "changeType": e ? e.changeType : "manual",
    "timestamp": new Date().toISOString()
  };
  var options = {
    "method": "post",
    "contentType": "application/json",
    "payload": JSON.stringify(payload),
    "muteHttpExceptions": true
  };
  UrlFetchApp.fetch(url, options);
}`}
              </pre>
              <p>3. Bấm vào biểu tượng <strong>Lưu (Save)</strong> (hình đĩa mềm) hoặc nhấn Ctrl+S.</p>
              <p>4. Bấm chọn mục <strong>Kích hoạt (Triggers)</strong> (biểu tượng hình chiếc đồng hồ báo thức ở danh sách bên trái).</p>
              <p>5. Bấm nút <strong>Thêm trình kích hoạt (Add Trigger)</strong> ở góc dưới cùng bên phải và chọn cấu hình:</p>
              <ul className="list-disc list-inside pl-2 space-y-0.5">
                <li>Chọn hàm chạy: <strong>onChange</strong></li>
                <li>Chọn nguồn sự kiện: <strong>Từ bảng tính (From spreadsheet)</strong></li>
                <li>Chọn loại sự kiện: <strong>Khi thay đổi (On change)</strong></li>
              </ul>
              <p>6. Bấm <strong>Lưu</strong> và chọn Tài khoản Google của bạn để cấp quyền truy cập mạng cho Script (chọn Advanced -&gt; Go to ... (unsafe) nếu Google hiển thị cảnh báo bảo mật).</p>
              <p className="font-bold text-indigo-700">✓ Xong! Từ nay mỗi khi bạn chỉnh sửa, thêm hoặc xóa bất kỳ ô nào trên Google Sheets, dữ liệu trên ứng dụng web sẽ tự động cập nhật lại ngay tức thì sau 1-2 giây mà không cần tải lại trang!</p>
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-100">
              <button
                type="submit"
                disabled={isSavingConfig}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm px-6 py-3 rounded-xl transition shadow-md"
              >
                {isSavingConfig ? 'Đang lưu cấu hình...' : 'Lưu lại toàn bộ cấu hình'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
