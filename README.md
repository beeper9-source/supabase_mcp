# 📚 도서관리 시스템

Supabase를 활용한 현대적인 웹 기반 도서관리 시스템입니다.

## ✨ 주요 기능

### 🏢 다중 도서관 관리
- **도서관 추가/수정/삭제**: 여러 도서관을 독립적으로 관리
- **도서관 선택**: 현재 작업할 도서관을 쉽게 전환
- **도서관별 도서 관리**: 각 도서관마다 독립적인 도서 목록
- **도서관 정보 관리**: 주소, 전화번호, 이메일, 웹사이트 등 상세 정보

### 📖 도서 관리
- **도서 추가/수정/삭제**: 완전한 CRUD 기능
- **도서 검색**: 제목, 저자, 장르, ISBN으로 검색
- **도서 필터링**: 장르별 필터링
- **도서 정렬**: 제목, 저자, 출판일, 가격순 정렬
- **뷰 전환**: 그리드 뷰와 리스트 뷰

### 📊 대시보드
- **통계 정보**: 총 도서 수, 장르 수, 총 재고, 평균 가격
- **실시간 업데이트**: 데이터 변경 시 자동 업데이트
- **도서관별 통계**: 선택된 도서관의 도서 현황

### 💾 데이터 관리
- **CSV 내보내기**: 도서 목록을 CSV 파일로 내보내기
- **실시간 동기화**: Supabase와 실시간 데이터 동기화
- **데이터 분리**: 도서관별 독립적인 데이터 관리

### 🎨 사용자 인터페이스
- **반응형 디자인**: 모바일, 태블릿, 데스크톱 지원
- **모던 UI**: 글래스모피즘 디자인과 부드러운 애니메이션
- **직관적 UX**: 사용하기 쉬운 인터페이스
- **탭 기반 관리**: 도서관 목록과 추가 기능을 탭으로 구분

## 🚀 시작하기

### 1. 프로젝트 설정

```bash
# 프로젝트 디렉토리로 이동
cd supabase_mcp

# 파일 구조 확인
ls -la
```

### 2. Supabase 설정

1. Supabase 프로젝트 대시보드에 접속
2. Settings → API에서 다음 정보를 확인:
   - Project URL
   - anon public key

3. `script.js` 파일에서 Supabase 설정 업데이트:
```javascript
const supabaseUrl = 'YOUR_SUPABASE_URL';
const supabaseKey = 'YOUR_SUPABASE_ANON_KEY';
```

### 3. 웹 서버 실행

#### 로컬 개발용 (Python)
```bash
python -m http.server 8000
```

#### 프로덕션 서버용 (Node.js + Express)
```bash
# Express 서버 실행 (CORS 설정 포함)
npm start

# 또는 직접 실행
node server.js
```

#### 개발용 서버
```bash
npm run dev
```

### 4. 브라우저에서 접속

- **로컬 개발**: `http://localhost:8000`
- **프로덕션 서버**: `http://localhost:3000`

## 📁 프로젝트 구조

```
supabase_mcp/
├── index.html          # 메인 HTML 파일
├── styles.css          # CSS 스타일시트
├── script.js           # JavaScript 로직
├── README.md           # 프로젝트 문서
└── .cursor/
    └── mcp.json        # MCP 설정 파일
```

## 🛠️ 기술 스택

- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Backend**: Supabase (PostgreSQL)
- **Styling**: CSS Grid, Flexbox, CSS Variables
- **Icons**: Font Awesome
- **Database**: PostgreSQL (Supabase)

## 📋 데이터베이스 스키마

### libraries 테이블
```sql
CREATE TABLE libraries (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    address TEXT,
    phone VARCHAR(50),
    email VARCHAR(255),
    website VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### books 테이블
```sql
CREATE TABLE books (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    author VARCHAR(255) NOT NULL,
    isbn VARCHAR(20) UNIQUE,
    published_date DATE,
    genre VARCHAR(100),
    pages INTEGER,
    language VARCHAR(50) DEFAULT 'Korean',
    description TEXT,
    price DECIMAL(10,2),
    stock_quantity INTEGER DEFAULT 0,
    library_id INTEGER REFERENCES libraries(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## 🎯 사용법

### 도서관 관리
1. **도서관 추가**: "도서관 관리" 버튼 → "새 도서관 추가" 탭
2. **도서관 선택**: 상단의 현재 도서관 영역에서 "변경" 버튼 클릭
3. **도서관 수정/삭제**: "도서관 관리" → "도서관 목록" 탭에서 관리

### 도서 관리
1. **도서 추가**: 도서관 선택 후 "새 도서 추가" 버튼 클릭
2. **도서 검색**: 상단 검색창에 키워드 입력 (제목, 저자, 장르, ISBN)
3. **도서 수정/삭제**: 도서 카드의 "수정" 또는 "삭제" 버튼 클릭
4. **도서 필터링**: 장르별 필터링 및 정렬 옵션 사용

### 데이터 관리
1. **데이터 내보내기**: "데이터 내보내기" 버튼으로 CSV 다운로드
2. **통계 확인**: 대시보드에서 도서관별 통계 정보 확인
3. **뷰 전환**: 그리드 뷰와 리스트 뷰 간 전환

## 🔧 커스터마이징

### 색상 테마 변경
`styles.css`에서 CSS 변수를 수정:

```css
:root {
    --primary-color: #3498db;
    --secondary-color: #2c3e50;
    --success-color: #27ae60;
    --danger-color: #e74c3c;
}
```

### 새로운 장르 추가
1. `index.html`의 장르 선택 옵션에 추가
2. `script.js`의 필터 옵션에 추가

## 🚀 서버 배포

### Heroku 배포
```bash
# Heroku CLI 설치 후
heroku create your-app-name
git push heroku main
```

### Vercel 배포
```bash
# Vercel CLI 설치 후
vercel --prod
```

### Netlify 배포
1. Netlify에 프로젝트 업로드
2. 빌드 명령어: `npm start`
3. 배포 완료

### Docker 배포
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

## 🐛 문제 해결

### 401 Unauthorized 오류
1. **RLS 정책 확인**: Supabase에서 Row Level Security가 올바르게 설정되었는지 확인
2. **API 키 확인**: 올바른 anon key가 사용되고 있는지 확인
3. **CORS 설정**: 서버에서 CORS 헤더가 올바르게 설정되었는지 확인

### Supabase 연결 오류
1. URL과 API 키가 올바른지 확인
2. Supabase 프로젝트가 활성화되어 있는지 확인
3. 브라우저 콘솔에서 오류 메시지 확인

### 데이터가 표시되지 않음
1. Supabase 테이블에 데이터가 있는지 확인
2. RLS (Row Level Security) 설정 확인
3. 네트워크 연결 상태 확인

### 서버 배포 오류
1. **CORS 오류**: Express 서버 사용 (`npm start`)
2. **포트 오류**: 환경 변수 PORT 설정 확인
3. **의존성 오류**: `npm install` 실행

## 📝 라이선스

이 프로젝트는 MIT 라이선스 하에 배포됩니다.

## 🤝 기여하기

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📞 지원

문제가 발생하거나 질문이 있으시면 이슈를 생성해주세요.

---

**즐거운 도서 관리 되세요! 📚✨**
