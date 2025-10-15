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

// ISBN 검색 API 프록시 (하이브리드: 외부 API + 내장 더미 데이터)
app.get('/api/isbn/:isbn', (req, res) => {
    const { isbn } = req.params;
    let responseSent = false;
    
    // 응답 전송 함수 (중복 전송 방지)
    const sendResponse = (data, statusCode = 200) => {
        if (!responseSent) {
            responseSent = true;
            if (statusCode === 200) {
                res.json(data);
            } else {
                res.status(statusCode).json(data);
            }
        }
    };
    
    // ISBN 형식 검증 (더 관대한 패턴)
    if (!/^[\d\-]+$/.test(isbn)) {
        return sendResponse({ error: 'Invalid ISBN format' }, 400);
    }
    
    const cleanIsbn = isbn.replace(/-/g, '');
    
    if (cleanIsbn.length !== 10 && cleanIsbn.length !== 13) {
        return sendResponse({ error: 'ISBN must be 10 or 13 digits' }, 400);
    }
    
    // 내장 더미 데이터 (백업용)
    const fallbackBooks = {
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
    
    // 외부 API 시도 (타임아웃 설정)
    const timeout = 2000; // 2초 타임아웃 (더 빠른 응답)
    
    // 국립중앙도서관 API 시도
    const nlApiUrl = `https://www.nl.go.kr/NL/search/openApi/search.do?key=test&detailSearch=true&isbn=${cleanIsbn}&format=json`;
    
    const nlRequest = https.get(nlApiUrl, { timeout }, (response) => {
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
                    
                    console.log(`ISBN ${cleanIsbn}: 국립중앙도서관 API 성공`);
                    return sendResponse(result);
                }
                
                // 국립중앙도서관에서 찾지 못한 경우 Open Library 시도
                tryOpenLibrary(cleanIsbn, sendResponse, fallbackBooks);
                
            } catch (error) {
                console.log('NL API parse error:', error.message);
                // 국립중앙도서관 실패 시 Open Library 시도
                tryOpenLibrary(cleanIsbn, sendResponse, fallbackBooks);
            }
        });
        
    });
    
    nlRequest.on('error', (error) => {
        console.log('NL API error:', error.message);
        // 국립중앙도서관 실패 시 Open Library 시도
        tryOpenLibrary(cleanIsbn, sendResponse, fallbackBooks);
    });
    
    nlRequest.on('timeout', () => {
        console.log('NL API timeout');
        nlRequest.destroy();
        tryOpenLibrary(cleanIsbn, sendResponse, fallbackBooks);
    });
});

// Open Library API 시도 함수
function tryOpenLibrary(isbn, sendResponse, fallbackBooks) {
    const url = `https://openlibrary.org/isbn/${isbn}.json`;
    const timeout = 2000; // 2초 타임아웃
    
    const olRequest = https.get(url, { timeout }, (response) => {
        let data = '';
        
        response.on('data', (chunk) => {
            data += chunk;
        });
        
        response.on('end', async () => {
            try {
                const bookData = JSON.parse(data);
                
                if (!bookData.title) {
                    // Open Library에서도 찾지 못한 경우 더미 데이터 시도
                    return tryFallbackData(isbn, sendResponse, fallbackBooks);
                }
                
                // 저자 정보 가져오기 (간소화)
                let authorName = '';
                if (bookData.authors && bookData.authors.length > 0) {
                    try {
                        const authorUrl = `https://openlibrary.org${bookData.authors[0].key}.json`;
                        const authorData = await new Promise((resolve, reject) => {
                            const authorRequest = https.get(authorUrl, { timeout: 1500 }, (authorResponse) => {
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
                            });
                            authorRequest.on('error', reject);
                            authorRequest.on('timeout', () => {
                                authorRequest.destroy();
                                reject(new Error('Author API timeout'));
                            });
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
                
                console.log(`ISBN ${isbn}: Open Library API 성공`);
                sendResponse(result);
                
            } catch (error) {
                console.error('Open Library JSON parse error:', error);
                // 파싱 실패 시 더미 데이터 시도
                tryFallbackData(isbn, sendResponse, fallbackBooks);
            }
        });
        
    });
    
    olRequest.on('error', (error) => {
        console.error('Open Library API error:', error.message);
        // API 실패 시 더미 데이터 시도
        tryFallbackData(isbn, sendResponse, fallbackBooks);
    });
    
    olRequest.on('timeout', () => {
        console.log('Open Library API timeout');
        olRequest.destroy();
        tryFallbackData(isbn, sendResponse, fallbackBooks);
    });
}

// 더미 데이터 시도 함수
function tryFallbackData(isbn, sendResponse, fallbackBooks) {
    if (fallbackBooks[isbn]) {
        console.log(`ISBN ${isbn}: 더미 데이터 사용`);
        sendResponse(fallbackBooks[isbn]);
    } else {
        console.log(`ISBN ${isbn}: 모든 소스에서 찾을 수 없음`);
        sendResponse({ 
            error: 'Book not found',
            message: '해당 ISBN의 도서 정보를 찾을 수 없습니다. 수동으로 입력해주세요.'
        }, 404);
    }
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
