/**
 * Sequencer API Configuration
 * 
 * Guideline #5: Replace local backend URL with deployed API URL
 * 
 * - When running locally: Uses http://localhost:5001/api
 * - When deployed (e.g. Render / Railway / Vercel): Automatically switches
 *   to DEPLOYED_API_URL, or you can paste your live URL below.
 */
(function () {
  'use strict';

  window.SEQUENCER_CONFIG = {
    // Local development backend URL
    LOCAL_API_URL: 'http://localhost:5050/api',

    // Deployed production backend URL (e.g. Render, Railway, Fly.io, etc.)
    // Replace with your actual deployed backend URL once deployed
    DEPLOYED_API_URL: 'https://sequencer-backend-krish.onrender.com/api',

    // Determine the base API URL dynamically based on current environment
    getBaseUrl() {
      const isLocal =
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1' ||
        window.location.protocol === 'file:';

      if (window.location.pathname.startsWith('/frontend/')) return window.location.origin + '/api';
      return isLocal ? this.LOCAL_API_URL : this.DEPLOYED_API_URL;
    },
  };
})();
