const https = require('https');

const MAGENTO_TOKEN = process.env.MAGENTO_API_TOKEN;
const BASE_URL = 'https://pinkblue.in/rest/V1';

const HEADERS = {
  'Authorization': `Bearer ${MAGENTO_TOKEN}`,
  'Content-Type': 'application/json',
  'User-Agent': 'PB_ProductManager',
  'X-Source-App': 'ImageUpload'
};

function log(msg, data = null) {
  console.log(`[${new Date().toISOString()}] [IMG] ${msg}`, data || '');
}

function makeRequest(url, method, body, timeout = 45000) {
  return new Promise((resolve) => {
    log(`${method} ${url.substring(BASE_URL.length)}`);
    
    const req = https.request(url, { method, headers: HEADERS }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        log(`Response: ${res.statusCode}`);
        
        if (res.statusCode >= 400) {
          log('ERROR RESPONSE:', data);
        }
        
        try {
          const parsed = JSON.parse(data);
          
          if (parsed.message || parsed.error) {
            log('MAGENTO ERROR:', {
              message: parsed.message,
              error: parsed.error
            });
          }
          
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
            raw: data
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
    const data = JSON.parse(event.body || '{}');
    
    const { sku, imageData, filename, label } = data;
    
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
        body: JSON.stringify({ success: false, error: 'Image data and filename required' })
      };
    }

    log(`Uploading image for SKU: ${sku}`, { 
      filename,
      dataSize: imageData.length + ' chars'
    });

    // Extract base64 data (remove data:image/jpeg;base64, prefix if present)
    const base64Data = imageData.includes(',') 
      ? imageData.split(',')[1] 
      : imageData;

    // Detect image type from filename
    const ext = filename.toLowerCase().split('.').pop();
    const mimeTypes = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'webp': 'image/webp'
    };
    const mimeType = mimeTypes[ext] || 'image/jpeg';

    // Create media entry payload
    const payload = {
      entry: {
        media_type: 'image',
        label: label || filename.replace(/\.[^/.]+$/, ''),
        position: 0,
        disabled: false,
        types: ['image', 'small_image', 'thumbnail'],
        content: {
          base64_encoded_data: base64Data,
          type: mimeType,
          name: filename
        }
      }
    };

    log('Payload constructed', {
      mimeType,
      label: payload.entry.label,
      types: payload.entry.types
    });

    const url = `${BASE_URL}/products/${encodeURIComponent(sku)}/media`;
    const result = await makeRequest(url, 'POST', payload, 45000);

    if (!result.success) {
      log('ERROR: Image upload failed', { 
        statusCode: result.statusCode,
        error: result.data
      });
      
      return {
        statusCode: result.statusCode || 500,
        headers,
        body: JSON.stringify({ 
          success: false, 
          error: result.data?.message || result.error || 'Image upload failed',
          magento_details: result.data
        })
      };
    }

    log('✅ Image uploaded successfully', { 
      imageId: result.data.id,
      file: result.data.file
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        imageId: result.data.id,
        imageUrl: result.data.file,
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
