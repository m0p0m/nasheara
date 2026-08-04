const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const dataPath = path.join(__dirname, '..', 'data', 'subscribers.json');

const getAll = async () => {
    try {
        const data = await fs.readFile(dataPath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT') {
            await fs.mkdir(path.dirname(dataPath), { recursive: true }).catch(() => {});
            await fs.writeFile(dataPath, '[]');
            return [];
        }
        throw error;
    }
};

const saveAll = async (subscribers) => {
    const tempPath = dataPath + '.tmp';
    await fs.mkdir(path.dirname(dataPath), { recursive: true }).catch(() => {});
    await fs.writeFile(tempPath, JSON.stringify(subscribers, null, 2));
    await fs.rename(tempPath, dataPath);
};

const deleteById = async (id) => {
    const subscribers = await getAll();
    const filtered = subscribers.filter(s => s.id !== id);
    if (subscribers.length !== filtered.length) {
        await saveAll(filtered);
    }
};

const subscribe = async (email) => {
    const subscribers = await getAll();
    if (subscribers.find(s => s.email === email)) {
        return { success: true, message: 'Already subscribed' };
    }
    const newSubscriber = {
        id: uuidv4(),
        email,
        subscribedAt: new Date().toISOString()
    };
    subscribers.push(newSubscriber);
    await saveAll(subscribers);
    return { success: true, message: 'Subscribed successfully' };
};

module.exports = {
    getAll,
    subscribe,
    delete: deleteById
};
