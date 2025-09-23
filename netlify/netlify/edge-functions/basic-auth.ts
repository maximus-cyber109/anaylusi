export default async (request: Request) => {
  const url = new URL(request.url);
  
  // Skip authentication for your existing API function
  if (url.pathname.startsWith('/.netlify/functions/magento-api')) {
    return;
  }
  
  // Get multiple user credentials from environment
  const USERS_CREDENTIALS = Deno.env.get('DASHBOARD_USERS') || 'user1:pass1,user2:pass2,manager:manager123';
  const authHeader = request.headers.get('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return new Response(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>PinkBlue Analytics - Team Login</title>
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
            .login-container {
              background: rgba(255,255,255,0.08);
              padding: 50px;
              border-radius: 20px;
              border: 1px solid rgba(255,105,180,0.3);
              text-align: center;
              backdrop-filter: blur(20px);
              box-shadow: 0 20px 40px rgba(0,0,0,0.3);
              max-width: 400px;
              width: 90%;
            }
            h1 { 
              color: #ff69b4; 
              margin-bottom: 20px; 
              font-size: 2em;
              text-shadow: 0 0 20px rgba(255,105,180,0.5);
            }
            .users-info {
              background: rgba(0,255,136,0.1);
              border: 1px solid rgba(0,255,136,0.2);
              border-radius: 8px;
              padding: 15px;
              margin: 20px 0;
              font-size: 0.9em;
            }
            .subtitle { font-size: 1.1em; margin-bottom: 30px; }
            .note { font-size: 0.85em; opacity: 0.7; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="login-container">
            <h1>🔐 PinkBlue Analytics</h1>
            <p class="subtitle">Team Dashboard Access</p>
            <div class="users-info">
              <strong>👥 Authorized Users Only</strong><br>
              Enter your assigned credentials
            </div>
            <p class="note">Multiple team members can access this dashboard</p>
          </div>
        </body>
      </html>
    `, {
      status: 401,
      headers: {
        'WWW-Authenticate': 'Basic realm="PinkBlue Analytics Team Dashboard"',
        'Content-Type': 'text/html; charset=utf-8',
      },
    });
  }
  
  const base64Credentials = authHeader.slice(6);
  const userCredentials = atob(base64Credentials);
  
  // Parse multiple users from environment variable
  const validUsers = USERS_CREDENTIALS.split(',').map(cred => cred.trim());
  const isValidUser = validUsers.some(validCred => validCred === userCredentials);
  
  if (!isValidUser) {
    // Get username for error message
    const [username] = userCredentials.split(':');
    
    return new Response(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Access Denied - PinkBlue Analytics</title>
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
            .error-container { 
              text-align: center; 
              background: rgba(255,255,255,0.05);
              padding: 40px;
              border-radius: 16px;
              border: 1px solid rgba(239,83,80,0.3);
            }
            h1 { color: #ef5350; margin-bottom: 20px; }
            .username { color: #ffa726; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="error-container">
            <h1>❌ Access Denied</h1>
            <p>Invalid credentials for user: <span class="username">${username || 'Unknown'}</span></p>
            <p>Please check your username and password</p>
          </div>
        </body>
      </html>
    `, {
      status: 401,
      headers: {
        'WWW-Authenticate': 'Basic realm="PinkBlue Analytics Team Dashboard"',
        'Content-Type': 'text/html; charset=utf-8',
      },
    });
  }
  
  // Authentication successful - user can access dashboard
  return;
};
