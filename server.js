const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();

// JSON 파싱 미들웨어
app.use(express.json());

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

// 파일 최종 수정 시간 API - index.html 파일만 확인
app.get('/api/last-modified', (req, res) => {
    try {
        const fileName = 'index.html';
        const filePath = path.join(__dirname, fileName);
        
        if (fs.existsSync(filePath)) {
            const stats = fs.statSync(filePath);
            const date = new Date(stats.mtime);
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const hours = String(date.getHours()).padStart(2, '0');
            const minutes = String(date.getMinutes()).padStart(2, '0');
            const seconds = String(date.getSeconds()).padStart(2, '0');
            
            const formattedTime = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
            
            res.json({
                lastModified: formattedTime,
                fileName: fileName,
                timestamp: stats.mtime.getTime()
            });
        } else {
            res.json({
                lastModified: '알 수 없음',
                fileName: 'index.html',
                timestamp: 0
            });
        }
    } catch (error) {
        console.error('Error getting last modified time:', error);
        res.status(500).json({ error: 'Failed to get last modified time' });
    }
});

// 정적 파일 서빙
app.use(express.static(path.join(__dirname)));

// 모든 경로를 index.html로 리다이렉트 (SPA 지원)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// 서버 시작
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`개인문고관리 시스템이 포트 ${PORT}에서 실행 중입니다.`);
    console.log(`http://localhost:${PORT}에서 접속하세요.`);
});
