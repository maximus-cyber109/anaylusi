exports.handler = async (event, context) => {
  console.log('Trend Analysis & Industry Benchmarking function started');
  
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
    const analysisType = event.queryStringParameters?.type || 'comprehensive';
    const period = event.queryStringParameters?.period || '90days';
    const compareWith = event.queryStringParameters?.compare || 'industry';
    
    console.log('Running trend analysis:', analysisType, 'for period:', period);
    
    // Calculate date ranges for trend analysis
    const endDate = new Date();
    let startDate = new Date();
    
    switch(period) {
      case '30days':
        startDate.setDate(endDate.getDate() - 30);
        break;
      case '90days':
        startDate.setDate(endDate.getDate() - 90);
        break;
      case '12months':
        startDate.setMonth(endDate.getMonth() - 12);
        break;
      default:
        startDate.setDate(endDate.getDate() - 90);
    }
    
    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];
    
    // Fetch historical data for trend analysis
    const ordersUrl = `${BASE_URL}/orders?searchCriteria[filterGroups][0][filters][0][field]=created_at&searchCriteria[filterGroups][0][filters][0][value]=${startDateStr}&searchCriteria[filterGroups][0][filters][0][conditionType]=from&searchCriteria[filterGroups][1][filters][0][field]=created_at&searchCriteria[filterGroups][1][filters][0][value]=${endDateStr} 23:59:59&searchCriteria[filterGroups][1][filters][0][conditionType]=to&searchCriteria[pageSize]=2000`;
    
    const ordersResponse = await fetch(ordersUrl, {
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    const ordersData = await ordersResponse.json();
    
    // Process data for trend analysis
    const dailyMetrics = new Map();
    const weeklyMetrics = new Map();
    const monthlyMetrics = new Map();
    const categoryTrends = new Map();
    const productTrends = new Map();
    
    if (ordersData.items && ordersData.items.length > 0) {
      for (const order of ordersData.items) {
        const orderDate = new Date(order.created_at);
        const dateKey = orderDate.toISOString().split('T')[0];
        const weekKey = getWeekKey(orderDate);
        const monthKey = `${orderDate.getFullYear()}-${(orderDate.getMonth() + 1).toString().padStart(2, '0')}`;
        
        const orderValue = parseFloat(order.grand_total) || 0;
        const orderStatus = order.status;
        const isCompleted = orderStatus === 'complete';
        const isCancelled = orderStatus === 'canceled' || orderStatus === 'cancelled';
        
        // Daily metrics
        if (dailyMetrics.has(dateKey)) {
          const daily = dailyMetrics.get(dateKey);
          daily.orders++;
          daily.revenue += orderValue;
          if (isCompleted) daily.completedOrders++;
          if (isCancelled) daily.cancelledOrders++;
        } else {
          dailyMetrics.set(dateKey, {
            date: dateKey,
            orders: 1,
            revenue: orderValue,
            completedOrders: isCompleted ? 1 : 0,
            cancelledOrders: isCancelled ? 1 : 0
          });
        }
        
        // Weekly metrics
        if (weeklyMetrics.has(weekKey)) {
          const weekly = weeklyMetrics.get(weekKey);
          weekly.orders++;
          weekly.revenue += orderValue;
          if (isCompleted) weekly.completedOrders++;
        } else {
          weeklyMetrics.set(weekKey, {
            week: weekKey,
            orders: 1,
            revenue: orderValue,
            completedOrders: isCompleted ? 1 : 0
          });
        }
        
        // Monthly metrics
        if (monthlyMetrics.has(monthKey)) {
          const monthly = monthlyMetrics.get(monthKey);
          monthly.orders++;
          monthly.revenue += orderValue;
          if (isCompleted) monthly.completedOrders++;
        } else {
          monthlyMetrics.set(monthKey, {
            month: monthKey,
            orders: 1,
            revenue: orderValue,
            completedOrders: isCompleted ? 1 : 0
          });
        }
        
        // Process order items for category and product trends
        if (order.items) {
          for (const item of order.items) {
            const productName = item.name;
            const sku = item.sku;
            const quantity = parseInt(item.qty_ordered) || 0;
            const itemRevenue = parseFloat(item.row_total) || 0;
            
            // Category classification
            let category = classifyProductCategory(productName);
            
            // Category trends
            const categoryKey = `${category}_${monthKey}`;
            if (categoryTrends.has(categoryKey)) {
              const catTrend = categoryTrends.get(categoryKey);
              catTrend.quantity += quantity;
              catTrend.revenue += itemRevenue;
              catTrend.orders++;
            } else {
              categoryTrends.set(categoryKey, {
                category,
                month: monthKey,
                quantity,
                revenue: itemRevenue,
                orders: 1
              });
            }
            
            // Product trends (top 50 products only for performance)
            if (productTrends.size < 50 || productTrends.has(sku)) {
              const productKey = `${sku}_${monthKey}`;
              if (productTrends.has(productKey)) {
                const prodTrend = productTrends.get(productKey);
                prodTrend.quantity += quantity;
                prodTrend.revenue += itemRevenue;
              } else {
                productTrends.set(productKey, {
                  sku,
                  name: productName,
                  month: monthKey,
                  quantity,
                  revenue: itemRevenue
                });
              }
            }
          }
        }
      }
    }
    
    // Convert maps to arrays and calculate trends
    const dailyData = Array.from(dailyMetrics.values()).sort((a, b) => new Date(a.date) - new Date(b.date));
    const weeklyData = Array.from(weeklyMetrics.values()).sort((a, b) => a.week.localeCompare(b.week));
    const monthlyData = Array.from(monthlyMetrics.values()).sort((a, b) => a.month.localeCompare(b.month));
    
    // Calculate trend percentages
    const trendAnalysis = {
      revenueGrowth: calculateGrowthRate(monthlyData.map(m => m.revenue)),
      orderGrowth: calculateGrowthRate(monthlyData.map(m => m.orders)),
      avgOrderValue: calculateAOVTrend(monthlyData),
      seasonality: detectSeasonality(monthlyData),
      volatility: calculateVolatility(dailyData.map(d => d.revenue))
    };
    
    // Industry benchmarking (simulated data)
    const industryBenchmarks = {
      avgMonthlyGrowth: 8.5, // Industry average
      avgOrderValue: 3500,
      avgCancellationRate: 6.2,
      avgCustomerRetention: 68,
      avgConversionRate: 3.4,
      avgInventoryTurnover: 4.2,
      seasonalityIndex: 0.15
    };
    
    // Compare with industry
    const currentMetrics = {
      monthlyGrowth: trendAnalysis.revenueGrowth,
      orderValue: monthlyData.length > 0 ? monthlyData[monthlyData.length - 1].revenue / monthlyData[monthlyData.length - 1].orders : 0,
      cancellationRate: calculateCancellationRate(dailyData),
      seasonalityIndex: Math.abs(trendAnalysis.seasonality)
    };
    
    const benchmarkComparison = {
      growthVsIndustry: ((currentMetrics.monthlyGrowth - industryBenchmarks.avgMonthlyGrowth) / industryBenchmarks.avgMonthlyGrowth * 100).toFixed(1),
      aovVsIndustry: ((currentMetrics.orderValue - industryBenchmarks.avgOrderValue) / industryBenchmarks.avgOrderValue * 100).toFixed(1),
      cancelRateVsIndustry: ((currentMetrics.cancellationRate - industryBenchmarks.avgCancellationRate) / industryBenchmarks.avgCancellationRate * 100).toFixed(1)
    };
    
    // Category performance analysis
    const categoryPerformance = analyzeCategoryTrends(categoryTrends);
    
    // Top trending products
    const productPerformance = analyzeProductTrends(productTrends);
    
    // Generate insights and recommendations
    const insights = generateTrendInsights(trendAnalysis, benchmarkComparison, categoryPerformance);
    
    const result = {
      success: true,
      analysisType,
      period,
      dateRange: { startDate: startDateStr, endDate: endDateStr },
      trendAnalysis,
      dailyData,
      weeklyData,
      monthlyData,
      industryBenchmarks,
      benchmarkComparison,
      categoryPerformance,
      productPerformance: productPerformance.slice(0, 20), // Top 20 trending products
      insights,
      recommendations: generateTrendRecommendations(insights, benchmarkComparison),
      timestamp: new Date().toISOString()
    };

    console.log('Trend analysis completed:', {
      dailyDataPoints: dailyData.length,
      categories: categoryPerformance.length,
      trendingProducts: productPerformance.length,
      revenueGrowth: trendAnalysis.revenueGrowth
    });
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(result)
    };
    
  } catch (error) {
    console.error('Trend Analysis Error:', error);
    
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

// Helper functions
function getWeekKey(date) {
  const year = date.getFullYear();
  const week = getWeekNumber(date);
  return `${year}-W${week.toString().padStart(2, '0')}`;
}

function getWeekNumber(date) {
  const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
  const pastDaysOfYear = (date - firstDayOfYear) / 86400000;
  return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
}

function classifyProductCategory(productName) {
  const name = productName.toLowerCase();
  if (name.includes('forceps') || name.includes('plier')) return 'Hand Instruments';
  if (name.includes('scaler') || name.includes('ultrasonic')) return 'Scaling Equipment';
  if (name.includes('x-ray') || name.includes('imaging')) return 'Imaging Equipment';
  if (name.includes('autoclave') || name.includes('steriliz')) return 'Sterilization';
  if (name.includes('chair') || name.includes('unit')) return 'Furniture & Equipment';
  if (name.includes('composite') || name.includes('filling')) return 'Restorative Materials';
  if (name.includes('surgical') || name.includes('surgery')) return 'Surgical Instruments';
  if (name.includes('impression') || name.includes('mold')) return 'Impression Materials';
  if (name.includes('cleaning') || name.includes('polish')) return 'Cleaning & Maintenance';
  if (name.includes('orthodontic') || name.includes('braces')) return 'Orthodontics';
  return 'General Supplies';
}

function calculateGrowthRate(values) {
  if (values.length < 2) return 0;
  const firstValue = values[0];
  const lastValue = values[values.length - 1];
  if (firstValue === 0) return lastValue > 0 ? 100 : 0;
  return ((lastValue - firstValue) / firstValue * 100).toFixed(1);
}

function calculateAOVTrend(monthlyData) {
  return monthlyData.map(month => ({
    month: month.month,
    aov: month.orders > 0 ? Math.round(month.revenue / month.orders) : 0
  }));
}

function detectSeasonality(monthlyData) {
  if (monthlyData.length < 4) return 0;
  const revenues = monthlyData.map(m => m.revenue);
  const mean = revenues.reduce((sum, rev) => sum + rev, 0) / revenues.length;
  const variance = revenues.reduce((sum, rev) => sum + Math.pow(rev - mean, 2), 0) / revenues.length;
  const stdDev = Math.sqrt(variance);
  return (stdDev / mean).toFixed(3);
}

function calculateVolatility(values) {
  if (values.length < 2) return 0;
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  return Math.sqrt(variance).toFixed(0);
}

function calculateCancellationRate(dailyData) {
  const totalOrders = dailyData.reduce((sum, day) => sum + day.orders, 0);
  const totalCancellations = dailyData.reduce((sum, day) => sum + day.cancelledOrders, 0);
  return totalOrders > 0 ? ((totalCancellations / totalOrders) * 100).toFixed(1) : 0;
}

function analyzeCategoryTrends(categoryTrends) {
  const categoryMap = new Map();
  
  categoryTrends.forEach((trend) => {
    if (categoryMap.has(trend.category)) {
      const cat = categoryMap.get(trend.category);
      cat.totalRevenue += trend.revenue;
      cat.totalQuantity += trend.quantity;
      cat.totalOrders += trend.orders;
      cat.monthlyData.push({
        month: trend.month,
        revenue: trend.revenue,
        quantity: trend.quantity,
        orders: trend.orders
      });
    } else {
      categoryMap.set(trend.category, {
        category: trend.category,
        totalRevenue: trend.revenue,
        totalQuantity: trend.quantity,
        totalOrders: trend.orders,
        monthlyData: [{
          month: trend.month,
          revenue: trend.revenue,
          quantity: trend.quantity,
          orders: trend.orders
        }]
      });
    }
  });
  
  return Array.from(categoryMap.values())
    .map(cat => {
      const growthRate = calculateGrowthRate(cat.monthlyData.map(m => m.revenue));
      return {
        ...cat,
        growthRate: parseFloat(growthRate),
        avgMonthlyRevenue: Math.round(cat.totalRevenue / cat.monthlyData.length)
      };
    })
    .sort((a, b) => b.totalRevenue - a.totalRevenue);
}

function analyzeProductTrends(productTrends) {
  const productMap = new Map();
  
  productTrends.forEach((trend) => {
    const key = trend.sku;
    if (productMap.has(key)) {
      const prod = productMap.get(key);
      prod.totalRevenue += trend.revenue;
      prod.totalQuantity += trend.quantity;
      prod.monthlyData.push({
        month: trend.month,
        revenue: trend.revenue,
        quantity: trend.quantity
      });
    } else {
      productMap.set(key, {
        sku: trend.sku,
        name: trend.name,
        totalRevenue: trend.revenue,
        totalQuantity: trend.quantity,
        monthlyData: [{
          month: trend.month,
          revenue: trend.revenue,
          quantity: trend.quantity
        }]
      });
    }
  });
  
  return Array.from(productMap.values())
    .map(prod => {
      const growthRate = calculateGrowthRate(prod.monthlyData.map(m => m.revenue));
      return {
        ...prod,
        growthRate: parseFloat(growthRate),
        trend: parseFloat(growthRate) > 15 ? 'Hot' : parseFloat(growthRate) > 5 ? 'Growing' : parseFloat(growthRate) < -10 ? 'Declining' : 'Stable'
      };
    })
    .sort((a, b) => b.growthRate - a.growthRate);
}

function generateTrendInsights(trendAnalysis, benchmarkComparison, categoryPerformance) {
  const insights = [];
  
  // Revenue trend insight
  if (parseFloat(trendAnalysis.revenueGrowth) > 10) {
    insights.push({
      type: 'Strong Growth',
      message: `Excellent revenue growth of ${trendAnalysis.revenueGrowth}% indicates strong business momentum`,
      impact: 'Positive',
      confidence: 'High'
    });
  } else if (parseFloat(trendAnalysis.revenueGrowth) < 0) {
    insights.push({
      type: 'Revenue Decline',
      message: `Revenue declined by ${Math.abs(trendAnalysis.revenueGrowth)}% - immediate attention needed`,
      impact: 'Negative',
      confidence: 'High'
    });
  }
  
  // Industry comparison insight
  if (parseFloat(benchmarkComparison.growthVsIndustry) > 20) {
    insights.push({
      type: 'Industry Leadership',
      message: `Your growth rate is ${benchmarkComparison.growthVsIndustry}% above industry average`,
      impact: 'Positive',
      confidence: 'High'
    });
  }
  
  // Category insight
  const topCategory = categoryPerformance[0];
  if (topCategory) {
    insights.push({
      type: 'Category Leadership',
      message: `${topCategory.category} is your strongest category with ${topCategory.growthRate}% growth`,
      impact: 'Positive',
      confidence: 'Medium'
    });
  }
  
  return insights;
}

function generateTrendRecommendations(insights, benchmarkComparison) {
  const recommendations = [];
  
  insights.forEach(insight => {
    switch(insight.type) {
      case 'Strong Growth':
        recommendations.push({
          category: 'Growth Strategy',
          action: 'Scale Successful Initiatives',
          description: 'Identify and replicate the strategies driving current growth',
          priority: 'High'
        });
        break;
      case 'Revenue Decline':
        recommendations.push({
          category: 'Recovery Plan',
          action: 'Implement Turnaround Strategy',
          description: 'Focus on customer retention, new customer acquisition, and product optimization',
          priority: 'Critical'
        });
        break;
      case 'Industry Leadership':
        recommendations.push({
          category: 'Competitive Advantage',
          action: 'Maintain Market Position',
          description: 'Continue current strategies while exploring new growth opportunities',
          priority: 'High'
        });
        break;
    }
  });
  
  return recommendations;
}
