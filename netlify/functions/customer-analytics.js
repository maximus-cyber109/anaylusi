const https = require('https');

function makeRequest(url, token) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

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
    
    console.log('[CUSTOMER-ANALYTICS] Fetching from', startDate, 'to', endDate);
    
    const ordersUrl = `${BASE_URL}/orders?searchCriteria[filterGroups][0][filters][0][field]=created_at&searchCriteria[filterGroups][0][filters][0][value]=${startDate}&searchCriteria[filterGroups][0][filters][0][conditionType]=from&searchCriteria[filterGroups][1][filters][0][field]=created_at&searchCriteria[filterGroups][1][filters][0][value]=${endDate} 23:59:59&searchCriteria[filterGroups][1][filters][0][conditionType]=to&searchCriteria[pageSize]=2000`;
    
    const ordersData = await makeRequest(ordersUrl, API_TOKEN);
    
    console.log('[CUSTOMER-ANALYTICS] Orders fetched:', ordersData.total_count || 0);
    
    const customerMap = new Map();
    const today = new Date();
    
    if (ordersData.items && ordersData.items.length > 0) {
      ordersData.items.forEach(order => {
        const customerId = order.customer_id || `guest_${order.customer_email}` || `guest_${order.entity_id}`;
        const customerEmail = order.customer_email || 'N/A';
        const customerFirstName = order.customer_firstname || 'Guest';
        const customerLastName = order.customer_lastname || 'Customer';
        const customerName = `${customerFirstName} ${customerLastName}`.trim();
        
        // Extract phone number
        let customerPhone = 'N/A';
        if (order.billing_address && order.billing_address.telephone) {
          customerPhone = order.billing_address.telephone;
        }
        
        const orderDate = new Date(order.created_at);
        const orderValue = parseFloat(order.grand_total) || 0;
        const orderStatus = (order.status || '').toLowerCase();
        const isCompleted = orderStatus === 'complete';
        const orderId = order.increment_id || order.entity_id;
        
        if (customerMap.has(customerId)) {
          const customer = customerMap.get(customerId);
          customer.totalOrders++;
          customer.totalSpent += orderValue;
          
          if (isCompleted) {
            customer.completedOrders++;
            customer.completedValue += orderValue;
          }
          
          if (orderDate > new Date(customer.lastOrderDate)) {
            customer.lastOrderDate = orderDate.toISOString();
            customer.daysSinceLastOrder = Math.ceil((today - orderDate) / (1000 * 60 * 60 * 24));
          }
          
          customer.orders.push({
            orderId,
            orderDate: orderDate.toISOString(),
            orderValue,
            status: orderStatus
          });
          
        } else {
          const daysSinceOrder = Math.ceil((today - orderDate) / (1000 * 60 * 60 * 24));
          
          customerMap.set(customerId, {
            customerId,
            customerName,
            customerEmail,
            customerPhone,
            totalOrders: 1,
            totalSpent: orderValue,
            completedOrders: isCompleted ? 1 : 0,
            completedValue: isCompleted ? orderValue : 0,
            firstOrderDate: orderDate.toISOString(),
            lastOrderDate: orderDate.toISOString(),
            daysSinceLastOrder: daysSinceOrder,
            orders: [{
              orderId,
              orderDate: orderDate.toISOString(),
              orderValue,
              status: orderStatus
            }]
          });
        }
      });
    }
    
    // Calculate RFM metrics
    const customers = Array.from(customerMap.values()).map(customer => {
      const avgOrderValue = customer.totalOrders > 0 ? 
        Math.round(customer.completedValue / customer.totalOrders) : 0;
      
      const successRate = customer.totalOrders > 0 ? 
        ((customer.completedOrders / customer.totalOrders) * 100).toFixed(1) : 0;
      
      const customerLifetimeValue = Math.round(customer.completedValue);
      
      const daysSinceFirstOrder = Math.ceil(
        (today - new Date(customer.firstOrderDate)) / (1000 * 60 * 60 * 24)
      );
      
      // RFM Segmentation (simplified)
      let segment = 'New';
      if (customer.totalOrders >= 5 && customer.daysSinceLastOrder <= 30) {
        segment = 'Champions';
      } else if (customer.totalOrders >= 3 && customer.daysSinceLastOrder <= 60) {
        segment = 'Loyal';
      } else if (customer.totalOrders >= 3 && customer.daysSinceLastOrder > 90) {
        segment = 'At Risk';
      } else if (customer.totalOrders === 1 && customer.daysSinceLastOrder <= 30) {
        segment = 'New';
      } else if (customer.daysSinceLastOrder > 180) {
        segment = 'Hibernating';
      }
      
      return {
        customerId: customer.customerId,
        customerName: customer.customerName,
        customerEmail: customer.customerEmail,
        customerPhone: customer.customerPhone,
        totalOrders: customer.totalOrders,
        totalSpent: Math.round(customer.totalSpent),
        completedOrders: customer.completedOrders,
        completedValue: Math.round(customer.completedValue),
        avgOrderValue,
        successRate: parseFloat(successRate),
        customerLifetimeValue,
        firstOrderDate: customer.firstOrderDate,
        lastOrderDate: customer.lastOrderDate,
        daysSinceLastOrder: customer.daysSinceLastOrder,
        daysSinceFirstOrder,
        segment,
        orders: customer.orders
      };
    });
    
    // Sort by lifetime value
    customers.sort((a, b) => b.customerLifetimeValue - a.customerLifetimeValue);
    
    // Segment counts
    const segments = {
      champions: customers.filter(c => c.segment === 'Champions').length,
      loyal: customers.filter(c => c.segment === 'Loyal').length,
      atRisk: customers.filter(c => c.segment === 'At Risk').length,
      new: customers.filter(c => c.segment === 'New').length,
      hibernating: customers.filter(c => c.segment === 'Hibernating').length
    };
    
    const result = {
      success: true,
      dateRange: { startDate, endDate },
      totalCustomers: customers.length,
      totalRevenue: customers.reduce((sum, c) => sum + c.completedValue, 0),
      avgCustomerValue: customers.length > 0 ? 
        Math.round(customers.reduce((sum, c) => sum + c.completedValue, 0) / customers.length) : 0,
      segments,
      customers,
      debug: {
        ordersProcessed: ordersData.items ? ordersData.items.length : 0,
        customersFound: customers.length
      }
    };

    console.log('[CUSTOMER-ANALYTICS] Processed', customers.length, 'customers');
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(result)
    };
    
  } catch (error) {
    console.error('[CUSTOMER-ANALYTICS ERROR]:', error.message);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message,
        debug: {
          errorType: error.constructor.name
        }
      })
    };
  }
};
