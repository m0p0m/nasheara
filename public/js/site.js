(function () {
    'use strict';

    // Stylesheets marked data-defer-style are linked with media="print" so they
    // never block the first paint; switch them on now that the page is parsed.
    document.querySelectorAll('link[data-defer-style]').forEach(function (link) { link.media = 'all'; });

    // Header: compact + blurred once the page scrolls
    var header = document.getElementById('siteHeader');
    if (header) {
        var onScroll = function () {
            header.classList.toggle('is-scrolled', window.scrollY > 24);
        };
        window.addEventListener('scroll', onScroll, { passive: true });
        onScroll();
    }

    // Mobile menu
    var menu = document.getElementById('mobileMenu');
    var openBtn = document.getElementById('mobileMenuBtn');
    var closeBtn = document.getElementById('closeMobileMenu');
    var backdrop = document.getElementById('mobileMenuBackdrop');

    function openMenu() {
        if (!menu) return;
        menu.classList.add('is-open');
        menu.setAttribute('aria-hidden', 'false');
        if (openBtn) openBtn.setAttribute('aria-expanded', 'true');
        document.body.style.overflow = 'hidden';
        var first = menu.querySelector('a, button');
        if (first) first.focus();
    }
    function closeMenu() {
        if (!menu) return;
        menu.classList.remove('is-open');
        menu.setAttribute('aria-hidden', 'true');
        if (openBtn) {
            openBtn.setAttribute('aria-expanded', 'false');
            openBtn.focus();
        }
        document.body.style.overflow = '';
    }
    if (openBtn) openBtn.addEventListener('click', openMenu);
    if (closeBtn) closeBtn.addEventListener('click', closeMenu);
    if (backdrop) backdrop.addEventListener('click', closeMenu);
    if (menu) {
        menu.querySelectorAll('a').forEach(function (a) { a.addEventListener('click', closeMenu); });
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && menu.classList.contains('is-open')) closeMenu();
        });
    }

    // Gallery thumbnails: any [data-gallery] container swaps its [data-gallery-main] image
    document.querySelectorAll('[data-gallery]').forEach(function (gallery) {
        var main = gallery.querySelector('[data-gallery-main]');
        var thumbs = gallery.querySelectorAll('[data-gallery-thumb]');
        if (!main || !thumbs.length) return;
        thumbs.forEach(function (thumb) {
            thumb.addEventListener('click', function () {
                var src = thumb.getAttribute('data-gallery-thumb') || (thumb.querySelector('img') || {}).src;
                if (!src || src === main.getAttribute('src')) return;
                thumbs.forEach(function (t) { t.classList.remove('is-active'); });
                thumb.classList.add('is-active');
                main.style.opacity = '0';
                var swap = function () {
                    main.onload = function () { main.style.opacity = '1'; };
                    main.src = src;
                };
                if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) swap();
                else setTimeout(swap, 160);
            });
        });
    });

    // Confirmation before destructive forms: <form data-confirm="message">
    document.querySelectorAll('form[data-confirm]').forEach(function (form) {
        form.addEventListener('submit', function (e) {
            if (!window.confirm(form.getAttribute('data-confirm'))) e.preventDefault();
        });
    });
})();
