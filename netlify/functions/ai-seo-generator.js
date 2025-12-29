const https = require('https');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

function makeGeminiRequest(prompt, timeout = 10000) {
  return new Promise((resolve) => {
    const payload = JSON.stringify({
      contents: [{
        parts: [{ text: prompt }]
      }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 300,
        topK: 40,
        topP: 0.95
      }
    });

    const options = {
      hostname: 'generativelanguage.googleapis.com',
      path: `/v1/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    console.log('[AI] Generating SEO content...');
    console.log('[AI] Prompt:', prompt.substring(0, 100) + '...');

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log('[AI] Response status:', res.statusCode);
        console.log('[AI] Response data:', data.substring(0, 500));
        
        try {
          const result = JSON.parse(data);
          
          // Check for errors
          if (result.error) {
            console.error('[AI] API Error:', result.error);
            resolve({ success: false, error: result.error.message || 'API error' });
            return;
          }
          
          // Extract text from response
          const text = result.candidates?.[0]?.content?.parts?.[0]?.text || '';
          
          console.log('[AI] ✓ Generated:', text);
          
          if (!text || text.trim() === '') {
            console.error('[AI] Empty response from Gemini');
            resolve({ success: false, error: 'Empty response from AI' });
            return;
          }
          
          resolve({ success: true, text: text.trim() });
        } catch (e) {
          console.error('[AI] Parse error:', e.message);
          console.error('[AI] Raw data:', data);
          resolve({ success: false, error: 'Failed to parse AI response' });
        }
      });
    });

    req.on('error', (e) => {
      console.error('[AI] Request error:', e.message);
      resolve({ success: false, error: e.message });
    });

    req.setTimeout(timeout, () => {
      console.error('[AI] Timeout');
      req.abort();
      resolve({ success: false, error: 'AI request timeout' });
    });

    req.write(payload);
    req.end();
  });
}

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  console.log('[AI] Function invoked');

  if (!GEMINI_API_KEY) {
    console.error('[AI] ERROR: GEMINI_API_KEY not configured');
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: 'Gemini API key not configured. Add GEMINI_API_KEY to Netlify environment variables.' })
    };
  }

  console.log('[AI] API Key present:', GEMINI_API_KEY.substring(0, 10) + '...');

  let data;
  try {
    data = JSON.parse(event.body || '{}');
  } catch (e) {
    console.error('[AI] Invalid JSON:', e.message);
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ success: false, error: 'Invalid JSON' })
    };
  }

  const { productName, category, action } = data;

  console.log('[AI] Request:', { productName, category, action });

  if (!productName) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ success: false, error: 'Product name required' })
    };
  }

  try {
    let prompt = '';
    let maxLength = 0;

    if (action === 'meta_title') {
      maxLength = 70;
      prompt = `Create an SEO-optimized meta title (maximum ${maxLength} characters) for: "${productName}". Include "PinkBlue" brand. Make it compelling for Google search. Return ONLY the meta title, no quotes, no explanation.`;
    } else if (action === 'meta_description') {
      maxLength = 160;
      prompt = `Create an SEO-optimized meta description (maximum ${maxLength} characters) for: "${productName}". Include benefits and call-to-action. Return ONLY the meta description, no quotes, no explanation.`;
    } else if (action === 'meta_keywords') {
      maxLength = 255;
      prompt = `Generate SEO keywords (comma-separated, maximum ${maxLength} characters) for: "${productName}" in category "${category || 'dental supplies'}". Include product variations, buying keywords, and brand terms. Return ONLY the keywords, no quotes, no explanation.`;
    } else {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: 'Invalid action. Must be: meta_title, meta_description, or meta_keywords' })
      };
    }

    console.log('[AI] Calling Gemini API...');

    const result = await makeGeminiRequest(prompt);

    if (!result.success) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ success: false, error: result.error || 'AI generation failed' })
      };
    }

    // Trim to character limit
    let generated = result.text;
    if (generated.length > maxLength) {
      generated = generated.substring(0, maxLength - 3) + '...';
      console.log('[AI] Trimmed to', maxLength, 'chars');
    }

    console.log('[AI] ✅ Success! Generated:', generated);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        generated: generated,
        action: action,
        length: generated.length,
        maxLength: maxLength
      })
    };

  } catch (error) {
    console.error('[AI] Error:', error.message);
    console.error('[AI] Stack:', error.stack);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: error.message })
    };
  }
};
