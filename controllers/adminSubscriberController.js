const Subscriber = require('../models/subscriber');

exports.listSubscribers = async (req, res) => {
    try {
        const subscribers = await Subscriber.getAll();
        res.render('admin/subscribers/list', {
            title: 'لیست خبرنامه',
            subscribers,
            currentPage: 'subscribers',
            layout: 'admin/layout'
        });
    } catch (error) {
        console.error('Error listing subscribers:', error);
        res.status(500).send('Server Error');
    }
};

exports.deleteSubscriber = async (req, res) => {
    try {
        const { id } = req.params;
        await Subscriber.delete(id);
        res.redirect('/admin/subscribers');
    } catch (error) {
        console.error('Error deleting subscriber:', error);
        res.status(500).send('Server Error');
    }
};
