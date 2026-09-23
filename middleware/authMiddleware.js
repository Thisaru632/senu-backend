const jwt = require('jsonwebtoken');
const Staff = require('../models/Staff');

const protect = async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            // Get token from header
            token = req.headers.authorization.split(' ')[1];

            if (!token || token === 'null' || token === 'undefined') {
                return res.status(401).json({ message: 'Not authorized, no token' });
            }

            // Verify token with configured secret, fallback secret, or allow expired token continuity
            let decoded;
            try {
                decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
            } catch (err) {
                if (process.env.JWT_SECRET) {
                    try {
                        decoded = jwt.verify(token, 'fallback_secret');
                    } catch (fallbackErr) {
                        if (err.name === 'TokenExpiredError' || fallbackErr.name === 'TokenExpiredError') {
                            decoded = jwt.decode(token);
                        } else {
                            throw err;
                        }
                    }
                } else if (err.name === 'TokenExpiredError') {
                    decoded = jwt.decode(token);
                } else {
                    throw err;
                }
            }

            if (!decoded || !decoded.id) {
                return res.status(401).json({ message: 'Not authorized, token invalid' });
            }

            // Get user from the token
            req.user = await Staff.findById(decoded.id).select('-password');

            if (!req.user) {
                return res.status(401).json({ message: 'Not authorized, user not found' });
            }

            if (req.user.status !== 'active') {
                return res.status(403).json({ message: 'Not authorized, account is ' + req.user.status });
            }

            return next();
        } catch (error) {
            console.error('Auth protect error:', error.message);
            return res.status(401).json({ message: 'Not authorized, token failed' });
        }
    }

    if (!token) {
        return res.status(401).json({ message: 'Not authorized, no token' });
    }
};

const superAdminOnly = (req, res, next) => {
    const role = (req.user?.role || '').toLowerCase();
    if (req.user && (role === 'superadmin' || role === 'admin' || req.user?.permissions?.hrSection)) {
        return next();
    } else {
        return res.status(403).json({ message: 'Not authorized as a super admin' });
    }
};

module.exports = { protect, superAdminOnly };
