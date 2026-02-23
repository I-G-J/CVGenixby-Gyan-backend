import express from 'express';
import Resume from '../models/Resume.js';
import { generateResumePDF } from '../services/pdfGenerator.js';
import { generateSummaryWithAI } from '../services/aiService.js';
import { verifyToken } from '../services/auth.js';

const router = express.Router();

// ============= VALIDATION FUNCTIONS =============

// Validate URL format
const validateURL = (url) => {
  if (!url) return true; // Optional field
  try {
    const urlString = String(url).trim();
    if (!urlString) return true;
    
    // Check if it's a valid URL format
    if (urlString.startsWith('http://') || urlString.startsWith('https://') || 
        urlString.startsWith('mailto:') || urlString.startsWith('www.')) {
      try {
        new URL(urlString.startsWith('www.') ? 'https://' + urlString : urlString);
        return true;
      } catch {
        return false;
      }
    }
    return false; // URL without protocol
  } catch {
    return false;
  }
};

// Validate phone number
const validatePhoneNumber = (phone) => {
  if (!phone) return true; // Optional field
  const phoneString = String(phone).trim();
  // Remove special characters and check length (7-15 digits valid for most countries)
  const digitsOnly = phoneString.replace(/\\D/g, '');
  return digitsOnly.length >= 7 && digitsOnly.length <= 15;
};

// Validate CGPA/Grade
const validateCGPA = (cgpa) => {
  if (!cgpa) return true; // Optional field
  const cgpaNum = parseFloat(cgpa);
  return !isNaN(cgpaNum) && cgpaNum >= 0 && cgpaNum <= 10;
};

// Validate date order
const validateDateOrder = (start, end) => {
  if (!start || !end || String(end).toLowerCase() === 'present') return true;
  
  const startNum = parseInt(start);
  const endNum = parseInt(end);
  
  if (!isNaN(startNum) && !isNaN(endNum)) {
    if (/^\\d+$/.test(String(start)) && /^\\d+$/.test(String(end))) {
      return endNum >= startNum;
    }
  }

  const startDate = new Date(start);
  const endDate = new Date(end);
  
  if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
    return endDate >= startDate;
  }
  
  return true;
};

// Comprehensive validation helper
const validateResumeData = (personal, projects, experiences, educations, certificates) => {
  const errors = [];

  // Validate personal info
  if (personal) {
    if (personal.email && !String(personal.email).includes('@')) {
      errors.push('Invalid email format');
    }
    if (personal.phone && !validatePhoneNumber(personal.phone)) {
      errors.push('Invalid phone number (must be 7-15 digits)');
    }
    if (personal.linkedin && !validateURL(personal.linkedin)) {
      errors.push('Invalid LinkedIn URL. Include https://');
    }
    if (personal.github && !validateURL(personal.github)) {
      errors.push('Invalid GitHub URL. Include https://');
    }
    if (personal.portfolio && !validateURL(personal.portfolio)) {
      errors.push('Invalid Portfolio URL. Include https://');
    }
  }

  // Validate projects
  if (Array.isArray(projects)) {
    projects.forEach((proj, idx) => {
      if (proj.link && !validateURL(proj.link)) {
        errors.push(`Project ${idx + 1}: Invalid project URL format. Include https://`);
      }
    });
  }

  // Validate experiences
  if (Array.isArray(experiences)) {
    experiences.forEach((exp, idx) => {
      if (exp.startDate && exp.endDate && !validateDateOrder(exp.startDate, exp.endDate)) {
        errors.push(`Experience ${idx + 1} (${exp.company || 'Unknown'}): End date cannot be before start date`);
      }
    });
  }

  // Validate educations
  if (Array.isArray(educations)) {
    educations.forEach((edu, idx) => {
      if (edu.startYear && edu.endYear && !validateDateOrder(edu.startYear, edu.endYear)) {
        errors.push(`Education ${idx + 1} (${edu.institution || 'Unknown'}): End year cannot be before start year`);
      }
      if (edu.grade && !validateCGPA(edu.grade)) {
        errors.push(`Education ${idx + 1}: CGPA must be between 0 and 10`);
      }
    });
  }

  // Validate certificates
  if (Array.isArray(certificates)) {
    certificates.forEach((cert, idx) => {
      if (cert.link && !validateURL(cert.link)) {
        errors.push(`Certificate ${idx + 1}: Invalid URL format. Include https://`);
      }
    });
  }

  return errors;
};

// ============= SANITIZATION FUNCTIONS =============
const sanitizeProjects = (projects) => {
  if (!Array.isArray(projects)) return [];
  return projects.map(proj => ({
    title: String(proj.title || ''),
    description: String(proj.description || ''),
    technologies: String(proj.technologies || ''),
    // Ensure link is always a string
    link: typeof proj.link === 'string' ? proj.link : (proj.link?.url || '')
  }));
};

// Helper function to sanitize experiences
const sanitizeExperiences = (experiences) => {
  if (!Array.isArray(experiences)) return [];
  return experiences.map(exp => ({
    company: String(exp.company || ''),
    role: String(exp.role || ''),
    startDate: String(exp.startDate || ''),
    endDate: String(exp.endDate || '').toLowerCase() === 'present' ? 'Present' : String(exp.endDate || ''),
    description: String(exp.description || '')
  }));
};

// Helper function to sanitize educations
const sanitizeEducations = (educations) => {
  if (!Array.isArray(educations)) return [];
  return educations.map(edu => ({
    institution: String(edu.institution || ''),
    degree: String(edu.degree || ''),
    field: String(edu.field || ''),
    startYear: String(edu.startYear || ''),
    endYear: String(edu.endYear || '').toLowerCase() === 'present' ? 'Present' : String(edu.endYear || ''),
    grade: String(edu.grade || '')
  }));
};

// Helper function to sanitize certificates
const sanitizeCertificates = (certificates) => {
  if (!Array.isArray(certificates)) return [];
  return certificates.map(cert => ({
    name: String(cert.name || ''),
    description: String(cert.description || ''),
    link: String(cert.link || '')
  }));
};

// Helper to sanitize personal info
const sanitizePersonal = (personal) => {
  if (!personal || typeof personal !== 'object') return {};
  return {
    fullName: String(personal.fullName || ''),
    email: String(personal.email || ''),
    phone: String(personal.phone || ''),
    location: String(personal.location || ''),
    // Ensure URLs are strings
    linkedin: typeof personal.linkedin === 'string' ? personal.linkedin : (personal.linkedin?.url || ''),
    github: typeof personal.github === 'string' ? personal.github : (personal.github?.url || ''),
    portfolio: typeof personal.portfolio === 'string' ? personal.portfolio : (personal.portfolio?.url || '')
  };
};

// Apply JWT auth middleware to all routes
router.use(verifyToken);

// @route   POST /api/resumes
// @desc    Create a new resume
// @access  Private
router.post('/', async (req, res) => {
  try {
    // Use req.user from verifyToken middleware
    const user = req.user;

    const {
      title,
      color,
      personal,
      summary,
      skills,
      projects,
      experiences,
      educations,
      achievements,
      certificates
    } = req.body;

    // Sanitize data to ensure proper formats
    const sanitizedPersonal = sanitizePersonal(personal);
    const sanitizedProjects = sanitizeProjects(projects);
    const sanitizedExperiences = sanitizeExperiences(experiences);
    const sanitizedEducations = sanitizeEducations(educations);
    const sanitizedCertificates = sanitizeCertificates(certificates);

    // Validate all data comprehensively
    const validationErrors = validateResumeData(
      sanitizedPersonal,
      sanitizedProjects,
      sanitizedExperiences,
      sanitizedEducations,
      sanitizedCertificates
    );
    if (validationErrors.length > 0) {
      // Parse error messages into structured format for frontend
      const structuredErrors = validationErrors.map(err => {
        // Extract field name from error message
        let field = 'general';
        let message = err;
        
        if (err.includes('Personal:')) {
          field = 'personal';
          message = err.replace('Personal: ', '');
        } else if (err.includes('Project')) {
          field = 'projects';
          message = err;
        } else if (err.includes('Experience')) {
          field = 'experiences';
          message = err;
        } else if (err.includes('Education')) {
          field = 'educations';
          message = err;
        } else if (err.includes('Certificate')) {
          field = 'certificates';
          message = err;
        }
        
        return { field, message };
      });
      
      return res.status(400).json({ 
        message: 'Validation failed', 
        validationErrors: structuredErrors,
        errors: validationErrors 
      });
    }

    // Create new resume
    const resume = new Resume({
      user: user._id,
      title: title || 'My Resume',
      color: color || '#1e3a8a',
      personal: sanitizedPersonal,
      summary: summary || '',
      skills: skills || {},
      projects: sanitizedProjects,
      experiences: sanitizedExperiences,
      educations: sanitizedEducations,
      achievements: achievements || '',
      certificates: sanitizedCertificates
    });

    await resume.save();

    res.status(201).json({
      message: 'Resume created successfully',
      resume
    });
  } catch (error) {
    console.error('Create resume error:', error);
    res.status(500).json({ message: 'Error creating resume' });
  }
});

// @route   GET /api/resumes
// @desc    Get all resumes for current user
// @access  Private
router.get('/', async (req, res) => {
  try {
    const user = req.user;

    // Get all resumes for user
    const resumes = await Resume.find({ user: user._id })
      .sort({ updatedAt: -1 });

    res.json({
      message: 'Resumes retrieved successfully',
      resumes
    });
  } catch (error) {
    console.error('Get resumes error:', error);
    res.status(500).json({ message: 'Error getting resumes' });
  }
});

// @route   GET /api/resumes/:id
// @desc    Get single resume by ID
// @access  Private
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;

    // Get resume by ID
    const resume = await Resume.findOne({ _id: id, user: user._id });
    
    if (!resume) {
      return res.status(404).json({ message: 'Resume not found' });
    }

    res.json({
      message: 'Resume retrieved successfully',
      resume
    });
  } catch (error) {
    console.error('Get resume error:', error);
    res.status(500).json({ message: 'Error getting resume' });
  }
});

// @route   PUT /api/resumes/:id
// @desc    Update a resume
// @access  Private
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;

    const {
      title,
      color,
      personal,
      summary,
      skills,
      projects,
      experiences,
      educations,
      achievements,
      certificates
    } = req.body;

    // Sanitize data to ensure proper formats
    const sanitizedPersonal = sanitizePersonal(personal);
    const sanitizedProjects = sanitizeProjects(projects);
    const sanitizedExperiences = sanitizeExperiences(experiences);
    const sanitizedEducations = sanitizeEducations(educations);
    const sanitizedCertificates = sanitizeCertificates(certificates);

    // Validate all data
    const validationErrors = validateResumeData(
      sanitizedPersonal,
      sanitizedProjects,
      sanitizedExperiences,
      sanitizedEducations,
      sanitizedCertificates
    );
    if (validationErrors.length > 0) {
      // Parse error messages into structured format for frontend
      const structuredErrors = validationErrors.map(err => {
        let field = 'general';
        let message = err;
        
        if (err.includes('Personal:')) {
          field = 'personal';
          message = err.replace('Personal: ', '');
        } else if (err.includes('Project')) {
          field = 'projects';
          message = err;
        } else if (err.includes('Experience')) {
          field = 'experiences';
          message = err;
        } else if (err.includes('Education')) {
          field = 'educations';
          message = err;
        } else if (err.includes('Certificate')) {
          field = 'certificates';
          message = err;
        }
        
        return { field, message };
      });
      
      return res.status(400).json({ 
        message: 'Validation failed', 
        validationErrors: structuredErrors,
        errors: validationErrors 
      });
    }

    // Find and update resume
    const resume = await Resume.findOneAndUpdate(
      { _id: id, user: user._id },
      {
        title: title || 'My Resume',
        color: color || '#1e3a8a',
        personal: sanitizedPersonal,
        summary,
        skills,
        projects: sanitizedProjects,
        experiences: sanitizedExperiences,
        educations: sanitizedEducations,
        achievements,
        certificates: sanitizedCertificates
      },
      { new: true, runValidators: true }
    );
    
    if (!resume) {
      return res.status(404).json({ message: 'Resume not found' });
    }

    res.json({
      message: 'Resume updated successfully',
      resume
    });
  } catch (error) {
    console.error('Update resume error:', error);
    res.status(500).json({ message: 'Error updating resume' });
  }
});

// @route   DELETE /api/resumes/:id
// @desc    Delete a resume
// @access  Private
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;

    // Find and delete resume
    const resume = await Resume.findOneAndDelete({ _id: id, user: user._id });
    
    if (!resume) {
      return res.status(404).json({ message: 'Resume not found' });
    }

    res.json({
      message: 'Resume deleted successfully'
    });
  } catch (error) {
    console.error('Delete resume error:', error);
    res.status(500).json({ message: 'Error deleting resume' });
  }
});

// @route   POST /api/resumes/:id/generate-summary
// @desc    Generate professional summary using AI
// @access  Private
router.post('/:id/generate-summary', async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;

    // Get resume by ID
    const resume = await Resume.findOne({ _id: id, user: user._id });
    
    if (!resume) {
      return res.status(404).json({ message: 'Resume not found' });
    }

    // Generate summary using AI
    const aiSummary = await generateSummaryWithAI({
      title: resume.title,
      personal: resume.personal,
      skills: resume.skills,
      experiences: resume.experiences,
      educations: resume.educations
    });

    res.json({
      message: 'Summary generated successfully',
      summary: aiSummary
    });
  } catch (error) {
    console.error('Generate summary error:', error);
    res.status(500).json({ 
      message: 'Error generating summary',
      error: error.message 
    });
  }
});

// @route   GET /api/resumes/:id/pdf
// @desc    Export resume as PDF
// @access  Private
router.get('/:id/pdf', async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;

    // Get resume by ID
    const resume = await Resume.findOne({ _id: id, user: user._id });
    
    if (!resume) {
      return res.status(404).json({ message: 'Resume not found' });
    }

    // Generate PDF
    const pdfBuffer = await generateResumePDF(resume.toObject());

    // Set response headers for PDF download
    const fileName = `${resume.title || 'resume'}.pdf`.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Export PDF error:', error);
    res.status(500).json({ message: 'Error generating PDF' });
  }
});

// @route   POST /api/resumes/:id/duplicate
// @desc    Duplicate a resume
// @access  Private
router.post('/:id/duplicate', async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;

    // Get original resume
    const originalResume = await Resume.findOne({ _id: id, user: user._id });
    
    if (!originalResume) {
      return res.status(404).json({ message: 'Resume not found' });
    }

    // Create duplicate resume
    const duplicateResume = new Resume({
      user: user._id,
      title: `${originalResume.title} (Copy)`,
      color: originalResume.color,
      personal: originalResume.personal,
      summary: originalResume.summary,
      skills: originalResume.skills,
      projects: originalResume.projects,
      experiences: originalResume.experiences,
      educations: originalResume.educations,
      isDefault: false
    });

    await duplicateResume.save();

    res.status(201).json({
      message: 'Resume duplicated successfully',
      resume: duplicateResume
    });
  } catch (error) {
    console.error('Duplicate resume error:', error);
    res.status(500).json({ message: 'Error duplicating resume' });
  }
});

export default router;
