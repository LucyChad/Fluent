/* Fluent — cookie consent banner (Google Consent Mode v2).
   GA4 defaults to denied (set inline in <head>); analytics cookies only
   fire once the visitor accepts. Choice is remembered in localStorage. */
(function () {
  var KEY = 'fluent_consent';          // 'granted' | 'denied'
  var g = function () { (window.dataLayer = window.dataLayer || []).push(arguments); };

  function apply(state) {
    g('consent', 'update', {
      analytics_storage: state === 'granted' ? 'granted' : 'denied'
    });
  }

  function store(state) {
    try { localStorage.setItem(KEY, state); } catch (e) {}
    apply(state);
  }

  function stored() {
    try { return localStorage.getItem(KEY); } catch (e) { return null; }
  }

  function injectStyles() {
    if (document.getElementById('fluent-consent-style')) return;
    var css = ''
      + '.fc-banner{position:fixed;left:16px;right:16px;bottom:16px;z-index:9999;'
      + 'max-width:520px;margin:0 auto;background:#0B1322;color:#F5E8D8;'
      + 'border:1px solid rgba(245,224,208,0.14);border-radius:18px;'
      + 'padding:22px 24px;box-shadow:0 18px 50px rgba(0,0,0,0.45);'
      + 'font-family:"DM Sans",system-ui,sans-serif;font-size:14.5px;line-height:1.6;'
      + 'transform:translateY(140%);transition:transform .45s cubic-bezier(.2,.8,.2,1);}'
      + '.fc-banner.fc-show{transform:translateY(0);}'
      + '.fc-banner h4{font-family:"Playfair Display",Georgia,serif;font-style:italic;'
      + 'font-weight:600;font-size:18px;margin:0 0 6px;color:#F5E8D8;letter-spacing:-0.01em;}'
      + '.fc-banner p{margin:0 0 16px;color:rgba(245,224,208,0.72);}'
      + '.fc-banner a{color:#E58A5E;text-decoration:underline;text-underline-offset:2px;}'
      + '.fc-actions{display:flex;gap:10px;flex-wrap:wrap;}'
      + '.fc-btn{font-family:"DM Sans",system-ui,sans-serif;font-weight:600;font-size:14px;'
      + 'border:0;cursor:pointer;padding:11px 22px;border-radius:999px;transition:transform .15s ease,opacity .15s ease;}'
      + '.fc-btn:hover{transform:translateY(-1px);}'
      + '.fc-accept{background:linear-gradient(105deg,#E58A5E,#E8B4C4 60%,#C8B5E0);color:#0B1322;}'
      + '.fc-reject{background:transparent;color:#F5E8D8;border:1px solid rgba(245,224,208,0.22);}'
      + '.fc-reject:hover{border-color:#E58A5E;color:#E58A5E;}'
      + '@media(max-width:520px){.fc-banner{left:10px;right:10px;bottom:10px;padding:20px;}'
      + '.fc-btn{flex:1 1 auto;}}';
    var st = document.createElement('style');
    st.id = 'fluent-consent-style';
    st.textContent = css;
    document.head.appendChild(st);
  }

  function build() {
    injectStyles();
    var b = document.createElement('div');
    b.className = 'fc-banner';
    b.setAttribute('role', 'dialog');
    b.setAttribute('aria-live', 'polite');
    b.setAttribute('aria-label', 'Cookie consent');
    b.innerHTML =
      '<h4>A quick word on cookies.</h4>' +
      '<p>We use essential cookies to make the site and checkout work. We’d also like to use ' +
      'Google Analytics to see what’s useful, but only if you’re happy with that. ' +
      'More in our <a href="/privacy.html">privacy policy</a>.</p>' +
      '<div class="fc-actions">' +
        '<button class="fc-btn fc-accept" type="button">Accept analytics</button>' +
        '<button class="fc-btn fc-reject" type="button">Essential only</button>' +
      '</div>';
    document.body.appendChild(b);
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { b.classList.add('fc-show'); });
    });

    function close(state) {
      store(state);
      b.classList.remove('fc-show');
      setTimeout(function () { if (b.parentNode) b.parentNode.removeChild(b); }, 480);
    }
    b.querySelector('.fc-accept').addEventListener('click', function () { close('granted'); });
    b.querySelector('.fc-reject').addEventListener('click', function () { close('denied'); });
  }

  // Re-open hook for a "Cookie settings" link anywhere: href="#cookie-settings"
  document.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest('[href="#cookie-settings"]');
    if (t) { e.preventDefault(); if (!document.querySelector('.fc-banner')) build(); }
  });

  function start() {
    var choice = stored();
    if (choice === 'granted') { apply('granted'); return; }   // honour returning visitor
    if (choice === 'denied') { apply('denied'); return; }
    build();                                                   // no choice yet → ask
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else { start(); }
})();
