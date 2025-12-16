// netlify/functions/analytics-engine.js
const https = require('https');

const MAGENTO_TOKEN = process.env.MAGENTO_API_TOKEN;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const BASE_URL = process.env.MAGENTO_BASE_URL || 'https://pinkblue.in/rest/V1';

const FIREWALL_HEADERS = {
  'Authorization': `Bearer ${MAGENTO_TOKEN}`,
  'Content-Type': 'application/json',
  'User-Agent': 'PB_Netlify_Intel',
  'X-Source-App': 'GameOfCrowns',
  'X-Netlify-Secret': 'X-PB-NetlifY2025-901AD7EE35110CCB445F3CA0EBEB1494'
};

function makeRequest(endpoint) {
  return new Promise((resolve) => {
    const url = `${BASE_URL}${endpoint}`;
    const req = https.request(url, { method: 'GET', headers: FIREWALL_HEADERS }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          console.error('[PARSE ERROR]', e);
          resolve({ items: [], total_count: 0 });
        }
      });
    });
    req.on('error', (e) => {
      console.error('[REQUEST ERROR]', e);
      resolve({ items: [], total_count: 0 });
    });
    req.end();
  });
}

function makeGeminiRequest(prompt, data) {
  return new Promise((resolve) => {
    const payload = JSON.stringify({
      contents: [{
        parts: [{
          text: `${prompt}\n\nData: ${JSON.stringify(data)}`
        }]
      }]
    });

    const options = {
      hostname: 'generativelanguage.googleapis.com',
      path: `/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          const text = result.candidates?.[0]?.content?.parts?.[0]?.text || 'Analysis unavailable';
          resolve(text);
        } catch (e) {
          console.error('[GEMINI ERROR]', e);
          resolve('AI analysis temporarily unavailable');
        }
      });
    });
    req.on('error', (e) => {
      console.error('[GEMINI REQUEST ERROR]', e);
      resolve('AI analysis failed');
    });
    req.write(payload);
    req.end();
  });
}

async function getDashboardData() {
  const today = new Date().toISOString().split('T')[0];
  const orderQuery = `/orders?searchCriteria[filterGroups][0][filters][0][field]=created_at&searchCriteria[filterGroups][0][filters][0][value]=${today}&searchCriteria[filterGroups][0][filters][0][conditionType]=from&searchCriteria[pageSize]=500`;
  const data = await makeRequest(orderQuery);
  
  let revenue = 0, cod = 0, online = 0, cancelled = 0, pending = 0, complete = 0;
  (data.items || []).forEach(o => {
    revenue += parseFloat(o.grand_total) || 0;
    if (o.payment?.method?.includes('cod') || o.payment?.method?.includes('cashondelivery')) cod++;
    else online++;
    if (o.status === 'canceled' || o.status === 'cancelled') cancelled++;
    if (o.status === 'pending') pending++;
    if (o.status === 'complete') complete++;
  });

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const recentOrders = (data.items || []).filter(o => o.created_at >= oneHourAgo);

  return {
    revenue: Math.round(revenue),
    orders: data.total_count || 0,
    cod_orders: cod,
    online_orders: online,
    cancellation_rate: data.total_count > 0 ? ((cancelled / data.total_count) * 100).toFixed(1) : 0,
    realtime: {
      last_hour: recentOrders.length,
      pending: recentOrders.filter(o => o.status === 'pending').length,
      complete: recentOrders.filter(o => o.status === 'complete').length
    }
  };
}

async function getCustomerRFM() {
  const pastDate = new Date();
  pastDate.setDate(pastDate.getDate() - 180);
  const sDate = pastDate.toISOString().split('T')[0];
  const orderQuery = `/orders?searchCriteria[filterGroups][0][filters][0][field]=created_at&searchCriteria[filterGroups][0][filters][0][value]=${sDate}&searchCriteria[filterGroups][0][filters][0][conditionType]=from&searchCriteria[pageSize]=2000`;
  const data = await makeRequest(orderQuery);
  
  const customers = {};
  (data.items || []).forEach(o => {
    const email = o.customer_email || 'Guest';
    if (!customers[email]) customers[email] = { email, spent: 0, orders: 0, lastOrder: o.created_at };
    customers[email].spent += parseFloat(o.grand_total) || 0;
    customers[email].orders++;
    if (o.created_at > customers[email].lastOrder) customers[email].lastOrder = o.created_at;
  });

  const segments = { champions: [], loyal: [], new: [], at_risk: [] };
  const now = new Date();
  
  Object.values(customers).forEach(c => {
    const daysSinceLast = Math.floor((now - new Date(c.lastOrder)) / (1000 * 60 * 60 * 24));
    c.recency = daysSinceLast;
    c.segment = '';
    
    if (c.orders > 5 && daysSinceLast < 30) {
      c.segment = 'Champions';
      segments.champions.push(c);
    } else if (c.orders > 2 && daysSinceLast < 60) {
      c.segment = 'Loyal';
      segments.loyal.push(c);
    } else if (c.orders === 1) {
      c.segment = 'New';
      segments.new.push(c);
    } else {
      c.segment = 'At Risk';
      segments.at_risk.push(c);
    }
  });

  return {
    total: Object.keys(customers).length,
    champions: segments.champions.length,
    loyal: segments.loyal.length,
    new: segments.new.length,
    at_risk: segments.at_risk.length,
    details: Object.values(customers).slice(0, 100)
  };
}

async function getProductAnalytics() {
  const pastDate = new Date();
  pastDate.setDate(pastDate.getDate() - 30);
  const sDate = pastDate.toISOString().split('T')[0];
  const orderQuery = `/orders?searchCriteria[filterGroups][0][filters][0][field]=created_at&searchCriteria[filterGroups][0][filters][0][value]=${sDate}&searchCriteria[filterGroups][0][filters][0][conditionType]=from&searchCriteria[pageSize]=1000`;
  const data = await makeRequest(orderQuery);
  
  const products = {};
  const cancelledProducts = {};
  
  (data.items || []).forEach(o => {
    (o.items || []).forEach(i => {
      if (!products[i.sku]) products[i.sku] = { sku: i.sku, name: i.name, qty: 0, revenue: 0, cancelled: 0 };
      products[i.sku].qty += i.qty_ordered || 0;
      products[i.sku].revenue += i.row_total || 0;
      if (o.status === 'canceled' || o.status === 'cancelled') {
        products[i.sku].cancelled += i.qty_ordered || 0;
      }
    });
  });

  Object.values(products).forEach(p => {
    p.cancellation_risk = p.qty > 0 ? ((p.cancelled / p.qty) * 100).toFixed(1) : 0;
  });

  return {
    total_unique: Object.keys(products).length,
    top_products: Object.values(products).sort((a, b) => b.revenue - a.revenue).slice(0, 20),
    high_risk: Object.values(products).filter(p => p.cancellation_risk > 20).slice(0, 10)
  };
}

async function getAIForecast() {
  const pastDate = new Date();
  pastDate.setDate(pastDate.getDate() - 30);
  const sDate = pastDate.toISOString().split('T')[0];
  const orderQuery = `/orders?searchCriteria[filterGroups][0][filters][0][field]=created_at&searchCriteria[filterGroups][0][filters][0][value]=${sDate}&searchCriteria[filterGroups][0][filters][0][conditionType]=from&searchCriteria[pageSize]=1000`;
  const data = await makeRequest(orderQuery);
  
  const dailyRevenue = {};
  (data.items || []).forEach(o => {
    if (o.status === 'complete' || o.status === 'processing') {
      const day = o.created_at.split('T')[0];
      dailyRevenue[day] = (dailyRevenue[day] || 0) + (parseFloat(o.grand_total) || 0);
    }
  });

  const revenueData = Object.entries(dailyRevenue).map(([date, revenue]) => ({ date, revenue: Math.round(revenue) }));
  
  const prompt = `You are a financial analyst for an e-commerce dental supply company. Analyze this 30-day revenue data and provide:
1. A 7-day revenue forecast (specific numbers)
2. Key trend observations
3. One strategic recommendation
Keep your response concise (under 150 words).`;

  const insight = await makeGeminiRequest(prompt, revenueData);

  return {
    model: 'Google Gemini Pro',
    data_points: revenueData.length,
    daily_data: revenueData,
    ai_insight: insight,
    timestamp: new Date().toISOString()
  };
}

async function exportData(type) {
  let data = [];
  let filename = 'export.csv';
  
  if (type === 'orders') {
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 30);
    const sDate = pastDate.toISOString().split('T')[0];
    const orderQuery = `/orders?searchCriteria[filterGroups][0][filters][0][field]=created_at&searchCriteria[filterGroups][0][filters][0][value]=${sDate}&searchCriteria[filterGroups][0][filters][0][conditionType]=from&searchCriteria[pageSize]=1000`;
    const result = await makeRequest(orderQuery);
    
    const csv = ['Order ID,Date,Customer Email,Status,Payment Method,Grand Total'];
    (result.items || []).forEach(o => {
      csv.push(`${o.entity_id || ''},${o.created_at || ''},${o.customer_email || ''},${o.status || ''},${o.payment?.method || ''},${o.grand_total || 0}`);
    });
    data = csv.join('\n');
    filename = 'orders_export.csv';
    
  } else if (type === 'customers') {
    const rfm = await getCustomerRFM();
    const csv = ['Email,Total Spent,Total Orders,Last Order Date,Recency (Days),Segment'];
    (rfm.details || []).forEach(c => {
      csv.push(`${c.email},${Math.round(c.spent)},${c.orders},${c.lastOrder},${c.recency},${c.segment}`);
    });
    data = csv.join('\n');
    filename = 'customers_rfm_export.csv';
    
  } else if (type === 'products') {
    const products = await getProductAnalytics();
    const csv = ['SKU,Product Name,Qty Sold,Revenue,Cancellation Risk %'];
    (products.top_products || []).forEach(p => {
      csv.push(`${p.sku},${p.name.replace(/,/g, ' ')},${p.qty},${Math.round(p.revenue)},${p.cancellation_risk}`);
    });
    data = csv.join('\n');
    filename = 'products_export.csv';
  }

  return { data, filename };
}

exports.handler = async (event) => {
  if (!MAGENTO_TOKEN) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'MAGENTO_API_TOKEN not configured' })
    };
  }

  const type = event.queryStringParameters?.type || 'dashboard';
  
  try {
    let response = {};
    
    if (type === 'dashboard') response = await getDashboardData();
    else if (type === 'customers') response = await getCustomerRFM();
    else if (type === 'products') response = await getProductAnalytics();
    else if (type === 'forecast') response = await getAIForecast();
    else if (type === 'export') {
      const exportType = event.queryStringParameters?.export || 'orders';
      const exported = await exportData(exportType);
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="${exported.filename}"`,
          'Access-Control-Allow-Origin': '*'
        },
        body: exported.data
      };
    }
    
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify(response)
    };
    
  } catch (error) {
    console.error('[HANDLER ERROR]', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: error.message })
    };
  }
};
