exports.handler = async (event, context) => {
  console.log('Real-time dashboard function started');
  
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
    // Get current date dynamically for real-time data
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const todayStr = `${yyyy}-${mm}-${dd}`;
    
    console.log('Fetching real-time orders for:', todayStr);
    
    // Fetch ALL orders for today to get complete picture
    const response = await fetch(`${BASE_URL}/orders?searchCriteria[filterGroups][0][filters][0][field]=created_at&searchCriteria[filterGroups][0][filters][0][value]=${todayStr}&searchCriteria[filterGroups][0][filters][0][conditionType]=from&searchCriteria[pageSize]=500`, {
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Magento API returned ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('Real-time API response - total orders:', data.total_count);
    
    // Calculate comprehensive real-time metrics
    const totalOrders = data.total_count || 0;
    let totalRevenue = 0;
    let pendingCount = 0;
    let processingCount = 0;
    let completedCount = 0;
    let cancelledCount = 0;
    let codCount = 0;
    let razorpayCount = 0;
    let recentOrders = [];

    if (data.items) {
      data.items.forEach(order => {
        totalRevenue += parseFloat(order.grand_total || 0);
        
        // Count all order statuses including cancelled
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
        
        // Payment method breakdown
        const paymentMethod = (order.payment?.method || '').toLowerCase();
        if (paymentMethod.includes('cashondelivery') || paymentMethod.includes('cod')) {
          codCount++;
        } else if (paymentMethod.includes('razorpay')) {
          razorpayCount++;
        }
        
        // Store recent orders for additional insights
        recentOrders.push({
          id: order.increment_id,
          time: order.created_at,
          amount: parseFloat(order.grand_total || 0),
          status: order.status,
          customer: order.customer_firstname + ' ' + order.customer_lastname
        });
      });
      
      // Sort by most recent
      recentOrders.sort((a, b) => new Date(b.time) - new Date(a.time));
      recentOrders = recentOrders.slice(0, 5); // Last 5 orders
    }

    const result = {
      success: true,
      realTime: true,
      timestamp: new Date().toISOString(),
      currentDate: todayStr,
      
      // Core metrics
      totalOrders,
      totalRevenue,
      pendingOrders: pendingCount,
      processingOrders: processingCount,
      completedOrders: completedCount,
      cancelledOrders: cancelledCount, // NEW: Real cancelled orders data
      
      // Payment breakdown
      codOrders: codCount,
      razorpayOrders: razorpayCount,
      
      // Calculated metrics
      averageOrderValue: totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0,
      cancellationRate: totalOrders > 0 ? Math.round((cancelledCount / totalOrders) * 100) : 0,
      
      // Additional insights
      recentOrders,
      lastUpdated: new Date().toISOString()
    };

    console.log('Returning enhanced real-time data:', result);
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(result)
    };
    
  } catch (error) {
    console.error('Real-time function error:', error.message);
    
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
