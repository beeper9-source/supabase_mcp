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

// 모든 경로를 index.html로 리다이렉트 (SPA 지원)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`도서관리 시스템이 포트 ${PORT}에서 실행 중입니다.`);
    console.log(`http://localhost:${PORT}에서 접속하세요.`);
});
