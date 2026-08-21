const Subscriber = require('../models/subscriber');

exports.subscribe = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).send('Email is required');
        }
        await Subscriber.subscribe(email);
        const locale = req.locale || 'fa';
        res.redirect(`/${locale}/?subscribed=1`);
    } catch (error) {
        console.error('Newsletter subscription error:', error);
        res.status(500).send('An error occurred. Please try again later.');
    }
};
