const express = require('express');
const jwt = require('jsonwebtoken');
const Staff = require('../models/Staff');
const Booking = require('../models/Booking');
const Contact = require('../models/Contact');
const router = express.Router();

// Generate JWT
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET || 'fallback_secret', {
        expiresIn: '30d'
    });
};

// @desc    Register a new staff member
// @route   POST /api/auth/signup
// @access  Public (In a real app, this might be restricted to admins)
router.post('/signup', async (req, res) => {
    try {
        const { username, fullName, email, password } = req.body;

        const staffExists = await Staff.findOne({ $or: [{ email }, { username }] });
        if (staffExists) {
            return res.status(400).json({ message: 'User already exists' });
        }

        const staff = await Staff.create({
            username,
            fullName,
            email,
            password
        });

        if (staff) {
            res.status(201).json({
                message: 'Signup successful. Your account is pending approval by the Super Admin.',
                _id: staff._id,
                username: staff.username,
                fullName: staff.fullName,
                email: staff.email,
                status: staff.status
            });
        } else {
            res.status(400).json({ message: 'Invalid staff data' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Authenticate staff & get token
// @route   POST /api/auth/login
// @access  Public
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        const staff = await Staff.findOne({ email }).select('+password');

        if (staff && (await staff.comparePassword(password))) {
            // Check if user is approved
            if (staff.status !== 'active') {
                return res.status(403).json({
                    message: staff.status === 'pending'
                        ? 'Your account is pending approval by the Super Admin.'
                        : 'Your account has been rejected. Please contact the administrator.'
                });
            }

            // Mark as online
            await Staff.findByIdAndUpdate(staff._id, { isOnline: true });

            res.json({
                _id: staff._id,
                username: staff.username,
                fullName: staff.fullName,
                email: staff.email,
                token: generateToken(staff._id)
            });
        } else {
            res.status(401).json({ message: 'Invalid email or password' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Logout a staff member (mark as offline)
// @route   POST /api/auth/logout
// @access  Public
router.post('/logout', async (req, res) => {
    try {
        const { email, username } = req.body;
        const query = email ? { email } : { username };
        await Staff.findOneAndUpdate(query, {
            isOnline: false,
            lastLogout: new Date()
        });
        res.json({ message: 'Logged out successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Mark a staff member as online (called on app load if already authenticated)
// @route   POST /api/auth/mark-online
// @access  Public
router.post('/mark-online', async (req, res) => {
    try {
        const { email, username } = req.body;
        const query = email ? { email } : { username };
        await Staff.findOneAndUpdate(query, { isOnline: true });
        res.json({ message: 'Marked as online' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Get all staff members with their performance stats
// @route   GET /api/auth/employees
// @access  Private (In a real app, use auth middleware)
router.get('/employees', async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        const dateFilter = {};
        if (startDate && endDate) {
            dateFilter.createdAt = {
                $gte: new Date(startDate),
                $lte: new Date(new Date(endDate).setHours(23, 59, 59, 999))
            };
        }

        // Fetch all staff
        const staffList = await Staff.find({}, 'username fullName email role isOnline lastLogout createdAt');

        // Fetch stats for bookings
        const bookingStats = await Booking.aggregate([
            { $match: dateFilter },
            {
                $group: {
                    _id: "$employeeName",
                    total: { $sum: 1 },
                    confirmed: { $sum: { $cond: [{ $eq: ["$status", "Confirmed"] }, 1, 0] } },
                    pending: { $sum: { $cond: [{ $eq: ["$status", "Pending"] }, 1, 0] } },
                    rejected: { $sum: { $cond: [{ $eq: ["$status", "Cancelled"] }, 1, 0] } }
                }
            }
        ]);

        // Fetch stats for contacts
        const contactStats = await Contact.aggregate([
            { $match: dateFilter },
            {
                $group: {
                    _id: "$employeeName",
                    total: { $sum: 1 },
                    confirmed: { $sum: { $cond: [{ $eq: ["$status", "responded"] }, 1, 0] } },
                    pending: { $sum: { $cond: [{ $eq: ["$status", "new"] }, 1, 0] } },
                    rejected: { $sum: { $cond: [{ $eq: ["$status", "archived"] }, 1, 0] } }
                }
            }
        ]);

        // Merge stats with staff list
        const performanceData = staffList.map(staff => {
            const bStat = bookingStats.find(s => s._id === staff.fullName || s._id === staff.username) || { total: 0, confirmed: 0, pending: 0, rejected: 0 };
            const cStat = contactStats.find(s => s._id === staff.fullName || s._id === staff.username) || { total: 0, confirmed: 0, pending: 0, rejected: 0 };

            const total = bStat.total + cStat.total;
            const confirmed = bStat.confirmed + cStat.confirmed;
            const pending = bStat.pending + cStat.pending;
            const rejected = bStat.rejected + cStat.rejected;
            const notContacted = pending; // Simplified logic

            return {
                name: staff.fullName || staff.username,
                username: staff.username,
                email: staff.email,
                isOnline: staff.isOnline || false,
                lastLogout: staff.lastLogout || null,
                total,
                confirmed,
                pending,
                rejected,
                notContacted,
                rate: total > 0 ? (confirmed / total) * 100 : 0
            };
        });

        // Fetch global lead stats
        const totalLeads = await Booking.countDocuments(dateFilter) + await Contact.countDocuments(dateFilter);
        const confirmedLeads = await Booking.countDocuments({ ...dateFilter, status: "Confirmed" }) + await Contact.countDocuments({ ...dateFilter, status: "responded" });
        const pendingLeads = await Booking.countDocuments({ ...dateFilter, status: "Pending" }) + await Contact.countDocuments({ ...dateFilter, status: "new" });
        const rejectedLeads = await Booking.countDocuments({ ...dateFilter, status: "Cancelled" }) + await Contact.countDocuments({ ...dateFilter, status: "archived" });

        res.json({
            performance: performanceData,
            stats: {
                totalLeads,
                confirmedLeads,
                pendingLeads,
                rejectedLeads,
                notContactedLeads: pendingLeads,
                notFollowedYet: pendingLeads // Placeholder for now
            },
            packageStats: {
                totalPackages: 0, // Need package model for this
                packageBookings: totalLeads,
                canceledBookings: rejectedLeads
            }
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Get all users for management
// @route   GET /api/auth/users
// @access  Public (should be Admin)
router.get('/users', async (req, res) => {
    try {
        const users = await Staff.find({}, 'username fullName email role isOnline createdAt permissions status');
        res.json(users);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Update user (role, permissions, or status)
// @route   PUT /api/auth/users/:id
router.get('/users/:id', async (req, res) => {
    try {
        const user = await Staff.findById(req.params.id);
        if (!user) return res.status(404).json({ message: 'User not found' });
        res.json(user);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

router.put('/users/:id', async (req, res) => {
    try {
        const { role, permissions, status } = req.body;
        const user = await Staff.findById(req.params.id);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (role) user.role = role;
        if (permissions) user.permissions = permissions;
        if (status) user.status = status;

        await user.save();
        res.json({ message: 'User updated successfully', user });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Delete user
// @route   DELETE /api/auth/users/:id
router.delete('/users/:id', async (req, res) => {
    try {
        const user = await Staff.findByIdAndDelete(req.params.id);
        if (!user) return res.status(404).json({ message: 'User not found' });
        res.json({ message: 'User deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Get user profile
// @route   GET /api/auth/profile
// @access  Private
// This would need a middleware to protect it
router.get('/profile', async (req, res) => {
    // Middleware would set req.user
    res.json({ message: 'Profile route' });
});

module.exports = router;
