# VendX Smart Vending Machine Store & Admin Portal 🚀

VendX is a premium, fully-featured commercial web application for purchasing and managing smart vending machines. The project has been fully resolved, polished, and upgraded to state-of-the-art standards with robust backend security, rich sliding cart overlays, customizable admin dashboards, real-time status trackers, and animated UI flows.

---

## 🏗️ Technical Architecture & Stack

- **Frontend**: Premium HTML5, CSS3 Custom Theme, Vanilla JS modules, HSL Tailwind-inspired color system, Glassmorphism panels, and scroll-reveal triggers.
- **Backend**: Node.js & Express.js, JSON-based flat-file database, Nodemailer wrapper, custom express-rate-limit security protection.
- **Authentication**: JWT (JSON Web Tokens) with Secure HTTP cookies/Authorization Headers and encrypted credentials.

---

## 🔒 Configuration & Environment Variables

Create a `.env` file in the root directory:
```env
PORT=3000
JWT_SECRET=your_super_secure_jwt_secret_key
ADMIN_EMAIL=admin@vendx.com
ADMIN_PASSWORD=admin123
```

---

## ⚡ Main Feature Resolutions

1. **🔒 Secure Admin Portal**: Fully protected `/api/admin` backend routes validating JWT role permissions.
2. **🛒 Premium Multi-Item Shopping Cart**: Modern sliding right-side Cart Drawer overlay with reactive increments/decrements and unified localStorage checkout.
3. **📊 Admin Dashboard Operations**:
   - Manage Products: Create, edit, and delete products with all features, capacity details, and original pricing indicators.
   - Live Order Fulfillment: Interactive order status updater dropdowns (Pending, Processing, Shipped, Completed, Cancelled).
   - Customer Inquiry Center: Answer/update customer queries directly from the dashboard.
   - Newsletter Center: Monitor newsletter subscribers in real-time.
4. **📞 Contact & Order Forms**: Synchronized all fields (including phone numbers, shipping addresses, quantity limits, and custom payment selections) between forms and APIs.
5. **📜 Customer Order History**: Logged-in customers can view their complete purchase history seamlessly.

---

## 🚀 Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Start the Application
```bash
npm start
```
Or start in development mode:
```bash
npm run dev
```

### 3. Admin Access Credentials
- **Email**: `admin@vendx.com`
- **Password**: `admin123`
- Navigate to: `http://localhost:3000/admin.html` to access the portal.

---

Designed with 🌌 premium dark aesthetics and ultra-responsive layouts.
