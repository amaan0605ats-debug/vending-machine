const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, '../data/vendx.sqlite');

// Ensure data directory exists
if (!fs.existsSync(path.dirname(dbPath))) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
}

// Function to read JSON file safely
const readJSONLegacy = (filePath) => {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
  } catch (e) {
    console.error(`Error reading legacy JSON file ${filePath}:`, e);
  }
  return [];
};

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database', err);
  } else {
    db.serialize(() => {
      // Admins table
      db.run(`CREATE TABLE IF NOT EXISTS Admins (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE,
        password TEXT
      )`);

      // Clients table
      db.run(`CREATE TABLE IF NOT EXISTS Clients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE,
        password TEXT,
        name TEXT,
        company TEXT
      )`);

      // Products table
      db.run(`CREATE TABLE IF NOT EXISTS Products (
        id TEXT PRIMARY KEY,
        name TEXT,
        tagline TEXT,
        category TEXT,
        price REAL,
        originalPrice REAL,
        image TEXT,
        capacity TEXT,
        inStock INTEGER,
        features TEXT,
        description TEXT,
        rating REAL,
        reviews INTEGER
      )`);

      // Orders table
      db.run(`CREATE TABLE IF NOT EXISTS Orders (
        id TEXT PRIMARY KEY,
        productId TEXT,
        productName TEXT,
        name TEXT,
        email TEXT,
        phone TEXT,
        address TEXT,
        paymentMethod TEXT,
        totalAmount REAL,
        status TEXT,
        createdAt TEXT,
        liveTelemetry INTEGER DEFAULT 0
      )`);

      // Inquiries table
      db.run(`CREATE TABLE IF NOT EXISTS Inquiries (
        id TEXT PRIMARY KEY,
        name TEXT,
        email TEXT,
        phone TEXT,
        city TEXT,
        machine TEXT,
        message TEXT,
        quantity INTEGER,
        createdAt TEXT,
        status TEXT
      )`);

      // Subscribers table
      db.run(`CREATE TABLE IF NOT EXISTS Subscribers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE,
        subscribedAt TEXT
      )`);

      // Seed initial admin if none exists
      db.get("SELECT * FROM Admins WHERE email = ?", [process.env.ADMIN_EMAIL], (err, row) => {
        if (!row) {
          const bcrypt = require('bcryptjs');
          const hash = bcrypt.hashSync(process.env.ADMIN_PASS, 10);
          db.run("INSERT INTO Admins (email, password) VALUES (?, ?)", [process.env.ADMIN_EMAIL, hash]);
        }
      });
      
      // Seed initial client if none exists
      db.get("SELECT * FROM Clients WHERE email = ?", [process.env.CLIENT_EMAIL], (err, row) => {
        if (!row) {
          const bcrypt = require('bcryptjs');
          const hash = bcrypt.hashSync(process.env.CLIENT_PASS, 10);
          db.run("INSERT INTO Clients (email, password, name, company) VALUES (?, ?, ?, ?)", [process.env.CLIENT_EMAIL, hash, 'Jane Doe', 'Acme Corp']);
        }
      });

      // --- LEGACY MIGRATION ---
      // 1. Migrate Products
      db.get("SELECT COUNT(*) as count FROM Products", (err, row) => {
        if (row && row.count === 0) {
          const legacyProducts = readJSONLegacy(path.join(__dirname, '../data/products.json'));
          if (legacyProducts && legacyProducts.length > 0) {
            console.log(`Migrating ${legacyProducts.length} legacy products to SQLite...`);
            const stmt = db.prepare(`INSERT OR REPLACE INTO Products 
              (id, name, tagline, category, price, originalPrice, image, capacity, inStock, features, description, rating, reviews) 
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
            legacyProducts.forEach(p => {
              stmt.run(
                String(p.id),
                p.name,
                p.tagline || '',
                p.category,
                Number(p.price),
                Number(p.originalPrice || 0),
                p.image,
                p.capacity || '',
                p.inStock ? 1 : 0,
                JSON.stringify(p.features || []),
                p.description || '',
                Number(p.rating || 4.5),
                Number(p.reviews || 0)
              );
            });
            stmt.finalize();
          }
        }
      });

      // 2. Migrate Orders
      db.get("SELECT COUNT(*) as count FROM Orders", (err, row) => {
        if (row && row.count === 0) {
          const legacyOrders = readJSONLegacy(path.join(__dirname, '../data/orders.json'));
          if (legacyOrders && legacyOrders.length > 0) {
            console.log(`Migrating ${legacyOrders.length} legacy orders to SQLite...`);
            const stmt = db.prepare(`INSERT OR REPLACE INTO Orders 
              (id, productId, productName, name, email, phone, address, paymentMethod, totalAmount, status, createdAt, liveTelemetry) 
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
            legacyOrders.forEach(o => {
              // Map old statuses to unified B2B statuses if needed, or leave as is
              stmt.run(
                o.id,
                String(o.productId),
                o.productName,
                o.name,
                o.email,
                o.phone,
                o.address || '',
                o.paymentMethod || 'Quote Request',
                Number(o.totalAmount),
                o.status || 'Pending Review',
                o.createdAt,
                o.liveTelemetry ? 1 : 0
              );
            });
            stmt.finalize();
          }
        }
      });

      // 3. Migrate Inquiries
      db.get("SELECT COUNT(*) as count FROM Inquiries", (err, row) => {
        if (row && row.count === 0) {
          const legacyInquiries = readJSONLegacy(path.join(__dirname, '../data/inquiries.json'));
          if (legacyInquiries && legacyInquiries.length > 0) {
            console.log(`Migrating ${legacyInquiries.length} legacy inquiries to SQLite...`);
            const stmt = db.prepare(`INSERT OR REPLACE INTO Inquiries 
              (id, name, email, phone, city, machine, message, quantity, createdAt, status) 
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
            legacyInquiries.forEach(i => {
              stmt.run(
                String(i.id),
                i.name,
                i.email,
                i.phone,
                i.city || '',
                i.machine || 'General',
                i.message || '',
                Number(i.quantity || 1),
                i.createdAt,
                i.status || 'pending'
              );
            });
            stmt.finalize();
          }
        }
      });

      // 4. Migrate Subscribers
      db.get("SELECT COUNT(*) as count FROM Subscribers", (err, row) => {
        if (row && row.count === 0) {
          const legacySubs = readJSONLegacy(path.join(__dirname, '../data/newsletter.json'));
          if (legacySubs && legacySubs.length > 0) {
            console.log(`Migrating ${legacySubs.length} legacy subscribers to SQLite...`);
            const stmt = db.prepare(`INSERT OR IGNORE INTO Subscribers (email, subscribedAt) VALUES (?, ?)`);
            legacySubs.forEach(s => {
              stmt.run(s.email, s.subscribedAt);
            });
            stmt.finalize();
          }
        }
      });


    });
  }
});

// Helper for Promisified queries
const dbRun = (query, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(query, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
};

const dbAll = (query, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

const dbGet = (query, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(query, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

module.exports = { db, dbRun, dbAll, dbGet };
