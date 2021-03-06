/**
 * Background javascript that runs once when the extension is initially
 * loaded and has access to a persistent background page.
 *
 * We just register an onBeforeRequest listener that checks the URL of each
 * request to any of the supported Amazon targets and redirects triggers
 * an internal redirect to the equivalent smile URL if needed.
 */

(function(browser) {
  // Using the 'browser' global and the FF promise-style API, which needs
  // the mozilla browser polyfill to work under Chrome.

  /* Base regex (scheme plus hostname) for URLs to be checked. */
  const BASE_URL = "https?://(www\\.)?amazon\.(com|co\\.uk|de)";

  /* Path (regex strings) that should not trigger a smile redirect. */
  const EXCLUSIONS = [
    '/ap/signin',
    '/exec/obidos/account-access-login',
    '/exec/obidos/change-style',
    '/exec/obidos/dt/assoc/handle-buy-box',
    '/exec/obidos/flex-sign-in',
    '/exec/obidos/handle-buy-box',
    '/exec/obidos/refer-a-friend-login',
    '/exec/obidos/subst/associates/join',
    '/exec/obidos/subst/marketplace/sell-your-stuff\\.html',
    '/forum/kindle',
    '/gp/[^/]+/settings',
    '/gp/aag',
    '/gp/aw/so\\.html',
    '/gp/aw/sp\\.html',
    '/gp/customer-reviews/write-a-review\\.html',
    '/gp/flex/sign-out\\.html',
    '/gp/navigation-country',
    '/gp/navigation/redirector\\.html',
    '/gp/rate-it',
    '/gp/redirect\\.html',
    '/gp/rentallist',
    '/gp/sign-in',
    '/gp/socialmedia/giveaways',
    '/gp/switch-language',
    '/gp/video/library',
    '/gp/video/watchlist',
    '/gp/wishlist/universal',
    '/gp/yourstore',
    '/myh/manage',
    '/local/ajax/',
    '/wishlist/get-button',
    '/wishlist/universal'
  ];

  /* Regex object for full URL, with negative lookaheads for exclusions. */
  const SMILE_URL_REGEX = new RegExp(BASE_URL + EXCLUSIONS.map(str => '(?!' + str + ')').join(''));


  /* map from tabId to whether that tab is incognito. */
  let tabState = {};

  /* Get incognito state for all existing tabs: */
  browser.tabs.query({}).then(function(results) {
    results.forEach(function(tab) {
      tabState[tab.id] = tab.incognito;
    });
  });

  /* Update cognito state on tab change: */
  browser.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
    tabState[tab.id] = tab.incognito;
  });
  /* Remove tab info on tab removal: */
  browser.tabs.onRemoved.addListener(function(tabId) { delete tabState[tabId]; });

  /* Request ID of last request we redirected for, used to avoid redirect loops. */
  let lastRequestId;

  /* Whether to disable in private mode, which can be updated through messaging: */
  let disableInPrivateMode = false;

  function beforeRequest(requestDetails) {
    if (!disableInPrivateMode || !tabState[requestDetails.tabId]) {
      const currentUrl = requestDetails.url,
        currentRequestId = requestDetails.requestId;

      if (currentRequestId !== lastRequestId) {
        const newUrl = currentUrl.replace(SMILE_URL_REGEX, "https://smile.amazon.$2");
        if (newUrl !== currentUrl) {
          lastRequestId = currentRequestId;
          return { redirectUrl: newUrl };
        }
      }
    }
  }

  browser.webRequest.onBeforeRequest.addListener(
    beforeRequest,
    {
      urls: [
        "*://amazon.com/*",
        "*://www.amazon.com/*",
        "*://amazon.co.uk/*",
        "*://www.amazon.co.uk/*",
        "*://amazon.de/*",
        "*://www.amazon.de/*"
      ],
      types: ["main_frame"]
    },
    ["blocking"]
  );

  browser.runtime.onMessage.addListener(function(message) {
    if (message) {
      disableInPrivateMode = message.disableInPrivateMode;
    }
  });

  browser.storage.local.get("disableInPrivateMode").then(function(item) {
    if (item) {
      disableInPrivateMode = !!item.disableInPrivateMode;
    }
  });

}(browser));
