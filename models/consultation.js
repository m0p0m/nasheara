const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const dataPath = path.join(__dirname, '..', 'data', 'consultations.json');

// Read all consultation requests from the file
const getAll = async () => {
    try {
        const data = await fs.readFile(dataPath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT') return [];
        throw error;
    }
};

// Save all requests to the file
const saveAll = async (requests) => {
    await fs.writeFile(dataPath, JSON.stringify(requests, null, 2));
};

// Create a new consultation request
const create = async (requestData) => {
    const requests = await getAll();
    const newRequest = {
        id: uuidv4(),
        ...requestData,
        contacted: false,
        createdAt: new Date().toISOString() // Add a timestamp
    };
    requests.push(newRequest);
    await saveAll(requests);
    return newRequest;
};

// Get all requests and group them by phone number
// If `filterContacted` is true/false, only include requests with that contacted state. If undefined, include all.
const getGroupedByPhone = async (filterContacted) => {
    let requests = await getAll();

    if (typeof filterContacted === 'boolean') {
        requests = requests.filter(r => Boolean(r.contacted) === filterContacted);
    }

    const grouped = requests.reduce((acc, request) => {
        const { phone, name, interestedInProduct, contactTime } = request;

        if (!acc[phone]) {
            acc[phone] = {
                name: name, // Assume the name is the same for the same phone number
                phone: phone,
                requests: []
            };
        }

        acc[phone].requests.push({
            id: request.id,
            interestedInProduct: interestedInProduct || '',
            contactTime: contactTime,
            submittedAt: request.createdAt || request.submittedAt || new Date().toISOString(),
            email: request.email || '',
            projectType: request.projectType || '',
            message: request.message || '',
            contacted: Boolean(request.contacted)
        });

        return acc;
    }, {});

    // Convert the object to an array for easier rendering
    return Object.values(grouped);
};

// Mark all requests with given phone as contacted (true/false)
const setContactedByPhone = async (phone, contacted = true) => {
    const requests = await getAll();
    let changed = false;
    for (let r of requests) {
        if (r.phone === phone) {
            r.contacted = Boolean(contacted);
            changed = true;
        }
    }
    if (changed) await saveAll(requests);
    return changed;
};

// Mark a single request by id as contacted/uncontacted
const setContactedById = async (id, contacted = true) => {
    const requests = await getAll();
    const index = requests.findIndex(r => r.id === id);
    if (index === -1) return false;
    requests[index].contacted = Boolean(contacted);
    await saveAll(requests);
    return true;
};


module.exports = {
    getAll,
    create,
    getGroupedByPhone
};

module.exports.setContactedByPhone = setContactedByPhone;
module.exports.setContactedById = setContactedById;
