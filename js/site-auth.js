(function () {
  'use strict';

  const SESSION_KEY = 'sequencer_current_user_v1';
  const nav = document.getElementById('siteNav');
  if (!nav) return;

  function getSession() {
    try {
      return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
    } catch (_) {
      return null;
    }
  }

  function escapeHTML(value) {
    return String(value || '').replace(/[&<>'"]/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[c]));
  }

  const session = getSession();
  const navRight = nav.querySelector('.nav-right');
  if (!navRight) return;

  if (!session) return;

  const first = session.firstName || '';
  const last = session.lastName || '';
  const initials = ((first[0] || '') + (last[0] || '')).toUpperCase() || 'U';
  const displayName = `${first} ${last}`.trim() || 'User';

  navRight.innerHTML = `
    <a href="sequence.html" class="btn btn-primary btn-sm nav-build-btn">Start building <span class="arrow">→</span></a>
    <div class="profile-wrap">
      <button class="profile-btn" id="profileBtn" type="button" aria-expanded="false" aria-haspopup="true">
        <span class="profile-avatar">${escapeHTML(initials)}</span>
        <span class="profile-name">${escapeHTML(first || 'Profile')}</span>
        <span class="profile-chevron">⌄</span>
      </button>
      <div class="profile-menu" id="profileMenu" hidden>
        <div class="profile-menu-head">
          <div class="profile-avatar large">${escapeHTML(initials)}</div>
          <div>
            <strong>${escapeHTML(displayName)}</strong>
            <span>${escapeHTML(session.email || '')}</span>
          </div>
        </div>
        <div class="profile-menu-divider"></div>
        <button type="button" class="profile-option disabled-option" data-coming="Profile">Profile</button>
        <button type="button" class="profile-option disabled-option" data-coming="My Library">My Library</button>
        <button type="button" class="profile-option disabled-option" data-coming="Settings">Settings</button>
        <button type="button" class="profile-option disabled-option" data-coming="Help &amp; support">Help &amp; support</button>
        <div class="profile-menu-divider"></div>
        <button type="button" class="profile-option logout-option" id="logoutBtn">Log out</button>
      </div>
    </div>
  `;

  const profileBtn = document.getElementById('profileBtn');
  const menu = document.getElementById('profileMenu');
  const logoutBtn = document.getElementById('logoutBtn');

  function closeMenu() {
    if (!menu) return;
    menu.hidden = true;
    profileBtn.setAttribute('aria-expanded', 'false');
  }

  profileBtn.addEventListener('click', function (event) {
    event.stopPropagation();
    const isOpen = !menu.hidden;
    menu.hidden = isOpen;
    profileBtn.setAttribute('aria-expanded', String(!isOpen));
  });

  document.addEventListener('click', function (event) {
    if (!event.target.closest('.profile-wrap')) closeMenu();
  });

  document.querySelectorAll('[data-coming]').forEach(function (button) {
    button.addEventListener('click', function () {
      closeMenu();
      const name = button.dataset.coming || 'This option';
      alert(name + ' is coming soon.');
    });
  });

  logoutBtn.addEventListener('click', function () {
    localStorage.removeItem(SESSION_KEY);
    window.location.href = 'index.html';
  });
})();
