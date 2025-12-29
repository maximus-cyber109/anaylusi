const https = require('https');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

/**
 * Enhanced Gemini Request with Error Handling & Path Correction
 */
function makeGeminiRequest(prompt, timeout = 10000) {
  return new Promise((resolve) => {
    const payload = JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 300
      }
    });

    // UPDATED: In 2025, /v1beta/ is more stable for the free tier 
    // and gemini-1.5-flash is the most reliable free workhorse.
    const options = {
      hostname: 'generativelanguage.googleapis.com',
      path: `/v1beta/models/gemini-1.5-flash-001:generateContent?key=${GEMINI_API_KEY}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    console.log('[AI] Calling Gemini API...');
    console.log('[AI] Model: gemini-1.5-flash (v1beta)');
    console.log('[AI] Prompt:', prompt.substring(0, 80) + '...');

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log('[AI] Response Status:', res.statusCode);
        
        // Handle Rate Limiting (Free Tier 429)
        if (res.statusCode === 429) {
          console.error('[AI] Error 429: Free tier rate limit reached.');
          return resolve({ success: false, retry: true, error: 'Rate limit exceeded. Try again in a minute.' });
        }

        // Handle Incorrect Paths (The 404 you saw)
        if (res.statusCode === 404) {
          console.error('[AI] Error 404: Model not found or path incorrect.');
          console.error('[AI] Response:', data);
          return resolve({ success: false, error: 'API endpoint not found. Check GEMINI_API_KEY.' });
        }

        // Handle Auth Errors
        if (res.statusCode === 401 || res.statusCode === 403) {
          console.error('[AI] Auth Error:', res.statusCode);
          console.error('[AI] Response:', data);
          return resolve({ success: false, error: 'Invalid API key. Get new key at: https://aistudio.google.com/app/apikey' });
        }

        try {
          const result = JSON.parse(data);
          
          if (result.error) {
            console.error('[AI] API Error:', result.error);
            return resolve({ success: false, error: result.error.message || JSON.stringify(result.error) });
          }

          const text = result.candidates?.[0]?.content?.parts?.[0]?.text || '';
          
          if (!text.trim()) {
            console.error('[AI] Empty response from API');
            return resolve({ success: false, error: 'Empty response from AI' });
          }

          console.log('[AI] ✅ Success! Generated:', text.substring(0, 100) + '...');
          resolve({ success: true, text: text.trim() });
          
        } catch (e) {
          console.error('[AI] JSON Parse Error:', e.message);
          console.error('[AI] Raw Response:', data.substring(0, 500));
          resolve({ success: false, error: 'Invalid JSON response' });
        }
      });
    });

    req.on('error', (e) => {
      console.error('[AI] Request Error:', e.message);
      resolve({ success: false, error: e.message });
    });
    
    req.setTimeout(timeout, () => { 
      console.error('[AI] Request Timeout');
      req.abort(); 
      resolve({ success: false, error: 'Request timeout after 10s' }); 
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

  console.log('[AI] ════════════════════════════════');
  console.log('[AI] SEO Generator Function Invoked');

  // Check API Key
  if (!GEMINI_API_KEY) {
    console.error('[AI] ❌ GEMINI_API_KEY not configured!');
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        success: false, 
        error: 'GEMINI_API_KEY not configured in Netlify environment variables.\n\nGet your FREE API key:\n1. Visit https://aistudio.google.com/app/apikey\n2. Click "Create API Key"\n3. Add to Netlify: Site Settings → Environment Variables\n4. Key: GEMINI_API_KEY\n5. Value: [your key]\n6. Redeploy site' 
      })
    };
  }

  console.log('[AI] API Key Present:', GEMINI_API_KEY.substring(0, 20) + '...');

  // Parse request body
  let data;
  try {
    data = JSON.parse(event.body || '{}');
  } catch (e) {
    console.error('[AI] Invalid JSON in request body');
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ success: false, error: 'Invalid JSON in request body' })
    };
  }

  const { productName, category, action } = data;
  console.log('[AI] Request:', { productName, category, action });

  if (!productName) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ success: false, error: 'productName is required' })
    };
  }

  if (!action) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ success: false, error: 'action is required (meta_title, meta_description, or meta_keywords)' })
    };
  }

  try {
    let prompt = '';
    let maxLength = 0;

    // Build prompts based on action
    if (action === 'meta_title') {
      maxLength = 70;
      prompt = `Write an SEO-optimized meta title (maximum ${maxLength} characters) for this dental product: "${productName}". Include the brand "PinkBlue". Make it compelling for Google search. Return ONLY the title, no quotes, no explanation.`;
      
    } else if (action === 'meta_description') {
      maxLength = 160;
      prompt = `Write an SEO-optimized meta description (maximum ${maxLength} characters) for this dental product: "${productName}". Include key benefits and a call-to-action. Return ONLY the description, no quotes, no explanation.`;
      
    } else if (action === 'meta_keywords') {
      maxLength = 255;
      prompt = `Generate SEO keywords (comma-separated, maximum ${maxLength} characters) for this dental product: "${productName}" in category "${category || 'dental supplies'}". Include product type, brand variations, and buying intent keywords. Return ONLY the keywords, no quotes, no explanation.`;
      
    } else {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          success: false, 
          error: 'Invalid action. Must be: meta_title, meta_description, or meta_keywords' 
        })
      };
    }

    console.log('[AI] Generating content for:', action);

    // Call Gemini API
    const result = await makeGeminiRequest(prompt);

    if (!result.success) {
      console.error('[AI] ❌ Generation failed:', result.error);
      return {
        statusCode: result.retry ? 429 : 500,
        headers,
        body: JSON.stringify({ 
          success: false, 
          error: result.error,
          retry: result.retry || false
        })
      };
    }

    // Trim to character limit
    let generated = result.text;
    if (generated.length > maxLength) {
      console.log(`[AI] Trimming from ${generated.length} to ${maxLength} chars`);
      generated = generated.substring(0, maxLength - 3) + '...';
    }

    console.log('[AI] ✅ Final Output:', generated);
    console.log('[AI] Length:', generated.length, '/', maxLength);
    console.log('[AI] ════════════════════════════════');

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
    console.error('[AI] ❌ Exception:', error.message);
    console.error('[AI] Stack:', error.stack);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        success: false, 
        error: 'Internal server error: ' + error.message 
      })
    };
  }
};
