const API = '';

// Check if we are checking out multi-item cart
const getCart = () => JSON.parse(localStorage.getItem('cartItems') || '[]');

let checkoutPrice = 0;

async function initCheckout() {
  const urlParams = new URLSearchParams(window.location.search);
  const isConfig = urlParams.get('config');

  if (isConfig === 'true') {
    const model = urlParams.get('model');
    const skin = urlParams.get('skin');
    const addons = urlParams.get('addons');
    const price = Number(urlParams.get('price'));
    checkoutPrice = price;

    let summaryHTML = `
      <h2>Custom Build Sheet</h2>
      <div style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.06); padding:20px; border-radius:12px; font-family:'Inter',sans-serif;">
        <p style="margin:0 0 10px; color:#fff;"><strong>Base System:</strong> ${model}</p>
        <p style="margin:0 0 10px; color:#fff;"><strong>Exterior Wrap:</strong> ${skin}</p>
        <p style="margin:0 0 15px; color:#fff;"><strong>Add-on Package:</strong> ${addons}</p>
        <div style="border-top:1px solid rgba(255,255,255,0.1); padding-top:15px; display:flex; justify-content:space-between; align-items:center;">
          <span style="font-family:'Outfit',sans-serif; text-transform:uppercase; color:var(--text-light);">Build Cost</span>
          <span style="font-size:1.6rem; color:#fff; font-family:'Outfit',sans-serif; font-weight:bold;">₹${price.toLocaleString()}</span>
        </div>
      </div>
    `;
    document.getElementById('coSummary').innerHTML = summaryHTML;

    document.getElementById('productId').value = "CUSTOM";
    document.getElementById('productName').value = `Custom: ${model} (${skin}, Addons: ${addons})`;
    
    // Hide quantity selector since custom build requests are processed per-unit
    const qtyInput = document.getElementById('quantity');
    if (qtyInput) {
      const qtyGroup = qtyInput.closest('.form-group');
      if (qtyGroup) qtyGroup.style.display = 'none';
      qtyInput.removeAttribute('required');
    }
    return;
  }

  const cart = getCart();
  
  if (cart.length > 0) {
    // Multi-item cart rendering
    let summaryHTML = '<h2>Order Summary</h2>';
    cart.forEach(item => {
      summaryHTML += `
        <div style="display:flex; gap:20px; margin-bottom:25px; align-items:center;">
          <img src="${item.image}" alt="${item.name}" style="width:130px; height:130px; object-fit:contain; border-radius:12px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.06); padding:10px; filter:drop-shadow(0 10px 25px rgba(0,0,0,0.4));">
          <div style="flex:1;">
            <h4 style="margin:0; font-size:1.15rem; font-family:'Outfit',sans-serif; text-transform:uppercase; color:#fff;">${item.name}</h4>
            <p style="margin:5px 0 0; color:var(--text-light); font-size:0.9rem;">₹${Number(item.price).toLocaleString()} x ${item.quantity}</p>
          </div>
        </div>`;
    });
    
    const totalPrice = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    summaryHTML += `
      <div style="border-top:1px solid rgba(255,255,255,0.15); margin-top:20px; padding-top:20px;">
        <h2 style="font-size:1.5rem; margin-bottom:5px; font-weight:300;">Order Total</h2>
        <div class="co-price">₹${totalPrice.toLocaleString()}</div>
      </div>`;
      
    document.getElementById('coSummary').innerHTML = summaryHTML;
    
    // Set hidden properties
    document.getElementById('productId').value = "MULTIPLE";
    document.getElementById('productName').value = "Cart Checkout";
    
    // Hide standard quantity form field group because quantities are parsed from cart items!
    const qtyInput = document.getElementById('quantity');
    if (qtyInput) {
      const qtyGroup = qtyInput.closest('.form-group');
      if (qtyGroup) qtyGroup.style.display = 'none';
      qtyInput.removeAttribute('required');
    }
    return;
  }

  // Fallback single product URL checkout
  const id = urlParams.get('id');
  if (!id) {
    document.getElementById('coSummary').innerHTML = `
      <div style="text-align: center; padding: 40px 20px;">
        <h2 style="font-family:'Outfit',sans-serif; text-transform:uppercase; font-size:1.8rem; margin-bottom:15px; color:#fff;">No Products Selected</h2>
        <p style="color:var(--text-light); font-family:'Inter',sans-serif; margin-bottom:25px;">Please select a vending machine or customize your build sheet before proceeding to checkout.</p>
        <a href="index.html#shop" class="btn btn-outline" style="color:#fff; border-color:#fff;">Browse Vending Machines</a>
      </div>
    `;
    const formBlock = document.getElementById('coFormBlock');
    if (formBlock) formBlock.style.display = 'none';
    return;
  }

  try {
    const res = await fetch(`${API}/api/products/${id}`);
    const data = await res.json();
    if (!data.success) {
      document.getElementById('coSummary').innerHTML = '<p>Product not found.</p>';
      return;
    }
    
    const p = data.product;
    
    document.getElementById('coSummary').innerHTML = `
      <img src="${p.image}" alt="${p.name}">
      <h2>${p.name}</h2>
      <p>${p.tagline}</p>
      <div class="co-price">₹${Number(p.price).toLocaleString()}</div>
    `;

    document.getElementById('productId').value = p.id;
    document.getElementById('productName').value = p.name;
    
  } catch (err) {
    console.error(err);
    document.getElementById('coSummary').innerHTML = '<p>Error loading product details.</p>';
  }
}

document.getElementById('checkoutForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const errorBox = document.getElementById('coErrorBox');
  const errorText = document.getElementById('coErrorText');

  errorBox.style.display = 'none';

  const btn = e.target.querySelector('button[type="submit"]');
  btn.textContent = 'Processing...';
  btn.disabled = true;

  const cart = getCart();
  const payload = {
    name: document.getElementById('name').value,
    email: document.getElementById('email').value,
    phone: document.getElementById('phone').value,
    address: document.getElementById('address').value,
    paymentMethod: 'Quote Request',
    type: 'purchase'
  };

  if (cart.length > 0) {
    // Send full cart items array
    payload.items = cart;
  } else {
    // Send single product details
    payload.productId = document.getElementById('productId').value;
    payload.productName = document.getElementById('productName').value;
    payload.quantity = document.getElementById('quantity').value;
    if (payload.productId === 'CUSTOM') {
      payload.totalAmount = checkoutPrice;
    }
  }

  try {
    const res = await fetch(`${API}/api/order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    const data = await res.json();
    if (data.success) {
      // Clear localStorage cart items on order success!
      localStorage.removeItem('cartItems');
      if (window.updateCartUI) window.updateCartUI();
      
      document.getElementById('coFormBlock').style.display = 'none';
      document.getElementById('coSuccessBlock').style.display = 'block';

      // Always display workspace association details
      document.getElementById('b2bEmail').textContent = payload.email;
      
      // If a temporary password was returned, show it!
      const pwBox = document.getElementById('b2bPasswordBox');
      if (data.tempPassword) {
        document.getElementById('b2bTempPassword').textContent = data.tempPassword;
        if (pwBox) pwBox.style.display = 'block';
      } else {
        if (pwBox) pwBox.style.display = 'none';
      }

      document.getElementById('b2bAccountBox').style.display = 'block';
    } else {
      errorText.textContent = data.message || 'Failed to send request. Please try again.';
      errorBox.style.display = 'block';
      btn.textContent = 'Send Request';
      btn.disabled = false;
    }
  } catch (err) {
    console.error(err);
    errorText.textContent = 'An error occurred. Please check your connection.';
    errorBox.style.display = 'block';
    btn.textContent = 'Send Request';
    btn.disabled = false;
  }
});

// Navbar scroll effect
window.addEventListener('scroll', () => {
  const nav = document.getElementById('navbar');
  if (window.scrollY > 50) nav.classList.add('scrolled');
  else nav.classList.remove('scrolled');
});

initCheckout();
