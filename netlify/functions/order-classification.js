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
    const date = event.queryStringParameters?.date || new Date().toISOString().split('T')[0];
    
    const ordersUrl = `${BASE_URL}/orders?searchCriteria[filterGroups][0][filters][0][field]=created_at&searchCriteria[filterGroups][0][filters][0][value]=${date}&searchCriteria[filterGroups][0][filters][0][conditionType]=from&searchCriteria[pageSize]=500`;
    
    const ordersResponse = await fetch(ordersUrl, {
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    const ordersData = await ordersResponse.json();
    
    const classification = {
      web: 0,
      call: 0,
      tele: 0,
      cod: 0,
      online: 0
    };
    
    if (ordersData.items) {
      ordersData.items.forEach(order => {
        // Classify by payment
        if (order.payment && order.payment.method) {
          if (order.payment.method.toLowerCase().includes('cod')) {
            classification.cod++;
          } else {
            classification.online++;
          }
        }
        
        // Classify by source (basic)
        const shippingMethod = order.shipping_description || '';
        if (shippingMethod.toLowerCase().includes('call')) {
          classification.call++;
        } else if (shippingMethod.toLowerCase().includes('tele')) {
          classification.tele++;
        } else {
          classification.web++;
        }
      });
    }
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        date,
        classification,
        total: ordersData.total_count || 0
      })
    };
    
  } catch (error) {
    console.error('Order Classification Error:', error);
    
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
