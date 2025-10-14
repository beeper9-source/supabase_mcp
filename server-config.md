# 서버 배포를 위한 설정 파일

## CORS 설정 (Apache .htaccess)
<IfModule mod_headers.c>
    Header always set Access-Control-Allow-Origin "*"
    Header always set Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS"
    Header always set Access-Control-Allow-Headers "Content-Type, Authorization, X-Requested-With"
    Header always set Access-Control-Max-Age "3600"
</IfModule>

<IfModule mod_rewrite.c>
    RewriteEngine On
    RewriteCond %{REQUEST_METHOD} OPTIONS
    RewriteRule ^(.*)$ $1 [R=200,L]
</IfModule>

## Nginx 설정
# server {
#     add_header Access-Control-Allow-Origin "*" always;
#     add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS" always;
#     add_header Access-Control-Allow-Headers "Content-Type, Authorization, X-Requested-With" always;
#     add_header Access-Control-Max-Age "3600" always;
#     
#     if ($request_method = 'OPTIONS') {
#         return 204;
#     }
# }

## Node.js Express 서버 설정
const express = require('express');
const path = require('path');
const app = express();

// CORS 설정
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    
    if (req.method === 'OPTIONS') {
        res.sendStatus(200);
    } else {
        next();
    }
});

// 정적 파일 서빙
app.use(express.static(path.join(__dirname)));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
