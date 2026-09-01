const bcrypt = require('bcrypt');

const normalizeAdminUsername = (value) => (typeof value === 'string' ? value.trim() : String(value ?? '')).trim();

const getPrisma = () => require('./prisma');

const ensureInitialAdmin = async ({ username, password }) => {
  const normalizedUsername = normalizeAdminUsername(username);
  const normalizedPassword = typeof password === 'string' ? password : '';

  if (!normalizedUsername || !normalizedPassword) {
    throw new Error('Admin username and password are required.');
  }

  const prisma = getPrisma();
  const adminCount = await prisma.adminUser.count();

  if (adminCount > 0) {
    const existingAdmin = await prisma.adminUser.findUnique({
      where: { username: normalizedUsername }
    });

    return { created: false, user: existingAdmin, exists: true };
  }

  const existingAdmin = await prisma.adminUser.findUnique({
    where: { username: normalizedUsername }
  });

  if (existingAdmin) {
    return { created: false, user: existingAdmin, exists: true };
  }

  const passwordHash = await bcrypt.hash(normalizedPassword, 12);

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

  if (storedHash.startsWith('$2a$') || storedHash.startsWith('$2b$') || storedHash.startsWith('$2y$')) {
    return bcrypt.compare(password, storedHash);
  }

  return password === storedHash;
};

module.exports = {
  ensureInitialAdmin,
  validateAdminCredentials,
};
