const https = require('https');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

function makeGeminiRequest(prompt, timeout = 15000) {
  return new Promise((resolve) => {
    
    // Try different model endpoints in order
   const modelPaths = [
  'gemini-2.0-flash',      // Current best free model
  'gemini-2.0-flash-lite', // Fallback for higher rate limits
  'gemini-1.5-flash'       // Legacy fallback
];
    
    let currentPathIndex = 0;
    
    function tryRequest() {
      if (currentPathIndex >= modelPaths.length) {
        console.error('[AI] All model paths failed');
        resolve({ success: false, error: 'No valid Gemini model found' });
        return;
      }
      
      const modelPath = modelPaths[currentPathIndex];
      console.log(`[AI] Trying: ${modelPath}`);
      
      const payload = JSON.stringify({
        contents: [{
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 300
        }
      });

      const options = {
        hostname: 'generativelanguage.googleapis.com',
        path: `${modelPath}?key=${GEMINI_API_KEY}`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          console.log(`[AI] Status: ${res.statusCode}`);
          
          try {
            const result = JSON.parse(data);
            
            // If error, try next model
            if (result.error) {
              console.error(`[AI] Error with ${modelPath}:`, result.error.message);
              currentPathIndex++;
              tryRequest(); // Try next model
              return;
            }
            
            // Success!
            const text = result.candidates?.[0]?.content?.parts?.[0]?.text || '';
            
            if (!text || text.trim() === '') {
              console.error('[AI] Empty response');
              currentPathIndex++;
              tryRequest(); // Try next model
              return;
            }
            
            console.log(`[AI] ✓ Success with ${modelPath}`);
            console.log(`[AI] Generated: ${text.substring(0, 100)}...`);
            resolve({ success: true, text: text.trim() });
            
          } catch (e) {
            console.error('[AI] Parse error:', e.message);
            currentPathIndex++;
            tryRequest(); // Try next model
          }
        });
      });

      req.on('error', (e) => {
        console.error('[AI] Request error:', e.message);
        currentPathIndex++;
        tryRequest(); // Try next model
      });

      req.setTimeout(timeout, () => {
        console.error('[AI] Timeout');
        req.abort();
        currentPathIndex++;
        tryRequest(); // Try next model
      });

      req.write(payload);
      req.end();
    }
    
    tryRequest(); // Start trying
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

  console.log('[AI] ═══════════════════════════════');
  console.log('[AI] Function invoked');

  if (!GEMINI_API_KEY) {
    console.error('[AI] ERROR: GEMINI_API_KEY not configured');
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        success: false, 
        error: 'GEMINI_API_KEY not set in Netlify environment variables. Get one at: https://aistudio.google.com/app/apikey' 
      })
    };
  }

  console.log('[AI] API Key:', GEMINI_API_KEY.substring(0, 15) + '...');

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
  console.log('[AI] Request:', { productName, category, action });

  if (!productName) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ success: false, error: 'productName required' })
    };
  }

  try {
    let prompt = '';
    let maxLength = 0;

    if (action === 'meta_title') {
      maxLength = 70;
      prompt = `Write a concise SEO meta title (max ${maxLength} chars) for: "${productName}". Include "PinkBlue". Output only the title.`;
    } else if (action === 'meta_description') {
      maxLength = 160;
      prompt = `Write a concise SEO description (max ${maxLength} chars) for: "${productName}". Include benefits. Output only the description.`;
    } else if (action === 'meta_keywords') {
      maxLength = 255;
      prompt = `List SEO keywords (max ${maxLength} chars, comma-separated) for: "${productName}" (dental supplies). Output only keywords.`;
    } else {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: 'Invalid action' })
      };
    }

    console.log('[AI] Prompt:', prompt.substring(0, 80) + '...');

    const result = await makeGeminiRequest(prompt);

    if (!result.success) {
      console.error('[AI] Generation failed:', result.error);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify(result)
      };
    }

    let generated = result.text;
    
    // Trim to limit
    if (generated.length > maxLength) {
      generated = generated.substring(0, maxLength - 3) + '...';
      console.log('[AI] Trimmed to', maxLength);
    }

    console.log('[AI] ✅ Final output:', generated);
    console.log('[AI] ═══════════════════════════════');

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        generated: generated,
        action: action,
        length: generated.length
      })
    };

  } catch (error) {
    console.error('[AI] Exception:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: error.message })
    };
  }
};
