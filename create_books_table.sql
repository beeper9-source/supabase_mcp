-- Aqua 데이터베이스에서 books 테이블 생성
-- 이 스크립트는 Aqua 데이터베이스에서 실행하여 books 테이블을 생성합니다.

CREATE TABLE IF NOT EXISTS books (
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
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 인덱스 생성 (검색 성능 향상)
CREATE INDEX IF NOT EXISTS idx_books_title ON books(title);
CREATE INDEX IF NOT EXISTS idx_books_author ON books(author);
CREATE INDEX IF NOT EXISTS idx_books_genre ON books(genre);
CREATE INDEX IF NOT EXISTS idx_books_isbn ON books(isbn);

-- 업데이트 시간 자동 갱신을 위한 트리거 함수
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- updated_at 컬럼 자동 업데이트 트리거
CREATE TRIGGER update_books_updated_at 
    BEFORE UPDATE ON books 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- 샘플 데이터 삽입 (선택사항)
INSERT INTO books (title, author, isbn, published_date, genre, pages, language, description, price, stock_quantity) VALUES
('해리 포터와 마법사의 돌', 'J.K. 롤링', '978-89-349-1234-5', '1997-06-26', '판타지', 223, 'Korean', '마법사 소년 해리 포터의 첫 번째 모험', 15000.00, 10),
('1984', '조지 오웰', '978-89-349-5678-9', '1949-06-08', '디스토피아', 328, 'Korean', '빅 브라더가 지배하는 미래 사회', 12000.00, 5),
('토지', '박경리', '978-89-349-9012-3', '1969-01-01', '소설', 5000, 'Korean', '한국 현대사의 거대한 서사시', 25000.00, 3);

-- 테이블 생성 확인
SELECT 'books 테이블이 성공적으로 생성되었습니다!' as message;
SELECT COUNT(*) as total_books FROM books;

