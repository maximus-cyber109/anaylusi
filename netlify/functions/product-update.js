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
  const timestamp = new Date().toISOString();
  if (data) {
    console.log(`[${timestamp}] ${msg}`, JSON.stringify(data).substring(0, 300));
  } else {
    console.log(`[${timestamp}] ${msg}`);
  }
}

function makeRequest(url, method, body, timeout = 25000) {
  return new Promise((resolve) => {
    log(`${method} ${url.substring(BASE_URL.length)}`);
    
    if (body) {
      log('Payload', {
        size: JSON.stringify(body).length + ' bytes',
        attributes: body.product?.custom_attributes?.map(a => a.attribute_code)
      });
    }
    
    const req = https.request(url, { method, headers: HEADERS }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        log(`Response: ${res.statusCode} | ${(data.length / 1024).toFixed(1)}KB`);
        
        try {
          const parsed = JSON.parse(data);
          resolve({ 
            success: res.statusCode >= 200 && res.statusCode < 300, 
            statusCode: res.statusCode, 
            data: parsed 
          });
        } catch (e) {
          log('Parse error', { error: e.message, raw: data.substring(0, 200) });
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
      resolve({ success: false, error: `Request timeout after ${timeout/1000}s` });
    });
    
    if (body) {
      req.write(JSON.stringify(body));
    }
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
  
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }
  
  // Check API token
  if (!MAGENTO_TOKEN) {
    log('ERROR: MAGENTO_API_TOKEN not configured');
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: 'API token not configured' })
    };
  }
  
  // Get SKU from query params
  const sku = event.queryStringParameters?.sku;
  
  if (!sku) {
    log('ERROR: Missing SKU parameter');
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ success: false, error: 'SKU parameter required' })
    };
  }
  
  // Parse request body
  let updates;
  try {
    updates = JSON.parse(event.body || '[]');
  } catch (e) {
    log('ERROR: Invalid JSON in request body', { error: e.message });
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ success: false, error: 'Invalid JSON in request body' })
    };
  }
  
  // Validate updates array
  if (!Array.isArray(updates) || updates.length === 0) {
    log('ERROR: Updates must be a non-empty array');
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ success: false, error: 'Updates must be a non-empty array' })
    };
  }
  
  try {
    log(`✏️ Updating product: ${sku}`, { 
      updateCount: updates.length, 
      attributes: updates.map(u => u.attribute_code) 
    });
    
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
      meta_keyword: 255,
      description: 65000,
      features: 65000,
      technical_details: 65000,
      faqs: 65000
    };
    
    // Validate each update
    for (const update of updates) {
      const limit = limits[update.attribute_code];
      if (limit && update.value && update.value.length > limit) {
        log(`ERROR: Character limit exceeded`, {
          attribute: update.attribute_code,
          limit: limit,
          actual: update.value.length
        });
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ 
            success: false, 
            error: `${update.attribute_code} exceeds ${limit} character limit (currently ${update.value.length} chars)` 
          })
        };
      }
    }
    
    // Build payload - IMPORTANT: Use store_id: 0 for ALL STORE VIEWS
    const payload = {
      product: {
        sku: sku,
        store_id: 0, // 🔥 THIS UPDATES ALL STORE VIEWS, NOT JUST DEFAULT
        custom_attributes: updates.map(u => ({
          attribute_code: u.attribute_code,
          value: u.value || ''
        }))
      },
      saveOptions: true
    };
    
    log('Payload constructed', {
      sku: payload.product.sku,
      store_id: payload.product.store_id,
      attributes_count: payload.product.custom_attributes.length
    });
    
    // Make the API request
    const url = `${BASE_URL}/products/${encodeURIComponent(sku)}`;
    const result = await makeRequest(url, 'PUT', payload, 25000);
    
    const duration = Date.now() - startTime;
    
    if (!result.success) {
      log('ERROR: Update failed', { 
        statusCode: result.statusCode, 
        error: result.error,
        duration: duration + 'ms'
      });
      
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
    
    log(`✅ Successfully updated ${sku}`, {
      duration: duration + 'ms',
      attributes: updates.map(u => u.attribute_code)
    });
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        sku: sku,
        updated_attributes: updates.map(u => u.attribute_code),
        timestamp: new Date().toISOString(),
        duration: duration,
        store_scope: 'all' // Indicates it updated all store views
      })
    };
    
  } catch (error) {
    const duration = Date.now() - startTime;
    
    log('ERROR: Exception thrown', { 
      error: error.message, 
      stack: error.stack,
      duration: duration + 'ms'
    });
    
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
