// ─── Auth Modal Handling ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const signupModal = document.getElementById('signupModal');
  const loginModal = document.getElementById('loginModal');
  const openSignupLink = document.getElementById('openSignupLink');
  const openLoginLink = document.getElementById('openLoginLink');

  function showModal(modal) {
    if (modal) modal.style.display = 'flex';
  }

  function hideModal(modal) {
    if (modal) modal.style.display = 'none';
  }

  if (openSignupLink) {
    openSignupLink.addEventListener('click', (e) => {
      e.preventDefault();
      showModal(signupModal);
    });
  }

  if (openLoginLink) {
    openLoginLink.addEventListener('click', (e) => {
      e.preventDefault();
      showModal(loginModal);
    });
  }

  // Close buttons
  document.querySelectorAll('[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', () => {
      const modalId = btn.getAttribute('data-close-modal');
      hideModal(document.getElementById(modalId));
    });
  });

  // Click outside to close
  [signupModal, loginModal].forEach(modal => {
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) hideModal(modal);
      });
    }
  });
});

// ─── Hamburger Menu ──────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const hamburger = document.getElementById('hamburgerBtn');
  const navLinks = document.getElementById('navLinks');

  if (hamburger && navLinks) {
    hamburger.addEventListener('click', () => {
      navLinks.classList.toggle('open');
    });

    // Close when clicking a link on mobile
    navLinks.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        navLinks.classList.remove('open');
      });
    });
  }
});
