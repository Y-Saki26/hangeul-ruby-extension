(function () {
  "use strict";

  /**
   * Matches modern Hangul syllables and Jamo code blocks.
   *
   * Covered ranges:
   * - U+AC00-U+D7A3: precomposed modern Hangul syllables, e.g. 한
   * - U+1100-U+11FF: conjoining Hangul Jamo, e.g. 한
   * - U+3130-U+318F: Hangul Compatibility Jamo, e.g. ㅎㅏㄴ
   * - U+A960-U+A97F / U+D7B0-U+D7FF: extended Jamo blocks
   */
  const HANGEUL_PATTERN = /[\uac00-\ud7a3\u1100-\u11ff\u3130-\u318f\ua960-\ua97f\ud7b0-\ud7ff]+/g;
  const DEFAULT_SETTINGS = {
    enabled: true,
    showMode: "always"
  };
  const HTML_NAMESPACE = "http://www.w3.org/1999/xhtml";
  const SKIP_TAGS = new Set([
    "SCRIPT",
    "STYLE",
    "TEXTAREA",
    "INPUT",
    "SELECT",
    "OPTION",
    "CODE",
    "PRE",
    "KBD",
    "SAMP",
    "RUBY",
    "RT",
    "RP"
  ]);

  let settings = { ...DEFAULT_SETTINGS };
  let observer = null;
  let processing = false;

  /**
   * Returns the extension storage area available in the current browser.
   *
   * Content scripts normally have `chrome.storage`, but this fallback keeps the
   * script easier to smoke-test from a plain HTML page where the extension APIs
   * are not present.
   *
   * @returns {chrome.storage.StorageArea|null} Storage area, or null outside an extension context.
   */
  function getChromeStorage() {
    if (typeof chrome === "undefined" || !chrome.storage) {
      return null;
    }
    return chrome.storage.sync || chrome.storage.local;
  }

  /**
   * Loads persisted popup settings and merges them with defaults.
   *
   * @returns {Promise<{enabled: boolean, showMode: string}>} Active extension settings.
   */
  function loadSettings() {
    const storage = getChromeStorage();
    if (!storage) {
      return Promise.resolve({ ...DEFAULT_SETTINGS });
    }

    return new Promise((resolve) => {
      storage.get(DEFAULT_SETTINGS, (storedSettings) => {
        resolve({ ...DEFAULT_SETTINGS, ...storedSettings });
      });
    });
  }

  /**
   * Checks whether an element should be excluded from ruby injection.
   *
   * The extension only rewrites text nodes. Still, skipping these parent
   * elements avoids damaging editable fields, code examples, existing ruby
   * markup, and elements already created by this extension.
   *
   * @param {Element|null} element Candidate parent element.
   * @returns {boolean} True when this element or its descendants should be skipped.
   */
  function isSkippableElement(element) {
    if (!element || element.nodeType !== Node.ELEMENT_NODE) {
      return false;
    }

    return (
      element.namespaceURI !== HTML_NAMESPACE ||
      SKIP_TAGS.has(element.tagName) ||
      element.isContentEditable ||
      element.closest("ruby, [data-hangeul-ruby='processed']")
    );
  }

  /**
   * Decides whether a text node contains Hangul and is safe to replace.
   *
   * `HANGEUL_PATTERN` is global, so `lastIndex` is reset after each `test`.
   * Without that reset, repeated calls could miss matches depending on the
   * previous regex cursor position.
   *
   * @param {Text} node Text node discovered by TreeWalker or MutationObserver.
   * @returns {boolean} True when the node should be transformed.
   */
  function shouldProcessTextNode(node) {
    if (!settings.enabled || !node.nodeValue || !HANGEUL_PATTERN.test(node.nodeValue)) {
      HANGEUL_PATTERN.lastIndex = 0;
      return false;
    }

    HANGEUL_PATTERN.lastIndex = 0;
    return !isSkippableElement(node.parentElement);
  }

  /**
   * Builds one ruby annotation for a matched Hangul run.
   *
   * @param {string} text Hangul text matched in the original text node.
   * @returns {HTMLElement} A `<ruby>` element containing the source text and romanized `<rt>`.
   */
  function createRuby(text) {
    const ruby = document.createElement("ruby");
    ruby.dataset.hangeulRuby = "processed";
    ruby.className = "hangeul-ruby";

    const rbText = document.createTextNode(text);
    const rt = document.createElement("rt");
    rt.textContent = window.HangeulRubyRomanizer.romanize(text);

    ruby.append(rbText, rt);
    return ruby;
  }

  /**
   * Replaces a text node with a fragment that preserves non-Hangul text and
   * wraps each Hangul run in ruby markup.
   *
   * Using a DocumentFragment keeps the replacement local to the single text
   * node instead of rewriting `innerHTML`, which would remove event listeners
   * and can disturb page-owned DOM state.
   *
   * @param {Text} node Text node to replace.
   */
  function replaceTextNode(node) {
    const text = node.nodeValue;
    const fragment = document.createDocumentFragment();
    let lastIndex = 0;

    HANGEUL_PATTERN.lastIndex = 0;

    for (const match of text.matchAll(HANGEUL_PATTERN)) {
      if (match.index > lastIndex) {
        fragment.append(document.createTextNode(text.slice(lastIndex, match.index)));
      }

      fragment.append(createRuby(match[0]));
      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < text.length) {
      fragment.append(document.createTextNode(text.slice(lastIndex)));
    }

    node.parentNode.replaceChild(fragment, node);
  }

  /**
   * Processes a DOM subtree, document, or single text node.
   *
   * Text nodes are handled directly so MutationObserver additions can be passed
   * in without wrapping. Element/document roots are scanned with TreeWalker so
   * only text nodes are collected before replacement.
   *
   * @param {Node} root Root node to scan for Hangul text.
   */
  function processRoot(root) {
    if (!settings.enabled || !window.HangeulRubyRomanizer) {
      return;
    }

    if (root.nodeType === Node.TEXT_NODE) {
      if (shouldProcessTextNode(root)) {
        replaceTextNode(root);
      }
      return;
    }

    if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_NODE) {
      return;
    }

    if (root.nodeType === Node.ELEMENT_NODE && isSkippableElement(root)) {
      return;
    }

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        return shouldProcessTextNode(node)
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_REJECT;
      }
    });

    const nodes = [];
    while (walker.nextNode()) {
      nodes.push(walker.currentNode);
    }

    for (const node of nodes) {
      replaceTextNode(node);
    }
  }

  /**
   * Mirrors popup display settings onto the root element for CSS selectors.
   */
  function updateShowMode() {
    document.documentElement.dataset.hangeulRubyShowMode = settings.showMode;
  }

  /**
   * Removes annotations created by this extension and restores plain text.
   *
   * This is used when the user disables the extension from the popup. Existing
   * page-authored ruby tags are not touched because only nodes carrying our
   * `data-hangeul-ruby` marker are selected.
   */
  function removeRubyAnnotations() {
    const rubies = document.querySelectorAll("ruby[data-hangeul-ruby='processed']");
    for (const ruby of rubies) {
      const parent = ruby.parentNode;
      ruby.replaceWith(document.createTextNode(ruby.firstChild ? ruby.firstChild.textContent : ""));
      if (parent) {
        parent.normalize();
      }
    }
  }

  /**
   * Watches for dynamically inserted content and annotates new nodes.
   *
   * Many article and social sites append content after initial page load. The
   * observer only processes added nodes and uses a microtask to batch mutations
   * delivered in the same callback.
   */
  function startObserver() {
    if (observer) {
      observer.disconnect();
    }

    observer = new MutationObserver((mutations) => {
      if (processing || !settings.enabled) {
        return;
      }

      processing = true;
      queueMicrotask(() => {
        for (const mutation of mutations) {
          for (const node of mutation.addedNodes) {
            processRoot(node);
          }
        }
        processing = false;
      });
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  }

  /**
   * Reloads settings after popup changes and applies the visible effect.
   *
   * Disabling removes generated ruby markup. Re-enabling scans the current page
   * body again because the previous annotations were intentionally removed.
   */
  async function applySettings() {
    const previousEnabled = settings.enabled;
    settings = await loadSettings();
    updateShowMode();

    if (!settings.enabled) {
      removeRubyAnnotations();
      return;
    }

    if (!previousEnabled) {
      processRoot(document.body);
    }
  }

  /**
   * Entry point for the content script.
   *
   * Initial settings are loaded before scanning so the page is not modified when
   * the extension is disabled. Storage change listeners keep already-open tabs
   * in sync with popup changes.
   */
  async function init() {
    settings = await loadSettings();
    updateShowMode();
    processRoot(document.body);
    startObserver();

    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName !== "sync" && areaName !== "local") {
          return;
        }

        if (changes.enabled || changes.showMode) {
          applySettings();
        }
      });
    }
  }

  init();
})();
