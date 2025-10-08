exports.handler = async (event, context) => {
  console.log('Product Analytics function started');
  
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
    // Get date from query parameters
    const selectedDate = event.queryStringParameters?.date || new Date().toISOString().split('T')[0];
    const startDate = event.queryStringParameters?.startDate || selectedDate;
    const endDate = event.queryStringParameters?.endDate || selectedDate;
    
    console.log('Fetching product data for date range:', startDate, 'to', endDate);
    
    // First, fetch orders for the date range
    const ordersUrl = `${BASE_URL}/orders?searchCriteria[filterGroups][0][filters][0][field]=created_at&searchCriteria[filterGroups][0][filters][0][value]=${startDate}&searchCriteria[filterGroups][0][filters][0][conditionType]=from&searchCriteria[filterGroups][1][filters][0][field]=created_at&searchCriteria[filterGroups][1][filters][0][value]=${endDate} 23:59:59&searchCriteria[filterGroups][1][filters][0][conditionType]=to&searchCriteria[pageSize]=500`;
    
    const ordersResponse = await fetch(ordersUrl, {
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    if (!ordersResponse.ok) {
      throw new Error(`Orders API returned ${ordersResponse.status}: ${ordersResponse.statusText}`);
    }

    const ordersData = await ordersResponse.json();
    console.log('Orders fetched:', ordersData.total_count);
    
    // Process orders to extract product performance
    const productMap = new Map();
    
    if (ordersData.items && ordersData.items.length > 0) {
      for (const order of ordersData.items) {
        // Skip cancelled orders for revenue calculation
        if (order.status === 'canceled' || order.status === 'cancelled') {
          continue;
        }
        
        if (order.items && order.items.length > 0) {
          for (const item of order.items) {
            const sku = item.sku;
            const productName = item.name;
            const quantity = parseInt(item.qty_ordered) || 0;
            const revenue = parseFloat(item.row_total) || 0;
            
            // Determine order type - Enhanced logic
            let orderType = 'Online'; // Default
            
            // Check order source from extension attributes or custom fields
            if (order.extension_attributes && order.extension_attributes.order_source) {
              orderType = order.extension_attributes.order_source;
            } else if (order.custom_attributes) {
              const sourceAttr = order.custom_attributes.find(attr => 
                attr.attribute_code === 'order_source' || 
                attr.attribute_code === 'source_channel' ||
                attr.attribute_code === 'channel'
              );
              if (sourceAttr) {
                orderType = sourceAttr.value;
              }
            }
            
            // Fallback classification based on order properties
            if (orderType === 'Online') {
              const paymentMethod = (order.payment?.method || '').toLowerCase();
              const customerNote = (order.customer_note || '').toLowerCase();
              const adminNote = '';
              
              // Check for call order indicators
              if (customerNote.includes('call') || 
                  customerNote.includes('replacement') || 
                  customerNote.includes('phone order')) {
                orderType = 'Call Order';
              } 
              // Check for tele-sales indicators
              else if (customerNote.includes('tele') || 
                       paymentMethod.includes('phone') ||
                       customerNote.includes('sales call')) {
                orderType = 'Tele-Sales';
              }
              // Check for web order indicators
              else if (paymentMethod.includes('razorpay') || 
                       paymentMethod.includes('online') ||
                       order.customer_email) {
                orderType = 'Web';
              }
            }
            
            // Aggregate product data
            if (productMap.has(sku)) {
              const existing = productMap.get(sku);
              existing.sales += quantity;
              existing.revenue += revenue;
              // Track multiple order types for same product
              if (!existing.orderTypes.includes(orderType)) {
                existing.orderTypes.push(orderType);
              }
            } else {
              productMap.set(sku, {
                sku,
                name: productName,
                sales: quantity,
                revenue: Math.round(revenue),
                type: orderType,
                orderTypes: [orderType], // Track all order types for this product
                avgOrderValue: quantity > 0 ? Math.round(revenue / quantity) : 0
              });
            }
          }
        }
      }
    }
    
    // Convert map to array and sort by revenue
    const products = Array.from(productMap.values())
      .map(product => ({
        ...product,
        // Use primary order type (most common) for display
        type: product.orderTypes.length > 1 ? 'Mixed' : product.type
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 20); // Top 20 products
    
    // Calculate some summary stats
    const totalProductRevenue = products.reduce((sum, p) => sum + p.revenue, 0);
    const totalProductSales = products.reduce((sum, p) => sum + p.sales, 0);
    
    const result = {
      success: true,
      dateRange: { startDate, endDate },
      products,
      summary: {
        totalProducts: productMap.size,
        topProductsRevenue: totalProductRevenue,
        topProductsSales: totalProductSales,
        averageProductValue: products.length > 0 ? Math.round(totalProductRevenue / products.length) : 0
      },
      timestamp: new Date().toISOString()
    };

    console.log('Product analytics processed:', {
      totalProducts: productMap.size,
      topProducts: products.length,
      totalRevenue: totalProductRevenue
    });
    
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
        error: error.message,
        timestamp: new Date().toISOString()
      })
    };
  }
};
