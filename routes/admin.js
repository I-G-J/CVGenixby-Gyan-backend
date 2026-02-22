import express from 'express';
import User from '../models/User.js';
import Resume from '../models/Resume.js';
import { verifyToken, requireAdmin } from '../services/auth.js';

const router = express.Router();

// Apply JWT auth middleware to all routes
router.use(verifyToken);
router.use(requireAdmin);

// @route   GET /api/admin/stats
// @desc    Get dashboard statistics
// @access  Admin only
router.get('/stats', async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalResumes = await Resume.countDocuments();
    
    // Calculate average ATS score
    const resumeStats = await Resume.aggregate([
      {
        $group: {
          _id: null,
          avgAtsScore: { $avg: '$atsScore' }
        }
      }
    ]);

    const avgAtsScore = resumeStats.length > 0 ? resumeStats[0].avgAtsScore : 0;

    res.json({
      stats: {
        totalUsers,
        totalResumes,
        avgAtsScore
      }
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    res.status(500).json({ message: 'Error fetching stats' });
  }
});

// @route   GET /api/admin/users
// @desc    Get all users with resume counts
// @access  Admin only
router.get('/users', async (req, res) => {
  try {
    // Get all users
    const users = await User.find()
      .select('name email role createdAt')
      .lean();

    // Get resume count for each user
    const usersWithResumes = await Promise.all(
      users.map(async (user) => {
        const resumeCount = await Resume.countDocuments({ user: user._id });
        return {
          ...user,
          resumeCount
        };
      })
    );

    // Sort by resume count descending
    usersWithResumes.sort((a, b) => b.resumeCount - a.resumeCount);

    res.json({
      users: usersWithResumes
    });
  } catch (error) {
    console.error('Admin users error:', error);
    res.status(500).json({ message: 'Error fetching users' });
  }
});

// @route   GET /api/admin/resumes
// @desc    Get all resumes with user info
// @access  Admin only
router.get('/resumes', async (req, res) => {
  try {
    const resumes = await Resume.find()
      .populate('user', 'name email')
      .select('title atsScore createdAt updatedAt user')
      .lean()
      .sort({ updatedAt: -1 });

    res.json({
      resumes
    });
  } catch (error) {
    console.error('Admin resumes error:', error);
    res.status(500).json({ message: 'Error fetching resumes' });
  }
});

export default router;
