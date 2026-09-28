// Video section (views/public/_video.ejs).
// - Aparat: the iframe is only created when the visitor presses play, so a
//   page with several videos loads nothing from Aparat until then.
// - Clip: a short muted loop from our own host, played while on screen.
//   Visitors who ask for reduced motion or data saving get the poster and
//   native controls instead.
(function () {
    document.querySelectorAll('[data-aparat]').forEach(function (btn) {
        btn.addEventListener('click', function () {
            var frame = document.createElement('iframe');
            frame.src = btn.getAttribute('data-aparat');
            frame.title = btn.getAttribute('aria-label') || 'Aparat';
            frame.setAttribute('allowfullscreen', '');
            frame.setAttribute('allow', 'autoplay; fullscreen; picture-in-picture');
            frame.className = 'vid__frame';
            btn.replaceWith(frame);
        });
    });

    var clips = document.querySelectorAll('[data-clip]');
    if (!clips.length) return;
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var saveData = navigator.connection && navigator.connection.saveData;
    if (reduce || saveData || !('IntersectionObserver' in window)) {
        clips.forEach(function (v) { v.controls = true; });
        return;
    }
    var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
            var v = entry.target;
            if (entry.isIntersecting) {
                var p = v.play();
                if (p && p.catch) p.catch(function () { v.controls = true; });
            } else {
                v.pause();
            }
        });
    }, { threshold: 0.35 });
    clips.forEach(function (v) { io.observe(v); });
})();
