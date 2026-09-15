const rateLimit = require('express-rate-limit');

const buildLimit = ({ windowMs = 60 * 1000, max = 20, message = 'Too many requests.' }) => rateLimit({
  windowMs,
  max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: message },
  handler(req, res) {
    res.status(429).json({ error: message });
  }
});

const loginLimiter = buildLimit({ windowMs: 15 * 60 * 1000, max: 8, message: 'Too many login attempts. Please try again later.' });
const newsletterLimiter = buildLimit({ windowMs: 60 * 60 * 1000, max: 15, message: 'Too many newsletter submissions.' });
const consultationLimiter = buildLimit({ windowMs: 60 * 60 * 1000, max: 20, message: 'Too many consultation requests.' });
const uploadLimiter = buildLimit({ windowMs: 60 * 60 * 1000, max: 30, message: 'Too many uploads.' });
const adminMutationLimiter = buildLimit({ windowMs: 60 * 60 * 1000, max: 200, message: 'Too many admin mutations.' });

module.exports = {
  loginLimiter,
  newsletterLimiter,
  consultationLimiter,
  uploadLimiter,
  adminMutationLimiter,
  buildLimit
};
