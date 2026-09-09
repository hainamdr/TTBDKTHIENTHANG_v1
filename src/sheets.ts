import { Student, Transaction } from './types';

// Create a new Spreadsheet with necessary sheets and sample data
export async function createNewSpreadsheet(accessToken: string, title: string): Promise<string> {
  try {
    const response = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        properties: {
          title: title,
        },
        sheets: [
          {
            properties: {
              title: 'Học sinh',
              gridProperties: { rowCount: 100, columnCount: 15 },
            },
          },
          {
            properties: {
              title: 'Lịch sử giao dịch',
              gridProperties: { rowCount: 100, columnCount: 10 },
            },
          },
        ],
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error?.message || 'Không thể tạo Google Sheet');
    }

    const data = await response.json();
    const spreadsheetId = data.spreadsheetId;

    // Populate initial default schemas and sample data
    await initializeDefaultSheets(accessToken, spreadsheetId);

    return spreadsheetId;
  } catch (error) {
    console.error('Error creating spreadsheet:', error);
    throw error;
  }
}

// Initialize default structures & write sample data
export async function initializeDefaultSheets(accessToken: string, spreadsheetId: string): Promise<boolean> {
  try {
    const studentHeaders = [
      'Mã Học Sinh',
      'Họ và Tên',
      'Khối',
      'Lớp',
      'Giáo viên chủ nhiệm',
      'Học phí',
      'Trạng thái',
      'Tháng',
      'Số điện thoại phụ huynh',
      'Hạn nộp',
      'SBD',
      'Tên Cha',
      'Tên Mẹ',
      'SĐT Cha',
      'Số buổi cơ bản',
      'Chi tiết buổi cơ bản',
      'Số buổi nâng cao',
      'Chi tiết buổi nâng cao',
      'Tiền tài liệu',
      'Nợ tháng trước',
      'Số tiền đã đóng'
    ];

    const transactionHeaders = [
      'Mã Giao Dịch',
      'Mã Học Sinh',
      'Học và Tên',
      'Số tiền',
      'Nội dung chuyển khoản',
      'Thời gian',
      'Trạng thái',
      'Cổng thanh toán',
    ];

    const sampleStudents = [
      [
        'K10HS00173', 
        'DƯƠNG TUẤN TÚ', 
        'Khối 10', 
        '10', 
        'Cô Nguyễn Thị Huyên Tú', 
        '1750000', 
        'Chưa nộp', 
        '09/2026', 
        '0974717262', 
        '15/09/2026',
        'K10HS00173',
        'DƯƠNG ĐÌNH TOÀN',
        'DƯƠNG THỊ NƯƠNG',
        '0901112223',
        '35',
        'Hóa - 17. NGUYEN THI HUYEN TU: 8 buổi\nLý - 10. DAO_NGOC_DUNG: 8 buổi\nToán - 18. NGUYEN THI HIEN: 13 buổi\nVăn - 20. PHAM HUYEN TRANG: 6 buổi',
        '0',
        'Không có',
        '0',
        '0',
        '0'
      ],
      [
        'K07HS00146', 
        'PHẠM ĐAN NGUYÊN', 
        'Khối 7', 
        '7', 
        'Cô Trần Thị Linh', 
        '400000', 
        'Đã nộp', 
        '09/2026', 
        '0398985999', 
        '15/09/2026',
        'K07HS00146',
        'PHẠM MINH ĐỨC',
        'NGUYỄN THỊ KHÁNH LY',
        '0902223334',
        '8',
        'Anh - 23. TRAN THI LINH: 8 buổi',
        '0',
        'Không có',
        '0',
        '0',
        '400000'
      ]
    ];

    const sampleTransactions = [
      ['TX1002', 'K07HS00146', 'PHẠM ĐAN NGUYÊN', '400000', 'HP K07HS00146 đóng học phí tháng 9', '07/09/2026, 16:52:44', 'Thành công', 'SePay'],
    ];

    // Write Headers and Sample data for Students
    await updateSheetRange(accessToken, spreadsheetId, 'Học sinh!A1:U3', [
      studentHeaders,
      ...sampleStudents,
    ]);

    // Write Headers and Sample data for Transactions
    await updateSheetRange(accessToken, spreadsheetId, 'Lịch sử giao dịch!A1:H2', [
      transactionHeaders,
      ...sampleTransactions,
    ]);

    return true;
  } catch (error) {
    console.error('Error initializing default sheets:', error);
    return false;
  }
}

// Utility to write a batch of values to a sheet range
async function updateSheetRange(
  accessToken: string,
  spreadsheetId: string,
  range: string,
  values: any[][]
): Promise<any> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ values }),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error?.message || `Lỗi cập nhật sheet ${range}`);
  }
  return response.json();
}

// Fetch all students from Google Sheets
export async function fetchStudentsFromSheet(accessToken: string, spreadsheetId: string): Promise<{ students: Student[]; rawValues: any[][]; isUninitialized?: boolean }> {
  try {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Học sinh!A:U`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      console.warn('Google Sheets API response was not OK, might be uninitialized:', response.status);
      return { students: [], rawValues: [], isUninitialized: true };
    }

    const data = await response.json();
    const rows = data.values || [];
    if (rows.length < 2) {
      return { students: [], rawValues: rows, isUninitialized: rows.length === 0 };
    }

    const students: Student[] = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row[0]) continue; // skip empty rows

      students.push({
        id: String(row[0] || '').trim(),
        name: String(row[1] || '').trim(),
        grade: String(row[2] || 'Khác').trim(),
        className: String(row[3] || '').trim(),
        teacher: String(row[4] || '').trim(),
        tuition: Number(row[5]) || 0,
        status: (row[6] === 'Đã nộp' ? 'Đã nộp' : 'Chưa nộp') as 'Đã nộp' | 'Chưa nộp',
        month: String(row[7] || '').trim(),
        parentPhone: String(row[8] || '').trim(),
        deadline: String(row[9] || '').trim(),
        sbd: String(row[10] || row[0] || '').trim(),
        fatherName: String(row[11] || '').trim(),
        motherName: String(row[12] || '').trim(),
        fatherPhone: String(row[13] || '').trim(),
        basicLessonsCount: Number(row[14]) || 0,
        basicLessonsDetail: String(row[15] || '').trim(),
        advancedLessonsCount: Number(row[16]) || 0,
        advancedLessonsDetail: String(row[17] || '').trim(),
        materialFee: Number(row[18]) || 0,
        previousDebt: Number(row[19]) || 0,
        paidAmount: Number(row[20]) || 0,
      });
    }

    return { students, rawValues: rows };
  } catch (error) {
    console.error('Error fetching students:', error);
    return { students: [], rawValues: [], isUninitialized: true };
  }
}

// Fetch all transactions from Google Sheets
export async function fetchTransactionsFromSheet(accessToken: string, spreadsheetId: string): Promise<Transaction[]> {
  try {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Lịch sử giao dịch!A:H`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      console.warn('Google Sheets Transactions API error:', response.status);
      return [];
    }

    const data = await response.json();
    const rows = data.values || [];
    if (rows.length < 2) {
      return [];
    }

    const transactions: Transaction[] = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row[0]) continue;

      transactions.push({
        id: String(row[0]),
        studentId: String(row[1]),
        studentName: String(row[2]),
        amount: Number(row[3]) || 0,
        content: String(row[4]),
        timestamp: String(row[5]),
        status: (row[6] === 'Thành công' ? 'Thành công' : 'Chờ duyệt') as 'Thành công' | 'Chờ duyệt',
        gateway: String(row[7] || 'SePay'),
      });
    }

    return transactions;
  } catch (error) {
    console.error('Error fetching transactions:', error);
    return [];
  }
}

// Update a student status to Paid or Unpaid
export async function updateStudentStatusInSheet(
  accessToken: string,
  spreadsheetId: string,
  studentIndex: number, // 0-based index in the student list (excluding header)
  status: 'Đã nộp' | 'Chưa nộp'
): Promise<boolean> {
  try {
    // Row in Sheet is 1-based, and row 1 is header, so index 0 is row 2
    const rowNum = studentIndex + 2;
    const range = `Học sinh!G${rowNum}`; // Column G is status
    await updateSheetRange(accessToken, spreadsheetId, range, [[status]]);
    return true;
  } catch (error) {
    console.error('Error updating student status:', error);
    return false;
  }
}

// Add a student to Google Sheet (append to bottom)
export async function addStudentToSheet(
  accessToken: string,
  spreadsheetId: string,
  student: Student
): Promise<boolean> {
  try {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Học sinh!A:U:append?valueInputOption=USER_ENTERED`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values: [[
          student.id,
          student.name,
          student.grade,
          student.className,
          student.teacher,
          student.tuition.toString(),
          student.status,
          student.month,
          student.parentPhone,
          student.deadline || '',
          student.sbd || student.id,
          student.fatherName || '',
          student.motherName || '',
          student.fatherPhone || '',
          (student.basicLessonsCount || 0).toString(),
          student.basicLessonsDetail || '',
          (student.advancedLessonsCount || 0).toString(),
          student.advancedLessonsDetail || '',
          (student.materialFee || 0).toString(),
          (student.previousDebt || 0).toString(),
          (student.paidAmount || 0).toString(),
        ]],
      }),
    });

    if (!response.ok) {
      throw new Error('Không thể thêm học sinh vào Google Sheet');
    }
    return true;
  } catch (error) {
    console.error('Error adding student:', error);
    return false;
  }
}

// Append transaction log to Google Sheets
export async function appendTransactionToSheet(
  accessToken: string,
  spreadsheetId: string,
  tx: Transaction
): Promise<boolean> {
  try {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Lịch sử giao dịch!A:H:append?valueInputOption=USER_ENTERED`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values: [[
          tx.id,
          tx.studentId,
          tx.studentName,
          tx.amount.toString(),
          tx.content,
          tx.timestamp,
          tx.status,
          tx.gateway,
        ]],
      }),
    });

    if (!response.ok) {
      throw new Error('Không thể ghi lịch sử giao dịch vào Google Sheet');
    }
    return true;
  } catch (error) {
    console.error('Error appending transaction:', error);
    return false;
  }
}
