import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Middleware to verify JWT and attach user to request
export const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Get user from database
    const user = await User.findById(decoded.id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Invalid or expired token' });
    }
    res.status(500).json({ message: 'Server error' });
  }
};

// Middleware to check if user is admin
export const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  next();
};

export default { verifyToken, requireAdmin };
