import express from 'express';
import { ClerkExpressWithAuth, clerkClient } from '@clerk/clerk-sdk-node';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const router = express.Router();

// JWT secret - in production, use environment variable
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// List of disposable email domains to block
const DISPOSABLE_EMAIL_DOMAINS = [
  'tempmail.com',
  'temp-mail.org',
  'throwaway.email',
  'guerrillamail.com',
  'mailinator.com',
  '10minutemail.com',
  'trashmail.com',
  'fakeinbox.com',
  'yopmail.com',
  'getnada.com',
  'maildrop.cc',
  'dispostable.com',
  'sharklasers.com',
  'spam4.me',
  'tempail.com',
  'mintemail.com',
  'emailondeck.com',
  'fake-email.com',
  'mohmal.com',
  'temp.email',
];

// Function to check if email is from a disposable domain
const isDisposableEmail = (email) => {
  const domain = email.split('@')[1]?.toLowerCase();
  return DISPOSABLE_EMAIL_DOMAINS.includes(domain);
};

// Function to get or create user from Clerk
const getOrCreateUser = async (clerkUser) => {
  const email = clerkUser.emailAddresses[0]?.emailAddress?.toLowerCase();
  const name = clerkUser.firstName || clerkUser.username || 'User';
  
  // Find existing user by clerk ID or email
  let user = await User.findOne({ 
    $or: [
      { clerkId: clerkUser.id },
      { email: email }
    ]
  });

  if (!user) {
    // Create new user with default role 'user'
    user = new User({
      name: name,
      email: email,
      clerkId: clerkUser.id,
      role: 'user',
      isVerified: true,
    });
    await user.save();
  } else {
    // Update clerkId if not set
    if (!user.clerkId) {
      user.clerkId = clerkUser.id;
      await user.save();
    }
  }

  return user;
};

// Clerk authentication middleware
const clerkAuth = ClerkExpressWithAuth({
  secretKey: process.env.CLERK_SECRET_KEY,
});

// Register/Sync user (called after Clerk sign up)
router.post('/sync-user', clerkAuth, async (req, res) => {
  try {
    const { userId } = req.auth;
    
    // Get user from Clerk
    const clerkUser = await clerkClient.users.getUser(userId);
    
    const email = clerkUser.emailAddresses[0]?.emailAddress?.toLowerCase();
    
    // Check if email is disposable
    if (isDisposableEmail(email)) {
      return res.status(400).json({ 
        message: 'Disposable email addresses are not allowed. Please use a permanent email address.' 
      });
    }
    
    // Get or create user in our database
    const user = await getOrCreateUser(clerkUser);
    
    // Generate JWT token
    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role, clerkId: user.clerkId },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'User synced successfully',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Sync user error:', error);
    res.status(500).json({ message: 'Error syncing user' });
  }
});

// Login user with Clerk
router.post('/login', clerkAuth, async (req, res) => {
  try {
    const { userId } = req.auth;
    
    // Get user from Clerk
    const clerkUser = await clerkClient.users.getUser(userId);
    
    const email = clerkUser.emailAddresses[0]?.emailAddress?.toLowerCase();
    
    // Find user in database
    const user = await User.findOne({ 
      $or: [
        { clerkId: userId },
        { email: email }
      ]
    });
    
    if (!user) {
      // Auto-create user if not exists (first login)
      const newUser = await getOrCreateUser(clerkUser);
      
      const token = jwt.sign(
        { id: newUser._id, email: newUser.email, role: newUser.role, clerkId: newUser.clerkId },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      return res.json({
        message: 'Login successful',
        token,
        user: {
          id: newUser._id,
          name: newUser.name,
          email: newUser.email,
          role: newUser.role
        }
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role, clerkId: user.clerkId },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Error during login' });
  }
});

// Logout user
router.post('/logout', (req, res) => {
  // Clerk handles logout on the frontend
  res.json({ message: 'Logout successful' });
});

// Get current user (for session verification)
router.get('/me', async (req, res) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];

    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Get user from database
    const user = await User.findById(decoded.id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Invalid or expired token' });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// Check if email is allowed (for frontend validation before Clerk sign up)
router.post('/check-email', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }
    
    const emailLower = email.toLowerCase();
    
    // Check if disposable email
    if (isDisposableEmail(emailLower)) {
      return res.status(400).json({ 
        allowed: false,
        message: 'Disposable email addresses are not allowed. Please use a permanent email address.' 
      });
    }
    
    // Check if already registered
    const existingUser = await User.findOne({ email: emailLower });
    if (existingUser) {
      return res.status(400).json({ 
        allowed: false,
        message: 'Email already registered' 
      });
    }
    
    res.json({ 
      allowed: true,
      message: 'Email is allowed' 
    });
  } catch (error) {
    console.error('Check email error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update user role (admin only endpoint)
router.put('/update-role', clerkAuth, async (req, res) => {
  try {
    const { userId, role } = req.body;
    const { userId: adminId } = req.auth;
    
    // Get admin user from database
    const adminUser = await User.findOne({ clerkId: adminId });
    
    if (!adminUser || adminUser.role !== 'admin') {
      return res.status(403).json({ message: 'Only admins can update roles' });
    }
    
    if (!['user', 'admin'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role' });
    }
    
    // Find and update user
    const user = await User.findOne({ clerkId: userId });
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    user.role = role;
    await user.save();
    
    res.json({
      message: 'Role updated successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Update role error:', error);
    res.status(500).json({ message: 'Error updating role' });
  }
});

export default router;