const express = require('express');
const router = express.Router();
const { dbAll, dbGet, dbRun } = require('../utils/db');
const { authMiddleware } = require('./auth');
const { sendMail } = require('../utils/email');

// Helper to check if requester is administrator
const adminCheck = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ success: false, message: 'Access denied. Administrators only.' });
  }
};

// ------------------------------------------------------------
// Orders Endpoints
// ------------------------------------------------------------

// GET /api/admin/orders – Fetch all orders
router.get('/orders', authMiddleware, adminCheck, async (req, res) => {
  try {
    const orders = await dbAll('SELECT * FROM Orders ORDER BY createdAt DESC');
    res.json({ success: true, orders });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// PUT /api/admin/orders/:id – Update an order (status, specs)
router.put('/orders/:id', authMiddleware, adminCheck, async (req, res) => {
  try {
    const { status } = req.body;
    const existing = await dbGet('SELECT * FROM Orders WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ success: false, message: 'Order not found' });

    await dbRun('UPDATE Orders SET status = ? WHERE id = ?', [status, req.params.id]);
    res.json({ success: true, message: 'Order status updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// PUT /api/admin/orders/:id/telemetry – Toggle live IoT telemetry broadcast
router.put('/orders/:id/telemetry', authMiddleware, adminCheck, async (req, res) => {
  try {
    const { liveTelemetry } = req.body;
    const existing = await dbGet('SELECT * FROM Orders WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ success: false, message: 'Order not found' });

    const state = liveTelemetry ? 1 : 0;
    await dbRun('UPDATE Orders SET liveTelemetry = ? WHERE id = ?', [state, req.params.id]);
    
    // Broadcast IoT state toggle via websocket trigger (will be picked up in server.js)
    if (global.io) {
      global.io.emit('telemetry_state_change', { orderId: req.params.id, liveTelemetry: state });
    }

    res.json({ success: true, message: `Live IoT Telemetry set to ${state ? 'ENABLED' : 'DISABLED'}` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ------------------------------------------------------------
// Inquiries Endpoints
// ------------------------------------------------------------

// GET /api/admin/inquiries – Fetch all contact inquiries
router.get('/inquiries', authMiddleware, adminCheck, async (req, res) => {
  try {
    const inquiries = await dbAll('SELECT * FROM Inquiries ORDER BY createdAt DESC');
    res.json({ success: true, inquiries });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// PUT /api/admin/inquiries/:id – Update inquiry status
router.put('/inquiries/:id', authMiddleware, adminCheck, async (req, res) => {
  try {
    const { status } = req.body;
    const existing = await dbGet('SELECT * FROM Inquiries WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ success: false, message: 'Inquiry not found' });

    await dbRun('UPDATE Inquiries SET status = ? WHERE id = ?', [status, req.params.id]);
    res.json({ success: true, message: 'Inquiry status updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ------------------------------------------------------------
// Newsletter & Broadcast CRM
// ------------------------------------------------------------

// GET /api/admin/newsletter – Fetch all newsletter subscribers
router.get('/newsletter', authMiddleware, adminCheck, async (req, res) => {
  try {
    const subscribers = await dbAll('SELECT * FROM Subscribers ORDER BY subscribedAt DESC');
    res.json({ success: true, subscribers });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /api/admin/newsletter/broadcast – Compose & broadcast bulk email campaign (CRM)
router.post('/newsletter/broadcast', authMiddleware, adminCheck, async (req, res) => {
  const { subject, body } = req.body;
  if (!subject || !body) {
    return res.status(400).json({ success: false, message: 'Subject and Body content are required.' });
  }

  try {
    const subscribers = await dbAll('SELECT email FROM Subscribers');
    if (subscribers.length === 0) {
      return res.status(400).json({ success: false, message: 'No active subscribers found.' });
    }

    console.log(`Broadcasting email campaign to ${subscribers.length} corporate leads...`);
    
    // Execute async Nodemailer broadcast loop
    let successes = 0;
    for (const sub of subscribers) {
      try {
        await sendMail({
          to: sub.email,
          subject: subject,
          text: body,
          html: `<div style="font-family:'Inter',sans-serif; padding:20px; line-height:1.6; color:#1a1e23; background:#bec8d2; border-radius:12px;">
            <h2>VendX Smart Kiosks Corporate Broadcast</h2>
            <hr style="border:none; border-top:1px solid rgba(0,0,0,0.1); margin:15px 0;"/>
            <p>${body.replace(/\n/g, '<br/>')}</p>
            <hr style="border:none; border-top:1px solid rgba(0,0,0,0.1); margin:15px 0;"/>
            <p style="font-size:0.75rem; color:#4a5568;">You are receiving this B2B corporate broadcast because you subscribed to updates at VendX.</p>
          </div>`
        });
        successes++;
      } catch (err) {
        console.warn(`Failed sending CRM email to: ${sub.email}`, err);
      }
    }

    res.json({ success: true, message: `Successfully broadcasted campaign to ${successes}/${subscribers.length} subscribers!` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error broadcasting email campaign.' });
  }
});

module.exports = router;
