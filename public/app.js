const API = '';

let allProducts = [];
let activeFilter = 'all';

async function loadProducts() {
  const grid = document.getElementById('productsGrid');
  grid.innerHTML = '<p>Loading machines...</p>';
  try {
    const res = await fetch(`${API}/api/products`);
    const data = await res.json();
    allProducts = data.products;
    renderProducts(allProducts);
  } catch (err) {
    grid.innerHTML = '<p>Failed to load products.</p>';
  }
}

let currentSort = 'newest';

function renderProducts(products) {
  const grid = document.getElementById('productsGrid');
  if (!products.length) {
    grid.innerHTML = '<p>No machines found.</p>';
    return;
  }
  
  // Sort products copy in-memory
  const sorted = [...products];
  if (currentSort === 'price-asc') {
    sorted.sort((a, b) => a.price - b.price);
  } else if (currentSort === 'price-desc') {
    sorted.sort((a, b) => b.price - a.price);
  } else {
    // default to newest (higher ID means newer)
    sorted.sort((a, b) => b.id - a.id);
  }

  grid.innerHTML = sorted.map(p => `
    <div class="product-card" onclick="window.location.href='product.html?id=${p.id}'">
      <div class="pc-img-wrap" style="position: relative;">
        <label class="compare-checkbox-wrap" onclick="event.stopPropagation();">
          <input type="checkbox" class="compare-chk" data-id="${p.id}">
          Compare
        </label>
        <img src="${p.image}" alt="${p.name}">
      </div>
      <div class="pc-info">
        <h3>${p.name}</h3>
        <div class="pc-rating">
          ★★★★★ <span>(${p.reviews} Reviews)</span>
        </div>
        <div class="pc-actions">
          <div class="pc-price">₹${p.price.toLocaleString()}</div>
          <button class="btn-cart" onclick="event.stopPropagation(); if(window.addToCart) { window.addToCart('${p.id}', '${p.name.replace(/'/g, "\\'")}', ${p.price}, '${p.image}'); } else { window.location.href='checkout.html?id=${p.id}'; }">Add to Cart</button>
        </div>
      </div>
    </div>
  `).join('');
  
  // Dispatch event to notify carousel to reset its offset
  document.dispatchEvent(new Event('productsRendered'));
}

// Side-by-Side Product Comparison Logic
function initComparisonMatrix() {
  if (!document.getElementById('compareBar')) {
    const html = `
      <div class="compare-bar" id="compareBar">
        <span id="compareCount">0 items selected</span>
        <button class="btn btn-dark" id="compareBtn" style="padding: 10px 20px; font-size: 0.9rem;">Compare Now</button>
      </div>
      <div class="compare-overlay" id="compareOverlay"></div>
      <div class="compare-modal" id="compareModal">
        <div class="compare-header">
          <h2>Compare Machines</h2>
          <button class="compare-close" id="compareCloseBtn">&times;</button>
        </div>
        <div class="compare-body" id="compareBody"></div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', html);
  }

  const compareBar = document.getElementById('compareBar');
  const compareCount = document.getElementById('compareCount');
  const compareBtn = document.getElementById('compareBtn');
  const compareOverlay = document.getElementById('compareOverlay');
  const compareModal = document.getElementById('compareModal');
  const compareCloseBtn = document.getElementById('compareCloseBtn');
  const compareBody = document.getElementById('compareBody');

  let selectedIds = [];

  const handleCheckboxChange = () => {
    selectedIds = [];
    document.querySelectorAll('.compare-chk:checked').forEach(chk => {
      selectedIds.push(String(chk.dataset.id));
    });

    if (selectedIds.length > 0) {
      compareCount.textContent = `${selectedIds.length} model${selectedIds.length > 1 ? 's' : ''} selected`;
      compareBar.classList.add('active');
    } else {
      compareBar.classList.remove('active');
    }
  };

  // Delegate event to checkbox changes
  document.addEventListener('change', (e) => {
    if (e.target && e.target.classList.contains('compare-chk')) {
      handleCheckboxChange();
    }
  });

  const toggleModal = () => {
    const isActive = compareModal.classList.contains('active');
    if (isActive) {
      compareModal.classList.remove('active');
      compareOverlay.classList.remove('active');
      setTimeout(() => {
        compareModal.style.display = 'none';
        compareOverlay.style.display = 'none';
      }, 300);
    } else {
      compareOverlay.style.display = 'block';
      compareModal.style.display = 'flex';
      // Force layout
      compareOverlay.offsetHeight;
      compareOverlay.classList.add('active');
      compareModal.classList.add('active');
    }
  };

  if (compareCloseBtn) compareCloseBtn.onclick = toggleModal;
  if (compareOverlay) compareOverlay.onclick = toggleModal;

  if (compareBtn) {
    compareBtn.onclick = () => {
      if (selectedIds.length === 0) return;
      const items = allProducts.filter(p => selectedIds.includes(p.id));
      
      let tableHTML = `
        <table class="compare-table">
          <thead>
            <tr>
              <th>Specification</th>
              ${items.map(item => `
                <th class="compare-product-col">
                  <img src="${item.image}" alt="${item.name}">
                  <h3>${item.name}</h3>
                </th>
              `).join('')}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>Price</strong></td>
              ${items.map(item => `<td>₹${Number(item.price).toLocaleString()}</td>`).join('')}
            </tr>
            <tr>
              <td><strong>Tagline</strong></td>
              ${items.map(item => `<td><span class="badge" style="background:var(--accent-blue); padding:4px 8px; border-radius:12px; font-size:0.75rem;">${item.tagline || 'Standard'}</span></td>`).join('')}
            </tr>
            <tr>
              <td><strong>Category</strong></td>
              ${items.map(item => `<td style="text-transform:uppercase; font-size:0.85rem;">${item.category}</td>`).join('')}
            </tr>
            <tr>
              <td><strong>Capacity</strong></td>
              ${items.map(item => `<td>${item.capacity || 'N/A'}</td>`).join('')}
            </tr>
            <tr>
              <td><strong>Stock Status</strong></td>
              ${items.map(item => `<td>${item.inStock ? '<span style="color:#10b981;">In Stock</span>' : '<span style="color:#ff4d4d;">Out of Stock</span>'}</td>`).join('')}
            </tr>
            <tr>
              <td><strong>Rating</strong></td>
              ${items.map(item => `<td>⭐ ${item.rating || '4.5'} (${item.reviews || 0} reviews)</td>`).join('')}
            </tr>
            <tr>
              <td><strong>Key Features</strong></td>
              ${items.map(item => `
                <td>
                  <ul style="margin:0; padding-left:16px; font-size:0.85rem; line-height:1.5;">
                    ${(item.features || []).map(f => `<li>${f}</li>`).join('')}
                  </ul>
                </td>
              `).join('')}
            </tr>
            <tr>
              <td><strong>Actions</strong></td>
              ${items.map(item => `
                <td style="text-align:center;">
                  <button class="btn btn-dark" style="padding: 8px 16px; font-size:0.85rem; width:100%; margin-bottom:8px;" onclick="if(window.addToCart){ window.addToCart('${item.id}', '${item.name.replace(/'/g, "\\'")}', ${item.price}, '${item.image}'); }">Add to Cart</button>
                  <a href="product.html?id=${item.id}" class="btn btn-outline" style="padding: 8px 16px; font-size:0.85rem; width:100%; display:block;">View Details</a>
                </td>
              `).join('')}
            </tr>
          </tbody>
        </table>
      `;
      compareBody.innerHTML = tableHTML;
      toggleModal();
    };
  }
}

// Navbar scroll effect
window.addEventListener('scroll', () => {
  const nav = document.getElementById('navbar');
  if (window.scrollY > 50) nav.classList.add('scrolled');
  else nav.classList.remove('scrolled');
});

// Category filtering
document.querySelectorAll('.sf-link').forEach(link => {
  if (link.dataset.cat) {
    link.addEventListener('click', (e) => {
      document.querySelectorAll('.sf-link').forEach(l => l.classList.remove('active'));
      e.target.classList.add('active');
      const cat = e.target.dataset.cat;
      const filtered = cat === 'all' ? allProducts : allProducts.filter(p => p.category === cat);
      renderProducts(filtered);
    });
  }
});

// Sort selection listener
const sortSelect = document.getElementById('sortSelect');
if (sortSelect) {
  sortSelect.addEventListener('change', (e) => {
    currentSort = e.target.value;
    const activeLink = document.querySelector('.sf-link.active');
    const cat = activeLink ? activeLink.dataset.cat : 'all';
    const filtered = cat === 'all' ? allProducts : allProducts.filter(p => p.category === cat);
    renderProducts(filtered);
  });
}

// Initialize
async function initApp() {
  await loadProducts();
  initComparisonMatrix();
  initCarousel();
}

// Carousel scroll logic
function initCarousel() {
  const prevBtn = document.getElementById('carouselPrev');
  const nextBtn = document.getElementById('carouselNext');
  const viewport = document.getElementById('carouselViewport');
  const grid = document.getElementById('productsGrid');
  
  if (!prevBtn || !nextBtn || !viewport || !grid) return;

  let currentOffset = 0;
  const cardWidth = 310 + 28; // card min-width + gap

  function getMaxOffset() {
    const gridScrollWidth = grid.scrollWidth;
    const viewportWidth = viewport.clientWidth;
    return Math.max(0, gridScrollWidth - viewportWidth);
  }

  function scrollTo(offset, smooth = true) {
    const maxOffset = getMaxOffset();
    currentOffset = Math.max(0, Math.min(offset, maxOffset));
    if (smooth) {
      grid.style.transition = 'transform 0.5s cubic-bezier(0.16, 1, 0.3, 1)';
    }
    grid.style.transform = `translateX(-${currentOffset}px)`;
  }

  nextBtn.addEventListener('click', () => {
    const maxOffset = getMaxOffset();
    if (currentOffset >= maxOffset - 5) {
      // At the end — loop back to start
      scrollTo(0);
    } else {
      scrollTo(currentOffset + cardWidth);
    }
  });

  prevBtn.addEventListener('click', () => {
    if (currentOffset <= 5) {
      // At the start — loop to end
      scrollTo(getMaxOffset());
    } else {
      scrollTo(currentOffset - cardWidth);
    }
  });

  // Drag to scroll support
  let isDragging = false;
  let startX = 0;
  let startOffset = 0;

  viewport.addEventListener('mousedown', (e) => {
    isDragging = true;
    startX = e.clientX;
    startOffset = currentOffset;
    grid.style.transition = 'none';
    viewport.style.cursor = 'grabbing';
    e.preventDefault();
  });

  window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const diff = startX - e.clientX;
    const maxOffset = getMaxOffset();
    currentOffset = Math.max(0, Math.min(startOffset + diff, maxOffset));
    grid.style.transform = `translateX(-${currentOffset}px)`;
  });

  window.addEventListener('mouseup', () => {
    if (!isDragging) return;
    isDragging = false;
    grid.style.transition = 'transform 0.5s cubic-bezier(0.16, 1, 0.3, 1)';
    viewport.style.cursor = '';
    // Snap to nearest card
    const snapped = Math.round(currentOffset / cardWidth) * cardWidth;
    scrollTo(snapped);
  });

  // Touch support
  viewport.addEventListener('touchstart', (e) => {
    isDragging = true;
    startX = e.touches[0].clientX;
    startOffset = currentOffset;
    grid.style.transition = 'none';
  }, { passive: true });

  viewport.addEventListener('touchmove', (e) => {
    if (!isDragging) return;
    const diff = startX - e.touches[0].clientX;
    const maxOffset = getMaxOffset();
    currentOffset = Math.max(0, Math.min(startOffset + diff, maxOffset));
    grid.style.transform = `translateX(-${currentOffset}px)`;
  }, { passive: true });

  viewport.addEventListener('touchend', () => {
    if (!isDragging) return;
    isDragging = false;
    grid.style.transition = 'transform 0.5s cubic-bezier(0.16, 1, 0.3, 1)';
    const snapped = Math.round(currentOffset / cardWidth) * cardWidth;
    scrollTo(snapped);
  });

  // Reset offset when products are re-rendered (e.g., filtered/sorted)
  document.addEventListener('productsRendered', () => {
    scrollTo(0, false);
  });

  // Update on resize
  window.addEventListener('resize', () => {
    scrollTo(currentOffset, false);
  });
}

initApp();
