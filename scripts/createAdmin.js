require('dotenv').config();
const { ensureInitialAdmin } = require('../lib/adminAuth');

const run = async () => {
    const username = process.env.ADMIN_USERNAME;
    const password = process.env.ADMIN_PASSWORD;

    const result = await ensureInitialAdmin({
        username,
        password,
        provisioningToken: process.env.ADMIN_PROVISION_SECRET
    });

    if (result.created) {
        console.log(`Admin user "${result.user.username}" created.`);
    } else {
        console.log('An admin user already exists. Nothing to do.');
    }
};

run()
    .catch(error => {
        console.error(error.message);
        process.exitCode = 1;
    })
    .finally(async () => {
        await require('../lib/prisma').$disconnect();
    });
