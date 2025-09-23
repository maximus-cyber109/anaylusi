exports.handler = async (event, context) => {
  const authHeader = event.headers.authorization;
  
  const validUsers = [
    'admin:pinkblue2024',
    'manager:dental123',
    'john:john456',
    'sarah:sarah789'
  ];
  
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
            <title>PinkBlue Analytics - Login Required</title>
            <style>
              body { 
                font-family: Inter, sans-serif; 
                background: linear-gradient(135deg, #000, #1a0033); 
                color: #fff; 
                display: flex; 
                justify-content: center; 
                align-items: center; 
                height: 100vh; 
                margin: 0;
              }
              .login-box {
                background: rgba(255,255,255,0.1);
                padding: 50px;
                border-radius: 20px;
                border: 1px solid rgba(255,105,180,0.4);
                text-align: center;
                backdrop-filter: blur(20px);
              }
              h1 { color: #ff69b4; margin-bottom: 20px; }
            </style>
          </head>
          <body>
            <div class="login-box">
              <h1>🔐 PinkBlue Analytics</h1>
              <p>Please enter your credentials</p>
            </div>
          </body>
        </html>
      `
    };
  }
  
  const credentials = Buffer.from(authHeader.slice(6), 'base64').toString();
  
  if (!validUsers.includes(credentials)) {
    return {
      statusCode: 401,
      headers: {
        'WWW-Authenticate': 'Basic realm="PinkBlue Analytics"'
      },
      body: 'Invalid credentials'
    };
  }
  
  return {
    statusCode: 200,
    body: 'Authorized'
  };
};
