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

// ISBN 검색 API - 순수 더미 데이터만 사용
app.get('/api/isbn/:isbn', (req, res) => {
    const { isbn } = req.params;
    
    console.log(`ISBN 요청: ${isbn}`);
    
    // ISBN 형식 검증 (더 관대한 패턴)
    if (!/^[\d\-]+$/.test(isbn)) {
        console.log(`잘못된 ISBN 형식: ${isbn}`);
        return res.status(400).json({ error: 'Invalid ISBN format' });
    }
    
    const cleanIsbn = isbn.replace(/-/g, '');
    
    if (cleanIsbn.length !== 10 && cleanIsbn.length !== 13) {
        console.log(`잘못된 ISBN 길이: ${cleanIsbn.length}`);
        return res.status(400).json({ error: 'ISBN must be 10 or 13 digits' });
    }
    
    // 더미 도서 데이터
    const dummyBooks = {
        '9788960543386': {
            title: '김승옥 단편선',
            author: '김승옥',
            publishDate: '2018-01-01',
            pages: '320',
            description: '한국 문학의 거장 김승옥의 대표 단편소설들을 엮은 작품집입니다. 현대 한국 사회의 모순과 갈등을 날카롭게 그려낸 작품들로 구성되어 있습니다.'
        },
        '9788936434267': {
            title: '도스토예프스키 단편선',
            author: '표도르 도스토예프스키',
            publishDate: '2019-03-15',
            pages: '450',
            description: '러시아 문학의 거장 도스토예프스키의 대표 단편소설들을 엮은 작품집입니다. 인간의 내면과 사회적 모순을 깊이 있게 탐구한 작품들입니다.'
        },
        '9780134685991': {
            title: 'Effective TypeScript',
            author: 'Dan Vanderkam',
            publishDate: '2019-10-01',
            pages: '400',
            description: 'TypeScript를 효과적으로 사용하는 방법을 알려주는 실용적인 가이드입니다. 고급 타입스크립트 기법과 모범 사례를 다룹니다.'
        },
        '9788965746663': {
            title: 'Supabase 실전 가이드',
            author: '김개발',
            publishDate: '2023-06-01',
            pages: '280',
            description: 'Supabase를 활용한 풀스택 웹 애플리케이션 개발 가이드입니다. 실무에서 바로 사용할 수 있는 예제와 팁을 제공합니다.'
        },
        '9788965746664': {
            title: 'GitHub 활용서',
            author: '이코딩',
            publishDate: '2023-08-15',
            pages: '350',
            description: 'GitHub를 활용한 협업 개발과 프로젝트 관리에 대한 종합적인 가이드입니다. 팀 개발에 필요한 모든 기능을 다룹니다.'
        }
    };
    
    // 더미 데이터에서 검색
    if (dummyBooks[cleanIsbn]) {
        console.log(`ISBN ${cleanIsbn}: 더미 데이터 반환`);
        res.json(dummyBooks[cleanIsbn]);
    } else {
        // 더미 데이터에 없는 경우 기본 응답
        console.log(`ISBN ${cleanIsbn}: 더미 데이터에 없음`);
        res.json({
            title: `도서 ${cleanIsbn}`,
            author: '미상',
            publishDate: '',
            pages: '',
            description: '더미 데이터에 없는 ISBN입니다. 수동으로 입력해주세요.'
        });
    }
});

// 파일 최종 수정 시간 API
app.get('/api/last-modified', (req, res) => {
    try {
        const files = [
            'index.html',
            'script.js', 
            'styles.css',
            'server.js',
            '사용법.md'
        ];
        
        let latestFile = null;
        let latestTime = 0;
        
        files.forEach(fileName => {
            const filePath = path.join(__dirname, fileName);
            if (fs.existsSync(filePath)) {
                const stats = fs.statSync(filePath);
                if (stats.mtime.getTime() > latestTime) {
                    latestTime = stats.mtime.getTime();
                    latestFile = fileName;
                }
            }
        });
        
        if (latestFile) {
            const date = new Date(latestTime);
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const hours = String(date.getHours()).padStart(2, '0');
            const minutes = String(date.getMinutes()).padStart(2, '0');
            const seconds = String(date.getSeconds()).padStart(2, '0');
            
            const formattedTime = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
            
            res.json({
                lastModified: formattedTime,
                fileName: latestFile,
                timestamp: latestTime
            });
        } else {
            res.json({
                lastModified: '알 수 없음',
                fileName: 'none',
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
