import React, { useState, useEffect } from 'react';
import { 
  Search, CheckCircle, Clock, CreditCard, Sparkles, Printer, 
  GraduationCap, AlertTriangle, ExternalLink, Info 
} from 'lucide-react';
import { Student } from '../types';

interface ParentPortalProps {
  students: Student[];
  bankInfo: {
    bankName: string;
    bankAccount: string;
    accountHolder: string;
  };
}

export default function ParentPortal({ students, bankInfo }: ParentPortalProps) {
  const [searchPhone, setSearchPhone] = useState('');
  const [searchedStudents, setSearchedStudents] = useState<Student[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  // Helper to normalize phone number to prevent space/dot formatting issues
  const normalizePhone = (num: string) => {
    return num.replace(/[\s\.\-\(\)]/g, '');
  };

  const handleSearch = () => {
    if (!searchPhone.trim()) return;
    setIsSearching(true);
    
    const query = normalizePhone(searchPhone.trim());
    
    // Match either parentPhone, fatherPhone, student id or sbd
    const matched = students.filter(s => {
      const matchPhone = normalizePhone(s.parentPhone) === query || (s.fatherPhone && normalizePhone(s.fatherPhone) === query);
      const matchId = s.id.toLowerCase() === searchPhone.trim().toLowerCase() || (s.sbd && s.sbd.toLowerCase() === searchPhone.trim().toLowerCase());
      return matchPhone || matchId;
    });

    setSearchedStudents(matched);
    setHasSearched(true);
    setIsSearching(false);
  };

  // Quick select examples matching the images
  const handleQuickSelect = (phone: string) => {
    setSearchPhone(phone);
    setIsSearching(true);
    
    const query = normalizePhone(phone);
    const matched = students.filter(s => {
      const matchPhone = normalizePhone(s.parentPhone) === query || (s.fatherPhone && normalizePhone(s.fatherPhone) === query);
      const matchId = s.id.toLowerCase() === phone.toLowerCase() || (s.sbd && s.sbd.toLowerCase() === phone.toLowerCase());
      return matchPhone || matchId;
    });

    setSearchedStudents(matched);
    setHasSearched(true);
    setIsSearching(false);
  };

  const formatVND = (num: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(num).replace('₫', 'đ');
  };

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-800 pb-16">
      
      {/* Hiền Thắng Custom Sub-Header Portal Bar */}
      <div className="bg-white border-b border-slate-200 shadow-xs">
        <div className="max-w-4xl mx-auto px-4 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="bg-indigo-600 text-white p-2.5 rounded-xl shadow-xs flex items-center justify-center">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div className="leading-tight">
              <h1 className="text-sm md:text-base font-black text-slate-900 tracking-tight uppercase">
                TRUNG TÂM BDKT HIỀN THẮNG
              </h1>
              <p className="text-[11px] md:text-xs text-indigo-600 font-bold">
                Xác minh thanh toán tự động — Cổng Thanh Toán Học Phí
              </p>
            </div>
          </div>
          <span className="hidden sm:inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Hệ thống đang hoạt động
          </span>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Core Subtitle */}
        <div className="text-center mb-6">
          <h2 className="text-2xl md:text-3xl font-black text-indigo-700 tracking-tight">
            Tra cứu & Thanh toán học phí
          </h2>
          <p className="text-slate-600 text-sm mt-1.5 font-medium">
            Nhập số điện thoại của mẹ để xem thông tin học phí của con em
          </p>
        </div>

        {/* Rounded Lookup Card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-sm mb-6">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <input
                type="text"
                value={searchPhone}
                onChange={(e) => setSearchPhone(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Nhập số điện thoại mẹ (ví dụ: 0974717262 hoặc 0398985999)"
                className="w-full px-4 py-3.5 rounded-xl border border-slate-300 bg-slate-50/50 text-slate-900 focus:bg-white focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm font-semibold transition"
              />
            </div>
            <button
              onClick={handleSearch}
              disabled={isSearching}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-7 py-3.5 rounded-xl transition flex items-center justify-center gap-2 text-sm shadow-md active:scale-95 cursor-pointer"
            >
              <Search className="w-4 h-4" />
              Tìm kiếm
            </button>
          </div>
          
          <p className="text-xs text-slate-500 mt-3 flex items-center gap-1.5 font-medium">
            <Info className="w-4 h-4 text-indigo-500 shrink-0" />
            Hệ thống sẽ hiển thị tất cả học sinh liên kết với số điện thoại này.
          </p>

          {/* Tester Helper */}
          <div className="mt-4 pt-3.5 border-t border-dashed border-slate-200 flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-500 font-bold">Số điện thoại mẫu tra cứu nhanh:</span>
            <button
              onClick={() => handleQuickSelect('0974717262')}
              className="text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold px-3 py-1.5 rounded-lg border border-indigo-200 transition cursor-pointer"
            >
              0974717262 (Dương Tuấn Tú - Chưa đóng)
            </button>
            <button
              onClick={() => handleQuickSelect('0398985999')}
              className="text-xs bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold px-3 py-1.5 rounded-lg border border-emerald-200 transition cursor-pointer"
            >
              0398985999 (Phạm Đan Nguyên - Đã đóng)
            </button>
          </div>
        </div>

        {/* Results Counter */}
        {hasSearched && (
          <div className="text-center text-sm font-bold text-slate-600 mb-6 bg-white/70 py-1.5 px-4 rounded-full border border-slate-200 inline-block mx-auto">
            Tìm thấy <span className="text-indigo-600 font-black">{searchedStudents.length}</span> học sinh
          </div>
        )}

        {/* Students List Details */}
        <div className="space-y-6">
          {searchedStudents.map((student) => (
            <StudentPaymentCard 
              key={student.id} 
              student={student} 
              bankInfo={bankInfo} 
              formatVND={formatVND}
            />
          ))}

          {hasSearched && searchedStudents.length === 0 && (
            <div className="text-center py-12 rounded-2xl border-2 border-dashed border-slate-300 bg-white p-6 text-slate-500">
              <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
              <p className="font-bold text-base text-slate-800">Không tìm thấy thông tin học sinh nào liên kết với số điện thoại này.</p>
              <p className="text-xs text-slate-500 mt-1">Vui lòng thử lại bằng số điện thoại 0974717262 hoặc 0398985999</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

// Student Card Component with Countdown Timer inside
interface StudentPaymentCardProps {
  student: Student;
  bankInfo: {
    bankName: string;
    bankAccount: string;
    accountHolder: string;
  };
  formatVND: (num: number) => string;
  key?: React.Key;
}

function StudentPaymentCard({ student, bankInfo, formatVND }: StudentPaymentCardProps) {
  const [timeLeft, setTimeLeft] = useState(3593); // Start near 59:53 like screenshot 2
  const [isPaid, setIsPaid] = useState(student.status === 'Đã nộp');
  const [paymentSuccessData, setPaymentSuccessData] = useState<{timestamp: string, amount: number} | null>(
    student.status === 'Đã nộp' ? { timestamp: '07/09/2026 16:52:44', amount: student.tuition } : null
  );

  // Countdown timer effect
  useEffect(() => {
    if (isPaid) return;
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isPaid]);

  // Real-time payment verification polling
  useEffect(() => {
    if (isPaid) return;
    let pollInterval = setInterval(async () => {
      try {
        const res = await fetch(`/api/payment-status/${student.id}`);
        const data = await res.json();
        if (data.paid) {
          setIsPaid(true);
          setPaymentSuccessData({
            timestamp: data.transaction?.timestamp || new Date().toLocaleString('vi-VN'),
            amount: student.tuition
          });
          clearInterval(pollInterval);
        }
      } catch (e) {
        console.error('Polling error:', e);
      }
    }, 3000);

    return () => clearInterval(pollInterval);
  }, [isPaid, student]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // SePay VietQR code URL Generator
  const qrUrl = `https://qr.sepay.vn/img?acc=${bankInfo.bankAccount}&bank=${bankInfo.bankName}&amount=${student.tuition}&descr=HP%20${student.id}%20T09&template=compact`;

  // Parse custom lesson list lines (e.g. Hóa, Lý, Toán, Văn)
  const parseLessonsDetail = (detailString: string | undefined) => {
    if (!detailString) return null;
    return detailString.split('\n').map((line, index) => {
      const parts = line.split(':');
      const label = parts[0]?.trim();
      const count = parts[1]?.trim();
      return (
        <div key={index} className="flex justify-between items-center text-xs py-2 border-b border-dotted border-slate-200 last:border-0">
          <span className="text-slate-800 font-medium pl-2">{label}</span>
          <span className="font-black text-slate-900 bg-white px-2.5 py-0.5 rounded-md border border-slate-200 shadow-2xs">
            {count || ''}
          </span>
        </div>
      );
    });
  };

  return (
    <div className="bg-white rounded-3xl border-2 border-slate-200/90 p-6 sm:p-7 shadow-sm transition-all hover:shadow-md">
      
      {/* Name and Status Badge */}
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-2xl font-black text-slate-950 uppercase tracking-tight">
            {student.name}
          </h3>
          <div className="inline-flex items-center gap-1 mt-1">
            <span className="text-xs font-mono font-bold text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-md border border-slate-200">
              SBD: {student.sbd || student.id}
            </span>
          </div>
        </div>
        
        {isPaid ? (
          <span className="bg-emerald-50 text-emerald-700 border-2 border-emerald-300 text-xs font-black px-4 py-1.5 rounded-full uppercase tracking-wider shadow-2xs">
            Đã đóng đủ
          </span>
        ) : (
          <span className="bg-rose-50 text-rose-600 border-2 border-rose-300 text-xs font-black px-4 py-1.5 rounded-full uppercase tracking-wider shadow-2xs">
            Chưa đóng
          </span>
        )}
      </div>

      {/* Dotted Attributes List - High Contrast */}
      <div className="space-y-2 mt-4">
        
        {/* Lớp */}
        <div className="flex justify-between items-center text-sm py-1.5 border-b border-dotted border-slate-300">
          <span className="text-slate-700 font-bold">Lớp</span>
          <span className="font-extrabold text-slate-950">{student.className}</span>
        </div>

        {/* Cha */}
        <div className="flex justify-between items-center text-sm py-1.5 border-b border-dotted border-slate-300">
          <span className="text-slate-700 font-bold">Cha</span>
          <span className="font-extrabold text-slate-950 uppercase">{student.fatherName || 'Không có'}</span>
        </div>

        {/* Mẹ */}
        <div className="flex justify-between items-center text-sm py-1.5 border-b border-dotted border-slate-300">
          <span className="text-slate-700 font-bold">Mẹ</span>
          <span className="font-extrabold text-slate-950 uppercase">{student.motherName || 'Không có'}</span>
        </div>

        {/* Buổi cơ bản section heading */}
        <div className="flex justify-between items-center text-sm font-black pt-2.5">
          <span className="text-slate-900 font-extrabold">Buổi cơ bản</span>
          <span className="text-blue-700 font-black text-base">{student.basicLessonsCount || 0} buổi</span>
        </div>

        {/* Expanded lessons details */}
        {student.basicLessonsDetail && (
          <div className="mt-1.5 mb-2 bg-slate-50 border border-slate-200 rounded-2xl px-3 py-1.5">
            {parseLessonsDetail(student.basicLessonsDetail)}
          </div>
        )}

        {/* Buổi nâng cao */}
        <div className="flex justify-between items-center text-sm py-2 border-b border-dotted border-slate-300">
          <span className="text-slate-700 font-bold">Buổi nâng cao</span>
          <span className="text-slate-900 font-bold">
            {student.advancedLessonsCount ? `${student.advancedLessonsCount} buổi` : '0 buổi'}
          </span>
        </div>

        {/* Tiền tài liệu */}
        <div className="flex justify-between items-center text-sm py-2 border-b border-dotted border-slate-300">
          <span className="text-slate-700 font-bold">Tiền tài liệu</span>
          <span className="text-slate-900 font-bold">
            {student.materialFee ? formatVND(student.materialFee) : '0 đ'}
          </span>
        </div>

        {/* Nợ tháng trước */}
        <div className="flex justify-between items-center text-sm py-2 border-b border-dotted border-slate-300">
          <span className="text-slate-700 font-bold">Nợ tháng trước</span>
          <span className={`font-black ${student.previousDebt ? 'text-rose-600' : 'text-slate-800'}`}>
            {student.previousDebt ? formatVND(student.previousDebt) : 'Không'}
          </span>
        </div>

      </div>

      {/* Light slate summary block */}
      <div className="rounded-2xl p-4 mt-5 space-y-2 bg-slate-100/90 border border-slate-200/90">
        <div className="flex justify-between items-center text-sm">
          <span className="text-slate-700 font-bold">Tổng học phí:</span>
          <span className="font-black text-slate-950 text-base">{formatVND(student.tuition)}</span>
        </div>
        <div className="flex justify-between items-center text-sm">
          <span className="text-slate-700 font-bold">Đã đóng:</span>
          <span className={`font-black text-base ${isPaid ? 'text-emerald-700' : 'text-slate-950'}`}>
            {isPaid ? formatVND(student.tuition) : '0 đ'}
          </span>
        </div>
      </div>

      {/* Unpaid View: QR scanner + countdown alerts */}
      {!isPaid && (
        <div className="mt-6 flex flex-col items-center">
          
          {/* SePay VietQR code card container */}
          <div className="p-3.5 border-2 border-slate-200 bg-white rounded-2xl shadow-sm inline-block">
            <img
              src={qrUrl}
              alt="VietQR Code"
              className="w-52 h-52 object-contain rounded-lg"
              referrerPolicy="no-referrer"
            />
          </div>

          <div className="text-2xl font-black text-slate-950 mt-3.5">
            {formatVND(student.tuition)}
          </div>

          {/* Pending Payment Amber Badge */}
          <div className="mt-2.5 bg-amber-100 text-amber-900 border border-amber-300 text-xs font-black px-4 py-1.5 rounded-full flex items-center gap-1.5 shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-amber-600 animate-ping"></span>
            Đang chờ thanh toán
          </div>

          {/* Countdown timer matching Screenshot 2 */}
          <div className="text-xs text-slate-700 font-bold mt-2.5">
            Hết hạn sau <span className="text-rose-600 font-mono font-black text-sm ml-1">{formatTime(timeLeft)}</span>
          </div>

          {/* Open checkout links */}
          <a
            href={qrUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-indigo-700 font-black hover:underline mt-2 flex items-center gap-1"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Mở trang thanh toán
          </a>

          {/* Detailed Warning box exactly matching the image text */}
          <div className="mt-5 p-4 rounded-2xl bg-amber-50 border-2 border-amber-200 text-xs text-amber-950 leading-relaxed font-medium">
            <div className="flex gap-2.5 items-start">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <p>
                <strong className="font-extrabold text-amber-900">Vui lòng thanh toán ngay trong 60 phút. Không chụp lại mã QR để chuyển khoản sau</strong> — sau khi hết hạn, ngân hàng sẽ <strong className="font-extrabold text-amber-900">từ chối chuyển khoản</strong> (báo lỗi mã hết hạn), vui lòng lấy mã QR mới khi cần.
              </p>
            </div>
          </div>

        </div>
      )}

      {/* Paid View: Confirmed transaction ribbon bar matching Screenshot 3 */}
      {isPaid && paymentSuccessData && (
        <div className="mt-6 p-4 rounded-2xl bg-emerald-50 border-2 border-emerald-400 text-xs text-emerald-950 font-black flex items-center justify-center gap-2 shadow-xs">
          <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>
            Đã thanh toán thành công lúc {paymentSuccessData.timestamp} — Số tiền: {formatVND(paymentSuccessData.amount)}
          </span>
        </div>
      )}

    </div>
  );
}
