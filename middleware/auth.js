function ensureAuthenticated(req, res, next) {
    if (req.session.isAuthenticated) {
        return next();
    }
    res.redirect('/admin/login');
}

module.exports = ensureAuthenticated;
