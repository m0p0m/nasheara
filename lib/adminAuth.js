const bcrypt = require('bcrypt');

const normalizeAdminUsername = (value) => (typeof value === 'string' ? value.trim() : String(value ?? '')).trim();

const getPrisma = () => require('./prisma');

const isBcryptHash = value => typeof value === 'string'
  && (value.startsWith('$2a$') || value.startsWith('$2b$') || value.startsWith('$2y$'));

const ensureInitialAdmin = async ({ username, password, provisioningToken }) => {
  const normalizedUsername = normalizeAdminUsername(username);
  const normalizedPassword = typeof password === 'string' ? password : '';

  if (!normalizedUsername || !normalizedPassword) {
    throw new Error('Admin username and password are required.');
  }

  const provisionSecret = process.env.ADMIN_PROVISION_SECRET;
  if (!provisionSecret) {
    throw new Error('Secure admin provisioning is disabled. Set ADMIN_PROVISION_SECRET.');
  }

  if (!provisioningToken || provisioningToken !== provisionSecret) {
    throw new Error('Invalid or missing provisioning token.');
  }

  const prisma = getPrisma();
  const adminCount = await prisma.adminUser.count();

  if (adminCount > 0) {
    return { created: false, user: null, exists: true };
  }

  const existingAdmin = await prisma.adminUser.findUnique({
    where: { username: normalizedUsername }
  });

  if (existingAdmin) {
    return { created: false, user: existingAdmin, exists: true };
  }

  // A migrated deployment may supply the bcrypt hash it already had instead of
  // the plaintext password, which must not be hashed a second time.
  const passwordHash = isBcryptHash(normalizedPassword)
    ? normalizedPassword
    : await bcrypt.hash(normalizedPassword, 12);

  const newUser = await prisma.adminUser.create({
    data: {
      username: normalizedUsername,
      passwordHash,
    },
  });

  return { created: true, user: newUser, exists: false };
};

const validateAdminCredentials = async ({ username, password, storedHash }) => {
  const normalizedUsername = normalizeAdminUsername(username);

  if (!normalizedUsername || !password || !storedHash) {
    return false;
  }

  if (!storedHash.startsWith('$2a$') && !storedHash.startsWith('$2b$') && !storedHash.startsWith('$2y$')) {
    return false;
  }

  return bcrypt.compare(password, storedHash);
};

module.exports = {
  ensureInitialAdmin,
  validateAdminCredentials,
};
