const bcrypt = require('bcrypt');
const prisma = require('../lib/prisma');
const { ensureInitialAdmin, validateAdminCredentials } = require('../lib/adminAuth');

// In-memory store for login attempts. In a real app, use a persistent store like Redis.
const loginAttempts = {};
const MAX_ATTEMPTS = 5;

// Lockout durations in milliseconds (30m, 1h, 2h, 4h...)
const lockoutDurations = [
    30 * 60 * 1000,  // 30 minutes
    60 * 60 * 1000,  // 1 hour
    2 * 60 * 60 * 1000,  // 2 hours
    4 * 60 * 60 * 1000   // 4 hours
];

// Normalize IP address: convert IPv6-mapped IPv4 (::ffff:127.0.0.1) to plain IPv4 (127.0.0.1)
// This prevents rate-limit bucket splits on cPanel/reverse-proxy environments
const normalizeIp = (ip) => {
    if (!ip) return 'unknown';
    const str = String(ip);
    const mapped = str.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    return mapped ? mapped[1] : str;
};

const getLogin = (req, res) => {
    const errorMessage = req.session.loginError || null;
    delete req.session.loginError; // Clear error after showing
    res.render('admin/login', {
        title: 'ورود مدیریت',
        layout: false,
        errorMessage: errorMessage
    });
};

const postLogin = async (req, res) => {
    const ip = normalizeIp(req.ip);
    const username = (req.body.username || '').trim();
    const password = (req.body.password || '');

    if (!username || !password) {
        req.session.loginError = 'نام کاربری و رمز عبور لازم است.';
        return res.redirect('/admin/login');
    }

    const attempts = loginAttempts[ip] || { count: 0, lockoutUntil: 0 };

    if (Date.now() < attempts.lockoutUntil) {
        const remainingTime = Math.ceil((attempts.lockoutUntil - Date.now()) / 1000 / 60);
        req.session.loginError = `تعداد تلاش‌های ناموفق بیش از حد مجاز است. لطفاً ${remainingTime} دقیقه دیگر تلاش کنید.`;
        return res.redirect('/admin/login');
    }

    try {
        const totalAdmins = await prisma.adminUser.count();
        const adminUser = await prisma.adminUser.findUnique({ where: { username } });

        if (!adminUser && totalAdmins === 0) {
            const seededAdmin = await ensureInitialAdmin({ username, password });
            if (!seededAdmin || !seededAdmin.user) {
                throw new Error('Unable to create initial admin account');
            }
            delete loginAttempts[ip];
            req.session.isAuthenticated = true;
            req.session.adminUsername = seededAdmin.user.username;
            return res.redirect('/admin/dashboard');
        }

        if (!adminUser) {
            attempts.count += 1;
            if (attempts.count >= MAX_ATTEMPTS) {
                const lockoutIndex = Math.min(attempts.lockoutLevel || 0, lockoutDurations.length - 1);
                const duration = lockoutDurations[lockoutIndex];
                attempts.lockoutUntil = Date.now() + duration;
                attempts.lockoutLevel = (attempts.lockoutLevel || 0) + 1;
                attempts.count = 0;
            }

            loginAttempts[ip] = attempts;
            req.session.loginError = `نام کاربری یا رمز عبور اشتباه است. (${attempts.count}/${MAX_ATTEMPTS})`;
            return res.redirect('/admin/login');
        }

        const isLoginSuccessful = await validateAdminCredentials({
            username: adminUser.username,
            password,
            storedHash: adminUser.passwordHash
        });

        if (isLoginSuccessful) {
            delete loginAttempts[ip];
            req.session.isAuthenticated = true;
            req.session.adminUsername = adminUser.username;
            return res.redirect('/admin/dashboard');
        }

        attempts.count += 1;

        if (attempts.count >= MAX_ATTEMPTS) {
            const lockoutIndex = Math.min(attempts.lockoutLevel || 0, lockoutDurations.length - 1);
            const duration = lockoutDurations[lockoutIndex];
            attempts.lockoutUntil = Date.now() + duration;
            attempts.lockoutLevel = (attempts.lockoutLevel || 0) + 1;
            attempts.count = 0;
        }

        loginAttempts[ip] = attempts;

        if (attempts.count >= MAX_ATTEMPTS && attempts.lockoutUntil) {
            const remainingMinutes = Math.ceil((attempts.lockoutUntil - Date.now()) / 1000 / 60);
            req.session.loginError = `تعداد تلاش‌های ناموفق بیش از حد مجاز است. لطفاً ${remainingMinutes} دقیقه دیگر تلاش کنید.`;
        } else {
            req.session.loginError = `نام کاربری یا رمز عبور اشتباه است. (${attempts.count}/${MAX_ATTEMPTS})`;
        }
        return res.redirect('/admin/login');
    } catch (error) {
        console.error('Admin login error:', error);
        req.session.loginError = 'خطا در ورود به سیستم. لطفاً دوباره تلاش کنید.';
        return res.redirect('/admin/login');
    }
};

const getLogout = (req, res) => {
    req.session.destroy(err => {
        if (err) {
            console.error('Failed to destroy session:', err);
        }
        res.redirect('/admin/login');
    });
};

module.exports = {
    getLogin,
    postLogin,
    getLogout,
};
