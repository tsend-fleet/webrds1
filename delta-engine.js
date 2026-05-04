/* ==========================================================================
   DELTA ENGINE — ROADSIDE SERVICES EDITION (Maxwell)
   Single IIFE. Exposes window.DeltaEngine.
   ========================================================================== */
(function () {
  'use strict';

  // -------------------------------------------------------------------------
  // 1. CONSTANTS
  // -------------------------------------------------------------------------
  var ANIMATION_OPTIONS = [
    'fade-up','fade-down','fade-left','fade-right',
    'zoom-in','zoom-out',
    'flip-up','flip-down','flip-left','flip-right',
    'slide-up','slide-down',
    'scramble-reveal','stagger-fade','magnetic-pop','parallax-scroll'
  ];
  var GSAP_ANIM_KEYS = ['scramble-reveal','stagger-fade','magnetic-pop','parallax-scroll'];

  var THEME_TOKENS = ['bg','surface','surface-alt','surface-deep','surface-emphasis',
                      'text','text-muted','border','cta','cta-hover','accent','header-bg'];

  var DEFAULT_THEME = {
    dark: {
      'bg':'#0a1628','surface':'#1a2235','surface-alt':'#121c2e',
      'surface-deep':'#080e1a','surface-emphasis':'#1e2940',
      'text':'#f0eded','text-muted':'#8a9ab5','border':'#2a3650',
      'cta':'#e10600','cta-hover':'#930300','accent':'#ecc300',
      'header-bg':'#041a3f'
    },
    light: {
      'bg':'#fcf9f8','surface':'#ffffff','surface-alt':'#f6f3f2',
      'surface-deep':'#f0eded','surface-emphasis':'#eae7e7',
      'text':'#1c1b1b','text-muted':'#5e3f3a','border':'#936e68',
      'cta':'#b30400','cta-hover':'#e10600','accent':'#715c00',
      'header-bg':'#1a2235'
    },
    defaultMode: 'auto',
    showToggle: true
  };

  var IMG_PLACEHOLDER = 'data:image/svg+xml;utf8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400">' +
    '<rect width="600" height="400" fill="#cccccc"/>' +
    '<text x="50%" y="50%" font-family="Inter,sans-serif" font-size="24" fill="#666" text-anchor="middle" dominant-baseline="middle">No Image</text>' +
    '</svg>'
  );

  var STATE = { content: null };

  // -------------------------------------------------------------------------
  // 2. DOM UTILS
  // -------------------------------------------------------------------------
  function $(sel, root)    { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function escHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }

  // -------------------------------------------------------------------------
  // 3. TOAST
  // -------------------------------------------------------------------------
  function ensureToastHost() {
    var host = document.getElementById('delta-toast-host');
    if (host) return host;
    host = document.createElement('div');
    host.id = 'delta-toast-host';
    host.style.cssText = 'position:fixed;top:1rem;right:1rem;z-index:9999;display:flex;flex-direction:column;gap:.5rem;pointer-events:none;';
    document.body.appendChild(host);
    return host;
  }

  function toast(msg, kind) {
    var host = ensureToastHost();
    var el = document.createElement('div');
    var color = kind === 'success' ? '#059669' : kind === 'error' ? '#dc2626' : '#1e293b';
    el.style.cssText = 'background:'+color+';color:#fff;padding:.75rem 1rem;border-radius:.5rem;font:500 14px Inter,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.2);transform:translateX(1.5rem);opacity:0;transition:transform .3s,opacity .3s;pointer-events:auto;max-width:380px;';
    el.textContent = msg;
    host.appendChild(el);
    requestAnimationFrame(function () {
      el.style.transform = 'translateX(0)';
      el.style.opacity = '1';
    });
    setTimeout(function () {
      el.style.opacity = '0';
      el.style.transform = 'translateX(1.5rem)';
      setTimeout(function () { el.remove(); }, 300);
    }, 3500);
  }

  // -------------------------------------------------------------------------
  // 4. IMAGE / URL UTILS
  // -------------------------------------------------------------------------
  function normalizeImageUrl(url) {
    if (!url || !String(url).trim()) return IMG_PLACEHOLDER;
    var u = String(url).trim();
    if (/^(data:|blob:)/i.test(u)) return u;
    if (/^\/\//.test(u)) return 'https:' + u;
    var m = u.match(/drive\.google\.com\/file\/d\/([^/]+)/);
    if (m) return 'https://drive.google.com/uc?export=view&id=' + m[1];
    m = u.match(/[?&]id=([^&]+)/);
    if (m && /drive\.google\.com/.test(u)) return 'https://drive.google.com/uc?export=view&id=' + m[1];
    if (/dropbox\.com/.test(u)) {
      return u.replace('www.dropbox.com', 'dl.dropboxusercontent.com')
              .replace(/\?dl=0/, '?raw=1')
              .replace(/\?dl=1/, '?raw=1');
    }
    return u;
  }

  function imgTag(src, alt, classes) {
    var safeSrc = normalizeImageUrl(src);
    var safeAlt = escHtml(alt || '');
    var cls = 'w-full h-full object-cover object-center ' + (classes || '');
    return '<img src="' + escHtml(safeSrc) + '" alt="' + safeAlt + '" class="' + cls + '" loading="lazy" onerror="this.onerror=null;this.src=\'' + IMG_PLACEHOLDER + '\'">';
  }

  function buildMapEmbedSrc(address) {
    return 'https://www.google.com/maps?q=' + encodeURIComponent(address || '') + '&output=embed';
  }

  // -------------------------------------------------------------------------
  // 5. ENCODING UTILS
  // -------------------------------------------------------------------------
  function utf8ToBase64(str) {
    var bytes = new TextEncoder().encode(str);
    var binary = '';
    for (var i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  }
  function base64ToUtf8(b64) {
    var binary = atob(b64);
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  // -------------------------------------------------------------------------
  // 6. CONTENT I/O + GITHUB SYNC
  // -------------------------------------------------------------------------
  async function loadContent() {
    var ts = Date.now();
    try {
      var r = await fetch('content.json?ts=' + ts, { cache: 'no-store' });
      if (r.ok) { var j = await r.json(); STATE.content = j; return j; }
    } catch (e) { /* fall through */ }
    var repo = (localStorage.getItem('delta_repo_path') || '').trim();
    if (repo) {
      try {
        var r2 = await fetch('https://raw.githubusercontent.com/' + repo + '/main/content.json?ts=' + ts, { cache: 'no-store' });
        if (r2.ok) { var j2 = await r2.json(); STATE.content = j2; return j2; }
      } catch (e2) { /* fall through */ }
    }
    throw new Error('Failed to load content.json');
  }

  async function fetchShaWithToken(token, repoPath) {
    var url = 'https://api.github.com/repos/' + repoPath + '/contents/content.json';
    var r = await fetch(url, { headers: { Authorization: 'token ' + token, Accept: 'application/vnd.github+json' } });
    if (r.status === 404) return null;
    if (!r.ok) throw new Error('GitHub GET failed: ' + r.status);
    var j = await r.json();
    return j.sha;
  }

  async function commitContent(token, repoPath, data, message) {
    if (!token)    throw new Error('Missing GitHub token');
    if (!repoPath) throw new Error('Missing repo path (owner/repo)');
    var sha = await fetchShaWithToken(token, repoPath);
    var body = {
      message: message || 'Update content.json via Delta admin',
      content: utf8ToBase64(JSON.stringify(data, null, 2)),
      branch: 'main'
    };
    if (sha) body.sha = sha;
    var url = 'https://api.github.com/repos/' + repoPath + '/contents/content.json';
    var r = await fetch(url, {
      method: 'PUT',
      headers: { Authorization: 'token ' + token, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!r.ok) {
      var err;
      try { err = (await r.json()).message; } catch (e) { err = 'HTTP ' + r.status; }
      throw new Error('GitHub PUT failed: ' + err);
    }
    return r.json();
  }

  // -------------------------------------------------------------------------
  // 7. THEME SYSTEM
  // -------------------------------------------------------------------------
  function bootstrapTheme() {
    var m = localStorage.getItem('delta_theme_mode') || 'auto';
    if (m === 'auto') m = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    document.documentElement.classList.add(m === 'light' ? 'light' : 'dark');
  }

  function applyTheme(c) {
    var t = (c && c.theme) || DEFAULT_THEME;
    var dark = Object.assign({}, DEFAULT_THEME.dark, t.dark || {});
    var light = Object.assign({}, DEFAULT_THEME.light, t.light || {});
    var darkVars = THEME_TOKENS.map(function (k) { return '  --c-' + k + ':' + (dark[k] || DEFAULT_THEME.dark[k]) + ';'; }).join('\n');
    var lightVars = THEME_TOKENS.map(function (k) { return '  --c-' + k + ':' + (light[k] || DEFAULT_THEME.light[k]) + ';'; }).join('\n');
    var css = ':root, html.dark {\n' + darkVars + '\n}\nhtml.light {\n' + lightVars + '\n}\nhtml { transition: background-color .3s, color .3s; }';
    var tag = document.getElementById('delta-theme-vars');
    if (!tag) {
      tag = document.createElement('style');
      tag.id = 'delta-theme-vars';
      document.head.appendChild(tag);
    }
    tag.textContent = css;
    if (t.showToggle === false) {
      $all('[data-delta-trigger="theme-toggle"]').forEach(function (b) { b.style.display = 'none'; });
    }
    syncThemeIcons();
  }

  function syncThemeIcons() {
    var mode = getThemeMode();
    $all('[data-delta-theme-icon]').forEach(function (el) {
      el.style.display = el.getAttribute('data-delta-theme-icon') === mode ? '' : 'none';
    });
  }

  function setThemeMode(mode) {
    var html = document.documentElement;
    html.classList.remove('dark','light');
    html.classList.add(mode === 'light' ? 'light' : 'dark');
    localStorage.setItem('delta_theme_mode', mode);
    syncThemeIcons();
  }

  function getThemeMode() {
    return document.documentElement.classList.contains('light') ? 'light' : 'dark';
  }

  function bindThemeToggle() {
    $all('[data-delta-trigger="theme-toggle"]').forEach(function (btn) {
      if (btn.dataset.themeBound) return;
      btn.dataset.themeBound = '1';
      btn.addEventListener('click', function () {
        setThemeMode(getThemeMode() === 'dark' ? 'light' : 'dark');
      });
    });
  }

  // -------------------------------------------------------------------------
  // 8. SEO + JSON-LD INJECTION
  // -------------------------------------------------------------------------
  function setMeta(name, value) {
    if (!value) return;
    var el = document.querySelector('meta[name="' + name + '"]');
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute('name', name);
      document.head.appendChild(el);
    }
    el.setAttribute('content', value);
  }

  function setOG(prop, value) {
    if (!value) return;
    var el = document.querySelector('meta[property="' + prop + '"]');
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute('property', prop);
      document.head.appendChild(el);
    }
    el.setAttribute('content', value);
  }

  function injectSEO(c) {
    var s = c.seo || {};
    if (s.defaultTitle) document.title = s.defaultTitle;
    setMeta('description', s.defaultDescription || c.tagline || '');
    setMeta('keywords',    s.defaultKeywords || '');
    setMeta('geo.region',  s.geoRegion || '');
    setMeta('geo.placename', s.geoPlacename || '');
    if (s.geoLat && s.geoLng) {
      setMeta('geo.position', s.geoLat + ';' + s.geoLng);
      setMeta('ICBM',         s.geoLat + ', ' + s.geoLng);
    }
    setOG('og:title',       s.defaultTitle || c.brand);
    setOG('og:description', s.defaultDescription || c.tagline);
    setOG('og:type',        'website');
    if (s.canonicalBase) {
      setOG('og:url', s.canonicalBase + '/');
      var canonical = document.querySelector('link[rel="canonical"]');
      if (!canonical) { canonical = document.createElement('link'); canonical.rel = 'canonical'; document.head.appendChild(canonical); }
      canonical.href = s.canonicalBase + '/';
    }
    injectSchema(c);
  }

  function injectSchema(c) {
    var s = c.seo || {};
    var schema = {
      '@context': 'https://schema.org',
      '@type': ['AutoRepair','EmergencyService','LocalBusiness'],
      '@id':   (s.canonicalBase || '') + '/#org',
      'name':  c.brand,
      'telephone': s.phone || c.phone,
      'email': c.email,
      'priceRange': '$$',
      'address': {
        '@type': 'PostalAddress',
        'streetAddress':   c.address,
        'addressLocality': s.geoPlacename,
        'addressRegion':   (s.geoRegion || '').split('-').pop() || '',
        'addressCountry':  'US'
      },
      'geo': { '@type': 'GeoCoordinates', 'latitude': s.geoLat, 'longitude': s.geoLng },
      'openingHoursSpecification': [{
        '@type': 'OpeningHoursSpecification',
        'dayOfWeek': ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'],
        'opens': '00:00', 'closes': '23:59'
      }],
      'areaServed': (c.serviceAreas || []).map(function (a) {
        return { '@type': 'City', 'name': a.city };
      }),
      'hasOfferCatalog': {
        '@type': 'OfferCatalog',
        'name': 'Roadside & Mobile Mechanic Services',
        'itemListElement': (c.services || []).map(function (sv) {
          return { '@type': 'Offer', 'itemOffered': { '@type': 'Service', 'name': sv.title, 'description': sv.shortDesc } };
        })
      }
    };
    if (s.ratingValue && s.reviewCount) {
      schema.aggregateRating = { '@type': 'AggregateRating', 'ratingValue': s.ratingValue, 'reviewCount': s.reviewCount };
    }
    var tag = document.getElementById('delta-jsonld');
    if (!tag) {
      tag = document.createElement('script');
      tag.type = 'application/ld+json';
      tag.id   = 'delta-jsonld';
      document.head.appendChild(tag);
    }
    tag.textContent = JSON.stringify(schema, null, 2);

    // FAQ schema from first service's FAQ
    var firstSvc = (c.services || [])[0];
    if (firstSvc && firstSvc.faq && firstSvc.faq.length) {
      var faqSchema = {
        '@context': 'https://schema.org',
        '@type':    'FAQPage',
        'mainEntity': firstSvc.faq.map(function (f) {
          return { '@type': 'Question', 'name': f.q, 'acceptedAnswer': { '@type': 'Answer', 'text': f.a } };
        })
      };
      var faqTag = document.getElementById('delta-faq-jsonld');
      if (!faqTag) {
        faqTag = document.createElement('script');
        faqTag.type = 'application/ld+json';
        faqTag.id   = 'delta-faq-jsonld';
        document.head.appendChild(faqTag);
      }
      faqTag.textContent = JSON.stringify(faqSchema, null, 2);
    }
  }

  // -------------------------------------------------------------------------
  // 9. AOS / GSAP ROUTING HELPER
  // -------------------------------------------------------------------------
  function isGSAPAnim(v) { return GSAP_ANIM_KEYS.indexOf(v) !== -1; }
  function aosAttr(val, fallback) {
    var v = val || fallback || 'fade-up';
    if (isGSAPAnim(v)) return '';
    return 'data-aos="' + escHtml(v) + '"';
  }

  // -------------------------------------------------------------------------
  // 10. PUBLIC RENDERER
  // -------------------------------------------------------------------------
  function setText(sel, val) { var el = $(sel); if (el) el.textContent = val == null ? '' : val; }
  function setAttr(sel, attr, val) { var el = $(sel); if (el && val != null) el.setAttribute(attr, val); }

  function renderPublic(c) {
    if (!c) return;
    injectSEO(c);

    // Brand & contact text fields
    $all('[data-delta="brand"]').forEach(function (el) { el.textContent = c.brand || ''; });
    $all('[data-delta="tagline"]').forEach(function (el) { el.textContent = c.tagline || ''; });
    $all('[data-delta="announcement"]').forEach(function (el) { el.textContent = c.announcement || ''; });
    $all('[data-delta="phoneDisplay"]').forEach(function (el) { el.textContent = c.phoneDisplay || ''; });
    $all('[data-delta="phone"]').forEach(function (el) { el.textContent = c.phoneDisplay || c.phone || ''; });
    $all('[data-delta="email"]').forEach(function (el) { el.textContent = c.email || ''; });
    $all('[data-delta="address"]').forEach(function (el) { el.textContent = c.address || ''; });
    $all('[data-delta="hoursWeekday"]').forEach(function (el) { el.textContent = c.hoursWeekday || ''; });
    $all('[data-delta="hoursWeekend"]').forEach(function (el) { el.textContent = c.hoursWeekend || ''; });
    $all('[data-delta="dispatchNote"]').forEach(function (el) { el.textContent = c.dispatchNote || ''; });

    // tel: links
    $all('a[data-delta-href="phone"]').forEach(function (a) { a.href = 'tel:' + (c.phone || ''); });

    // Nav
    var navDesktop = $('[data-delta="nav.desktop"]');
    var navMobile  = $('[data-delta="nav.mobile"]');
    var navItems = (c.nav || []).map(function (n) { return { label: n.label, href: n.href }; });
    if (navDesktop) navDesktop.innerHTML = navItems.map(function (n) {
      return '<a class="nav-link transition-colors duration-300 hover:text-cta font-label-caps text-label-caps uppercase" href="' + escHtml(n.href) + '">' + escHtml(n.label) + '</a>';
    }).join('');
    if (navMobile) navMobile.innerHTML = navItems.map(function (n) {
      return '<a class="block py-3 px-4 text-on-background hover:bg-surface-container-low border-b border-outline/20" href="' + escHtml(n.href) + '">' + escHtml(n.label) + '</a>';
    }).join('');

    // Hero
    if (c.hero) {
      setText('[data-delta="hero.title"]',     c.hero.title);
      setText('[data-delta="hero.subtitle"]',  c.hero.subtitle);
      setText('[data-delta="hero.etaLabel"]',  c.hero.etaLabel);
      setText('[data-delta="hero.etaMinutes"]',c.hero.etaMinutes);
      var c1 = $('[data-delta="hero.cta1"]'); if (c1) { c1.textContent = c.hero.cta1Label || ''; c1.href = c.hero.cta1Href || '#'; }
      var c2 = $('[data-delta="hero.cta2"]'); if (c2) { c2.textContent = c.hero.cta2Label || ''; c2.href = c.hero.cta2Href || '#'; }
      var heroImg = $('[data-delta="hero.image"]');
      if (heroImg) heroImg.style.backgroundImage = "url('" + normalizeImageUrl(c.hero.image) + "')";
    }

    // Trust strip
    var trustEl = $('[data-delta="trust.list"]');
    if (trustEl) {
      trustEl.innerHTML = (c.trust || []).map(function (t) {
        return '<div ' + aosAttr(c.animations && c.animations.trust, 'fade-up') + ' class="flex items-center gap-2">' +
                 '<span class="material-symbols-outlined text-tertiary-fixed-dim">' + escHtml(t.icon) + '</span>' +
                 '<span class="text-on-background">' + escHtml(t.label) + '</span>' +
               '</div>';
      }).join('');
    }

    // Services grid
    var svcEl = $('[data-delta="services.grid"]');
    if (svcEl) {
      svcEl.innerHTML = (c.services || []).map(function (s) {
        return '<a href="service.html?id=' + encodeURIComponent(s.id) + '" ' + aosAttr(c.animations && c.animations.services, 'fade-up') +
               ' class="group flex flex-col items-center justify-start gap-3 p-6 bg-surface-container-lowest border-2 border-outline/40 rounded-DEFAULT hover:border-cta hover:-translate-y-1 hover:shadow-xl transition-all duration-300">' +
                 '<div class="w-16 h-16 rounded-full bg-secondary-fixed flex items-center justify-center group-hover:bg-cta transition-colors">' +
                   '<span class="material-symbols-outlined text-[32px] text-on-secondary-fixed group-hover:text-on-primary" style="font-variation-settings:\'FILL\' 1;">' + escHtml(s.icon || 'build') + '</span>' +
                 '</div>' +
                 '<h3 class="font-label-caps text-label-caps text-on-background uppercase text-center">' + escHtml(s.title) + '</h3>' +
                 '<p class="text-center text-sm text-on-surface-variant">' + escHtml(s.shortDesc || '') + '</p>' +
                 (s.badge ? '<span class="mt-1 inline-block bg-tertiary-fixed text-on-tertiary-fixed text-xs px-2 py-1 font-bold uppercase">' + escHtml(s.badge) + '</span>' : '') +
               '</a>';
      }).join('');
    }

    // How It Works
    var hiwEl = $('[data-delta="howItWorks.list"]');
    if (hiwEl) {
      hiwEl.innerHTML = (c.howItWorks || []).map(function (h, i) {
        return '<div class="flex flex-col items-center text-center gap-3 p-6 bg-surface-container border-2 border-outline/40">' +
                 '<div class="w-12 h-12 rounded-full bg-cta text-on-primary flex items-center justify-center font-bold text-xl">' + (i+1) + '</div>' +
                 '<span class="material-symbols-outlined text-[40px] text-cta" style="font-variation-settings:\'FILL\' 1;">' + escHtml(h.icon) + '</span>' +
                 '<h3 class="font-headline-md text-headline-md text-on-background">' + escHtml(h.title) + '</h3>' +
                 '<p class="text-on-surface-variant">' + escHtml(h.desc) + '</p>' +
               '</div>';
      }).join('');
    }

    // About
    if (c.about) {
      setText('[data-delta="about.title"]', c.about.title);
      setText('[data-delta="about.p1"]',    c.about.p1);
      setText('[data-delta="about.p2"]',    c.about.p2);
      var aImg = $('[data-delta="about.image"]');
      if (aImg) aImg.outerHTML = imgTag(c.about.image, 'About ' + (c.brand || ''), 'rounded-DEFAULT');
    }
    var aboutSec = $('[data-delta-section="about"]');
    if (aboutSec) aboutSec.setAttribute('data-aos-applied', '1');

    // Team
    var teamEl = $('[data-delta="team.list"]');
    if (teamEl) {
      teamEl.innerHTML = (c.team || []).map(function (m) {
        return '<div ' + aosAttr(c.animations && c.animations.team, 'fade-up') +
               ' class="flex flex-col bg-surface-container-lowest border-2 border-outline/40 overflow-hidden hover:-translate-y-1 hover:shadow-xl transition-all duration-300">' +
                 '<div class="aspect-square overflow-hidden">' + imgTag(m.image, m.name, 'grayscale hover:grayscale-0 transition-all duration-500') + '</div>' +
                 '<div class="p-4 flex flex-col gap-2">' +
                   '<h3 class="font-headline-md text-headline-md text-on-background">' + escHtml(m.name) + '</h3>' +
                   '<p class="text-cta font-bold uppercase text-sm">' + escHtml(m.role) + '</p>' +
                   '<p class="text-on-surface-variant text-sm">' + escHtml(m.bio) + '</p>' +
                 '</div>' +
               '</div>';
      }).join('');
    }

    // Reviews
    var revEl = $('[data-delta="reviews.list"]');
    if (revEl) {
      revEl.innerHTML = (c.reviews || []).map(function (r) {
        var stars = ''; for (var i = 0; i < 5; i++) stars += '<span class="material-symbols-outlined text-tertiary-fixed-dim" style="font-variation-settings:\'FILL\' 1;">' + (i < r.rating ? 'star' : 'star_border') + '</span>';
        return '<div ' + aosAttr(c.animations && c.animations.reviews, 'fade-up') +
               ' class="bg-surface-container-lowest border-2 border-outline/40 p-6 flex flex-col gap-3">' +
                 '<div class="flex">' + stars + '</div>' +
                 '<p class="font-body-lg text-body-lg italic text-on-background">"' + escHtml(r.text) + '"</p>' +
                 '<div class="flex justify-between items-center mt-2">' +
                   '<span class="font-label-caps text-label-caps text-on-surface-variant">— ' + escHtml(r.author) + ', ' + escHtml(r.location) + '</span>' +
                   '<span class="text-xs text-on-surface-variant">' + escHtml(r.date) + '</span>' +
                 '</div>' +
               '</div>';
      }).join('');
    }

    // Fleet
    if (c.fleet) {
      setText('[data-delta="fleet.title"]',    c.fleet.title);
      setText('[data-delta="fleet.subtitle"]', c.fleet.subtitle);
      setText('[data-delta="fleet.body"]',     c.fleet.body);
      var fImg = $('[data-delta="fleet.image"]');
      if (fImg) fImg.style.backgroundImage = "url('" + normalizeImageUrl(c.fleet.image) + "')";
    }

    // Contact map + form
    var mapEl = $('[data-delta="contact.map"]');
    if (mapEl) mapEl.src = buildMapEmbedSrc(c.address || '');
    var form = $('[data-delta="contact.form"]');
    if (form) {
      form.dataset.email = c.email || '';
      var svcSel = form.querySelector('[name="serviceNeeded"]');
      if (svcSel) {
        svcSel.innerHTML = '<option value="">Select a service…</option>' +
          (c.services || []).map(function (s) { return '<option value="' + escHtml(s.title) + '">' + escHtml(s.title) + '</option>'; }).join('');
      }
    }

    // Apply data-aos to data-section roots based on c.animations
    $all('[data-section]').forEach(function (el) {
      var key = el.getAttribute('data-section');
      var anim = (c.animations || {})[key] || 'fade-up';
      if (isGSAPAnim(anim)) {
        el.removeAttribute('data-aos');
      } else if (!el.hasAttribute('data-aos')) {
        el.setAttribute('data-aos', anim);
      }
    });

    // AOS init / refresh
    if (window.AOS) {
      try { window.AOS.init({ duration: 700, once: true, offset: 60, easing: 'ease-out-cubic' }); }
      catch (e) {}
    }
  }

  // -------------------------------------------------------------------------
  // 11. MOBILE NAV
  // -------------------------------------------------------------------------
  function bindMobileNav() {
    var trigger = $('[data-delta-trigger="mobile-nav"]');
    var target  = $('[data-delta-target="mobile-nav"]');
    if (!trigger || !target || trigger.dataset.navBound) return;
    trigger.dataset.navBound = '1';
    var open = false;
    function setOpen(v) {
      open = v;
      target.classList.toggle('translate-x-full', !v);
      target.classList.toggle('translate-x-0', v);
      document.body.style.overflow = v ? 'hidden' : '';
    }
    setOpen(false);
    trigger.addEventListener('click', function () { setOpen(!open); });
    target.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') setOpen(false);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && open) setOpen(false);
    });
  }

  // -------------------------------------------------------------------------
  // 12. CONTACT / DISPATCH FORM
  // -------------------------------------------------------------------------
  function bindContactForm() {
    var form = $('[data-delta="contact.form"]');
    if (!form || form.dataset.bound) return;
    form.dataset.bound = '1';
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      var btn = form.querySelector('button[type="submit"]');
      var origText = btn ? btn.textContent : '';
      if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }
      var email = form.dataset.email || '';
      if (!email) { toast('Dispatch email not configured', 'error'); if (btn) { btn.disabled = false; btn.textContent = origText; } return; }
      try {
        var data = Object.fromEntries(new FormData(form));
        var r = await fetch('https://formsubmit.co/ajax/' + encodeURIComponent(email), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify(data)
        });
        var j = await r.json().catch(function () { return {}; });
        if (r.ok && (j.success === 'true' || j.success === true)) {
          toast('Dispatch request sent! We\'ll call you within 2 minutes.', 'success');
          form.reset();
        } else {
          toast('Could not send. Please call us directly.', 'error');
        }
      } catch (err) {
        toast('Network error. Please call us directly.', 'error');
      } finally {
        if (btn) { btn.disabled = false; btn.textContent = origText; }
      }
    });
  }

  // -------------------------------------------------------------------------
  // 13. STICKY MOBILE CTA BAR
  // -------------------------------------------------------------------------
  function bindMobileCTABar(c) {
    if (!c) return;
    var callBtn = $('[data-delta-trigger="call"]');
    var textBtn = $('[data-delta-trigger="text"]');
    var locBtn  = $('[data-delta-trigger="location"]');
    if (callBtn) callBtn.href = 'tel:' + (c.phone || '');
    if (textBtn) {
      var wa = c.whatsapp ? 'https://wa.me/' + String(c.whatsapp).replace(/\D/g, '') : 'sms:' + (c.phone || '');
      textBtn.href = wa;
    }
    if (locBtn && !locBtn.dataset.locBound) {
      locBtn.dataset.locBound = '1';
      locBtn.addEventListener('click', function () {
        var fallback = function () {
          window.open('https://maps.google.com/?q=' + encodeURIComponent(c.address || ''), '_blank');
        };
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(function (pos) {
            window.open('https://maps.google.com/?q=' + pos.coords.latitude + ',' + pos.coords.longitude, '_blank');
          }, fallback, { timeout: 4000 });
        } else fallback();
      });
    }
  }

  // -------------------------------------------------------------------------
  // 14. GSAP ANIMATIONS
  // -------------------------------------------------------------------------
  var SCRAMBLE_CHARS = '!<>-_\\/[]{}—=+*^?#$%&@';

  function runScramble(el, finalText, opts) {
    if (!el || !finalText) return;
    opts = opts || {};
    var speed  = opts.speed  || 35;
    var cycles = opts.cycles || 3;
    var frame = 0;
    var totalFrames = finalText.length * cycles;
    var id = setInterval(function () {
      var progress = frame / cycles;
      el.textContent = finalText.split('').map(function (ch, i) {
        if (i < progress) return finalText[i];
        if (ch === ' ' || ch === '\n') return ch;
        return SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)];
      }).join('');
      frame++;
      if (frame > totalFrames) { el.textContent = finalText; clearInterval(id); }
    }, speed);
  }

  function bindGSAPAnimations(c) {
    if (!window.gsap) return;
    if (window.ScrollTrigger) gsap.registerPlugin(window.ScrollTrigger);

    // Header drop
    gsap.from('[data-delta-anim="header"]', { y: -40, opacity: 0, duration: 0.7, ease: 'power3.out' });

    // Hero stagger
    var heroParts = $all('[data-delta-anim="hero-content"] > *');
    if (heroParts.length) {
      gsap.from(heroParts, { y: 30, opacity: 0, duration: 0.9, stagger: 0.12, ease: 'power3.out', delay: 0.2 });
    }

    // ETA badge pulse
    var eta = $('[data-delta-anim="eta-badge"]');
    if (eta) gsap.to(eta, { scale: 1.04, duration: 1.2, ease: 'sine.inOut', repeat: -1, yoyo: true });

    var anims = c.animations || {};

    // Hero scramble-reveal
    if (anims.hero === 'scramble-reveal') {
      var t = $('[data-delta="hero.title"]');
      if (t) {
        var final = t.textContent;
        setTimeout(function () { runScramble(t, final, { speed: 35, cycles: 3 }); }, 400);
      }
    }

    // Hero parallax
    if (anims.hero === 'parallax-scroll' && window.ScrollTrigger) {
      var heroImg = $('[data-delta="hero.image"]');
      if (heroImg) {
        gsap.to(heroImg, { yPercent: 20, ease: 'none', scrollTrigger: { trigger: heroImg.parentElement || heroImg, start: 'top top', end: 'bottom top', scrub: 1.5 } });
      }
    }

    // Stagger fade for grids
    function staggerGrid(sectionKey, gridSel) {
      if (anims[sectionKey] !== 'stagger-fade') return;
      var children = $all(gridSel + ' > *');
      if (!children.length) return;
      gsap.from(children, {
        y: 50, opacity: 0, duration: 0.8, ease: 'power2.out', stagger: 0.1,
        scrollTrigger: window.ScrollTrigger ? { trigger: gridSel, start: 'top 85%' } : null
      });
    }
    staggerGrid('services', '[data-delta="services.grid"]');
    staggerGrid('team',     '[data-delta="team.list"]');
    staggerGrid('reviews',  '[data-delta="reviews.list"]');

    // Magnetic-pop for hero CTAs (in addition to .btn-magnetic auto-binding)
    if (anims.hero === 'magnetic-pop') {
      $all('[data-delta-anim="hero-content"] a, [data-delta-anim="hero-content"] button').forEach(applyMagnetic);
    }
  }

  function applyMagnetic(btn) {
    if (!window.gsap || !btn || btn.dataset.magneticBound) return;
    btn.dataset.magneticBound = '1';
    btn.addEventListener('mousemove', function (e) {
      var rect = btn.getBoundingClientRect();
      var x = (e.clientX - rect.left - rect.width  / 2) * 0.25;
      var y = (e.clientY - rect.top  - rect.height / 2) * 0.25;
      gsap.to(btn, { x: x, y: y, duration: 0.3, ease: 'power2.out' });
    });
    btn.addEventListener('mouseleave', function () {
      gsap.to(btn, { x: 0, y: 0, duration: 0.6, ease: 'elastic.out(1, 0.3)' });
    });
  }

  function bindMagneticButtons() {
    if (!window.gsap) return;
    $all('.btn-magnetic').forEach(applyMagnetic);
  }

  // -------------------------------------------------------------------------
  // 15. POPUP
  // -------------------------------------------------------------------------
  function injectPopup(c) {
    var p = c && c.popup;
    if (!p || !p.enabled || !p.image) return;
    if (sessionStorage.getItem('delta_popup_seen')) return;
    var delay = (parseFloat(p.delay) || 0) * 1000;
    setTimeout(function () {
      var style = document.createElement('style');
      style.textContent = '@keyframes dpFadeIn{from{opacity:0}to{opacity:1}}@keyframes dpSlideUp{from{transform:translateY(40px);opacity:0}to{transform:none;opacity:1}}';
      document.head.appendChild(style);
      var overlay = document.createElement('div');
      overlay.id = 'delta-popup-overlay';
      overlay.style.cssText = 'position:fixed;inset:0;z-index:9998;background:rgba(0,0,0,.7);display:flex;align-items:center;justify-content:center;padding:1rem;animation:dpFadeIn .3s ease-out;';
      var card = document.createElement('div');
      card.id = 'delta-popup-card';
      card.style.cssText = 'position:relative;max-width:420px;width:100%;background:#fff;border-radius:16px;overflow:hidden;animation:dpSlideUp .4s ease-out;';
      var inner = '';
      if (p.link) inner += '<a href="' + escHtml(p.link) + '" target="_blank" rel="noopener">';
      inner += imgTag(p.image, p.altText || 'Promotion', '');
      if (p.link) inner += '</a>';
      card.innerHTML = inner +
        '<button id="delta-popup-close" aria-label="Close" style="position:absolute;top:.5rem;right:.5rem;background:#000;color:#fff;border:0;width:36px;height:36px;border-radius:50%;cursor:pointer;font-size:18px;">×</button>';
      overlay.appendChild(card);
      document.body.appendChild(overlay);
      function close() {
        sessionStorage.setItem('delta_popup_seen', '1');
        overlay.remove();
        document.removeEventListener('keydown', escHandler);
      }
      function escHandler(e) { if (e.key === 'Escape') close(); }
      overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
      $('#delta-popup-close', card).addEventListener('click', close);
      document.addEventListener('keydown', escHandler);
    }, delay);
  }

  // -------------------------------------------------------------------------
  // 16. PAGE SYSTEM
  // -------------------------------------------------------------------------
  function escBlock(s) { return escHtml(s); }

  function renderBlock(b) {
    if (!b || !b.type) return '';
    switch (b.type) {
      case 'heading':
        var lvl = (b.level || 'h2').toLowerCase();
        var sizeMap = { h1: 'font-display-hero text-display-hero', h2: 'font-headline-lg text-headline-lg', h3: 'font-headline-md text-headline-md', h4: 'font-headline-md text-headline-md', h5: 'font-bold text-lg', h6: 'font-bold text-base' };
        var align = b.align === 'center' ? 'text-center' : b.align === 'right' ? 'text-right' : 'text-left';
        return '<' + lvl + ' class="' + (sizeMap[lvl] || sizeMap.h2) + ' text-on-background ' + align + ' my-6">' + escBlock(b.content) + '</' + lvl + '>';
      case 'paragraph':
        return '<p class="font-body-md text-body-md text-on-background my-4 leading-relaxed">' + escBlock(b.content || '').replace(/\n/g, '<br>') + '</p>';
      case 'image':
        return '<figure class="my-8"><div class="aspect-video overflow-hidden border-2 border-outline/40">' + imgTag(b.src, b.alt || '', '') + '</div>' +
               (b.caption ? '<figcaption class="text-center text-on-surface-variant text-sm mt-2 italic">' + escBlock(b.caption) + '</figcaption>' : '') +
               '</figure>';
      case 'link':
        var styleMap = {
          button:  'inline-flex items-center justify-center bg-cta text-on-primary px-6 h-touch-target-min font-label-caps text-label-caps uppercase border-2 border-on-surface hover:bg-cta-hover transition-colors',
          outline: 'inline-flex items-center justify-center bg-transparent text-on-background px-6 h-touch-target-min font-label-caps text-label-caps uppercase border-2 border-on-surface hover:bg-surface-container-low transition-colors',
          text:    'inline-block text-cta underline hover:text-cta-hover transition-colors'
        };
        var cls = styleMap[b.style] || styleMap.button;
        var tgt = b.newTab ? ' target="_blank" rel="noopener"' : '';
        return '<div class="my-6"><a href="' + escHtml(b.href) + '" class="' + cls + '"' + tgt + '>' + escBlock(b.label) + '</a></div>';
      case 'spacer':
        var sz = b.size === 'small' ? 'py-4' : b.size === 'large' ? 'py-16' : 'py-8';
        return '<div class="' + sz + '"></div>';
      case 'divider':
        return '<hr class="my-8 border-outline/30">';
      default:
        return '';
    }
  }

  function renderPage(c) {
    if (!c) return;
    injectSEO(c);
    var id = new URLSearchParams(window.location.search).get('id');
    var page = (c.pages || []).find(function (p) { return p.id === id; });
    var notFound = $('#page-not-found');
    var content  = $('#page-content');

    // Brand text + nav fill (same as renderPublic but minimal)
    $all('[data-delta="brand"]').forEach(function (el) { el.textContent = c.brand || ''; });
    var navDesktop = $('[data-delta="nav.desktop"]');
    var navMobile  = $('[data-delta="nav.mobile"]');
    if (navDesktop) navDesktop.innerHTML = (c.nav || []).map(function (n) {
      return '<a class="nav-link transition-colors duration-300 hover:text-cta font-label-caps text-label-caps uppercase" href="' + escHtml(n.href) + '">' + escHtml(n.label) + '</a>';
    }).join('');
    if (navMobile) navMobile.innerHTML = (c.nav || []).map(function (n) {
      return '<a class="block py-3 px-4 text-on-background hover:bg-surface-container-low border-b border-outline/20" href="' + escHtml(n.href) + '">' + escHtml(n.label) + '</a>';
    }).join('');

    if (!page) {
      if (notFound) notFound.style.display = '';
      if (content)  content.style.display  = 'none';
      document.title = 'Page Not Found — ' + (c.brand || '');
      return;
    }
    if (notFound) notFound.style.display = 'none';
    if (content)  content.style.display  = '';
    document.title = page.title + ' — ' + (c.brand || '');
    if (page.metaDescription) setMeta('description', page.metaDescription);

    var blocksEl = $('[data-delta="page.blocks"]');
    if (blocksEl) blocksEl.innerHTML = (page.blocks || []).map(renderBlock).join('');
    setText('[data-delta="page.title"]', page.title);
  }

  // -------------------------------------------------------------------------
  // 17. EXPORT
  // -------------------------------------------------------------------------
  window.DeltaEngine = {
    // Constants
    ANIMATION_OPTIONS: ANIMATION_OPTIONS,
    GSAP_ANIM_KEYS: GSAP_ANIM_KEYS,
    THEME_TOKENS: THEME_TOKENS,
    DEFAULT_THEME: DEFAULT_THEME,
    IMG_PLACEHOLDER: IMG_PLACEHOLDER,
    // Utils
    $: $, $all: $all, escHtml: escHtml, toast: toast,
    normalizeImageUrl: normalizeImageUrl, imgTag: imgTag, buildMapEmbedSrc: buildMapEmbedSrc,
    utf8ToBase64: utf8ToBase64, base64ToUtf8: base64ToUtf8,
    // I/O
    loadContent: loadContent, fetchShaWithToken: fetchShaWithToken, commitContent: commitContent,
    // Theme
    bootstrapTheme: bootstrapTheme, applyTheme: applyTheme,
    setThemeMode: setThemeMode, getThemeMode: getThemeMode, bindThemeToggle: bindThemeToggle,
    // SEO
    injectSEO: injectSEO, injectSchema: injectSchema,
    // Render
    renderPublic: renderPublic, aosAttr: aosAttr, isGSAPAnim: isGSAPAnim,
    // Bindings
    bindMobileNav: bindMobileNav, bindContactForm: bindContactForm, bindMobileCTABar: bindMobileCTABar,
    // Animation
    bindGSAPAnimations: bindGSAPAnimations, applyMagnetic: applyMagnetic, bindMagneticButtons: bindMagneticButtons,
    runScramble: runScramble,
    // Popup
    injectPopup: injectPopup,
    // Page system
    escBlock: escBlock, renderBlock: renderBlock, renderPage: renderPage
  };

  // -------------------------------------------------------------------------
  // 18. AUTO-BOOT (only for body[data-delta-app="public"])
  // -------------------------------------------------------------------------
  document.addEventListener('DOMContentLoaded', async function () {
    if (document.body.getAttribute('data-delta-app') !== 'public') return;
    try {
      var c = await loadContent();
      applyTheme(c);
      bindThemeToggle();
      renderPublic(c);
      bindMobileNav();
      bindContactForm();
      bindMobileCTABar(c);
      bindGSAPAnimations(c);
      bindMagneticButtons();
      injectPopup(c);
    } catch (e) {
      console.error('[Delta Engine] Auto-boot failed:', e);
      toast('Failed to load site content', 'error');
    }
  });

})();
