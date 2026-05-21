const express = require('express');
const router = express.Router();
const { dbAll, dbGet, dbRun } = require('../utils/db');
const { authMiddleware } = require('./auth');
const { sendMail } = require('../utils/email');

// POST /api/order – create new order (Quote Request)
router.post('/', async (req, res) => {
  const { productId, name, email, phone, address, quantity, paymentMethod, items, password } = req.body;
  if (!name || !email || !phone) {
    return res.status(400).json({ success: false, message: 'Missing required fields.' });
  }

  try {
    let orderId = `ORD-${Date.now()}`;
    let finalProdId = productId;
    let finalProdName = '';
    let finalQty = quantity ? Number(quantity) : 1;
    let finalTotal = 0;

    if (items && Array.isArray(items) && items.length > 0) {
      // Multi-item cart checkout
      finalTotal = items.reduce((sum, i) => sum + Number(i.price) * Number(i.quantity), 0);
      finalQty = items.reduce((sum, i) => sum + Number(i.quantity), 0);
      finalProdName = items.map(i => `${i.name} (x${i.quantity})`).join(', ');
      finalProdId = items[0].id;
    } else {
      // Single product direct checkout
      if (!productId) {
        return res.status(400).json({ success: false, message: 'Missing product details.' });
      }
      
      if (productId === 'CUSTOM') {
        finalProdName = req.body.productName || 'Custom Configuration';
        finalTotal = Number(req.body.totalAmount || 97000); // fallback or parsed
      } else {
        const product = await dbGet('SELECT * FROM Products WHERE id = ?', [productId]);
        if (!product) return res.status(404).json({ success: false, message: 'Product not found.' });
        finalProdName = product.name;
        finalTotal = Number(product.price) * finalQty;
      }
    }

    // Insert Order into SQLite
    await dbRun(`INSERT INTO Orders 
      (id, productId, productName, name, email, phone, address, paymentMethod, totalAmount, status, createdAt, liveTelemetry) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      [
        orderId,
        String(finalProdId),
        finalProdName,
        name,
        email.toLowerCase(),
        phone,
        address || '',
        paymentMethod || 'Quote Request',
        finalTotal,
        'Pending Review', // Standard B2B status start
        new Date().toISOString()
      ]
    );

    const emailLower = email.toLowerCase();
    let tempPassword = null;

    // Notify client of their received B2B quote request
    try {
      let emailText = `Hi ${name},\n\nThank you for requesting a quote for ${finalProdName}.\nOur B2B corporate team is reviewing your specs.`;
      let emailHtml = `<p>Hi <strong>${name}</strong>,</p>
        <p>Thank you for requesting a quote for <strong>${finalProdName}</strong>.</p>
        <p>Our B2B corporate team is reviewing your specs.</p>`;
        
      emailText += `\n\nTrack it inside your portal: http://localhost:3000/dashboard.html`;
      emailHtml += `<p>Track it inside your <a href="http://localhost:3000/dashboard.html">Client Portal Workspace</a>.</p>`;

      sendMail({
        to: emailLower,
        subject: `Quote Request Received - ${orderId}`,
        text: emailText,
        html: emailHtml
      }).catch(mailErr => console.warn('Mail send failed', mailErr));
    } catch (mailErr) {
      console.warn('Mail send failed', mailErr);
    }

    res.json({ 
      success: true, 
      orderId, 
      totalAmount: finalTotal, 
      clientEmail: emailLower,
      tempPassword: tempPassword
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ADMIN: GET all orders (protected)
router.get('/', authMiddleware, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ success: false, message: 'Forbidden' });
  try {
    const orders = await dbAll('SELECT * FROM Orders ORDER BY createdAt DESC');
    res.json({ success: true, orders });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ADMIN: UPDATE order status
router.put('/:id', authMiddleware, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ success: false, message: 'Forbidden' });
  
  try {
    const order = await dbGet('SELECT * FROM Orders WHERE id = ?', [req.params.id]);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    const { status } = req.body;
    await dbRun('UPDATE Orders SET status = ? WHERE id = ?', [status, req.params.id]);
    res.json({ success: true, message: 'Order updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// CUSTOMER: GET logged-in client order history
router.get('/history', authMiddleware, async (req, res) => {
  try {
    const client = await dbGet('SELECT * FROM Clients WHERE id = ?', [req.user.id]);
    if (!client) return res.status(404).json({ success: false, message: 'Client workspace not found' });

    const orders = await dbAll('SELECT * FROM Orders WHERE LOWER(email) = ? ORDER BY createdAt DESC', [client.email.toLowerCase()]);
    res.json({ success: true, orders });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// PUBLIC/CLIENT: Track orders by email
router.get('/track', async (req, res) => {
  const { email } = req.query;
  if (!email) return res.status(400).json({ success: false, message: 'Email query parameter required.' });
  
  try {
    const orders = await dbAll('SELECT * FROM Orders WHERE LOWER(email) = ? ORDER BY createdAt DESC', [email.toLowerCase()]);
    res.json({ success: true, orders });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
