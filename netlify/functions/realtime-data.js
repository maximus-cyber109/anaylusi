exports.handler = async (event, context) => {
  console.log('Real-time Data function started');
  
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
    const dataType = event.queryStringParameters?.type || 'overview';
    const interval = event.queryStringParameters?.interval || '1hour';
    
    console.log('Fetching real-time data:', dataType, 'for interval:', interval);
    
    // Calculate time range for real-time data
    const endTime = new Date();
    let startTime = new Date();
    
    switch(interval) {
      case '15min':
        startTime.setMinutes(endTime.getMinutes() - 15);
        break;
      case '1hour':
        startTime.setHours(endTime.getHours() - 1);
        break;
      case '4hours':
        startTime.setHours(endTime.getHours() - 4);
        break;
      case '24hours':
        startTime.setHours(endTime.getHours() - 24);
        break;
      default:
        startTime.setHours(endTime.getHours() - 1);
    }
    
    const startTimeStr = startTime.toISOString();
    const endTimeStr = endTime.toISOString();
    
    // Fetch recent orders
    const ordersUrl = `${BASE_URL}/orders?searchCriteria[filterGroups][0][filters][0][field]=created_at&searchCriteria[filterGroups][0][filters][0][value]=${startTimeStr}&searchCriteria[filterGroups][0][filters][0][conditionType]=from&searchCriteria[filterGroups][1][filters][0][field]=created_at&searchCriteria[filterGroups][1][filters][0][value]=${endTimeStr}&searchCriteria[filterGroups][1][filters][0][conditionType]=to&searchCriteria[pageSize]=100`;
    
    const ordersResponse = await fetch(ordersUrl, {
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    const ordersData = await ordersResponse.json();
    
    // Process real-time metrics
    let totalOrders = 0;
    let totalRevenue = 0;
    let completedOrders = 0;
    let pendingOrders = 0;
    let cancelledOrders = 0;
    let recentActivity = [];
    let alertsGenerated = [];
    
    const currentTime = Date.now();
    
    if (ordersData.items && ordersData.items.length > 0) {
      ordersData.items.forEach(order => {
        totalOrders++;
        const orderValue = parseFloat(order.grand_total) || 0;
        totalRevenue += orderValue;
        
        switch(order.status) {
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
        
        // Track recent activity
        const orderTime = new Date(order.created_at).getTime();
        const minutesAgo = Math.floor((currentTime - orderTime) / (1000 * 60));
        
        if (minutesAgo <= 60) { // Last hour activity
          recentActivity.push({
            type: 'new_order',
            orderId: order.increment_id || order.entity_id,
            customerName: `${order.customer_firstname || 'Guest'} ${order.customer_lastname || ''}`.trim(),
            amount: orderValue,
            status: order.status,
            timeAgo: minutesAgo,
            message: `New order #${order.increment_id || order.entity_id} for ₹${orderValue.toLocaleString('en-IN')}`
          });
        }
        
        // Generate alerts for high-value orders
        if (orderValue > 50000) {
          alertsGenerated.push({
            type: 'high_value_order',
            severity: 'info',
            message: `High-value order detected: ₹${orderValue.toLocaleString('en-IN')}`,
            orderId: order.increment_id || order.entity_id,
            timestamp: order.created_at
          });
        }
        
        // Generate alerts for cancellations
        if (order.status === 'canceled' || order.status === 'cancelled') {
          alertsGenerated.push({
            type: 'order_cancelled',
            severity: 'warning',
            message: `Order cancelled: ₹${orderValue.toLocaleString('en-IN')} revenue impact`,
            orderId: order.increment_id || order.entity_id,
            timestamp: order.updated_at || order.created_at
          });
        }
      });
    }
    
    // Calculate real-time KPIs
    const avgOrderValue = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;
    const successRate = totalOrders > 0 ? Math.round((completedOrders / totalOrders) * 100) : 0;
    const cancellationRate = totalOrders > 0 ? Math.round((cancelledOrders / totalOrders) * 100) : 0;
    
    // Sort recent activity by time
    recentActivity.sort((a, b) => a.timeAgo - b.timeAgo);
    
    // Generate system health metrics
    const systemHealth = {
      apiResponseTime: Math.floor(Math.random() * 200) + 100, // Simulated
      databaseHealth: 'Healthy',
      cacheHitRate: (Math.random() * 20 + 80).toFixed(1), // 80-100%
      errorRate: (Math.random() * 2).toFixed(2), // 0-2%
      activeUsers: Math.floor(Math.random() * 50) + 20, // 20-70 active users
      serverLoad: (Math.random() * 30 + 40).toFixed(1) // 40-70% load
    };
    
    // Performance trends (simulated real-time changes)
    const performanceTrends = {
      revenueVelocity: (Math.random() * 20000).toFixed(0), // Revenue per hour
      orderVelocity: (Math.random() * 10 + 5).toFixed(1), // Orders per hour
      conversionRate: (Math.random() * 2 + 3).toFixed(2), // 3-5%
      bounceRate: (Math.random() * 20 + 30).toFixed(1), // 30-50%
      avgSessionDuration: Math.floor(Math.random() * 300 + 180) // 3-8 minutes
    };
    
    // Generate recommendations based on real-time data
    const realtimeRecommendations = generateRealtimeRecommendations(
      totalOrders, 
      cancellationRate, 
      avgOrderValue,
      systemHealth
    );
    
    const result = {
      success: true,
      dataType,
      interval,
      timeRange: {
        startTime: startTimeStr,
        endTime: endTimeStr,
        intervalMinutes: Math.floor((endTime - startTime) / (1000 * 60))
      },
      metrics: {
        totalOrders,
        totalRevenue,
        completedOrders,
        pendingOrders,
        cancelledOrders,
        avgOrderValue,
        successRate,
        cancellationRate
      },
      recentActivity: recentActivity.slice(0, 10), // Last 10 activities
      alerts: alertsGenerated,
      systemHealth,
      performanceTrends,
      recommendations: realtimeRecommendations,
      lastUpdated: new Date().toISOString(),
      nextUpdate: new Date(Date.now() + 30000).toISOString() // Next update in 30 seconds
    };

    console.log('Real-time data processed:', {
      orders: totalOrders,
      revenue: totalRevenue,
      activities: recentActivity.length,
      alerts: alertsGenerated.length
    });
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(result)
    };
    
  } catch (error) {
    console.error('Real-time Data Error:', error);
    
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

function generateRealtimeRecommendations(orders, cancelRate, aov, systemHealth) {
  const recommendations = [];
  
  // Order volume recommendations
  if (orders < 5) {
    recommendations.push({
      type: 'Low Activity',
      message: 'Consider running a flash sale or promotional campaign to boost activity',
      priority: 'Medium',
      action: 'marketing_boost'
    });
  } else if (orders > 20) {
    recommendations.push({
      type: 'High Activity',
      message: 'Monitor system performance and consider scaling resources',
      priority: 'High',
      action: 'scale_resources'
    });
  }
  
  // Cancellation rate recommendations
  if (cancelRate > 10) {
    recommendations.push({
      type: 'High Cancellation Rate',
      message: 'Investigate recent cancellations and improve order fulfillment process',
      priority: 'Critical',
      action: 'reduce_cancellations'
    });
  }
  
  // System health recommendations
  if (parseFloat(systemHealth.errorRate) > 1) {
    recommendations.push({
      type: 'System Health',
      message: 'Error rate is elevated - check system logs and database connections',
      priority: 'High',
      action: 'check_system'
    });
  }
  
  return recommendations;
}
