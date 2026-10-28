/* Gentle staggered entrance as sections scroll into view. Content is visible
   without JS; anything already on screen at load is shown at once (no flash). */
(function () {
    'use strict';

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (!('IntersectionObserver' in window)) return;

    var items = document.querySelectorAll('[data-reveal]');
    if (items.length === 0) return;

    // No getBoundingClientRect here: reading positions while the page is still
    // being laid out forced the whole first layout into this script (a long
    // task on phones). The observer reports positions after layout instead;
    // its first report says which items start off screen, and only those are
    // hidden (.reveal-pending) until they scroll in.
    var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
            var el = entry.target;
            if (entry.isIntersecting) {
                el.classList.add('is-visible');
                observer.unobserve(el);
            } else {
                el.classList.add('reveal-pending');
            }
        });
    // Start just before an item scrolls in, so a quick scroll never meets an empty section.
    }, { threshold: 0, rootMargin: '0px 0px 12% 0px' });

    Array.prototype.forEach.call(items, function (el) { observer.observe(el); });
})();
