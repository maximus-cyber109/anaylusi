const https = require('https');

const MAGENTO_TOKEN = process.env.MAGENTO_API_TOKEN;

// FIREWALL BYPASS HEADERS (WHITELISTED)
const FIREWALL_HEADERS = {
  'Authorization': `Bearer ${MAGENTO_TOKEN}`,
  'Content-Type': 'application/json',
  'User-Agent': 'PB_Netlify',
  'X-Source-App': 'GameOfCrowns',
  'X-Netlify-Secret': 'X-PB-NetlifY2025-901AD7EE35110CCB445F3CA0EBEB1494'
};

function log(msg, data = null) {
  const timestamp = new Date().toISOString();
  if (data) {
    console.log(`[${timestamp}] ${msg}`, JSON.stringify(data));
  } else {
    console.log(`[${timestamp}] ${msg}`);
  }
}

function makeRequest(url, method, body, timeout = 30000) {
  return new Promise((resolve) => {
    log(`${method} ${url.substring(url.indexOf('/rest'))}`);
    
    const req = https.request(url, { method, headers: FIREWALL_HEADERS }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        log(`Response: ${res.statusCode}`);
        
        if (res.statusCode >= 400) {
          log('ERROR RESPONSE:', data.substring(0, 500));
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
      resolve({ success: false, error: `Timeout after ${timeout/1000}s` });
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
    log('ERROR: Missing SKU parameter');
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ success: false, error: 'SKU parameter required' })
    };
  }
  
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
      technical_details: 65000
    };
    
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
    
    const payload = {
      product: {
        custom_attributes: updates.map(u => ({
          attribute_code: u.attribute_code,
          value: u.value || ''
        }))
      }
    };
    
    log('Payload size:', (JSON.stringify(payload).length / 1024).toFixed(1) + ' KB');
    
    const url = `https://pinkblue.in/rest/all/V1/products/${encodeURIComponent(sku)}`;
    const result = await makeRequest(url, 'PUT', payload, 30000);
    
    const duration = Date.now() - startTime;
    
    if (!result.success) {
      log('ERROR: Update failed', { 
        statusCode: result.statusCode, 
        magentoError: result.data,
        duration: duration + 'ms'
      });
      
      return {
        statusCode: result.statusCode || 500,
        headers,
        body: JSON.stringify({ 
          success: false, 
          error: result.data?.message || result.error || 'Update failed',
          magento_details: result.data,
          raw: result.raw,
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
        duration: duration
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
