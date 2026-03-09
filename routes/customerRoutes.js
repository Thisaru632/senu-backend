const express = require('express');
const Customer = require('../models/Customer');
const { protectCustomer } = require('../middleware/customerAuth');
const router = express.Router();

// NOTE: authRoutes.js uses 'jsonwebtoken', let's stick to that.
const jsonwebtoken = require('jsonwebtoken');
const nodemailer = require('nodemailer');

const generateToken = (id) => {
    return jsonwebtoken.sign({ id }, process.env.JWT_SECRET || 'fallback_secret', {
        expiresIn: '30d'
    });
};

// @desc    Register a new customer
// @route   POST /api/customers/signup
router.post('/signup', async (req, res) => {
    try {
        const { name, email, password, phone } = req.body;

        const customerExists = await Customer.findOne({ email });
        if (customerExists) {
            return res.status(400).json({ message: 'Customer already exists' });
        }

        const customer = await Customer.create({
            name,
            email,
            password,
            phone,
            status: 'active' // Customers are active by default for now
        });

        if (customer) {
            res.status(201).json({
                message: 'Signup successful.',
                _id: customer._id,
                name: customer.name,
                email: customer.email,
                phone: customer.phone,
                status: customer.status,
                token: generateToken(customer._id)
            });
        } else {
            res.status(400).json({ message: 'Invalid customer data' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Authenticate customer & get token
// @route   POST /api/customers/login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        const customer = await Customer.findOne({ email }).select('+password');

        if (customer && (await customer.comparePassword(password))) {
            // Check if user is active
            if (customer.status !== 'active') {
                return res.status(403).json({
                    message: 'Your account has been deactivated. Please contact support.'
                });
            }

            // Mark as online
            await Customer.findByIdAndUpdate(customer._id, {
                isOnline: true,
                lastActive: new Date()
            });

            res.json({
                _id: customer._id,
                name: customer.name,
                email: customer.email,
                phone: customer.phone,
                status: customer.status,
                token: generateToken(customer._id)
            });
        } else {
            res.status(401).json({ message: 'Invalid email or password' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Logout a customer
// @route   POST /api/customers/logout
router.post('/logout', async (req, res) => {
    try {
        const { email } = req.body;
        if (email) {
            await Customer.findOneAndUpdate({ email: email.toLowerCase() }, {
                isOnline: false,
                lastActive: new Date()
            });
        }
        res.json({ message: 'Logged out successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Mark customer as online
// @route   POST /api/customers/mark-online
router.post('/mark-online', async (req, res) => {
    try {
        const { email } = req.body;
        if (email) {
            await Customer.findOneAndUpdate({ email: email.toLowerCase() }, {
                isOnline: true,
                lastActive: new Date()
            });
        }
        res.json({ message: 'Marked as online' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Keep session alive
// @route   POST /api/customers/heartbeat
router.post('/heartbeat', async (req, res) => {
    try {
        const { email } = req.body;
        if (email) {
            await Customer.findOneAndUpdate({ email: email.toLowerCase() }, {
                isOnline: true,
                lastActive: new Date()
            });
        }
        res.json({ status: 'alive' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Forgot password (send OTP)
// @route   POST /api/customers/forgot-password
router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        const customer = await Customer.findOne({ email });

        if (!customer) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Generate 6 digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const expires = new Date();
        expires.setMinutes(expires.getMinutes() + 10); // Expire in 10 mins

        customer.resetPasswordOTP = otp;
        customer.resetPasswordExpires = expires;
        await customer.save();

        // Send Email
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });

        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: customer.email,
            subject: 'Senu Tours - Password Reset OTP',
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
                    <h2 style="color: #0d9488;">Password Reset Request</h2>
                    <p>Hello ${customer.name},</p>
                    <p>We received a request to reset your password. Use the following OTP to proceed:</p>
                    <div style="background: #f0fdfa; padding: 15px; border-radius: 8px; text-align: center; margin: 20px 0;">
                        <span style="font-size: 28px; font-weight: bold; color: #0d9488; letter-spacing: 5px;">${otp}</span>
                    </div>
                    <p>This OTP is valid for 10 minutes. If you did not request this, please ignore this email.</p>
                    <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
                    <p style="font-size: 12px; color: #999;">Regards, <br />Senu Tours Team</p>
                </div>
            `
        };

        if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
            await transporter.sendMail(mailOptions);
            res.json({ message: 'OTP sent to your email' });
        } else {
            console.warn('EMAIL_USER and EMAIL_PASS not set in .env. OTP is:', otp);
            res.status(500).json({ message: 'Email service not configured. Please contact the administrator.' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Reset password (verify OTP & update pass)
// @route   POST /api/customers/reset-password
router.post('/reset-password', async (req, res) => {
    try {
        const { email, otp, newPassword } = req.body;
        const customer = await Customer.findOne({
            email,
            resetPasswordOTP: otp,
            resetPasswordExpires: { $gt: Date.now() }
        });

        if (!customer) {
            return res.status(400).json({ message: 'Invalid or expired OTP' });
        }

        // Set new password
        customer.password = newPassword;
        customer.resetPasswordOTP = null;
        customer.resetPasswordExpires = null;
        await customer.save();

        res.json({ message: 'Password reset successfully. You can now log in.' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Update customer profile
// @route   PUT /api/customers/profile
router.put('/profile', protectCustomer, async (req, res) => {
    try {
        const customer = await Customer.findById(req.customer._id);
        if (!customer) return res.status(404).json({ message: 'Customer not found' });

        const { name, phone } = req.body;
        if (name) customer.name = name;
        if (phone) customer.phone = phone;

        const updatedCustomer = await customer.save();
        res.json({
            _id: updatedCustomer._id,
            name: updatedCustomer.name,
            email: updatedCustomer.email,
            phone: updatedCustomer.phone,
            status: updatedCustomer.status,
            message: 'Profile updated successfully'
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Get current customer profile
// @route   GET /api/customers/me
router.get('/me', protectCustomer, async (req, res) => {
    try {
        const customer = req.customer;
        res.json({
            _id: customer._id,
            name: customer.name,
            email: customer.email,
            phone: customer.phone,
            status: customer.status
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
