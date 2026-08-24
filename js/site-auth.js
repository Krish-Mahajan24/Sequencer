(function () {
  'use strict';

  const SESSION_KEY = 'sequencer_current_user_v1';

  const nav = document.getElementById('siteNav');

  if (!nav) return;


  // =========================================================
  // GET CURRENT USER SESSION
  // =========================================================

  function getSession() {
    try {
      return JSON.parse(
        localStorage.getItem(SESSION_KEY) || 'null'
      );
    } catch (_) {
      return null;
    }
  }


  const session = getSession();


  // =========================================================
  // PROTECTED PAGES
  // Library and Sequence require login
  // =========================================================

  const protectedPages = [
    'library.html',
    'sequence.html'
  ];


  function currentFileName() {

    const path =
      window.location.pathname || '';

    const name =
      path.split('/').pop() || '';

    return name || 'index.html';

  }


  function goToAuth(target) {

    const safeTarget =
      protectedPages.includes(target)
        ? target
        : 'index.html';

    window.location.href =
      'auth.html?next=' +
      encodeURIComponent(safeTarget);

  }


  const pageName = currentFileName();


  // ---------------------------------------------------------
  // Block direct access to Library or Sequence
  // ---------------------------------------------------------

  if (
    protectedPages.includes(pageName) &&
    !session
  ) {

    goToAuth(pageName);

    return;

  }


  // ---------------------------------------------------------
  // If user clicks Library or Sequence without logging in,
  // redirect them to Sign In
  // ---------------------------------------------------------

  document.addEventListener(
    'click',
    function (event) {

      const link =
        event.target.closest('a[href]');

      if (!link) return;


      const rawHref =
        link.getAttribute('href') || '';


      const href =
        rawHref
          .split('/')
          .pop()
          .split('?')[0]
          .split('#')[0];


      if (
        protectedPages.includes(href) &&
        !getSession()
      ) {

        event.preventDefault();

        goToAuth(href);

      }

    }
  );


  // =========================================================
  // ESCAPE HTML
  // =========================================================

  function escapeHTML(value) {

    return String(value || '').replace(
      /[&<>'"]/g,
      c => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;'
      }[c])
    );

  }


  // =========================================================
  // NAVIGATION
  // =========================================================

  const navRight =
    nav.querySelector('.nav-right');

  if (!navRight) return;


  // If user is not logged in,
  // keep the normal Sign in / Sign up buttons

  if (!session) return;


  // =========================================================
  // USER PROFILE
  // =========================================================

  const first =
    session.firstName || '';

  const last =
    session.lastName || '';


  const initials =
    (
      (first[0] || '') +
      (last[0] || '')
    )
      .toUpperCase()
    || 'U';


  const displayName =
    `${first} ${last}`.trim()
    || 'User';


  navRight.innerHTML = `

    <a
      href="sequence.html"
      class="btn btn-primary btn-sm nav-build-btn"
    >
      Start building
      <span class="arrow">→</span>
    </a>


    <div class="profile-wrap">

      <button
        class="profile-btn"
        id="profileBtn"
        type="button"
        aria-expanded="false"
        aria-haspopup="true"
      >

        <span class="profile-avatar">
          ${escapeHTML(initials)}
        </span>

        <span class="profile-name">
          ${escapeHTML(first || 'Profile')}
        </span>

        <span class="profile-chevron">
          ⌄
        </span>

      </button>


      <div
        class="profile-menu"
        id="profileMenu"
        hidden
      >

        <div class="profile-menu-head">

          <div class="profile-avatar large">
            ${escapeHTML(initials)}
          </div>

          <div>

            <strong>
              ${escapeHTML(displayName)}
            </strong>

            <span>
              ${escapeHTML(session.email || '')}
            </span>

          </div>

        </div>


        <div class="profile-menu-divider"></div>


        <a
          href="profile.html"
          class="profile-option"
        >
          Profile
        </a>


        <a
          href="library.html"
          class="profile-option"
        >
          My Library
        </a>


        <button
          type="button"
          class="profile-option disabled-option"
          data-coming="Settings"
        >
          Settings
        </button>


        <button
          type="button"
          class="profile-option disabled-option"
          data-coming="Help &amp; support"
        >
          Help &amp; support
        </button>


        <div class="profile-menu-divider"></div>


        <button
          type="button"
          class="profile-option logout-option"
          id="logoutBtn"
        >
          Log out
        </button>

      </div>

    </div>

  `;


  // =========================================================
  // PROFILE MENU
  // =========================================================

  const profileBtn =
    document.getElementById('profileBtn');

  const menu =
    document.getElementById('profileMenu');

  const logoutBtn =
    document.getElementById('logoutBtn');


  function closeMenu() {

    if (!menu) return;

    menu.hidden = true;

    profileBtn.setAttribute(
      'aria-expanded',
      'false'
    );

  }


  profileBtn.addEventListener(
    'click',
    function (event) {

      event.stopPropagation();

      const isOpen =
        !menu.hidden;

      menu.hidden = isOpen;

      profileBtn.setAttribute(
        'aria-expanded',
        String(!isOpen)
      );

    }
  );


  document.addEventListener(
    'click',
    function (event) {

      if (
        !event.target.closest('.profile-wrap')
      ) {

        closeMenu();

      }

    }
  );


  // =========================================================
  // COMING SOON BUTTONS
  // =========================================================

  document
    .querySelectorAll('[data-coming]')
    .forEach(function (button) {

      button.addEventListener(
        'click',
        function () {

          closeMenu();

          const name =
            button.dataset.coming
            || 'This option';

          alert(
            name + ' is coming soon.'
          );

        }
      );

    });


  // =========================================================
  // LOGOUT
  // =========================================================

  logoutBtn.addEventListener(
    'click',
    function () {

      localStorage.removeItem(
        SESSION_KEY
      );

      window.location.href =
        'index.html';

    }
  );


})();