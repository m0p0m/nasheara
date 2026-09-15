const crypto = require('crypto');
const fs = require('fs');

// Multipart routes parse the upload before this check can read the token out of
// the body, so a rejected request has already written its files to disk.
const discardUploadedFiles = req => {
  const groups = req.files ? Object.values(req.files) : [];
  for (const files of groups) {
    for (const file of files) {
      fs.promises.unlink(file.path).catch(() => {});
    }
  }
};

const readCsrfToken = req => {
  if (!req || !req.session) return null;
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  }
  return req.session.csrfToken;
};

const authorizeCsrf = (req, res, next) => {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    return next();
  }

  const sentToken = req.body?._csrf || req.headers['x-csrf-token'] || req.query?._csrf;
  const expectedToken = readCsrfToken(req);
  if (!expectedToken || sentToken !== expectedToken) {
    discardUploadedFiles(req);
    if (req && req.accepts && req.accepts('html')) {
      return res.status(403).render('public/csrf-error', {
        title: '403 - دسترسی نامعتبر',
        layout: 'public/layout',
        currentPath: req.path,
        errorMessage: 'CSRF token missing or invalid.'
      });
    }
    return res.status(403).json({ error: 'CSRF token missing or invalid.' });
  }

  return next();
};

module.exports = {
  readCsrfToken,
  authorizeCsrf,
};
