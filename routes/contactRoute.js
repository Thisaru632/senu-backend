const express = require('express');
const router = express.Router();
const Contact = require('../models/Contact');

// GET all contact messages
router.get('/', async (req, res) => {
    try {
        const { status, reason, limit = 50, page = 1 } = req.query;

        const filter = {};
        if (status) {
            filter.status = status;
        }
        if (reason) {
            filter.reason = reason;
        }

        const contacts = await Contact.find(filter)
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .skip((parseInt(page) - 1) * parseInt(limit));

        const total = await Contact.countDocuments(filter);

        res.json({
            contacts,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// GET a single contact message by ID
router.get('/:id', async (req, res) => {
    try {
        const contact = await Contact.findById(req.params.id);

        if (!contact) {
            return res.status(404).json({ message: 'Contact message not found' });
        }

        // Mark as read if it's new
        if (contact.status === 'new') {
            contact.status = 'read';
            await contact.save();
        }

        res.json(contact);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// POST a new contact message
router.post('/', async (req, res) => {
    const {
        fullName,
        email,
        phoneNumber,
        reason,
        preferredTravelDates,
        numberOfGuests,
        message
    } = req.body;

    const contact = new Contact({
        fullName,
        email,
        phoneNumber,
        reason,
        preferredTravelDates,
        numberOfGuests,
        message
    });

    try {
        const newContact = await contact.save();

        // TODO: Send email notification to admin
        // TODO: Send confirmation email to user

        res.status(201).json({
            message: 'Your message has been sent successfully!',
            contact: newContact
        });
    } catch (err) {
        if (err.name === 'ValidationError') {
            const errors = Object.values(err.errors).map(e => e.message);
            return res.status(400).json({
                message: 'Validation failed',
                errors
            });
        }
        res.status(400).json({ message: err.message });
    }
});

// PATCH update contact status
router.patch('/:id/status', async (req, res) => {
    try {
        const { status, remark } = req.body;
        const allowedStatuses = ['new', 'read', 'responded', 'archived', 'Confirmed', 'Rejected'];

        if (!allowedStatuses.includes(status)) {
            return res.status(400).json({ message: 'Invalid status value' });
        }

        const contact = await Contact.findById(req.params.id);

        if (!contact) {
            return res.status(404).json({ message: 'Contact message not found' });
        }

        contact.status = status;
        if (remark !== undefined) {
            contact.staffRemark = remark;
        }

        if (status === 'responded') {
            contact.respondedAt = new Date();
        }

        await contact.save();

        res.json({
            message: 'Status updated successfully',
            contact
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// PATCH pick a contact (assign to employee)
router.patch('/:id/pick', async (req, res) => {
    try {
        const { employeeName } = req.body;
        if (!employeeName) {
            return res.status(400).json({ message: 'Employee name is required' });
        }

        const contact = await Contact.findById(req.params.id);
        if (!contact) {
            return res.status(404).json({ message: 'Contact message not found' });
        }

        contact.employeeName = employeeName;

        // Optionally mark as read if it's currently new
        if (contact.status === 'new') {
            contact.status = 'read';
        }

        await contact.save();

        res.json({ message: 'Lead picked successfully', contact });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// PUT update entire contact message (for admin edits/notes or partial lead completion)
router.put('/:id', async (req, res) => {
    try {
        const contact = await Contact.findById(req.params.id);

        if (!contact) {
            return res.status(404).json({ message: 'Contact message not found' });
        }

        // Allow updating all fields except ID
        const updates = req.body;

        Object.keys(updates).forEach(update => {
            if (update !== '_id') {
                contact[update] = updates[update];
            }
        });

        await contact.save();
        res.json(contact);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// DELETE a contact message
router.delete('/:id', async (req, res) => {
    try {
        const contact = await Contact.findByIdAndDelete(req.params.id);

        if (!contact) {
            return res.status(404).json({ message: 'Contact message not found' });
        }

        res.json({ message: 'Contact message deleted successfully' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// GET statistics (useful for admin dashboard)
router.get('/stats/summary', async (req, res) => {
    try {
        const total = await Contact.countDocuments();
        const newMessages = await Contact.countDocuments({ status: 'new' });
        const responded = await Contact.countDocuments({ status: 'responded' });
        const archived = await Contact.countDocuments({ status: 'archived' });

        res.json({
            total,
            new: newMessages,
            responded,
            archived,
            unread: newMessages
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;