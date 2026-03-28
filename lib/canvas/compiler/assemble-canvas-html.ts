import { VIEWPORT_FIT_CSS } from '@/lib/canvas/inject-viewport-fit'
import type { CanvasMetaJson } from '@/lib/types/canvas'

// ── Locked CSP ──────────────────────────────────────────────────────

const CANVAS_CSP =
  "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: https: blob:; font-src data: https: blob:; media-src data: https: blob:; connect-src https:; object-src 'none'; base-uri 'none'; frame-src 'none'; form-action 'none'; navigate-to 'none'"

// ── Bootstrap script ────────────────────────────────────────────────

function buildBootstrapScript(opts: {
  artifactId: string
  revisionId: string
  nonce: string
}): string {
  return `
;(function() {
  var CHANNEL = 'canvas-preview';
  var artifactId = ${JSON.stringify(opts.artifactId)};
  var revisionId = ${JSON.stringify(opts.revisionId)};
  var nonce = ${JSON.stringify(opts.nonce)};
  var parentOrigin = (function() {
    try {
      return document.referrer ? new URL(document.referrer).origin : null;
    } catch (_err) {
      return null;
    }
  })();
  window.__CANVAS_IMAGE_BASE__ = '';

  function getParentOrigin() {
    return parentOrigin;
  }

  function postToHost(type, payload) {
    if (!window.parent || window.parent === window) return;
    var targetOrigin = getParentOrigin();
    if (!targetOrigin) return;
    window.parent.postMessage({
      channel: CHANNEL,
      type: type,
      artifactId: artifactId,
      revisionId: revisionId,
      nonce: nonce,
      payload: payload || null
    }, targetOrigin);
  }

  function getDocumentHeight() {
    var body = document.body;
    var doc = document.documentElement;
    return Math.max(
      body ? body.scrollHeight : 0,
      body ? body.offsetHeight : 0,
      doc ? doc.clientHeight : 0,
      doc ? doc.scrollHeight : 0,
      doc ? doc.offsetHeight : 0
    );
  }

  function postHeightChange() {
    var height = getDocumentHeight();
    if (height > 0) {
      postToHost('height-change', { height: height });
    }
  }

  // Runtime error handler
  window.addEventListener('error', function(event) {
    // Check if it's an asset load error (img, link, script)
    var target = event.target;
    if (target && (target.tagName === 'IMG' || target.tagName === 'LINK' || target.tagName === 'SCRIPT')) {
      postToHost('asset-error', {
        tagName: target.tagName.toLowerCase(),
        src: target.src || target.href || '',
        message: 'Failed to load ' + target.tagName.toLowerCase() + ': ' + (target.src || target.href || 'unknown')
      });
      return;
    }

    postToHost('runtime-error', {
      message: event.message || 'Unknown error',
      filename: event.filename || '',
      lineno: event.lineno || 0,
      colno: event.colno || 0,
      stack: event.error && event.error.stack ? event.error.stack : ''
    });
  }, true);

  // Unhandled promise rejection handler
  window.addEventListener('unhandledrejection', function(event) {
    var reason = event.reason;
    postToHost('unhandled-rejection', {
      message: reason && reason.message ? reason.message : String(reason),
      stack: reason && reason.stack ? reason.stack : ''
    });
  });

  // Intercept fetch to report external request errors
  var originalFetch = window.fetch;
  window.fetch = function() {
    return originalFetch.apply(this, arguments).catch(function(err) {
      postToHost('external-request-error', {
        url: arguments[0] && typeof arguments[0] === 'string' ? arguments[0] : (arguments[0] && arguments[0].url ? arguments[0].url : ''),
        message: err.message || 'Fetch failed'
      });
      throw err;
    });
  };

  // Listen for init message from host — adopt authoritative values
  window.addEventListener('message', function(event) {
    if (event.source !== window.parent) return;
    var data = event.data;
    if (!data || data.channel !== CHANNEL) return;
    if (data.type === 'init' && data.artifactId === artifactId) {
      if (data.revisionId) revisionId = data.revisionId;
      if (data.nonce) nonce = data.nonce;
      if (typeof data.parentOrigin === 'string' && data.parentOrigin.length > 0) {
        parentOrigin = data.parentOrigin;
        window.__CANVAS_IMAGE_BASE__ =
          (parentOrigin.endsWith('/') ? parentOrigin.slice(0, -1) : parentOrigin) +
          '/api/canvas-assets/image-proxy';
      }
    }
  });

  // Mount React app
  try {
    var React = __CANVAS_REACT__;
    var ReactDOM = __CANVAS_REACT_DOM__;
    var App = __CANVAS_APP__.default || __CANVAS_APP__;
    var root = ReactDOM.createRoot(document.getElementById('root'));
    root.render(React.createElement(App));

    if (typeof ResizeObserver === 'function') {
      var resizeObserver = new ResizeObserver(function() {
        postHeightChange();
      });
      if (document.body) {
        resizeObserver.observe(document.body);
      }
      if (document.documentElement) {
        resizeObserver.observe(document.documentElement);
      }
    }

    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(function() {
        postHeightChange();
      });
    } else {
      postHeightChange();
    }

    // Signal ready
    postToHost('preview-ready', null);
  } catch (err) {
    postToHost('runtime-error', {
      message: err.message || 'Failed to mount React app',
      stack: err.stack || ''
    });
  }
})();`
}

// ── Asset inlining ──────────────────────────────────────────────────

function buildAssetScript(
  assets: NonNullable<CanvasMetaJson['assets']>
): string {
  const entries = Object.entries(assets)
  if (entries.length === 0) return ''

  // Create a global asset map accessible from the app
  const assetMap = entries.map(
    ([key, val]) => `${JSON.stringify(key)}: ${JSON.stringify(val.data)}`
  )

  return `\nwindow.__CANVAS_ASSETS__ = {${assetMap.join(',')}};\n`
}

// ── HTML assembly ───────────────────────────────────────────────────

export type AssembleCanvasHtmlOptions = {
  js: string
  css: string
  meta?: CanvasMetaJson
  artifactId?: string
  revisionId?: string
  nonce?: string
}

export function assembleCanvasHtml(opts: AssembleCanvasHtmlOptions): string {
  const {
    js,
    css,
    meta,
    artifactId = 'unknown',
    revisionId = 'unknown',
    nonce = 'unknown'
  } = opts

  const viewport = meta?.viewport ?? 'width=device-width, initial-scale=1'
  const title = meta?.title ?? 'Canvas Artifact'

  const assetScript = meta?.assets ? buildAssetScript(meta.assets) : ''

  const bootstrap = buildBootstrapScript({ artifactId, revisionId, nonce })
  const safeViewport = escapeHtml(viewport)
  const safeCss = escapeStyleContent(css)

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="${safeViewport}">
<meta http-equiv="Content-Security-Policy" content="${CANVAS_CSP}">
<title>${escapeHtml(title)}</title>
<style>${VIEWPORT_FIT_CSS}</style>
<style>${safeCss}</style>
</head>
<body>
<div id="root"></div>
<script>${assetScript}${js}${bootstrap}</script>
</body>
</html>`
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function escapeStyleContent(str: string): string {
  return str.replace(/<\/style/gi, '<\\/style')
}
