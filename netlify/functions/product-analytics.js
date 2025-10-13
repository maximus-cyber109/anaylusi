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
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
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

  const API_TOKEN = 't5xkjvxlgitd25cuhxixl9dflw008f4e';
  const BASE_URL = 'https://pinkblue.in/rest/V1';
  
  try {
    const startDate = event.queryStringParameters?.startDate || new Date().toISOString().split('T')[0];
    const endDate = event.queryStringParameters?.endDate || startDate;
    
    console.log('[PRODUCT-ANALYTICS] Fetching from', startDate, 'to', endDate);
    
    const ordersUrl = `${BASE_URL}/orders?searchCriteria[filterGroups][0][filters][0][field]=created_at&searchCriteria[filterGroups][0][filters][0][value]=${startDate}&searchCriteria[filterGroups][0][filters][0][conditionType]=from&searchCriteria[filterGroups][1][filters][0][field]=created_at&searchCriteria[filterGroups][1][filters][0][value]=${endDate} 23:59:59&searchCriteria[filterGroups][1][filters][0][conditionType]=to&searchCriteria[pageSize]=2000`;
    
    const ordersData = await makeRequest(ordersUrl, API_TOKEN);
    
    console.log('[PRODUCT-ANALYTICS] Orders fetched:', ordersData.total_count || 0);
    
    const productMap = new Map();
    
    if (ordersData.items && ordersData.items.length > 0) {
      ordersData.items.forEach(order => {
        const orderStatus = (order.status || '').toLowerCase();
        const isCompleted = orderStatus === 'complete';
        const isCancelled = orderStatus === 'canceled' || orderStatus === 'cancelled';
        const orderValue = parseFloat(order.grand_total) || 0;
        const orderDate = order.created_at;
        const orderId = order.increment_id || order.entity_id;
        
        // Determine order type
        let orderType = 'Web';
        if (order.payment && order.payment.method) {
          if (order.payment.method.toLowerCase().includes('cod')) orderType = 'COD';
          else if (order.payment.method.toLowerCase().includes('razorpay')) orderType = 'Online';
        }
        
        if (order.items && order.items.length > 0) {
          order.items.forEach(item => {
            const sku = item.sku;
            const productName = item.name;
            const quantity = parseInt(item.qty_ordered) || 0;
            const revenue = parseFloat(item.row_total) || 0;
            const unitPrice = parseFloat(item.price) || 0;
            
            if (productMap.has(sku)) {
              const p = productMap.get(sku);
              p.totalOrders++;
              p.quantity += quantity;
              p.grossRevenue += revenue;
              
              if (isCompleted) {
                p.completedOrders++;
                p.netRevenue += revenue;
              }
              
              if (isCancelled) {
                p.cancelledOrders++;
                p.cancelledQuantity += quantity;
                p.revenueImpact += revenue;
              }
              
              p.orders.push({
                orderId,
                orderDate,
                status: orderStatus,
                quantity,
                revenue,
                type: orderType
              });
              
              if (orderDate > p.lastOrderDate) p.lastOrderDate = orderDate;
              
            } else {
              productMap.set(sku, {
                sku,
                productName,
                totalOrders: 1,
                quantity,
                grossRevenue: revenue,
                netRevenue: isCompleted ? revenue : 0,
                completedOrders: isCompleted ? 1 : 0,
                cancelledOrders: isCancelled ? 1 : 0,
                cancelledQuantity: isCancelled ? quantity : 0,
                revenueImpact: isCancelled ? revenue : 0,
                unitPrice,
                orderType,
                firstOrderDate: orderDate,
                lastOrderDate: orderDate,
                orders: [{
                  orderId,
                  orderDate,
                  status: orderStatus,
                  quantity,
                  revenue,
                  type: orderType
                }]
              });
            }
          });
        }
      });
    }
    
    // Calculate metrics for each product
    const products = Array.from(productMap.values()).map(product => {
      const cancelRate = product.totalOrders > 0 ? 
        ((product.cancelledOrders / product.totalOrders) * 100).toFixed(1) : 0;
      
      const successRate = product.totalOrders > 0 ? 
        ((product.completedOrders / product.totalOrders) * 100).toFixed(1) : 0;
      
      const avgOrderValue = product.quantity > 0 ? 
        Math.round(product.netRevenue / product.quantity) : 0;
      
      return {
        sku: product.sku,
        productName: product.productName,
        totalOrders: product.totalOrders,
        quantity: product.quantity,
        grossRevenue: Math.round(product.grossRevenue),
        netRevenue: Math.round(product.netRevenue),
        completedOrders: product.completedOrders,
        cancelledOrders: product.cancelledOrders,
        cancelledQuantity: product.cancelledQuantity,
        revenueImpact: Math.round(product.revenueImpact),
        unitPrice: product.unitPrice,
        avgOrderValue,
        cancelRate: parseFloat(cancelRate),
        successRate: parseFloat(successRate),
        orderType: product.orderType,
        firstOrderDate: product.firstOrderDate,
        lastOrderDate: product.lastOrderDate,
        orders: product.orders
      };
    });
    
    // Sort by net revenue
    products.sort((a, b) => b.netRevenue - a.netRevenue);
    
    const result = {
      success: true,
      dateRange: { startDate, endDate },
      totalProducts: products.length,
      totalRevenue: products.reduce((sum, p) => sum + p.netRevenue, 0),
      totalOrders: products.reduce((sum, p) => sum + p.totalOrders, 0),
      products,
      debug: {
        ordersProcessed: ordersData.items ? ordersData.items.length : 0,
        productsFound: products.length
      }
    };

    console.log('[PRODUCT-ANALYTICS] Processed', products.length, 'products');
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(result)
    };
    
  } catch (error) {
    console.error('[PRODUCT-ANALYTICS ERROR]:', error.message);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message,
        debug: {
          errorType: error.constructor.name
        }
      })
    };
  }
};
