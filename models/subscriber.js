const { v4: uuidv4 } = require('uuid');
const prisma = require('../lib/prisma');

const getAll = () => prisma.newsletterSubscriber.findMany({ orderBy: { subscribedAt: 'desc' } });

const subscribe = async email => {
    const normalizedEmail = String(email).trim().toLowerCase();
    await prisma.newsletterSubscriber.upsert({
        where: { email: normalizedEmail },
        update: {},
        create: { id: uuidv4(), email: normalizedEmail, subscribedAt: new Date() }
    });
    return { success: true, message: 'Subscribed successfully' };
};

const deleteById = async id => {
    await prisma.newsletterSubscriber.deleteMany({ where: { id } });
};

module.exports = { getAll, subscribe, delete: deleteById };
