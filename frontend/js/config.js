/** Sequencer uses the API on the same origin as the deployed frontend. */
(function () {
  'use strict';
  window.SEQUENCER_CONFIG = {
    LOCAL_API_URL: 'http://localhost:5050/api',
    getBaseUrl() {
      if (window.location.protocol === 'file:') return this.LOCAL_API_URL;
      const local = ['localhost', '127.0.0.1'].includes(window.location.hostname);
      if (local && !window.location.pathname.startsWith('/frontend/') && window.location.port !== '5050') return this.LOCAL_API_URL;
      return window.location.origin + '/api';
    },
  };
})();
