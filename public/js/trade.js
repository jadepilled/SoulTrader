// ─── SoulTrader — Trade Page Logic ───────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {

  // ── Constants ──────────────────────────────────────────────────────────────
  const gameKey        = document.getElementById('gameKeyInput')?.value || '';
  const SEARCH_URL     = '/trade/search-items';
  const UPGRADEABLE    = ['weapon', 'shield', 'armor', 'head', 'chest', 'hands', 'legs'];

  // Max upgrade level per game and item type
  // DS1: Standard weapons/shields +15, unique +5, armor +10
  // DS2: All weapons/shields/armor +10, unique +5
  // DS3: Weapons/shields +10, armor NOT upgradeable
  // BB:  Weapons +10, no shields/armor upgrades
  // ER:  Regular weapons/shields +25, somber +10, armor NOT upgradeable
  // DeS: Weapons/shields +10, armor +10
  function maxUpgrade(type) {
    if (!UPGRADEABLE.includes(type)) return 0;
    const normalizedType = ['head', 'chest', 'hands', 'legs'].includes(type) ? 'armor' : type;
    const map = {
      darksouls:   { weapon: 15, shield: 15, armor: 10 },
      darksouls2:  { weapon: 10, shield: 10, armor: 10 },
      darksouls3:  { weapon: 10, shield: 10, armor: 0  },
      eldenring:   { weapon: 25, shield: 25, armor: 0  },
      demonssouls: { weapon: 10, shield: 10, armor: 10 },
    };
    return (map[gameKey] || {})[normalizedType] || 0;
  }

  // Level caps per game
  const LEVEL_CAPS = {
    darksouls: 713,
    darksouls2: 838,
    darksouls3: 802,
    eldenring: 713,
    demonssouls: 712,
  };

  // Apply level cap to character level input
  const charLevelInput = document.getElementById('characterLevel');
  if (charLevelInput && LEVEL_CAPS[gameKey]) {
    charLevelInput.max = LEVEL_CAPS[gameKey];
    charLevelInput.placeholder = `1–${LEVEL_CAPS[gameKey]}`;
  }

  // ── Trade Creation Modal ───────────────────────────────────────────────────
  const tradeModal = document.getElementById('create-offer-modal');
  const tradeBtn   = document.getElementById('create-offer-btn');

  if (tradeModal && tradeBtn) {
    const closeBtn = tradeModal.querySelector('.close-btn');
    tradeBtn.addEventListener('click', () => {
      // Check if user has Discord set (data attribute on button)
      if (tradeBtn.dataset.hasDiscord === 'false') {
        // Show flash message instead of opening modal
        // Insert flash message right after the filter bar
        const mainContent = document.querySelector('.main-content');
        const msg = document.createElement('div');
        msg.className = 'flash-message flash-error';
        msg.style.marginBottom = '1rem';
        msg.innerHTML = 'Please set your Discord name in your <a href="/profile" style="color:inherit;text-decoration:underline;">profile</a> before creating a trade offer.';
        if (mainContent) {
          const filterBar = mainContent.querySelector('.filter-bar');
          if (filterBar && filterBar.parentElement) {
            filterBar.parentElement.insertBefore(msg, filterBar);
          } else {
            mainContent.prepend(msg);
          }
        }
        setTimeout(() => msg.remove(), 8000);
        return;
      }
      tradeModal.style.display = 'flex';
    });
    if (closeBtn) closeBtn.addEventListener('click', () => { tradeModal.style.display = 'none'; });
    window.addEventListener('click', e => { if (e.target === tradeModal) tradeModal.style.display = 'none'; });
  }

  // Types that get a free-text quantity input instead of +/- buttons
  const FREE_QTY_TYPES = ['currency', 'soul'];

  // Core currencies that round to nearest 1000 and init at 1000
  const CORE_CURRENCIES = ['Souls', 'Runes', 'Blood Echoes'];

  // Suggestion cache (fetched once per page load)
  let suggestCache = null;
  let suggestFetching = false;
  const suggestCallbacks = [];

  function fetchSuggestions(cb) {
    if (suggestCache) { cb(suggestCache); return; }
    suggestCallbacks.push(cb);
    if (suggestFetching) return;
    suggestFetching = true;
    fetch(`/trade/suggest-items?game=${encodeURIComponent(gameKey)}`)
      .then(r => r.json())
      .then(items => {
        suggestCache = Array.isArray(items) ? items : [];
        suggestCallbacks.forEach(fn => fn(suggestCache));
        suggestCallbacks.length = 0;
      })
      .catch(() => {
        suggestCache = [];
        suggestCallbacks.forEach(fn => fn(suggestCache));
        suggestCallbacks.length = 0;
      });
  }

  // Parse shorthand quantities like "330k" → 330000, "1.5m" → 1500000
  function parseShorthand(raw) {
    if (typeof raw !== 'string') return NaN;
    raw = raw.trim();
    const m = raw.match(/^(\d+(?:\.\d+)?)\s*([kKmM])$/);
    if (m) {
      const num = parseFloat(m[1]);
      const suffix = m[2].toLowerCase();
      if (suffix === 'k') return Math.round(num * 1_000);
      if (suffix === 'm') return Math.round(num * 1_000_000);
    }
    return parseInt(raw, 10);
  }

  // ── Collect items from a grid as a structured array ────────────────────────
  function collectItems(gridId) {
    const grid = document.getElementById(gridId);
    if (!grid) return [];
    return Array.from(grid.querySelectorAll('.item-box')).map(box => ({
      name:     box.dataset.name,
      type:     box.dataset.type,
      iconPath: box.dataset.iconPath || null,
      // Support both free-text input (.item-qty-input) and +/- span (.item-qty-value)
      qty:      parseShorthand(
                  box.querySelector('.item-qty-input')?.value ||
                  box.querySelector('.item-qty-value')?.textContent ||
                  '1') || 1,
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

    // Quantity controls — currency/soul types get a free-text input, others get +/− buttons
    const qtyWrap = document.createElement('div');
    qtyWrap.className = 'item-box-qty';

    if (FREE_QTY_TYPES.includes(item.type)) {
      // Free-text numeric input for currencies and soul items
      const isCore = CORE_CURRENCIES.includes(item.name);
      const initVal = isCore ? 1000 : 1;
      const minVal  = isCore ? 1000 : 1;
      const qtyInput = document.createElement('input');
      qtyInput.type        = 'text';
      qtyInput.className   = 'item-qty-input';
      qtyInput.value       = initVal;
      qtyInput.placeholder = 'Qty';
      qtyInput.dataset.lastValid = String(initVal);
      qtyInput.dataset.isCore    = String(isCore);
      qtyInput.addEventListener('input', () => {
        // Sync hidden field; don't force a value so user can freely type
        const parsed = parseShorthand(qtyInput.value);
        if (!isNaN(parsed) && parsed >= 1) {
          qtyInput.dataset.lastValid = String(parsed);
        }
        syncHidden(gridId, hiddenId);
      });
      qtyInput.addEventListener('blur', () => {
        let val = parseShorthand(qtyInput.value);
        if (isNaN(val) || val < minVal) {
          val = parseInt(qtyInput.dataset.lastValid, 10) || minVal;
        }
        // Core currency rounding
        if (isCore) {
          val = Math.max(minVal, Math.round(val / 1000) * 1000);
        }
        // Clamp
        val = Math.max(minVal, Math.min(val, 10_000_000));
        qtyInput.value = val;
        qtyInput.dataset.lastValid = String(val);
        syncHidden(gridId, hiddenId);
      });
      qtyWrap.appendChild(qtyInput);
    } else {
      // Standard +/− stepper for regular items
      const qtyMinus = document.createElement('button');
      qtyMinus.type        = 'button';
      qtyMinus.className   = 'qty-btn';
      qtyMinus.textContent = '−';
      const qtyVal = document.createElement('span');
      qtyVal.className   = 'item-qty-value';
      qtyVal.textContent = '1';
      const qtyPlus = document.createElement('button');
      qtyPlus.type        = 'button';
      qtyPlus.className   = 'qty-btn';
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
    }

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

  // ── Shared dropdown renderer ────────────────────────────────────────────────
  function renderDropdown(items, dropdown, gridId, hiddenId, input) {
    dropdown.innerHTML = '';
    if (!Array.isArray(items) || items.length === 0) { dropdown.style.display = 'none'; return; }
    items.forEach(item => {
      const li = document.createElement('li');
      li.className = 'dropdown-item';
      if (item.iconPath) {
        const dImg = document.createElement('img');
        dImg.src       = item.iconPath;
        dImg.alt       = '';
        dImg.className = 'dropdown-item-icon';
        dImg.onerror   = () => { dImg.style.display = 'none'; };
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
        input.value            = '';
        dropdown.style.display = 'none';
      });
      dropdown.appendChild(li);
    });
    dropdown.style.display = 'block';
  }

  // ── Item search autocomplete ───────────────────────────────────────────────
  function setupSearch(inputId, dropdownId, gridId, hiddenId) {
    const input    = document.getElementById(inputId);
    const dropdown = document.getElementById(dropdownId);
    if (!input || !dropdown) return;

    // Show suggestions when focused with empty input
    input.addEventListener('focus', () => {
      if (input.value.trim()) return;
      fetchSuggestions(items => {
        if (input.value.trim()) return; // user typed while fetching
        renderDropdown(items, dropdown, gridId, hiddenId, input);
      });
    });

    let timer;
    input.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(async () => {
        const q = input.value.trim();
        if (!q) {
          // Show suggestions when input cleared
          fetchSuggestions(items => {
            if (input.value.trim()) return;
            renderDropdown(items, dropdown, gridId, hiddenId, input);
          });
          return;
        }
        try {
          const resp  = await fetch(`${SEARCH_URL}?game=${encodeURIComponent(gameKey)}&query=${encodeURIComponent(q)}`);
          const items = await resp.json();
          renderDropdown(items, dropdown, gridId, hiddenId, input);
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
      const qLabel = fmtQty(item.qty);
      if (qLabel) text += ` ×${qLabel}`;
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

  // ── Hide trades helpers ────────────────────────────────────────────────────
  const hiddenKey = `soultrader_hidden_${gameKey}`;
  function getHidden() { try { return JSON.parse(localStorage.getItem(hiddenKey) || '[]'); } catch { return []; } }
  function setHidden(arr) { localStorage.setItem(hiddenKey, JSON.stringify(arr)); }
  let showHiddenActive = false;

  // ── Filter / sort ──────────────────────────────────────────────────────────
  const tradeCards     = Array.from(document.querySelectorAll('.trade-card'));
  const offersGrid     = document.querySelector('.offers-grid');
  const platformSelect = document.getElementById('platformSelect');
  const sortSelect     = document.getElementById('sortSelect');
  const searchInput    = document.getElementById('searchInput');

  // Add "Show Hidden" toggle button to filter bar
  const filterBar = document.querySelector('.filter-bar');
  let showHiddenBtn = null;
  if (filterBar) {
    const grp = document.createElement('div');
    grp.className = 'filter-group';
    showHiddenBtn = document.createElement('button');
    showHiddenBtn.type      = 'button';
    showHiddenBtn.className = 'btn btn-secondary btn-show-hidden';
    showHiddenBtn.textContent = 'Show Hidden';
    showHiddenBtn.style.display = getHidden().length ? '' : 'none';
    showHiddenBtn.addEventListener('click', () => {
      showHiddenActive = !showHiddenActive;
      showHiddenBtn.textContent = showHiddenActive ? 'Hide Hidden' : 'Show Hidden';
      applyFilters();
    });
    grp.appendChild(showHiddenBtn);
    filterBar.appendChild(grp);
  }

  // Add hide buttons to non-own trade cards
  tradeCards.forEach(card => {
    if (card.dataset.own === 'true') return;
    const tradeId = card.dataset.tradeId;
    if (!tradeId) return;
    const actionsDiv = card.querySelector('.trade-actions');
    if (!actionsDiv) return;
    const hideBtn = document.createElement('button');
    hideBtn.type      = 'button';
    hideBtn.className = 'btn btn-secondary btn-sm';
    hideBtn.textContent = 'Hide';
    hideBtn.title     = 'Hide this trade';
    hideBtn.addEventListener('click', () => {
      const hidden = getHidden();
      if (!hidden.includes(tradeId)) {
        hidden.push(tradeId);
        setHidden(hidden);
      }
      applyFilters();
      if (showHiddenBtn) showHiddenBtn.style.display = '';
    });
    actionsDiv.appendChild(hideBtn);
  });

  function applyFilters() {
    if (!offersGrid) return;
    const platform = (platformSelect?.value || 'all').toLowerCase();
    const sort     = sortSelect?.value || 'desc';
    const query    = (searchInput?.value || '').toLowerCase().trim();
    const hidden   = getHidden();

    let visible = tradeCards.filter(card => {
      if (platform !== 'all' && (card.dataset.platform || '').toLowerCase() !== platform) return false;
      if (query && !card.innerText.toLowerCase().includes(query)) return false;
      const tid = card.dataset.tradeId;
      if (tid && hidden.includes(tid) && !showHiddenActive) return false;
      return true;
    });

    visible.sort((a, b) => {
      const ta = Number(a.dataset.createdAt) || 0;
      const tb = Number(b.dataset.createdAt) || 0;
      return sort === 'asc' ? ta - tb : tb - ta;
    });

    tradeCards.forEach(c => (c.style.display = 'none'));
    visible.forEach(c => {
      const tid = c.dataset.tradeId;
      const isHidden = tid && hidden.includes(tid);
      c.style.display = 'flex';
      c.style.opacity = isHidden ? '0.45' : '1';
      // Show/hide unhide button
      let unhideBtn = c.querySelector('.btn-unhide-trade');
      if (isHidden && showHiddenActive) {
        if (!unhideBtn) {
          unhideBtn = document.createElement('button');
          unhideBtn.type      = 'button';
          unhideBtn.className = 'btn btn-secondary btn-unhide-trade';
          unhideBtn.textContent = 'Unhide';
          unhideBtn.addEventListener('click', () => {
            const h = getHidden().filter(id => id !== tid);
            setHidden(h);
            applyFilters();
            if (showHiddenBtn && h.length === 0) {
              showHiddenBtn.style.display = 'none';
              showHiddenActive = false;
              showHiddenBtn.textContent = 'Show Hidden';
            }
          });
          c.querySelector('.trade-actions')?.appendChild(unhideBtn);
        }
        unhideBtn.style.display = '';
      } else if (unhideBtn) {
        unhideBtn.style.display = 'none';
      }
      offersGrid.appendChild(c);
    });

    // Update show-hidden button visibility
    if (showHiddenBtn) {
      showHiddenBtn.style.display = hidden.length ? '' : 'none';
    }
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
      const additionalInfo = document.getElementById('additionalInfo')?.value || '';
      const inGameName    = document.getElementById('inGameName')?.value    || '';

      try {
        const resp  = await fetch(`/trade/details/${tradeId}`);
        const trade = await resp.json();

        // Render confirmation details
        const detailsEl = document.getElementById('tradeDetails');
        if (detailsEl) {
          const fmt = items => (items || []).map(i => {
            const ql = fmtQty(i.qty);
            let s = i.name + (ql ? ` ×${ql}` : '');
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
                body:    JSON.stringify({ meetingPoint, additionalInfo, inGameName }),
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

function fmtQty(n) {
  n = parseInt(n, 10) || 1;
  if (n <= 1) return null;
  if (n >= 1_000_000) return parseFloat((n / 1_000_000).toFixed(2)) + 'M';
  if (n >= 1_000)     return parseFloat((n / 1_000).toFixed(1))     + 'K';
  return String(n);
}
