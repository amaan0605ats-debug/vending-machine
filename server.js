// server.js – Main entry point for VendX Store
// ------------------------------------------------------------
// Load environment variables
require('dotenv').config();

// Validate required environment variables
const requiredEnv = [
  'SMTP_HOST','SMTP_PORT','SMTP_USER','SMTP_PASS',
  'APP_URL','JWT_SECRET',
  'ADMIN_EMAIL','ADMIN_PASS','CLIENT_EMAIL','CLIENT_PASS'
];
requiredEnv.forEach(v => {
  if (!process.env[v]) {
    console.error(`❌ Missing required environment variable: ${v}`);
    process.exit(1);
  }
});

const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const { Server } = require('socket.io');

// SQLite connection & setup
const { db, dbGet, dbAll, dbRun } = require('./utils/db');

// Email helper (Nodemailer wrapper)
const { sendMail } = require('./utils/email');

// Route modules
const { router: authRouter, authMiddleware } = require('./routes/auth');
const productRouter = require('./routes/products');
const orderRouter = require('./routes/orders');
const adminRouter = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 3000;

// Create HTTP Server
const server = http.createServer(app);

// Create Socket.io instance
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});
global.io = io;

// ------------------------------------------------------------
// Global Middleware
// ------------------------------------------------------------
app.use(cors());
app.use(helmet({
  contentSecurityPolicy: false
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


// Serve static assets (after admin route to ensure protection)
app.use(express.static(path.join(__dirname, 'public')));


// Rate limiting – basic protection against brute‑force / spam
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // limit each IP to 200 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// ------------------------------------------------------------
// API Routes
// ------------------------------------------------------------
app.use('/api/auth', authRouter);
app.use('/api/products', productRouter);
app.use('/api/order', orderRouter);
app.use('/api/admin', adminRouter);

// --------------------------
// Inquiries endpoint (SQLite backend)
// --------------------------
app.post('/api/inquiry', async (req, res) => {
  const { name, email, phone, city, machine, message, quantity } = req.body;
  if (!name || !email || !phone) {
    return res.status(400).json({ success: false, message: 'Name, email and phone are required.' });
  }

  const id = String(Date.now());
  try {
    await dbRun(`INSERT INTO Inquiries (id, name, email, phone, city, machine, message, quantity, createdAt, status) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        name,
        email.toLowerCase(),
        phone,
        city || '',
        machine || 'General',
        message || '',
        quantity ? Number(quantity) : 1,
        new Date().toISOString(),
        'pending'
      ]
    );

    // Send notification email (dummy in dev)
    try {
      sendMail({
        to: email,
        subject: 'We received your inquiry',
        text: `Hi ${name}, we will get back to you shortly regarding ${machine}.`,
        html: `<p>Hi <strong>${name}</strong>, we received your inquiry about <em>${machine}</em>. Our team will contact you shortly.</p>`
      }).catch(e => console.warn('Failed to send inquiry email', e));
    } catch (e) {
      console.warn('Failed to send inquiry email', e);
    }

    res.json({ success: true, inquiryId: id, message: 'Thank you! Our team will contact you within 24 hours.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// --------------------------
// Newsletter signup (SQLite backend)
// --------------------------
app.post('/api/newsletter', async (req, res) => {
  const { email } = req.body;
  if (!email || !email.includes('@')) {
    return res.status(400).json({ success: false, message: 'Valid email required.' });
  }

  try {
    const existing = await dbGet('SELECT * FROM Subscribers WHERE LOWER(email) = ?', [email.toLowerCase()]);
    if (existing) {
      return res.json({ success: true, message: "You're already subscribed!" });
    }

    await dbRun('INSERT INTO Subscribers (email, subscribedAt) VALUES (?, ?)', [email.toLowerCase(), new Date().toISOString()]);
    res.json({ success: true, message: 'Subscribed! Get exclusive deals in your inbox.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// --------------------------
// Stats endpoint – public summary
// --------------------------
app.get('/api/stats', async (req, res) => {
  try {
    const productsCount = await dbGet('SELECT COUNT(*) as count FROM Products');
    const inquiriesCount = await dbGet('SELECT COUNT(*) as count FROM Inquiries');
    const ordersCount = await dbGet('SELECT COUNT(*) as count FROM Orders');
    const subscribersCount = await dbGet('SELECT COUNT(*) as count FROM Subscribers');

    res.json({
      success: true,
      stats: {
        totalProducts: productsCount ? productsCount.count : 0,
        totalInquiries: inquiriesCount ? inquiriesCount.count : 0,
        totalOrders: ordersCount ? ordersCount.count : 0,
        subscribers: subscribersCount ? subscribersCount.count : 0
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ------------------------------------------------------------
// Fallback – serve SPA for unknown routes
// ------------------------------------------------------------
app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ------------------------------------------------------------
// 📊 Real-Time B2B IoT Telemetry Simulator
// ------------------------------------------------------------
const randomEvents = [
  { type: 'success', desc: 'Dispensed Beverage - Slot #14 Coke Zero', sales: 40 },
  { type: 'success', desc: 'Dispensed Snack - Slot #22 Baked Lay\'s Chips', sales: 50 },
  { type: 'info', desc: 'Compressor Cooling cycle engaged', sales: null },
  { type: 'success', desc: 'NFC Contactless Terminal transaction successful', sales: 60 },
  { type: 'critical', desc: 'Edge Alert - Slot #4 Water low capacity threshold (4%)', sales: null },
  { type: 'info', desc: 'RFID Reader ping latency checks: 12ms', sales: null }
];

// Map of active devices to cumulative mock sales count
const activeSalesCounters = {};

setInterval(async () => {
  try {
    // Find all orders that have liveTelemetry = 1
    const liveOrders = await dbAll('SELECT * FROM Orders WHERE liveTelemetry = 1');
    
    liveOrders.forEach(order => {
      // Pick a random event template
      const eventTemplate = randomEvents[Math.floor(Math.random() * randomEvents.length)];
      const now = new Date().toLocaleTimeString();
      
      if (!activeSalesCounters[order.id]) {
        // base start sales tally around order's B2B contract amount for mock realism
        activeSalesCounters[order.id] = Math.floor(order.totalAmount * 0.05); 
      }

      if (eventTemplate.sales) {
        activeSalesCounters[order.id] += eventTemplate.sales;
      }

      // Generate simulated package
      const telemetryPacket = {
        orderId: order.id,
        sales: `₹${activeSalesCounters[order.id].toLocaleString()}`,
        uptime: '99.94%',
        temp: `${(3.5 + Math.random() * 1.5).toFixed(1)}°C`,
        health: 'NOMINAL',
        event: {
          type: eventTemplate.type,
          desc: eventTemplate.desc,
          time: now
        }
      };

      // Broadcast packet via Socket.io to the specific room of this machine
      io.to(`telemetry-${order.id}`).emit('telemetry_update', telemetryPacket);
    });
  } catch (err) {
    console.warn('Error running telemetry simulator', err);
  }
}, 4000);

// Handle socket client connections
io.on('connection', (socket) => {
  socket.on('join_telemetry', (orderId) => {
    // Join room for this specific machine
    socket.join(`telemetry-${orderId}`);
    // console.log(`Client joined telemetry room: telemetry-${orderId}`);
  });

  socket.on('leave_telemetry', (orderId) => {
    socket.leave(`telemetry-${orderId}`);
    // console.log(`Client left telemetry room: telemetry-${orderId}`);
  });
});

// ------------------------------------------------------------
// Start server
// ------------------------------------------------------------
server.listen(PORT, () => {
  console.log(`\n🚀 VendX B2B Store running at http://localhost:${PORT}`);
  console.log('✅ Server loaded SQLite engine & initialized WebSockets.');
});
