import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const router = express.Router();

// Get the directory name for the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to templates directory
const templatesDir = path.join(__dirname, '../templates');

// @route   GET /api/templates
// @desc    Get all available resume templates
// @access  Public
router.get('/', (req, res) => {
  try {
    // Read all JSON files from templates directory
    const files = fs.readdirSync(templatesDir).filter(file => file.endsWith('.json'));
    
    const templates = files.map(file => {
      const templateData = JSON.parse(fs.readFileSync(path.join(templatesDir, file), 'utf8'));
      return {
        id: templateData.id,
        name: templateData.name,
        description: templateData.description,
        // Don't return the full data - just metadata
        hasData: !!templateData.data
      };
    });

    res.json({
      success: true,
      count: templates.length,
      templates
    });
  } catch (error) {
    console.error('Error reading templates:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching templates'
    });
  }
});

// @route   GET /api/templates/:id
// @desc    Get a specific template by ID
// @access  Public
router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const templatePath = path.join(templatesDir, `${id}.json`);
    
    // Check if file exists
    if (!fs.existsSync(templatePath)) {
      return res.status(404).json({
        success: false,
        message: 'Template not found'
      });
    }

    const templateData = JSON.parse(fs.readFileSync(templatePath, 'utf8'));

    res.json({
      success: true,
      template: templateData
    });
  } catch (error) {
    console.error('Error reading template:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching template'
    });
  }
});

export default router;
