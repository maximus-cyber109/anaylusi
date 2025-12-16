// netlify/functions/analytics-engine.js
const https = require('https');

const MAGENTO_TOKEN = process.env.MAGENTO_API_TOKEN;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const BASE_URL = process.env.MAGENTO_BASE_URL || 'https://pinkblue.in/rest/V1';

const FIREWALL_HEADERS = {
  'Authorization': `Bearer ${MAGENTO_TOKEN}`,
  'Content-Type': 'application/json',
  'User-Agent': 'PB_Netlify',
  'X-Source-App': 'GameOfCrowns',
  'X-Netlify-Secret': 'X-PB-NetlifY2025-901AD7EE35110CCB445F3CA0EBEB1494'
};

function log(level, message, data = null) {
  const timestamp = new Date().toISOString();
  const logMsg = `[${timestamp}] [${level}] ${message}`;
  console.log(logMsg, data ? JSON.stringify(data).substring(0, 200) : '');
}

function makeRequest(endpoint) {
  return new Promise((resolve) => {
    const url = `${BASE_URL}${endpoint}`;
    log('INFO', `Making request to: ${endpoint}`);
    
    const req = https.request(url, { method: 'GET', headers: FIREWALL_HEADERS }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        log('INFO', `Response received: ${res.statusCode} - ${endpoint}`);
        try {
          const parsed = JSON.parse(data);
          resolve(parsed);
        } catch (e) {
          log('ERROR', 'JSON Parse Error', { error: e.message, endpoint });
          resolve({ items: [], total_count: 0 });
        }
      });
    });
    
    req.on('error', (e) => {
      log('ERROR', 'Request Error', { error: e.message, endpoint });
      resolve({ items: [], total_count: 0 });
    });
    
    req.setTimeout(25000, () => {
      log('ERROR', 'Request Timeout', { endpoint });
      req.abort();
    });
    
    req.end();
  });
}

function makeGeminiRequest(prompt, data) {
  return new Promise((resolve) => {
    log('INFO', 'Calling Gemini Flash API');
    
    const payload = JSON.stringify({
      contents: [{
        parts: [{ text: `${prompt}\n\nData: ${JSON.stringify(data)}` }]
      }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 500
      }
    });

    const options = {
      hostname: 'generativelanguage.googleapis.com',
      path: `/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    const req = https.request(options, (res) => {
      let responseData = '';
      res.on('data', chunk => responseData += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(responseData);
          const text = result.candidates?.[0]?.content?.parts?.[0]?.text || 'AI analysis unavailable';
          log('INFO', 'Gemini response received', { length: text.length });
          resolve(text);
        } catch (e) {
          log('ERROR', 'Gemini Parse Error', { error: e.message });
          resolve('AI analysis temporarily unavailable');
        }
      });
    });
    
    req.on('error', (e) => {
      log('ERROR', 'Gemini Request Error', { error: e.message });
      resolve('AI analysis failed');
    });
    
    req.write(payload);
    req.end();
  });
}

function calculateStatistics(values) {
  if (!values.length) return { mean: 0, stdDev: 0, variance: 0 };
  
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);
  
  return { mean, stdDev, variance };
}

function linearRegression(data) {
  const n = data.length;
  if (n < 2) return { slope: 0, intercept: 0, r2: 0 };
  
  const sumX = data.reduce((sum, _, i) => sum + i, 0);
  const sumY = data.reduce((sum, val) => sum + val, 0);
  const sumXY = data.reduce((sum, val, i) => sum + (i * val), 0);
  const sumX2 = data.reduce((sum, _, i) => sum + (i * i), 0);
  
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;
  
  const yMean = sumY / n;
  const ssTotal = data.reduce((sum, val) => sum + Math.pow(val - yMean, 2), 0);
  const ssResidual = data.reduce((sum, val, i) => {
    const predicted = slope * i + intercept;
    return sum + Math.pow(val - predicted, 2);
  }, 0);
  const r2 = 1 - (ssResidual / ssTotal);
  
  return { slope, intercept, r2: Math.max(0, r2) };
}

async function getDashboard(startDate, endDate) {
  log('INFO', 'Getting Dashboard Data', { startDate, endDate });
  
  const orderQuery = `/orders?searchCriteria[filterGroups][0][filters][0][field]=created_at&searchCriteria[filterGroups][0][filters][0][value]=${startDate}&searchCriteria[filterGroups][0][filters][0][conditionType]=from&searchCriteria[filterGroups][1][filters][0][field]=created_at&searchCriteria[filterGroups][1][filters][0][value]=${endDate} 23:59:59&searchCriteria[filterGroups][1][filters][0][conditionType]=to&searchCriteria[pageSize]=2000`;
  
  const data = await makeRequest(orderQuery);
  const orders = data.items || [];
  
  log('INFO', `Fetched ${orders.length} orders for dashboard`);
  
  let revenue = 0, cod = 0, online = 0, cancelled = 0, pending = 0, complete = 0, processing = 0;
  const dailyRevenue = {};
  
  orders.forEach(o => {
    const amount = parseFloat(o.grand_total) || 0;
    revenue += amount;
    
    const day = o.created_at.split('T')[0];
    dailyRevenue[day] = (dailyRevenue[day] || 0) + amount;
    
    if (o.payment?.method?.includes('cod') || o.payment?.method?.includes('cashondelivery')) cod++;
    else online++;
    
    if (o.status === 'canceled' || o.status === 'cancelled') cancelled++;
    if (o.status === 'pending') pending++;
    if (o.status === 'complete') complete++;
    if (o.status === 'processing') processing++;
  });
  
  const avgOrderValue = orders.length > 0 ? revenue / orders.length : 0;
  const cancellationRate = orders.length > 0 ? (cancelled / orders.length) * 100 : 0;
  
  const revenueValues = Object.values(dailyRevenue);
  const stats = calculateStatistics(revenueValues);
  
  return {
    revenue: Math.round(revenue),
    orders: orders.length,
    cod_orders: cod,
    online_orders: online,
    pending_orders: pending,
    complete_orders: complete,
    processing_orders: processing,
    cancelled_orders: cancelled,
    cancellation_rate: cancellationRate.toFixed(1),
    avg_order_value: Math.round(avgOrderValue),
    daily_stats: {
      mean_daily_revenue: Math.round(stats.mean),
      std_deviation: Math.round(stats.stdDev),
      variance: Math.round(stats.variance)
    }
  };
}

async function getCustomerRFM(startDate, endDate) {
  log('INFO', 'Getting Customer RFM Data', { startDate, endDate });
  
  const orderQuery = `/orders?searchCriteria[filterGroups][0][filters][0][field]=created_at&searchCriteria[filterGroups][0][filters][0][value]=${startDate}&searchCriteria[filterGroups][0][filters][0][conditionType]=from&searchCriteria[pageSize]=2000`;
  
  const data = await makeRequest(orderQuery);
  const orders = data.items || [];
  
  log('INFO', `Processing ${orders.length} orders for RFM`);
  
  const customers = {};
  const now = new Date();
  
  orders.forEach(o => {
    const email = o.customer_email || `guest_${o.entity_id}`;
    if (!customers[email]) {
      customers[email] = { 
        email, 
        spent: 0, 
        orders: 0, 
        lastOrder: o.created_at,
        firstOrder: o.created_at,
        cancelledOrders: 0
      };
    }
    customers[email].spent += parseFloat(o.grand_total) || 0;
    customers[email].orders++;
    if (o.created_at > customers[email].lastOrder) customers[email].lastOrder = o.created_at;
    if (o.created_at < customers[email].firstOrder) customers[email].firstOrder = o.created_at;
    if (o.status === 'canceled' || o.status === 'cancelled') customers[email].cancelledOrders++;
  });

  const segments = { champions: [], loyal: [], promising: [], new: [], at_risk: [], lost: [] };
  const topBuyers = [];
  
  Object.values(customers).forEach(c => {
    const daysSinceLast = Math.floor((now - new Date(c.lastOrder)) / (1000 * 60 * 60 * 24));
    const lifetimeDays = Math.floor((new Date(c.lastOrder) - new Date(c.firstOrder)) / (1000 * 60 * 60 * 24)) + 1;
    
    c.recency = daysSinceLast;
    c.frequency = c.orders;
    c.monetary = Math.round(c.spent);
    c.lifetime_days = lifetimeDays;
    c.avg_order_value = Math.round(c.spent / c.orders);
    c.cancellation_rate = ((c.cancelledOrders / c.orders) * 100).toFixed(1);
    
    // RFM Scoring (1-5 scale)
    c.r_score = daysSinceLast < 30 ? 5 : daysSinceLast < 60 ? 4 : daysSinceLast < 90 ? 3 : daysSinceLast < 180 ? 2 : 1;
    c.f_score = c.orders >= 10 ? 5 : c.orders >= 5 ? 4 : c.orders >= 3 ? 3 : c.orders === 2 ? 2 : 1;
    c.m_score = c.spent >= 100000 ? 5 : c.spent >= 50000 ? 4 : c.spent >= 20000 ? 3 : c.spent >= 5000 ? 2 : 1;
    
    const rfmScore = c.r_score + c.f_score + c.m_score;
    
    if (rfmScore >= 13) {
      c.segment = 'Champions';
      segments.champions.push(c);
    } else if (rfmScore >= 10 && c.f_score >= 3) {
      c.segment = 'Loyal';
      segments.loyal.push(c);
    } else if (rfmScore >= 8 && c.r_score >= 3) {
      c.segment = 'Promising';
      segments.promising.push(c);
    } else if (c.orders === 1 && daysSinceLast < 60) {
      c.segment = 'New';
      segments.new.push(c);
    } else if (daysSinceLast > 90 && daysSinceLast < 180) {
      c.segment = 'At Risk';
      segments.at_risk.push(c);
    } else {
      c.segment = 'Lost';
      segments.lost.push(c);
    }
    
    topBuyers.push(c);
  });
  
  topBuyers.sort((a, b) => b.spent - a.spent);
  
  return {
    total: Object.keys(customers).length,
    segments: {
      champions: segments.champions.length,
      loyal: segments.loyal.length,
      promising: segments.promising.length,
      new: segments.new.length,
      at_risk: segments.at_risk.length,
      lost: segments.lost.length
    },
    top_buyers: topBuyers.slice(0, 50),
    all_customers: Object.values(customers)
  };
}

async function getProductAnalytics(startDate, endDate) {
  log('INFO', 'Getting Product Analytics', { startDate, endDate });
  
  const orderQuery = `/orders?searchCriteria[filterGroups][0][filters][0][field]=created_at&searchCriteria[filterGroups][0][filters][0][value]=${startDate}&searchCriteria[filterGroups][0][filters][0][conditionType]=from&searchCriteria[filterGroups][1][filters][0][field]=created_at&searchCriteria[filterGroups][1][filters][0][value]=${endDate} 23:59:59&searchCriteria[filterGroups][1][filters][0][conditionType]=to&searchCriteria[pageSize]=2000`;
  
  const data = await makeRequest(orderQuery);
  const orders = data.items || [];
  
  log('INFO', `Processing ${orders.length} orders for products`);
  
  const products = {};
  const cancelledProducts = {};
  
  orders.forEach(o => {
    const isCancelled = o.status === 'canceled' || o.status === 'cancelled';
    
    (o.items || []).forEach(i => {
      const sku = i.sku;
      if (!products[sku]) {
        products[sku] = { 
          sku, 
          name: i.name, 
          qty: 0, 
          revenue: 0, 
          orders: 0,
          cancelled_qty: 0,
          cancelled_revenue: 0,
          cancelled_orders: 0
        };
      }
      
      products[sku].qty += i.qty_ordered || 0;
      products[sku].revenue += i.row_total || 0;
      products[sku].orders++;
      
      if (isCancelled) {
        products[sku].cancelled_qty += i.qty_ordered || 0;
        products[sku].cancelled_revenue += i.row_total || 0;
        products[sku].cancelled_orders++;
      }
    });
  });
  
  Object.values(products).forEach(p => {
    p.cancellation_rate = p.qty > 0 ? ((p.cancelled_qty / p.qty) * 100).toFixed(1) : 0;
    p.avg_price = p.qty > 0 ? (p.revenue / p.qty).toFixed(0) : 0;
    p.revenue = Math.round(p.revenue);
  });
  
  const topSellers = Object.values(products).sort((a, b) => b.revenue - a.revenue);
  const highRisk = Object.values(products).filter(p => parseFloat(p.cancellation_rate) > 15);
  
  return {
    total_unique: Object.keys(products).length,
    top_sellers: topSellers.slice(0, 100),
    high_cancellation_risk: highRisk.sort((a, b) => b.cancellation_rate - a.cancellation_rate).slice(0, 50),
    all_products: Object.values(products)
  };
}

async function getCancellationReport(startDate, endDate) {
  log('INFO', 'Getting Cancellation Report', { startDate, endDate });
  
  const orderQuery = `/orders?searchCriteria[filterGroups][0][filters][0][field]=created_at&searchCriteria[filterGroups][0][filters][0][value]=${startDate}&searchCriteria[filterGroups][0][filters][0][conditionType]=from&searchCriteria[filterGroups][1][filters][0][field]=created_at&searchCriteria[filterGroups][1][filters][0][value]=${endDate} 23:59:59&searchCriteria[filterGroups][1][filters][0][conditionType]=to&searchCriteria[pageSize]=2000`;
  
  const data = await makeRequest(orderQuery);
  const orders = data.items || [];
  
  const cancelledOrders = orders.filter(o => o.status === 'canceled' || o.status === 'cancelled');
  
  log('INFO', `Found ${cancelledOrders.length} cancelled orders out of ${orders.length}`);
  
  let totalLostRevenue = 0;
  const reasonMap = {};
  const dailyCancellations = {};
  
  cancelledOrders.forEach(o => {
    totalLostRevenue += parseFloat(o.grand_total) || 0;
    
    const day = o.created_at.split('T')[0];
    dailyCancellations[day] = (dailyCancellations[day] || 0) + 1;
    
    const reason = o.status_histories?.[0]?.comment || 'No reason provided';
    reasonMap[reason] = (reasonMap[reason] || 0) + 1;
  });
  
  const cancellationRate = orders.length > 0 ? (cancelledOrders.length / orders.length) * 100 : 0;
  
  return {
    total_cancelled: cancelledOrders.length,
    total_orders: orders.length,
    cancellation_rate: cancellationRate.toFixed(2),
    lost_revenue: Math.round(totalLostRevenue),
    daily_trend: dailyCancellations,
    top_reasons: Object.entries(reasonMap).map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count),
    cancelled_orders: cancelledOrders.map(o => ({
      order_id: o.entity_id,
      date: o.created_at,
      customer_email: o.customer_email,
      amount: Math.round(parseFloat(o.grand_total)),
      payment_method: o.payment?.method || 'N/A'
    }))
  };
}

async function getAIForecast(startDate, endDate) {
  log('INFO', 'Getting AI Forecast', { startDate, endDate });
  
  const orderQuery = `/orders?searchCriteria[filterGroups][0][filters][0][field]=created_at&searchCriteria[filterGroups][0][filters][0][value]=${startDate}&searchCriteria[filterGroups][0][filters][0][conditionType]=from&searchCriteria[pageSize]=2000`;
  
  const data = await makeRequest(orderQuery);
  const orders = data.items || [];
  
  const dailyData = {};
  orders.forEach(o => {
    if (o.status === 'complete' || o.status === 'processing') {
      const day = o.created_at.split('T')[0];
      if (!dailyData[day]) dailyData[day] = { revenue: 0, orders: 0 };
      dailyData[day].revenue += parseFloat(o.grand_total) || 0;
      dailyData[day].orders++;
    }
  });
  
  const sortedDays = Object.keys(dailyData).sort();
  const revenueArray = sortedDays.map(day => dailyData[day].revenue);
  
  const regression = linearRegression(revenueArray);
  const stats = calculateStatistics(revenueArray);
  
  const nextDayIndex = revenueArray.length;
  const predictedRevenue = regression.slope * nextDayIndex + regression.intercept;
  const confidenceInterval = 1.96 * stats.stdDev;
  
  const chartData = sortedDays.map((day, i) => ({
    date: day,
    revenue: Math.round(dailyData[day].revenue),
    orders: dailyData[day].orders
  }));
  
  const prompt = `You are a data scientist analyzing e-commerce trends for PinkBlue, a dental supply company.

Based on ${sortedDays.length} days of data:
- Average daily revenue: ₹${Math.round(stats.mean)}
- Trend: ${regression.slope > 0 ? 'Growing' : 'Declining'} (R²: ${regression.r2.toFixed(3)})
- Volatility: σ = ₹${Math.round(stats.stdDev)}
- Tomorrow's prediction: ₹${Math.round(predictedRevenue)}

Provide:
1. 7-day revenue forecast (specific numbers)
2. Key insights from the trend
3. Strategic recommendation to increase AOV and reduce cancellations

Keep response under 200 words, use bullet points.`;

  const aiInsight = await makeGeminiRequest(prompt, chartData.slice(-14));
  
  return {
    model: 'Gemini 1.5 Flash (Linear Regression)',
    confidence: `${(regression.r2 * 100).toFixed(1)}%`,
    next_day_prediction: Math.round(predictedRevenue),
    confidence_interval: {
      lower: Math.round(predictedRevenue - confidenceInterval),
      upper: Math.round(predictedRevenue + confidenceInterval)
    },
    statistics: {
      mean: Math.round(stats.mean),
      std_dev: Math.round(stats.stdDev),
      variance: Math.round(stats.variance),
      slope: regression.slope.toFixed(2),
      r_squared: regression.r2.toFixed(3)
    },
    daily_data: chartData,
    ai_insight: aiInsight
  };
}

function exportCSV(type, data, startDate, endDate) {
  log('INFO', `Exporting ${type}`, { startDate, endDate });
  
  let csv = '';
  let filename = `${type}_${startDate}_to_${endDate}.csv`;
  
  if (type === 'customers') {
    csv = 'Email,Total Spent,Total Orders,Last Order,Recency (Days),Frequency,Monetary,Segment,AOV,Cancellation Rate,R Score,F Score,M Score\n';
    (data.all_customers || []).forEach(c => {
      csv += `${c.email},${c.monetary},${c.orders},${c.lastOrder},${c.recency},${c.frequency},${c.monetary},${c.segment},${c.avg_order_value},${c.cancellation_rate}%,${c.r_score},${c.f_score},${c.m_score}\n`;
    });
  } else if (type === 'products') {
    csv = 'SKU,Product Name,Qty Sold,Revenue,Orders,Avg Price,Cancelled Qty,Cancelled Revenue,Cancellation Rate\n';
    (data.all_products || []).forEach(p => {
      csv += `${p.sku},"${p.name.replace(/"/g, '""')}",${p.qty},${p.revenue},${p.orders},${p.avg_price},${p.cancelled_qty},${Math.round(p.cancelled_revenue)},${p.cancellation_rate}%\n`;
    });
  } else if (type === 'cancellations') {
    csv = 'Order ID,Date,Customer Email,Amount,Payment Method\n';
    (data.cancelled_orders || []).forEach(o => {
      csv += `${o.order_id},${o.date},${o.customer_email},${o.amount},${o.payment_method}\n`;
    });
  }
  
  return { csv, filename };
}

exports.handler = async (event) => {
  const startTime = Date.now();
  log('INFO', '=== NEW REQUEST ===', { 
    queryParams: event.queryStringParameters,
    headers: event.headers 
  });
  
  if (!MAGENTO_TOKEN) {
    log('ERROR', 'MAGENTO_API_TOKEN not configured');
    return {
      statusCode: 500,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type'
      },
      body: JSON.stringify({ error: 'MAGENTO_API_TOKEN not configured in Netlify' })
    };
  }
  
  const type = event.queryStringParameters?.type || 'dashboard';
  const startDate = event.queryStringParameters?.start_date || (() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  })();
  const endDate = event.queryStringParameters?.end_date || new Date().toISOString().split('T')[0];
  const exportType = event.queryStringParameters?.export;
  
  try {
    let response = {};
    
    if (exportType) {
      let data;
      if (exportType === 'customers') data = await getCustomerRFM(startDate, endDate);
      else if (exportType === 'products') data = await getProductAnalytics(startDate, endDate);
      else if (exportType === 'cancellations') data = await getCancellationReport(startDate, endDate);
      
      const exported = exportCSV(exportType, data, startDate, endDate);
      
      log('INFO', `Export completed: ${exported.filename}`);
      
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${exported.filename}"`,
          'Access-Control-Allow-Origin': '*'
        },
        body: exported.csv
      };
    }
    
    if (type === 'dashboard') response = await getDashboard(startDate, endDate);
    else if (type === 'customers') response = await getCustomerRFM(startDate, endDate);
    else if (type === 'products') response = await getProductAnalytics(startDate, endDate);
    else if (type === 'cancellations') response = await getCancellationReport(startDate, endDate);
    else if (type === 'forecast') response = await getAIForecast(startDate, endDate);
    
    const duration = Date.now() - startTime;
    log('INFO', `Request completed in ${duration}ms`, { type });
    
    return {
      statusCode: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type'
      },
      body: JSON.stringify(response)
    };
    
  } catch (error) {
    log('ERROR', 'Handler Error', { error: error.message, stack: error.stack });
    return {
      statusCode: 500,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ error: error.message, stack: error.stack })
    };
  }
};
