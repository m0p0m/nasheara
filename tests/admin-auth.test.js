const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcrypt');

const { validateAdminCredentials, ensureInitialAdmin } = require('../lib/adminAuth');
const { isSafeUploadPath } = require('../middleware/upload');
const { authorizeCsrf, readCsrfToken } = require('../middleware/csrf');

const mockPrismaFactory = (countValue = 0, userOverride = null) => ({
  adminUser: {
    count: async () => countValue,
    findUnique: async () => userOverride,
    create: async ({ data }) => ({
      id: '1',
      username: data.username,
      passwordHash: data.passwordHash,
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
  },
});

test('ensureInitialAdmin creates a hashed admin when DB is empty with a secure provisioning token', async () => {
  const originalPrisma = require.cache[require.resolve('../lib/prisma')];
  const originalAdminAuth = require.cache[require.resolve('../lib/adminAuth')];
  const originalSecret = process.env.ADMIN_PROVISION_SECRET;
  process.env.ADMIN_PROVISION_SECRET = 'secure-provision-secret';

  require.cache[require.resolve('../lib/prisma')] = { exports: mockPrismaFactory(0) };
  delete require.cache[require.resolve('../lib/adminAuth')];

  try {
    const { ensureInitialAdmin } = require('../lib/adminAuth');
    const result = await ensureInitialAdmin({ username: 'admin', password: 'Password123!', provisioningToken: 'secure-provision-secret' });
    assert.equal(result.created, true);
    assert.equal(result.user.username, 'admin');
    assert.ok(result.user.passwordHash);
    assert.notEqual(result.user.passwordHash, 'Password123!');
  } finally {
    delete require.cache[require.resolve('../lib/adminAuth')];
    if (originalAdminAuth) {
      require.cache[require.resolve('../lib/adminAuth')] = originalAdminAuth;
    }
    if (originalPrisma) {
      require.cache[require.resolve('../lib/prisma')] = originalPrisma;
    } else {
      delete require.cache[require.resolve('../lib/prisma')];
    }
    if (originalSecret === undefined) {
      delete process.env.ADMIN_PROVISION_SECRET;
    } else {
      process.env.ADMIN_PROVISION_SECRET = originalSecret;
    }
  }
});

test('validateAdminCredentials compares against the stored hash', async () => {
  const hash = await bcrypt.hash('Password123!', 12);
  const isValid = await validateAdminCredentials({
    username: 'admin',
    password: 'Password123!',
    storedHash: hash,
  });

  assert.equal(isValid, true);
});

test('ensureInitialAdmin rejects public fallback when no secure provisioning secret or token is provided', async () => {
  const originalPrisma = require.cache[require.resolve('../lib/prisma')];
  const originalAdminAuth = require.cache[require.resolve('../lib/adminAuth')];

  require.cache[require.resolve('../lib/prisma')] = { exports: mockPrismaFactory(0) };
  delete require.cache[require.resolve('../lib/adminAuth')];

  try {
    const { ensureInitialAdmin } = require('../lib/adminAuth');
    await assert.rejects(
      () => ensureInitialAdmin({ username: 'admin', password: 'Password123!' }),
      /Secure admin provisioning is disabled|Invalid or missing provisioning token/
    );
  } finally {
    delete require.cache[require.resolve('../lib/adminAuth')];
    if (originalAdminAuth) {
      require.cache[require.resolve('../lib/adminAuth')] = originalAdminAuth;
    }
    if (originalPrisma) {
      require.cache[require.resolve('../lib/prisma')] = originalPrisma;
    } else {
      delete require.cache[require.resolve('../lib/prisma')];
    }
  }
});

test('authorizeCsrf rejects missing tokens on mutation requests while readCsrfToken persists a token in session', () => {
  const session = {};
  const req = {
    method: 'POST',
    body: {},
    headers: {},
    query: {},
    session
  };
  const res = {
    status(code) { this.code = code; return this; },
    json(payload) { this.payload = payload; return this; }
  };

  const expected = readCsrfToken(req);
  assert.equal(typeof expected, 'string');
  assert.equal(expected.length > 16, true);

  let getNextCalled = false;
  authorizeCsrf({ method: 'GET', session }, res, () => {
    getNextCalled = true;
  });
  assert.equal(getNextCalled, true);

  authorizeCsrf(req, res, () => {
    throw new Error('next should not fire');
  });
  assert.equal(res.code, 403);
  assert.equal(res.payload && res.payload.error, 'CSRF token missing or invalid.');
});

test('isSafeUploadPath rejects traversal outside the uploads directory', () => {
  assert.equal(isSafeUploadPath('/uploads/../secret.txt'), false);
  assert.equal(isSafeUploadPath('/uploads/../../server.js'), false);
  assert.equal(isSafeUploadPath('/uploads/product-1740000000000.png'), true);
});
