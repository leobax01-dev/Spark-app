window.onerror = function(msg, src, line, col, err) {
  document.body.style.cssText = 'background:#000;margin:0;padding:0';
  document.body.innerHTML = '<div style="color:#ff4444;padding:24px;font-family:monospace;font-size:12px;white-space:pre-wrap;line-height:1.6">'
    + '<strong style="font-size:15px">SPARK ERROR</strong>\n\n'
    + (msg || 'Unknown error') + '\n\n'
    + 'Line: ' + line + '  Col: ' + col + '\n\n'
    + (err && err.stack ? err.stack : 'No stack trace')
    + '</div>';
  return false;
};

window.onunhandledrejection = function(e) {
  document.body.style.cssText = 'background:#000;margin:0;padding:0';
  document.body.innerHTML = '<div style="color:#ff9944;padding:24px;font-family:monospace;font-size:12px;white-space:pre-wrap;line-height:1.6">'
    + '<strong style="font-size:15px">SPARK PROMISE ERROR</strong>\n\n'
    + (e.reason && e.reason.message ? e.reason.message : String(e.reason)) + '\n\n'
    + (e.reason && e.reason.stack ? e.reason.stack : 'No stack trace')
    + '</div>';
};

import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
