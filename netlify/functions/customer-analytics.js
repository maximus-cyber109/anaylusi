exports.handler = async (event, context) => {
  console.log('Customer Analytics & RFM Segmentation function started');
  
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
    const startDate = event.queryStringParameters?.startDate || selectedDate;
    const endDate = event.queryStringParameters?.endDate || selectedDate;
    const segmentationType = event.queryStringParameters?.type || 'rfm';
    
    console.log('Running customer segmentation:', segmentationType, 'for period:', startDate, 'to', endDate);
    
    // Fetch ALL customer orders for comprehensive analysis
    const ordersUrl = `${BASE_URL}/orders?searchCriteria[filterGroups][0][filters][0][field]=created_at&searchCriteria[filterGroups][0][filters][0][value]=${startDate}&searchCriteria[filterGroups][0][filters][0][conditionType]=from&searchCriteria[filterGroups][1][filters][0][field]=created_at&searchCriteria[filterGroups][1][filters][0][value]=${endDate} 23:59:59&searchCriteria[filterGroups][1][filters][0][conditionType]=to&searchCriteria[pageSize]=2000`;
    
    const ordersResponse = await fetch(ordersUrl, {
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    const ordersData = await ordersResponse.json();
    
    // Process customer data for RFM analysis
    const customerMap = new Map();
    const today = new Date();
    
    if (ordersData.items && ordersData.items.length > 0) {
      for (const order of ordersData.items) {
        const customerId = order.customer_id || `guest_${order.customer_email}` || `guest_${order.entity_id}`;
        const customerEmail = order.customer_email || 'guest@example.com';
        const customerName = `${order.customer_firstname || 'Guest'} ${order.customer_lastname || 'Customer'}`.trim();
        const orderDate = new Date(order.created_at);
        const orderValue = parseFloat(order.grand_total) || 0;
        const orderStatus = order.status;
        const isCompleted = orderStatus === 'complete';
        
        // Skip cancelled orders for RFM analysis
        if (orderStatus === 'canceled' || orderStatus === 'cancelled') continue;
        
        if (customerMap.has(customerId)) {
          const customer = customerMap.get(customerId);
          customer.frequency++;
          customer.monetary += orderValue;
          customer.totalOrders++;
          
          if (isCompleted) {
            customer.completedOrders++;
            customer.completedValue += orderValue;
          }
          
          // Update recency (days since last order)
          if (orderDate > new Date(customer.lastOrderDate)) {
            customer.lastOrderDate = orderDate.toISOString();
            customer.recency = Math.ceil((today - orderDate) / (1000 * 60 * 60 * 24));
          }
          
          customer.orders.push({
            orderId: order.increment_id || order.entity_id,
            date: order.created_at,
            value: orderValue,
            status: orderStatus
          });
        } else {
          const recency = Math.ceil((today - orderDate) / (1000 * 60 * 60 * 24));
          
          customerMap.set(customerId, {
            customerId,
            email: customerEmail,
            name: customerName,
            recency, // Days since last order
            frequency: 1, // Number of orders
            monetary: orderValue, // Total spent
            totalOrders: 1,
            completedOrders: isCompleted ? 1 : 0,
            completedValue: isCompleted ? orderValue : 0,
            firstOrderDate: orderDate.toISOString(),
            lastOrderDate: orderDate.toISOString(),
            avgOrderValue: orderValue,
            orders: [{
              orderId: order.increment_id || order.entity_id,
              date: order.created_at,
              value: orderValue,
              status: orderStatus
            }]
          });
        }
      }
    }
    
    // Calculate RFM scores and segments
    const customers = Array.from(customerMap.values()).map(customer => {
      customer.avgOrderValue = customer.totalOrders > 0 ? customer.monetary / customer.totalOrders : 0;
      customer.customerLifetimeValue = customer.completedValue;
      customer.successRate = customer.totalOrders > 0 ? (customer.completedOrders / customer.totalOrders * 100).toFixed(1) : 0;
      customer.daysSinceFirstOrder = Math.ceil((today - new Date(customer.firstOrderDate)) / (1000 * 60 * 60 * 24));
      
      return customer;
    });
    
    // Calculate RFM quintiles
    const sortedByRecency = [...customers].sort((a, b) => a.recency - b.recency);
    const sortedByFrequency = [...customers].sort((a, b) => b.frequency - a.frequency);
    const sortedByMonetary = [...customers].sort((a, b) => b.monetary - a.monetary);
    
    const quintileSize = Math.ceil(customers.length / 5);
    
    customers.forEach(customer => {
      // Recency Score (1-5, where 1 = most recent)
      const recencyRank = sortedByRecency.findIndex(c => c.customerId === customer.customerId);
      customer.recencyScore = Math.min(5, Math.ceil((recencyRank + 1) / quintileSize));
      
      // Frequency Score (1-5, where 5 = most frequent)
      const frequencyRank = sortedByFrequency.findIndex(c => c.customerId === customer.customerId);
      customer.frequencyScore = Math.min(5, Math.ceil((frequencyRank + 1) / quintileSize));
      
      // Monetary Score (1-5, where 5 = highest value)
      const monetaryRank = sortedByMonetary.findIndex(c => c.customerId === customer.customerId);
      customer.monetaryScore = Math.min(5, Math.ceil((monetaryRank + 1) / quintileSize));
      
      // RFM Segment Classification
      customer.rfmSegment = classifyRFMSegment(customer.recencyScore, customer.frequencyScore, customer.monetaryScore);
    });
    
    // Group customers by segments
    const segments = {
      champions: customers.filter(c => c.rfmSegment === 'Champions'),
      loyalCustomers: customers.filter(c => c.rfmSegment === 'Loyal Customers'),
      potentialLoyalists: customers.filter(c => c.rfmSegment === 'Potential Loyalists'),
      newCustomers: customers.filter(c => c.rfmSegment === 'New Customers'),
      promisings: customers.filter(c => c.rfmSegment === 'Promising'),
      needsAttention: customers.filter(c => c.rfmSegment === 'Needs Attention'),
      aboutToSleep: customers.filter(c => c.rfmSegment === 'About to Sleep'),
      atRisk: customers.filter(c => c.rfmSegment === 'At Risk'),
      cannotLoseThem: customers.filter(c => c.rfmSegment === 'Cannot Lose Them'),
      hibernating: customers.filter(c => c.rfmSegment === 'Hibernating'),
      lost: customers.filter(c => c.rfmSegment === 'Lost')
    };
    
    // Calculate segment metrics
    const segmentAnalysis = Object.entries(segments).map(([segmentName, segmentCustomers]) => ({
      segment: segmentName.replace(/([A-Z])/g, ' $1').trim(),
      count: segmentCustomers.length,
      percentage: ((segmentCustomers.length / customers.length) * 100).toFixed(1),
      totalRevenue: segmentCustomers.reduce((sum, c) => sum + c.monetary, 0),
      avgRecency: segmentCustomers.length > 0 ? (segmentCustomers.reduce((sum, c) => sum + c.recency, 0) / segmentCustomers.length).toFixed(1) : 0,
      avgFrequency: segmentCustomers.length > 0 ? (segmentCustomers.reduce((sum, c) => sum + c.frequency, 0) / segmentCustomers.length).toFixed(1) : 0,
      avgMonetary: segmentCustomers.length > 0 ? (segmentCustomers.reduce((sum, c) => sum + c.monetary, 0) / segmentCustomers.length).toFixed(0) : 0,
      revenuePercentage: customers.length > 0 ? ((segmentCustomers.reduce((sum, c) => sum + c.monetary, 0) / customers.reduce((sum, c) => sum + c.monetary, 0)) * 100).toFixed(1) : 0
    }));
    
    // Overall customer analytics
    const analytics = {
      totalCustomers: customers.length,
      totalRevenue: customers.reduce((sum, c) => sum + c.monetary, 0),
      avgCustomerValue: customers.length > 0 ? (customers.reduce((sum, c) => sum + c.monetary, 0) / customers.length).toFixed(0) : 0,
      avgOrderFrequency: customers.length > 0 ? (customers.reduce((sum, c) => sum + c.frequency, 0) / customers.length).toFixed(1) : 0,
      avgRecency: customers.length > 0 ? (customers.reduce((sum, c) => sum + c.recency, 0) / customers.length).toFixed(1) : 0,
      repeatCustomerRate: customers.length > 0 ? ((customers.filter(c => c.frequency > 1).length / customers.length) * 100).toFixed(1) : 0,
      highValueCustomers: customers.filter(c => c.monetary > 50000).length,
      atRiskCustomers: segments.atRisk.length + segments.cannotLoseThem.length,
      newCustomersThisPeriod: segments.newCustomers.length,
      lostCustomers: segments.lost.length
    };
    
    const result = {
      success: true,
      segmentationType,
      dateRange: { startDate, endDate },
      customers: customers.sort((a, b) => b.monetary - a.monetary), // Sort by value
      segments: segmentAnalysis,
      analytics,
      recommendations: generateCustomerRecommendations(segmentAnalysis, analytics),
      timestamp: new Date().toISOString()
    };

    console.log('Customer RFM analysis completed:', {
      totalCustomers: customers.length,
      segments: segmentAnalysis.length,
      totalRevenue: analytics.totalRevenue
    });
    
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
        error: error.message,
        timestamp: new Date().toISOString()
      })
    };
  }
};

// RFM Segment Classification Function
function classifyRFMSegment(recency, frequency, monetary) {
  const rfmString = `${recency}${frequency}${monetary}`;
  
  // Champions: Best customers who bought recently, buy often and spend the most
  if (recency >= 4 && frequency >= 4 && monetary >= 4) return 'Champions';
  
  // Loyal Customers: Spend good money, buy often and recently
  if (recency >= 3 && frequency >= 4 && monetary >= 3) return 'Loyal Customers';
  
  // Potential Loyalists: Recent customers, spent good amount, bought more than once
  if (recency >= 3 && frequency >= 2 && monetary >= 3) return 'Potential Loyalists';
  
  // New Customers: Recent customers but haven't spent much
  if (recency >= 4 && frequency <= 2) return 'New Customers';
  
  // Promising: Recent shoppers, but haven't spent much
  if (recency >= 3 && frequency <= 2 && monetary <= 2) return 'Promising';
  
  // Needs Attention: Above average recency, frequency & monetary values
  if (recency >= 2 && frequency >= 3 && monetary >= 3) return 'Needs Attention';
  
  // About to Sleep: Below average recency, frequency & monetary values
  if (recency >= 2 && frequency >= 2 && monetary >= 2) return 'About to Sleep';
  
  // At Risk: Spent big money, purchased often but long time ago
  if (recency <= 2 && frequency >= 3 && monetary >= 3) return 'At Risk';
  
  // Cannot Lose Them: Made big purchases and often but haven't returned for a long time
  if (recency <= 1 && frequency >= 4 && monetary >= 4) return 'Cannot Lose Them';
  
  // Hibernating: Low spenders, low frequency, purchased long time ago
  if (recency <= 2 && frequency <= 2 && monetary <= 2) return 'Hibernating';
  
  // Lost: Lowest recency, frequency & monetary scores
  return 'Lost';
}

function generateCustomerRecommendations(segments, analytics) {
  const recommendations = [];
  
  segments.forEach(segment => {
    switch(segment.segment.toLowerCase().replace(/\s/g, '')) {
      case 'champions':
        recommendations.push({
          segment: segment.segment,
          action: 'Reward & Retain',
          description: 'Offer exclusive products, early access to new items, and VIP treatment',
          priority: 'High',
          expectedImpact: 'Revenue Protection'
        });
        break;
      case 'loyalcustomers':
        recommendations.push({
          segment: segment.segment,
          action: 'Upsell Premium Products',
          description: 'Recommend higher-value products and bundle offers',
          priority: 'High',
          expectedImpact: 'Revenue Growth'
        });
        break;
      case 'atrisk':
        recommendations.push({
          segment: segment.segment,
          action: 'Win-Back Campaign',
          description: 'Send personalized offers and reconnect through email/SMS',
          priority: 'Critical',
          expectedImpact: 'Customer Retention'
        });
        break;
      case 'hibernating':
        recommendations.push({
          segment: segment.segment,
          action: 'Re-engagement Campaign',
          description: 'Special discounts and product recommendations based on past purchases',
          priority: 'Medium',
          expectedImpact: 'Customer Reactivation'
        });
        break;
    }
  });
  
  return recommendations;
}
