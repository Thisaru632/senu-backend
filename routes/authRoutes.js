const express = require('express');
const jwt = require('jsonwebtoken');
const Staff = require('../models/Staff');
const Attendance = require('../models/Attendance');
const Customer = require('../models/Customer');
const Booking = require('../models/Booking');
const Contact = require('../models/Contact');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const router = express.Router();
const { protect, superAdminOnly } = require('../middleware/authMiddleware');

// Helper functions for date and time in configured timezone (default Asia/Colombo - UTC+5:30)
const TIMEZONE = process.env.TIMEZONE || 'Asia/Colombo';

const getLocalDateStr = (date = new Date()) => {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: TIMEZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).format(date);
};

const getLocalTimeStr = (date = new Date()) => {
    return new Intl.DateTimeFormat('en-US', {
        timeZone: TIMEZONE,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
    }).format(date);
};

// Generate JWT
const generateToken = (id, role) => {
    let expiry = '1h'; // Default for staff
    if (role === 'admin' || role === 'superadmin') {
        expiry = '4h';
    }
    return jwt.sign({ id }, process.env.JWT_SECRET || 'fallback_secret', {
        expiresIn: expiry
    });
};

// @desc    Get notification counts (unread leads)
// @route   GET /api/auth/notifications/count
router.get('/notifications/count', async (req, res) => {
    console.log('HIT: GET /notifications/count');
    try {
        const unviewedBookings = await Booking.countDocuments({ isViewed: false });
        const unreadContacts = await Contact.countDocuments({ status: 'new' });
        res.json({
            bookings: unviewedBookings,
            contacts: unreadContacts,
            total: unviewedBookings + unreadContacts
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Get notifications list
// @route   GET /api/auth/notifications
router.get('/notifications', async (req, res) => {
    console.log('HIT: GET /notifications');
    try {
        const unviewedBookings = await Booking.find({ isViewed: false }).sort({ createdAt: -1 }).limit(5);
        const unreadContacts = await Contact.find({ status: 'new' }).sort({ createdAt: -1 }).limit(5);

        const notifications = [
            ...unviewedBookings.map(b => ({
                id: b._id,
                type: 'booking',
                title: 'New Booking',
                subtitle: `${b.name} - ${b.vehicleName}`,
                createdAt: b.createdAt
            })),
            ...unreadContacts.map(c => ({
                id: c._id,
                type: 'contact',
                title: 'New Inquiry',
                subtitle: `${c.fullName} - ${c.reason}`,
                createdAt: c.createdAt
            }))
        ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 10);

        res.json(notifications);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Mark all notifications as read
// @route   POST /api/auth/notifications/mark-all-read
router.post('/notifications/mark-all-read', async (req, res) => {
    console.log('HIT: POST /notifications/mark-all-read');
    try {
        await Booking.updateMany({ isViewed: false }, { isViewed: true });
        await Contact.updateMany({ status: 'new' }, { status: 'read' });
        res.json({ message: 'All notifications marked as read' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

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
            await Staff.findByIdAndUpdate(staff._id, {
                isOnline: true,
                lastActive: new Date()
            });

            res.json({
                _id: staff._id,
                username: staff.username,
                fullName: staff.fullName,
                email: staff.email,
                role: staff.role,
                permissions: staff.permissions,
                token: generateToken(staff._id, staff.role)
            });
        } else {
            res.status(401).json({ message: 'Invalid email or password' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Clock in staff member by E NO and password
// @route   POST /api/auth/clock-in
// @access  Public
router.post('/clock-in', async (req, res) => {
    try {
        const { eNo, password, location } = req.body;

        if (!eNo || !password) {
            return res.status(400).json({ message: 'Please enter both E NO and Password' });
        }

        const trimmedENo = eNo.trim();
        const escapedENo = trimmedENo.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
        const cleanedENo = trimmedENo.replace(/[^a-zA-Z0-9]/g, '');

        // Find staff by eNo (exact or regex match from MongoDB Staff collection)
        let staff = await Staff.findOne({
            $or: [
                { eNo: { $regex: new RegExp(`^${escapedENo}$`, 'i') } },
                { eNo: { $regex: new RegExp(cleanedENo, 'i') } },
                { username: { $regex: new RegExp(`^${escapedENo}$`, 'i') } },
                { email: { $regex: new RegExp(`^${escapedENo}$`, 'i') } }
            ]
        }).select('+password');

        if (!staff) {
            return res.status(404).json({ message: `No staff user found with E NO: ${trimmedENo}` });
        }

        const isMatch = await staff.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid password for this E NO' });
        }

        // Activate staff account if pending
        if (staff.status === 'pending') {
            staff.status = 'active';
        }

        const todayStr = getLocalDateStr();
        const clockInTimeStr = getLocalTimeStr();

        // Update staff online status
        staff.isOnline = true;
        staff.lastActive = new Date();
        await staff.save();

        // Check if there is an active session (status: 'Clocked In') for today
        let attendanceRecord = await Attendance.findOne({
            staffId: staff._id,
            date: todayStr,
            status: 'Clocked In'
        });

        if (attendanceRecord) {
            attendanceRecord.status = 'Clocked In';
            attendanceRecord.clockInTime = clockInTimeStr;
            attendanceRecord.clockOutTime = 'Active Session';
            if (location) attendanceRecord.clockInLocation = location;
            await attendanceRecord.save();
        } else {
            attendanceRecord = await Attendance.create({
                staffId: staff._id,
                eNo: staff.eNo || trimmedENo,
                fullName: staff.fullName,
                email: staff.email,
                date: todayStr,
                clockInTime: clockInTimeStr,
                clockOutTime: 'Active Session',
                clockInLocation: location || '',
                status: 'Clocked In'
            });
        }

        res.json({
            message: `Successfully Clocked In as ${staff.fullName}!`,
            record: {
                eNo: staff.eNo || trimmedENo,
                name: staff.fullName,
                email: staff.email,
                clockInTime: clockInTimeStr,
                date: todayStr,
                status: 'Clocked In'
            }
        });
    } catch (error) {
        console.error('Clock in error:', error);
        res.status(500).json({ message: error.message || 'Server error during clock in' });
    }
});

// @desc    Check clock-in status by E NO
// @route   POST /api/auth/clock-status
// @access  Public
router.post('/clock-status', async (req, res) => {
    try {
        const { eNo } = req.body;
        if (!eNo || !eNo.trim()) {
            return res.json({ isClockedIn: false });
        }

        const trimmedENo = eNo.trim();
        const escapedENo = trimmedENo.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
        const todayStr = getLocalDateStr();

        // Find staff by eNo
        let staff = await Staff.findOne({
            $or: [
                { eNo: { $regex: new RegExp(`^${escapedENo}$`, 'i') } },
                { username: { $regex: new RegExp(`^${escapedENo}$`, 'i') } }
            ]
        });

        if (!staff) {
            return res.json({ isClockedIn: false });
        }

        const activeRecord = await Attendance.findOne({
            staffId: staff._id,
            date: todayStr,
            status: 'Clocked In'
        });

        res.json({
            isClockedIn: !!activeRecord,
            record: activeRecord || null
        });
    } catch (error) {
        res.status(500).json({ isClockedIn: false });
    }
});

// @desc    Clock out staff member by E NO and password
// @route   POST /api/auth/clock-out
// @access  Public
router.post('/clock-out', async (req, res) => {
    try {
        const { eNo, password, location } = req.body;

        if (!eNo || !password) {
            return res.status(400).json({ message: 'Please enter both E NO and Password' });
        }

        const trimmedENo = eNo.trim();
        const escapedENo = trimmedENo.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
        const cleanedENo = trimmedENo.replace(/[^a-zA-Z0-9]/g, '');

        // Find staff by eNo from MongoDB Staff collection
        let staff = await Staff.findOne({
            $or: [
                { eNo: { $regex: new RegExp(`^${escapedENo}$`, 'i') } },
                { eNo: { $regex: new RegExp(cleanedENo, 'i') } },
                { username: { $regex: new RegExp(`^${escapedENo}$`, 'i') } },
                { email: { $regex: new RegExp(`^${escapedENo}$`, 'i') } }
            ]
        }).select('+password');

        if (!staff) {
            return res.status(404).json({ message: `No staff user found with E NO: ${trimmedENo}` });
        }

        const isMatch = await staff.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid password for this E NO' });
        }

        const todayStr = getLocalDateStr();
        const clockOutTimeStr = getLocalTimeStr();

        // Update staff online status
        staff.isOnline = false;
        await staff.save();

        let attendanceRecord = await Attendance.findOne({
            staffId: staff._id,
            date: todayStr,
            status: 'Clocked In'
        });

        if (!attendanceRecord) {
            attendanceRecord = await Attendance.findOne({
                staffId: staff._id,
                date: todayStr
            });
        }

        if (attendanceRecord) {
            attendanceRecord.status = 'Clocked Out';
            attendanceRecord.clockOutTime = clockOutTimeStr;
            attendanceRecord.clockOutDate = todayStr;
            if (location) attendanceRecord.clockOutLocation = location;
            await attendanceRecord.save();
        } else {
            attendanceRecord = await Attendance.create({
                staffId: staff._id,
                eNo: staff.eNo || trimmedENo,
                fullName: staff.fullName,
                email: staff.email,
                date: todayStr,
                clockOutDate: todayStr,
                clockInTime: '08:30 AM',
                clockOutTime: clockOutTimeStr,
                clockOutLocation: location || '',
                status: 'Clocked Out'
            });
        }

        res.json({
            message: `Successfully Clocked Out as ${staff.fullName}!`,
            record: {
                eNo: staff.eNo || trimmedENo,
                name: staff.fullName,
                email: staff.email,
                clockOutTime: clockOutTimeStr,
                date: todayStr,
                status: 'Clocked Out'
            }
        });
    } catch (error) {
        console.error('Clock out error:', error);
        res.status(500).json({ message: error.message || 'Server error during clock out' });
    }
});

// @desc    Get daily staff attendance logs (ONLY users who clocked in via Clock in/out screen)
// @route   GET /api/auth/attendance
// @access  Public
router.get('/attendance', async (req, res) => {
    try {
        let query = {};
        if (req.query.month) {
            query.date = { $regex: new RegExp(`^${req.query.month}`) };
        } else if (req.query.all !== 'true') {
            const todayStr = getLocalDateStr();
            query.date = todayStr;
        }

        const logs = await Attendance.find(query).sort({ date: -1, updatedAt: -1 });

        const attendanceSheet = logs.map(log => ({
            id: log._id,
            eNo: log.eNo,
            name: log.fullName,
            email: log.email,
            date: log.date,
            clockInDate: log.date,
            clockOutDate: log.clockOutDate || (log.status === 'Clocked Out' ? log.date : '-'),
            clockInTime: log.clockInTime,
            clockOutTime: log.clockOutTime || 'Active Session',
            clockInLocation: log.clockInLocation || '',
            clockOutLocation: log.clockOutLocation || '',
            status: log.status || 'Clocked In'
        }));

        res.json(attendanceSheet);
    } catch (error) {
        console.error('Fetch attendance error:', error);
        res.status(500).json({ message: error.message || 'Failed to fetch attendance sheet' });
    }
});

// @desc    Get user-wise monthly attendance summary (all staff members, 1 row per user)
// @route   GET /api/auth/monthly-attendance?month=YYYY-MM
// @access  Public
router.get('/monthly-attendance', async (req, res) => {
    try {
        const monthQuery = req.query.month || getLocalDateStr().slice(0, 7); // Default e.g. "2026-08"
        const [yearStr, monthStr] = monthQuery.split('-');
        const year = parseInt(yearStr, 10);
        const month = parseInt(monthStr, 10);

        // Days in month
        const totalDaysInMonth = new Date(year, month, 0).getDate();
        const totalWorkingDays = Math.min(22, totalDaysInMonth);

        // Format Month Label e.g. "August 2026"
        const monthDate = new Date(year, month - 1, 1);
        const monthLabel = monthDate.toLocaleString('en-US', { month: 'long', year: 'numeric' });

        // Fetch all registered staff members
        const staffMembers = await Staff.find({ status: { $ne: 'rejected' } }).select('eNo fullName username email avatar role');

        // Fetch all Attendance logs matching monthQuery (e.g. date matching "^2026-08")
        const monthRegex = new RegExp(`^${monthQuery}`);
        const monthlyLogs = await Attendance.find({ date: { $regex: monthRegex } }).sort({ date: 1, updatedAt: -1 });

        // Helper to parse duration in minutes
        const calculateDurationMinutes = (clockInStr, clockOutStr) => {
            if (!clockInStr || !clockOutStr || clockOutStr === 'Active Session' || clockOutStr === '-') {
                return 0;
            }
            try {
                const parseTime = (timeStr) => {
                    const match = timeStr.match(/(\d+):(\d+)(?::(\d+))?\s*(AM|PM)?/i);
                    if (!match) return null;
                    let hours = parseInt(match[1], 10);
                    const minutes = parseInt(match[2], 10);
                    const seconds = match[3] ? parseInt(match[3], 10) : 0;
                    const ampm = match[4] ? match[4].toUpperCase() : null;

                    if (ampm === 'PM' && hours < 12) hours += 12;
                    if (ampm === 'AM' && hours === 12) hours = 0;

                    const date = new Date();
                    date.setHours(hours, minutes, seconds, 0);
                    return date;
                };

                const inTime = parseTime(clockInStr);
                const outTime = parseTime(clockOutStr);
                if (!inTime || !outTime) return 0;

                let diffMs = outTime.getTime() - inTime.getTime();
                if (diffMs < 0) diffMs += 24 * 60 * 60 * 1000;
                return Math.floor(diffMs / (1000 * 60));
            } catch (e) {
                return 0;
            }
        };

        const formatMinutesToString = (totalMins) => {
            if (!totalMins || totalMins <= 0) return '0 hrs';
            const hrs = Math.floor(totalMins / 60);
            const mins = Math.round(totalMins % 60);

            if (hrs === 0 && mins === 0) return '0 hrs';
            if (hrs === 0) return `${mins}m`;
            if (mins === 0) return `${hrs}h`;
            return `${hrs}h ${mins}m`;
        };

        // Group logs by user
        const logsByUser = new Map();
        monthlyLogs.forEach(log => {
            const key = (log.eNo || log.email || '').toLowerCase().trim();
            if (!key) return;
            if (!logsByUser.has(key)) {
                logsByUser.set(key, []);
            }
            logsByUser.get(key).push(log);
        });

        const monthlySummary = [];
        const processedKeys = new Set();

        const processUserSummary = (staffObj) => {
            const key = (staffObj.eNo || staffObj.email || staffObj.username || '').toLowerCase().trim();
            if (!key || processedKeys.has(key)) return;
            processedKeys.add(key);

            const userLogs = logsByUser.get(key) || [];
            
            // Dates where user was present
            const presentDates = new Set(userLogs.map(l => l.date));
            const daysPresent = presentDates.size;
            const daysAbsent = Math.max(0, totalWorkingDays - daysPresent);

            let totalMinsNum = 0;
            let otMinsNum = 0;
            let shortLeavesCount = 0;

            const dailyMinutesMap = new Map();
            userLogs.forEach(l => {
                const mins = calculateDurationMinutes(l.clockInTime, l.clockOutTime);
                dailyMinutesMap.set(l.date, (dailyMinutesMap.get(l.date) || 0) + mins);
            });

            dailyMinutesMap.forEach((dayMins) => {
                totalMinsNum += dayMins;
                if (dayMins > 480) { // > 8 hours
                    otMinsNum += (dayMins - 480);
                }
                if (dayMins > 0 && dayMins < 240) { // < 4 hours
                    shortLeavesCount += 1;
                }
            });

            const formattedTotalHours = formatMinutesToString(totalMinsNum);
            const formattedOtHours = formatMinutesToString(otMinsNum);

            monthlySummary.push({
                id: staffObj._id ? staffObj._id.toString() : (staffObj.id || key),
                eNo: staffObj.eNo || 'N/A',
                name: staffObj.fullName || staffObj.name || staffObj.username || 'Staff User',
                email: staffObj.email || '',
                avatar: staffObj.avatar || '',
                month: monthLabel,
                totalDays: totalWorkingDays,
                daysPresent,
                daysAbsent,
                shortLeaves: shortLeavesCount,
                leaves: daysAbsent,
                totalHours: formattedTotalHours,
                otHours: formattedOtHours,
            });
        };

        // 1. Process staff members
        staffMembers.forEach(staff => processUserSummary(staff));

        // 2. Process any additional users found in logs
        monthlyLogs.forEach(log => processUserSummary({
            id: log._id.toString(),
            eNo: log.eNo,
            name: log.fullName,
            email: log.email,
            avatar: ''
        }));

        res.json(monthlySummary);
    } catch (error) {
        console.error('Fetch monthly attendance error:', error);
        res.status(500).json({ message: error.message || 'Failed to fetch monthly attendance' });
    }
});


// @desc    Update attendance log by ID
// @route   PUT /api/auth/attendance/:id
// @access  Public
router.put('/attendance/:id', async (req, res) => {
    try {
        const { clockInTime, clockOutTime, status } = req.body;
        const attendance = await Attendance.findById(req.params.id);

        if (!attendance) {
            return res.status(404).json({ message: 'Attendance record not found' });
        }

        if (clockInTime !== undefined) attendance.clockInTime = clockInTime;
        if (clockOutTime !== undefined) attendance.clockOutTime = clockOutTime;
        if (status !== undefined) attendance.status = status;

        await attendance.save();

        res.json({ message: 'Attendance record updated successfully', attendance });
    } catch (error) {
        console.error('Update attendance error:', error);
        res.status(500).json({ message: error.message || 'Failed to update attendance record' });
    }
});

// @desc    Logout a staff member (mark as offline)
// @route   POST /api/auth/logout
// @access  Public
router.post('/logout', async (req, res) => {
    try {
        const { email, username } = req.body;
        console.log(`[Auth] Logout request for: ${email || username}`);
        const query = email ? { email: email.toLowerCase() } : { username };
        const result = await Staff.findOneAndUpdate(query, {
            isOnline: false,
            lastLogout: new Date()
        });
        if (result) {
            console.log(`[Auth] Successfully logged out: ${result.username}`);
        } else {
            console.log(`[Auth] Logout failed: User not found for ${email || username}`);
        }
        res.json({ message: 'Logged out successfully' });
    } catch (error) {
        console.error(`[Auth] Logout error:`, error);
        res.status(500).json({ message: error.message });
    }
});

// @desc    Mark a staff member as online (called on app load if already authenticated)
// @route   POST /api/auth/mark-online
// @access  Public
router.post('/mark-online', async (req, res) => {
    try {
        const { email, username } = req.body;
        console.log(`[Auth] Mark-online request for: ${email || username}`);
        const query = email ? { email: email.toLowerCase() } : { username };
        const result = await Staff.findOneAndUpdate(query, {
            isOnline: true,
            lastActive: new Date()
        });
        if (result) {
            console.log(`[Auth] Successfully marked online: ${result.username}`);
        }
        res.json({ message: 'Marked as online' });
    } catch (error) {
        console.error(`[Auth] Mark-online error:`, error.message);
        res.status(500).json({ message: error.message });
    }
});

// @desc    Heartbeat to keep session alive
// @route   POST /api/auth/heartbeat
// @access  Public
router.post('/heartbeat', async (req, res) => {
    try {
        const { email, username } = req.body;
        const query = email ? { email: email.toLowerCase() } : { username };
        await Staff.findOneAndUpdate(query, {
            isOnline: true,
            lastActive: new Date()
        });
        res.json({ status: 'alive' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Forgot password (send OTP)
// @route   POST /api/auth/forgot-password
// @access  Public
router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        const staff = await Staff.findOne({ email });

        if (!staff) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Generate 6 digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const expires = new Date();
        expires.setMinutes(expires.getMinutes() + 10); // Expire in 10 mins

        staff.resetPasswordOTP = otp;
        staff.resetPasswordExpires = expires;
        await staff.save();

        // Send Email
        const transporter = nodemailer.createTransport({
            service: 'gmail', // or use host/port for custom SMTP
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });

        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: staff.email,
            subject: 'Senu Tours - Password Reset OTP',
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
                    <h2 style="color: #0d9488;">Password Reset Request</h2>
                    <p>Hello ${staff.fullName},</p>
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
// @route   POST /api/auth/reset-password
// @access  Public
router.post('/reset-password', async (req, res) => {
    try {
        const { email, otp, newPassword } = req.body;
        const staff = await Staff.findOne({
            email,
            resetPasswordOTP: otp,
            resetPasswordExpires: { $gt: Date.now() }
        });

        if (!staff) {
            return res.status(400).json({ message: 'Invalid or expired OTP' });
        }

        // Set new password
        staff.password = newPassword;
        staff.resetPasswordOTP = null;
        staff.resetPasswordExpires = null;
        await staff.save();

        res.json({ message: 'Password reset successfully. You can now log in.' });
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

        // Automatically mark users as offline if no activity for 2 minutes
        const threshold = new Date(Date.now() - 2 * 60 * 1000); // 2 minutes
        await Staff.updateMany(
            { lastActive: { $lt: threshold }, isOnline: true },
            { isOnline: false }
        );

        // Fetch all staff
        const staffList = await Staff.find({}, 'username fullName email role isOnline lastLogout createdAt lastActive');

        // Fetch stats for bookings
        const bookingStats = await Booking.aggregate([
            { $match: dateFilter },
            {
                $group: {
                    _id: "$employeeName",
                    total: { $sum: 1 },
                    confirmed: { $sum: { $cond: [{ $eq: ["$status", "Confirmed"] }, 1, 0] } },
                    sentInquiries: { $sum: { $cond: [{ $eq: ["$status", "Sent Inquiry"] }, 1, 0] } },
                    rejected: { $sum: { $cond: [{ $in: ["$status", ["Rejected", "Cancelled"]] }, 1, 0] } },
                    ignored: { $sum: { $cond: [{ $eq: ["$status", "Ignored"] }, 1, 0] } }
                }
            }
        ]);

        // Merge stats with staff list
        const performanceData = staffList.map(staff => {
            const bStat = bookingStats.find(s => s._id === staff.fullName || s._id === staff.username) || { total: 0, confirmed: 0, sentInquiries: 0, rejected: 0 };

            const total = bStat.total;
            const confirmed = bStat.confirmed;
            const sentInquiries = bStat.sentInquiries;
            const rejected = bStat.rejected;
            const ignored = bStat.ignored || 0;

            return {
                name: staff.fullName || staff.username,
                username: staff.username,
                email: staff.email,
                isOnline: staff.isOnline || false,
                lastLogout: staff.lastLogout || null,
                total,
                confirmed,
                sentInquiries,
                rejected,
                ignored,
                rate: total > 0 ? (confirmed / total) * 100 : 0
            };
        });

        // Fetch global BOOKING-ONLY lead stats (contacts/inquiries excluded from this section)
        const totalLeads = await Booking.countDocuments(dateFilter);
        const confirmedLeads = await Booking.countDocuments({ ...dateFilter, status: "Confirmed" });
        const pendingLeads = await Booking.countDocuments({ ...dateFilter, status: "Pending" });
        // Count both 'Rejected' and 'Cancelled' so neither is missed on the dashboard
        const rejectedLeads = await Booking.countDocuments({ ...dateFilter, status: { $in: ["Rejected", "Cancelled"] } });
        const sentInquiries = await Booking.countDocuments({ ...dateFilter, status: "Sent Inquiry" });

        res.json({
            performance: performanceData,
            stats: {
                totalLeads,
                confirmedLeads,
                pendingLeads,
                rejectedLeads,
                sentInquiries,
                ignoredLeads: await Booking.countDocuments({ ...dateFilter, status: "Ignored" }),
            },
            packageStats: {
                totalPackages: 0,
                packageBookings: 0,
                canceledBookings: 0
            }
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Get all users for management
// @route   GET /api/auth/users
// @access  Private (Super Admin Only)
router.get('/users', protect, superAdminOnly, async (req, res) => {
    try {
        // Automatically mark users as offline if no activity for 2 minutes
        const threshold = new Date(Date.now() - 2 * 60 * 1000); // 2 minutes
        await Staff.updateMany(
            { lastActive: { $lt: threshold }, isOnline: true },
            { isOnline: false }
        );

        const users = await Staff.find({}, 'username fullName email role isOnline createdAt permissions status lastActive eNo');
        res.json(users);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Update user (role, permissions, or status)
// @route   PUT /api/auth/users/:id
// @access  Private (Super Admin Only)
router.get('/users/:id', protect, superAdminOnly, async (req, res) => {
    try {
        const user = await Staff.findById(req.params.id);
        if (!user) return res.status(404).json({ message: 'User not found' });
        res.json(user);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

router.put('/users/:id', protect, superAdminOnly, async (req, res) => {
    try {
        const { role, permissions, status, eNo, fullName, name } = req.body;
        const user = await Staff.findById(req.params.id);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (role) user.role = role;
        if (permissions) user.permissions = permissions;
        if (status) user.status = status;
        if (eNo !== undefined) user.eNo = eNo;
        if (fullName !== undefined) user.fullName = fullName;
        if (name !== undefined) user.fullName = name;

        await user.save();
        res.json({ message: 'User updated successfully', user });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Super Admin change user password
// @route   PUT /api/auth/users/:id/password
// @access  Private (Super Admin Only)
router.put('/users/:id/password', protect, superAdminOnly, async (req, res) => {
    try {
        const { password } = req.body;
        const user = await Staff.findById(req.params.id);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        user.password = password;
        await user.save();

        res.json({ message: 'User password updated successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Super Admin view user password (HASHED)
// @route   GET /api/auth/users/:id/password
// @access  Private (Super Admin Only)
router.get('/users/:id/password', protect, superAdminOnly, async (req, res) => {
    try {
        const user = await Staff.findById(req.params.id).select('+password');
        if (!user) return res.status(404).json({ message: 'User not found' });

        res.json({
            password: user.password,
            note: "Passwords are encrypted (hashed) for security and cannot be shown in plain text. You can however change it to a new one."
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Delete user
// @route   DELETE /api/auth/users/:id
// @access  Private (Super Admin Only)
router.delete('/users/:id', protect, superAdminOnly, async (req, res) => {
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
module.exports = router;
