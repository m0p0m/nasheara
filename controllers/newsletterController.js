const Subscriber = require('../models/subscriber');

exports.subscribe = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).send('Email is required');
        }
        await Subscriber.subscribe(email);
        res.render('public/thank-you', {
            title: 'سپاس از شما',
            heading: 'به خبرنامه ما خوش آمدید!',
            message: 'ایمیل شما با موفقیت در سیستم ثبت شد. از این پس آخرین اخبار و تخفیف‌های نقش آرا تصفیه برای شما ارسال خواهد شد.',
            layout: 'public/layout'
        });
    } catch (error) {
        console.error('Newsletter subscription error:', error);
        res.status(500).send('An error occurred. Please try again later.');
    }
};
