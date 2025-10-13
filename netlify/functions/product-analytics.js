const fetch = require('node-fetch');

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const API_TOKEN = 't5xkjvxlgitd25cuhxixl9dflw008f4e';
  const BASE_URL = 'https://pinkblue.in/rest/V1';
  
  try {
    const selectedDate = event.queryStringParameters?.date || new Date().toISOString().split('T')[0];
    const startDate = event.queryStringParameters?.startDate || selectedDate;
    const endDate = event.queryStringParameters?.endDate || selectedDate;
    
    console.log('Fetching products for:', startDate, 'to', endDate);
    
    const ordersUrl = `${BASE_URL}/orders?searchCriteria[filterGroups][0][filters][0][field]=created_at&searchCriteria[filterGroups][0][filters][0][value]=${startDate}&searchCriteria[filterGroups][0][filters][0][conditionType]=from&searchCriteria[filterGroups][1][filters][0][field]=created_at&searchCriteria[filterGroups][1][filters][0][value]=${endDate} 23:59:59&searchCriteria[filterGroups][1][filters][0][conditionType]=to&searchCriteria[pageSize]=1000`;
    
    const ordersResponse = await fetch(ordersUrl, {
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    const ordersData = await ordersResponse.json();
    
    // Process products
    const productMap = new Map();
    
    if (ordersData.items && ordersData.items.length > 0) {
      ordersData.items.forEach(order => {
        const orderStatus = order.status;
        const isCompleted = orderStatus === 'complete';
        
        if (order.items && order.items.length > 0) {
          order.items.forEach(item => {
            const sku = item.sku;
            const quantity = parseInt(item.qty_ordered) || 0;
            const revenue = parseFloat(item.row_total) || 0;
            
            if (productMap.has(sku)) {
              const p = productMap.get(sku);
              p.totalOrders++;
              p.sales += quantity;
              p.grossRevenue += revenue;
              if (isCompleted) {
                p.completedOrders++;
                p.netRevenue += revenue;
              }
            } else {
              productMap.set(sku, {
                sku,
                name: item.name,
                totalOrders: 1,
                sales: quantity,
                grossRevenue: revenue,
                netRevenue: isCompleted ? revenue : 0,
                completedOrders: isCompleted ? 1 : 0,
                type: 'Web'
              });
            }
          });
        }
      });
    }
    
    const products = Array.from(productMap.values())
      .map(p => ({
        ...p,
        avgOrderValue: p.sales > 0 ? Math.round(p.netRevenue / p.sales) : 0,
        successRate: p.totalOrders > 0 ? ((p.completedOrders / p.totalOrders) * 100).toFixed(1) : 0,
        growth: (Math.random() * 40 + 5).toFixed(1) // Simulated growth
      }))
      .sort((a, b) => b.netRevenue - a.netRevenue);
    
    const result = {
      success: true,
      dateRange: { startDate, endDate },
      products,
      totalProducts: products.length,
      totalRevenue: products.reduce((sum, p) => sum + p.netRevenue, 0)
    };

    console.log('Products processed:', products.length);
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(result)
    };
    
  } catch (error) {
    console.error('Product Analytics Error:', error);
    
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
