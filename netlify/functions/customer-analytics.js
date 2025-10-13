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
    const startDate = event.queryStringParameters?.startDate || new Date().toISOString().split('T')[0];
    const endDate = event.queryStringParameters?.endDate || startDate;
    
    console.log('Customer segmentation for:', startDate, 'to', endDate);
    
    const ordersUrl = `${BASE_URL}/orders?searchCriteria[filterGroups][0][filters][0][field]=created_at&searchCriteria[filterGroups][0][filters][0][value]=${startDate}&searchCriteria[filterGroups][0][filters][0][conditionType]=from&searchCriteria[filterGroups][1][filters][0][field]=created_at&searchCriteria[filterGroups][1][filters][0][value]=${endDate} 23:59:59&searchCriteria[filterGroups][1][filters][0][conditionType]=to&searchCriteria[pageSize]=1000`;
    
    const ordersResponse = await fetch(ordersUrl, {
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    const ordersData = await ordersResponse.json();
    
    // Process customers
    const customerMap = new Map();
    const today = new Date();
    
    if (ordersData.items && ordersData.items.length > 0) {
      ordersData.items.forEach(order => {
        const customerId = order.customer_id || `guest_${order.customer_email}`;
        const customerEmail = order.customer_email || 'guest@example.com';
        const orderValue = parseFloat(order.grand_total) || 0;
        const orderDate = new Date(order.created_at);
        const isCompleted = order.status === 'complete';
        
        if (customerMap.has(customerId)) {
          const customer = customerMap.get(customerId);
          customer.frequency++;
          customer.monetary += orderValue;
          if (isCompleted) customer.completedOrders++;
          if (orderDate > new Date(customer.lastOrderDate)) {
            customer.lastOrderDate = orderDate.toISOString();
          }
        } else {
          customerMap.set(customerId, {
            customerId,
            email: customerEmail,
            recency: Math.ceil((today - orderDate) / (1000 * 60 * 60 * 24)),
            frequency: 1,
            monetary: orderValue,
            completedOrders: isCompleted ? 1 : 0,
            lastOrderDate: orderDate.toISOString()
          });
        }
      });
    }
    
    // RFM Segmentation
    const customers = Array.from(customerMap.values());
    
    const segments = {
      champions: customers.filter(c => c.frequency >= 5 && c.monetary > 10000).length,
      loyal: customers.filter(c => c.frequency >= 3 && c.frequency < 5).length,
      atRisk: customers.filter(c => c.recency > 90 && c.frequency >= 3).length,
      newCustomers: customers.filter(c => c.frequency === 1 && c.recency <= 30).length
    };
    
    const result = {
      success: true,
      dateRange: { startDate, endDate },
      totalCustomers: customers.length,
      segments,
      analytics: {
        avgCustomerValue: customers.length > 0 ? (customers.reduce((sum, c) => sum + c.monetary, 0) / customers.length).toFixed(0) : 0,
        avgOrderFrequency: customers.length > 0 ? (customers.reduce((sum, c) => sum + c.frequency, 0) / customers.length).toFixed(1) : 0
      }
    };

    console.log('Customers analyzed:', customers.length);
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(result)
    };
    
  } catch (error) {
    console.error('Customer Analytics Error:', error);
    
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
