const API = '';

document.getElementById('contactForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const btn = e.target.querySelector('button[type="submit"]');
  btn.textContent = 'Sending...';
  btn.disabled = true;

  const payload = {
    name: document.getElementById('contactName').value,
    email: document.getElementById('contactEmail').value,
    phone: document.getElementById('contactPhone').value,
    message: document.getElementById('contactMessage').value,
    type: 'inquiry'
  };

  try {
    const res = await fetch(`${API}/api/inquiry`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    const data = await res.json();
    if (data.success) {
      document.getElementById('contactFormBlock').style.display = 'none';
      document.getElementById('contactSuccessBlock').style.display = 'block';
    } else {
      alert('Failed to send message. Please try again.');
      btn.textContent = 'Send Message';
      btn.disabled = false;
    }
  } catch (err) {
    console.error(err);
    alert('An error occurred. Please check your connection.');
    btn.textContent = 'Send Message';
    btn.disabled = false;
  }
});

// Navbar scroll effect
window.addEventListener('scroll', () => {
  const nav = document.getElementById('navbar');
  if (window.scrollY > 50) nav.classList.add('scrolled');
  else nav.classList.remove('scrolled');
});
