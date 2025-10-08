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
    
    // Fetch orders with custom attributes
    const ordersUrl = `${BASE_URL}/orders?searchCriteria[filterGroups][0][filters][0][field]=created_at&searchCriteria[filterGroups][0][filters][0][value]=${selectedDate}&searchCriteria[filterGroups][0][filters][0][conditionType]=from&searchCriteria[pageSize]=500`;
    
    const response = await fetch(ordersUrl, {
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();
    
    let callOrders = 0;
    let teleSales = 0;
    let webOrders = 0;
    let onlineOrders = 0;
    
    if (data.items) {
      data.items.forEach(order => {
        // Classification logic based on order attributes
        let orderType = 'Online'; // Default
        
        // Check for custom attributes that indicate order source
        if (order.custom_attributes) {
          const sourceAttr = order.custom_attributes.find(attr => 
            attr.attribute_code === 'order_source' || 
            attr.attribute_code === 'channel_source'
          );
          
          if (sourceAttr) {
            const source = sourceAttr.value.toLowerCase();
            if (source.includes('call') || source.includes('replacement')) {
              orderType = 'Call Order';
            } else if (source.includes('tele') || source.includes('phone')) {
              orderType = 'Tele-Sales';
            } else if (source.includes('web') || source.includes('website')) {
              orderType = 'Web';
            }
          }
        }
        
        // Fallback classification based on other order properties
        if (orderType === 'Online') {
          // Use payment method or other indicators
          const paymentMethod = order.payment?.method || '';
          if (paymentMethod.includes('phone') || order.customer_note?.includes('call')) {
            orderType = 'Call Order';
          }
        }
        
        // Count by type
        switch (orderType) {
          case 'Call Order':
            callOrders++;
            break;
          case 'Tele-Sales':
            teleSales++;
            break;
          case 'Web':
            webOrders++;
            break;
          default:
            onlineOrders++;
        }
      });
    }
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        date: selectedDate,
        orderTypes: {
          callOrders,
          teleSales,
          webOrders,
          onlineOrders
        },
        total: callOrders + teleSales + webOrders + onlineOrders
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
