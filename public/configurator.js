document.addEventListener('DOMContentLoaded', () => {
  const machinePreview = document.getElementById('machinePreview');
  const neonStrip = document.getElementById('neonStrip');
  const machineSign = document.getElementById('machineSign');
  const machineGlass = document.getElementById('machineGlass');
  const configCost = document.getElementById('configCost');
  const configQuoteBtn = document.getElementById('configQuoteBtn');

  let selections = {
    model: { val: 'snacks', price: 97000, label: 'Pro Snacks Shell' },
    skin: { val: 'default', price: 0, label: 'Matte Black' },
    addons: []
  };

  const updatePreview = () => {
    // 1. Update Sign Board
    if (selections.model.val === 'snacks') {
      machineSign.textContent = "VENDX SNACKS";
      renderShelves('snacks');
    } else if (selections.model.val === 'beverages') {
      machineSign.textContent = "VENDX BEVERAGES";
      renderShelves('beverages');
    } else {
      machineSign.textContent = "VENDX COMBOMAX";
      renderShelves('combo');
    }

    // 2. Update Skin class
    machinePreview.className = "machine-canvas";
    if (selections.skin.val === 'carbon') {
      machinePreview.classList.add('carbon-skin');
    } else if (selections.skin.val === 'neon') {
      machinePreview.classList.add('neon-skin');
    } else if (selections.skin.val === 'wood') {
      machinePreview.classList.add('wood-skin');
    } else {
      machinePreview.classList.add('default-skin');
    }

    // 3. Update Neon border glow
    if (selections.skin.val === 'neon') {
      neonStrip.style.borderColor = 'var(--accent-blue)';
      neonStrip.style.boxShadow = '0 0 15px var(--accent-blue), inset 0 0 15px var(--accent-blue)';
    } else if (selections.skin.val === 'carbon') {
      neonStrip.style.borderColor = '#ff4d4d';
      neonStrip.style.boxShadow = '0 0 10px rgba(255, 77, 77, 0.4)';
    } else {
      neonStrip.style.borderColor = 'transparent';
      neonStrip.style.boxShadow = 'none';
    }

    // 4. Branding sticker decal
    const brandAddon = selections.addons.find(a => a.val === 'decal');
    if (brandAddon) {
      machineSign.style.background = 'linear-gradient(90deg, #1e3a8a, #3b82f6)';
      machineSign.style.color = '#fff';
    } else {
      machineSign.style.background = '#151515';
      machineSign.style.color = '#fff';
    }

    // 5. Total Cost Computation
    const totalAddonsPrice = selections.addons.reduce((sum, a) => sum + a.price, 0);
    const totalPrice = selections.model.price + selections.skin.price + totalAddonsPrice;
    configCost.textContent = `₹${totalPrice.toLocaleString()}`;
  };

  const renderShelves = (type) => {
    let shelfHTML = '';
    const shelfCount = 4;
    
    for (let i = 0; i < shelfCount; i++) {
      let itemsHTML = '';
      const itemCount = 5;
      
      for (let j = 0; j < itemCount; j++) {
        let color = '#d1d5db'; // default steel
        let radius = '3px';
        let height = '36px';
        let width = '16px';
        
        if (type === 'snacks') {
          color = j % 2 === 0 ? '#ef4444' : '#f59e0b'; // red/orange snacks bags
          radius = '2px';
        } else if (type === 'beverages') {
          color = j % 2 === 0 ? '#3b82f6' : '#10b981'; // soda cans/bottles
          radius = '8px 8px 2px 2px';
          height = '40px';
          width = '14px';
        } else {
          // combo shelves mix
          if (i % 2 === 0) {
            color = '#f43f5e';
            radius = '2px';
          } else {
            color = '#06b6d4';
            radius = '8px 8px 2px 2px';
            height = '38px';
            width = '14px';
          }
        }
        itemsHTML += `<div class="shelf-item-mock" style="background:${color}; border-radius:${radius}; height:${height}; width:${width};"></div>`;
      }

      shelfHTML += `
        <div style="flex:1; display:flex; flex-direction:column; justify-content:flex-end;">
          <div class="shelf-row">
            <div class="shelf-items-wrap">${itemsHTML}</div>
          </div>
        </div>
      `;
    }
    machineGlass.innerHTML = shelfHTML;
  };

  // Option select card event delegation
  document.querySelectorAll('.option-card').forEach(card => {
    card.addEventListener('click', (e) => {
      const current = e.currentTarget;
      const step = current.dataset.step;
      const val = current.dataset.val;
      const price = Number(current.dataset.price);
      const label = current.dataset.label;

      if (step === 'model') {
        document.querySelectorAll('.option-card[data-step="model"]').forEach(c => c.classList.remove('active'));
        current.classList.add('active');
        selections.model = { val, price, label };
      } else if (step === 'skin') {
        document.querySelectorAll('.option-card[data-step="skin"]').forEach(c => c.classList.remove('active'));
        current.classList.add('active');
        selections.skin = { val, price, label };
      } else if (step === 'addon') {
        current.classList.toggle('active');
        const idx = selections.addons.findIndex(a => a.val === val);
        if (idx !== -1) {
          selections.addons.splice(idx, 1);
        } else {
          selections.addons.push({ val, price, label });
        }
      }
      updatePreview();
    });
  });

  // Redirect to checkout with structured URL parameters
  configQuoteBtn.onclick = () => {
    const addonsLabels = selections.addons.map(a => a.label).join(', ');
    const totalAddonsPrice = selections.addons.reduce((sum, a) => sum + a.price, 0);
    const totalPrice = selections.model.price + selections.skin.price + totalAddonsPrice;
    
    const params = new URLSearchParams({
      config: 'true',
      model: selections.model.label,
      skin: selections.skin.label,
      addons: addonsLabels || 'None',
      price: totalPrice.toString()
    });

    window.location.href = `checkout.html?${params.toString()}`;
  };

  // Initial draw
  updatePreview();
});
