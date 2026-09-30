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

    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Full-screen photo viewer shared by every gallery on the page (built on first use).
    var viewer = null;
    function openViewer(photos, start, labels, onChange) {
        if (!viewer) {
            viewer = document.createElement('div');
            viewer.className = 'lightbox';
            viewer.setAttribute('role', 'dialog');
            viewer.setAttribute('aria-modal', 'true');
            viewer.innerHTML =
                '<button type="button" class="lightbox__close" data-lb="close">&times;</button>' +
                '<button type="button" class="lightbox__nav lightbox__nav--prev" data-lb="prev"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg></button>' +
                '<img class="lightbox__img" alt="">' +
                '<button type="button" class="lightbox__nav lightbox__nav--next" data-lb="next"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg></button>' +
                '<div class="lightbox__count" aria-live="polite"></div>';
            document.body.appendChild(viewer);
        }
        var img = viewer.querySelector('.lightbox__img');
        var count = viewer.querySelector('.lightbox__count');
        var navs = viewer.querySelectorAll('.lightbox__nav');
        var format = new Intl.NumberFormat(document.documentElement.lang || 'fa');
        var index = start;
        var opener = document.activeElement;

        viewer.setAttribute('aria-label', labels.title || '');
        viewer.querySelector('[data-lb="close"]').setAttribute('aria-label', labels.close || 'Close');
        viewer.querySelector('[data-lb="prev"]').setAttribute('aria-label', labels.prev || 'Previous');
        viewer.querySelector('[data-lb="next"]').setAttribute('aria-label', labels.next || 'Next');
        navs.forEach(function (n) { n.hidden = photos.length < 2; });
        count.hidden = photos.length < 2;

        function go(to) {
            index = (to + photos.length) % photos.length;
            img.src = photos[index].src;
            img.alt = photos[index].alt || '';
            count.textContent = format.format(index + 1) + ' / ' + format.format(photos.length);
            if (onChange) onChange(index);
        }
        function close() {
            viewer.classList.remove('is-open');
            document.body.style.overflow = '';
            document.removeEventListener('keydown', onKey);
            viewer.onclick = null;
            if (opener && opener.focus) opener.focus();
        }
        // In RTL the "next" photo is to the left, so the arrow keys follow the reading direction.
        var rtl = document.documentElement.dir === 'rtl';
        function onKey(e) {
            if (e.key === 'Escape') close();
            else if (e.key === 'ArrowRight') go(index + (rtl ? -1 : 1));
            else if (e.key === 'ArrowLeft') go(index + (rtl ? 1 : -1));
        }
        viewer.onclick = function (e) {
            var action = e.target.closest('[data-lb]');
            if (action) {
                var name = action.getAttribute('data-lb');
                if (name === 'close') close();
                else go(index + (name === 'next' ? 1 : -1));
            } else if (e.target !== img) {
                close();
            }
        };
        var touchX = null;
        viewer.ontouchstart = function (e) { touchX = e.touches[0].clientX; };
        viewer.ontouchend = function (e) {
            if (touchX === null || photos.length < 2) return;
            var dx = e.changedTouches[0].clientX - touchX;
            touchX = null;
            if (Math.abs(dx) > 40) go(index + ((dx < 0) !== rtl ? 1 : -1));
        };

        go(index);
        document.addEventListener('keydown', onKey);
        document.body.style.overflow = 'hidden';
        viewer.classList.add('is-open');
        viewer.querySelector('[data-lb="close"]').focus();
    }

    // Galleries: thumbnails swap the [data-gallery-main] photo, and the zoom
    // button (or a click on the photo) opens every photo full screen.
    document.querySelectorAll('[data-gallery]').forEach(function (gallery) {
        var main = gallery.querySelector('[data-gallery-main]');
        if (!main) return;
        var thumbs = Array.prototype.slice.call(gallery.querySelectorAll('[data-gallery-thumb]'));
        var current = Math.max(0, thumbs.findIndex(function (t) { return t.classList.contains('is-active'); }));
        var labels = {
            title: gallery.getAttribute('data-label-title'),
            close: gallery.getAttribute('data-label-close'),
            prev: gallery.getAttribute('data-label-prev'),
            next: gallery.getAttribute('data-label-next')
        };
        var photos = thumbs.length
            ? thumbs.map(function (t) {
                return { src: t.getAttribute('data-gallery-full') || t.getAttribute('data-gallery-thumb'), alt: (t.querySelector('img') || {}).alt };
            })
            : [{ src: main.getAttribute('data-gallery-full') || main.currentSrc || main.src, alt: main.alt }];

        function show(index) {
            var thumb = thumbs[index];
            if (!thumb || index === current) return;
            current = index;
            thumbs.forEach(function (t, i) {
                t.classList.toggle('is-active', i === index);
                t.setAttribute('aria-pressed', i === index ? 'true' : 'false');
            });
            var src = thumb.getAttribute('data-gallery-thumb');
            var set = thumb.getAttribute('data-gallery-srcset');
            var alt = (thumb.querySelector('img') || {}).alt;
            var swap = function () {
                var done = function () { main.style.opacity = '1'; };
                main.onload = done;
                main.onerror = done;
                // The browser picks from srcset before src, so both must change
                // or the old photo stays on screen.
                if (set) main.srcset = set; else main.removeAttribute('srcset');
                main.src = src;
                if (alt) main.alt = alt;
                if (main.complete) done();
            };
            if (reduceMotion) swap();
            else { main.style.opacity = '0'; setTimeout(swap, 160); }
        }

        thumbs.forEach(function (thumb, i) {
            thumb.setAttribute('aria-pressed', i === current ? 'true' : 'false');
            thumb.addEventListener('click', function () { show(i); });
        });
        var open = function () { openViewer(photos, current, labels, show); };
        gallery.querySelectorAll('[data-gallery-open]').forEach(function (btn) { btn.addEventListener('click', open); });
        main.addEventListener('click', open);
    });

    // Confirmation before destructive forms: <form data-confirm="message">
    document.querySelectorAll('form[data-confirm]').forEach(function (form) {
        form.addEventListener('submit', function (e) {
            if (!window.confirm(form.getAttribute('data-confirm'))) e.preventDefault();
        });
    });
})();
