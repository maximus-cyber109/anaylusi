const https = require('https');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

function callGemini(prompt) {
  return new Promise(async (resolve) => {
    // Try current working models in order (as of Dec 2025)
    const models = [
      'gemini-2.5-flash',      // Stable, GA (June 2025)
      'gemini-2.0-flash-001',  // Stable, GA (Feb 2025)
      'gemini-3-flash-preview', // Latest preview (Dec 2025)
      'gemini-pro'             // Legacy fallback
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

  if (!GEMINI_API_KEY) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: 'GEMINI_API_KEY not set' })
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

  const { productName, action } = data;

  if (!productName || !action) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ success: false, error: 'productName and action required' })
    };
  }

  try {
    let prompt, maxLen;

    switch (action) {
      case 'meta_title':
        maxLen = 70;
        prompt = `Write SEO title under ${maxLen} chars: "${productName}". Include PinkBlue brand. Output title only.`;
        break;
      case 'meta_description':
        maxLen = 160;
        prompt = `Write SEO description under ${maxLen} chars: "${productName}". Include benefits. Output description only.`;
        break;
      case 'meta_keywords':
        maxLen = 255;
        prompt = `List SEO keywords under ${maxLen} chars (comma-separated): "${productName}" dental product. Output keywords only.`;
        break;
      default:
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ success: false, error: 'Invalid action' })
        };
    }

    console.log('[AI] Action:', action);
    console.log('[AI] Prompt:', prompt.substring(0, 80));

    const result = await callGemini(prompt);

    if (!result.success) {
      console.error('[AI] Failed:', result.error);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ success: false, error: result.error })
      };
    }

    let generated = result.text;
    if (generated.length > maxLen) {
      generated = generated.substring(0, maxLen);
    }

    console.log('[AI] ✅ Generated:', generated);
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
    console.error('[AI] Exception:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: error.message })
    };
  }
};
