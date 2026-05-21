const API = '';

async function initProduct() {
  const urlParams = new URLSearchParams(window.location.search);
  const id = urlParams.get('id');
  if (!id) {
    document.getElementById('productContainer').innerHTML = `
      <div style="text-align: center; grid-column: 1 / -1; padding: 100px 20px;">
        <h2 style="font-family:'Outfit',sans-serif; text-transform:uppercase; font-size:2.5rem; margin-bottom:20px; color:var(--text-dark);">No Product Selected</h2>
        <p style="color:var(--text-light); font-family:'Inter',sans-serif; margin-bottom:30px; max-width:500px; margin-left:auto; margin-right:auto; line-height:1.6;">
          Please select a premium vending machine from our digital catalog to view full hardware specs, Smart IoT edge configurations, and pricing options.
        </p>
        <a href="index.html#shop" class="btn btn-dark" style="padding:12px 30px;">Browse Smart Vending Systems</a>
      </div>
    `;
    return;
  }

  try {
    const res = await fetch(`${API}/api/products/${id}`);
    const data = await res.json();
    if (!data.success) {
      document.getElementById('productContainer').innerHTML = `
        <div style="text-align: center; grid-column: 1 / -1; padding: 100px 20px;">
          <h2 style="font-family:'Outfit',sans-serif; text-transform:uppercase; font-size:2.5rem; margin-bottom:20px; color:var(--text-dark);">Product Not Found</h2>
          <p style="color:var(--text-light); font-family:'Inter',sans-serif; margin-bottom:30px; max-width:500px; margin-left:auto; margin-right:auto; line-height:1.6;">
            The vending machine system with ID "${id}" could not be found. It may have been retired or replaced by a newer model.
          </p>
          <a href="index.html#shop" class="btn btn-dark" style="padding:12px 30px;">Browse Smart Vending Systems</a>
        </div>
      `;
      return;
    }
    
    const p = data.product;
    
    document.title = `${p.name} | VendX`;

    document.getElementById('productContainer').innerHTML = `
      <div class="pd-image fade-in">
        <img src="${p.image}" alt="${p.name}">
      </div>
      <div class="pd-info fade-in" style="animation-delay: 0.2s">
        <h1>${p.name}</h1>
        <div class="pd-price">₹${p.price.toLocaleString()}</div>
        <p class="pd-desc">${p.description}</p>
        
        <div class="pd-actions">
          <button class="btn btn-dark" style="padding: 16px 40px; font-size: 1rem;" onclick="if(window.addToCart) { window.addToCart('${p.id}', '${p.name.replace(/'/g, "\\'")}', ${p.price}, '${p.image}'); } else { window.location.href='checkout.html?id=${p.id}'; }">Add to Cart</button>
          <button class="btn btn-outline" style="padding: 16px 40px; font-size: 1rem;" onclick="window.location.href='contact.html'">Contact Sales</button>
        </div>

        <div class="pd-features">
          <h3>Specifications</h3>
          <div class="pd-features-list">
            ${p.features.map(f => `<div class="pd-feature-item">${f}</div>`).join('')}
            <div class="pd-feature-item">Capacity: ${p.capacity}</div>
          </div>
        </div>
      </div>
    `;
  } catch (err) {
    console.error(err);
  }
}

window.addEventListener('scroll', () => {
  const nav = document.getElementById('navbar');
  if (window.scrollY > 50) nav.classList.add('scrolled');
  else nav.classList.remove('scrolled');
});

initProduct();
