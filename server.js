import express from 'express';
import mongoose from 'mongoose';
import session from 'express-session';
import MongoStore from 'connect-mongo';
import passport from 'passport';
import cors from 'cors';
import dotenv from 'dotenv';
import { ClerkExpressWithAuth } from '@clerk/clerk-sdk-node';
import authRoutes from './routes/auth.js';
import resumeRoutes from './routes/resumes.js';
import templateRoutes from './routes/templates.js';
import adminRoutes from './routes/admin.js';
import passportConfig from './config/passport.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/cvgenix';
const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Create session store
const sessionStore = MongoStore.create({
  mongoUrl: MONGO_URI,
  touchAfter: 24 * 3600, // 24 hours
});

// Handle session store errors
sessionStore.on('error', (error) => {
  console.error('Session store error:', error);
});

// Session configuration
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'your-session-secret-change-in-production',
    resave: false,
    saveUninitialized: false,
    store: sessionStore,
    cookie: {
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
    },
  })
);

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());
passportConfig(passport);

// MongoDB Connection Options
const mongoOptions = {
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
};

mongoose
  .connect(MONGO_URI, mongoOptions)
  .then(() => {
    console.log('Connected to MongoDB');
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err.message);
    console.log('Note: If using MongoDB Atlas free tier, ensure your cluster is not paused.');
    console.log('You can resume it from MongoDB Atlas dashboard.');
  });

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/resumes', resumeRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/admin', adminRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Backend is running' });
});

// Root route
app.get('/', (req, res) => {
  res.send('Hello from the backend!');
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

export default app;
