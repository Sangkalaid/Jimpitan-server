const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.png':'image/png','.ico':'image/x-icon','.woff2':'font/woff2'};
const server = http.createServer((req,res)=>{
  const requested = decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  const file = path.resolve(root, '.'+(requested==='/'?'/index.html':requested));
  if(!file.startsWith(root+path.sep) || /(?:^|[\\/])(?:\.git|\.env|node_modules|supabase|tests)(?:[\\/]|$)/.test(file.slice(root.length))) { res.writeHead(403); return res.end(); }
  fs.readFile(file,(err,data)=>{res.writeHead(err?404:200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'}); res.end(err?'Not found':data);});
});
server.listen(Number(process.env.PORT)||8088,'127.0.0.1',()=>console.log('Ronda: http://127.0.0.1:'+server.address().port));
