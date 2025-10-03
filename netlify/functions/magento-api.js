<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>PinkBlue Analytics Dashboard</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        html, body {
            height: 100%;
            overflow: hidden;
            font-family: 'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif;
            background: #000000;
            color: #ffffff;
        }

        /* Default cursor for dashboard */
        body {
            cursor: default;
        }

        /* Food cursor ONLY for login screen */
        .auth-screen {
            cursor: url('data:image/svg+xml;charset=utf-8,<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><circle cx="24" cy="24" r="18" fill="%23FFD700" stroke="%23FF6B47" stroke-width="3"/><circle cx="24" cy="24" r="12" fill="%23FF6B47"/><circle cx="18" cy="18" r="3" fill="%23FFD700"/><circle cx="30" cy="18" r="3" fill="%23FFD700"/><circle cx="24" cy="30" r="3" fill="%23FFD700"/><text x="24" y="44" text-anchor="middle" font-size="8" fill="%23FF6B47">🍖</text></svg>') 24 24, pointer;
        }

        .clickable {
            cursor: url('data:image/svg+xml;charset=utf-8,<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><circle cx="24" cy="24" r="20" fill="%23FF69B4" stroke="%23FFD700" stroke-width="4"/><circle cx="24" cy="24" r="14" fill="%23FFD700"/><text x="24" y="30" text-anchor="middle" font-size="20" fill="%23FF69B4">🍖</text></svg>') 24 24, pointer !important;
        }

        /* Authentication Screen Styles */
        .auth-screen {
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: linear-gradient(135deg, #000000, #1a0033);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 9999;
        }

        .auth-canvas {
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            z-index: 1;
        }

        .auth-container {
            position: relative;
            z-index: 10;
            background: rgba(255,255,255,0.08);
            padding: 60px 40px;
            border-radius: 20px;
            border: 1px solid rgba(255,105,180,0.4);
            backdrop-filter: blur(20px);
            box-shadow: 0 25px 50px rgba(0,0,0,0.5);
            max-width: 450px;
            width: 90%;
            text-align: center;
        }

        /* Perfect Bitmoji-style Character Container */
        .bitmoji-container {
            position: relative;
            width: 200px;
            height: 180px;
            margin: 0 auto 30px;
            perspective: 1000px;
            transform-style: preserve-3d;
        }

        /* Perfect Bitmoji Character */
        .bitmoji-3d {
            position: relative;
            width: 140px;
            height: 140px;
            margin: 20px auto;
            transform-style: preserve-3d;
            transition: all 0.3s ease;
        }

        /* Bitmoji Head - Round like the image */
        .bitmoji-head {
            position: relative;
            width: 120px;
            height: 120px;
            background: linear-gradient(145deg, #FFB84D, #FF8C42);
            border-radius: 50%;
            transform-style: preserve-3d;
            box-shadow: 
                inset -8px -8px 16px rgba(0,0,0,0.15),
                inset 8px 8px 16px rgba(255,255,255,0.25),
                0 8px 20px rgba(0,0,0,0.2);
            transition: transform 0.2s ease;
            border: 3px solid #D2691E;
        }

        /* Bitmoji Mane Spikes - Just like image */
        .mane-spikes {
            position: absolute;
            width: 140px;
            height: 140px;
            top: -10px;
            left: -10px;
            z-index: -1;
        }

        .mane-spike {
            position: absolute;
            background: linear-gradient(135deg, #D2691E, #CD853F);
            border-radius: 50% 50% 50% 10%;
            box-shadow: inset -2px -2px 4px rgba(0,0,0,0.2);
        }

        /* 8 mane spikes around the head */
        .mane-spike:nth-child(1) { width: 20px; height: 30px; top: -8px; left: 35%; transform: rotate(-10deg); }
        .mane-spike:nth-child(2) { width: 25px; height: 35px; top: -15px; left: 50%; transform: rotate(0deg); }
        .mane-spike:nth-child(3) { width: 20px; height: 30px; top: -8px; right: 35%; transform: rotate(10deg); }
        .mane-spike:nth-child(4) { width: 25px; height: 20px; top: 15%; right: -8px; transform: rotate(45deg); }
        .mane-spike:nth-child(5) { width: 20px; height: 25px; bottom: 15%; right: -5px; transform: rotate(30deg); }
        .mane-spike:nth-child(6) { width: 20px; height: 25px; bottom: 15%; left: -5px; transform: rotate(-30deg); }
        .mane-spike:nth-child(7) { width: 25px; height: 20px; top: 15%; left: -8px; transform: rotate(-45deg); }
        .mane-spike:nth-child(8) { width: 18px; height: 25px; top: 5%; left: 20%; transform: rotate(-25deg); }

        /* Bitmoji Ears - Small and cute */
        .bitmoji-ear {
            position: absolute;
            width: 25px;
            height: 20px;
            background: linear-gradient(145deg, #FFB84D, #FF8C42);
            border-radius: 50% 50% 20% 20%;
            top: 20px;
            border: 2px solid #D2691E;
            box-shadow: inset -2px -2px 4px rgba(0,0,0,0.1);
        }

        .bitmoji-ear.left {
            left: 8px;
            transform: rotate(-20deg);
        }

        .bitmoji-ear.right {
            right: 8px;
            transform: rotate(20deg);
        }

        .bitmoji-ear::after {
            content: '';
            position: absolute;
            width: 12px;
            height: 8px;
            background: linear-gradient(145deg, #FF69B4, #FF1493);
            border-radius: 50%;
            top: 6px;
            left: 50%;
            transform: translateX(-50%);
        }

        /* Perfect Bitmoji Eyes - EXACTLY like the image */
        .bitmoji-eyes {
            position: absolute;
            top: 35px;
            width: 100%;
            display: flex;
            justify-content: space-between;
            padding: 0 20px;
        }

        .bitmoji-eye {
            width: 28px;
            height: 26px;
            background: radial-gradient(circle at 35% 35%, #FFFFFF, #F8F8F8);
            border-radius: 50%;
            position: relative;
            border: 3px solid #2C2C2C;
            box-shadow: 
                inset -2px -2px 4px rgba(0,0,0,0.1),
                0 2px 6px rgba(0,0,0,0.15);
            transition: all 0.1s ease;
        }

        /* Big black pupils - Bitmoji style */
        .bitmoji-eye::before {
            content: '';
            position: absolute;
            width: 18px;
            height: 18px;
            background: radial-gradient(circle at 30% 30%, #000 60%, #1a1a1a 100%);
            border-radius: 50%;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
        }

        /* White shine dot */
        .bitmoji-eye::after {
            content: '';
            position: absolute;
            width: 6px;
            height: 6px;
            background: radial-gradient(circle, #ffffff 60%, transparent 80%);
            border-radius: 50%;
            top: 8px;
            left: 10px;
            z-index: 2;
        }

        /* Perfect Pink Nose - Just like image */
        .bitmoji-nose {
            position: absolute;
            bottom: 50px;
            left: 50%;
            transform: translateX(-50%);
            width: 12px;
            height: 10px;
            background: linear-gradient(145deg, #FF69B4, #FF1493);
            border-radius: 50% 50% 50% 50%;
            border: 2px solid #D91A72;
            box-shadow: 
                inset -1px -1px 2px rgba(0,0,0,0.2),
                0 2px 4px rgba(0,0,0,0.15);
        }

        /* Happy Smile - Bitmoji style */
        .bitmoji-mouth {
            position: absolute;
            bottom: 30px;
            left: 50%;
            transform: translateX(-50%);
            width: 28px;
            height: 16px;
            border: 3px solid #2C2C2C;
            border-top: none;
            border-radius: 0 0 20px 20px;
            background: linear-gradient(to bottom, transparent 40%, rgba(0,0,0,0.1) 100%);
            transition: all 0.3s ease;
        }

        .bitmoji-mouth.open {
            width: 40px;
            height: 25px;
            background: radial-gradient(ellipse at center, #FF69B4 20%, #000 50%, #333 100%);
            border-radius: 50%;
            border: 3px solid #2C2C2C;
            animation: mouthOpen 0.4s ease;
        }

        @keyframes mouthOpen {
            0% { transform: translateX(-50%) scaleY(0); }
            50% { transform: translateX(-50%) scaleY(1.3); }
            100% { transform: translateX(-50%) scaleY(1); }
        }

        /* Bitmoji Cheek Blush - Like the image */
        .bitmoji-cheek {
            position: absolute;
            width: 12px;
            height: 8px;
            background: radial-gradient(circle, rgba(255, 105, 180, 0.4), transparent 70%);
            border-radius: 50%;
            top: 55px;
        }

        .bitmoji-cheek.left {
            left: 8px;
        }

        .bitmoji-cheek.right {
            right: 8px;
        }

        /* HUGE secret feeding area - IMPOSSIBLE to miss */
        .secret-feeding-area {
            position: absolute;
            bottom: 5px;
            left: 50%;
            transform: translateX(-50%);
            width: 120px;
            height: 60px;
            background: rgba(255, 0, 0, 0.15); /* More visible for debugging */
            cursor: pointer;
            z-index: 100;
            border-radius: 30px;
            border: 3px dashed rgba(255, 255, 255, 0.4);
        }

        /* Speech bubble */
        .bitmoji-speech {
            position: absolute;
            top: -90px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(255,255,255,0.95);
            color: #000;
            padding: 15px 20px;
            border-radius: 25px;
            font-size: 1em;
            font-weight: bold;
            white-space: nowrap;
            opacity: 0;
            transition: opacity 0.3s ease;
            box-shadow: 0 10px 20px rgba(0,0,0,0.2);
            border: 2px solid #FF69B4;
        }

        .bitmoji-speech::after {
            content: '';
            position: absolute;
            bottom: -10px;
            left: 50%;
            transform: translateX(-50%);
            width: 0;
            height: 0;
            border-left: 12px solid transparent;
            border-right: 12px solid transparent;
            border-top: 12px solid rgba(255,255,255,0.95);
        }

        .bitmoji-speech.show {
            opacity: 1;
            animation: bounce3D 0.6s ease;
        }

        @keyframes bounce3D {
            0%, 20%, 50%, 80%, 100% { transform: translateX(-50%) translateY(0) translateZ(0); }
            40% { transform: translateX(-50%) translateY(-15px) translateZ(15px); }
            60% { transform: translateX(-50%) translateY(-8px) translateZ(8px); }
        }

        /* Authentication form styles */
        .auth-title {
            color: #ff69b4;
            font-size: 2.2em;
            margin-bottom: 20px;
            text-shadow: 0 0 20px rgba(255,105,180,0.6);
        }

        .auth-form {
            display: flex;
            flex-direction: column;
            gap: 20px;
            margin-top: 30px;
        }

        .auth-input {
            background: rgba(255,255,255,0.1);
            border: 1px solid rgba(255,255,255,0.3);
            border-radius: 10px;
            padding: 15px;
            color: #fff;
            font-size: 1em;
            transition: all 0.3s ease;
        }

        .auth-input:focus {
            outline: none;
            border-color: #ff69b4;
            background: rgba(255,255,255,0.15);
            box-shadow: 0 0 15px rgba(255,105,180,0.4);
        }

        .auth-input::placeholder {
            color: rgba(255,255,255,0.6);
        }

        .auth-submit {
            background: linear-gradient(135deg, #ff69b4, #ff1493);
            border: none;
            color: #fff;
            padding: 15px;
            border-radius: 10px;
            font-size: 1em;
            font-weight: bold;
            cursor: pointer;
            transition: all 0.3s ease;
        }

        .auth-submit:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 25px rgba(255,105,180,0.4);
        }

        .error-message {
            color: #ef5350;
            font-size: 0.9em;
            margin-top: 10px;
            opacity: 0;
            transition: opacity 0.3s ease;
        }

        .error-message.show {
            opacity: 1;
        }

        .success-message {
            color: #4caf50;
            font-size: 0.9em;
            margin-top: 10px;
            opacity: 0;
            transition: opacity 0.3s ease;
        }

        .success-message.show {
            opacity: 1;
        }

        /* Dashboard styles - Normal cursor */
        #background-canvas {
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            z-index: 1;
            background: #000000;
            display: block;
        }

        .dashboard-container {
            position: relative;
            display: flex;
            flex-direction: column;
            height: 100vh;
            width: 100vw;
            z-index: 10;
            cursor: default;
        }

        .header {
            background: rgba(0, 0, 0, 0.8);
            backdrop-filter: blur(20px);
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            padding: 20px 30px;
            display: flex;
            flex-direction: column;
            gap: 15px;
            flex-shrink: 0;
        }

        .header-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 15px;
        }

        .dashboard-controls {
            display: flex;
            align-items: center;
            gap: 20px;
            flex-wrap: wrap;
        }

        .control-group {
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .control-label {
            font-size: 0.9em;
            font-weight: 600;
            color: #ffffff;
            white-space: nowrap;
        }

        .control-input {
            background: rgba(255, 255, 255, 0.1);
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 8px;
            padding: 8px 12px;
            color: #ffffff;
            font-size: 0.9em;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.3s ease;
            min-width: 130px;
        }

        .control-input:focus {
            outline: none;
            border-color: #ff69b4;
            background: rgba(255, 255, 255, 0.15);
            box-shadow: 0 0 10px rgba(255, 105, 180, 0.3);
        }

        .apply-btn {
            background: linear-gradient(135deg, #4CAF50, #45a049);
            border: none;
            color: #fff;
            padding: 8px 16px;
            border-radius: 15px;
            font-size: 0.85em;
            font-weight: bold;
            cursor: pointer;
            transition: all 0.3s ease;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .apply-btn:hover {
            transform: translateY(-1px);
            box-shadow: 0 5px 15px rgba(76, 175, 80, 0.4);
        }

        .toggle-comparison {
            background: linear-gradient(135deg, #9C27B0, #7B1FA2);
            border: none;
            color: #fff;
            padding: 8px 16px;
            border-radius: 15px;
            font-size: 0.85em;
            font-weight: bold;
            cursor: pointer;
            transition: all 0.3s ease;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .toggle-comparison:hover {
            transform: translateY(-1px);
            box-shadow: 0 5px 15px rgba(156, 39, 176, 0.4);
        }

        .toggle-comparison.active {
            background: linear-gradient(135deg, #ff69b4, #ff1493);
        }

        .comparison-controls {
            display: none;
            gap: 20px;
            align-items: center;
            flex-wrap: wrap;
        }

        .comparison-controls.show {
            display: flex;
        }

        .compare-btn {
            background: linear-gradient(135deg, #ff69b4, #ff1493);
            border: none;
            color: #fff;
            padding: 8px 16px;
            border-radius: 15px;
            font-size: 0.85em;
            font-weight: bold;
            cursor: pointer;
            transition: all 0.3s ease;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .compare-btn:hover {
            transform: translateY(-1px);
            box-shadow: 0 5px 15px rgba(255,105,180,0.4);
        }

        .status-section {
            display: flex;
            align-items: center;
            gap: 12px;
            background: rgba(255, 255, 255, 0.05);
            padding: 8px 16px;
            border-radius: 20px;
            border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .live-indicator {
            width: 8px;
            height: 8px;
            background: #00ff00;
            border-radius: 50%;
            animation: pulse 2s infinite;
        }

        @keyframes pulse {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.6; transform: scale(1.2); }
        }

        .status-text {
            font-weight: 600;
            color: #00ff00;
            font-size: 0.85em;
        }

        .main-content {
            flex: 1;
            display: flex;
            flex-direction: column;
            padding: 20px 30px;
            overflow-y: auto;
            max-height: calc(100vh - 160px);
        }

        .dashboard-title {
            text-align: center;
            margin-bottom: 30px;
        }

        .title-main {
            font-size: 2.8em;
            font-weight: 800;
            color: #ffffff;
            margin-bottom: 10px;
            text-shadow: 0 0 20px rgba(255, 255, 255, 0.2);
        }

        .title-date {
            font-size: 1.2em;
            color: #cccccc;
            font-weight: 500;
        }

        /* Comparison Results with Chart */
        .comparison-results {
            background: rgba(255, 255, 255, 0.04);
            backdrop-filter: blur(20px);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 16px;
            padding: 25px;
            margin-bottom: 30px;
            display: none;
        }

        .comparison-results.show {
            display: block;
            animation: slideIn 0.5s ease;
        }

        @keyframes slideIn {
            from { opacity: 0; transform: translateY(-20px); }
            to { opacity: 1; transform: translateY(0); }
        }

        .comparison-header {
            color: #ff69b4;
            font-size: 1.8em;
            font-weight: bold;
            margin-bottom: 25px;
            text-align: center;
        }

        .comparison-period-info {
            background: rgba(255,255,255,0.05);
            border-radius: 12px;
            padding: 20px;
            margin-bottom: 25px;
            border-left: 4px solid #ff69b4;
        }

        .comparison-content {
            display: grid;
            grid-template-columns: 1fr 400px;
            gap: 30px;
            margin-top: 20px;
        }

        .comparison-metrics {
            display: flex;
            flex-direction: column;
            gap: 15px;
        }

        .comparison-metric {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 15px;
            background: rgba(255, 255, 255, 0.03);
            border-radius: 10px;
            border-left: 4px solid rgba(255, 105, 180, 0.5);
            transition: all 0.3s ease;
        }

        .comparison-metric:hover {
            background: rgba(255, 255, 255, 0.06);
            transform: translateX(5px);
        }

        .metric-name {
            font-weight: 600;
            color: #ffffff;
            font-size: 1.1em;
        }

        .metric-comparison {
            display: flex;
            align-items: center;
            gap: 20px;
        }

        .metric-values {
            font-size: 0.9em;
            color: #cccccc;
            text-align: right;
        }

        .metric-change {
            font-weight: bold;
            padding: 8px 15px;
            border-radius: 8px;
            font-size: 0.9em;
            min-width: 140px;
            text-align: center;
            white-space: nowrap;
        }

        .metric-change.positive {
            background: rgba(76, 175, 80, 0.2);
            color: #4caf50;
            border: 1px solid rgba(76, 175, 80, 0.3);
        }

        .metric-change.negative {
            background: rgba(244, 67, 54, 0.2);
            color: #f44336;
            border: 1px solid rgba(244, 67, 54, 0.3);
        }

        .metric-change.neutral {
            background: rgba(158, 158, 158, 0.2);
            color: #9e9e9e;
            border: 1px solid rgba(158, 158, 158, 0.3);
        }

        /* Chart Container */
        .chart-container {
            background: rgba(255, 255, 255, 0.02);
            border-radius: 12px;
            padding: 20px;
            border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .chart-title {
            color: #ff69b4;
            font-size: 1.2em;
            font-weight: bold;
            margin-bottom: 15px;
            text-align: center;
        }

        .chart-canvas {
            width: 100%;
            height: 300px;
            background: rgba(255, 255, 255, 0.02);
            border-radius: 8px;
            border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .metrics-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }

        .metric-card {
            background: rgba(255, 255, 255, 0.04);
            backdrop-filter: blur(20px);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 16px;
            padding: 25px;
            text-align: center;
            transition: all 0.4s ease;
            position: relative;
            overflow: hidden;
        }

        .metric-card:hover {
            transform: translateY(-5px);
            border-color: rgba(255, 105, 180, 0.4);
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
            background: rgba(255, 255, 255, 0.06);
        }

        .card-icon {
            font-size: 2em;
            margin-bottom: 10px;
            display: block;
        }

        .card-title {
            font-size: 0.9em;
            color: #ffffff;
            margin-bottom: 15px;
            font-weight: 600;
            line-height: 1.4;
        }

        .card-value {
            font-size: 2.2em;
            font-weight: 800;
            margin-bottom: 5px;
            line-height: 1;
        }

        .card-label {
            font-size: 0.8em;
            color: #aaaaaa;
            font-weight: 500;
        }

        .total-orders .card-value { color: #00d4ff; }
        .revenue .card-value { color: #00ff88; }
        .pending .card-value { color: #ffa726; }
        .processing .card-value { color: #42a5f5; }
        .completed .card-value { color: #66bb6a; }
        .cancelled .card-value { color: #ef5350; }
        .cod .card-value { color: #ab47bc; }
        .online .card-value { color: #26c6da; }

        /* Loading indicator */
        .loading-indicator {
            display: none;
            text-align: center;
            padding: 20px;
            font-size: 1.2em;
            color: #ff69b4;
        }

        .loading-indicator.show {
            display: block;
        }

        .spinner {
            display: inline-block;
            width: 20px;
            height: 20px;
            border: 3px solid rgba(255, 105, 180, 0.3);
            border-radius: 50%;
            border-top-color: #ff69b4;
            animation: spin 1s ease-in-out infinite;
            margin-right: 10px;
        }

        @keyframes spin {
            to { transform: rotate(360deg); }
        }

        @media (max-width: 1200px) {
            .comparison-content {
                grid-template-columns: 1fr;
                gap: 20px;
            }
            
            .chart-container {
                order: -1;
            }
        }

        @media (max-width: 768px) {
            .header {
                padding: 15px 20px;
            }
            
            .dashboard-controls {
                justify-content: center;
            }
            
            .main-content {
                padding: 15px 20px;
            }
            
            .metrics-grid {
                grid-template-columns: 1fr;
                gap: 15px;
            }
            
            .metric-card {
                padding: 20px;
            }
            
            .card-value {
                font-size: 1.8em;
            }
            
            .title-main {
                font-size: 2.2em;
            }
        }
    </style>
</head>
<body>
    <!-- Authentication Screen -->
    <div class="auth-screen" id="auth-screen">
        <canvas class="auth-canvas" id="auth-canvas"></canvas>
        <div class="auth-container">
            <!-- Perfect Bitmoji-style Character -->
            <div class="bitmoji-container">
                <div class="bitmoji-speech" id="bitmoji-speech"></div>
                <div class="bitmoji-3d" id="bitmoji-3d">
                    <div class="bitmoji-head" id="bitmoji-head">
                        <!-- Mane spikes around head -->
                        <div class="mane-spikes">
                            <div class="mane-spike"></div>
                            <div class="mane-spike"></div>
                            <div class="mane-spike"></div>
                            <div class="mane-spike"></div>
                            <div class="mane-spike"></div>
                            <div class="mane-spike"></div>
                            <div class="mane-spike"></div>
                            <div class="mane-spike"></div>
                        </div>
                        
                        <!-- Cute Ears -->
                        <div class="bitmoji-ear left"></div>
                        <div class="bitmoji-ear right"></div>
                        
                        <!-- Perfect Eyes -->
                        <div class="bitmoji-eyes">
                            <div class="bitmoji-eye" id="left-eye"></div>
                            <div class="bitmoji-eye" id="right-eye"></div>
                        </div>
                        
                        <!-- Cheek blush -->
                        <div class="bitmoji-cheek left"></div>
                        <div class="bitmoji-cheek right"></div>
                        
                        <!-- Pink Nose -->
                        <div class="bitmoji-nose"></div>
                        
                        <!-- Happy Mouth -->
                        <div class="bitmoji-mouth" id="bitmoji-mouth"></div>
                    </div>
                </div>
                
                <!-- HUGE secret feeding area - IMPOSSIBLE to miss -->
                <div class="secret-feeding-area clickable" id="secret-feeding-area"></div>
            </div>
            
            <h1 class="auth-title">🔐 PinkBlue Analytics</h1>
            <p style="color: rgba(255,255,255,0.8); margin-bottom: 20px;">Secure Access Portal</p>
            
            <!-- Authentication form -->
            <form class="auth-form" id="auth-form">
                <input type="text" id="username" class="auth-input" placeholder="👤 Username" required>
                <input type="password" id="password" class="auth-input" placeholder="🔒 Password" required>
                <button type="submit" class="auth-submit clickable">🚀 Access Dashboard</button>
                <div class="error-message" id="error-message">Invalid credentials!</div>
                <div class="success-message" id="success-message">Credentials verified. Complete authentication...</div>
            </form>
        </div>
    </div>

    <canvas id="background-canvas"></canvas>

    <!-- Dashboard -->
    <div class="dashboard-container" id="dashboard" style="display: none;">
        <header class="header">
            <div class="header-row">
                <div class="dashboard-controls">
                    <div class="control-group">
                        <label class="control-label">From:</label>
                        <input type="date" id="start-date" class="control-input" />
                    </div>
                    
                    <div class="control-group">
                        <label class="control-label">To:</label>
                        <input type="date" id="end-date" class="control-input" />
                    </div>
                    
                    <button class="apply-btn" onclick="applyDateRange()">
                        ✅ Apply
                    </button>
                    
                    <button class="toggle-comparison" id="toggle-comparison" onclick="toggleComparison()">
                        📊 Enable Comparison
                    </button>
                </div>
                
                <div class="status-section">
                    <div class="live-indicator"></div>
                    <span class="status-text">REAL MAGENTO DATA</span>
                </div>
            </div>
            
            <div class="comparison-controls" id="comparison-controls">
                <div class="control-group">
                    <label class="control-label">Compare From:</label>
                    <input type="date" id="compare-start-date" class="control-input" />
                </div>
                
                <div class="control-group">
                    <label class="control-label">To:</label>
                    <input type="date" id="compare-end-date" class="control-input" />
                </div>
                
                <button class="compare-btn" onclick="compareData()">🔄 Compare</button>
            </div>
        </header>

        <main class="main-content">
            <div class="dashboard-title">
                <h1 class="title-main">Analytics Dashboard</h1>
                <p class="title-date" id="selected-date">Real Magento Data</p>
            </div>

            <div class="loading-indicator" id="loading-indicator">
                <div class="spinner"></div>
                Loading real data from Magento...
            </div>

            <div class="comparison-results" id="comparison-results">
                <div class="comparison-header">📊 Period Comparison Analysis</div>
                <div class="comparison-period-info" id="comparison-period-info"></div>
                
                <div class="comparison-content">
                    <div class="comparison-metrics" id="comparison-content"></div>
                    <div class="chart-container">
                        <div class="chart-title">📈 Performance Chart</div>
                        <canvas class="chart-canvas" id="comparison-chart"></canvas>
                    </div>
                </div>
            </div>

            <div class="metrics-grid">
                <div class="metric-card total-orders">
                    <span class="card-icon">📦</span>
                    <h3 class="card-title">Total Orders</h3>
                    <div class="card-value" id="total-orders">Loading...</div>
                    <p class="card-label">Orders Placed</p>
                </div>

                <div class="metric-card revenue">
                    <span class="card-icon">💰</span>
                    <h3 class="card-title">Revenue</h3>
                    <div class="card-value" id="total-revenue">Loading...</div>
                    <p class="card-label">Gross Sales</p>
                </div>

                <div class="metric-card pending">
                    <span class="card-icon">⏳</span>
                    <h3 class="card-title">Pending</h3>
                    <div class="card-value" id="pending-orders">Loading...</div>
                    <p class="card-label">Awaiting Process</p>
                </div>

                <div class="metric-card processing">
                    <span class="card-icon">🔄</span>
                    <h3 class="card-title">Processing</h3>
                    <div class="card-value" id="processing-orders">Loading...</div>
                    <p class="card-label">Being Prepared</p>
                </div>

                <div class="metric-card completed">
                    <span class="card-icon">✅</span>
                    <h3 class="card-title">Completed</h3>
                    <div class="card-value" id="completed-orders">Loading...</div>
                    <p class="card-label">Delivered</p>
                </div>

                <div class="metric-card cancelled">
                    <span class="card-icon">❌</span>
                    <h3 class="card-title">Cancelled</h3>
                    <div class="card-value" id="cancelled-orders">Loading...</div>
                    <p class="card-label">Cancellations</p>
                </div>

                <div class="metric-card cod">
                    <span class="card-icon">💳</span>
                    <h3 class="card-title">Cash on Delivery</h3>
                    <div class="card-value" id="cod-orders">Loading...</div>
                    <p class="card-label">COD Payments</p>
                </div>

                <div class="metric-card online">
                    <span class="card-icon">💸</span>
                    <h3 class="card-title">Online Payments</h3>
                    <div class="card-value" id="online-orders">Loading...</div>
                    <p class="card-label">Digital Transactions</p>
                </div>
            </div>
        </main>
    </div>

    <!-- Audio elements for sound effects -->
    <audio id="click-sound" preload="auto">
        <source src="data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhCjiJ1fPTgjMHImfA7+OZERE" type="audio/wav">
    </audio>
    <audio id="eating-sound" preload="auto">
        <source src="data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhCjiJ1fPTgjMHImfA7+OZERE" type="audio/wav">
    </audio>

    <script>
        // Authentication state
        let credentialsValid = false;
        let feedingComplete = false;
        let feedCount = 0;
        let comparisonMode = false;
        let currentChart = null;

        // REAL API configuration
        const API_ENDPOINT = '/.netlify/functions/magento-orders';

        // Sound effect functions
        function playClickSound() {
            const clickSound = document.getElementById('click-sound');
            if (clickSound) {
                clickSound.currentTime = 0;
                clickSound.play().catch(e => console.log('Audio play failed:', e));
            }
        }

        function playEatingSound() {
            const eatingSound = document.getElementById('eating-sound');
            if (eatingSound) {
                eatingSound.currentTime = 0;
                eatingSound.play().catch(e => console.log('Audio play failed:', e));
            }
        }

        // Add click sound to clickable elements
        document.addEventListener('click', function(e) {
            if (e.target.classList.contains('clickable') || 
                e.target.tagName === 'BUTTON') {
                playClickSound();
            }
        });

        // Particle system for background
        const authCanvas = document.getElementById('auth-canvas');
        const authCtx = authCanvas.getContext('2d');
        let authParticles = [];

        function resizeAuthCanvas() {
            authCanvas.width = window.innerWidth;
            authCanvas.height = window.innerHeight;
        }

        class AuthParticle {
            constructor() {
                this.x = Math.random() * authCanvas.width;
                this.y = Math.random() * authCanvas.height;
                this.size = Math.random() * 2 + 1;
                this.speedX = (Math.random() - 0.5) * 0.3;
                this.speedY = (Math.random() - 0.5) * 0.3;
                this.opacity = Math.random() * 0.5 + 0.2;
            }

            update() {
                this.x += this.speedX;
                this.y += this.speedY;

                if (this.x > authCanvas.width || this.x < 0) this.speedX = -this.speedX;
                if (this.y > authCanvas.height || this.y < 0) this.speedY = -this.speedY;
            }

            draw() {
                authCtx.fillStyle = `rgba(255, 105, 180, ${this.opacity})`;
                authCtx.beginPath();
                authCtx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
                authCtx.fill();
            }
        }

        function createAuthParticles() {
            authParticles = [];
            const particleCount = Math.min(80, Math.floor((authCanvas.width * authCanvas.height) / 20000));
            for (let i = 0; i < particleCount; i++) {
                authParticles.push(new AuthParticle());
            }
        }

        function connectAuthParticles() {
            const maxDistance = 120;
            for (let i = 0; i < authParticles.length; i++) {
                for (let j = i + 1; j < authParticles.length; j++) {
                    const dx = authParticles[i].x - authParticles[j].x;
                    const dy = authParticles[i].y - authParticles[j].y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    
                    if (distance < maxDistance) {
                        const opacity = (1 - distance / maxDistance) * 0.3;
                        authCtx.strokeStyle = `rgba(255, 105, 180, ${opacity})`;
                        authCtx.lineWidth = 1;
                        authCtx.beginPath();
                        authCtx.moveTo(authParticles[i].x, authParticles[i].y);
                        authCtx.lineTo(authParticles[j].x, authParticles[j].y);
                        authCtx.stroke();
                    }
                }
            }
        }

        function animateAuthParticles() {
            authCtx.clearRect(0, 0, authCanvas.width, authCanvas.height);
            
            authParticles.forEach(particle => {
                particle.update();
                particle.draw();
            });
            
            connectAuthParticles();
            
            if (document.getElementById('auth-screen').style.display !== 'none') {
                requestAnimationFrame(animateAuthParticles);
            }
        }

        // Enhanced 3D Bitmoji animation
        function update3DBitmojiAnimation(mouseX, mouseY) {
            const bitmojiContainer = document.querySelector('.bitmoji-container');
            if (!bitmojiContainer) return;
            
            const rect = bitmojiContainer.getBoundingClientRect();
            const bitmojiCenterX = rect.left + rect.width / 2;
            const bitmojiCenterY = rect.top + rect.height / 2;
            
            const deltaX = mouseX - bitmojiCenterX;
            const deltaY = mouseY - bitmojiCenterY;
            
            // Calculate angles for 3D rotation
            const rotateY = (deltaX / window.innerWidth) * 15;
            const rotateX = -(deltaY / window.innerHeight) * 10;
            
            // Apply 3D transformation
            const bitmoji3D = document.getElementById('bitmoji-3d');
            const bitmojiHead = document.getElementById('bitmoji-head');
            
            if (bitmoji3D && bitmojiHead) {
                bitmoji3D.style.transform = `rotateY(${rotateY}deg) rotateX(${rotateX}deg)`;
                
                const headTilt = (deltaX / window.innerWidth) * 5;
                bitmojiHead.style.transform = `rotateZ(${headTilt}deg)`;
            }
            
            // Eye movement
            const eyeOffsetX = (deltaX / window.innerWidth) * 2;
            const eyeOffsetY = (deltaY / window.innerHeight) * 2;
            
            const leftEye = document.getElementById('left-eye');
            const rightEye = document.getElementById('right-eye');
            
            if (leftEye && rightEye) {
                leftEye.style.transform = `translate(${eyeOffsetX}px, ${eyeOffsetY}px)`;
                rightEye.style.transform = `translate(${eyeOffsetX}px, ${eyeOffsetY}px)`;
            }
        }

        // Bitmoji speech system
        function showBitmojiSpeech(message, duration = 2500) {
            const speech = document.getElementById('bitmoji-speech');
            if (speech) {
                speech.textContent = message;
                speech.classList.add('show');
                setTimeout(() => {
                    speech.classList.remove('show');
                }, duration);
            }
        }

        // Secret feeding mechanism - PERFECT WORKING VERSION
        function secretFeed() {
            console.log('secretFeed called, credentialsValid:', credentialsValid, 'feedCount:', feedCount);
            
            if (!credentialsValid) {
                showBitmojiSpeech('🔒 Please login first!', 2000);
                return;
            }
            
            playEatingSound();
            feedCount++;
            console.log('Feed count increased to:', feedCount);
            
            const mouth = document.getElementById('bitmoji-mouth');
            if (mouth) {
                mouth.classList.add('open');
                setTimeout(() => {
                    mouth.classList.remove('open');
                }, 600);
            }

            // Progressive responses with GUARANTEED access
            if (feedCount === 1) {
                showBitmojiSpeech('🦁 Yummy treats!', 2000);
            } else if (feedCount === 2) {
                showBitmojiSpeech('😋 More please!', 2000);
            } else if (feedCount >= 3) {
                feedingComplete = true;
                showBitmojiSpeech('🎉 ACCESS GRANTED!', 3000);
                
                setTimeout(() => {
                    console.log('Granting access to dashboard...');
                    document.getElementById('auth-screen').style.display = 'none';
                    document.getElementById('dashboard').style.display = 'flex';
                    initDashboard();
                }, 3500);
            }
        }

        // Mouse tracking for 3D animation
        document.addEventListener('mousemove', (e) => {
            if (document.getElementById('auth-screen').style.display !== 'none') {
                update3DBitmojiAnimation(e.clientX, e.clientY);
            }
        });

        // Secret feeding area click handler - GUARANTEED TO WORK
        document.addEventListener('DOMContentLoaded', function() {
            const feedingArea = document.getElementById('secret-feeding-area');
            console.log('Feeding area element:', feedingArea);
            
            if (feedingArea) {
                feedingArea.addEventListener('click', function(e) {
                    console.log('Feeding area clicked!');
                    e.preventDefault();
                    e.stopPropagation();
                    secretFeed();
                });
                
                feedingArea.addEventListener('touchstart', function(e) {
                    console.log('Feeding area touched!');
                    e.preventDefault();
                    e.stopPropagation();
                    secretFeed();
                });
            }
        });

        // Authentication form handler
        const validUsers = {
            'blade': 'pb@109$',
            'kulehi': 'imdumbass',
            'user': 'login',
            'password': 'user109'
        };

        document.getElementById('auth-form').addEventListener('submit', function(e) {
            e.preventDefault();
            
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            const errorMsg = document.getElementById('error-message');
            const successMsg = document.getElementById('success-message');
            
            console.log('Login attempt:', username);
            
            if (validUsers[username] && validUsers[username] === password) {
                credentialsValid = true;
                console.log('Credentials validated');
                
                errorMsg.classList.remove('show');
                successMsg.classList.add('show');
                
                setTimeout(() => {
                    showBitmojiSpeech('🦁 Feed me treats! Click below!', 3000);
                }, 1000);
                
            } else {
                credentialsValid = false;
                feedCount = 0;
                successMsg.classList.remove('show');
                errorMsg.classList.add('show');
                
                setTimeout(() => {
                    errorMsg.classList.remove('show');
                }, 3000);
                
                document.getElementById('password').value = '';
            }
        });

        // Dashboard functionality with REAL API
        const canvas = document.getElementById('background-canvas');
        const ctx = canvas.getContext('2d');
        let particles = [];

        function resizeCanvas() {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        }

        class Particle {
            constructor(x, y) {
                this.x = x || Math.random() * canvas.width;
                this.y = y || Math.random() * canvas.height;
                this.size = Math.random() * 3 + 1;
                this.speedX = (Math.random() - 0.5) * 0.5;
                this.speedY = (Math.random() - 0.5) * 0.5;
                this.opacity = Math.random() * 0.5 + 0.2;
            }

            update() {
                this.x += this.speedX;
                this.y += this.speedY;

                if (this.x > canvas.width || this.x < 0) {
                    this.speedX = -this.speedX;
                }
                if (this.y > canvas.height || this.y < 0) {
                    this.speedY = -this.speedY;
                }
            }

            draw() {
                ctx.fillStyle = `rgba(255, 105, 180, ${this.opacity})`;
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        function createParticles() {
            particles = [];
            let numberOfParticles = Math.min(100, Math.floor((canvas.width * canvas.height) / 15000));
            
            for (let i = 0; i < numberOfParticles; i++) {
                particles.push(new Particle());
            }
        }

        function animate() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            particles.forEach(particle => {
                particle.update();
                particle.draw();
            });
            
            requestAnimationFrame(animate);
        }

        // REAL API functions
        async function fetchRealMagentoData(selectedDate = null) {
            const loadingIndicator = document.getElementById('loading-indicator');
            loadingIndicator.classList.add('show');
            
            try {
                const dateParam = selectedDate || new Date().toISOString().split('T')[0];
                const url = `${API_ENDPOINT}?date=${dateParam}`;
                
                console.log('Fetching REAL Magento data from:', url);
                
                const response = await fetch(url, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                    }
                });
                
                if (!response.ok) {
                    throw new Error(`API request failed: ${response.status} ${response.statusText}`);
                }
                
                const data = await response.json();
                console.log('REAL Magento data received:', data);
                
                if (!data.success) {
                    throw new Error(data.error || 'API returned error');
                }
                
                updateDashboard(data);
                showToast('✅ Real Magento data loaded successfully!');
                
                return data;
                
            } catch (error) {
                console.error('Error fetching real Magento data:', error);
                showToast(`❌ Error loading data: ${error.message}`, 'error');
                
                // Show error in cards
                document.getElementById('total-orders').textContent = 'Error';
                document.getElementById('total-revenue').textContent = 'Error';
                document.getElementById('pending-orders').textContent = 'Error';
                document.getElementById('processing-orders').textContent = 'Error';
                document.getElementById('completed-orders').textContent = 'Error';
                document.getElementById('cancelled-orders').textContent = 'Error';
                document.getElementById('cod-orders').textContent = 'Error';
                document.getElementById('online-orders').textContent = 'Error';
                
            } finally {
                loadingIndicator.classList.remove('show');
            }
        }

        // Apply date range function with REAL API
        async function applyDateRange() {
            const startDate = document.getElementById('start-date').value;
            const endDate = document.getElementById('end-date').value;
            
            if (!startDate || !endDate) {
                alert('Please select both start and end dates');
                return;
            }
            
            const selectedDate = document.getElementById('selected-date');
            selectedDate.textContent = `${formatDate(startDate)} to ${formatDate(endDate)}`;
            
            // Fetch REAL data for the selected date range
            await fetchRealMagentoData(startDate);
        }

        // Comparison toggle functionality
        function toggleComparison() {
            comparisonMode = !comparisonMode;
            const toggleBtn = document.getElementById('toggle-comparison');
            const comparisonControls = document.getElementById('comparison-controls');
            
            if (comparisonMode) {
                toggleBtn.textContent = '📊 Disable Comparison';
                toggleBtn.classList.add('active');
                comparisonControls.classList.add('show');
            } else {
                toggleBtn.textContent = '📊 Enable Comparison';
                toggleBtn.classList.remove('active');
                comparisonControls.classList.remove('show');
                document.getElementById('comparison-results').classList.remove('show');
            }
        }

        // Compare data with REAL API
        async function compareData() {
            if (!comparisonMode) return;
            
            const startDate = document.getElementById('start-date').value;
            const endDate = document.getElementById('end-date').value;
            const compareStartDate = document.getElementById('compare-start-date').value;
            const compareEndDate = document.getElementById('compare-end-date').value;

            if (!compareStartDate || !compareEndDate) {
                alert('Please select comparison date range');
                return;
            }

            try {
                showToast('🔄 Fetching comparison data...');
                
                // Fetch REAL data for both periods
                const currentData = await fetchRealMagentoData(startDate);
                const previousData = await fetchRealMagentoData(compareStartDate);
                
                if (currentData && previousData) {
                    displayComparison(currentData, previousData, startDate, endDate, compareStartDate, compareEndDate);
                    showToast('📊 Comparison analysis complete!');
                }
                
            } catch (error) {
                console.error('Error comparing data:', error);
                showToast('❌ Error fetching comparison data', 'error');
            }
        }

        // Toast notification
        function showToast(message, type = 'success') {
            const toast = document.createElement('div');
            const bgColor = type === 'error' ? 'rgba(244, 67, 54, 0.9)' : 'rgba(76, 175, 80, 0.9)';
            
            toast.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: ${bgColor};
                color: white;
                padding: 15px 20px;
                border-radius: 8px;
                font-weight: bold;
                z-index: 10000;
                animation: slideIn 0.3s ease;
                max-width: 300px;
            `;
            toast.textContent = message;
            
            document.body.appendChild(toast);
            
            setTimeout(() => {
                toast.remove();
            }, 5000);
        }

        // Update dashboard with REAL data
        function updateDashboard(data) {
            if (!data || !data.success) {
                console.error('Invalid data received:', data);
                return;
            }
            
            // Update all dashboard values with REAL data
            document.getElementById('total-orders').textContent = data.totalOrders || 0;
            document.getElementById('total-revenue').textContent = '₹' + (data.totalRevenue || 0).toLocaleString('en-IN');
            document.getElementById('pending-orders').textContent = data.pendingOrders || 0;
            document.getElementById('processing-orders').textContent = data.processingOrders || 0;
            document.getElementById('completed-orders').textContent = data.completedOrders || 0;
            document.getElementById('cancelled-orders').textContent = data.cancelledOrders || 0;
            document.getElementById('cod-orders').textContent = data.codOrders || 0;
            document.getElementById('online-orders').textContent = data.onlineOrders || 0;
            
            console.log('Dashboard updated with REAL Magento data');
        }

        // Rest of the functions remain the same (displayComparison, formatDate, etc.)
        function displayComparison(current, previous, startDate, endDate, compareStartDate, compareEndDate) {
            const comparisonResults = document.getElementById('comparison-results');
            const comparisonContent = document.getElementById('comparison-content');
            const comparisonPeriodInfo = document.getElementById('comparison-period-info');

            const metrics = [
                { key: 'totalOrders', name: 'Total Orders' },
                { key: 'totalRevenue', name: 'Revenue', format: 'currency' },
                { key: 'pendingOrders', name: 'Pending Orders' },
                { key: 'processingOrders', name: 'Processing Orders' },
                { key: 'completedOrders', name: 'Completed Orders' },
                { key: 'cancelledOrders', name: 'Cancelled Orders' },
                { key: 'codOrders', name: 'COD Orders' },
                { key: 'onlineOrders', name: 'Online Orders' }
            ];

            comparisonPeriodInfo.innerHTML = `
                <h4 style="color: #ff69b4; margin-bottom: 15px; font-size: 1.2em;">📅 Comparison Periods</h4>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                    <div>
                        <strong style="color: #4CAF50;">Current Period:</strong><br>
                        <span style="color: #ccc;">${formatDate(startDate)} to ${formatDate(endDate)}</span>
                    </div>
                    <div>
                        <strong style="color: #FF9800;">Previous Period:</strong><br>
                        <span style="color: #ccc;">${formatDate(compareStartDate)} to ${formatDate(compareEndDate)}</span>
                    </div>
                </div>
            `;

            let comparisonHtml = '';

            metrics.forEach(metric => {
                const currentValue = current[metric.key] || 0;
                const previousValue = previous[metric.key] || 0;
                const difference = currentValue - previousValue;
                const percentChange = previousValue === 0 ? 0 : ((difference / previousValue) * 100);
                
                let changeClass = 'neutral';
                let changeIcon = '➡️';
                
                if (percentChange > 0) {
                    changeClass = 'positive';
                    changeIcon = '📈';
                } else if (percentChange < 0) {
                    changeClass = 'negative';
                    changeIcon = '📉';
                }

                const formattedCurrent = metric.format === 'currency' ? `₹${currentValue.toLocaleString('en-IN')}` : currentValue;
                const formattedPrevious = metric.format === 'currency' ? `₹${previousValue.toLocaleString('en-IN')}` : previousValue;
                const formattedDifference = metric.format === 'currency' ? `₹${Math.abs(difference).toLocaleString('en-IN')}` : Math.abs(difference);

                comparisonHtml += `
                    <div class="comparison-metric">
                        <div class="metric-name">${metric.name}</div>
                        <div class="metric-comparison">
                            <div class="metric-values">
                                <div><strong>Current:</strong> ${formattedCurrent}</div>
                                <div><strong>Previous:</strong> ${formattedPrevious}</div>
                            </div>
                            <div class="metric-change ${changeClass}">
                                ${changeIcon} ${percentChange.toFixed(1)}%<br>
                                <small>(${difference >= 0 ? '+' : '-'}${formattedDifference})</small>
                            </div>
                        </div>
                    </div>
                `;
            });

            comparisonContent.innerHTML = comparisonHtml;
            comparisonResults.classList.add('show');
        }

        function formatDate(dateStr) {
            const date = new Date(dateStr);
            return date.toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
        }

        // Date range functionality
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
        const weekAgoStr = weekAgo.toISOString().split('T')[0];

        function initializeDateInputs() {
            document.getElementById('start-date').value = todayStr;
            document.getElementById('end-date').value = todayStr;
            
            const yesterday = new Date(today.getTime() - 1 * 24 * 60 * 60 * 1000);
            document.getElementById('compare-start-date').value = yesterday.toISOString().split('T')[0];
            document.getElementById('compare-end-date').value = yesterday.toISOString().split('T')[0];
        }

        function initDashboard() {
            console.log('🚀 Initializing Dashboard with REAL Magento API...');
            resizeCanvas();
            createParticles();
            initializeDateInputs();
            animate();
            
            // Fetch REAL data immediately
            fetchRealMagentoData();
            
            // Update selected date display
            const selectedDate = document.getElementById('selected-date');
            selectedDate.textContent = `Real Data for ${formatDate(todayStr)}`;
        }

        // Event listeners
        window.addEventListener('resize', () => {
            resizeCanvas();
            createParticles();
            resizeAuthCanvas();
            createAuthParticles();
        });

        // Initialize - NO SESSION STORAGE CHECK
        resizeAuthCanvas();
        createAuthParticles();
        animateAuthParticles();
        
        console.log('Analytics Dashboard with REAL Magento API ready!');
    </script>
</body>
</html>
