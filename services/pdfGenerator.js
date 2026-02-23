import PDFDocument from 'pdfkit';

// Helper to ensure URL has protocol
const ensureProtocol = (url) => {
  if (!url || typeof url !== 'string') return null;
  
  url = url.trim();
  if (!url) return null;
  
  // If it's an email, make it a mailto link
  if (url.includes('@') && !url.includes('://')) {
    return `mailto:${url}`;
  }
  
  // If it already has a protocol, return as-is
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('mailto:')) {
    return url;
  }
  
  // Otherwise, add https://
  return `https://${url}`;
};

// Helper to parse formatted text (markdown style)
// Supports: **bold**, *italic*, __underline__
const renderFormattedText = (doc, text, xPos, yPos, options = {}) => {
  if (!text) return yPos;

  const { width = 495, align = 'left', fontSize = 8, color = '#333333' } = options;
  
  // Split text by formatting markers
  const parts = [];
  let lastIndex = 0;
  const regex = /(\*\*[^*]+\*\*|\*[^*]+\*|__[^_]+__)/g;
  let match;

  while ((match = regex.exec(text)) !== null) {
    // Add text before formatting
    if (match.index > lastIndex) {
      parts.push({ text: text.substring(lastIndex, match.index), format: 'normal' });
    }

    // Add formatted text
    const formatted = match[0];
    if (formatted.startsWith('**') && formatted.endsWith('**')) {
      parts.push({ text: formatted.slice(2, -2), format: 'bold' });
    } else if (formatted.startsWith('*') && formatted.endsWith('*')) {
      parts.push({ text: formatted.slice(1, -1), format: 'italic' });
    } else if (formatted.startsWith('__') && formatted.endsWith('__')) {
      parts.push({ text: formatted.slice(2, -2), format: 'underline' });
    }

    lastIndex = match.index + formatted.length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push({ text: text.substring(lastIndex), format: 'normal' });
  }

  // If no formatting found, just render as normal
  if (parts.length === 0) {
    doc.fillColor(color).fontSize(fontSize).font('Helvetica').text(text, xPos, yPos, { width, align });
    return yPos + doc.heightOfString(text, { width, align });
  }

  // Render each part with appropriate formatting
  let currentY = yPos;
  const lineHeight = fontSize * 1.2;

  parts.forEach(part => {
    switch (part.format) {
      case 'bold':
        doc.fillColor(color).fontSize(fontSize).font('Helvetica-Bold').text(part.text, xPos, currentY, { width, align, continued: true });
        break;
      case 'italic':
        doc.fillColor(color).fontSize(fontSize).font('Helvetica-Oblique').text(part.text, xPos, currentY, { width, align, continued: true });
        break;
      case 'underline':
        doc.fillColor(color).fontSize(fontSize).font('Helvetica').text(part.text, xPos, currentY, { width, align, continued: true, underline: true });
        break;
      default:
        doc.fillColor(color).fontSize(fontSize).font('Helvetica').text(part.text, xPos, currentY, { width, align, continued: true });
    }
  });

  doc.font('Helvetica'); // Reset font
  return currentY + lineHeight;
};

// Helper to convert text with bullet points to array
const parseBulletPoints = (text) => {
  if (!text) return [];
  return text
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);
};

// Helper to add section header
const addSectionHeader = (doc, title, xPos, yPos, primaryColor) => {
  doc.fillColor(primaryColor)
     .fontSize(9)
     .font('Helvetica-Bold')
     .text(title.toUpperCase(), xPos, yPos);
  return yPos + 12;
};

// Helper to add horizontal line
const addSeparator = (doc, primaryColor, yPos) => {
  doc.strokeColor(primaryColor)
     .lineWidth(0.5)
     .moveTo(50, yPos)
     .lineTo(545, yPos)
     .stroke();
  return yPos + 10;
};

export const generateResumePDF = (resume) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 40, bottom: 40, left: 50, right: 50 },
        bufferPages: true
      });

      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Color from resume or default
      const primaryColor = resume.color || '#1e3a8a';
      const textColor = '#333333';
      const lightGray = '#6b7280';

      // Header - Name (CENTERED)
      const nameWidth = doc.widthOfString(resume.personal?.fullName || 'Your Name');
      doc.fillColor(primaryColor)
         .fontSize(20)
         .font('Helvetica-Bold')
         .text(resume.personal?.fullName || 'Your Name', 0, 40, { width: 595, align: 'center' });

      let yPos = 68;

      // Contact Info (CENTERED)
      doc.fillColor(lightGray)
         .fontSize(9)
         .font('Helvetica');

      const contactParts = [];
      if (resume.personal?.email) contactParts.push(resume.personal.email);
      if (resume.personal?.phone) contactParts.push(resume.personal.phone);
      if (resume.personal?.location) contactParts.push(resume.personal.location);
      
      if (contactParts.length > 0) {
        doc.text(contactParts.join(' | '), 0, yPos, { width: 595, align: 'center' });
        yPos += 12;
      }

      // Links (CENTERED) - with proper protocol
      // Extract and format URLs
      let linkedinUrl = typeof resume.personal?.linkedin === 'string' ? resume.personal.linkedin : (resume.personal?.linkedin?.url || null);
      let githubUrl = typeof resume.personal?.github === 'string' ? resume.personal.github : (resume.personal?.github?.url || null);
      let portfolioUrl = typeof resume.personal?.portfolio === 'string' ? resume.personal.portfolio : (resume.personal?.portfolio?.url || null);
      
      // Ensure all URLs have proper protocols
      linkedinUrl = ensureProtocol(linkedinUrl);
      githubUrl = ensureProtocol(githubUrl);
      portfolioUrl = ensureProtocol(portfolioUrl);
      
      if (linkedinUrl || githubUrl || portfolioUrl) {
        doc.fillColor(primaryColor)
           .fontSize(8)
           .font('Helvetica');

        const centerY = yPos;

        let links = [];

        if (linkedinUrl) {
          links.push({ label: 'LinkedIn', url: linkedinUrl });
        }
        if (githubUrl) {
          links.push({ label: 'GitHub', url: githubUrl });
        }
        if (portfolioUrl) {
          links.push({ label: 'Portfolio', url: portfolioUrl });
        }

        const totalText = links.map(l => l.label).join('   |   ');
        const textWidth = doc.widthOfString(totalText);
        let startX = (595 - textWidth) / 2;

        links.forEach((link, index) => {
          const labelWidth = doc.widthOfString(link.label);

          doc.text(link.label, startX, centerY, {
            link: link.url,
            underline: true
          });

          startX += labelWidth;

          if (index !== links.length - 1) {
            const separator = '   |   ';
            doc.text(separator, startX, centerY);
            startX += doc.widthOfString(separator);
          }
        });

        yPos += 14;
      }

      // Separator line
      yPos = addSeparator(doc, primaryColor, yPos);

      // Summary
      if (resume.summary) {
        yPos = addSectionHeader(doc, 'Professional Summary', 50, yPos, primaryColor);
        yPos += 2;

        // Render formatted summary text
        yPos = renderFormattedText(doc, resume.summary, 50, yPos, {
          width: 495,
          align: 'justify',
          fontSize: 8,
          color: textColor
        }) + 8;
        
        yPos = addSeparator(doc, primaryColor, yPos);
      }

      // Education
      if (resume.educations && resume.educations.length > 0) {
        const hasEdu = resume.educations.some(e => e.institution || e.degree);
        if (hasEdu) {
          if (yPos > 650) {
            doc.addPage();
            yPos = 40;
          }

          yPos = addSectionHeader(doc, 'Education', 50, yPos, primaryColor);
          yPos += 2;

          resume.educations.forEach((edu) => {
            if (edu.institution || edu.degree) {
              if (yPos > 700) {
                doc.addPage();
                yPos = 40;
              }

              doc.fillColor(textColor)
                 .fontSize(9)
                 .font('Helvetica-Bold')
                 .text(edu.degree || 'Degree', 50, yPos);
              
              const yearRange = [edu.startYear, edu.endYear].filter(Boolean).join(' - ');
              if (yearRange) {
                const yearWidth = doc.widthOfString(yearRange);
                doc.text(yearRange, 545 - yearWidth, yPos);
              }

              yPos += 10;
              doc.fillColor(lightGray)
                 .fontSize(8)
                 .font('Helvetica');
              
              const eduDetails = [];
              if (edu.institution) eduDetails.push(edu.institution);
              if (edu.field) eduDetails.push(edu.field);
              if (edu.grade) eduDetails.push(`Grade: ${edu.grade}`);
              
              if (eduDetails.length > 0) {
                doc.text(eduDetails.join(' | '), 50, yPos);
                yPos += 12;
              }
            }
          });

          yPos = addSeparator(doc, primaryColor, yPos);
        }
      }

      // Skills
      if (resume.skills && (resume.skills.languages || resume.skills.frameworks || resume.skills.tools)) {
        yPos = addSectionHeader(doc, 'Skills', 50, yPos, primaryColor);
        yPos += 2;

        doc.fillColor(textColor)
           .fontSize(8)
           .font('Helvetica');

        if (resume.skills.languages) {
          doc.text(`Languages: ${resume.skills.languages}`, 50, yPos);
          yPos += 10;
        }
        if (resume.skills.frameworks) {
          doc.text(`Frameworks & Libraries: ${resume.skills.frameworks}`, 50, yPos);
          yPos += 10;
        }
        if (resume.skills.tools) {
          doc.text(`Tools & Platforms: ${resume.skills.tools}`, 50, yPos);
          yPos += 10;
        }
        yPos = addSeparator(doc, primaryColor, yPos);
      }

      // Experience
      if (resume.experiences && resume.experiences.length > 0) {
        const hasExp = resume.experiences.some(e => e.company || e.role);
        if (hasExp) {
          yPos = addSectionHeader(doc, 'Work Experience', 50, yPos, primaryColor);
          yPos += 2;

          resume.experiences.forEach((exp) => {
            if (exp.company || exp.role) {
              if (yPos > 700) {
                doc.addPage();
                yPos = 40;
              }

              doc.fillColor(textColor)
                 .fontSize(9)
                 .font('Helvetica-Bold')
                 .text(exp.role || 'Position', 50, yPos);
              
              const dateRange = [exp.startDate, exp.endDate].filter(Boolean).join(' - ');
              if (dateRange) {
                const dateWidth = doc.widthOfString(dateRange);
                doc.text(dateRange, 545 - dateWidth, yPos);
              }

              yPos += 10;
              doc.fillColor(lightGray)
                 .fontSize(8)
                 .font('Helvetica')
                 .text(exp.company || 'Company', 50, yPos);
              
              yPos += 9;

              if (exp.description) {
                const bulletPoints = parseBulletPoints(exp.description);
                
                bulletPoints.forEach(point => {
                  if (yPos > 700) {
                    doc.addPage();
                    yPos = 40;
                  }
                  
                  doc.fillColor(textColor)
                     .fontSize(8)
                     .font('Helvetica')
                     .text(`• ${point}`, 60, yPos, {
                       width: 485,
                       align: 'left'
                     });
                  yPos += doc.heightOfString(`• ${point}`, { width: 485 }) + 3;
                });
              }
              yPos += 6;
            }
          });

          yPos = addSeparator(doc, primaryColor, yPos);
        }
      }

      // Projects
      if (resume.projects && resume.projects.length > 0) {
        const hasProj = resume.projects.some(p => p.title);
        if (hasProj) {
          if (yPos > 650) {
            doc.addPage();
            yPos = 40;
          }

          yPos = addSectionHeader(doc, 'Projects', 50, yPos, primaryColor);
          yPos += 2;

          resume.projects.forEach((project) => {
            if (project.title) {
              if (yPos > 700) {
                doc.addPage();
                yPos = 40;
              }

              doc.fillColor(textColor)
                 .fontSize(9)
                 .font('Helvetica-Bold')
                 .text(project.title, 50, yPos);
              
              // Handle project link - ensure it's a string URL with proper protocol
              let projectUrl = null;
              if (project.link) {
                // Handle both string and object formats
                if (typeof project.link === 'string') {
                  projectUrl = project.link;
                } else if (typeof project.link === 'object' && project.link.url) {
                  projectUrl = project.link.url;
                }
              }
              
              // Ensure URL has proper protocol
              projectUrl = ensureProtocol(projectUrl);
              
              if (projectUrl) {
                const linkText = 'View Project';
                const linkWidth = doc.widthOfString(linkText);
                doc.fillColor(primaryColor)
                   .fontSize(8)
                   .font('Helvetica')
                   .text(linkText, 545 - linkWidth, yPos, {
                     link: projectUrl,
                     underline: true
                });
              }

              yPos += 10;

              if (project.technologies) {
                doc.fillColor(lightGray)
                   .fontSize(8)
                   .font('Helvetica')
                   .text(`Technologies: ${project.technologies}`, 50, yPos);
                yPos += 9;
              }

              if (project.description) {
                const bulletPoints = parseBulletPoints(project.description);
                
                bulletPoints.forEach(point => {
                  if (yPos > 700) {
                    doc.addPage();
                    yPos = 40;
                  }
                  
                  doc.fillColor(textColor)
                     .fontSize(8)
                     .font('Helvetica')
                     .text(`• ${point}`, 60, yPos, {
                       width: 485,
                       align: 'left'
                     });
                  yPos += doc.heightOfString(`• ${point}`, { width: 485 }) + 3;
                });
              }
              yPos += 6;
            }
          });

          yPos = addSeparator(doc, primaryColor, yPos);
        }
      }

      // Achievements
      if (resume.achievements && resume.achievements.trim().length > 0) {
        if (yPos > 650) {
          doc.addPage();
          yPos = 40;
        }

        yPos = addSectionHeader(doc, 'Achievements', 50, yPos, primaryColor);
        yPos += 2;

        const achievements = parseBulletPoints(resume.achievements);
        
        achievements.forEach(achievement => {
          if (yPos > 700) {
            doc.addPage();
            yPos = 40;
          }

          doc.fillColor(textColor)
             .fontSize(8)
             .font('Helvetica')
             .text(`• ${achievement}`, 60, yPos, {
               width: 485,
               align: 'left'
             });
          yPos += doc.heightOfString(`• ${achievement}`, { width: 485 }) + 3;
        });

        yPos = addSeparator(doc, primaryColor, yPos);
      }

      // Certificates
      if (resume.certificates && resume.certificates.length > 0) {
        const hasCert = resume.certificates.some(c => c.name);
        if (hasCert) {
          if (yPos > 650) {
            doc.addPage();
            yPos = 40;
          }

          yPos = addSectionHeader(doc, 'Certifications', 50, yPos, primaryColor);
          yPos += 2;

          resume.certificates.forEach((cert) => {
            if (cert.name) {
              if (yPos > 700) {
                doc.addPage();
                yPos = 40;
              }

              doc.fillColor(textColor)
                 .fontSize(9)
                 .font('Helvetica-Bold')
                 .text(cert.name, 50, yPos);

              // Handle certificate link
              const certUrl = ensureProtocol(cert.link);
              if (certUrl) {
                const linkText = 'View Certificate';
                const linkWidth = doc.widthOfString(linkText);
                doc.fillColor(primaryColor)
                   .fontSize(8)
                   .font('Helvetica')
                   .text(linkText, 545 - linkWidth, yPos, {
                     link: certUrl,
                     underline: true
                });
              }

              yPos += 9;

              if (cert.description) {
                doc.fillColor(lightGray)
                   .fontSize(8)
                   .font('Helvetica')
                   .text(cert.description, 50, yPos);
                yPos += 9;
              }
              yPos += 3;
            }
          });
        }
      }

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};

export default { generateResumePDF };
