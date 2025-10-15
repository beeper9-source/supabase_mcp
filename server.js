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

// ISBN 검색 API 프록시 (외부 API 사용)
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
    
    // 국립중앙도서관 API 시도
    const nlApiUrl = `https://www.nl.go.kr/NL/search/openApi/search.do?key=test&detailSearch=true&isbn=${cleanIsbn}&format=json`;
    
    https.get(nlApiUrl, (response) => {
        let data = '';
        
        response.on('data', (chunk) => {
            data += chunk;
        });
        
        response.on('end', () => {
            try {
                const nlData = JSON.parse(data);
                
                if (nlData && nlData.result && nlData.result.length > 0) {
                    const book = nlData.result[0];
                    
                    const result = {
                        title: book.title || '',
                        author: book.author || '',
                        publishDate: book.pub_date || '',
                        pages: book.page || '',
                        description: book.description || ''
                    };
                    
                    return res.json(result);
                }
                
                // 국립중앙도서관에서 찾지 못한 경우 Open Library 시도
                tryOpenLibrary(cleanIsbn, res);
                
            } catch (error) {
                console.log('NL API parse error:', error.message);
                // 국립중앙도서관 실패 시 Open Library 시도
                tryOpenLibrary(cleanIsbn, res);
            }
        });
        
    }).on('error', (error) => {
        console.log('NL API error:', error.message);
        // 국립중앙도서관 실패 시 Open Library 시도
        tryOpenLibrary(cleanIsbn, res);
    });
});

// Open Library API 시도 함수
function tryOpenLibrary(isbn, res) {
    const url = `https://openlibrary.org/isbn/${isbn}.json`;
    
    https.get(url, (response) => {
        let data = '';
        
        response.on('data', (chunk) => {
            data += chunk;
        });
        
        response.on('end', async () => {
            try {
                const bookData = JSON.parse(data);
                
                if (!bookData.title) {
                    return res.status(404).json({ error: 'Book not found in any API' });
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
                console.error('Open Library JSON parse error:', error);
                res.status(500).json({ error: 'Failed to parse book data' });
            }
        });
        
    }).on('error', (error) => {
        console.error('Open Library API error:', error);
        res.status(500).json({ error: 'All book APIs failed' });
    });
}

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
