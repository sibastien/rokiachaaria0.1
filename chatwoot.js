/**
 * ============================================================================
 * Chatwoot Live Chat Integration — الرقية الشرعية أونلاين
 * ============================================================================
 * 
 * Instructions to activate live chat once Chatwoot is deployed:
 * -------------------------------------------------------------
 * 1. Change `enabled` to true.
 * 2. Set `baseUrl` to your Chatwoot URL (e.g., 'https://chat.yourdomain.com' or 'https://app.chatwoot.com').
 * 3. Set `websiteToken` to the Website Channel Token generated in your Chatwoot Inbox settings.
 * 
 * When `enabled` is false or `websiteToken` is default, the widget remains completely dormant
 * and will NOT make any network requests or load external scripts.
 */

(function () {
  'use strict';

  // ── Configuration ──────────────────────────────────────────────────────────
  window.chatwootConfig = window.chatwootConfig || {
    // 1. Toggle to true once your Chatwoot instance is up and running
    enabled: false,

    // 2. Chatwoot server Base URL (without trailing slash)
    baseUrl: 'https://chat.example.com',

    // 3. Website Channel Token from Chatwoot -> Settings -> Inboxes -> Your Website Inbox
    websiteToken: 'REPLACE_WITH_YOUR_WEBSITE_TOKEN',

    // 4. Widget display preferences
    settings: {
      position: 'right',               // 'right' or 'left' (right is ideal for RTL and avoids toast notifications)
      locale: 'ar',                     // Arabic language interface
      type: 'standard',                 // 'standard' bubble
      launcherTitle: 'تحدث معنا مباشرة', // Floating button label
      showPopoutButton: true,
    }
  };

  // If disabled or unconfigured, exit gracefully
  if (
    !window.chatwootConfig.enabled ||
    !window.chatwootConfig.websiteToken ||
    window.chatwootConfig.websiteToken === 'REPLACE_WITH_YOUR_WEBSITE_TOKEN'
  ) {
    return;
  }

  // ── SDK Loader ────────────────────────────────────────────────────────────
  const BASE_URL = window.chatwootConfig.baseUrl.replace(/\/+$/, '');
  const WEBSITE_TOKEN = window.chatwootConfig.websiteToken;

  window.chatwootSettings = Object.assign(
    {
      position: 'right',
      locale: 'ar',
      type: 'standard',
      launcherTitle: 'تحدث معنا مباشرة',
    },
    window.chatwootConfig.settings || {}
  );

  /**
   * Sync authenticated user data with Chatwoot so support agents
   * see the client's name, email, and phone number directly.
   */
  function syncUserWithChatwoot() {
    try {
      if (!window.$chatwoot || typeof window.$chatwoot.setUser !== 'function') return;
      const rawUser = localStorage.getItem('ruqyah_user');
      if (rawUser) {
        const user = JSON.parse(rawUser);
        if (user && (user.id || user.email)) {
          window.$chatwoot.setUser(String(user.id || user.email), {
            name: user.name || undefined,
            email: user.email || undefined,
            phone_number: user.phone || undefined,
          });
        }
      }
    } catch (e) {
      console.warn('[Chatwoot] Could not sync user profile:', e);
    }
  }

  function initChatwoot() {
    const d = document;
    const t = 'script';
    const g = d.createElement(t);
    const s = d.getElementsByTagName(t)[0];
    g.src = BASE_URL + '/packs/js/sdk.js';
    g.defer = true;
    g.async = true;
    if (s && s.parentNode) {
      s.parentNode.insertBefore(g, s);
    } else {
      (d.head || d.body).appendChild(g);
    }

    g.onload = function () {
      if (window.chatwootSDK && typeof window.chatwootSDK.run === 'function') {
        window.chatwootSDK.run({
          websiteToken: WEBSITE_TOKEN,
          baseUrl: BASE_URL,
        });

        // Automatically identify user if already logged in
        window.addEventListener('chatwoot:ready', function () {
          syncUserWithChatwoot();
        });
      }
    };
  }

  // Execute initialization
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    initChatwoot();
  } else {
    document.addEventListener('DOMContentLoaded', initChatwoot);
  }

  // Expose global sync & reset helpers
  window.resetChatwoot = function () {
    if (window.$chatwoot && typeof window.$chatwoot.reset === 'function') {
      window.$chatwoot.reset();
    }
  };

  window.syncChatwootUser = syncUserWithChatwoot;
})();
