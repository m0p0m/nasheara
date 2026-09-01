const Consultation = require('../models/consultation');
const Product = require('../models/product'); // To show product names in the form

// --- Public Facing Controller ---

// Show the consultation request form (we'll need a route for this)
const showConsultationForm = async (req, res) => {
    try {
        // We might want to pre-select a product if the user clicks from a product page
        const products = await Product.getAll(req.locale);
        const selectedProduct = req.query.product || '';
        res.render('public/consultation-form', {
            title: 'درخواست مشاوره',
            products,
            selectedProduct,
            layout: 'public/layout',
            currentPath: req.path
        });
    } catch (error) {
        res.status(500).send('Could not load consultation form.');
    }
};


// Handle the submission of the form
const submitConsultation = async (req, res) => {
    try {
        const { name, phone, interestedInProduct, contactTime, email, projectType, message } = req.body;

        if (!name || !phone) {
            return res.status(400).send('لطفاً تمام فیلدهای الزامی را پر کنید.');
        }

        // Create consultation with all fields
        await Consultation.create({ 
            name, 
            phone, 
            interestedInProduct: interestedInProduct || '', 
            contactTime,
            email: email || '',
            projectType: projectType || '',
            message: message || ''
        });

        // Redirect to a thank you page or show a success message
        res.render('public/thank-you', { 
            title: 'با تشکر - نقش آرا کاشی دست‌ساز',
            heading: 'درخواست شما ثبت شد',
            message: 'درخواست شما دریافت شد. کارشناسان نقش آرا کاشی دست‌ساز به‌زودی برای ارائه مشاوره تخصصی با شما تماس خواهند گرفت.',
            layout: 'public/layout',
            currentPath: req.path
        });

    } catch (error) {
        console.error(error);
        res.status(500).send('خطایی در ارسال درخواست شما رخ داد.');
    }
};


// --- Admin Facing Controller ---

// Display the list of grouped consultation requests
const listConsultations = async (req, res) => {
    try {
        // support ?view=handled to show contacted requests
        const view = req.query.view || 'active';
        const filterContacted = view === 'handled' ? true : (view === 'all' ? undefined : false);
        const groupedConsultations = await Consultation.getGroupedByPhone(filterContacted);
        res.render('admin/consultations/index', {
            title: 'درخواست‌های مشاوره',
            consultations: groupedConsultations,
            layout: 'admin/layout',
            currentPage: 'consultations',
            currentView: view
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Error loading consultation requests.');
    }
};

// Mark grouped requests (by phone) as contacted
const markContacted = async (req, res) => {
    try {
        const phone = req.params.phone || req.body.phone;
        if (!phone) return res.status(400).send('Phone is required');

        await Consultation.setContactedByPhone(decodeURIComponent(phone), true);
        // redirect back to active list
        res.redirect('/admin/consultations');
    } catch (error) {
        console.error(error);
        res.status(500).send('Error marking as contacted');
    }
};

// Mark a single request by id as contacted
const markContactedById = async (req, res) => {
    try {
        const id = req.params.id || req.body.id;
        if (!id) return res.status(400).send('Request id is required');

        await Consultation.setContactedById(id, true);
        res.redirect('/admin/consultations');
    } catch (error) {
        console.error(error);
        res.status(500).send('Error marking request as contacted');
    }
};

module.exports = {
    showConsultationForm,
    submitConsultation,
    listConsultations
};

module.exports.markContacted = markContacted;
module.exports.markContactedById = markContactedById;

