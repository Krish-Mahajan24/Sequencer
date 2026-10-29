(function () {
  'use strict';
  const SESSION_KEY = 'sequencer_current_user_v1';
  const resources = ['library', 'playlists', 'sequences', 'history'];
  const queues = new Map();
  function status(message, failed = false) {
    let banner = document.getElementById('databaseStatus');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'databaseStatus';
      banner.setAttribute('role', 'status');
      banner.style.cssText = 'position:fixed;bottom:16px;left:16px;z-index:10000;max-width:420px;padding:12px 18px;border-radius:10px;background:#21141b;color:#fff;font:14px system-ui;box-shadow:0 4px 20px #0006';
      document.body.appendChild(banner);
    }
    banner.textContent = message;
    banner.style.border = failed ? '1px solid #ff3d81' : '1px solid #555';
  }
  const store = window.SequencerStore = {
    session() { try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); } catch { return null; } },
    userId() { return this.session()?.id || 'guest'; },
    key(name) { return `sequencer_${name}_${this.userId()}`; },
    get(name, fallback) {
      try { const value = localStorage.getItem(this.key(name)); return value === null ? fallback : JSON.parse(value); }
      catch { return fallback; }
    },
    set(name, value, syncCloud = true) {
      localStorage.setItem(this.key(name), JSON.stringify(value));
      if (syncCloud && resources.includes(name)) {
        const pendingKey = this.key('pending_' + name);
        const snapshot = JSON.stringify(value);
        localStorage.setItem(pendingKey, snapshot);
        status('Saving…');
        // Serialize collection snapshots so an older save cannot overwrite a newer one.
        const task = (queues.get(name) || Promise.resolve()).catch(() => {}).then(async () => {
          if (!(await this.ready)) throw new Error('Database unavailable. Reload to retry.');
          await window.SequencerAPI.syncToCloud(name, JSON.parse(snapshot));
          if (localStorage.getItem(pendingKey) === snapshot) localStorage.removeItem(pendingKey);
        });
        queues.set(name, task);
        task.then(() => {
          if (!resources.some(resource => localStorage.getItem(this.key('pending_' + resource)))) status('Saved to database');
        }).catch(error => status('Not saved to database. ' + error.message + ' Your changes are kept on this device for retry.', true));
      }
      return value;
    },
    async syncWithCloud() {
      const result = await window.SequencerAPI.auth.getMe();
      localStorage.setItem(SESSION_KEY, JSON.stringify({ ...result.user, signedInAt: this.session()?.signedInAt }));
      // Retry previously interrupted writes before fetching the database snapshot.
      for (const name of resources) {
        const pendingKey = this.key('pending_' + name);
        const pending = localStorage.getItem(pendingKey);
        if (pending !== null) {
          await window.SequencerAPI.syncToCloud(name, JSON.parse(pending));
          if (localStorage.getItem(pendingKey) === pending) localStorage.removeItem(pendingKey);
        }
      }
      const data = await window.SequencerAPI.pullFromCloud();
      for (const name of resources) this.set(name, data[name], false);
    },
  };
  store.ready = new Promise(resolve => {
    const initialize = async () => {
      const protectedPage = /\/(library|sequence|profile)\.html$/.test(location.pathname);
      if (!store.session() || !window.SequencerAPI?.getToken()) {
        if (protectedPage) location.href = 'auth.html?next=' + encodeURIComponent(location.pathname.split('/').pop());
        resolve(!protectedPage);
        return;
      }
      try {
        await store.syncWithCloud();
        resolve(true);
      } catch (error) {
        if (error.status === 401) {
          window.SequencerAPI.auth.logout();
          localStorage.removeItem(SESSION_KEY);
          if (protectedPage) location.href = 'auth.html';
        }
        status('Unable to load your database data. ' + (error.data?.message || error.message) + ' Reload to retry.', true);
        resolve(false);
      }
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
    else initialize();
  });
  window.addEventListener('beforeunload', event => {
    if (resources.some(name => localStorage.getItem(store.key('pending_' + name)))) {
      event.preventDefault(); event.returnValue = '';
    }
  });
})();
