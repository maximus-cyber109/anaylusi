const https = require('https');

// --- SECURE ENVIRONMENT ---
const API_TOKEN = process.env.MAGENTO_API_TOKEN;
const BASE_URL = (process.env.MAGENTO_API_URL || 'https://pinkblue.in/rest/V1').replace(/\/$/, '');

// --- HELPERS ---
const makeRequest = (endpoint) => {
    return new Promise((resolve, reject) => {
        if (!API_TOKEN) return reject(new Error("Missing API Token"));
        
        const url = `${BASE_URL}${endpoint}`;
        const options = {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${API_TOKEN}`,
                'Content-Type': 'application/json',
                'User-Agent': 'PinkBlue_Analytics_Pro'
            }
        };
        
        const req = https.request(url, options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    console.error("JSON Error", e);
                    resolve({ items: [], total_count: 0 });
                }
            });
        });
        req.on('error', reject);
        req.end();
    });
};

const formatDate = (d) => d.toISOString().split('T')[0];

// --- REPORT GENERATOR (CSV/EXCEL) ---
const generateCSV = (data, reportType) => {
    let headers = "";
    let rows = [];

    if (reportType === 'orders_report') {
        headers = "Order ID,Date,Status,Customer,Grand Total,Payment Method,Items";
        rows = data.map(o => {
            const items = (o.items || []).map(i => `${i.qty_ordered}x ${i.name}`).join(' | ');
            return `${o.increment_id},${o.created_at},${o.status},${o.customer_firstname} ${o.customer_lastname},${o.grand_total},${o.payment?.method || 'N/A'},"${items}"`;
        });
    } else if (reportType === 'products_report') {
        headers = "SKU,Product Name,Total Sold,Revenue Generated,Cancellation Rate";
        rows = data.map(p => `${p.sku},"${p.name}",${p.qty},${p.revenue},${p.cancelRate}%`);
    }

    return `${headers}\n${rows.join('\n')}`;
};

// --- MAIN ANALYTICS ENGINE ---
exports.handler = async (event, context) => {
    try {
        const { type, startDate, endDate, format } = event.queryStringParameters || {};
        
        // Default Dates (Last 30 Days if not specified)
        const end = endDate ? new Date(endDate) : new Date();
        const start = startDate ? new Date(startDate) : new Date(new Date().setDate(end.getDate() - 30));
        
        const sDateStr = formatDate(start);
        const eDateStr = formatDate(end);
        
        console.log(`[ENGINE] Running: ${type} [${sDateStr} to ${eDateStr}]`);

        // Base Query for Orders in Date Range
        const orderQuery = `/orders?searchCriteria[filterGroups][0][filters][0][field]=created_at&searchCriteria[filterGroups][0][filters][0][value]=${sDateStr}&searchCriteria[filterGroups][0][filters][0][conditionType]=from&searchCriteria[filterGroups][1][filters][0][field]=created_at&searchCriteria[filterGroups][1][filters][0][value]=${eDateStr} 23:59:59&searchCriteria[filterGroups][1][filters][0][conditionType]=to&searchCriteria[pageSize]=2000`;

        let result = {};

        switch (type) {
            case 'dashboard':
                const dData = await makeRequest(orderQuery);
                result = processDashboard(dData.items || []);
                break;

            case 'customer_analysis':
                const cData = await makeRequest(orderQuery);
                result = processRFM(cData.items || []);
                break;

            case 'trend_analysis':
                // For trends we usually need a wider range, but we'll use selected range
                const tData = await makeRequest(orderQuery);
                result = processTrends(tData.items || []);
                break;

            case 'export_orders':
                const eData = await makeRequest(orderQuery);
                const csv = generateCSV(eData.items || [], 'orders_report');
                return {
                    statusCode: 200,
                    headers: {
                        'Content-Type': 'text/csv',
                        'Content-Disposition': `attachment; filename="orders_report_${sDateStr}.csv"`
                    },
                    body: csv
                };

            default:
                result = { error: "Invalid Report Type" };
        }

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(result)
        };

    } catch (error) {
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
};

// --- LOGIC PROCESSORS ---

function processDashboard(items) {
    let revenue = 0, cancelled = 0, cod = 0, online = 0;
    items.forEach(o => {
        revenue += parseFloat(o.grand_total) || 0;
        if(o.status === 'canceled' || o.status === 'cancelled') cancelled++;
        if(o.payment?.method?.includes('cod')) cod++; else online++;
    });
    return {
        total_revenue: revenue.toFixed(2),
        total_orders: items.length,
        avg_order_value: items.length ? (revenue / items.length).toFixed(0) : 0,
        cancellation_rate: items.length ? ((cancelled/items.length)*100).toFixed(1) + '%' : '0%',
        payment_split: { cod, online }
    };
}

function processRFM(items) {
    // Basic RFM (Recency, Frequency, Monetary) from your customer-analytics.js
    const customers = {};
    items.forEach(o => {
        const email = o.customer_email || 'Guest';
        if(!customers[email]) customers[email] = { spent: 0, orders: 0, name: o.customer_firstname };
        customers[email].spent += parseFloat(o.grand_total) || 0;
        customers[email].orders += 1;
    });

    // Segment
    const segment = { vip: 0, regular: 0, new: 0 };
    Object.values(customers).forEach(c => {
        if(c.spent > 50000) segment.vip++;
        else if(c.orders > 1) segment.regular++;
        else segment.new++;
    });

    return { total_customers: Object.keys(customers).length, segments: segment };
}

function processTrends(items) {
    // Group by Date for Charting
    const timeline = {};
    items.forEach(o => {
        const d = o.created_at.split('T')[0];
        if(!timeline[d]) timeline[d] = 0;
        timeline[d] += parseFloat(o.grand_total) || 0;
    });
    return { timeline };
}
