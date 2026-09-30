/* Interactive swatch strip — swaps a large preview when a swatch is hovered/tapped/focused. */
(function () {
    'use strict';

    function activate(container, swatch, activateImmediately) {
        var img = container.querySelector('.swatch-preview__img[data-swatch-img]');
        var fallback = container.querySelector('.swatch-preview__fallback');
        var nameEl = container.querySelector('[data-swatch-name]');
        var noteEl = container.querySelector('[data-swatch-note]');
        var catEl = container.querySelector('[data-swatch-cat]');

        container.querySelectorAll('.swatch').forEach(function (s) {
            s.classList.toggle('is-active', s === swatch);
            s.setAttribute('aria-pressed', s === swatch ? 'true' : 'false');
        });

        var src = swatch.getAttribute('data-img') || '';
        var name = swatch.getAttribute('data-name') || '';
        var note = swatch.getAttribute('data-note') || '';
        var cat = swatch.getAttribute('data-cat') || '';

        if (img && src) {
            container.classList.remove('is-fallback');
            var swap = function () {
                img.src = src;
                img.onload = function () {
                    img.classList.add('is-on');
                    if (fallback) fallback.style.opacity = '0';
                };
            };
            if (activateImmediately) {
                swap();
            } else {
                img.classList.remove('is-on');
                window.setTimeout(swap, 160);
            }
        } else {
            if (img) img.classList.remove('is-on');
            if (fallback) {
                container.classList.add('is-fallback');
                if (nameEl) fallback.querySelector('span').textContent = name;
            }
        }

        if (nameEl) nameEl.textContent = name;
        if (noteEl) noteEl.textContent = note;
        if (catEl) catEl.textContent = cat;
    }

    function init(root) {
        var containers = root.querySelectorAll('[data-swatches]');
        containers.forEach(function (container) {
            var swatches = container.querySelectorAll('.swatch[data-img]');
            swatches.forEach(function (swatch, index) {
                var show = function () { activate(container, swatch, false); };
                swatch.addEventListener('mouseenter', show);
                swatch.addEventListener('focus', show);
                swatch.addEventListener('click', function (e) {
                    e.preventDefault();
                    activate(container, swatch, true);
                });
                if (index === 0 && swatch.getAttribute('data-active') !== 'false') {
                    activate(container, swatch, true);
                }
            });
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () { init(document); });
    } else {
        init(document);
    }
})();