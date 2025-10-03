exports.handler = async (event, context) => {
  console.log('Real-time Magento API function started');
  
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
    // Get date from query parameters or use today
    const selectedDate = event.queryStringParameters?.date || new Date().toISOString().split('T')[0];
    
    console.log('Fetching REAL orders for date:', selectedDate);
    
    // Construct API URL with proper date filtering
    const apiUrl = `${BASE_URL}/orders?searchCriteria[filterGroups][0][filters][0][field]=created_at&searchCriteria[filterGroups][0][filters][0][value]=${selectedDate}&searchCriteria[filterGroups][0][filters][0][conditionType]=from&searchCriteria[filterGroups][1][filters][0][field]=created_at&searchCriteria[filterGroups][1][filters][0][value]=${selectedDate} 23:59:59&searchCriteria[filterGroups][1][filters][0][conditionType]=to&searchCriteria[pageSize]=500`;
    
    const response = await fetch(apiUrl, {
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Magento API returned ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('REAL API response received - total orders:', data.total_count);
    
    // Process REAL order data - no random numbers
    const totalOrders = data.total_count || 0;
    let totalRevenue = 0;
    let pendingCount = 0;
    let processingCount = 0;
    let completedCount = 0;
    let cancelledCount = 0;
    let codCount = 0;
    let onlineCount = 0;
    let recentOrders = [];

    if (data.items && data.items.length > 0) {
      data.items.forEach(order => {
        // REAL revenue calculation
        totalRevenue += parseFloat(order.grand_total || 0);
        
        // REAL status counting
        const status = (order.status || '').toLowerCase();
        switch(status) {
          case 'pending':
            pendingCount++;
            break;
          case 'processing':
            processingCount++;
            break;
          case 'complete':
          case 'completed':
            completedCount++;
            break;
          case 'canceled':
          case 'cancelled':
            cancelledCount++;
            break;
        }
        
        // REAL payment method counting
        const paymentMethod = (order.payment?.method || '').toLowerCase();
        if (paymentMethod.includes('cashondelivery') || paymentMethod.includes('cod')) {
          codCount++;
        } else if (paymentMethod.includes('razorpay')) {
          onlineCount++;
        }
        
        // REAL recent orders
        recentOrders.push({
          id: order.increment_id || order.entity_id,
          customer: `${order.customer_firstname || ''} ${order.customer_lastname || ''}`.trim() || 'Guest',
          amount: parseFloat(order.grand_total || 0),
          status: order.status,
          time: order.created_at ? new Date(order.created_at).toLocaleTimeString('en-IN', { timeStyle: 'short' }) : 'Unknown'
        });
      });
      
      // Sort recent orders by most recent
      recentOrders.sort((a, b) => new Date(b.time) - new Date(a.time));
      recentOrders = recentOrders.slice(0, 5);
    }

    // REAL calculated metrics
    const averageOrderValue = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;
    const successRate = totalOrders > 0 ? Math.round(((completedCount + processingCount) / totalOrders) * 100) : 0;

    const result = {
      success: true,
      realData: true,
      selectedDate,
      totalOrders,
      totalRevenue: Math.round(totalRevenue),
      pendingOrders: pendingCount,
      processingOrders: processingCount,
      completedOrders: completedCount,
      cancelledOrders: cancelledCount,
      codOrders: codCount,
      onlineOrders: onlineCount,
      averageOrderValue,
      successRate,
      recentOrders,
      timestamp: new Date().toISOString()
    };

    console.log('Returning REAL data:', result);
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(result)
    };
    
  } catch (error) {
    console.error('Magento API function error:', error.message);
    
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
