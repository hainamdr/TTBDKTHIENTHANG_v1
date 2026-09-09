import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';

// Initialize configuration and local databases
const CONFIG_FILE = path.join(process.cwd(), 'config.json');
const TRANSACTIONS_FILE = path.join(process.cwd(), 'transactions.json');

// Helper to load config
function loadConfig() {
  if (fs.existsSync(CONFIG_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    } catch (e) {
      console.error('Error reading config:', e);
    }
  }
  // Default Config
  const defaultConf = {
    spreadsheetId: '',
    bankName: 'MBBank',
    bankAccount: '123456789',
    accountHolder: 'NGUYEN VAN A',
    sepayApiKey: '',
    sepayWebhookSecret: 'sepay_secret_token_123',
    telegramBotToken: '',
    telegramChatId: '',
    zaloWebhookUrl: ''
  };
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(defaultConf, null, 2), 'utf8');
  return defaultConf;
}

// Helper to load transactions
function loadTransactions() {
  if (fs.existsSync(TRANSACTIONS_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(TRANSACTIONS_FILE, 'utf8'));
    } catch (e) {
      console.error('Error reading transactions:', e);
    }
  }
  fs.writeFileSync(TRANSACTIONS_FILE, JSON.stringify([], null, 2), 'utf8');
  return [];
}

// Helper to save transactions
function saveTransactions(txs: any[]) {
  fs.writeFileSync(TRANSACTIONS_FILE, JSON.stringify(txs, null, 2), 'utf8');
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Log all API requests
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
  });

  // --- API ROUTES ---

  // Real-time Google Sheets Change Sync
  let sheetsVersion = 1;

  app.post('/api/sheets-webhook', (req, res) => {
    sheetsVersion++;
    console.log(`[Google Sheets Webhook] Change detected at ${new Date().toISOString()}. New sheetsVersion: ${sheetsVersion}`);
    res.json({ success: true, version: sheetsVersion });
  });

  app.get('/api/sheets-version', (req, res) => {
    res.json({ version: sheetsVersion });
  });

  // Get application config
  app.get('/api/config', (req, res) => {
    res.json(loadConfig());
  });

  // Save application config
  app.post('/api/config', (req, res) => {
    try {
      const currentConfig = loadConfig();
      const updatedConfig = { ...currentConfig, ...req.body };
      fs.writeFileSync(CONFIG_FILE, JSON.stringify(updatedConfig, null, 2), 'utf8');
      res.json({ success: true, config: updatedConfig });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get all local transactions (logged via webhook or simulated)
  app.get('/api/transactions', (req, res) => {
    res.json(loadTransactions());
  });

  // Clear local transactions
  app.post('/api/transactions/clear', (req, res) => {
    try {
      saveTransactions([]);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Poll payment status for a specific student
  app.get('/api/payment-status/:studentId', (req, res) => {
    const { studentId } = req.params;
    const transactions = loadTransactions();
    // Look for a successful transaction matching this student ID
    const tx = transactions.find(
      (t: any) => t.studentId.toLowerCase() === studentId.toLowerCase() && t.status === 'Thành công'
    );
    if (tx) {
      res.json({ paid: true, transaction: tx });
    } else {
      res.json({ paid: false });
    }
  });

  // Send test Telegram notification
  app.post('/api/test-telegram', async (req, res) => {
    const { botToken, chatId } = req.body;
    if (!botToken || !chatId) {
      return res.status(400).json({ error: 'Thiếu Token Bot hoặc Chat ID' });
    }
    const text = `🔔 *THÔNG BÁO TEST HỆ THỐNG QUẢN LÝ HỌC PHÍ*\n\nKết nối thành công! Telegram bot đã sẵn sàng gửi thông báo đóng học phí từ phụ huynh.`;
    try {
      const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: 'Markdown'
        })
      });
      const data = await response.json();
      if (data.ok) {
        res.json({ success: true });
      } else {
        res.status(400).json({ error: data.description || 'Gửi test thất bại' });
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // SePay Webhook Callback (or simulated Webhook)
  app.post('/api/sepay-webhook', async (req, res) => {
    console.log('SePay Webhook received payload:', JSON.stringify(req.body, null, 2));
    const config = loadConfig();

    // Verify webhook secret if present in configuration and sent in headers
    const webhookToken = req.headers['x-sepay-secret'] || req.headers['authorization'];
    if (config.sepayWebhookSecret && webhookToken) {
      const cleanToken = String(webhookToken).replace('Bearer ', '').trim();
      if (cleanToken !== config.sepayWebhookSecret) {
        console.warn('SePay Webhook unauthorized. Secret mismatch.');
        return res.status(401).json({ error: 'Unauthorized secret token' });
      }
    }

    const {
      id, // transaction ID
      gateway, // bank name
      transactionDate,
      amount,
      content, // full transfer description
      transferContent,
      subAccount
    } = req.body;

    const fullContent = content || transferContent || '';
    if (!fullContent) {
      return res.status(400).json({ error: 'Nội dung chuyển khoản trống' });
    }

    // Parse Student ID from Transfer Content.
    // Standard format generated by QR: "HP [id] T[thang]"
    // Regex matches HP followed by numbers/letters or just numeric ID
    const hpMatch = fullContent.toUpperCase().match(/HP\s*([A-Za-z0-9]+)/);
    let matchedStudentId = '';
    
    if (hpMatch && hpMatch[1]) {
      matchedStudentId = hpMatch[1].trim();
    } else {
      // Fallback: try to extract any sequence of digits or words
      const generalMatch = fullContent.match(/\b([A-Za-z0-9]{3,10})\b/);
      if (generalMatch) {
        matchedStudentId = generalMatch[1].trim();
      }
    }

    if (!matchedStudentId) {
      console.warn('Cannot parse Student ID from transfer content:', fullContent);
      // We still log the transaction as unassigned/pending investigation
      matchedStudentId = 'PENDING';
    }

    // Save transaction locally
    const transactions = loadTransactions();
    
    // Check if transaction ID already exists to prevent duplicate webhooks
    const existingTx = transactions.find((t: any) => t.id === String(id));
    if (existingTx) {
      return res.json({ success: true, message: 'Giao dịch đã tồn tại' });
    }

    const newTx = {
      id: id ? String(id) : `SP${Date.now()}`,
      studentId: matchedStudentId,
      studentName: req.body.studentName || 'Đang cập nhật...',
      amount: Number(amount) || 0,
      content: fullContent,
      timestamp: transactionDate || new Date().toLocaleString('vi-VN'),
      status: 'Thành công',
      gateway: gateway || 'SePay'
    };

    transactions.unshift(newTx);
    saveTransactions(transactions);

    // Send Notification to Telegram
    if (config.telegramBotToken && config.telegramChatId) {
      const formattedAmount = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(newTx.amount);
      const message = `🔔 *THÔNG BÁO HỌC PHÍ SEPAY*\n` +
                      `-------------------------------\n` +
                      `👤 Học sinh: *${newTx.studentName}*\n` +
                      `🆔 Mã học sinh: \`${newTx.studentId}\`\n` +
                      `💰 Số tiền: *${formattedAmount}*\n` +
                      `📝 Nội dung: \`${newTx.content}\`\n` +
                      `🏦 Cổng: *${newTx.gateway}*\n` +
                      `⏰ Thời gian: ${newTx.timestamp}\n` +
                      `✅ *Trạng thái:* Chờ kế toán đồng bộ Google Sheets!`;

      try {
        await fetch(`https://api.telegram.org/bot${config.telegramBotToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: config.telegramChatId,
            text: message,
            parse_mode: 'Markdown'
          })
        });
        console.log('Telegram notification sent successfully!');
      } catch (err) {
        console.error('Error sending Telegram notification:', err);
      }
    }

    // Trigger Zalo Notification (simulation/webhook forwarding)
    if (config.zaloWebhookUrl) {
      try {
        await fetch(config.zaloWebhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: 'payment_received',
            data: newTx
          })
        });
        console.log('Zalo notification forwarded successfully!');
      } catch (err) {
        console.error('Error sending Zalo webhook:', err);
      }
    }

    res.json({ success: true, message: 'Giao dịch được ghi nhận và thông báo thành công!', transaction: newTx });
  });

  // Endpoint to simulate SePay payment for testing
  app.post('/api/simulate-payment', async (req, res) => {
    const { studentId, studentName, amount, content, gateway } = req.body;
    
    if (!studentId || !amount) {
      return res.status(400).json({ error: 'Thiếu Student ID hoặc số tiền' });
    }

    const mockPayload = {
      id: `SIM${Math.floor(100000 + Math.random() * 900000)}`,
      gateway: gateway || 'Vietcombank',
      transactionDate: new Date().toLocaleString('vi-VN'),
      amount: Number(amount),
      content: content || `HP ${studentId} đóng học phí`,
      transferContent: content || `HP ${studentId} đóng học phí`,
      studentName: studentName || 'Học sinh kiểm thử'
    };

    try {
      // Internal call to our webhook handler
      const config = loadConfig();
      const headers: any = { 'Content-Type': 'application/json' };
      if (config.sepayWebhookSecret) {
        headers['x-sepay-secret'] = config.sepayWebhookSecret;
      }

      const response = await fetch(`http://localhost:${PORT}/api/sepay-webhook`, {
        method: 'POST',
        headers,
        body: JSON.stringify(mockPayload)
      });
      const result = await response.json();
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Handle Vite middleware setup for Development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    // Serve index.html for other URLs in Single Page App mode
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Tuition Manager] Full-stack server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal error starting express server:', err);
});
