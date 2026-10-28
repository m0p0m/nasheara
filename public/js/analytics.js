/* Visitor analytics: Google Analytics 4 (where visitors come from, which pages
   they read) and Microsoft Clarity (heatmaps and session recordings). Both IDs
   come from the server environment; layout.ejs only loads this file when one is set.
   Lead actions (WhatsApp, phone, email, forms) are sent as GA4 events. */
(function () {
    'use strict';

    var me = document.currentScript;
    var gaId = me && me.getAttribute('data-ga');
    var clarityId = me && me.getAttribute('data-clarity');

    // gtag.js and clarity.js cost phones about 1.5 s of main-thread work, the
    // largest part of the page's blocking time. They are fetched on the
    // visitor's first scroll, tap or key press, or 8 s after load, whichever
    // comes first. Calls made before then (the page view included) wait in the
    // gtag/clarity queues and are sent once the scripts arrive.
    var pending = [];
    var started = false;
    var triggers = ['scroll', 'pointerdown', 'keydown', 'touchstart'];
    function load(src) { pending.push(src); }
    function flush() {
        if (started) return;
        started = true;
        triggers.forEach(function (name) { window.removeEventListener(name, flush, { passive: true }); });
        pending.forEach(function (src) {
            var s = document.createElement('script');
            s.async = true;
            s.src = src;
            document.head.appendChild(s);
        });
        pending = [];
    }
    triggers.forEach(function (name) { window.addEventListener(name, flush, { passive: true, once: true }); });
    function afterLoad() { setTimeout(flush, 8000); }
    if (document.readyState === 'complete') afterLoad();
    else window.addEventListener('load', afterLoad, { once: true });

    window.dataLayer = window.dataLayer || [];
    function gtag() { window.dataLayer.push(arguments); }
    window.gtag = window.gtag || gtag;

    if (gaId) {
        load('https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(gaId));
        gtag('js', new Date());
        gtag('config', gaId, { content_group: document.documentElement.lang });
    }

    if (clarityId) {
        window.clarity = window.clarity || function () { (window.clarity.q = window.clarity.q || []).push(arguments); };
        load('https://www.clarity.ms/tag/' + encodeURIComponent(clarityId));
    }

    function track(name, params) {
        if (gaId) window.gtag('event', name, params || {});
        if (clarityId && window.clarity) window.clarity('event', name);
    }

    document.addEventListener('click', function (e) {
        var a = e.target.closest && e.target.closest('a[href]');
        if (!a) return;
        var href = a.getAttribute('href') || '';
        var where = location.pathname;
        if (href.indexOf('wa.me') !== -1) track('whatsapp_click', { link_url: href, page_path: where });
        else if (href.indexOf('tel:') === 0) track('phone_click', { page_path: where });
        else if (href.indexOf('mailto:') === 0) track('email_click', { page_path: where });
        else if (/\/consultation(\?|$)/.test(href)) track('consultation_cta', { page_path: where });
        else if (/\/visualizer(\?|$)/.test(href)) track('visualizer_open', { page_path: where });
    });

    document.addEventListener('submit', function (e) {
        var form = e.target;
        var action = (form && form.getAttribute('action')) || '';
        if (/consultation|contact/.test(action)) track('generate_lead', { form: 'consultation', page_path: location.pathname });
        else if (/newsletter/.test(action)) track('sign_up', { method: 'newsletter' });
    });
})();
