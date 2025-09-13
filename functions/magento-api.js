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
    const today = '2025-09-13'; // You can make this dynamic later
    
    const response = await fetch(`${BASE_URL}/orders?searchCriteria[filterGroups][0][filters][0][field]=created_at&searchCriteria[filterGroups][0][filters][0][value]=${today}&searchCriteria[filterGroups][0][filters][0][conditionType]=from&searchCriteria[pageSize]=100`, {
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();
    
    const totalOrders = data.total_count || 0;
    let totalRevenue = 0;
    let pendingCount = 0;
    let processingCount = 0;
    let codCount = 0;
    let razorpayCount = 0;

    if (data.items) {
      data.items.forEach(order => {
        totalRevenue += parseFloat(order.grand_total || 0);
        
        if (order.status === 'pending') pendingCount++;
        if (order.status === 'processing') processingCount++;
        
        const paymentMethod = (order.payment?.method || '').toLowerCase();
        if (paymentMethod.includes('cashondelivery') || paymentMethod.includes('cod')) {
          codCount++;
        } else if (paymentMethod.includes('razorpay')) {
          razorpayCount++;
        }
      });
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        totalOrders,
        totalRevenue,
        pendingOrders: pendingCount,
        processingOrders: processingCount,
        codOrders: codCount,
        razorpayOrders: razorpayCount,
        averageOrderValue: totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0,
        lastUpdated: new Date().toISOString()
      })
    };
    
  } catch (error) {
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
