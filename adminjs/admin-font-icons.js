/*
 * Convert decorative inline SVGs and symbol-only icon labels to the same
 * self-contained STOVE icon font used by the public FPPatch V2 site.
 * The dashboard's data chart and Google's multicolor brand mark stay SVG.
 */
(function () {
  'use strict';

  const iconRules = [
    // Decimal points in SVG path data are intentionally wildcarded here so
    // these rules stay simple while still matching the same path signature.
    [/^6 9 12 15 18 9$/, 'ic-v2-control-select-arrow-down-fill'],
    [/^M9 12l2 2 4-4m5.618/, 'ic-v2-control-check-circle-line'],
    [/^M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9/, 'ic-v2-control-refresh-line'],
    [/^M21 21l-4.35-4.35M11 8v6m-3-3h6/, 'ic-v2-control-enlarge-line'],
    [/^M21 21l-4.35-4.35M8 11h6/, 'ic-v2-control-minimize-line'],
    [/^M16 7a4 4 0 11-8 0/, 'ic-v2-navigation-profile-line'],
    [/^M10.325 4.317c.426-1.756/, 'ic-v2-navigation-setting-line'],
    [/^M20.5 15.5A8.5 8.5/, 'ic-v2-control-theme-dark-fill'],
    [/^M12 2v2m0 16v2m10-10h-2/, 'ic-v2-control-theme-light-fill'],
    [/^M4 16l4.586-4.586/, 'ic-v2-community-attach-image-line'],
    [/^M17 20h5v-2a3 3 0 00-5.356-1.857/, 'ic-v2-community-group-line'],
    [/^M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2/, 'ic-v2-object-coin-line'],
    [/^M8 10h8M8 14h5m7-2a[89] [89] 0 11-/, 'ic-v2-object-report-line'],
    [/^M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l4-4/, 'ic-v2-object-upload-line'],
    [/^M15.172 7l-6.586/, 'ic-v2-community-attach-file-line'],
    [/^M11 5H6a2 2 0 00-2 2v11/, 'ic-v2-community-write-line'],
    [/^M3.5 8.25 5.75 3.5/, 'ic-v2-navigation-store-line'],
    [/^M12 16v-4m0-4h.01/, 'ic-v2-object-help-center-line'],
    [/^M11 5.882V19.24/, 'ic-v2-navigation-message-line'],
    [/^M3.5 8.25 5.75 3.5 12.5/, 'ic-v2-object-graph-line'],
    [/^M15.232 5.232l3.536 3.536/, 'ic-v2-object-pen-line'],
    [/^M19 7l-.867 12.142/, 'ic-v2-object-delete-line'],
    [/^M3 9a2 2 0 012-2h.93/, 'ic-v2-community-attach-image-line'],
    [/^M12 9v2m0 4h.01M10.29 3.86/, 'ic-v2-object-help-center-line'],
    [/^M13 16h-1v-4h-1m1-4h.01/, 'ic-v2-object-help-center-line'],
    [/^M21 21l-4.35-4.35M11 8v6/, 'ic-v2-control-enlarge-line'],
    [/^M19 9l-7 7-7-7$/, 'ic-v2-control-select-arrow-down-fill'],
    [/^M15 19l-7-7 7-7$/, 'ic-v2-control-arrow-left-line'],
    [/^M9 5l7 7-7 7$/, 'ic-v2-control-arrow-right-line'],
    [/^M9 12l2 2 4-4m5\\.618/, 'ic-v2-control-check-circle-line'],
    [/^M5 13l4 4L19 7$/, 'ic-v2-control-check-line'],
    [/^M6 18L18 6M6 6l12 12$/, 'ic-v2-control-close-line'],
    [/^M12 4v16m8-8H4$/, 'ic-v2-control-add-line'],
    [/^M4 4v5h\\.582m15\\.356 2A8\\.001 8\\.001 0 004\\.582 9/, 'ic-v2-control-refresh-line'],
    [/^M21 21l-6-6m2-5a7 7 0 11-14 0/, 'ic-v2-navigation-search-line'],
    [/^M21 21l-4\\.35-4\\.35M11 8v6/, 'ic-v2-control-enlarge-line'],
    [/^M21 21l-4\\.35-4\\.35M8 11h6/, 'ic-v2-control-minimize-line'],
    [/^M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4/, 'ic-v2-object-upload-line'],
    [/^M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4/, 'ic-v2-object-download-line'],
    [/^M16 7a4 4 0 11-8 0zM12 14a7 7 0 00-7 7h14/, 'ic-v2-navigation-profile-line'],
    [/^M10\\.325 4\\.317c\\.426-1\\.756/, 'ic-v2-navigation-setting-line'],
    [/^M18 8a6 6 0 00-12 0c0 7-3 7-3 9/, 'ic-v2-navigation-alarm-line'],
    [/^M12 3v1m0 16v1m9-9h-1/, 'ic-v2-control-theme-light-fill'],
    [/^M20\\.5 15\\.5A8\\.5 8\\.5/, 'ic-v2-control-theme-dark-fill'],
    [/^M12 3v18a9 9 0 000-18z/, 'ic-v2-control-theme-device-fill'],
    [/^M17 16l4-4m0 0l-4-4m4 4H7/, 'ic-v2-navigation-logout-line'],
    [/^m3 10 9-7 9 7v10/, 'ic-v2-navigation-home-line'],
    [/^M14 3h7v7m-1-6L10 14/, 'ic-v2-control-web-link-line'],
    [/^M4 6h16M4 10h16M4 14h16M4 18h16$/, 'ic-v2-community-board-line'],
    [/^M4 16l4\\.586-4\\.586/, 'ic-v2-community-attach-image-line'],
    [/^M17 20h5v-2a3 3 0 00-5\\.356-1\\.857/, 'ic-v2-community-group-line'],
    [/^M12 8c-1\\.657 0-3 \\.895-3 2s1\\.343 2 3 2/, 'ic-v2-object-coin-line'],
    [/^M13 10V3L4 14h7v7l9-11/, 'ic-v2-object-fire-line'],
    [/^M9 12h6m-6 4h6m2 5H7/, 'ic-v2-object-notice-line'],
    [/^M8 10h8M8 14h5m7-2a9 9 0 11-18 0z/, 'ic-v2-object-report-line'],
    [/^M8 7V3m8 4V3M4 10h16/, 'ic-v2-community-calendar-line'],
    [/^M11 5\\.882V19\\.24/, 'ic-v2-navigation-message-line'],
    [/^M18 8a6 6 0 00-12 0v4a6 6 0 0012 0/, 'ic-v2-object-help-center-line'],
    [/^M3\\.5 8\\.25 5\\.75 3\\.5 12\\.5/, 'ic-v2-object-graph-line'],
    [/^M15\\.232 5\\.232l3\\.536 3\\.536/, 'ic-v2-object-pen-line'],
    [/^M19 7l-\\.867 12\\.142/, 'ic-v2-object-delete-line'],
    [/^M8 16H6a2 2 0 01-2-2V6/, 'ic-v2-community-copy-line'],
    [/^M10 6H6a2 2 0 00-2 2v10/, 'ic-v2-community-share-line'],
    [/^M3 9a2 2 0 012-2h\\.93/, 'ic-v2-community-attach-image-line'],
    [/^M12 9v2m0 4h\\.01M10\\.29 3\\.86/, 'ic-v2-object-help-center-line'],
    [/^M13 16h-1v-4h-1m1-4h\\.01/, 'ic-v2-object-help-center-line'],
    [/^M3 10h10a8 8 0 018 8v2/, 'ic-v2-control-undo-line'],
    [/^M21 10H11a8 8 0 00-8 8v2/, 'ic-v2-control-redo-line'],
    [/^M8 3H5a2 2 0 00-2 2v14/, 'ic-v2-community-view-split1-fill'],
    [/^M21 21l-4\\.35-4\\.35M11 8v6m-3-3h6/, 'ic-v2-control-zoom-in-line'],
    [/^M21 21l-4\\.35-4\\.35M8 11h6/, 'ic-v2-control-zoom-out-line'],
    [/^M12 8v4l3 3m6-3a9 9 0 11-18 0/, 'ic-v2-object-clock-line'],
    [/^M9 12l2 2 4-4m5\\.618/, 'ic-v2-control-check-circle-line'],
    [/^M12 16v-4m0-4h\\.01/, 'ic-v2-object-help-center-line'],
  ];

  function svgPathSignature(svg) {
    return Array.from(svg.querySelectorAll('path, polyline, polygon'))
      .map((node) => node.getAttribute('d') || node.getAttribute('points') || '')
      .join(' ');
  }

  function replacementFor(svg) {
    if (!(svg instanceof SVGElement) || svg.id === 'dashboardVisitorChart' ||
        svg.closest('#dashboardVisitorChart')) return null;
    // Keep the multicolor Google mark intact; it is a trademark, not a UI icon.
    if (svg.querySelector('[fill]:not([fill="none"])')) return null;

    const signature = svgPathSignature(svg);
    const rule = iconRules.find(([pattern]) => pattern.test(signature));
    if (!rule) return null;

    const computed = window.getComputedStyle(svg);
    const icon = document.createElement('i');
    icon.className = `admin-font-icon ${rule[1]}`;
    icon.setAttribute('aria-hidden', svg.getAttribute('aria-hidden') || 'true');
    if (svg.getAttribute('aria-label')) icon.setAttribute('aria-label', svg.getAttribute('aria-label'));
    if (svg.classList.length) icon.classList.add(...Array.from(svg.classList));
    if (svg.title) icon.title = svg.title;

    const width = computed.width !== 'auto' ? computed.width : (svg.getAttribute('width') || '1em');
    const height = computed.height !== 'auto' ? computed.height : (svg.getAttribute('height') || width);
    icon.style.width = width;
    icon.style.height = height;
    icon.style.fontSize = computed.fontSize;
    icon.style.flexShrink = computed.flexShrink;
    icon.style.opacity = computed.opacity;
    return icon;
  }

  function replaceIcons(root) {
    if (root instanceof SVGElement) {
      const replacement = replacementFor(root);
      if (replacement) root.replaceWith(replacement);
      return;
    }
    if (!(root instanceof Element || root instanceof Document)) return;
    root.querySelectorAll('svg').forEach((svg) => {
      const replacement = replacementFor(svg);
      if (replacement) svg.replaceWith(replacement);
    });
  }

  const symbolIcons = {
    '✓': 'ic-v2-control-check-line',
    '✕': 'ic-v2-control-close-line',
    '×': 'ic-v2-control-close-line',
    '→': 'ic-v2-control-arrow-right-line',
    '★': 'ic-v2-community-star-fill',
    '✦': 'ic-v2-community-star-line',
  };

  function replaceSymbolCharacters(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) {
      if (/[✓✕×→★✦]/.test(walker.currentNode.nodeValue)) nodes.push(walker.currentNode);
    }
    nodes.forEach((textNode) => {
      const fragment = document.createDocumentFragment();
      textNode.nodeValue.split(/([✓✕×→★✦])/).forEach((piece) => {
        if (symbolIcons[piece]) {
          const icon = document.createElement('i');
          icon.className = `admin-font-icon ${symbolIcons[piece]}`;
          icon.setAttribute('aria-hidden', 'true');
          fragment.appendChild(icon);
        } else if (piece) {
          fragment.appendChild(document.createTextNode(piece));
        }
      });
      textNode.replaceWith(fragment);
    });
  }

  function upgrade(root) {
    replaceIcons(root);
    if (root instanceof Element || root instanceof Document) replaceSymbolCharacters(root);
  }

  upgrade(document.body);
  new MutationObserver((records) => {
    records.forEach((record) => {
      record.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) upgrade(node);
        else if (node.nodeType === Node.TEXT_NODE && /[✓✕×→★✦]/.test(node.nodeValue)) {
          const fragment = document.createDocumentFragment();
          node.nodeValue.split(/([✓✕×→★✦])/).forEach((piece) => {
            if (symbolIcons[piece]) {
              const icon = document.createElement('i');
              icon.className = `admin-font-icon ${symbolIcons[piece]}`;
              icon.setAttribute('aria-hidden', 'true');
              fragment.appendChild(icon);
            } else if (piece) {
              fragment.appendChild(document.createTextNode(piece));
            }
          });
          node.replaceWith(fragment);
        }
      });
    });
  }).observe(document.body, { childList: true, subtree: true });
})();
