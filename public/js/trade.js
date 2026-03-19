// ─── SoulTrader — Trade Page Logic ───────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {

  // ── Constants ──────────────────────────────────────────────────────────────
  const gameKey        = document.getElementById('gameKeyInput')?.value || '';
  const SEARCH_URL     = '/trade/search-items';
  const UPGRADEABLE    = ['weapon', 'shield', 'armor'];

  // Max upgrade level per game and item type
  function maxUpgrade(type) {
    if (!UPGRADEABLE.includes(type)) return 0;
    const map = {
      darksouls:   { weapon: 15, shield: 15, armor: 10 },
      darksouls2:  { weapon: 10, shield: 10, armor: 10 },
      darksouls3:  { weapon: 10, shield: 10, armor: 10 },
      bloodborne:  { weapon: 10, shield: 0,  armor: 0  },
      eldenring:   { weapon: 25, shield: 25, armor: 0  },
      demonssouls: { weapon: 10, shield: 10, armor: 10 },
    };
    return (map[gameKey] || {})[type] || 0;
  }

  // ── Trade Creation Modal ───────────────────────────────────────────────────
  const tradeModal = document.getElementById('create-offer-modal');
  const tradeBtn   = document.getElementById('create-offer-btn');

  if (tradeModal && tradeBtn) {
    const closeBtn = tradeModal.querySelector('.close-btn');
    tradeBtn.addEventListener('click', () => { tradeModal.style.display = 'flex'; });
    if (closeBtn) closeBtn.addEventListener('click', () => { tradeModal.style.display = 'none'; });
    window.addEventListener('click', e => { if (e.target === tradeModal) tradeModal.style.display = 'none'; });
  }

  // ── Collect items from a grid as a structured array ────────────────────────
  function collectItems(gridId) {
    const grid = document.getElementById(gridId);
    if (!grid) return [];
    return Array.from(grid.querySelectorAll('.item-box')).map(box => ({
      name:     box.dataset.name,
      type:     box.dataset.type,
      iconPath: box.dataset.iconPath || null,
      qty:      parseInt(box.querySelector('.item-qty-value')?.textContent || '1', 10),
      upgrade:  box.dataset.upgradeable === 'true'
                  ? parseInt(box.querySelector('.item-upgrade-select')?.value || '0', 10)
                  : null,
    }));
  }

  function syncHidden(gridId, hiddenId) {
    const items  = collectItems(gridId);
    const hidden = document.getElementById(hiddenId);
    if (hidden) hidden.value = JSON.stringify(items);
    updatePreview();
  }

  // ── Build an item box element ──────────────────────────────────────────────
  function buildItemBox(item, gridId, hiddenId) {
    const upgradeable = UPGRADEABLE.includes(item.type) && maxUpgrade(item.type) > 0;
    const maxUp       = upgradeable ? maxUpgrade(item.type) : 0;

    const box = document.createElement('div');
    box.className        = 'item-box';
    box.dataset.name     = item.name;
    box.dataset.type     = item.type;
    box.dataset.iconPath = item.iconPath || '';
    box.dataset.upgradeable = String(upgradeable);

    // Icon
    const iconWrap = document.createElement('div');
    iconWrap.className = 'item-box-icon';
    const img = document.createElement('img');
    img.src   = item.iconPath || `/images/items/${gameKey}/${slugify(item.name)}.png`;
    img.alt   = item.name;
    img.title = item.name;
    img.onerror = function () {
      this.style.display = 'none';
      const fallback = document.createElement('span');
      fallback.className   = 'item-icon-fallback';
      fallback.textContent = item.name.charAt(0).toUpperCase();
      iconWrap.appendChild(fallback);
    };
    iconWrap.appendChild(img);
    box.appendChild(iconWrap);

    // Name
    const nameEl = document.createElement('div');
    nameEl.className   = 'item-box-name';
    nameEl.textContent = item.name;
    box.appendChild(nameEl);

    // Quantity controls
    const qtyWrap = document.createElement('div');
    qtyWrap.className = 'item-box-qty';
    const qtyMinus = document.createElement('button');
    qtyMinus.type      = 'button';
    qtyMinus.className = 'qty-btn';
    qtyMinus.textContent = '−';
    const qtyVal = document.createElement('span');
    qtyVal.className   = 'item-qty-value';
    qtyVal.textContent = '1';
    const qtyPlus = document.createElement('button');
    qtyPlus.type      = 'button';
    qtyPlus.className = 'qty-btn';
    qtyPlus.textContent = '+';

    qtyMinus.addEventListener('click', () => {
      const cur = parseInt(qtyVal.textContent, 10);
      if (cur > 1) { qtyVal.textContent = cur - 1; syncHidden(gridId, hiddenId); }
    });
    qtyPlus.addEventListener('click', () => {
      const cur = parseInt(qtyVal.textContent, 10);
      if (cur < 99) { qtyVal.textContent = cur + 1; syncHidden(gridId, hiddenId); }
    });

    qtyWrap.appendChild(qtyMinus);
    qtyWrap.appendChild(qtyVal);
    qtyWrap.appendChild(qtyPlus);
    box.appendChild(qtyWrap);

    // Upgrade level (only for upgradeable items)
    if (upgradeable) {
      const upgradeWrap = document.createElement('div');
      upgradeWrap.className = 'item-box-upgrade';
      const sel = document.createElement('select');
      sel.className = 'item-upgrade-select';
      for (let i = 0; i <= maxUp; i++) {
        const opt = document.createElement('option');
        opt.value       = i;
        opt.textContent = `+${i}`;
        sel.appendChild(opt);
      }
      sel.addEventListener('change', () => syncHidden(gridId, hiddenId));
      upgradeWrap.appendChild(sel);
      box.appendChild(upgradeWrap);
    }

    // Remove button
    const removeBtn = document.createElement('button');
    removeBtn.type      = 'button';
    removeBtn.className = 'item-box-remove';
    removeBtn.innerHTML = '&times;';
    removeBtn.title     = 'Remove';
    removeBtn.addEventListener('click', () => {
      box.remove();
      syncHidden(gridId, hiddenId);
    });
    box.appendChild(removeBtn);

    return box;
  }

  function addItemToGrid(item, gridId, hiddenId) {
    const grid = document.getElementById(gridId);
    if (!grid) return;
    // Prevent duplicates
    if (Array.from(grid.querySelectorAll('.item-box')).some(b => b.dataset.name === item.name)) return;
    grid.appendChild(buildItemBox(item, gridId, hiddenId));
    syncHidden(gridId, hiddenId);
  }

  // ── Item search autocomplete ───────────────────────────────────────────────
  function setupSearch(inputId, dropdownId, gridId, hiddenId) {
    const input    = document.getElementById(inputId);
    const dropdown = document.getElementById(dropdownId);
    if (!input || !dropdown) return;

    let timer;
    input.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(async () => {
        const q = input.value.trim();
        if (!q) { dropdown.style.display = 'none'; return; }
        try {
          const resp  = await fetch(`${SEARCH_URL}?game=${encodeURIComponent(gameKey)}&query=${encodeURIComponent(q)}`);
          const items = await resp.json();
          dropdown.innerHTML = '';
          if (!Array.isArray(items) || items.length === 0) { dropdown.style.display = 'none'; return; }
          items.forEach(item => {
            const li = document.createElement('li');
            li.className = 'dropdown-item';
            // Small icon in dropdown
            if (item.iconPath) {
              const dImg = document.createElement('img');
              dImg.src    = item.iconPath;
              dImg.alt    = '';
              dImg.className = 'dropdown-item-icon';
              dImg.onerror = () => { dImg.style.display = 'none'; };
              li.appendChild(dImg);
            }
            const dName = document.createElement('span');
            dName.textContent = item.name;
            const dType = document.createElement('span');
            dType.className   = 'dropdown-item-type';
            dType.textContent = item.type;
            li.appendChild(dName);
            li.appendChild(dType);
            li.addEventListener('click', () => {
              addItemToGrid(item, gridId, hiddenId);
              input.value        = '';
              dropdown.style.display = 'none';
            });
            dropdown.appendChild(li);
          });
          dropdown.style.display = 'block';
        } catch (err) {
          console.error('Search error:', err);
          dropdown.style.display = 'none';
        }
      }, 200);
    });

    document.addEventListener('click', e => {
      if (e.target !== input && !dropdown.contains(e.target)) dropdown.style.display = 'none';
    });
  }

  setupSearch('offeredItemInput',   'offeredItemDropdown',   'offeredItemsGrid',   'hiddenOfferedItems');
  setupSearch('requestedItemInput', 'requestedItemDropdown', 'requestedItemsGrid', 'hiddenRequestedItems');

  // ── Live preview ───────────────────────────────────────────────────────────
  function renderPreviewSide(items, containerId) {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = '';
    if (!items || items.length === 0) {
      el.innerHTML = '<span class="preview-empty">None yet</span>';
      return;
    }
    items.forEach(item => {
      const row = document.createElement('div');
      row.className = 'preview-item-row';

      const icon = document.createElement('img');
      icon.src   = item.iconPath || `/images/items/${gameKey}/${slugify(item.name)}.png`;
      icon.alt   = '';
      icon.className = 'preview-item-icon';
      icon.onerror = () => { icon.style.display = 'none'; };

      const label = document.createElement('span');
      label.className   = 'preview-item-label';
      let text = item.name;
      if (item.qty > 1) text += ` ×${item.qty}`;
      if (item.upgrade !== null && item.upgrade !== undefined) text += ` [+${item.upgrade}]`;
      label.textContent = text;

      row.appendChild(icon);
      row.appendChild(label);
      el.appendChild(row);
    });
  }

  function updatePreview() {
    renderPreviewSide(collectItems('offeredItemsGrid'),   'preview-offered');
    renderPreviewSide(collectItems('requestedItemsGrid'), 'preview-requested');
  }

  // ── Form validation ────────────────────────────────────────────────────────
  const createForm = document.getElementById('create-offer-form');
  if (createForm) {
    createForm.addEventListener('submit', e => {
      const offered   = collectItems('offeredItemsGrid');
      const requested = collectItems('requestedItemsGrid');
      const platform  = document.getElementById('platform')?.value;
      if (!offered.length)   { alert('Please add at least one item you are offering.'); e.preventDefault(); return; }
      if (!requested.length) { alert('Please add at least one item you are requesting.'); e.preventDefault(); return; }
      if (!platform)         { alert('Please select a platform.'); e.preventDefault(); return; }
      // Final sync before submit
      document.getElementById('hiddenOfferedItems').value   = JSON.stringify(offered);
      document.getElementById('hiddenRequestedItems').value = JSON.stringify(requested);
    });
  }

  // ── Filter / sort ──────────────────────────────────────────────────────────
  const tradeCards     = Array.from(document.querySelectorAll('.trade-card'));
  const offersGrid     = document.querySelector('.offers-grid');
  const platformSelect = document.getElementById('platformSelect');
  const sortSelect     = document.getElementById('sortSelect');
  const searchInput    = document.getElementById('searchInput');

  function applyFilters() {
    if (!offersGrid) return;
    const platform = (platformSelect?.value || 'all').toLowerCase();
    const sort     = sortSelect?.value || 'desc';
    const query    = (searchInput?.value || '').toLowerCase().trim();

    let visible = tradeCards.filter(card => {
      if (platform !== 'all' && (card.dataset.platform || '').toLowerCase() !== platform) return false;
      if (query && !card.innerText.toLowerCase().includes(query)) return false;
      return true;
    });

    visible.sort((a, b) => {
      const ta = Number(a.dataset.createdAt) || 0;
      const tb = Number(b.dataset.createdAt) || 0;
      return sort === 'asc' ? ta - tb : tb - ta;
    });

    tradeCards.forEach(c => (c.style.display = 'none'));
    visible.forEach(c => { c.style.display = 'flex'; offersGrid.appendChild(c); });
  }

  platformSelect?.addEventListener('change', applyFilters);
  sortSelect?.addEventListener('change', applyFilters);
  searchInput?.addEventListener('input', applyFilters);
  applyFilters();

  // ── Accept Trade Modal ─────────────────────────────────────────────────────
  const acceptModal      = document.getElementById('acceptTradeModal');
  const confirmModal     = document.getElementById('confirmationModal');
  const tradeIdInput     = document.getElementById('tradeId');
  const acceptForm       = document.getElementById('acceptTradeForm');

  document.querySelectorAll('.btn-accept').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!acceptModal || !tradeIdInput) return;
      tradeIdInput.value     = btn.dataset.tradeId;
      acceptModal.style.display = 'flex';
    });
  });

  window.closeAcceptModal      = () => { if (acceptModal)  acceptModal.style.display  = 'none'; };
  window.closeConfirmationModal = () => { if (confirmModal) confirmModal.style.display = 'none'; };

  if (acceptForm) {
    acceptForm.addEventListener('submit', async e => {
      e.preventDefault();
      const tradeId       = tradeIdInput.value;
      const meetingPoint  = document.getElementById('meetingPoint')?.value  || '';
      const discordName   = document.getElementById('discordName')?.value   || '';
      const additionalInfo = document.getElementById('additionalInfo')?.value || '';
      const inGameName    = document.getElementById('inGameName')?.value    || '';

      try {
        const resp  = await fetch(`/trade/details/${tradeId}`);
        const trade = await resp.json();

        // Render confirmation details
        const detailsEl = document.getElementById('tradeDetails');
        if (detailsEl) {
          const fmt = items => (items || []).map(i => {
            let s = i.name + (i.qty > 1 ? ` ×${i.qty}` : '');
            if (i.upgrade !== null && i.upgrade !== undefined) s += ` [+${i.upgrade}]`;
            return s;
          }).join(', ');
          detailsEl.innerHTML = `
            <strong>${trade.offerCreator?.username}</strong> offers: ${fmt(trade.offeredItems)}<br>
            In return for: ${fmt(trade.requestedItems)}
          `;
        }

        acceptModal.style.display  = 'none';
        confirmModal.style.display = 'flex';

        const checkbox  = document.getElementById('confirmationCheckbox');
        const submitBtn = document.getElementById('finalSubmitButton');
        if (checkbox)  checkbox.checked  = false;
        if (submitBtn) submitBtn.disabled = true;

        if (checkbox && submitBtn) {
          const onCheck = () => { submitBtn.disabled = !checkbox.checked; };
          checkbox.removeEventListener('change', onCheck);
          checkbox.addEventListener('change', onCheck);
        }

        if (submitBtn) {
          const onSubmit = async () => {
            submitBtn.removeEventListener('click', onSubmit);
            submitBtn.disabled   = true;
            submitBtn.textContent = 'Accepting…';
            try {
              const finalResp = await fetch(`/trade/accept/${tradeId}`, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ meetingPoint, discordName, additionalInfo, inGameName }),
              });
              if (finalResp.ok) {
                window.closeConfirmationModal();
                window.location.reload();
              } else {
                const err = await finalResp.json().catch(() => ({}));
                alert(err.error || 'Failed to accept trade.');
                submitBtn.disabled   = false;
                submitBtn.textContent = 'Accept Trade';
              }
            } catch (err) {
              console.error('Accept error:', err);
              submitBtn.disabled   = false;
              submitBtn.textContent = 'Accept Trade';
            }
          };
          submitBtn.addEventListener('click', onSubmit);
        }
      } catch (err) {
        console.error('Trade details fetch error:', err);
      }
    });
  }
});

// ── Utility ──────────────────────────────────────────────────────────────────
function slugify(str) {
  return str.toLowerCase().replace(/['']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
