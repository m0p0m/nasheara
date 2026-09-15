function ensureAuthenticated(req, res, next) {
    if (req.session && req.session.isAuthenticated === true) {
        return next();
    }
    if (req.session) {
        req.session.loginError = 'Authentication required.';
    }
    return res.redirect('/admin/login');
}

module.exports = ensureAuthenticated;
