const Testimonial = require('../models/testimonial');

const validationError = input => {
    if (!String(input.name || '').trim()) return 'نام مشتری الزامی است.';
    if (String(input.text || '').trim().length < 10) return 'متن نظر باید حداقل ۱۰ کاراکتر باشد.';
    return null;
};

exports.list = async (req, res) => {
    try {
        const testimonials = await Testimonial.getAll();
        res.render('admin/testimonials/index', {
            title: 'مدیریت نظرات مشتریان',
            testimonials,
            error: req.query.error || null,
            currentPage: 'testimonials',
            layout: 'admin/layout'
        });
    } catch (error) {
        console.error('Error listing testimonials:', error);
        res.status(500).send('Server Error');
    }
};

exports.create = async (req, res) => {
    const error = validationError(req.body);
    if (error) return res.redirect(`/admin/testimonials?error=${encodeURIComponent(error)}`);
    try {
        await Testimonial.create(req.body);
        res.redirect('/admin/testimonials');
    } catch (err) {
        console.error('Error creating testimonial:', err);
        res.status(500).send('Server Error');
    }
};

exports.showEdit = async (req, res) => {
    try {
        const testimonial = await Testimonial.findById(req.params.id);
        if (!testimonial) return res.status(404).send('نظر یافت نشد.');
        res.render('admin/testimonials/edit', {
            title: 'ویرایش نظر',
            testimonial,
            currentPage: 'testimonials',
            layout: 'admin/layout'
        });
    } catch (error) {
        console.error('Error loading testimonial:', error);
        res.status(500).send('Server Error');
    }
};

exports.update = async (req, res) => {
    const error = validationError(req.body);
    if (error) return res.redirect(`/admin/testimonials?error=${encodeURIComponent(error)}`);
    try {
        await Testimonial.update(req.params.id, req.body);
        res.redirect('/admin/testimonials');
    } catch (err) {
        console.error('Error updating testimonial:', err);
        res.status(500).send('Server Error');
    }
};

exports.toggle = async (req, res) => {
    try {
        const testimonial = await Testimonial.findById(req.params.id);
        if (testimonial) await Testimonial.setPublished(testimonial.id, !testimonial.published);
        res.redirect('/admin/testimonials');
    } catch (err) {
        console.error('Error toggling testimonial:', err);
        res.status(500).send('Server Error');
    }
};

exports.remove = async (req, res) => {
    try {
        await Testimonial.remove(req.params.id);
        res.redirect('/admin/testimonials');
    } catch (err) {
        console.error('Error deleting testimonial:', err);
        res.status(500).send('Server Error');
    }
};
