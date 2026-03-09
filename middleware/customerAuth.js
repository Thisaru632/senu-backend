const jwt = require('jsonwebtoken');
const Customer = require('../models/Customer');

const protectCustomer = async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');

            req.customer = await Customer.findById(decoded.id).select('-password');

            if (!req.customer) {
                return res.status(401).json({ message: 'Not authorized, customer not found' });
            }

            if (req.customer.status !== 'active') {
                return res.status(403).json({ message: 'Account is ' + req.customer.status });
            }

            next();
        } catch (error) {
            console.error(error);
            res.status(401).json({ message: 'Not authorized, token failed' });
        }
    }

    if (!token) {
        res.status(401).json({ message: 'Not authorized, no token' });
    }
};

module.exports = { protectCustomer };
