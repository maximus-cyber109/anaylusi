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
        maxOutputTokens: 200
      }
    });

    const options = {
      hostname: 'generativelanguage.googleapis.com',
      path: `/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    console.log('[AI] Generating SEO content...');

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          const text = result.candidates?.[0]?.content?.parts?.[0]?.text || '';
          console.log('[AI] ✓ Generated:', text.substring(0, 100));
          resolve({ success: true, text: text });
        } catch (e) {
          console.error('[AI] Parse error:', e.message);
          resolve({ success: false, error: 'Parse error' });
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
      resolve({ success: false, error: 'Timeout' });
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

  if (!GEMINI_API_KEY) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: 'Gemini API key not configured' })
    };
  }

  let data;
  try {
    data = JSON.parse(event.body || '{}');
  } catch (e) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ success: false, error: 'Invalid JSON' })
    };
  }

  const { productName, category, action } = data;

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
      prompt = `Generate a compelling SEO meta title (max ${maxLength} chars) for this dental product: "${productName}". Include brand "PinkBlue" and make it optimized for Google search. Only return the meta title, nothing else.`;
    } else if (action === 'meta_description') {
      maxLength = 160;
      prompt = `Generate a compelling SEO meta description (max ${maxLength} chars) for this dental product: "${productName}". Focus on benefits and include call-to-action. Only return the meta description, nothing else.`;
    } else if (action === 'meta_keywords') {
      maxLength = 255;
      prompt = `Generate SEO keywords (comma-separated, max ${maxLength} chars) for this dental product: "${productName}". Include product type, category "${category || 'dental supplies'}", brand variations, and buying intent keywords. Only return the keywords, nothing else.`;
    } else {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: 'Invalid action' })
      };
    }

    const result = await makeGeminiRequest(prompt);

    if (!result.success) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ success: false, error: result.error || 'AI generation failed' })
      };
    }

    // Trim to character limit
    let generated = result.text.trim();
    if (generated.length > maxLength) {
      generated = generated.substring(0, maxLength - 3) + '...';
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        generated: generated,
        action: action
      })
    };

  } catch (error) {
    console.error('[AI] Error:', error.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: error.message })
    };
  }
};
