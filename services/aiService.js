import axios from 'axios';

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent';

export const generateSummaryWithAI = async (resumeData) => {
  // Read API key at runtime to ensure dotenv is loaded
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  
  if (!GEMINI_API_KEY) {
    throw new Error('Gemini API key not configured. Please set GEMINI_API_KEY in your .env file.');
  }

  try {
    const experience = resumeData.experiences?.map(exp => `${exp.role} at ${exp.company}`).join(', ') || 'Not specified';
    const skills = [resumeData.skills?.languages, resumeData.skills?.frameworks, resumeData.skills?.tools].filter(Boolean).join(', ') || 'Not specified';
    const education = resumeData.educations?.map(edu => `${edu.degree} in ${edu.field}`).join(', ') || 'Not specified';
    const title = resumeData.title || 'Professional';

    const prompt = `Based on the following professional information, generate a concise and professional resume summary (2-3 sentences):

Experience: ${experience}
Skills: ${skills}
Education: ${education}
Title/Headline: ${title}

Generate only the summary text without any additional explanation or formatting.`;

    const response = await axios.post(
      `${GEMINI_API_URL}?key=${GEMINI_API_KEY}`,
      {
        contents: [
          {
            parts: [
              {
                text: prompt
              }
            ]
          }
        ]
      },
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    if (response.data?.candidates?.[0]?.content?.parts?.[0]?.text) {
      return response.data.candidates[0].content.parts[0].text.trim();
    } else {
      throw new Error('Invalid API response format');
    }
  } catch (error) {
    console.error('Gemini API error:', error.response?.data || error.message);
    throw error;
  }
};
