const https = require('https');

function makeRequest(url, token) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        
        // ★★★ CUSTOM HEADERS FOR FIREWALL WHITELISTING ★★★
        'User-Agent': 'PB_Netlify', 
        'X-Source-App': 'GameOfCrowns', 
        'X-Netlify-Secret': 'X-PB-NetlifY2025-901AD7EE35110CCB445F3CA0EBEB1494'
      }
    };

    console.log('[DEBUG] Making request to:', urlObj.pathname);

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          console.log('[DEBUG] Response status:', res.statusCode);
          resolve(parsed);
        } catch (e) {
          console.error('[ERROR] JSON parse failed:', e.message);
          reject(e);
        }
      });
    });

    req.on('error', (e) => {
      console.error('[ERROR] Request failed:', e.message);
      reject(e);
    });

    req.end();
  });
}

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  // Use ENV variable first, fallback to the hardcoded string if needed
  const API_TOKEN = process.env.MAGENTO_API_TOKEN || 't5xkjvxlgitd25cuhxixl9dflw008f4e';
  // Ensure we use the /rest/V1 base URL
  const BASE_URL = (process.env.MAGENTO_BASE_URL || 'https://pinkblue.in').replace(/\/$/, '') + '/rest/V1';
  
  try {
    const date = event.queryStringParameters?.date || new Date().toISOString().split('T')[0];
    const startDate = event.queryStringParameters?.startDate || date;
    const endDate = event.queryStringParameters?.endDate || date;
    
    console.log('[DEBUG] Fetching orders from', startDate, 'to', endDate);
    
    // Note: 'filterGroups' (camelCase) is standard for some libraries, but raw Magento API often uses 'filter_groups' (snake_case).
    // I've kept your camelCase as it was in your snippet, but if it fails, try changing to snake_case.
    const ordersUrl = `${BASE_URL}/orders?searchCriteria[filterGroups][0][filters][0][field]=created_at&searchCriteria[filterGroups][0][filters][0][value]=${startDate}&searchCriteria[filterGroups][0][filters][0][conditionType]=from&searchCriteria[filterGroups][1][filters][0][field]=created_at&searchCriteria[filterGroups][1][filters][0][value]=${endDate} 23:59:59&searchCriteria[filterGroups][1][filters][0][conditionType]=to&searchCriteria[pageSize]=1000`;
    
    const ordersData = await makeRequest(ordersUrl, API_TOKEN);
    
    console.log('[DEBUG] Orders fetched:', ordersData.total_count || 0);
    
    let totalOrders = 0;
    let totalRevenue = 0;
    let completedOrders = 0;
    let pendingOrders = 0;
    let cancelledOrders = 0;
    let codOrders = 0;
    let onlineOrders = 0;
    
    if (ordersData.items && ordersData.items.length > 0) {
      ordersData.items.forEach(order => {
        totalOrders++;
        const orderValue = parseFloat(order.grand_total) || 0;
        totalRevenue += orderValue;
        
        const status = (order.status || '').toLowerCase();
        if (status === 'complete') completedOrders++;
        else if (status === 'pending' || status === 'processing') pendingOrders++;
        else if (status === 'canceled' || status === 'cancelled') cancelledOrders++;
        
        if (order.payment && order.payment.method) {
          if (order.payment.method.toLowerCase().includes('cod')) {
            codOrders++;
          } else {
            onlineOrders++;
          }
        }
      });
    }
    
    const successRate = totalOrders > 0 ? ((completedOrders / totalOrders) * 100).toFixed(1) : 0;
    const averageOrderValue = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;
    
    const result = {
      success: true,
      dateRange: { startDate, endDate },
      totalOrders,
      totalRevenue: Math.round(totalRevenue),
      completedOrders,
      pendingOrders,
      cancelledOrders,
      codOrders,
      onlineOrders,
      averageOrderValue,
      successRate: parseFloat(successRate),
      items: ordersData.items || [],
      debug: {
        apiCalled: true,
        totalCount: ordersData.total_count || 0,
        itemsReturned: ordersData.items ? ordersData.items.length : 0
      }
    };

    console.log('[DEBUG] Processing complete:', totalOrders, 'orders');
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(result)
    };
    
  } catch (error) {
    console.error('[ERROR] Function failed:', error.message);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message,
        debug: {
          errorType: error.constructor.name,
          errorStack: error.stack
        }
      })
    };
  }
};
