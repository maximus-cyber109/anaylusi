exports.handler = async (event, context) => {
  console.log('Cancellation Analytics function started');
  
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
    
    // Fetch cancelled orders
    const cancelledOrdersUrl = `${BASE_URL}/orders?searchCriteria[filterGroups][0][filters][0][field]=status&searchCriteria[filterGroups][0][filters][0][value]=canceled&searchCriteria[filterGroups][0][filters][0][conditionType]=eq&searchCriteria[filterGroups][1][filters][0][field]=created_at&searchCriteria[filterGroups][1][filters][0][value]=${startDate}&searchCriteria[filterGroups][1][filters][0][conditionType]=from&searchCriteria[filterGroups][2][filters][0][field]=created_at&searchCriteria[filterGroups][2][filters][0][value]=${endDate} 23:59:59&searchCriteria[filterGroups][2][filters][0][conditionType]=to&searchCriteria[pageSize]=500`;
    
    const cancelledResponse = await fetch(cancelledOrdersUrl, {
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    const cancelledData = await cancelledResponse.json();
    
    // Also fetch all orders for comparison
    const allOrdersUrl = `${BASE_URL}/orders?searchCriteria[filterGroups][0][filters][0][field]=created_at&searchCriteria[filterGroups][0][filters][0][value]=${startDate}&searchCriteria[filterGroups][0][filters][0][conditionType]=from&searchCriteria[filterGroups][1][filters][0][field]=created_at&searchCriteria[filterGroups][1][filters][0][value]=${endDate} 23:59:59&searchCriteria[filterGroups][1][filters][0][conditionType]=to&searchCriteria[pageSize]=1000`;
    
    const allOrdersResponse = await fetch(allOrdersUrl, {
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    const allOrdersData = await allOrdersResponse.json();
    
    // Process cancellation data by product
    const productCancellations = new Map();
    const productTotals = new Map();
    
    // Process cancelled orders
    if (cancelledData.items) {
      cancelledData.items.forEach(order => {
        if (order.items) {
          order.items.forEach(item => {
            const sku = item.sku;
            const productName = item.name;
            const quantity = parseInt(item.qty_ordered) || 0;
            const revenue = parseFloat(item.row_total) || 0;
            
            if (productCancellations.has(sku)) {
              const existing = productCancellations.get(sku);
              existing.cancellations += quantity;
              existing.revenueImpact += revenue;
            } else {
              productCancellations.set(sku, {
                sku,
                name: productName,
                cancellations: quantity,
                revenueImpact: revenue
              });
            }
          });
        }
      });
    }
    
    // Process all orders for totals
    if (allOrdersData.items) {
      allOrdersData.items.forEach(order => {
        if (order.items) {
          order.items.forEach(item => {
            const sku = item.sku;
            const productName = item.name;
            const quantity = parseInt(item.qty_ordered) || 0;
            
            if (productTotals.has(sku)) {
              productTotals.get(sku).totalOrders += quantity;
            } else {
              productTotals.set(sku, {
                sku,
                name: productName,
                totalOrders: quantity
              });
            }
          });
        }
      });
    }
    
    // Combine data and calculate rates
    const products = [];
    productCancellations.forEach((cancellation, sku) => {
      const total = productTotals.get(sku);
      if (total) {
        const cancelRate = ((cancellation.cancellations / total.totalOrders) * 100).toFixed(1);
        products.push({
          sku: cancellation.sku,
          name: cancellation.name,
          totalOrders: total.totalOrders,
          cancellations: cancellation.cancellations,
          cancelRate: parseFloat(cancelRate),
          revenueImpact: Math.round(cancellation.revenueImpact)
        });
      }
    });
    
    // Sort by cancellation rate (highest first)
    products.sort((a, b) => b.cancelRate - a.cancelRate);
    
    const result = {
      success: true,
      dateRange: { startDate, endDate },
      totalCancellations: cancelledData.total_count || 0,
      cancellationRate: allOrdersData.total_count > 0 ? 
        ((cancelledData.total_count / allOrdersData.total_count) * 100).toFixed(1) : 0,
      revenueImpact: products.reduce((sum, p) => sum + p.revenueImpact, 0),
      products: products.slice(0, 20), // Top 20 most cancelled products
      timestamp: new Date().toISOString()
    };

    console.log('Cancellation analytics processed:', {
      totalCancellations: result.totalCancellations,
      affectedProducts: products.length
    });
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(result)
    };
    
  } catch (error) {
    console.error('Cancellation Analytics Error:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      })
    };
  }
};
