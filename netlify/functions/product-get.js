const https = require('https');

const MAGENTO_TOKEN = process.env.MAGENTO_API_TOKEN;

const HEADERS = {
  'Authorization': `Bearer ${MAGENTO_TOKEN}`,
  'Content-Type': 'application/json',
  'User-Agent': 'PB_ProductManager'
};

function log(msg, data = null) {
  console.log(`[${new Date().toISOString()}] ${msg}`, data || '');
}

function makeRequest(url, timeout = 8000) {
  return new Promise((resolve) => {
    log(`GET ${url.substring(url.indexOf('/rest'))}`);
    
    const req = https.request(url, { method: 'GET', headers: HEADERS }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        log(`✓ ${res.statusCode}`);
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
    
    req.on('error', (e) => {
      log('ERROR: ' + e.message);
      resolve({ success: false, error: e.message });
    });
    
    req.setTimeout(timeout, () => {
      log('ERROR: Timeout');
      req.abort();
      resolve({ success: false, error: 'Timeout' });
    });
    
    req.end();
  });
}

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
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
  
  if (!sku) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ success: false, error: 'SKU required' })
    };
  }
  
  try {
    log(`📦 Getting product: ${sku}`);
    
    const url = `https://pinkblue.in/rest/all/V1/products/${encodeURIComponent(sku)}`;
    const result = await makeRequest(url);
    
    if (!result.success) {
      return {
        statusCode: result.statusCode || 404,
        headers,
        body: JSON.stringify({ 
          success: false, 
          error: result.error || 'Product not found' 
        })
      };
    }
    
    const product = result.data;
    
    const updatableAttrs = [
      'description', 'short_description', 'features', 'technical_details',
      'package_content', 'key_specification1', 'key_specification2',
      'key_specification3', 'key_specification4', 'meta_title',
      'meta_description', 'meta_keyword', 'special_offers', 'pdt_tags'
    ];
    
    const attributes = {};
    updatableAttrs.forEach(attr => {
      const found = product.custom_attributes?.find(ca => ca.attribute_code === attr);
      attributes[attr] = found ? found.value : '';
    });
    
    log(`✓ Found ${Object.keys(attributes).length} attributes`);
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        sku: product.sku,
        id: product.id,
        name: product.name,
        price: product.price,
        status: product.status,
        attributes: attributes
      })
    };
    
  } catch (error) {
    log('ERROR: ' + error.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: error.message })
    };
  }
};
