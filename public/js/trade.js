// ─── Trade Page Logic ────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  // ── Trade Offer Modal ────────────────────────────────────────────────────
  const tradeModal = document.getElementById('create-offer-modal');
  const tradeBtn = document.getElementById('create-offer-btn');

  if (tradeModal && tradeBtn) {
    const closeBtn = tradeModal.querySelector('.close-btn');
    tradeBtn.addEventListener('click', () => (tradeModal.style.display = 'flex'));
    if (closeBtn) closeBtn.addEventListener('click', () => (tradeModal.style.display = 'none'));
    window.addEventListener('click', (e) => {
      if (e.target === tradeModal) tradeModal.style.display = 'none';
    });
  }

  // ── Item Search & Grid ───────────────────────────────────────────────────
  const gameKey = document.getElementById('gameKeyInput')?.value || '';
  const searchEndpoint = '/trade/search-items';

  function updateHiddenInput(hiddenInputId) {
    const gridId = hiddenInputId === 'hiddenOfferedItems' ? 'offeredItemsGrid' : 'requestedItemsGrid';
    const grid = document.getElementById(gridId);
    if (!grid) return;
    const items = Array.from(grid.children).map(box => {
      const img = box.querySelector('img');
      return img ? img.alt : '';
    }).filter(Boolean);
    const hidden = document.getElementById(hiddenInputId);
    if (hidden) hidden.value = items.join(',');
  }

  function addItemToGrid(itemName, grid, hiddenInputId) {
    const existing = Array.from(grid.children).map(box => {
      const img = box.querySelector('img');
      return img ? img.alt : '';
    });
    if (existing.includes(itemName)) return;

    const itemBox = document.createElement('div');
    itemBox.className = 'item-box';

    const img = document.createElement('img');
    img.src = `/icons/${gameKey.toLowerCase()}/${itemName}.webp`;
    img.alt = itemName;
    img.title = itemName;
    img.onerror = function() {
      this.style.display = 'none';
      const text = document.createElement('span');
      text.textContent = itemName;
      text.style.cssText = 'font-size:0.7rem;background:var(--bg-tertiary);padding:4px 8px;border-radius:4px;display:inline-block;max-width:80px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
      itemBox.insertBefore(text, itemBox.firstChild);
    };

    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-item';
    removeBtn.textContent = '\u00d7';
    removeBtn.addEventListener('click', () => {
      grid.removeChild(itemBox);
      updateHiddenInput(hiddenInputId);
    });

    itemBox.appendChild(img);
    itemBox.appendChild(removeBtn);
    grid.appendChild(itemBox);
    updateHiddenInput(hiddenInputId);
  }

  function createSearchHandler(inputId, dropdownId, gridId, hiddenInputId) {
    const input = document.getElementById(inputId);
    const dropdown = document.getElementById(dropdownId);
    const grid = document.getElementById(gridId);
    if (!input || !dropdown || !grid) return;

    let debounceTimer;
    input.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(async () => {
        const query = input.value.trim();
        if (!query) { dropdown.style.display = 'none'; return; }

        try {
          const resp = await fetch(`${searchEndpoint}?game=${encodeURIComponent(gameKey)}&query=${encodeURIComponent(query)}`);
          if (!resp.ok) throw new Error('Network error');
          const items = await resp.json();

          dropdown.innerHTML = '';
          if (items.length) {
            items.forEach(item => {
              const li = document.createElement('li');
              li.textContent = item.name;
              li.addEventListener('click', () => {
                addItemToGrid(item.name, grid, hiddenInputId);
                input.value = '';
                dropdown.style.display = 'none';
              });
              dropdown.appendChild(li);
            });
            dropdown.style.display = 'block';
          } else {
            dropdown.style.display = 'none';
          }
        } catch (err) {
          console.error('Item search error:', err);
          dropdown.style.display = 'none';
        }
      }, 200);
    });

    window.addEventListener('click', (e) => {
      if (e.target !== input) dropdown.style.display = 'none';
    });
  }

  createSearchHandler('offeredItemInput', 'offeredItemDropdown', 'offeredItemsGrid', 'hiddenOfferedItems');
  createSearchHandler('requestedItemInput', 'requestedItemDropdown', 'requestedItemsGrid', 'hiddenRequestedItems');

  // ── Form Validation ──────────────────────────────────────────────────────
  const createForm = document.getElementById('create-offer-form');
  if (createForm) {
    createForm.addEventListener('submit', (e) => {
      const offered = document.getElementById('hiddenOfferedItems')?.value.trim();
      const requested = document.getElementById('hiddenRequestedItems')?.value.trim();
      const platform = document.getElementById('platform')?.value;

      if (!offered) { alert('Please add at least one offered item.'); e.preventDefault(); return; }
      if (!requested) { alert('Please add at least one requested item.'); e.preventDefault(); return; }
      if (!platform) { alert('Please select a platform.'); e.preventDefault(); return; }
    });
  }

  // ── Filtering & Sorting ──────────────────────────────────────────────────
  const tradeCards = Array.from(document.querySelectorAll('.trade-card'));
  const offersGrid = document.querySelector('.offers-grid');
  const platformSelect = document.getElementById('platformSelect');
  const sortSelect = document.getElementById('sortSelect');
  const searchInput = document.getElementById('searchInput');

  function applyFilters() {
    if (!offersGrid || !platformSelect || !sortSelect) return;

    const selectedPlatform = platformSelect.value;
    const sortOrder = sortSelect.value;
    const searchQuery = (searchInput?.value || '').trim().toLowerCase();

    let filtered = tradeCards.filter(card => {
      const cardPlatform = (card.dataset.platform || '').toLowerCase();
      const cardText = card.innerText.toLowerCase();

      if (selectedPlatform !== 'all' && cardPlatform !== selectedPlatform.toLowerCase()) return false;
      if (searchQuery && !cardText.includes(searchQuery)) return false;
      return true;
    });

    filtered.sort((a, b) => {
      const aTime = Number(a.dataset.createdAt) || 0;
      const bTime = Number(b.dataset.createdAt) || 0;
      return sortOrder === 'asc' ? aTime - bTime : bTime - aTime;
    });

    tradeCards.forEach(card => (card.style.display = 'none'));
    filtered.forEach(card => {
      card.style.display = 'flex';
      offersGrid.appendChild(card);
    });
  }

  if (platformSelect) platformSelect.addEventListener('change', applyFilters);
  if (sortSelect) sortSelect.addEventListener('change', applyFilters);
  if (searchInput) searchInput.addEventListener('input', applyFilters);
  applyFilters();

  // ── Accept Trade Modal ───────────────────────────────────────────────────
  const acceptModal = document.getElementById('acceptTradeModal');
  const confirmationModal = document.getElementById('confirmationModal');
  const tradeIdInput = document.getElementById('tradeId');
  const acceptForm = document.getElementById('acceptTradeForm');

  document.querySelectorAll('.btn-accept').forEach(button => {
    button.addEventListener('click', () => {
      if (!acceptModal || !tradeIdInput) return;
      tradeIdInput.value = button.getAttribute('data-trade-id');
      acceptModal.style.display = 'flex';
    });
  });

  window.closeAcceptModal = () => { if (acceptModal) acceptModal.style.display = 'none'; };
  window.closeConfirmationModal = () => { if (confirmationModal) confirmationModal.style.display = 'none'; };

  if (acceptForm) {
    acceptForm.addEventListener('submit', async (event) => {
      event.preventDefault();

      const tradeId = tradeIdInput.value;
      const meetingPoint = document.getElementById('meetingPoint')?.value || '';
      const discordName = document.getElementById('discordName')?.value || '';
      const additionalInfo = document.getElementById('additionalInfo')?.value || '';
      const inGameName = document.getElementById('inGameName')?.value || '';

      // Fetch trade details for confirmation
      const response = await fetch(`/trade/details/${tradeId}`);
      const trade = await response.json();

      const tradeDetails = document.getElementById('tradeDetails');
      if (tradeDetails) {
        tradeDetails.textContent = `${trade.offerCreator.username} will exchange ${trade.offeredItems} for your ${trade.requestedItems}.`;
      }

      if (acceptModal) acceptModal.style.display = 'none';
      if (confirmationModal) confirmationModal.style.display = 'flex';

      const checkbox = document.getElementById('confirmationCheckbox');
      const submitBtn = document.getElementById('finalSubmitButton');
      if (checkbox) checkbox.checked = false;
      if (submitBtn) submitBtn.disabled = true;

      if (checkbox && submitBtn) {
        const handler = () => { submitBtn.disabled = !checkbox.checked; };
        checkbox.removeEventListener('change', handler);
        checkbox.addEventListener('change', handler);
      }

      if (submitBtn) {
        const clickHandler = async () => {
          submitBtn.removeEventListener('click', clickHandler);
          try {
            const finalResponse = await fetch(`/trade/accept/${tradeId}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ meetingPoint, discordName, additionalInfo, inGameName }),
            });

            if (finalResponse.ok) {
              alert('Trade offer accepted successfully!');
              window.closeConfirmationModal();
              window.location.reload();
            } else {
              const err = await finalResponse.json().catch(() => ({}));
              alert(err.error || 'Failed to accept trade offer.');
            }
          } catch (error) {
            console.error('Error accepting trade:', error);
          }
        };
        submitBtn.addEventListener('click', clickHandler);
      }
    });
  }
});

// ─── Time Ago Helper (used by EJS via inline call) ───────────────────────────
function timeAgo(dateStr) {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}
