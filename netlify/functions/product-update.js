const https = require('https');

const MAGENTO_TOKEN = process.env.MAGENTO_API_TOKEN;
const BASE_URL = 'https://pinkblue.in/rest/V1';

const HEADERS = {
  'Authorization': `Bearer ${MAGENTO_TOKEN}`,
  'Content-Type': 'application/json',
  'User-Agent': 'PB_ProductManager',
  'X-Source-App': 'ProductUpdate',
  'X-Netlify-Secret': 'X-PB-NetlifY2025-901AD7EE35110CCB445F3CA0EBEB1494'
};

function log(msg, data = null) {
  console.log(`[${new Date().toISOString()}] ${msg}`, data ? JSON.stringify(data).substring(0, 200) : '');
}

function makeRequest(url, method, body, timeout = 25000) {
  return new Promise((resolve) => {
    log(`${method} ${url.substring(BASE_URL.length)}`);
    log(`Payload size: ${JSON.stringify(body).length} bytes`);
    
    const req = https.request(url, { method, headers: HEADERS }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        log(`Response: ${res.statusCode} | ${(data.length / 1024).toFixed(0)}KB`);
        try {
          resolve({ 
            success: res.statusCode >= 200 && res.statusCode < 300, 
            statusCode: res.statusCode, 
            data: JSON.parse(data) 
          });
        } catch (e) {
          log('Parse error', { error: e.message, data: data.substring(0, 200) });
          resolve({ 
            success: false, 
            statusCode: res.statusCode, 
            error: 'Parse error', 
            raw: data.substring(0, 300) 
          });
        }
      });
    });
    
    req.on('error', (e) => {
      log('Request error', { error: e.message });
      resolve({ success: false, error: e.message });
    });
    
    req.setTimeout(timeout, () => {
      log('Request timeout after ' + timeout + 'ms');
      req.abort();
      resolve({ success: false, error: 'Request timeout after ' + (timeout/1000) + 's' });
    });
    
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

exports.handler = async (event) => {
  const startTime = Date.now();
  
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, PUT, OPTIONS',
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
  
  const sku = event.queryStringParameters?.sku;
  
  if (!sku) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ success: false, error: 'SKU required' })
    };
  }
  
  let updates;
  try {
    updates = JSON.parse(event.body || '[]');
  } catch (e) {
    log('ERROR: Invalid JSON', { error: e.message });
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ success: false, error: 'Invalid JSON in request body' })
    };
  }
  
  if (!Array.isArray(updates) || updates.length === 0) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ success: false, error: 'Updates must be a non-empty array' })
    };
  }
  
  try {
    log(`✏️ Updating ${sku}`, { count: updates.length, attributes: updates.map(u => u.attribute_code) });
    
    // Character limit validation
    const limits = {
      meta_title: 70,
      meta_description: 160,
      short_description: 255,
      key_specification1: 255,
      key_specification2: 255,
      key_specification3: 255,
      key_specification4: 255,
      package_content: 2000,
      special_offers: 500,
      pdt_tags: 255,
      description: 65000,
      features: 65000,
      technical_details: 65000
    };
    
    for (const update of updates) {
      const limit = limits[update.attribute_code];
      if (limit && update.value && update.value.length > limit) {
        log(`ERROR: Character limit exceeded for ${update.attribute_code}`);
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ 
            success: false, 
            error: `${update.attribute_code} exceeds ${limit} character limit (${update.value.length} chars)` 
          })
        };
      }
    }
    
    const payload = {
      product: {
        custom_attributes: updates.map(u => ({
          attribute_code: u.attribute_code,
          value: u.value || ''
        }))
      }
    };
    
    const url = `${BASE_URL}/products/${encodeURIComponent(sku)}`;
    const result = await makeRequest(url, 'PUT', payload, 25000);
    
    const duration = Date.now() - startTime;
    log(`Request completed in ${duration}ms`);
    
    if (!result.success) {
      log('ERROR: Update failed', { statusCode: result.statusCode, error: result.error });
      return {
        statusCode: result.statusCode || 500,
        headers,
        body: JSON.stringify({ 
          success: false, 
          error: result.error || 'Update failed',
          details: result.raw,
          duration: duration
        })
      };
    }
    
    log(`✓ Successfully updated ${sku}`);
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        sku: sku,
        updated_attributes: updates.map(u => u.attribute_code),
        timestamp: new Date().toISOString(),
        duration: duration
      })
    };
    
  } catch (error) {
    const duration = Date.now() - startTime;
    log('ERROR: Exception', { error: error.message, stack: error.stack });
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        success: false, 
        error: error.message,
        duration: duration
      })
    };
  }
};
