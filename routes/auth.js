const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { dbGet, dbRun } = require('../utils/db');

// Admin Login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ success: false, message: 'Email and password required.' });
  
  try {
    const admin = await dbGet('SELECT * FROM Admins WHERE LOWER(email) = ?', [email.toLowerCase()]);
    if (!admin) return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    
    const match = await bcrypt.compare(password, admin.password);
    if (!match) return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    
    const token = jwt.sign({ id: admin.id, role: 'admin' }, process.env.JWT_SECRET || 'secretkey', { expiresIn: '7d' });
    res.json({ success: true, token, user: { id: admin.id, email: admin.email, role: 'admin' } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Client Login
router.post('/client-login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ success: false, message: 'Email and password required.' });
  
  try {
    const client = await dbGet('SELECT * FROM Clients WHERE LOWER(email) = ?', [email.toLowerCase()]);
    if (!client) return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    
    const match = await bcrypt.compare(password, client.password);
    if (!match) return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    
    const token = jwt.sign({ id: client.id, role: 'client', email: client.email }, process.env.JWT_SECRET || 'secretkey', { expiresIn: '7d' });
    res.json({ success: true, token, user: { id: client.id, email: client.email, role: 'client', name: client.name, company: client.company } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Client Request / Generate Password
router.post('/request-password', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !email.includes('@')) {
    return res.status(400).json({ success: false, message: 'Valid corporate email required.' });
  }
  if (!password || password.length < 6) {
    return res.status(400).json({ success: false, message: 'Password is required and must be at least 6 characters.' });
  }

  const emailLower = email.toLowerCase();
  const domain = emailLower.split('@')[1] ? emailLower.split('@')[1].split('.')[0] : 'vendx';
  const hashedPassword = bcrypt.hashSync(password, 10);

  try {
    const existing = await dbGet('SELECT * FROM Clients WHERE email = ?', [emailLower]);
    if (existing) {
      // Reset password to custom chosen password
      await dbRun('UPDATE Clients SET password = ? WHERE email = ?', [hashedPassword, emailLower]);
      
      try {
        const { sendMail } = require('../utils/email');
        sendMail({
          to: emailLower,
          subject: 'Your VendX Workspace Password Reset',
          text: `Hi,\n\nYour Corporate Workspace password has been reset.\nEmail: ${emailLower}\n\nLogin here: ${process.env.APP_URL}/dashboard.html`,
          html: `<p>Hi,</p><p>Your Corporate Workspace password has been reset.</p><p><strong>Email:</strong> ${emailLower}</p><p><a href="${process.env.APP_URL}/dashboard.html">Click here to log in</a></p>`
        }).catch(e => console.warn('Mail send failed', e));
      } catch (e) {
        console.warn('Mail send failed', e);
      }

      return res.json({ 
        success: true, 
        message: `Password updated successfully!`
      });
    } else {
      // Create new Client Workspace
      await dbRun('INSERT INTO Clients (email, password, name, company) VALUES (?, ?, ?, ?)',
        [emailLower, hashedPassword, 'Corporate Partner', domain.toUpperCase()]
      );

      try {
        const { sendMail } = require('../utils/email');
        sendMail({
          to: emailLower,
          subject: 'VendX Workspace Access Active',
          text: `Hi,\n\nYour Corporate Workspace has been initialized.\nEmail: ${emailLower}\n\nLogin here: http://localhost:3000/dashboard.html`,
          html: `<p>Hi,</p><p>Your Corporate Workspace has been initialized.</p><p><strong>Email:</strong> ${emailLower}</p><p><a href="http://localhost:3000/dashboard.html">Click here to log in</a></p>`
        }).catch(e => console.warn('Mail send failed', e));
      } catch (e) {
        console.warn('Mail send failed', e);
      }

      return res.json({ 
        success: true, 
        message: `Corporate account created! Use your custom password to log in.`
      });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Admin ONLY Middleware
function adminAuthMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ success: false, message: 'No token provided.' });
  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'secretkey');
    if (payload.role !== 'admin') return res.status(403).json({ success: false, message: 'Admin access required.' });
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid token.' });
  }
}

// Client ONLY Middleware
function clientAuthMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ success: false, message: 'No token provided.' });
  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'secretkey');
    if (payload.role !== 'client') return res.status(403).json({ success: false, message: 'Client access required.' });
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid token.' });
  }
}

// Any Auth Middleware
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ success: false, message: 'No token provided.' });
  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'secretkey');
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid token.' });
  }
}

module.exports = { router, authMiddleware, adminAuthMiddleware, clientAuthMiddleware };
