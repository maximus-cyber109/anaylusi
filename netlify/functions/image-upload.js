const https = require('https');
const { Buffer } = require('buffer');

const MAGENTO_TOKEN = process.env.MAGENTO_API_TOKEN;
const BASE_URL = 'https://pinkblue.in/rest/V1';

const HEADERS = {
  'Authorization': `Bearer ${MAGENTO_TOKEN}`,
  'Content-Type': 'application/json',
  'User-Agent': 'PB_ProductManager',
  'X-Source-App': 'ImageUpload',
  'X-Netlify-Secret': 'X-PB-NetlifY2025-901AD7EE35110CCB445F3CA0EBEB1494'
};

function log(msg, data = null) {
  console.log(`[${new Date().toISOString()}] ${msg}`, data || '');
}

function makeRequest(url, method, body, timeout = 30000) {
  return new Promise((resolve) => {
    log(`${method} ${url.substring(BASE_URL.length)}`);
    
    const req = https.request(url, { method, headers: HEADERS }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        log(`Response: ${res.statusCode}`);
        
        try {
          const parsed = JSON.parse(data);
          resolve({ 
            success: res.statusCode >= 200 && res.statusCode < 300, 
            statusCode: res.statusCode, 
            data: parsed 
          });
        } catch (e) {
          resolve({ 
            success: false, 
            statusCode: res.statusCode, 
            error: 'Parse error', 
            raw: data.substring(0, 500) 
          });
        }
      });
    });
    
    req.on('error', (e) => {
      log('Request error', { error: e.message });
      resolve({ success: false, error: e.message });
    });
    
    req.setTimeout(timeout, () => {
      log(`Timeout after ${timeout}ms`);
      req.abort();
      resolve({ success: false, error: 'Timeout' });
    });
    
    if (body) {
      req.write(JSON.stringify(body));
    }
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

  if (!MAGENTO_TOKEN) {
    log('ERROR: MAGENTO_API_TOKEN not configured');
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: 'API token not configured' })
    };
  }

  try {
    // Parse multipart form data
    const boundary = event.headers['content-type'].split('boundary=')[1];
    const parts = event.body.split(`--${boundary}`);
    
    let imageData = null;
    let sku = null;
    let filename = null;

    for (const part of parts) {
      if (part.includes('Content-Disposition: form-data; name="sku"')) {
        sku = part.split('\r\n\r\n')[1].split('\r\n')[0].trim();
      } else if (part.includes('Content-Disposition: form-data; name="image"')) {
        const match = part.match(/filename="(.+?)"/);
        if (match) {
          filename = match[1];
          const base64Data = part.split('\r\n\r\n')[1].split('\r\n--')[0];
          imageData = base64Data;
        }
      }
    }

    if (!sku) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: 'SKU required' })
      };
    }

    if (!imageData || !filename) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: 'Image file required' })
      };
    }

    log(`📸 Uploading image for SKU: ${sku}`, { filename });

    // Create media entry payload
    const payload = {
      entry: {
        media_type: 'image',
        label: filename.replace(/\.[^/.]+$/, ''),
        position: 1,
        disabled: false,
        types: ['image', 'small_image', 'thumbnail'],
        content: {
          base64_encoded_data: imageData,
          type: 'image/jpeg',
          name: filename
        }
      }
    };

    const url = `${BASE_URL}/products/${encodeURIComponent(sku)}/media`;
    const result = await makeRequest(url, 'POST', payload, 30000);

    if (!result.success) {
      log('ERROR: Image upload failed', { 
        statusCode: result.statusCode, 
        error: result.error 
      });
      
      return {
        statusCode: result.statusCode || 500,
        headers,
        body: JSON.stringify({ 
          success: false, 
          error: result.error || 'Image upload failed',
          details: result.raw
        })
      };
    }

    log(`✅ Image uploaded successfully`, { imageId: result.data.id });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        imageId: result.data.id,
        message: 'Image uploaded successfully'
      })
    };

  } catch (error) {
    log('ERROR: Exception', { error: error.message, stack: error.stack });
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        success: false, 
        error: error.message 
      })
    };
  }
};
