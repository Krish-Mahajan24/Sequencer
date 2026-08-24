(function () {
  'use strict';

  // Local-only authentication.
  // Users are stored in localStorage under one key and the current login is
  // stored separately. Passwords are never stored as plain text.
  const USERS_KEY = 'sequencer_users_v1';
  const SESSION_KEY = 'sequencer_current_user_v1';

  const notice = document.getElementById('notice');

  function show(message, type = 'error') {
    if (!notice) return;
    notice.textContent = message;
    notice.className = 'notice show ' + type;
  }

  function getUsers() {
    try {
      const users = JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
      return Array.isArray(users) ? users : [];
    } catch {
      return [];
    }
  }

  function saveUsers(users) {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  }

  function normalizeEmail(email) {
    return String(email || '').trim().toLowerCase();
  }

  function validEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function randomSalt() {
    if (window.crypto && crypto.getRandomValues) {
      const bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);
      return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
    }
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  function bytesToHex(buffer) {
    return Array.from(new Uint8Array(buffer), b => b.toString(16).padStart(2, '0')).join('');
  }

  async function hashPassword(password, salt) {
    // PBKDF2 is preferable to saving a plain-text password. It works on
    // localhost/Live Preview. A SHA-256 fallback keeps the demo functional
    // if the page is opened in an environment without SubtleCrypto.
    if (window.crypto && crypto.subtle) {
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(password),
        'PBKDF2',
        false,
        ['deriveBits']
      );
      const bits = await crypto.subtle.deriveBits(
        { name: 'PBKDF2', salt: encoder.encode(salt), iterations: 100000, hash: 'SHA-256' },
        key,
        256
      );
      return bytesToHex(bits);
    }

    // Fallback for older/browser-restricted environments.
    if (window.crypto && crypto.subtle) {
      const data = new TextEncoder().encode(salt + ':' + password);
      return bytesToHex(await crypto.subtle.digest('SHA-256', data));
    }

    return btoa(unescape(encodeURIComponent(salt + ':' + password)));
  }

  function setSession(user) {
    localStorage.setItem(SESSION_KEY, JSON.stringify({
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      signedInAt: new Date().toISOString()
    }));
  }

  function makeId() {
    if (crypto.randomUUID) return crypto.randomUUID();
    return 'user_' + Date.now() + '_' + Math.random().toString(36).slice(2);
  }

  function setBusy(form, busy) {
    const button = form.querySelector('.main-btn');
    if (!button) return;
    button.disabled = busy;
    button.style.opacity = busy ? '0.65' : '1';
    button.style.pointerEvents = busy ? 'none' : '';
  }

  const signinForm = document.getElementById('signinForm');
  if (signinForm) {
    signinForm.addEventListener('submit', async function (event) {
      event.preventDefault();
      const form = new FormData(signinForm);
      const email = normalizeEmail(form.get('email'));
      const password = String(form.get('password') || '');

      if (!validEmail(email)) return show('Please enter a valid email address.');
      if (password.length < 6) return show('Password must be at least 6 characters.');

      setBusy(signinForm, true);
      try {
        const users = getUsers();
        const user = users.find(item => item.email === email);

        if (!user) {
          show('No account exists with this email. Please sign up first.');
          return;
        }

        const passwordHash = await hashPassword(password, user.salt);
        if (passwordHash !== user.passwordHash) {
          show('Incorrect email or password.');
          return;
        }

        setSession(user);
        show('Signed in successfully. Redirecting…', 'success');
        setTimeout(() => { window.location.href = 'index.html'; }, 500);
      } catch (error) {
        console.error(error);
        show('Unable to sign in. Please try again.');
      } finally {
        setBusy(signinForm, false);
      }
    });
  }

  const signupForm = document.getElementById('signupForm');
  if (signupForm) {
    signupForm.addEventListener('submit', async function (event) {
      event.preventDefault();
      const form = new FormData(signupForm);
      const firstName = String(form.get('firstName') || '').trim();
      const lastName = String(form.get('lastName') || '').trim();
      const email = normalizeEmail(form.get('email'));
      const password = String(form.get('password') || '');
      const confirmPassword = String(form.get('confirmPassword') || '');

      if (!firstName || !lastName) return show('Please enter your first and last name.');
      if (!validEmail(email)) return show('Please enter a valid email address.');
      if (password.length < 6) return show('Password must be at least 6 characters.');
      if (password !== confirmPassword) return show('Passwords do not match.');

      setBusy(signupForm, true);
      try {
        const users = getUsers();

        // Case-insensitive duplicate prevention.
        if (users.some(item => item.email === email)) {
          show('An account with this email already exists. Please sign in instead.');
          return;
        }

        const salt = randomSalt();
        const passwordHash = await hashPassword(password, salt);
        const user = {
          id: makeId(),
          firstName,
          lastName,
          email,
          salt,
          passwordHash,
          createdAt: new Date().toISOString()
        };

        users.push(user);
        saveUsers(users);
        setSession(user);

        show('Account created successfully. Redirecting…', 'success');
        setTimeout(() => { window.location.href = 'index.html'; }, 500);
      } catch (error) {
        console.error(error);
        show('Unable to create the account. Please try again.');
      } finally {
        setBusy(signupForm, false);
      }
    });
  }

  // The social buttons are visual placeholders until OAuth provider keys are
  // configured. Email/password authentication above works entirely locally.
  document.querySelectorAll('.social').forEach(function (button) {
    button.addEventListener('click', function () {
      const provider = (button.dataset.provider || 'Social').replace(/^./, c => c.toUpperCase());
      show(provider + ' sign-in requires OAuth setup. Use email and password for local sign-in.');
    });
  });
})();
