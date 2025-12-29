const https = require('https');

const MAGENTO_TOKEN = process.env.MAGENTO_API_TOKEN;
const BASE_URL = 'https://pinkblue.in/rest/V1';

const HEADERS = {
  'Authorization': `Bearer ${MAGENTO_TOKEN}`,
  'Content-Type': 'application/json',
  'User-Agent': 'PB_ProductUpdate',
  'X-Source-App': 'ProductManager',
  'X-Netlify-Secret': 'X-PB-NetlifY2025-901AD7EE35110CCB445F3CA0EBEB1494'
};

function makeRequest(url, method, body, timeout = 15000) {
  return new Promise((resolve) => {
    console.log(`[${method}] ${url}`);
    
    const req = https.request(url, { method, headers: HEADERS }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log(`✓ ${res.statusCode}`);
        try {
          resolve({ 
            success: res.statusCode === 200, 
            statusCode: res.statusCode,
            data: JSON.parse(data) 
          });
        } catch (e) {
          resolve({ success: false, error: 'Parse error', raw: data.substring(0, 200) });
        }
      });
    });
    
    req.on('error', (e) => resolve({ success: false, error: e.message }));
    req.setTimeout(timeout, () => {
      req.abort();
      resolve({ success: false, error: 'Timeout' });
    });
    
    if (body) req.write(JSON.stringify(body));
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
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: 'API token not configured' })
    };
  }

  const sku = event.queryStringParameters?.sku;
  let updates;

  try {
    updates = event.body ? JSON.parse(event.body) : [];
  } catch (e) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ success: false, error: 'Invalid JSON in request body' })
    };
  }

  if (!sku || !Array.isArray(updates) || updates.length === 0) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ success: false, error: 'SKU and updates array required' })
    };
  }

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

  try {
    const payload = {
      product: {
        custom_attributes: updates.map(u => ({
          attribute_code: u.attribute_code,
          value: u.value || ''
        }))
      }
    };

    const url = `${BASE_URL}/products/${encodeURIComponent(sku)}`;
    const result = await makeRequest(url, 'PUT', payload);

    if (!result.success) {
      return {
        statusCode: result.statusCode || 500,
        headers,
        body: JSON.stringify({ 
          success: false, 
          error: result.error || 'Update failed',
          details: result.raw 
        })
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        sku: sku,
        updated_attributes: updates.map(u => u.attribute_code),
        timestamp: new Date().toISOString()
      })
    };

  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: error.message })
    };
  }
};
