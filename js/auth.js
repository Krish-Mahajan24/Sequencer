(function () {
  'use strict';
  const notice = document.getElementById('notice');
  function show(message, type = 'error') {
    if (notice) { notice.textContent = message; notice.className = 'notice show ' + type; }
  }
  function finish(result, next) {
    if (!result.success || !result.user) throw new Error('Unable to authenticate.');
    localStorage.setItem('sequencer_current_user_v1', JSON.stringify({ ...result.user, signedInAt: new Date().toISOString() }));
    location.href = ['library.html', 'sequence.html', 'profile.html'].includes(next) ? next : 'index.html';
  }
  const fragment = new URLSearchParams(location.hash.slice(1));
  if (fragment.has('oauth_code') || fragment.has('oauth_error')) {
    history.replaceState(null, '', location.pathname + location.search);
    if (fragment.has('oauth_error')) show(fragment.get('oauth_error'));
    else {
      const verifier = sessionStorage.getItem('sequencer_oauth_verifier');
      sessionStorage.removeItem('sequencer_oauth_verifier');
      window.SequencerAPI.auth.exchangeOAuth({ code: fragment.get('oauth_code'), verifier })
        .then(result => finish(result, fragment.get('next')))
        .catch(error => show(error.data?.message || error.message));
    }
  }
  document.querySelectorAll('[data-provider]').forEach(button => button.addEventListener('click', async () => {
    button.disabled = true;
    try {
      if (!window.crypto?.subtle) throw new Error('Please open Sequencer on localhost or HTTPS to sign in.');
      const bytes = crypto.getRandomValues(new Uint8Array(32));
      const encode = array => btoa(String.fromCharCode(...array)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      const verifier = encode(bytes);
      const challenge = encode(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))));
      sessionStorage.setItem('sequencer_oauth_verifier', verifier);
      const url = new URL(window.SequencerAPI.getBaseUrl() + '/auth/' + button.dataset.provider);
      url.searchParams.set('challenge', challenge);
      url.searchParams.set('next', new URLSearchParams(location.search).get('next') || 'index.html');
      location.href = url.toString();
    } catch (error) { show(error.message); button.disabled = false; }
  }));
  for (const [formId, action] of [['signinForm', 'login'], ['signupForm', 'signup']]) {
    const form = document.getElementById(formId);
    if (!form) continue;
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const values = Object.fromEntries(new FormData(form));
      values.email = String(values.email || '').trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) return show('Please enter a valid email address.');
      if (String(values.password || '').length < 6) return show('Password must be at least 6 characters.');
      if (action === 'signup') {
        values.firstName = String(values.firstName || '').trim();
        values.lastName = String(values.lastName || '').trim();
        if (!values.firstName || !values.lastName) return show('Please enter your first and last name.');
        if (values.password !== values.confirmPassword) return show('Passwords do not match.');
      }
      const button = form.querySelector('[type="submit"]');
      if (button) button.disabled = true;
      try {
        const result = await window.SequencerAPI.auth[action](values);
        if (!result.success || !result.user) throw new Error('Unable to authenticate.');
        localStorage.setItem('sequencer_current_user_v1', JSON.stringify({ ...result.user, signedInAt: new Date().toISOString() }));
        show(action === 'signup' ? 'Account created. Redirecting…' : 'Signed in. Redirecting…', 'success');
        const next = new URLSearchParams(location.search).get('next');
        location.href = ['library.html', 'sequence.html', 'profile.html'].includes(next) ? next : 'index.html';
      } catch (error) {
        show(error.data?.message || error.message || 'Unable to connect to the server. Please try again.');
      } finally {
        if (button) button.disabled = false;
      }
    });
  }
})();
