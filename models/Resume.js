import mongoose from 'mongoose';

const resumeSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    required: true,
    default: 'My Resume'
  },
  personal: {
    fullName: { type: String, default: '' },
    email: { type: String, default: '' },
    phone: { type: String, default: '' },
    location: { type: String, default: '' },
    linkedin: { type: String, default: '' },
    github: { type: String, default: '' },
    portfolio: { type: String, default: '' }
  },
  summary: {
    type: String,
    default: ''
  },
  skills: {
    languages: { type: String, default: '' },
    frameworks: { type: String, default: '' },
    tools: { type: String, default: '' }
  },
  projects: [{
    title: { type: String, default: '' },
    description: { type: String, default: '' },
    technologies: { type: String, default: '' },
    link: { type: String, default: '' }
  }],
  experiences: [{
    company: { type: String, default: '' },
    role: { type: String, default: '' },
    startDate: { type: String, default: '' },
    endDate: { type: String, default: '' },
    description: { type: String, default: '' }
  }],
  educations: [{
    institution: { type: String, default: '' },
    degree: { type: String, default: '' },
    field: { type: String, default: '' },
    startYear: { type: String, default: '' },
    endYear: { type: String, default: '' },
    grade: { type: String, default: '' }
  }],
  achievements: {
    type: String,
    default: ''
  },
  certificates: [{
    name: { type: String, default: '' },
    description: { type: String, default: '' }
  }],
  atsScore: {
    type: Number,
    default: 0
  },
  isDefault: {
    type: Boolean,
    default: false
  },
  color: {
    type: String,
    default: '#1e3a8a' // Default dark blue
  }
}, {
  timestamps: true
});

// Calculate ATS score before saving
resumeSchema.pre('save', async function() {
  let score = 0;
  const missing = [];
  
  // Personal info (15 points)
  if (this.personal.fullName && this.personal.email) {
    score += 15;
  } else {
    missing.push('Personal Info');
  }
  
  // Summary (15 points)
  if (this.summary && this.summary.trim().length > 20) {
    score += 15;
  } else {
    missing.push('Summary');
  }
  
  // Skills (20 points)
  if (this.skills.languages || this.skills.frameworks || this.skills.tools) {
    score += 20;
  } else {
    missing.push('Skills');
  }
  
  // Projects (10 points)
  if (this.projects && this.projects.some(p => p.title)) {
    score += 10;
  } else {
    missing.push('Projects');
  }
  
  // Experience (20 points)
  if (this.experiences && this.experiences.some(e => e.company)) {
    score += 20;
  } else {
    missing.push('Experience');
  }
  
  // Education (10 points)
  if (this.educations && this.educations.some(e => e.institution)) {
    score += 10;
  } else {
    missing.push('Education');
  }
  
  // Achievements (7 points)
  if (this.achievements && this.achievements.trim().length > 10) {
    score += 7;
  } else {
    missing.push('Achievements');
  }
  
  // Certificates (3 points)
  if (this.certificates && this.certificates.some(c => c.name)) {
    score += 3;
  } else {
    missing.push('Certificates');
  }
  
  this.atsScore = score;
});

const Resume = mongoose.model('Resume', resumeSchema);

export default Resume;
