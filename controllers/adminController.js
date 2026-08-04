const bcrypt = require('bcrypt');

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
    const ip = req.ip;
    const username = (req.body.username || '').trim();
    const password = (req.body.password || '');

    const attempts = loginAttempts[ip] || { count: 0, lockoutUntil: 0 };

    // Check if the IP is currently locked out
    if (Date.now() < attempts.lockoutUntil) {
        const remainingTime = Math.ceil((attempts.lockoutUntil - Date.now()) / 1000 / 60);
        // It's good practice to not reveal too much info in error messages.
        // For the admin, a clear message is probably fine.
        return res.status(429).send(`Too many attempts. Please try again in ${remainingTime} minutes.`);
    }

    const adminUsername = (process.env.ADMIN_USERNAME || '').trim();
    const adminPasswordEnv = (process.env.ADMIN_PASSWORD || '');

    if (!adminUsername || !adminPasswordEnv) {
        console.error('Login configuration missing: ADMIN_USERNAME or ADMIN_PASSWORD not set in .env');
        req.session.loginError = 'تنظیمات ورود ناقص است. لطفاً ADMIN_USERNAME و ADMIN_PASSWORD را بررسی کنید.';
        return res.redirect('/admin/login');
    }

    let isLoginSuccessful = false;
    if (username === adminUsername) {
        if (adminPasswordEnv.startsWith('$2a$') || adminPasswordEnv.startsWith('$2b$') || adminPasswordEnv.startsWith('$2y$')) {
            isLoginSuccessful = await bcrypt.compare(password, adminPasswordEnv);
        } else {
            isLoginSuccessful = password === adminPasswordEnv;
        }
    }

    if (isLoginSuccessful) {
        // On successful login, reset the attempt counter for that IP
        delete loginAttempts[ip];
        req.session.isAuthenticated = true;
        return res.redirect('/admin/dashboard');
    } else {
        // On failed login, increment the attempt counter
        attempts.count++;

        if (attempts.count >= MAX_ATTEMPTS) {
            // Determine the lockout duration based on the number of previous lockouts
            const lockoutIndex = Math.min(attempts.lockoutLevel || 0, lockoutDurations.length - 1);
            const duration = lockoutDurations[lockoutIndex];
            attempts.lockoutUntil = Date.now() + duration;
            attempts.lockoutLevel = (attempts.lockoutLevel || 0) + 1;
            attempts.count = 0; // Reset count after lockout
        }

        loginAttempts[ip] = attempts;

        // Redirect back to login with error message
        if (attempts.count >= MAX_ATTEMPTS && attempts.lockoutUntil) {
            const remainingMinutes = Math.ceil((attempts.lockoutUntil - Date.now()) / 1000 / 60);
            req.session.loginError = `تعداد تلاش‌های ناموفق بیش از حد مجاز است. لطفاً ${remainingMinutes} دقیقه دیگر تلاش کنید.`;
        } else {
            req.session.loginError = `نام کاربری یا رمز عبور اشتباه است. (${attempts.count}/${MAX_ATTEMPTS})`;
        }
        res.redirect('/admin/login');
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
