// admin.js – VendX Premium B2B Admin Dashboard (client-side SPA)
// --------------------------------------------------------------
// Implements the Dropify-like layout: Left Sidebar, Header,
// Metric Cards, Map Visualizer, Stepper Timeline, and Live Telemetry.
// --------------------------------------------------------------
(() => {
  const API = ""; // Same origin
  const root = document.getElementById('adminRoot');

  // State Management
  const state = {
    products: [],
    orders: [],
    inquiries: [],
    subscribers: [],
    activeTab: 'dashboard',
    selectedOrderId: null,
    theme: 'light',
    socket: null,
    telemetryLogs: [] // Live event logs stream
  };

  // ------- Auth & Token Helpers -------
  
  // Apply saved theme immediately on load so login screen matches theme
  if (localStorage.getItem('vendx-theme') === 'dark') {
    document.body.classList.add('dark-theme');
    state.theme = 'dark';
  }

  const setToken = token => localStorage.setItem('adminToken', token);
  const getToken = () => localStorage.getItem('adminToken');
  const clearToken = () => localStorage.removeItem('adminToken');
  
  const authHeaders = () => ({
    Authorization: `Bearer ${getToken()}`,
    'Content-Type': 'application/json'
  });

  const apiFetch = (url, opts = {}) => {
    const headers = opts.headers ? { ...opts.headers, ...authHeaders() } : authHeaders();
    return fetch(`${API}${url}`, { ...opts, headers });
  };

  // Check login validation initially
  const checkToken = async () => {
    if (!getToken()) {
      renderLogin();
      return;
    }
    try {
      const res = await fetch(`${API}/api/admin/orders`, { headers: authHeaders() });
      if (res.status === 401 || res.status === 403) {
        clearToken();
        renderLogin();
      } else {
        await initDashboard();
      }
    } catch (e) {
      console.error(e);
      renderLogin();
    }
  };

  // ------- WebSockets Setup -------
  const initWebSockets = () => {
    if (typeof io === 'undefined') {
      console.warn("Socket.io is not available. Real-time telemetry will fallback to polling simulation.");
      return;
    }
    
    // Connect to WebSocket server
    state.socket = io();

    state.socket.on('connect', () => {
      // Re-join telemetry rooms for all live orders
      state.orders.forEach(o => {
        if (o.liveTelemetry === 1) {
          state.socket.emit('join_telemetry', o.id);
        }
      });
    });

    state.socket.on('telemetry_update', (packet) => {
      // Find matching order in state and update its parameters
      const order = state.orders.find(o => String(o.id) === String(packet.orderId));
      if (order) {
        order.mockSales = packet.sales;
        order.mockUptime = packet.uptime;
        order.mockTemp = packet.temp;
        order.mockHealth = packet.health;
        order.lastEvent = packet.event;
        
        // Save log to central stream
        const logEntry = `[${packet.event.time}] [Kiosk #${packet.orderId}] ${packet.event.desc}`;
        state.telemetryLogs.unshift(logEntry);
        if (state.telemetryLogs.length > 50) state.telemetryLogs.pop();

        // Dynamically update UI sections if currently visible
        updateLiveTelemetryUI(packet);
      }
    });
  };

  const joinOrderTelemetry = (orderId) => {
    if (state.socket) {
      state.socket.emit('join_telemetry', orderId);
    }
  };

  const leaveOrderTelemetry = (orderId) => {
    if (state.socket) {
      state.socket.emit('leave_telemetry', orderId);
    }
  };

  // ------- State Initialization -------
  const initDashboard = async () => {
    try {
      // Fetch datasets in parallel
      const [resProd, resOrd, resInq, resNews] = await Promise.all([
        apiFetch('/api/products'),
        apiFetch('/api/admin/orders'),
        apiFetch('/api/admin/inquiries'),
        apiFetch('/api/admin/newsletter')
      ]);

      const dataProd = await resProd.json();
      const dataOrd = await resOrd.json();
      const dataInq = await resInq.json();
      const dataNews = await resNews.json();

      state.products = dataProd.products || [];
      state.orders = dataOrd.orders || [];
      state.inquiries = dataInq.inquiries || [];
      state.subscribers = dataNews.subscribers || [];

      // Automatically pick first order for the preview card if none selected
      if (!state.selectedOrderId && state.orders.length > 0) {
        state.selectedOrderId = state.orders[0].id;
      }

      initWebSockets();
      renderLayout();
      switchTab(state.activeTab);
    } catch (err) {
      console.error("Dashboard initialization failed", err);
      renderLogin("Session expired or database error. Please log in again.");
    }
  };

  // Refresh all state variables quietly
  const refreshState = async () => {
    try {
      const [resProd, resOrd, resInq, resNews] = await Promise.all([
        apiFetch('/api/products'),
        apiFetch('/api/admin/orders'),
        apiFetch('/api/admin/inquiries'),
        apiFetch('/api/admin/newsletter')
      ]);
      const dP = await resProd.json();
      const dO = await resOrd.json();
      const dI = await resInq.json();
      const dN = await resNews.json();
      state.products = dP.products || [];
      state.orders = dO.orders || [];
      state.inquiries = dI.inquiries || [];
      state.subscribers = dN.subscribers || [];
    } catch (e) {
      console.error("State refresh failed", e);
    }
  };

  // ------- Dynamic UI Live Telemetry Updates -------
  const updateLiveTelemetryUI = (packet) => {
    // If the updated order is the one currently selected on the dashboard tab
    if (state.activeTab === 'dashboard' && String(state.selectedOrderId) === String(packet.orderId)) {
      // Update temperature
      const dialVal = document.getElementById('liveDialValue');
      if (dialVal) {
        dialVal.textContent = packet.temp;
        // Animate dial dashoffset based on temperature (range 2°C to 10°C)
        const ring = document.getElementById('liveDialRing');
        if (ring) {
          const tempNum = parseFloat(packet.temp);
          const percent = Math.min(Math.max((tempNum - 2) / 8, 0), 1);
          const offset = 440 - (percent * 330); // 330 deg active arc
          ring.style.strokeDashoffset = offset;
        }
      }

      // Update log line
      const latestMsg = document.getElementById('latestTelemetryMsg');
      if (latestMsg) {
        latestMsg.innerHTML = `<span style="color:var(--accent-purple); font-weight:bold;">[${packet.event.time}]</span> ${packet.event.desc}`;
        latestMsg.classList.add('fade-in');
        setTimeout(() => latestMsg.classList.remove('fade-in'), 300);
      }

      // Update sales total in spec sheet
      const specSales = document.getElementById('specSalesVal');
      if (specSales) {
        specSales.textContent = packet.sales;
      }
    }

    // Update the live device list if Devices tab is active
    if (state.activeTab === 'devices') {
      const activeCard = document.querySelector(`.telemetry-node-card[data-id="${packet.orderId}"]`);
      if (activeCard) {
        const tempText = activeCard.querySelector('.node-temp');
        const salesText = activeCard.querySelector('.node-sales');
        const eventText = activeCard.querySelector('.node-event');
        if (tempText) tempText.textContent = packet.temp;
        if (salesText) salesText.textContent = packet.sales;
        if (eventText) eventText.innerHTML = `<small style="color:var(--text-secondary);">${packet.event.time}: ${packet.event.desc}</small>`;
      }

      // Append log to general console
      const term = document.getElementById('terminalConsole');
      if (term) {
        const logLine = document.createElement('div');
        logLine.className = 'term-line';
        logLine.style.marginBottom = '6px';
        logLine.innerHTML = `<span style="color:var(--accent-purple)">[${packet.event.time}]</span> <span style="color:var(--accent-green)">[Kiosk #${packet.orderId}]</span> ${packet.event.desc}`;
        term.prepend(logLine);
        if (term.childNodes.length > 30) term.removeChild(term.lastChild);
      }
    }
  };

  // ------- LOGIN RENDERING -------
  const renderLogin = (errorMsg = "") => {
    root.innerHTML = `
      <div class="admin-login-overlay">
        <div class="admin-login-card">
          <div class="sidebar-logo" style="justify-content: center; margin-bottom: 20px;">
            <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round" stroke-linejoin="round">
              <path d="M50 10L10 50L50 90L90 50L50 10Z"/>
              <path d="M50 30L30 50L50 70L70 50L50 30Z" fill="currentColor"/>
            </svg>
            <span>VendX Operations</span>
          </div>
          <h2>Sign In to Console</h2>
          <p>Provide administrator credential credentials to access telemetry and order routes.</p>
          
          <div class="admin-form-group" style="text-align: left;">
            <label for="adminEmail">Email Address</label>
            <input type="email" id="adminEmail" class="admin-input" placeholder="admin@vendx.com" required value="admin@vendx.com" />
          </div>
          
          <div class="admin-form-group" style="text-align: left; margin-bottom: 10px;">
            <label for="adminPassword">Security Password</label>
            <input type="password" id="adminPassword" class="admin-input" placeholder="••••••••" required value="admin123" />
          </div>

          <div style="margin: 0 0 25px; display: flex; align-items: center; gap: 8px;">
            <input type="checkbox" id="showAdminPassword" style="cursor: pointer; width: 15px; height: 15px;">
            <label for="showAdminPassword" style="cursor: pointer; font-size: 0.85rem; color: var(--text-secondary); user-select: none; margin:0;">Reveal Password</label>
          </div>

          <button class="btn-purple" id="loginBtn" style="width:100%; padding: 14px; font-size: 1rem; border-radius: var(--radius-md);">Authenticate</button>
          <p id="loginMsg" style="color:var(--accent-red); margin-top: 15px; font-size: 0.85rem; font-weight: 500;">${errorMsg}</p>
        </div>
      </div>`;

    document.getElementById('showAdminPassword').onchange = (e) => {
      document.getElementById('adminPassword').type = e.target.checked ? 'text' : 'password';
    };

    document.getElementById('loginBtn').onclick = async () => {
      const email = document.getElementById('adminEmail').value.trim();
      const password = document.getElementById('adminPassword').value;
      const msg = document.getElementById('loginMsg');
      if (!email || !password) return (msg.textContent = 'Both fields required.');
      
      try {
        const res = await fetch(`${API}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        if (data.success) {
          setToken(data.token);
          await initDashboard();
        } else {
          msg.textContent = data.message || 'Login failed';
        }
      } catch (e) {
        console.error(e);
        msg.textContent = 'Connection error';
      }
    };
  };

  // ------- BASE APP STRUCTURE (Sidebar & Header) -------
  const renderLayout = () => {
    root.innerHTML = `
      <div class="app-container">
        <!-- Sidebar Navigation -->
        <aside class="sidebar">
          <div>
            <div class="sidebar-logo">
              <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round" stroke-linejoin="round">
                <path d="M50 10L10 50L50 90L90 50L50 10Z"/>
                <path d="M50 30L30 50L50 70L70 50L50 30Z" fill="currentColor"/>
              </svg>
              <span>VendX</span>
            </div>
            <nav class="sidebar-nav">
              <button class="nav-item active" data-tab="dashboard">
                <svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/></svg>
                <span>Dashboard</span>
              </button>
              <button class="nav-item" data-tab="orders">
                <svg viewBox="0 0 24 24"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
                <span>Machine Orders</span>
                <span class="badge badge-orders" id="badgeOrders">0</span>
              </button>
              <button class="nav-item" data-tab="products">
                <svg viewBox="0 0 24 24"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/><path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3"/></svg>
                <span>Products Catalog</span>
              </button>
              <button class="nav-item" data-tab="devices">
                <svg viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"/><rect x="2" y="14" width="20" height="8" rx="2" ry="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg>
                <span>Devices IoT</span>
              </button>
              <button class="nav-item" data-tab="crm">
                <svg viewBox="0 0 24 24"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                <span>CRM Broadcast</span>
              </button>
              <button class="nav-item" data-tab="inquiries">
                <svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                <span>Inquiries</span>
                <span class="badge badge-inquiries" id="badgeInquiries">0</span>
              </button>
            </nav>
          </div>

          <div class="sidebar-footer">
            <div class="profile-card">
              <img src="assets/admin_avatar.png" alt="Amaan Avatar" class="profile-avatar">
              <div class="profile-info">
                <div class="profile-name">Amaan Ahmad</div>
                <div class="profile-role">Administrator</div>
              </div>
              <button id="logoutBtn" style="background:transparent; border:none; margin-left:auto; cursor:pointer; color:var(--text-secondary);" title="Sign Out">
                <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
              </button>
            </div>
            <div class="theme-toggle">
              <button class="toggle-btn active" id="themeLightBtn">Light</button>
              <button class="toggle-btn" id="themeDarkBtn">Dark</button>
            </div>
          </div>
        </aside>

        <!-- Main Workspace -->
        <main class="main-content">
          <header class="top-header">
            <div class="header-welcome">
              <h1 id="welcomeTitle">Welcome back, Jack!</h1>
              <p id="welcomeSubtitle">You have 0 new quote requests to review.</p>
            </div>
            <div class="header-actions">
              <div class="search-bar">
                <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input type="text" id="dashboardSearch" placeholder="Search orders, clients, or products...">
              </div>
              <button class="action-btn" title="System Status" id="notifyBell">
                <svg viewBox="0 0 24 24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
                <span class="ping-dot"></span>
              </button>
              <button class="action-btn" title="Messages Hub" id="notifyMail">
                <svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              </button>
              <button class="btn-purple" id="headerActionBtn">Create New Product</button>
            </div>
          </header>

          <!-- Tab Content Panes -->
          <div class="tab-pane active" id="pane-dashboard"></div>
          <div class="tab-pane" id="pane-orders"></div>
          <div class="tab-pane" id="pane-products"></div>
          <div class="tab-pane" id="pane-devices"></div>
          <div class="tab-pane" id="pane-crm"></div>
          <div class="tab-pane" id="pane-inquiries"></div>
        </main>
      </div>

      <!-- Add/Edit Product Modal Overlay -->
      <div class="form-modal-overlay" id="productModal">
        <div class="form-modal">
          <div class="modal-header">
            <h3 id="modalTitle">Add Product</h3>
            <button class="modal-close-btn" id="closeModalBtn">&times;</button>
          </div>
          <form id="productForm">
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">
              <div class="admin-form-group">
                <label>Name</label>
                <input type="text" name="name" class="admin-input" required />
              </div>
              <div class="admin-form-group">
                <label>Tagline</label>
                <input type="text" name="tagline" class="admin-input" placeholder="Best Seller" />
              </div>
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">
              <div class="admin-form-group">
                <label>Category</label>
                <input type="text" name="category" class="admin-input" placeholder="snacks or beverages" required />
              </div>
              <div class="admin-form-group">
                <label>Capacity</label>
                <input type="text" name="capacity" class="admin-input" placeholder="500 items" />
              </div>
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">
              <div class="admin-form-group">
                <label>Price (INR)</label>
                <input type="number" name="price" class="admin-input" required />
              </div>
              <div class="admin-form-group">
                <label>Original Price</label>
                <input type="number" name="originalPrice" class="admin-input" />
              </div>
            </div>
            <div style="display:grid; grid-template-columns:1.5fr 1fr; gap:16px;">
              <div class="admin-form-group">
                <label>Image URL</label>
                <input type="text" name="image" class="admin-input" required />
              </div>
              <div class="admin-form-group">
                <label>Stock Status</label>
                <select name="inStock" class="admin-select">
                  <option value="true">In Stock</option>
                  <option value="false">Out of Stock</option>
                </select>
              </div>
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">
              <div class="admin-form-group">
                <label>Rating (e.g. 4.8)</label>
                <input type="number" step="0.1" name="rating" class="admin-input" />
              </div>
              <div class="admin-form-group">
                <label>Reviews Count</label>
                <input type="number" name="reviews" class="admin-input" />
              </div>
            </div>
            <div class="admin-form-group">
              <label>Features (comma separated)</label>
              <input type="text" name="features" class="admin-input" placeholder="Touchscreen, IoT, Cooler" />
            </div>
            <div class="admin-form-group">
              <label>Description</label>
              <textarea name="description" class="admin-textarea" required></textarea>
            </div>
            <div style="display:flex; gap:12px; margin-top:20px;">
              <button class="btn-purple" type="submit" id="saveProductBtn" style="flex:1;">Save Machine</button>
              <button class="admin-input" type="button" id="cancelProductBtn" style="flex:1; width:auto; cursor:pointer;">Cancel</button>
            </div>
          </form>
        </div>
      </div>`;

    // Logout Click
    document.getElementById('logoutBtn').onclick = () => {
      if (state.socket) state.socket.close();
      clearToken();
      renderLogin();
    };

    // Auto logout on page unload (e.g., closing admin panel)
    window.addEventListener('beforeunload', () => {
      if (state.socket) state.socket.close();
      clearToken();
    });

    // Sidebar navigation click routing
    document.querySelectorAll('.nav-item').forEach(btn => {
      btn.onclick = () => {
        const tab = btn.dataset.tab;
        switchTab(tab);
      };
    });

    // Theme switching with persistence
    const body = document.body;
    const lightBtn = document.getElementById('themeLightBtn');
    const darkBtn = document.getElementById('themeDarkBtn');

    // Load saved theme from localStorage if present
    const savedTheme = localStorage.getItem('vendx-theme');
    if (savedTheme === 'dark') {
      body.classList.add('dark-theme');
      darkBtn.classList.add('active');
      lightBtn.classList.remove('active');
      state.theme = 'dark';
    } else {
      // default to light
      body.classList.remove('dark-theme');
      lightBtn.classList.add('active');
      darkBtn.classList.remove('active');
      state.theme = 'light';
    }

    lightBtn.onclick = () => {
      body.classList.remove('dark-theme');
      lightBtn.classList.add('active');
      darkBtn.classList.remove('active');
      state.theme = 'light';
      localStorage.setItem('vendx-theme', 'light');
    };

    darkBtn.onclick = () => {
      body.classList.add('dark-theme');
      darkBtn.classList.add('active');
      lightBtn.classList.remove('active');
      state.theme = 'dark';
      localStorage.setItem('vendx-theme', 'dark');
    };

    // Header Quick Action and Badges
    document.getElementById('headerActionBtn').onclick = () => {
      openProductForm();
    };

    document.getElementById('notifyMail').onclick = () => {
      switchTab('inquiries');
    };

    document.getElementById('notifyBell').onclick = () => {
      switchTab('devices');
    };

    // Search filtration listener
    document.getElementById('dashboardSearch').oninput = (e) => {
      const query = e.target.value.toLowerCase().trim();
      filterTabContent(query);
    };

    // Update Sidebar Badges
    updateSideBadges();
  };

  // Update Sidebar Counts & Header Message Count
  const updateSideBadges = () => {
    const ordersBadge = document.getElementById('badgeOrders');
    const inquiriesBadge = document.getElementById('badgeInquiries');
    
    // Count unresolved orders (e.g. pending review or quote sent)
    const pendingOrdersCount = state.orders.filter(o => o.status === 'Pending Review' || o.status === 'Quote Sent').length;
    // Count pending inquiries
    const pendingInqCount = state.inquiries.filter(i => i.status === 'pending').length;

    if (ordersBadge) {
      ordersBadge.textContent = pendingOrdersCount;
      ordersBadge.style.display = pendingOrdersCount > 0 ? 'inline-block' : 'none';
    }
    if (inquiriesBadge) {
      inquiriesBadge.textContent = pendingInqCount;
      inquiriesBadge.style.display = pendingInqCount > 0 ? 'inline-block' : 'none';
    }

    const subTitle = document.getElementById('welcomeSubtitle');
    if (subTitle) {
      subTitle.textContent = pendingOrdersCount > 0 
        ? `You have ${pendingOrdersCount} pending B2B quote requests to review.` 
        : `All smart machine requests are currently processed and nominal.`;
    }
  };

  // Tab switcher
  const switchTab = (tabName) => {
    state.activeTab = tabName;
    document.querySelectorAll('.nav-item').forEach(b => {
      b.classList.toggle('active', b.dataset.tab === tabName);
    });

    document.querySelectorAll('.tab-pane').forEach(p => {
      p.classList.toggle('active', p.id === `pane-${tabName}`);
    });

    // Populate actual panels
    if (tabName === 'dashboard') renderDashboardTab();
    else if (tabName === 'orders') renderOrdersTab();
    else if (tabName === 'products') renderProductsTab();
    else if (tabName === 'devices') renderDevicesTab();
    else if (tabName === 'crm') renderCRMTab();
    else if (tabName === 'inquiries') renderInquiriesTab();

    // Reset search bar value when tab changes
    document.getElementById('dashboardSearch').value = '';
  };

  // Search filter routing depending on active tab
  const filterTabContent = (query) => {
    if (!query) {
      switchTab(state.activeTab);
      return;
    }
    if (state.activeTab === 'orders') {
      const filtered = state.orders.filter(o => 
        o.name.toLowerCase().includes(query) || 
        o.email.toLowerCase().includes(query) || 
        o.productName.toLowerCase().includes(query)
      );
      renderOrdersTab(filtered);
    } else if (state.activeTab === 'products') {
      const filtered = state.products.filter(p => 
        p.name.toLowerCase().includes(query) || 
        p.category.toLowerCase().includes(query)
      );
      renderProductsTab(filtered);
    } else if (state.activeTab === 'inquiries') {
      const filtered = state.inquiries.filter(i => 
        i.name.toLowerCase().includes(query) || 
        i.email.toLowerCase().includes(query) || 
        i.message.toLowerCase().includes(query)
      );
      renderInquiriesTab(filtered);
    }
  };

  // ------- TAB 1: OVERVIEW DASHBOARD RENDERING -------
  const renderDashboardTab = () => {
    const pane = document.getElementById('pane-dashboard');
    
    // KPI Math
    const totalSales = state.orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
    const activeIoTCount = state.orders.filter(o => o.liveTelemetry === 1).length;
    const resolvedInqCount = state.inquiries.filter(i => i.status === 'resolved').length;

    // Get currently selected order details for preview widget
    let selectedOrder = state.orders.find(o => o.id === state.selectedOrderId);
    if (!selectedOrder && state.orders.length > 0) {
      selectedOrder = state.orders[0];
      state.selectedOrderId = selectedOrder.id;
    }

    // Mini SVG charts generators
    const renderMiniBarsHTML = () => {
      const heights = [20, 35, 45, 30, 60, 80, 70, 95];
      return heights.map((h, i) => `
        <div class="chart-bar ${i >= 4 ? 'filled' : ''}" style="height: ${h}%;"></div>
      `).join('');
    };

    const renderMiniSparklineHTML = () => `
      <svg viewBox="0 0 100 30" style="width: 80px; height: 35px; fill: none; stroke: var(--accent-purple); stroke-width: 2.5; stroke-linecap: round; stroke-linejoin: round;">
        <path d="M0,25 Q15,5 30,18 T60,5 T90,20 L100,10"/>
      </svg>
    `;

    // Render basic template
    pane.innerHTML = `
      <!-- Top Metrics KPIs -->
      <div class="metrics-row">
        <div class="metric-card">
          <div class="metric-meta">
            <h3>Cumulative Orders Value</h3>
            <div class="metric-value">
              <span class="metric-number">₹${totalSales.toLocaleString()}</span>
              <span class="metric-change up">+18.4%</span>
            </div>
          </div>
          <div class="metric-chart">
            ${renderMiniBarsHTML()}
          </div>
        </div>

        <div class="metric-card">
          <div class="metric-meta">
            <h3>Active Smart Kiosks</h3>
            <div class="metric-value">
              <span class="metric-number">${activeIoTCount} Nodes</span>
              <span class="metric-change up">+12.5%</span>
            </div>
          </div>
          <div class="metric-chart">
            ${renderMiniBarsHTML()}
          </div>
        </div>

        <div class="metric-card">
          <div class="metric-meta">
            <h3>Customer Inquiries</h3>
            <div class="metric-value">
              <span class="metric-number">${state.inquiries.length} Recv</span>
              <span class="metric-change down">-3.2%</span>
            </div>
          </div>
          <div class="metric-chart" style="align-items: center;">
            ${renderMiniSparklineHTML()}
          </div>
        </div>
      </div>

      <!-- Secondary Row Widgets Grid -->
      <div class="dashboard-grid">
        
        <!-- Widget 1: Selected Order Specifications (Package Details) -->
        <div class="card-item">
          <div class="card-title-wrap">
            <h2>Kiosk Specifications</h2>
            <select id="widgetOrderSelect" style="border:none; background:transparent; font-weight:600; color:var(--accent-purple); outline:none; cursor:pointer;">
              ${state.orders.map(o => `
                <option value="${o.id}" ${o.id === state.selectedOrderId ? 'selected' : ''}>Kiosk #${o.id}</option>
              `).join('')}
              ${state.orders.length === 0 ? '<option value="">No Active Orders</option>' : ''}
            </select>
          </div>
          
          ${selectedOrder ? `
            <div class="kiosk-details-card">
              <div class="kiosk-spec-sheet">
                <div class="spec-line">
                  <span class="spec-label">Machine Model</span>
                  <span class="spec-value">${selectedOrder.productName.split('(')[0].replace('Custom: ', '').trim()}</span>
                </div>
                <div class="spec-line">
                  <span class="spec-label">Smart Telemetry</span>
                  <span class="spec-value" style="color: ${selectedOrder.liveTelemetry === 1 ? 'var(--accent-green)' : 'var(--text-secondary)'}">
                    ${selectedOrder.liveTelemetry === 1 ? '🟢 ONLINE STREAM' : '⚪ STANDBY'}
                  </span>
                </div>
                <div class="spec-line">
                  <span class="spec-label">Lifetime B2B Sales</span>
                  <span class="spec-value" id="specSalesVal">${selectedOrder.mockSales || '₹0'}</span>
                </div>
                <div class="spec-line">
                  <span class="spec-label">Hardware Price</span>
                  <span class="spec-value">₹${Number(selectedOrder.totalAmount).toLocaleString()}</span>
                </div>
              </div>

              <div class="receiver-row">
                <div class="receiver-info">
                  <img src="assets/admin_avatar.png" alt="Client Avatar" class="receiver-img">
                  <div class="receiver-meta">
                    <h4>${selectedOrder.name}</h4>
                    <p>${selectedOrder.phone || 'No Phone'}</p>
                  </div>
                </div>
                <a href="tel:${selectedOrder.phone}" class="call-btn" title="Place Voice Call">
                  <svg viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                </a>
              </div>
            </div>
          ` : `
            <p style="color:var(--text-secondary); text-align:center; padding: 40px 0;">No machine orders configured yet.</p>
          `}
        </div>

        <!-- Widget 2: Fulfillment Step Timeline (Order Info NYC->PHI representation) -->
        <div class="card-item">
          <div class="card-title-wrap">
            <h2>Timeline & Status</h2>
            ${selectedOrder ? `
              <select id="timelineStatusSelect" style="border:none; background:transparent; font-weight:600; color:var(--accent-purple); outline:none; cursor:pointer;">
                <option value="Pending Review" ${selectedOrder.status === 'Pending Review' ? 'selected' : ''}>Pending Review</option>
                <option value="Quote Sent" ${selectedOrder.status === 'Quote Sent' ? 'selected' : ''}>Quote Sent</option>
                <option value="Confirmed" ${selectedOrder.status === 'Confirmed' ? 'selected' : ''}>Confirmed</option>
                <option value="In Production" ${selectedOrder.status === 'In Production' ? 'selected' : ''}>In Production</option>
                <option value="Shipped" ${selectedOrder.status === 'Shipped' ? 'selected' : ''}>Shipped</option>
                <option value="Installed" ${selectedOrder.status === 'Installed' ? 'selected' : ''}>Installed</option>
              </select>
            ` : ''}
          </div>

          ${selectedOrder ? `
            <div class="stepper-widget">
              <div class="stepper-track"></div>
              
              <div class="step-node ${getStepClass(selectedOrder.status, 0)}">
                <div class="step-marker">1</div>
                <div class="step-details">
                  <span class="step-name">Quote Received & Review</span>
                  <span class="step-time">${new Date(selectedOrder.createdAt).toLocaleDateString()}</span>
                </div>
              </div>

              <div class="step-node ${getStepClass(selectedOrder.status, 1)}">
                <div class="step-marker">2</div>
                <div class="step-details">
                  <span class="step-name">Corporate Proposal Issued</span>
                  <span class="step-time">Fulfillment</span>
                </div>
              </div>

              <div class="step-node ${getStepClass(selectedOrder.status, 2)}">
                <div class="step-marker">3</div>
                <div class="step-details">
                  <span class="step-name">Contract Confirmed</span>
                  <span class="step-time">Procurement</span>
                </div>
              </div>

              <div class="step-node ${getStepClass(selectedOrder.status, 3)}">
                <div class="step-marker">4</div>
                <div class="step-details">
                  <span class="step-name">Factory Integration / Production</span>
                  <span class="step-time">Assembly</span>
                </div>
              </div>

              <div class="step-node ${getStepClass(selectedOrder.status, 4)}">
                <div class="step-marker">5</div>
                <div class="step-details">
                  <span class="step-name">Shipped to Site Location</span>
                  <span class="step-time">Logistics</span>
                </div>
              </div>

              <div class="step-node ${getStepClass(selectedOrder.status, 5)}">
                <div class="step-marker">6</div>
                <div class="step-details">
                  <span class="step-name">Site Installation & Handover</span>
                  <span class="step-time">Completed</span>
                </div>
              </div>
            </div>
          ` : `
            <p style="color:var(--text-secondary); text-align:center; padding: 40px 0;">No active fulfillment steps.</p>
          `}
        </div>

        <!-- Widget 3: Live Telemetry Gauges / Performance (Speed Statistic Dial & Map Overview) -->
        <div style="display:flex; flex-direction:column; gap:24px;">
          <!-- Speed Statistic Radial Gauge -->
          <div class="card-item" style="padding: 24px; align-items: center; justify-content: center;">
            <h2 style="font-size:1rem; font-weight:600; color:var(--text-secondary); align-self: flex-start; margin-bottom: 10px;">IoT Core Temperature</h2>
            <div class="speed-dial-wrap">
              <svg class="speed-svg" viewBox="0 0 160 160">
                <defs>
                  <linearGradient id="purpleGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="var(--accent-purple)" />
                    <stop offset="100%" stop-color="var(--accent-blue)" />
                  </linearGradient>
                </defs>
                <circle class="speed-track-ring" cx="80" cy="80" r="70" />
                <circle class="speed-fill-ring" id="liveDialRing" cx="80" cy="80" r="70" />
              </svg>
              <div class="speed-text-center">
                <span class="speed-value-big" id="liveDialValue">${selectedOrder?.mockTemp || '4.0°C'}</span>
                <span class="speed-unit">Cooling nominal</span>
              </div>
            </div>
            <div style="font-size:0.75rem; text-align:center; color:var(--text-secondary); margin-top: 10px;" id="latestTelemetryMsg">
              ${selectedOrder?.lastEvent ? `[${selectedOrder.lastEvent.time}] ${selectedOrder.lastEvent.desc}` : 'Standby - telemetry stream inactive'}
            </div>
          </div>

          <!-- India IoT Nodes Network Map -->
          <div class="card-item" style="padding: 20px; flex-grow:1;">
            <h2 style="font-size:1rem; font-weight:600; color:var(--text-secondary); margin-bottom:12px;">Deployment Network</h2>
            <div class="map-overview-card">
              <!-- Inline custom SVG map representing core India IoT locations -->
              <svg class="map-svg-canvas" viewBox="0 0 200 400" xmlns="http://www.w3.org/2000/svg">
                <!-- Delhi to Mumbai to Bengaluru path -->
                <path d="M100 80 L70 200 L110 320" class="map-route-path"/>
                <path d="M100 80 L140 310" class="map-route-path" style="animation-delay: -10s;"/>

                <!-- Delhi Node -->
                <g class="map-city-node" onclick="alert('Delhi Hub: 2 Devices online')">
                  <circle cx="100" cy="80" r="12" class="pulse-node" style="animation-delay: 0s; fill: var(--accent-purple-light);"/>
                  <circle cx="100" cy="80" r="6"/>
                  <text x="110" y="84" class="map-city-label">DELHI</text>
                </g>

                <!-- Mumbai Node -->
                <g class="map-city-node" onclick="alert('Mumbai Hub: 1 Device online')">
                  <circle cx="70" cy="200" r="12" class="pulse-node" style="animation-delay: 0.6s; fill: var(--accent-purple-light);"/>
                  <circle cx="70" cy="200" r="6"/>
                  <text x="30" y="204" class="map-city-label">MUM</text>
                </g>

                <!-- Bengaluru Node -->
                <g class="map-city-node" onclick="alert('Bengaluru Hub: 2 Devices online')">
                  <circle cx="110" cy="320" r="12" class="pulse-node" style="animation-delay: 1.2s; fill: var(--accent-purple-light);"/>
                  <circle cx="110" cy="320" r="6"/>
                  <text x="68" y="324" class="map-city-label">BLR</text>
                </g>

                <!-- Chennai Node -->
                <g class="map-city-node" onclick="alert('Chennai Node: Standby')">
                  <circle cx="140" cy="310" r="6" style="fill: var(--text-muted)"/>
                  <text x="150" y="314" class="map-city-label">MAA</text>
                </g>
              </svg>
              
              <div style="position:absolute; bottom:12px; left:12px; font-size:0.75rem; background:rgba(0,0,0,0.05); padding:4px 8px; border-radius:4px; color:var(--text-secondary); pointer-events:none;">
                Latency: 12ms / 99.8%
              </div>
            </div>
          </div>
        </div>

      </div>

      <!-- Kiosk 3D Mockup Banner Row (Wheeled Robot Trailer design) -->
      <div class="kiosk-mockup-card">
        <img src="assets/smart_vending_mockup.png" alt="Smart Vending Mockup" class="kiosk-mockup-img">
        <div class="kiosk-mockup-details">
          <span class="kiosk-mockup-tag">Edge Platform</span>
          <h3>VendX IoT Smart Kiosk V2</h3>
          <p style="font-size:0.85rem; color:var(--text-secondary); line-height: 1.5; max-width: 550px;">
            Features an built-in Edge Compute Unit with telemetry output. Real-time temperature control, RFID cashless terminal, and active stock levels monitoring direct to database.
          </p>
          <div class="kiosk-mockup-stats">
            <div class="mockup-stat-box">
              <div class="mockup-stat-val">568 lbs</div>
              <div class="mockup-stat-lbl">Shipping Weight</div>
            </div>
            <div class="mockup-stat-box">
              <div class="mockup-stat-val">70" H x 33" W</div>
              <div class="mockup-stat-lbl">Cabinet Footprint</div>
            </div>
          </div>
        </div>
      </div>`;

    // Dropdown selection listeners
    const orderSelect = document.getElementById('widgetOrderSelect');
    if (orderSelect) {
      orderSelect.onchange = (e) => {
        state.selectedOrderId = e.target.value;
        renderDashboardTab();
      };
    }

    const timelineStatusSelect = document.getElementById('timelineStatusSelect');
    if (timelineStatusSelect) {
      timelineStatusSelect.onchange = async (e) => {
        const oId = state.selectedOrderId;
        const newStatus = e.target.value;
        await apiFetch(`/api/admin/orders/${oId}`, {
          method: 'PUT',
          body: JSON.stringify({ status: newStatus })
        });
        await refreshState();
        renderDashboardTab();
        updateSideBadges();
      };
    }

    // Refresh dial animation
    const ring = document.getElementById('liveDialRing');
    if (ring && selectedOrder?.mockTemp) {
      const tempNum = parseFloat(selectedOrder.mockTemp);
      const percent = Math.min(Math.max((tempNum - 2) / 8, 0), 1);
      const offset = 440 - (percent * 330);
      ring.style.strokeDasharray = 440;
      setTimeout(() => {
        ring.style.strokeDashoffset = offset;
      }, 50);
    }
  };

  // Stepper timeline css highlights helper
  const getStepClass = (currentStatus, stepIndex) => {
    const statuses = ['Pending Review', 'Quote Sent', 'Confirmed', 'In Production', 'Shipped', 'Installed'];
    const currentIndex = statuses.indexOf(currentStatus);
    if (currentIndex === stepIndex) return 'active';
    if (currentIndex > stepIndex) return 'completed';
    return '';
  };

  // ------- TAB 2: ORDERS TAB RENDERING -------
  const renderOrdersTab = (ordersList = state.orders) => {
    const pane = document.getElementById('pane-orders');
    
    const renderRowHTML = (o) => {
      // Find matching product for image (or fallback to generic mockup)
      const product = state.products.find(p => p.name === o.productName);
      const productImg = product && product.image ? product.image : 'assets/smart_vending_mockup.png';

      const telemetryBtnText = o.liveTelemetry === 1 ? 'Stop Edge' : 'Boot Edge';
      const telemetryBadge = o.liveTelemetry === 1 
        ? '<span style="display:inline-block; width:8px; height:8px; border-radius:50%; background-color:var(--accent-green); margin-right:6px; box-shadow:0 0 5px var(--accent-green);"></span>' 
        : '<span style="display:inline-block; width:8px; height:8px; border-radius:50%; background-color:var(--text-muted); margin-right:6px;"></span>';

      const statusClass = o.status.toLowerCase().replace(' ', '');
      
      // Determine pill colors dynamically
      let pillBg = 'rgba(0,0,0,0.05)';
      let pillText = 'var(--text-secondary)';
      if (o.status === 'Confirmed' || o.status === 'Shipped' || o.status === 'Installed') {
        pillBg = '#e6f7ec'; // Light green (matches "Published" from image)
        pillText = '#2e7d32'; // Dark green
      } else if (o.status === 'Pending Review' || o.status === 'Quote Sent') {
        pillBg = '#fce4e4'; // Light red/pink (matches "Inactive" from image)
        pillText = '#d32f2f'; // Dark red
      } else if (o.status === 'In Production') {
        pillBg = '#fff3e0'; // Light orange
        pillText = '#ef6c00'; // Dark orange
      }

      const formattedDate = new Date(o.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

      return `
        <div class="premium-list-row" data-id="${o.id}" style="display: flex; align-items: center; justify-content: space-between; padding: 16px 24px; background: var(--card-bg); border-bottom: 1px solid var(--border-color); transition: background 0.2s;" onmouseover="this.style.backgroundColor='var(--app-bg)'" onmouseout="this.style.backgroundColor='var(--card-bg)'">
          
          <!-- Image & Name block -->
          <div style="display: flex; align-items: center; gap: 16px; flex: 2; min-width: 280px;">
            <div style="width: 55px; height: 55px; border-radius: 12px; background: var(--app-bg); display: flex; align-items: center; justify-content: center; overflow: hidden; flex-shrink: 0; padding: 4px; border: 1px solid var(--border-color);">
              <img src="${productImg}" style="max-width: 100%; max-height: 100%; object-fit: contain;">
            </div>
            <div>
              <div style="font-weight: 500; font-size: 1rem; color: var(--text-main); margin-bottom: 2px;">${o.productName}</div>
              <div style="font-size: 0.75rem; color: var(--text-secondary);">(${o.name})</div>
            </div>
          </div>

          <!-- Category (Client/Location) -->
          <div style="flex: 1; min-width: 120px; color: var(--text-secondary); font-size: 0.9rem;">
            ${o.address.split(',')[0] || 'Direct Client'}
          </div>

          <!-- Code (Order ID) -->
          <div style="flex: 1; min-width: 80px; color: var(--text-secondary); font-size: 0.9rem;">
            O-${String(o.id).padStart(4, '0')}
          </div>

          <!-- Price -->
          <div style="flex: 1; min-width: 80px; font-weight: 700; color: var(--text-main); font-size: 0.95rem;">
            ₹${Number(o.totalAmount).toLocaleString()}
          </div>

          <!-- Date -->
          <div style="flex: 1; min-width: 100px; color: var(--text-secondary); font-size: 0.9rem;">
            ${formattedDate}
          </div>

          <!-- Status Pill Dropdown -->
          <div style="flex: 1; min-width: 120px; display: flex; align-items: center;">
            <select class="admin-select status-select" data-id="${o.id}" style="appearance: none; background: ${pillBg}; color: ${pillText}; border: none; padding: 6px 14px; border-radius: 50px; font-size: 0.75rem; font-weight: 600; cursor: pointer; text-align: center; outline: none; transition: 0.2s;">
              <option value="Pending Review" ${o.status === 'Pending Review' ? 'selected' : ''}>Pending Review</option>
              <option value="Quote Sent" ${o.status === 'Quote Sent' ? 'selected' : ''}>Quote Sent</option>
              <option value="Confirmed" ${o.status === 'Confirmed' ? 'selected' : ''}>Confirmed</option>
              <option value="In Production" ${o.status === 'In Production' ? 'selected' : ''}>In Production</option>
              <option value="Shipped" ${o.status === 'Shipped' ? 'selected' : ''}>Shipped</option>
              <option value="Installed" ${o.status === 'Installed' ? 'selected' : ''}>Installed</option>
            </select>
          </div>

          <!-- Actions (Telemetry & Menu) -->
          <div style="width: 90px; display: flex; align-items: center; justify-content: flex-end; gap: 10px;">
            <button class="telemetry-toggle-btn" data-id="${o.id}" data-state="${o.liveTelemetry || 0}" title="${telemetryBtnText}" style="background: transparent; border: none; cursor: pointer; padding: 4px; display: flex; align-items: center; transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='none'">
              ${telemetryBadge}
            </button>
            <button style="width: 32px; height: 32px; border-radius: 50%; background: var(--app-bg); border: none; color: var(--text-secondary); cursor: pointer; font-weight: bold; font-size: 1rem; display: flex; align-items: center; justify-content: center; padding-bottom: 6px; transition: 0.2s;" onmouseover="this.style.backgroundColor='var(--border-color)'; this.style.color='var(--text-main)';" onmouseout="this.style.backgroundColor='var(--app-bg)'; this.style.color='var(--text-secondary)';">
              ...
            </button>
          </div>
        </div>`;
    };

    pane.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
        <h2 style="font-size:1.4rem; font-weight:700;">Customer Quote Requests</h2>
        <div style="font-size:0.85rem; color:var(--text-secondary);">${ordersList.length} Order Records</div>
      </div>
      <div class="premium-list-container" style="background: var(--card-bg); border-radius: 16px; border: 1px solid var(--border-color); box-shadow: var(--shadow); overflow: hidden; padding: 4px 0;">
        ${ordersList.length > 0 ? ordersList.map(renderRowHTML).join('') : '<div style="text-align:center; padding: 40px; color:var(--text-secondary);">No orders found matching the filter query.</div>'}
      </div>`;

    // Dropdown change listeners
    pane.querySelectorAll('.status-select').forEach(select => {
      select.onchange = async (e) => {
        const oId = e.target.dataset.id;
        const newStatus = e.target.value;
        await apiFetch(`/api/admin/orders/${oId}`, {
          method: 'PUT',
          body: JSON.stringify({ status: newStatus })
        });
        await refreshState();
        updateSideBadges();
        renderOrdersTab();
      };
    });

    // Telemetry toggle click listeners
    pane.querySelectorAll('.telemetry-toggle-btn').forEach(btn => {
      btn.onclick = async (e) => {
        const oId = e.target.dataset.id;
        const currentState = Number(e.target.dataset.state);
        const newState = currentState === 1 ? 0 : 1;
        
        await apiFetch(`/api/admin/orders/${oId}/telemetry`, {
          method: 'PUT',
          body: JSON.stringify({ liveTelemetry: newState })
        });

        // Websocket room sync
        if (newState === 1) {
          joinOrderTelemetry(oId);
        } else {
          leaveOrderTelemetry(oId);
        }

        await refreshState();
        renderOrdersTab();
      };
    });
  };

  // ------- TAB 3: PRODUCTS TAB RENDERING -------
  const renderProductsTab = (productsList = state.products) => {
    const pane = document.getElementById('pane-products');

    const renderCardHTML = (p) => `
      <div class="product-admin-card" data-id="${p.id}">
        <div style="position:absolute; top:12px; left:12px; background:var(--accent-purple-light); color:var(--accent-purple); font-size:0.7rem; font-weight:bold; padding:2px 8px; border-radius:50px; text-transform:uppercase;">
          ${p.category}
        </div>
        <img src="${p.image}" alt="${p.name}">
        <h4>${p.name}</h4>
        <div class="price">₹${Number(p.price).toLocaleString()}</div>
        <div style="font-size:0.75rem; color:var(--text-secondary); margin-bottom:15px; text-align:center;">
          Capacity: ${p.capacity || 'N/A'} • ${p.inStock ? 'In Stock' : 'Out of Stock'}
        </div>
        <div class="product-admin-actions">
          <button class="btn-purple edit-btn" style="background-color: var(--app-bg); color: var(--text-main); border: 1px solid var(--border-color); border-radius: var(--radius-sm);">Edit Specs</button>
          <button class="btn-purple delete-btn" style="background-color: var(--accent-red-light); color: var(--accent-red); border: none; border-radius: var(--radius-sm);">Delete</button>
        </div>
      </div>`;

    pane.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:24px;">
        <h2 style="font-size:1.4rem; font-weight:700;">Vending Machine Catalog</h2>
        <button class="btn-purple" id="addNewProdBtn">Add Vending Kiosk</button>
      </div>
      <div class="products-admin-grid">
        ${productsList.map(renderCardHTML).join('')}
        ${productsList.length === 0 ? '<p style="grid-column:1/-1; text-align:center; padding: 40px; color:var(--text-secondary);">No products registered in the database.</p>' : ''}
      </div>`;

    // Modal triggers
    document.getElementById('addNewProdBtn').onclick = () => openProductForm();

    pane.querySelectorAll('.edit-btn').forEach(btn => {
      btn.onclick = () => {
        const card = btn.closest('.product-admin-card');
        const id = card.dataset.id;
        const prod = state.products.find(p => String(p.id) === String(id));
        openProductForm(prod);
      };
    });

    pane.querySelectorAll('.delete-btn').forEach(btn => {
      btn.onclick = async () => {
        const card = btn.closest('.product-admin-card');
        const id = card.dataset.id;
        if (!confirm('Are you sure you want to delete this vending system model from the registry?')) return;
        await apiFetch(`/api/products/${id}`, { method: 'DELETE' });
        await refreshState();
        renderProductsTab();
      };
    });
  };

  // Manage product detail edit modal dialog
  const openProductForm = (product = null) => {
    const isEdit = !!product;
    const modal = document.getElementById('productModal');
    const form = document.getElementById('productForm');
    
    document.getElementById('modalTitle').textContent = isEdit ? 'Modify Vending System Specifications' : 'Add New Vending System Model';
    document.getElementById('saveProductBtn').textContent = isEdit ? 'Apply Changes' : 'Create Registry Listing';

    // Prefill form
    form.reset();
    if (isEdit) {
      form.elements.name.value = product.name || '';
      form.elements.tagline.value = product.tagline || '';
      form.elements.category.value = product.category || '';
      form.elements.capacity.value = product.capacity || '';
      form.elements.price.value = product.price || '';
      form.elements.originalPrice.value = product.originalPrice || '';
      form.elements.image.value = product.image || '';
      form.elements.inStock.value = product.inStock !== false ? 'true' : 'false';
      form.elements.rating.value = product.rating || '';
      form.elements.reviews.value = product.reviews || '';
      form.elements.features.value = product.features ? product.features.join(', ') : '';
      form.elements.description.value = product.description || '';
    }

    modal.classList.add('active');

    // Close options
    const closeModal = () => modal.classList.remove('active');
    document.getElementById('closeModalBtn').onclick = closeModal;
    document.getElementById('cancelProductBtn').onclick = closeModal;

    form.onsubmit = async (e) => {
      e.preventDefault();
      const formData = Object.fromEntries(new FormData(form));

      formData.price = Number(formData.price);
      formData.originalPrice = Number(formData.originalPrice || 0);
      formData.inStock = formData.inStock === 'true';
      formData.features = formData.features ? formData.features.split(',').map(f => f.trim()).filter(Boolean) : [];
      formData.rating = formData.rating ? Number(formData.rating) : 4.5;
      formData.reviews = formData.reviews ? Number(formData.reviews) : 0;

      const method = isEdit ? 'PUT' : 'POST';
      const endpoint = isEdit ? `/api/products/${product.id}` : '/api/products';
      
      const res = await apiFetch(endpoint, {
        method,
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      
      if (data.success) {
        closeModal();
        await refreshState();
        renderProductsTab();
      } else {
        alert(data.message || 'Operation failed.');
      }
    };
  };

  // ------- TAB 4: DEVICES TELEMETRY ROOM -------
  const renderDevicesTab = () => {
    const pane = document.getElementById('pane-devices');
    const liveDevices = state.orders.filter(o => o.liveTelemetry === 1);

    const renderCardHTML = (o) => `
      <div class="telemetry-node-card" data-id="${o.id}">
        <div class="node-header">
          <span class="node-title">${o.productName.split('(')[0].replace('Custom: ', '')}</span>
          <span class="node-status active"></span>
        </div>
        <div style="font-size:0.75rem; color:var(--text-secondary);">Kiosk ID: #${o.id} • ${o.name}</div>
        
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 10px;">
          <div style="background:var(--app-bg); padding:10px; border-radius: var(--radius-sm);">
            <div style="font-size:0.65rem; color:var(--text-secondary); text-transform:uppercase;">Temperature</div>
            <div style="font-size:1.1rem; font-weight:bold; color:var(--text-main);" class="node-temp">${o.mockTemp || '4.0°C'}</div>
          </div>
          <div style="background:var(--app-bg); padding:10px; border-radius: var(--radius-sm);">
            <div style="font-size:0.65rem; color:var(--text-secondary); text-transform:uppercase;">Mock Sales</div>
            <div style="font-size:1.1rem; font-weight:bold; color:var(--text-main);" class="node-sales">${o.mockSales || '₹0'}</div>
          </div>
        </div>

        <div style="font-size:0.8rem;" class="node-event">
          ${o.lastEvent ? `<small style="color:var(--text-secondary);">${o.lastEvent.time}: ${o.lastEvent.desc}</small>` : '<small style="color:var(--text-muted);">Waiting for telemetry stream packet...</small>'}
        </div>
      </div>`;

    pane.innerHTML = `
      <div style="margin-bottom:24px;">
        <h2 style="font-size:1.4rem; font-weight:700;">Live IoT Telemetry control room</h2>
        <p style="font-size:0.9rem; color:var(--text-secondary);">Active devices join websocket rooms. Turn on telemetry on the Machine Orders page to connect new nodes.</p>
      </div>

      <div class="telemetry-node-row">
        ${liveDevices.map(renderCardHTML).join('')}
        ${liveDevices.length === 0 ? `
          <div style="grid-column: 1/-1; background:var(--card-bg); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding:50px; text-align:center;">
            <p style="color:var(--text-secondary); margin-bottom:15px;">No smart kiosks are broadcasting telemetry packets right now.</p>
            <button class="btn-purple" onclick="switchTab('orders')" style="padding:10px 20px;">Open Machine Orders Tab</button>
          </div>
        ` : ''}
      </div>

      ${liveDevices.length > 0 ? `
        <div class="card-item" style="padding: 24px;">
          <div class="card-title-wrap">
            <h2>Real-Time Operations Console</h2>
            <button class="btn-purple" id="clearTermBtn" style="padding: 4px 12px; font-size: 0.75rem; background-color: var(--accent-red-light); color: var(--accent-red); border: none;">Clear Console</button>
          </div>
          <div id="terminalConsole" style="background:#000; border-radius: var(--radius-md); padding:20px; font-family:'Courier New',Courier,monospace; font-size:0.85rem; height: 300px; overflow-y:auto; color:#10b981; border: 1px solid #10b981; box-shadow: 0 10px 30px rgba(16,185,129,0.05);">
            ${state.telemetryLogs.map(l => `<div class="term-line" style="margin-bottom:6px;"><span style="color:var(--accent-purple)">[LOG]</span> ${l}</div>`).join('')}
            <div class="term-line" style="color:var(--text-muted)">// Operations terminal initialized. Stream pings active...</div>
          </div>
        </div>
      ` : ''}`;

    const clearBtn = document.getElementById('clearTermBtn');
    if (clearBtn) {
      clearBtn.onclick = () => {
        state.telemetryLogs = [];
        const term = document.getElementById('terminalConsole');
        if (term) term.innerHTML = '<div class="term-line" style="color:var(--text-muted)">// Operations terminal cleared.</div>';
      };
    }
  };

  // ------- TAB 5: CRM & CAMPAIGN MAILINGS -------
  const renderCRMTab = () => {
    const pane = document.getElementById('pane-crm');

    pane.innerHTML = `
      <div style="margin-bottom:24px;">
        <h2 style="font-size:1.4rem; font-weight:700;">Customer Relations Management (CRM)</h2>
        <p style="font-size:0.9rem; color:var(--text-secondary);">Compose marketing blasts and manage email subscription newsletters.</p>
      </div>

      <div class="crm-layout">
        <!-- Composer -->
        <div class="card-item">
          <h2>Create Corporate Broadcast Campaign</h2>
          <form id="broadcastForm" style="margin-top:20px;">
            <div class="admin-form-group">
              <label>Campaign Email Subject</label>
              <input type="text" id="broadcastSubject" class="admin-input" placeholder="e.g. Introducing SnackBot Pro series vending machine" required />
            </div>
            <div class="admin-form-group">
              <label>HTML / Text Message Content</label>
              <textarea id="broadcastBody" class="admin-textarea" placeholder="Hello subscriber, we are proud to present our brand new smart kiosk catalog..." required></textarea>
            </div>
            <button class="btn-purple" type="submit" id="sendBroadcastBtn" style="width:100%; padding:14px;">🚀 Dispatch Mail Blast</button>
            <p id="broadcastMsg" style="margin-top:15px; font-weight:bold; font-size:0.85rem; text-align:center;"></p>
          </form>
        </div>

        <!-- Subscribers list -->
        <div class="card-item">
          <h2>Active CRM Subscribers (${state.subscribers.length})</h2>
          <div class="table-wrap" style="box-shadow: none; border-color: var(--border-color); margin-top:20px;">
            <table class="admin-table">
              <thead>
                <tr>
                  <th>Client Email Address</th>
                  <th>Joined System</th>
                </tr>
              </thead>
              <tbody>
                ${state.subscribers.map(s => `
                  <tr>
                    <td style="font-weight:600;">${s.email}</td>
                    <td>${new Date(s.subscribedAt).toLocaleDateString()}</td>
                  </tr>
                `).join('')}
                ${state.subscribers.length === 0 ? '<tr><td colspan="2" style="text-align:center; padding: 25px; color:var(--text-secondary);">No email subscribers registered yet.</td></tr>' : ''}
              </tbody>
            </table>
          </div>
        </div>
      </div>`;

    // Handle CRM Send submit
    const form = document.getElementById('broadcastForm');
    form.onsubmit = async (e) => {
      e.preventDefault();
      const subject = document.getElementById('broadcastSubject').value.trim();
      const body = document.getElementById('broadcastBody').value.trim();
      const btn = document.getElementById('sendBroadcastBtn');
      const msg = document.getElementById('broadcastMsg');

      btn.disabled = true;
      btn.textContent = "Dispatched packet queue...";
      msg.textContent = "";

      try {
        const res = await apiFetch('/api/admin/newsletter/broadcast', {
          method: 'POST',
          body: JSON.stringify({ subject, body })
        });
        const data = await res.json();
        if (data.success) {
          msg.style.color = "var(--accent-green)";
          msg.textContent = data.message || "Newsletter broadcast successfully sent!";
          form.reset();
        } else {
          msg.style.color = "var(--accent-red)";
          msg.textContent = data.message || "Mail broadcast failed.";
        }
      } catch (err) {
        console.error(err);
        msg.style.color = "var(--accent-red)";
        msg.textContent = "Server error launching mail campaign.";
      } finally {
        btn.disabled = false;
        btn.textContent = "🚀 Dispatch Mail Blast";
      }
    };
  };

  // ------- TAB 6: INQUIRIES & CUSTOMER MESSAGES -------
  const renderInquiriesTab = (inquiriesList = state.inquiries) => {
    const pane = document.getElementById('pane-inquiries');

    // Currently selected inquiry for view pane
    let activeInquiry = inquiriesList.length > 0 ? inquiriesList[0] : null;

    const renderLeftList = () => {
      return inquiriesList.map(i => {
        const statusClass = i.status === 'resolved' ? 'resolved' : (i.status === 'contacted' ? 'shipped' : 'pending');
        const isActive = activeInquiry && String(activeInquiry.id) === String(i.id);
        
        return `
          <div class="message-list-item ${isActive ? 'active' : ''}" data-id="${i.id}">
            <div class="msg-item-header">
              <span class="msg-item-name">${i.name}</span>
              <span class="msg-item-date">${new Date(i.createdAt).toLocaleDateString()}</span>
            </div>
            <div class="msg-item-subject">${i.machine || 'General Inquiry'}</div>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-top:8px;">
              <small style="color:var(--text-secondary); font-size:0.7rem;">${i.city || 'No Location'}</small>
              <span class="status-pill ${statusClass}" style="font-size:0.6rem; padding: 2px 8px;">${i.status}</span>
            </div>
          </div>`;
      }).join('');
    };

    const renderRightDetails = () => {
      if (!activeInquiry) {
        return `
          <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; flex-grow:1; color:var(--text-secondary); padding: 40px;">
            <svg viewBox="0 0 24 24" width="48" height="48" stroke="currentColor" stroke-width="1.5" fill="none"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            <p style="margin-top:15px; font-weight:500;">Select an inquiry message thread to reply or configure status.</p>
          </div>`;
      }

      return `
        <div class="message-detail-header">
          <div>
            <h3>${activeInquiry.machine || 'General Store Request'}</h3>
            <small style="color:var(--text-secondary);">Thread ID: #${activeInquiry.id} • Received ${new Date(activeInquiry.createdAt).toLocaleString()}</small>
          </div>
          <div>
            <select class="admin-select" id="inqStatusSelect" style="padding:6px 12px; font-size:0.8rem; border-radius: 50px;">
              <option value="pending" ${activeInquiry.status === 'pending' ? 'selected' : ''}>Pending Action</option>
              <option value="contacted" ${activeInquiry.status === 'contacted' ? 'selected' : ''}>Client Contacted</option>
              <option value="resolved" ${activeInquiry.status === 'resolved' ? 'selected' : ''}>Resolved</option>
            </select>
          </div>
        </div>
        
        <div class="message-detail-body">
          <div style="background:var(--app-bg); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding:20px; margin-bottom:25px;">
            <h4 style="font-size:0.95rem; font-weight:bold; color:var(--text-main); margin-bottom:8px;">Sender Contact Details</h4>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; font-size:0.85rem;">
              <div><strong>Name:</strong> ${activeInquiry.name}</div>
              <div><strong>Email:</strong> <a href="mailto:${activeInquiry.email}" style="color:var(--accent-purple); text-decoration:underline;">${activeInquiry.email}</a></div>
              <div><strong>Phone:</strong> ${activeInquiry.phone || 'N/A'}</div>
              <div><strong>Location:</strong> ${activeInquiry.city || 'Not provided'}</div>
            </div>
          </div>

          <h4 style="font-size:0.95rem; font-weight:bold; color:var(--text-secondary); margin-bottom:10px; text-transform:uppercase;">Message text</h4>
          <p style="background:var(--app-bg); padding:20px; border-radius: var(--radius-md); font-family: inherit; font-size:0.95rem; color:var(--text-main); border-left:4px solid var(--accent-purple);">
            ${activeInquiry.message || 'No written message body provided.'}
          </p>
        </div>

        <div class="message-detail-actions">
          <a href="mailto:${activeInquiry.email}?subject=VendX Reply - Regarding ${encodeURIComponent(activeInquiry.machine || 'kiosk Request')}" class="btn-purple" style="display:inline-flex; align-items:center; gap:8px;">
            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" style="margin-right:2px;"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            Reply via Client Email
          </a>
        </div>`;
    };

    pane.innerHTML = `
      <div style="margin-bottom:24px;">
        <h2 style="font-size:1.4rem; font-weight:700;">Customer Messages & Inquiries</h2>
      </div>

      <div class="message-chat-container">
        <!-- Left Side Messages List -->
        <div class="message-sidebar">
          <div class="message-sidebar-header">
            <h3>Recent Inbox</h3>
          </div>
          <div class="message-list" id="inqListContainer">
            ${renderLeftList()}
            ${inquiriesList.length === 0 ? '<p style="text-align:center; padding: 40px 10px; color:var(--text-secondary); font-size:0.85rem;">No customer inquiries in inbox.</p>' : ''}
          </div>
        </div>

        <!-- Right Side Messages Details Pane -->
        <div class="message-detail" id="inqDetailContainer">
          ${renderRightDetails()}
        </div>
      </div>`;

    // Active Selection click binding
    const listItems = pane.querySelectorAll('.message-list-item');
    listItems.forEach(item => {
      item.onclick = () => {
        const id = item.dataset.id;
        activeInquiry = state.inquiries.find(i => String(i.id) === String(id));
        
        // Re-highlight list
        listItems.forEach(li => li.classList.toggle('active', li.dataset.id === id));
        // Redraw details pane
        const detailContainer = document.getElementById('inqDetailContainer');
        if (detailContainer) {
          detailContainer.innerHTML = renderRightDetails();
          bindDetailActions();
        }
      };
    });

    const bindDetailActions = () => {
      const select = document.getElementById('inqStatusSelect');
      if (select && activeInquiry) {
        select.onchange = async (e) => {
          const newStatus = e.target.value;
          await apiFetch(`/api/admin/inquiries/${activeInquiry.id}`, {
            method: 'PUT',
            body: JSON.stringify({ status: newStatus })
          });
          await refreshState();
          updateSideBadges();
          
          // Refresh views
          const updated = state.inquiries.find(i => String(i.id) === String(activeInquiry.id));
          if (updated) activeInquiry.status = updated.status;
          
          const listContainer = document.getElementById('inqListContainer');
          if (listContainer) listContainer.innerHTML = renderLeftList();
          
          // Re-bind click handlers to updated list nodes
          const newItems = pane.querySelectorAll('.message-list-item');
          newItems.forEach(it => {
            it.onclick = () => {
              const itemID = it.dataset.id;
              activeInquiry = state.inquiries.find(i => String(i.id) === String(itemID));
              newItems.forEach(li => li.classList.toggle('active', li.dataset.id === itemID));
              const dc = document.getElementById('inqDetailContainer');
              if (dc) {
                dc.innerHTML = renderRightDetails();
                bindDetailActions();
              }
            };
          });
        };
      }
    };

    bindDetailActions();
  };

  // Run Startup Checks
  checkToken();
})();
