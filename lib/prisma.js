// Shared hosting (cPanel / CloudLinux) caps processes *and threads* per account.
// Prisma's Rust engine starts one worker thread per CPU core of the server
// (dozens on a shared box) and opens `cores * 2 + 1` DB connections, so a few
// Passenger workers were enough to hit the cap: new threads/processes failed
// with EAGAIN, the engine panicked and every page returned 500 until a manual
// restart. Keep both small; they must be set before the engine is loaded.
if (!process.env.TOKIO_WORKER_THREADS) process.env.TOKIO_WORKER_THREADS = '2';

const { PrismaClient } = require('@prisma/client');

// Appended as plain text so the rest of the URL (e.g. `?socket=/var/lib/...`)
// reaches Prisma exactly as configured on the host.
const withPoolLimit = (url) => {
    if (!url) return url;
    const extra = ['connection_limit=5', 'pool_timeout=20'].filter(p => !url.includes(p.split('=')[0] + '='));
    if (!extra.length) return url;
    return url + (url.includes('?') ? '&' : '?') + extra.join('&');
};

// A panicked or dead engine never recovers inside the same process, so the site
// would keep answering 500. Exit instead and let Passenger start a fresh worker
// on the next request — no manual restart needed.
const FATAL_ERRORS = new Set(['PrismaClientRustPanicError', 'PrismaClientInitializationError']);
let exiting = false;
const exitOnFatal = (error) => {
    const fatal = FATAL_ERRORS.has(error && error.name) || /EAGAIN|Resource temporarily unavailable/.test(String(error && error.message));
    if (!fatal || exiting) return;
    exiting = true;
    console.error('Prisma engine is unusable, restarting worker:', error.message);
    // Give the in-flight response a moment to be sent.
    setTimeout(() => process.exit(1), 1000).unref();
};

const createClient = () => new PrismaClient({ datasourceUrl: withPoolLimit(process.env.DATABASE_URL) }).$extends({
    query: {
        async $allOperations({ args, query }) {
            try {
                return await query(args);
            } catch (error) {
                exitOnFatal(error);
                throw error;
            }
        }
    }
});

const globalForPrisma = global;

const prisma = globalForPrisma.__nashearaPrisma || createClient();

if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.__nashearaPrisma = prisma;
}

module.exports = prisma;
