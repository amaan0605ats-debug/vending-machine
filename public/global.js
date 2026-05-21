// global.js – Shared script for dynamic hamburger menu, drawer, and catchy scroll-reveal animations
// -------------------------------------------------------------------------------------------------
const initGlobal = () => {
  const navbar = document.getElementById('navbar');
  if (!navbar) return;

  // 1. Remove any old character-based hamburger button
  const oldHams = navbar.querySelectorAll('.hamburger');
  oldHams.forEach(oh => oh.remove());

  // 2. Prepend a modern 3-line hamburger button on the left of the navbar
  const hamburger = document.createElement('button');
  hamburger.className = 'hamburger';
  hamburger.setAttribute('aria-label', 'Open Menu');
  hamburger.innerHTML = '<span></span><span></span><span></span>';
  navbar.insertBefore(hamburger, navbar.firstChild);

  // 3. Inject the Sidebar Drawer overlay and markup into the body
  // Ensure we don't inject multiple drawers if init runs twice
  if (!document.getElementById('navDrawer')) {
    const drawerHTML = `
      <div class="drawer-overlay" id="drawerOverlay"></div>
      <div class="nav-drawer" id="navDrawer">
        <ul class="drawer-links">
          <li><a href="index.html">Home</a></li>
          <li><a href="index.html#shop">Vending Machines</a></li>
          <li><a href="about.html">About Us</a></li>
          <li><a href="faq.html">FAQ</a></li>
          <li><a href="contact.html">Contact Us</a></li>
          
        </ul>
        <div class="drawer-footer">
          <p><strong>VendX Smart Kiosks</strong></p>
          <p>Email: <a href="mailto:amaan0605ats@gmail.com">amaan0605ats@gmail.com</a></p>
          <p>Phone: +91 78897 36790</p>
          <p>Phone: +91 60063 27013</p>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', drawerHTML);
  }

  // 4. Toggle active classes for Drawer opening & closing
  const drawer = document.getElementById('navDrawer');
  const overlay = document.getElementById('drawerOverlay');

  const toggleMenu = () => {
    hamburger.classList.toggle('active');
    drawer.classList.toggle('active');
    overlay.classList.toggle('active');
  };

  hamburger.addEventListener('click', toggleMenu);
  overlay.addEventListener('click', toggleMenu);

  // Close drawer when link clicked
  drawer.querySelectorAll('.drawer-links a').forEach(link => {
    link.addEventListener('click', () => {
      if (drawer.classList.contains('active')) toggleMenu();
    });
  });

  // --- Premium Cart Drawer System ---
  if (!document.getElementById('cartDrawer')) {
    const cartHTML = `
      <div class="cart-overlay" id="cartOverlay"></div>
      <div class="cart-drawer" id="cartDrawer">
        <div class="cart-header">
          <h3>Your Cart</h3>
          <button class="cart-close-btn" id="cartCloseBtn">&times;</button>
        </div>
        <div class="cart-items-wrap" id="cartItemsWrap"></div>
        <div class="cart-footer">
          <div class="cart-total-row">
            <span>Total:</span>
            <span id="cartTotalVal">₹0</span>
          </div>
          <button class="btn btn-dark btn-checkout" id="cartCheckoutBtn" style="width: 100%; margin-top: 15px;">Proceed to Checkout</button>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', cartHTML);
  }

  const cartDrawer = document.getElementById('cartDrawer');
  const cartOverlay = document.getElementById('cartOverlay');
  const cartCloseBtn = document.getElementById('cartCloseBtn');
  const cartItemsWrap = document.getElementById('cartItemsWrap');
  const cartTotalVal = document.getElementById('cartTotalVal');
  const cartCheckoutBtn = document.getElementById('cartCheckoutBtn');

  const toggleCart = () => {
    cartDrawer.classList.toggle('active');
    cartOverlay.classList.toggle('active');
  };

  const getCart = () => JSON.parse(localStorage.getItem('cartItems') || '[]');
  const saveCart = (items) => {
    localStorage.setItem('cartItems', JSON.stringify(items));
    updateCartUI();
  };

  const addToCart = (productId, name, price, image, tagline = '') => {
    const cart = getCart();
    const existing = cart.find(item => Number(item.id) === Number(productId));
    if (existing) {
      existing.quantity += 1;
    } else {
      cart.push({ id: Number(productId), name, price: Number(price), image, tagline, quantity: 1 });
    }
    saveCart(cart);
    cartDrawer.classList.add('active');
    cartOverlay.classList.add('active');
  };

  const updateCartUI = () => {
    const cart = getCart();
    const totalQty = cart.reduce((sum, item) => sum + item.quantity, 0);
    const totalPrice = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    const cartBadge = document.getElementById('cartBadge');
    if (cartBadge) {
      if (totalQty > 0) {
        cartBadge.textContent = totalQty;
        cartBadge.style.display = 'inline-flex';
      } else {
        cartBadge.style.display = 'none';
      }
    }

    if (cartItemsWrap) {
      if (cart.length === 0) {
        cartItemsWrap.innerHTML = '<p style="color: rgba(255,255,255,0.6); text-align: center; margin-top: 40px;">Your cart is empty.</p>';
      } else {
        cartItemsWrap.innerHTML = cart.map(item => `
          <div class="cart-item">
            <img src="${item.image}" alt="${item.name}">
            <div class="cart-item-info">
              <h4>${item.name}</h4>
              <p>₹${Number(item.price).toLocaleString()}</p>
              <div class="cart-item-qty-wrap">
                <button class="qty-btn dec-qty" data-id="${item.id}">-</button>
                <span class="qty-val">${item.quantity}</span>
                <button class="qty-btn inc-qty" data-id="${item.id}">+</button>
              </div>
              <button class="cart-item-remove" data-id="${item.id}">Remove</button>
            </div>
          </div>
        `).join('');

        cartItemsWrap.querySelectorAll('.dec-qty').forEach(btn => {
          btn.onclick = () => {
            const cart = getCart();
            const idx = cart.findIndex(item => Number(item.id) === Number(btn.dataset.id));
            if (idx !== -1) {
              cart[idx].quantity -= 1;
              if (cart[idx].quantity <= 0) cart.splice(idx, 1);
              saveCart(cart);
            }
          };
        });

        cartItemsWrap.querySelectorAll('.inc-qty').forEach(btn => {
          btn.onclick = () => {
            const cart = getCart();
            const idx = cart.findIndex(item => Number(item.id) === Number(btn.dataset.id));
            if (idx !== -1) {
              cart[idx].quantity += 1;
              saveCart(cart);
            }
          };
        });

        cartItemsWrap.querySelectorAll('.cart-item-remove').forEach(btn => {
          btn.onclick = () => {
            const cart = getCart();
            const filtered = cart.filter(item => Number(item.id) !== Number(btn.dataset.id));
            saveCart(filtered);
          };
        });
      }
    }

    if (cartTotalVal) {
      cartTotalVal.textContent = `₹${totalPrice.toLocaleString()}`;
    }
  };

  if (cartCloseBtn) cartCloseBtn.onclick = toggleCart;
  if (cartOverlay) cartOverlay.onclick = toggleCart;

  const navSocial = navbar.querySelector('.nav-social');
  if (navSocial && !document.getElementById('cartToggleBtn')) {
    const cartBtn = document.createElement('button');
    cartBtn.id = 'cartToggleBtn';
    cartBtn.className = 'cart-toggle-btn';
    cartBtn.setAttribute('aria-label', 'Open Cart');
    cartBtn.style.cssText = 'background:none; border:none; color:inherit; cursor:pointer; display:inline-flex; align-items:center; justify-content:center; position:relative; margin-right:15px; outline:none; height:18px; width:18px; vertical-align:middle;';
    cartBtn.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block;">
        <circle cx="9" cy="21" r="1"></circle>
        <circle cx="20" cy="21" r="1"></circle>
        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
      </svg>
      <span class="cart-badge" id="cartBadge" style="position:absolute; top:-8px; right:-8px; background:#e53e3e; color:#fff; border-radius:50%; width:16px; height:16px; font-size:9px; font-weight:bold; display:none; align-items:center; justify-content:center; font-family:\'Inter\', sans-serif; line-height:1;">0</span>
    `;
    navSocial.insertBefore(cartBtn, navSocial.firstChild);
    cartBtn.onclick = toggleCart;
  }

  if (cartCheckoutBtn) {
    const handleCheckout = (e) => {
      e.preventDefault();
      const cart = getCart();
      if (cart.length === 0) {
        alert('Your cart is empty!');
        return;
      }
      window.location.href = 'checkout.html';
    };
    cartCheckoutBtn.addEventListener('click', handleCheckout);
    cartCheckoutBtn.addEventListener('touchstart', handleCheckout, { passive: false });
  }

  window.addToCart = addToCart;
  window.updateCartUI = updateCartUI;
  window.toggleCart = toggleCart;

  updateCartUI();

  // --- 💬 Premium AI Vending Advisor Chatbot System ---
  if (!document.getElementById('chatbotBubble')) {
    const chatbotHTML = `
      <div class="chatbot-bubble" id="chatbotBubble" title="Ask VendBot">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
        </svg>
      </div>
      <div class="chatbot-window" id="chatbotWindow">
        <div class="chatbot-header">
          <h3>VendBot Advisor</h3>
          <span>Online</span>
        </div>
        <div class="chatbot-messages" id="chatbotMessages">
          <div class="chat-msg bot">
            Hello! I am <strong>VendBot</strong>, your virtual smart vending consultant. Let me help you select or design the perfect automated setup!
          </div>
        </div>
        <div class="chat-quick-replies" id="chatbotReplies">
          <button class="reply-btn" data-action="recommend">💡 Help Me Choose</button>
          <button class="reply-btn" data-action="customize">🎨 Build Custom Machine</button>
          <button class="reply-btn" data-action="portal">📊 Open Client Portal</button>
          <button class="reply-btn" data-action="support">📞 Call Back Support</button>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', chatbotHTML);
  }

  const chatbotBubble = document.getElementById('chatbotBubble');
  const chatbotWindow = document.getElementById('chatbotWindow');
  const chatbotMessages = document.getElementById('chatbotMessages');
  const chatbotReplies = document.getElementById('chatbotReplies');

  if (chatbotBubble) {
    chatbotBubble.onclick = () => {
      chatbotWindow.classList.toggle('active');
    };
  }

  const appendMsg = (text, sender = 'bot') => {
    const msg = document.createElement('div');
    msg.className = `chat-msg ${sender}`;
    msg.innerHTML = text;
    chatbotMessages.appendChild(msg);
    chatbotMessages.scrollTop = chatbotMessages.scrollHeight;
  };

  const loadReplies = (replies) => {
    chatbotReplies.innerHTML = '';
    replies.forEach(r => {
      const btn = document.createElement('button');
      btn.className = 'reply-btn';
      btn.textContent = r.text;
      btn.onclick = () => r.action();
      chatbotReplies.appendChild(btn);
    });
  };

  const startAdvisor = () => {
    appendMsg("Awesome! Let's find your perfect machine. First, <strong>how many daily users</strong> (employees/visitors) will the machine serve?", 'bot');
    loadReplies([
      { text: "Under 50 users", action: () => selectSize('small') },
      { text: "50 - 200 users", action: () => selectSize('medium') },
      { text: "More than 200 users", action: () => selectSize('large') }
    ]);
  };

  let userSize = '';
  const selectSize = (size) => {
    userSize = size;
    appendMsg(`You selected: <strong>${size === 'small' ? 'Under 50' : size === 'medium' ? '50-200' : '200+'} users</strong>.`, 'user');
    setTimeout(() => {
      appendMsg("Great! What type of items do you want to serve in your building?", 'bot');
      loadReplies([
        { text: "Snacks & Drinks combo", action: () => recommendMachine('combo') },
        { text: "Just cold drinks & beverages", action: () => recommendMachine('drinks') },
        { text: "Barista-quality hot coffee", action: () => recommendMachine('coffee') }
      ]);
    }, 600);
  };

  const recommendMachine = (type) => {
    appendMsg(`I want to serve: <strong>${type === 'combo' ? 'Snacks & Drinks' : type === 'drinks' ? 'Beverages' : 'Coffee'}</strong>.`, 'user');
    
    setTimeout(() => {
      let name = '';
      let id = 1;
      let price = 97000;
      let img = 'assets/snack_machine_1779011627894.png';
      
      if (type === 'coffee') {
        name = "CafeVend Espresso";
        id = 5;
        price = 95000;
        img = "assets/coffee_machine_1779011706643.png";
      } else if (type === 'drinks') {
        name = "CoolBreeze Beverage Station";
        id = 2;
        price = 72000;
        img = "assets/beverage_machine_1779011649180.png";
      } else {
        if (userSize === 'small') {
          name = "MiniVend Compact";
          id = 6;
          price = 35000;
          img = "assets/mini_machine_1779011727148.png";
        } else if (userSize === 'medium') {
          name = "SmartVend Pro 500";
          id = 1;
          price = 97000;
          img = "assets/snack_machine_1779011627894.png";
        } else {
          name = "ComboMax Elite";
          id = 3;
          price = 125000;
          img = "assets/combo_machine_1779011666525.png";
        }
      }

      appendMsg(`Based on your size and beverage needs, I highly recommend the <strong>${name}</strong>!<br><br>
        <strong>Price:</strong> ₹${price.toLocaleString()}<br>
        <button class="btn btn-dark" style="margin-top:10px; width:100%; padding:8px 12px; font-size:0.8rem;" onclick="if(window.addToCart){ window.addToCart('${id}', '${name}', ${price}, '${img}'); }">Add to Cart</button>
      `, 'bot');

      loadReplies([
        { text: "💡 Choose Another Setup", action: () => startAdvisor() },
        { text: "💬 Talk to Sales", action: () => talkSupport() },
        { text: "↩️ Back to Main Menu", action: () => mainMenu() }
      ]);
    }, 800);
  };

  const talkSupport = () => {
    appendMsg("I'd love to connect you! You can reach our sales desk directly at:<br>📧 amaan0605ats@gmail.com<br>📞 +91 78897 36790 / +91 60063 27013", 'bot');
    loadReplies([
      { text: "↩️ Back to Main Menu", action: () => mainMenu() }
    ]);
  };

  const mainMenu = () => {
    appendMsg("What else can I help you configure or review today?", 'bot');
    loadReplies([
      { text: "💡 Help Me Choose", action: () => startAdvisor() },
      { text: "🎨 Build Custom Machine", action: () => window.location.href = 'configurator.html' },
      
      { text: "📞 Call Back Support", action: () => talkSupport() }
    ]);
  };

  document.addEventListener('click', (e) => {
    if (e.target && e.target.classList.contains('reply-btn') && e.target.closest('#chatbotReplies')) {
      const action = e.target.dataset.action;
      if (action === 'recommend') startAdvisor();
      if (action === 'customize') window.location.href = 'configurator.html';
      
      if (action === 'support') talkSupport();
    }
  });

  // 5. Catchy Base Page Animations & Scroll Reveal
  // Automatically tag content-blocks to animate on scroll
  const animTargets = [
    '.product-card',
    '.promo-text',
    '.promo-img',
    '.about-text',
    '.about-img',
    '.faq-item',
    '.footer-col',
    '.co-summary',
    '.co-form-wrap'
  ];

  animTargets.forEach(selector => {
    document.querySelectorAll(selector).forEach(el => {
      el.classList.add('reveal');
    });
  });

  // Pulse effect on Smart buttons or call-to-actions
  document.querySelectorAll('.btn-dark').forEach(btn => {
    btn.classList.add('pulse-glow');
  });

  // IntersectionObserver to reveal items as they scroll into view
  const observerOptions = {
    root: null,
    threshold: 0.15,
    rootMargin: '0px 0px -50px 0px'
  };

  const revealObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target); // Trigger only once
      }
    });
  }, observerOptions);

  // Observe all tagged reveal items
  document.querySelectorAll('.reveal').forEach(el => {
    revealObserver.observe(el);
  });
};

// Robust execution wrapper
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initGlobal);
} else {
  initGlobal();
}
