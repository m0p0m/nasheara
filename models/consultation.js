const { v4: uuidv4 } = require('uuid');
const prisma = require('../lib/prisma');

const getAll = () => prisma.consultation.findMany({ orderBy: { createdAt: 'desc' } });

const create = input => prisma.consultation.create({
    data: {
        id: uuidv4(), name: input.name, phone: input.phone,
        interestedInProduct: input.interestedInProduct || '', contactTime: input.contactTime || null,
        email: input.email || '', projectType: input.projectType || '', message: input.message || '',
        contacted: false, createdAt: new Date()
    }
});

const getGroupedByPhone = async filterContacted => {
    const requests = await prisma.consultation.findMany({
        where: typeof filterContacted === 'boolean' ? { contacted: filterContacted } : {},
        orderBy: { createdAt: 'desc' }
    });
    const grouped = requests.reduce((acc, request) => {
        if (!acc[request.phone]) acc[request.phone] = { name: request.name, phone: request.phone, requests: [] };
        acc[request.phone].requests.push({
            id: request.id, interestedInProduct: request.interestedInProduct || '',
            contactTime: request.contactTime, submittedAt: request.createdAt || request.submittedAt,
            email: request.email || '', projectType: request.projectType || '', message: request.message || '',
            contacted: Boolean(request.contacted)
        });
        return acc;
    }, {});
    return Object.values(grouped);
};

const setContactedByPhone = async (phone, contacted = true) => {
    const result = await prisma.consultation.updateMany({ where: { phone }, data: { contacted: Boolean(contacted) } });
    return result.count > 0;
};

const setContactedById = async (id, contacted = true) => {
    const result = await prisma.consultation.updateMany({ where: { id }, data: { contacted: Boolean(contacted) } });
    return result.count > 0;
};

module.exports = { getAll, create, getGroupedByPhone, setContactedByPhone, setContactedById };
