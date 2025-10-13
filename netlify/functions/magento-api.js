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
    
    console.log('Fetching orders for date:', selectedDate);
    
    // Fetch orders from Magento
    const ordersUrl = `${BASE_URL}/orders?searchCriteria[filterGroups][0][filters][0][field]=created_at&searchCriteria[filterGroups][0][filters][0][value]=${selectedDate}&searchCriteria[filterGroups][0][filters][0][conditionType]=from&searchCriteria[filterGroups][1][filters][0][field]=created_at&searchCriteria[filterGroups][1][filters][0][value]=${selectedDate} 23:59:59&searchCriteria[filterGroups][1][filters][0][conditionType]=to&searchCriteria[pageSize]=500`;
    
    const ordersResponse = await fetch(ordersUrl, {
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    if (!ordersResponse.ok) {
      throw new Error(`Magento API error: ${ordersResponse.status}`);
    }

    const ordersData = await ordersResponse.json();
    
    // Process the data
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
        
        switch (order.status) {
          case 'complete':
            completedOrders++;
            break;
          case 'pending':
            pendingOrders++;
            break;
          case 'canceled':
          case 'cancelled':
            cancelledOrders++;
            break;
        }
        
        // Check payment method
        if (order.payment && order.payment.method) {
          if (order.payment.method.toLowerCase().includes('cod') || 
              order.payment.method.toLowerCase().includes('cash')) {
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
      date: selectedDate,
      totalOrders,
      totalRevenue: Math.round(totalRevenue),
      completedOrders,
      pendingOrders,
      cancelledOrders,
      codOrders,
      onlineOrders,
      averageOrderValue,
      successRate: parseFloat(successRate),
      items: ordersData.items || []
    };

    console.log('Processed orders:', totalOrders);
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(result)
    };
    
  } catch (error) {
    console.error('API Error:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message,
        date: event.queryStringParameters?.date
      })
    };
  }
};
