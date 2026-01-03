const https = require('https');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

function callGemini(prompt) {
  return new Promise(async (resolve) => {
    const models = [
      'gemini-2.5-flash',
      'gemini-2.0-flash-001',
      'gemini-3-flash-preview',
      'gemini-pro'
    ];
    
    for (const modelName of models) {
      console.log(`[AI] Trying model: ${modelName}`);
      
      const result = await tryModel(modelName, prompt);
      
      if (result.success) {
        console.log(`[AI] ✅ SUCCESS with ${modelName}`);
        return resolve(result);
      }
      
      console.log(`[AI] ❌ ${modelName} failed: ${result.error}`);
    }
    
    resolve({ success: false, error: 'All models failed' });
  });
}

function tryModel(modelName, prompt) {
  return new Promise((resolve) => {
    const payload = JSON.stringify({
      contents: [{
        parts: [{ text: prompt }]
      }]
    });

    const options = {
      hostname: 'generativelanguage.googleapis.com',
      path: `/v1beta/models/${modelName}:generateContent?key=${GEMINI_API_KEY}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode !== 200) {
          return resolve({ success: false, error: `Status ${res.statusCode}` });
        }
        
        try {
          const result = JSON.parse(data);
          
          if (result.error) {
            return resolve({ success: false, error: result.error.message });
          }
          
          const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
          
          if (!text || !text.trim()) {
            return resolve({ success: false, error: 'Empty response' });
          }
          
          resolve({ success: true, text: text.trim() });
        } catch (e) {
          resolve({ success: false, error: 'Parse error' });
        }
      });
    });

    req.on('error', (e) => resolve({ success: false, error: e.message }));
    req.setTimeout(10000, () => { req.abort(); resolve({ success: false, error: 'Timeout' }); });
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
  console.log('[AI] Request body:', event.body);

  if (!GEMINI_API_KEY) {
    console.error('[AI] GEMINI_API_KEY not configured');
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: 'GEMINI_API_KEY not set' })
    };
  }

  let data;
  try {
    data = JSON.parse(event.body || '{}');
    console.log('[AI] Parsed data:', data);
  } catch (e) {
    console.error('[AI] JSON parse error:', e.message);
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ success: false, error: 'Invalid JSON' })
    };
  }

  const { productName, action } = data;

  console.log('[AI] Product Name:', productName);
  console.log('[AI] Action:', action);

  if (!productName || !action) {
    console.error('[AI] Missing required fields');
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ 
        success: false, 
        error: 'productName and action required',
        received: { productName, action }
      })
    };
  }

  try {
    let prompt, maxLen;

    // Normalize action to lowercase for comparison
    const actionLower = action.toLowerCase();

    if (actionLower === 'meta_title') {
      maxLen = 70;
      prompt = `Write SEO title under ${maxLen} chars: "${productName}". Include PinkBlue brand. Output title only.`;
    } else if (actionLower === 'meta_description') {
      maxLen = 160;
      prompt = `Write SEO description under ${maxLen} chars: "${productName}". Include benefits. Output description only.`;
    } else if (actionLower === 'meta_keyword' || actionLower === 'meta_keywords') {
      maxLen = 255;
      prompt = `Generate SEO keywords (comma-separated, under ${maxLen} chars) for: "${productName}" dental product. Output only the keywords, no explanations.`;
    } else {
      console.error('[AI] Invalid action:', action);
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          success: false, 
          error: `Invalid action: ${action}. Must be meta_title, meta_description, or meta_keyword` 
        })
      };
    }

    console.log('[AI] Action:', action);
    console.log('[AI] Max Length:', maxLen);
    console.log('[AI] Prompt:', prompt.substring(0, 100) + '...');

    const result = await callGemini(prompt);

    if (!result.success) {
      console.error('[AI] Generation failed:', result.error);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ success: false, error: result.error })
      };
    }

    let generated = result.text;
    
    // Trim to max length if needed
    if (generated.length > maxLen) {
      console.log('[AI] Trimming from', generated.length, 'to', maxLen);
      generated = generated.substring(0, maxLen);
    }

    console.log('[AI] ✅ Generated:', generated);
    console.log('[AI] Length:', generated.length, '/', maxLen);
    console.log('[AI] ════════════════════════════════');

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
    console.error('[AI] Exception:', error.message);
    console.error('[AI] Stack:', error.stack);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: error.message })
    };
  }
};
