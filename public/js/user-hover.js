// ─── SoulTrader — User Hover Card ────────────────────────────────────────────
// Replaces plain CSS tooltips on username mentions with a rich JS-driven card.

(function () {
  const DELAY_SHOW = 280; // ms before card appears
  const DELAY_HIDE = 200; // ms grace period when moving to card

  let card = null;
  let showTimer = null;
  let hideTimer = null;
  let currentUsername = null;
  const cache = {}; // username → data

  // Role colours matching roleColors in gameController
  const ROLE_COLORS = {
    admin:     '#fa9cff',
    moderator: '#5b9bff',
    user:      '#e8e8e8',
  };

  function createCard() {
    const el = document.createElement('div');
    el.className = 'user-hover-card';
    el.id = 'userHoverCard';
    el.style.display = 'none';
    el.addEventListener('mouseenter', () => clearTimeout(hideTimer));
    el.addEventListener('mouseleave', () => scheduleHide());
    document.body.appendChild(el);
    return el;
  }

  function positionCard(trigger) {
    const rect = trigger.getBoundingClientRect();
    const cw = card.offsetWidth  || 260;
    const ch = card.offsetHeight || 200;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const scrollY = window.scrollY;

    // Prefer above, fall back to below
    let top, left;

    if (rect.top - ch - 8 > 0) {
      top = rect.top + scrollY - ch - 8;
    } else {
      top = rect.bottom + scrollY + 8;
    }

    // Horizontally: centre on trigger, clamp to viewport
    left = rect.left + rect.width / 2 - cw / 2;
    left = Math.max(8, Math.min(left, vw - cw - 8));

    card.style.top  = `${top}px`;
    card.style.left = `${left}px`;
  }

  function fmtDate(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }

  function renderCard(data) {
    const karma    = (data.positiveKarma || 0) - (data.negativeKarma || 0);
    const total    = (data.positiveKarma || 0) + (data.negativeKarma || 0);
    const pct      = total > 0 ? Math.round((data.positiveKarma / total) * 100) : 0;
    const karmaSign = karma >= 0 ? '+' : '';
    const roleColor = ROLE_COLORS[data.role] || ROLE_COLORS.user;

    const avatar = data.profileImagePath
      ? `<img src="${data.profileImagePath}" class="uhc-avatar" alt="" onerror="this.style.display='none'">`
      : `<div class="uhc-avatar-fallback">${(data.username || '?').charAt(0).toUpperCase()}</div>`;

    // Build badge chips
    const badgesHtml = (data.badges || []).map(b =>
      `<span class="user-card-badge" style="background:${b.color};color:${b.textColor}">${b.name}</span>`
    ).join('');

    card.innerHTML = `
      <div class="uhc-header">
        ${avatar}
        <div class="uhc-header-info">
          <a href="/profile/${data.username}" class="uhc-username" style="color:${roleColor}">${data.username}</a>
          ${badgesHtml ? `<div class="uhc-badges">${badgesHtml}</div>` : `<span class="uhc-role" style="color:${roleColor}">${data.role}</span>`}
        </div>
      </div>
      <div class="uhc-divider"></div>
      <div class="uhc-stats">
        <div class="uhc-stat-row">
          <span class="uhc-stat-label">Karma</span>
          <span class="uhc-stat-value" style="color:${karma >= 0 ? 'var(--success)' : 'var(--danger)'}">
            ${karmaSign}${karma}
            <span class="uhc-stat-sub">(+${data.positiveKarma || 0} / −${data.negativeKarma || 0})</span>
          </span>
        </div>
        <div class="uhc-stat-row">
          <span class="uhc-stat-label">Rating</span>
          <span class="uhc-stat-value">${pct}%
            <span class="uhc-stat-sub">${total} ratings</span>
          </span>
        </div>
        <div class="uhc-stat-row">
          <span class="uhc-stat-label">Trades</span>
          <span class="uhc-stat-value">${data.completedTradeCount || 0} completed</span>
        </div>
        <div class="uhc-stat-row">
          <span class="uhc-stat-label">Member</span>
          <span class="uhc-stat-value">${fmtDate(data.createdAt)}</span>
        </div>
      </div>
      <div class="uhc-footer">
        <a href="/profile/${data.username}" class="uhc-view-link">View full profile →</a>
      </div>
    `;
  }

  function showLoading() {
    card.innerHTML = `<div class="uhc-loading">Loading…</div>`;
  }

  async function fetchUser(username) {
    if (cache[username]) return cache[username];
    const resp = await fetch(`/profile/preview/${encodeURIComponent(username)}`);
    if (!resp.ok) throw new Error('Not found');
    const data = await resp.json();
    cache[username] = data;
    return data;
  }

  function scheduleHide() {
    clearTimeout(hideTimer);
    hideTimer = setTimeout(hideCard, DELAY_HIDE);
  }

  function hideCard() {
    if (card) card.style.display = 'none';
    currentUsername = null;
  }

  async function showCard(trigger, username) {
    if (!card) card = createCard();
    currentUsername = username;

    showLoading();
    card.style.display = 'block';
    positionCard(trigger);

    try {
      const data = await fetchUser(username);
      if (currentUsername !== username) return; // user moved away
      renderCard(data);
      // Reposition after content is rendered
      requestAnimationFrame(() => positionCard(trigger));
    } catch {
      if (currentUsername !== username) return;
      card.innerHTML = `<div class="uhc-loading" style="color:var(--danger)">Failed to load</div>`;
    }
  }

  function init() {
    document.addEventListener('mouseenter', (e) => {
      const trigger = e.target.closest('[data-username]');
      if (!trigger) return;
      const username = trigger.dataset.username;
      clearTimeout(hideTimer);
      clearTimeout(showTimer);
      showTimer = setTimeout(() => showCard(trigger, username), DELAY_SHOW);
    }, true);

    document.addEventListener('mouseleave', (e) => {
      const trigger = e.target.closest('[data-username]');
      if (!trigger) return;
      clearTimeout(showTimer);
      scheduleHide();
    }, true);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
