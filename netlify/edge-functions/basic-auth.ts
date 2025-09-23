export default async (request: Request) => {
  const url = new URL(request.url);
  
  // Skip auth for function endpoints
  if (url.pathname.startsWith('/.netlify/functions/')) {
    return;
  }
  
  const BASIC_AUTH = Deno.env.get('DASHBOARD_AUTH');
  const authHeader = request.headers.get('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return new Response(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>PinkBlue Analytics - Authentication Required</title>
          <style>
            body { 
              font-family: 'Inter', sans-serif; 
              background: #000; 
              color: #fff; 
              display: flex; 
              justify-content: center; 
              align-items: center; 
              height: 100vh; 
              margin: 0;
            }
            .auth-box {
              background: rgba(255,255,255,0.1);
              padding: 40px;
              border-radius: 16px;
              border: 1px solid rgba(255,105,180,0.3);
              text-align: center;
              backdrop-filter: blur(20px);
            }
            h1 { color: #ff69b4; margin-bottom: 20px; }
          </style>
        </head>
        <body>
          <div class="auth-box">
            <h1>🔐 PinkBlue Analytics</h1>
            <p>Authentication required to access dashboard</p>
            <p><small>Please enter your credentials</small></p>
          </div>
        </body>
      </html>
    `, {
      status: 401,
      headers: {
        'WWW-Authenticate': 'Basic realm="PinkBlue Analytics Dashboard"',
        'Content-Type': 'text/html',
      },
    });
  }
  
  const base64Credentials = authHeader.slice(6);
  const credentials = atob(base64Credentials);
  
  if (credentials !== BASIC_AUTH) {
    return new Response('Invalid credentials', {
      status: 401,
      headers: {
        'WWW-Authenticate': 'Basic realm="PinkBlue Analytics Dashboard"',
      },
    });
  }
  
  // Authentication successful, continue to your dashboard
  return;
};
