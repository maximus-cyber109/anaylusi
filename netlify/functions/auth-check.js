const fs = require('fs');
const path = require('path');

exports.handler = async (event, context) => {
  const authHeader = event.headers.authorization;
  
  const validUsers = [
    'blade:pb@109$',
    'kulehi:imdumbass',
    'user:login',
    'password:user109'
  ];
  
  // Check authentication
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return {
      statusCode: 401,
      headers: {
        'WWW-Authenticate': 'Basic realm="PinkBlue Analytics"',
        'Content-Type': 'text/html'
      },
      body: `
        <!DOCTYPE html>
        <html>
          <head>
            <title>PinkBlue Analytics - Authentication Required</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              body { 
                font-family: 'Inter', sans-serif; 
                background: linear-gradient(135deg, #000000, #1a0033); 
                color: #fff; 
                display: flex; 
                justify-content: center; 
                align-items: center; 
                height: 100vh; 
                margin: 0;
              }
              .auth-container {
                background: rgba(255,255,255,0.08);
                padding: 60px 40px;
                border-radius: 20px;
                border: 1px solid rgba(255,105,180,0.4);
                text-align: center;
                backdrop-filter: blur(20px);
                box-shadow: 0 25px 50px rgba(0,0,0,0.4);
                max-width: 450px;
                width: 90%;
              }
              h1 { 
                color: #ff69b4; 
                margin-bottom: 20px; 
                font-size: 2.2em;
                text-shadow: 0 0 20px rgba(255,105,180,0.5);
              }
              .team-info {
                background: rgba(0,255,136,0.1);
                border: 1px solid rgba(0,255,136,0.3);
                border-radius: 10px;
                padding: 20px;
                margin: 25px 0;
              }
              .pulse {
                animation: pulse 2s infinite;
              }
              @keyframes pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.6; }
              }
              .user-count {
                font-size: 0.8em;
                opacity: 0.7;
                margin-top: 15px;
                color: #ffa726;
              }
            </style>
          </head>
          <body>
            <div class="auth-container">
              <h1>🔐 PinkBlue Analytics</h1>
              <p style="font-size: 1.1em; margin-bottom: 20px;">Secure Dashboard Portal</p>
              
              <div class="team-info">
                <strong style="color: #00ff88;">👥 Authorized Access Only</strong><br>
                <span style="font-size: 0.9em; opacity: 0.8;">Team members authentication required</span>
                <div class="user-count">4 authorized users configured</div>
              </div>
              
              <p style="font-size: 0.9em; opacity: 0.7;" class="pulse">
                Enter your credentials to continue
              </p>
            </div>
          </body>
        </html>
      `
    };
  }
  
  // Validate credentials
  const credentials = Buffer.from(authHeader.slice(6), 'base64').toString();
  const [username] = credentials.split(':');
  
  if (!validUsers.includes(credentials)) {
    console.log(`❌ Failed login attempt: ${username} at ${new Date().toISOString()}`);
    
    return {
      statusCode: 401,
      headers: {
        'WWW-Authenticate': 'Basic realm="PinkBlue Analytics"',
        'Content-Type': 'text/html'
      },
      body: `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Access Denied - PinkBlue Analytics</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              body { 
                font-family: 'Inter', sans-serif; 
                background: linear-gradient(135deg, #1a0000, #330000); 
                color: #fff; 
                display: flex; 
                justify-content: center; 
                align-items: center; 
                height: 100vh; 
                margin: 0;
              }
              .error-box {
                background: rgba(255,255,255,0.05);
                padding: 40px;
                border-radius: 16px;
                border: 1px solid rgba(239,83,80,0.4);
                text-align: center;
                max-width: 400px;
                width: 90%;
              }
              h1 { 
                color: #ef5350; 
                margin-bottom: 20px; 
                font-size: 2em;
              }
              .username { 
                color: #ffa726; 
                font-weight: bold; 
              }
              .error-details {
                background: rgba(239,83,80,0.1);
                border-left: 4px solid #ef5350;
                padding: 15px;
                margin: 20px 0;
                border-radius: 4px;
                text-align: left;
              }
            </style>
          </head>
          <body>
            <div class="error-box">
              <h1>❌ Access Denied</h1>
              <div class="error-details">
                <strong>Failed Authentication:</strong><br>
                User: <span class="username">${username || 'Unknown'}</span><br>
                Time: ${new Date().toLocaleString()}
              </div>
              <p>Invalid credentials provided</p>
              <p style="font-size: 0.85em; opacity: 0.7; margin-top: 15px;">
                🔄 Refresh page to try again
              </p>
            </div>
          </body>
        </html>
      `
    };
  }
  
  // Authentication successful
  console.log(`✅ PinkBlue Analytics access granted: ${username} at ${new Date().toISOString()}`);
  
  // Try to serve the dashboard
  try {
    const dashboardPath = path.join(__dirname, '..', 'index.html');
    let dashboardContent = fs.readFileSync(dashboardPath, 'utf8');
    
    // Inject user info into dashboard title
    dashboardContent = dashboardContent.replace(
      '<title>PinkBlue Analytics Dashboard</title>',
      `<title>PinkBlue Analytics - ${username}</title>`
    );
    
    // Add user info to dashboard (optional)
    dashboardContent = dashboardContent.replace(
      '<span id="last-updated" style="color: #00ff88; font-weight: 600;">Never</span>',
      `<span id="last-updated" style="color: #00ff88; font-weight: 600;">Never</span> | User: <strong style="color: #ff69b4;">${username}</strong>`
    );
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/html',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Set-Cookie': `pinkblue_user=${username}; Path=/; HttpOnly; SameSite=Strict; Max-Age=28800` // 8 hours
      },
      body: dashboardContent
    };
    
  } catch (error) {
    console.log('Dashboard file not found, using redirect method');
    
    // Fallback - redirect to dashboard
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/html'
      },
      body: `
        <!DOCTYPE html>
        <html>
          <head>
            <title>PinkBlue Analytics - ${username}</title>
            <meta http-equiv="refresh" content="2;url=/dashboard">
            <style>
              body {
                font-family: 'Inter', sans-serif;
                background: linear-gradient(135deg, #000, #1a0033);
                color: #fff;
                display: flex;
                justify-content: center;
                align-items: center;
                height: 100vh;
                margin: 0;
                text-align: center;
              }
              .welcome-box {
                background: rgba(255,255,255,0.08);
                padding: 50px;
                border-radius: 20px;
                border: 1px solid rgba(0,255,136,0.4);
                backdrop-filter: blur(20px);
              }
              h1 { color: #00ff88; margin-bottom: 20px; }
              .username { color: #ff69b4; font-weight: bold; }
              .loading {
                animation: pulse 1.5s infinite;
                margin-top: 20px;
              }
              @keyframes pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.5; }
              }
            </style>
          </head>
          <body>
            <div class="welcome-box">
              <h1>✅ Authentication Successful</h1>
              <p>Welcome <span class="username">${username}</span>!</p>
              <p class="loading">Loading PinkBlue Analytics Dashboard...</p>
              <p style="font-size: 0.9em; opacity: 0.7; margin-top: 20px;">
                <a href="/dashboard" style="color: #ff69b4;">Click here if not redirected automatically</a>
              </p>
            </div>
          </body>
        </html>
      `
    };
  }
};
