exports.handler = async (event, context) => {
  console.log('Function started');
  
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  } // ← This closing brace was missing!

  const API_TOKEN = 't5xkjvxlgitd25cuhxixl9dflw008f4e';
  const BASE_URL = 'https://pinkblue.in/rest/V1';
  
  try {
    console.log('Making API call to Magento...');
    
    const today = '2025-09-13';
    const apiUrl = `${BASE_URL}/orders?searchCriteria[filterGroups][0][filters][0][field]=created_at&searchCriteria[filterGroups][0][filters][0][value]=${today}&searchCriteria[filterGroups][0][filters][0][conditionType]=from&searchCriteria[pageSize]=100`;
    
    const response = await fetch(apiUrl, {
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`API returned ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('API response received, total_count:', data.total_count);
    
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

    const result = {
      success: true,
      totalOrders,
      totalRevenue,
      pendingOrders: pendingCount,
      processingOrders: processingCount,
      codOrders: codCount,
      razorpayOrders: razorpayCount,
      averageOrderValue: totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0,
      lastUpdated: new Date().toISOString()
    };

    console.log('Returning success data:', result);
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(result)
    };
    
  } catch (error) {
    console.error('Function error:', error.message);
    
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
