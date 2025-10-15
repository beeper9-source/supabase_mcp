const express = require('express');
const path = require('path');
const https = require('https');
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

// ISBN 검색 API 프록시
app.get('/api/isbn/:isbn', (req, res) => {
    const { isbn } = req.params;
    
    // ISBN 형식 검증
    if (!/^[\d-]+$/.test(isbn)) {
        return res.status(400).json({ error: 'Invalid ISBN format' });
    }
    
    const cleanIsbn = isbn.replace(/-/g, '');
    
    if (cleanIsbn.length !== 10 && cleanIsbn.length !== 13) {
        return res.status(400).json({ error: 'ISBN must be 10 or 13 digits' });
    }
    
    // Open Library API 호출
    const url = `https://openlibrary.org/isbn/${cleanIsbn}.json`;
    
    https.get(url, (response) => {
        let data = '';
        
        response.on('data', (chunk) => {
            data += chunk;
        });
        
        response.on('end', async () => {
            try {
                const bookData = JSON.parse(data);
                
                if (!bookData.title) {
                    return res.status(404).json({ error: 'Book not found' });
                }
                
                // 저자 정보 가져오기
                let authorName = '';
                if (bookData.authors && bookData.authors.length > 0) {
                    try {
                        const authorUrl = `https://openlibrary.org${bookData.authors[0].key}.json`;
                        const authorData = await new Promise((resolve, reject) => {
                            https.get(authorUrl, (authorResponse) => {
                                let authorData = '';
                                authorResponse.on('data', (chunk) => {
                                    authorData += chunk;
                                });
                                authorResponse.on('end', () => {
                                    try {
                                        resolve(JSON.parse(authorData));
                                    } catch (error) {
                                        reject(error);
                                    }
                                });
                            }).on('error', reject);
                        });
                        authorName = authorData.name || '';
                    } catch (error) {
                        console.log('Author fetch failed:', error.message);
                    }
                }
                
                // 응답 데이터 구성
                const result = {
                    title: bookData.title || '',
                    author: authorName,
                    publishDate: bookData.publish_date || '',
                    pages: bookData.number_of_pages || '',
                    description: ''
                };
                
                // 설명 처리
                if (bookData.description) {
                    if (typeof bookData.description === 'string') {
                        result.description = bookData.description;
                    } else if (bookData.description.value) {
                        result.description = bookData.description.value;
                    }
                }
                
                res.json(result);
                
            } catch (error) {
                console.error('JSON parse error:', error);
                res.status(500).json({ error: 'Internal server error' });
            }
        });
        
    }).on('error', (error) => {
        console.error('ISBN search error:', error);
        res.status(500).json({ error: 'Internal server error' });
    });
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
