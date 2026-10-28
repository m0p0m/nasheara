/* Gentle staggered entrance as sections scroll into view. Content is visible
   without JS; anything already on screen at load is shown at once (no flash). */
(function () {
    'use strict';

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (!('IntersectionObserver' in window)) return;

    var items = document.querySelectorAll('[data-reveal]');
    if (items.length === 0) return;

    var fold = window.innerHeight;
    var pending = [];
    items.forEach(function (el) {
        if (el.getBoundingClientRect().top < fold) el.classList.add('is-visible');
        else pending.push(el);
    });
    document.documentElement.classList.add('reveal-on');

    var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
            if (entry.isIntersecting) {
                entry.target.classList.add('is-visible');
                observer.unobserve(entry.target);
            }
        });
    // Start just before an item scrolls in, so a quick scroll never meets an empty section.
    }, { threshold: 0, rootMargin: '0px 0px 12% 0px' });

    pending.forEach(function (el) { observer.observe(el); });
})();
