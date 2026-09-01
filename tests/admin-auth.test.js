const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcrypt');

const { validateAdminCredentials, ensureInitialAdmin } = require('../lib/adminAuth');

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

test('ensureInitialAdmin creates a hashed admin when DB is empty', async () => {
  const originalPrisma = require.cache[require.resolve('../lib/prisma')];
  const originalAdminAuth = require.cache[require.resolve('../lib/adminAuth')];

  require.cache[require.resolve('../lib/prisma')] = { exports: mockPrismaFactory(0) };
  delete require.cache[require.resolve('../lib/adminAuth')];

  try {
    const { ensureInitialAdmin } = require('../lib/adminAuth');
    const result = await ensureInitialAdmin({ username: 'admin', password: 'Password123!' });
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

test('ensureInitialAdmin does not fall back to env credentials', async () => {
  const originalPrisma = require.cache[require.resolve('../lib/prisma')];
  const originalAdminAuth = require.cache[require.resolve('../lib/adminAuth')];

  require.cache[require.resolve('../lib/prisma')] = { exports: mockPrismaFactory(0) };
  delete require.cache[require.resolve('../lib/adminAuth')];

  try {
    const { ensureInitialAdmin } = require('../lib/adminAuth');
    await assert.rejects(
      () => ensureInitialAdmin({}),
      /Admin username and password are required\./
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
