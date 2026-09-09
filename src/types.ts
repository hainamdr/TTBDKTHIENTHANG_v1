export interface Student {
  id: string; // Mã học sinh / SBD
  name: string; // Họ và tên
  grade: string; // Khối (e.g. Khối 10, Khối 7)
  className: string; // Lớp
  teacher: string; // Giáo viên chủ nhiệm
  tuition: number; // Học phí
  status: 'Đã nộp' | 'Chưa nộp'; // Trạng thái
  month: string; // Tháng học phí (e.g. 09/2026)
  parentPhone: string; // Số điện thoại phụ huynh (Mẹ)
  deadline?: string; // Hạn nộp
  sbd?: string; // SBD
  fatherName?: string; // Tên Cha
  motherName?: string; // Tên Mẹ
  fatherPhone?: string; // SĐT Cha
  basicLessonsCount?: number; // Tổng buổi cơ bản
  basicLessonsDetail?: string; // Chi tiết buổi cơ bản
  advancedLessonsCount?: number; // Tổng buổi nâng cao
  advancedLessonsDetail?: string; // Chi tiết buổi nâng cao
  materialFee?: number; // Tiền tài liệu
  previousDebt?: number; // Nợ tháng trước (0 = Không)
  paidAmount?: number; // Số tiền đã đóng
}

export interface Transaction {
  id: string; // Mã giao dịch
  studentId: string; // Mã học sinh
  studentName: string; // Tên học sinh
  amount: number; // Số tiền nộp
  content: string; // Nội dung chuyển khoản
  timestamp: string; // Thời gian giao dịch
  status: 'Thành công' | 'Chờ duyệt'; // Trạng thái
  gateway: string; // Cổng thanh toán (SePay, Chuyển khoản, v.v.)
}

export interface AppConfig {
  spreadsheetId: string;
  bankName: string;
  bankAccount: string;
  accountHolder: string;
  sepayApiKey: string;
  sepayWebhookSecret: string;
  telegramBotToken: string;
  telegramChatId: string;
  zaloWebhookUrl: string;
}

export type UserRole = 'parent' | 'accountant' | 'admin';

export interface RevenueReport {
  groupName: string;
  totalTuition: number;
  paidAmount: number;
  unpaidAmount: number;
  paidCount: number;
  unpaidCount: number;
}
