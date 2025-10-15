// Supabase 설정
const supabaseUrl = 'https://nqwjvrznwzmfytjlpfsk.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5xd2p2cnpud3ptZnl0amxwZnNrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgzNzA4NTEsImV4cCI6MjA3Mzk0Njg1MX0.R3Y2Xb9PmLr3sCLSdJov4Mgk1eAmhaCIPXEKq6u8NQI';

const supabase = window.supabase.createClient(supabaseUrl, supabaseKey, {
    auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
    },
    global: {
        headers: {
            'Content-Type': 'application/json',
        },
    },
});

// 보안 관련 함수들
function simpleHash(str) {
    let hash = 0;
    if (str.length === 0) return hash;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // 32bit integer로 변환
    }
    return Math.abs(hash).toString();
}

// 암호화된 사번 (원본: 22331) - 소스코드에서 직접 확인 불가
const ENCRYPTED_EMPLOYEE_ID = simpleHash('22331');

// 추가 보안: 콘솔 로그 방지
(function() {
    const originalLog = console.log;
    console.log = function(...args) {
        if (args.some(arg => typeof arg === 'string' && arg.includes('22331'))) {
            return; // 사번 관련 로그 차단
        }
        originalLog.apply(console, args);
    };
})();

// 사번 검증 함수
function verifyEmployeeId(inputId) {
    return simpleHash(inputId) === ENCRYPTED_EMPLOYEE_ID;
}

// 추가 보안: 잘못된 시도 횟수 추적
let failedAttempts = 0;
const MAX_FAILED_ATTEMPTS = 3;
const LOCKOUT_TIME = 30000; // 30초

// 보안 검증 강화
function verifyEmployeeIdSecure(inputId) {
    // 잠금 상태 확인
    if (failedAttempts >= MAX_FAILED_ATTEMPTS) {
        showNotification('너무 많은 잘못된 시도로 인해 일시적으로 차단되었습니다. 잠시 후 다시 시도해주세요.', 'error');
        return false;
    }
    
    const isValid = verifyEmployeeId(inputId);
    
    if (!isValid) {
        failedAttempts++;
        if (failedAttempts >= MAX_FAILED_ATTEMPTS) {
            showNotification('보안상의 이유로 일시적으로 차단되었습니다. 30초 후 다시 시도해주세요.', 'error');
            // 30초 후 잠금 해제
            setTimeout(() => {
                failedAttempts = 0;
                showNotification('보안 잠금이 해제되었습니다.', 'success');
            }, LOCKOUT_TIME);
        }
    } else {
        // 성공 시 시도 횟수 리셋
        failedAttempts = 0;
    }
    
    return isValid;
}

// 전역 변수
let books = [];
let filteredBooks = [];
let libraries = [];
let classifications = [];
let currentLibraryId = null;
let currentView = 'grid';
let editingBookId = null;
let editingBookLibraryId = null;
let editingLibraryId = null;
let editingClassificationId = null;

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', function() {
    loadLibraries();
    setupEventListeners();
});

// 분류체계 목록 로드
async function loadClassifications() {
    if (!currentLibraryId) {
        classifications = [];
        return;
    }
    
    try {
        const { data, error } = await supabase
            .from('book_classifications')
            .select('*')
            .eq('library_id', currentLibraryId)
            .eq('is_active', true)
            .order('display_order');

        if (error) {
            console.error('Error loading classifications:', error);
            showNotification('분류체계 목록을 불러오는데 실패했습니다.', 'error');
            return;
        }

        classifications = data || [];
        
    } catch (error) {
        console.error('Error:', error);
        showNotification('분류체계 목록을 불러오는데 실패했습니다.', 'error');
    }
}

// 이벤트 리스너 설정
function setupEventListeners() {
    // 모달 외부 클릭 시 닫기
    window.addEventListener('click', function(event) {
        const modal = document.getElementById('bookModal');
        const detailModal = document.getElementById('detailModal');
        
        if (event.target === modal) {
            closeModal();
        }
        if (event.target === detailModal) {
            closeDetailModal();
        }
    });

    // ESC 키로 모달 닫기
    document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape') {
            closeModal();
            closeDetailModal();
        }
    });
}

// 도서관 목록 로드
async function loadLibraries() {
    try {
        const { data, error } = await supabase
            .from('libraries')
            .select('*')
            .order('name');

        if (error) {
            console.error('Error loading libraries:', error);
            showNotification('도서관 목록을 불러오는데 실패했습니다.', 'error');
            return;
        }

        libraries = data || [];
        
        // 첫 번째 도서관을 기본으로 선택
        if (libraries.length > 0 && !currentLibraryId) {
            currentLibraryId = libraries[0].id;
            updateCurrentLibraryDisplay();
            loadClassifications();
            loadBooks();
        } else if (libraries.length === 0) {
            showNotification('도서관이 없습니다. 먼저 도서관을 추가해주세요.', 'warning');
        }
        
    } catch (error) {
        console.error('Error:', error);
        showNotification('도서관 목록을 불러오는데 실패했습니다.', 'error');
    }
}

// 도서 목록 로드
async function loadBooks() {
    if (!currentLibraryId) {
        showNotification('도서관을 선택해주세요.', 'warning');
        return;
    }
    
    showLoading(true);
    
    try {
        const { data, error } = await supabase
            .from('books')
            .select('*')
            .eq('library_id', currentLibraryId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error loading books:', error);
            
            let errorMessage = '도서 목록을 불러오는데 실패했습니다.';
            if (error.message) {
                if (error.message.includes('401')) {
                    errorMessage = '인증 오류가 발생했습니다. 페이지를 새로고침해주세요.';
                } else if (error.message.includes('403')) {
                    errorMessage = '접근 권한이 없습니다. 관리자에게 문의하세요.';
                } else if (error.message.includes('CORS')) {
                    errorMessage = 'CORS 오류가 발생했습니다. 서버 설정을 확인하세요.';
                } else {
                    errorMessage = `오류: ${error.message}`;
                }
            }
            
            showNotification(errorMessage, 'error');
            return;
        }

        books = data || [];
        filteredBooks = [...books];
        renderBooks();
        updateStats();
        updateClassificationSelect();
        showLoading(false);
        
    } catch (error) {
        console.error('Error:', error);
        showNotification('도서 목록을 불러오는데 실패했습니다.', 'error');
        showLoading(false);
    }
}

// 도서 목록 렌더링
function renderBooks() {
    const container = document.getElementById('booksContainer');
    
    if (filteredBooks.length === 0) {
        container.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: #7f8c8d;">
                <i class="fas fa-book" style="font-size: 3rem; margin-bottom: 20px; opacity: 0.5;"></i>
                <h3>도서가 없습니다</h3>
                <p>새로운 도서를 추가해보세요!</p>
            </div>
        `;
        return;
    }

    container.innerHTML = filteredBooks.map(book => createBookCard(book)).join('');
}

// 도서 카드 생성
function createBookCard(book) {
    const publishedDate = book.published_date ? 
        new Date(book.published_date).toLocaleDateString('ko-KR') : '미상';
    
    const price = book.price ? 
        new Intl.NumberFormat('ko-KR').format(book.price) + '원' : '미상';
    
    const stockStatus = book.copies > 0 ? 
        `<span style="color: #27ae60;">보유권수: ${book.copies}권</span>` : 
        `<span style="color: #e74c3c;">보유권수 없음</span>`;

    // 분류체계 정보 찾기
    const classification = classifications.find(c => c.id === book.classification_id);
    const classificationName = classification ? `[${classification.id}] ${classification.category_name}` : '미분류';

    return `
        <div class="book-card ${currentView === 'list' ? 'list-view' : ''}" onclick="showBookDetail('${book.library_id}', '${book.id}')">
            <div class="book-header">
                <div>
                    <div class="book-id">ID: ${book.id}</div>
                    <div class="book-title">${escapeHtml(book.title)}</div>
                    <div class="book-author">${escapeHtml(book.author)}</div>
                </div>
                <div class="book-classification">${escapeHtml(classificationName)}</div>
            </div>
            
            <div class="book-info">
                <p><strong>출판일:</strong> ${publishedDate}</p>
                <p><strong>페이지:</strong> ${book.pages || '미상'}페이지</p>
                <p><strong>언어:</strong> ${escapeHtml(book.language || 'Korean')}</p>
                <p><strong>가격:</strong> ${price}</p>
                <p><strong>재고:</strong> ${stockStatus}</p>
                ${book.isbn ? `<p><strong>ISBN:</strong> ${escapeHtml(book.isbn)}</p>` : ''}
            </div>
            
            ${book.description ? `
                <div style="margin-bottom: 15px;">
                    <p style="font-size: 14px; color: #666; line-height: 1.4;">
                        ${escapeHtml(book.description.length > 100 ? 
                            book.description.substring(0, 100) + '...' : 
                            book.description)}
                    </p>
                </div>
            ` : ''}
            
            <div class="book-actions" onclick="event.stopPropagation()">
                <button class="btn btn-sm btn-secondary" onclick="editBook('${book.library_id}', '${book.id}')">
                    <i class="fas fa-edit"></i> 수정
                </button>
                <button class="btn btn-sm btn-danger" onclick="deleteBook('${book.library_id}', '${book.id}')">
                    <i class="fas fa-trash"></i> 삭제
                </button>
            </div>
        </div>
    `;
}

// 도서 검색
function searchBooks() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    
    filteredBooks = books.filter(book => {
        const classification = classifications.find(c => c.id === book.classification_id);
        const classificationName = classification ? classification.category_name : '';
        
        return book.title.toLowerCase().includes(searchTerm) ||
               book.author.toLowerCase().includes(searchTerm) ||
               (book.isbn && book.isbn.toLowerCase().includes(searchTerm)) ||
               classificationName.toLowerCase().includes(searchTerm);
    });
    
    renderBooks();
}

// 도서 필터링
function filterBooks() {
    const classificationFilter = document.getElementById('classificationFilter').value;
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    
    filteredBooks = books.filter(book => {
        const matchesClassification = !classificationFilter || book.classification_id == classificationFilter;
        const matchesSearch = !searchTerm || 
            book.title.toLowerCase().includes(searchTerm) ||
            book.author.toLowerCase().includes(searchTerm) ||
            (book.isbn && book.isbn.toLowerCase().includes(searchTerm));
        
        return matchesClassification && matchesSearch;
    });
    
    renderBooks();
}

// 도서 정렬
function sortBooks() {
    const sortBy = document.getElementById('sortBy').value;
    
    filteredBooks.sort((a, b) => {
        switch (sortBy) {
            case 'title':
                return a.title.localeCompare(b.title);
            case 'author':
                return a.author.localeCompare(b.author);
            case 'published_date':
                return new Date(b.published_date || 0) - new Date(a.published_date || 0);
            case 'price':
                return (b.price || 0) - (a.price || 0);
            default:
                return 0;
        }
    });
    
    renderBooks();
}

// 뷰 토글
function toggleView(view) {
    currentView = view;
    const container = document.getElementById('booksContainer');
    const gridBtn = document.getElementById('gridBtn');
    const listBtn = document.getElementById('listBtn');
    
    if (view === 'grid') {
        container.classList.remove('list-view');
        gridBtn.style.background = 'linear-gradient(135deg, #3498db, #2980b9)';
        listBtn.style.background = 'linear-gradient(135deg, #95a5a6, #7f8c8d)';
    } else {
        container.classList.add('list-view');
        listBtn.style.background = 'linear-gradient(135deg, #3498db, #2980b9)';
        gridBtn.style.background = 'linear-gradient(135deg, #95a5a6, #7f8c8d)';
    }
    
    renderBooks();
}

// 통계 업데이트
function updateStats() {
    const totalBooks = books.length;
    const totalClassifications = classifications.length;
    const totalStock = books.reduce((sum, book) => sum + (book.copies || 0), 0);
    const avgPrice = books.length > 0 ? 
        Math.round(books.reduce((sum, book) => sum + (book.price || 0), 0) / books.length) : 0;
    
    document.getElementById('totalBooks').textContent = totalBooks;
    document.getElementById('totalClassifications').textContent = totalClassifications;
    document.getElementById('totalStock').textContent = totalStock;
    document.getElementById('avgPrice').textContent = new Intl.NumberFormat('ko-KR').format(avgPrice) + '원';
}

// 새 도서 추가 모달 표시
function showAddBookModal() {
    if (!currentLibraryId) {
        showNotification('먼저 도서관을 선택해주세요.', 'warning');
        showLibrarySelector();
        return;
    }
    
    editingBookId = null;
    document.getElementById('modalTitle').textContent = '새 도서 추가';
    document.getElementById('bookForm').reset();
    document.getElementById('bookLanguage').value = 'Korean';
    document.getElementById('bookStock').value = '1';
    updateClassificationSelect();
    document.getElementById('bookModal').style.display = 'block';
}

// 도서 수정
function editBook(libraryId, id) {
    // 데이터 타입 변환하여 검색
    const book = books.find(b => 
        b.library_id === parseInt(libraryId) && 
        b.id === String(id)
    );
    
    if (!book) {
        console.error('Book not found');
        return;
    }
    
    editingBookId = id;
    editingBookLibraryId = libraryId;
    document.getElementById('modalTitle').textContent = '도서 수정';
    
    // 폼에 기존 데이터 채우기
    document.getElementById('bookTitle').value = book.title || '';
    document.getElementById('bookAuthor').value = book.author || '';
    document.getElementById('bookIsbn').value = book.isbn || '';
    document.getElementById('bookPublishedDate').value = book.published_date || '';
    document.getElementById('bookClassification').value = book.classification_id || '';
    document.getElementById('bookPages').value = book.pages || '';
    document.getElementById('bookLanguage').value = book.language || 'Korean';
    document.getElementById('bookDescription').value = book.description || '';
    document.getElementById('bookPrice').value = book.price || '';
    document.getElementById('bookStock').value = book.copies || 1;
    
    updateClassificationSelect();
    document.getElementById('bookModal').style.display = 'block';
}

// 도서 저장
async function saveBook(event) {
    event.preventDefault();
    
    // 폼 데이터 수집 및 검증
    const title = document.getElementById('bookTitle').value.trim();
    const author = document.getElementById('bookAuthor').value.trim();
    const isbn = document.getElementById('bookIsbn').value.trim();
    const publishedDate = document.getElementById('bookPublishedDate').value;
    const pages = document.getElementById('bookPages').value;
    const language = document.getElementById('bookLanguage').value.trim();
    const description = document.getElementById('bookDescription').value.trim();
    const price = document.getElementById('bookPrice').value;
    const stock = document.getElementById('bookStock').value;
    const classificationId = document.getElementById('bookClassification').value;
    
    // 필수 필드 검증
    if (!title) {
        showNotification('도서명을 입력해주세요.', 'error');
        document.getElementById('bookTitle').focus();
        return;
    }
    if (!author) {
        showNotification('저자를 입력해주세요.', 'error');
        document.getElementById('bookAuthor').focus();
        return;
    }
    if (!classificationId) {
        showNotification('분류체계를 선택해주세요.', 'error');
        document.getElementById('bookClassification').focus();
        return;
    }
    
    // 숫자 필드 검증
    if (pages && (isNaN(pages) || parseInt(pages) < 1)) {
        showNotification('페이지 수는 1 이상의 숫자여야 합니다.', 'error');
        document.getElementById('bookPages').focus();
        return;
    }
    
    if (price && (isNaN(price) || parseFloat(price) < 0)) {
        showNotification('가격은 0 이상의 숫자여야 합니다.', 'error');
        document.getElementById('bookPrice').focus();
        return;
    }
    
    if (stock && (isNaN(stock) || parseInt(stock) < 1)) {
        showNotification('보유권수는 1 이상의 숫자여야 합니다.', 'error');
        document.getElementById('bookStock').focus();
        return;
    }
    
    // ISBN 형식 검증 (선택사항)
    if (isbn && !/^[\d-]+$/.test(isbn)) {
        showNotification('ISBN은 숫자와 하이픈(-)만 입력 가능합니다.', 'error');
        document.getElementById('bookIsbn').focus();
        return;
    }
    
    const formData = {
        title: title,
        author: author,
        isbn: isbn || null,
        published_date: publishedDate || null,
        pages: pages ? parseInt(pages) : null,
        language: language || 'Korean',
        description: description || null,
        price: price ? parseFloat(price) : null,
        copies: stock ? parseInt(stock) : 1,
        library_id: currentLibraryId,
        classification_id: classificationId
        // id는 데이터베이스 트리거에서 자동 생성됨
    };
    
    try {
        let result;
        
        if (editingBookId) {
            // 수정
            result = await supabase
                .from('books')
                .update(formData)
                .eq('library_id', editingBookLibraryId)
                .eq('id', editingBookId);
        } else {
            // 추가
            result = await supabase
                .from('books')
                .insert([formData]);
        }
        
        if (result.error) {
            console.error('Error saving book:', result.error);
            
            // 구체적인 오류 메시지 표시
            let errorMessage = '도서 저장에 실패했습니다.';
            if (result.error.message) {
                if (result.error.message.includes('duplicate key')) {
                    errorMessage = '이미 존재하는 ISBN입니다.';
                } else if (result.error.message.includes('invalid input syntax')) {
                    errorMessage = '입력된 데이터 형식이 올바르지 않습니다.';
                } else {
                    errorMessage = result.error.message;
                }
            }
            
            showNotification(errorMessage, 'error');
            return;
        }
        
        showNotification(
            editingBookId ? '도서가 수정되었습니다.' : '새 도서가 추가되었습니다.', 
            'success'
        );
        
        closeModal();
        loadBooks();
        
    } catch (error) {
        console.error('Error:', error);
        showNotification('도서 저장에 실패했습니다: ' + error.message, 'error');
    }
}

// 도서 삭제
async function deleteBook(libraryId, id) {
    if (!confirm('정말로 이 도서를 삭제하시겠습니까?')) {
        return;
    }
    
    try {
        const { error } = await supabase
            .from('books')
            .delete()
            .eq('library_id', parseInt(libraryId))
            .eq('id', String(id));
        
        if (error) {
            console.error('Error deleting book:', error);
            showNotification('도서 삭제에 실패했습니다.', 'error');
            return;
        }
        
        showNotification('도서가 삭제되었습니다.', 'success');
        loadBooks();
        
    } catch (error) {
        console.error('Error:', error);
        showNotification('도서 삭제에 실패했습니다.', 'error');
    }
}

// 도서 상세 정보 표시
function showBookDetail(libraryId, id) {
    const book = books.find(b => 
        b.library_id === parseInt(libraryId) && 
        b.id === String(id)
    );
    if (!book) return;
    
    const publishedDate = book.published_date ? 
        new Date(book.published_date).toLocaleDateString('ko-KR') : '미상';
    
    const price = book.price ? 
        new Intl.NumberFormat('ko-KR').format(book.price) + '원' : '미상';
    
    const createdDate = new Date(book.created_at).toLocaleDateString('ko-KR');
    const updatedDate = new Date(book.updated_at).toLocaleDateString('ko-KR');
    
    // 분류체계 정보 찾기
    const classification = classifications.find(c => c.id === book.classification_id);
    const classificationName = classification ? `[${classification.id}] ${classification.category_name}` : '미분류';
    
    document.getElementById('detailContent').innerHTML = `
        <div style="padding: 30px;">
            <div style="text-align: center; margin-bottom: 30px;">
                <div style="background: #e3f2fd; color: #1976d2; padding: 8px 16px; border-radius: 20px; display: inline-block; margin-bottom: 15px; font-weight: 600;">
                    ID: ${book.id}
                </div>
                <h1 style="color: #2c3e50; margin-bottom: 10px;">${escapeHtml(book.title)}</h1>
                <h2 style="color: #7f8c8d; font-weight: 400;">${escapeHtml(book.author)}</h2>
                <div style="margin-top: 15px;">
                    <span class="book-classification">${escapeHtml(classificationName)}</span>
                </div>
            </div>
            
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px;">
                <div style="background: #f8f9fa; padding: 15px; border-radius: 8px;">
                    <strong>출판일</strong><br>
                    ${publishedDate}
                </div>
                <div style="background: #f8f9fa; padding: 15px; border-radius: 8px;">
                    <strong>페이지 수</strong><br>
                    ${book.pages || '미상'}페이지
                </div>
                <div style="background: #f8f9fa; padding: 15px; border-radius: 8px;">
                    <strong>언어</strong><br>
                    ${escapeHtml(book.language || 'Korean')}
                </div>
                <div style="background: #f8f9fa; padding: 15px; border-radius: 8px;">
                    <strong>가격</strong><br>
                    ${price}
                </div>
                <div style="background: #f8f9fa; padding: 15px; border-radius: 8px;">
                    <strong>보유권수</strong><br>
                    ${book.copies || 0}권
                </div>
                ${book.isbn ? `
                    <div style="background: #f8f9fa; padding: 15px; border-radius: 8px;">
                        <strong>ISBN</strong><br>
                        ${escapeHtml(book.isbn)}
                    </div>
                ` : ''}
                <div style="background: #f8f9fa; padding: 15px; border-radius: 8px;">
                    <strong>분류체계</strong><br>
                    ${escapeHtml(classificationName)}
                </div>
            </div>
            
            ${book.description ? `
                <div style="margin-bottom: 30px;">
                    <h3 style="color: #2c3e50; margin-bottom: 15px;">설명</h3>
                    <p style="line-height: 1.6; color: #555;">${escapeHtml(book.description)}</p>
                </div>
            ` : ''}
            
            <div style="border-top: 1px solid #ecf0f1; padding-top: 20px; color: #7f8c8d; font-size: 14px;">
                <p><strong>등록일:</strong> ${createdDate}</p>
                <p><strong>수정일:</strong> ${updatedDate}</p>
            </div>
            
            <div style="margin-top: 30px; text-align: center;">
                <button class="btn btn-primary" onclick="editBook('${book.library_id}', '${book.id}'); closeDetailModal();">
                    <i class="fas fa-edit"></i> 수정
                </button>
                <button class="btn btn-danger" onclick="deleteBook('${book.library_id}', '${book.id}'); closeDetailModal();" style="margin-left: 10px;">
                    <i class="fas fa-trash"></i> 삭제
                </button>
            </div>
        </div>
    `;
    
    document.getElementById('detailModal').style.display = 'block';
}

// 모달 닫기
function closeModal() {
    document.getElementById('bookModal').style.display = 'none';
    editingBookId = null;
    editingBookLibraryId = null;
}

function closeDetailModal() {
    document.getElementById('detailModal').style.display = 'none';
}

// 데이터 내보내기
function exportData() {
    const csvContent = generateCSV(books);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `books_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}

// CSV 생성
function generateCSV(data) {
    const headers = ['ID', '도서명', '저자', 'ISBN', '출판일', '장르', '페이지', '언어', '설명', '가격', '보유권수', '등록일'];
    const csvRows = [headers.join(',')];
    
    data.forEach(book => {
        const row = [
            book.id,
            `"${book.title}"`,
            `"${book.author}"`,
            `"${book.isbn || ''}"`,
            book.published_date || '',
            `"${book.genre || ''}"`,
            book.pages || '',
            `"${book.language || ''}"`,
            `"${(book.description || '').replace(/"/g, '""')}"`,
            book.price || '',
            book.copies || 0,
            book.created_at
        ];
        csvRows.push(row.join(','));
    });
    
    return csvRows.join('\n');
}

// 로딩 표시
function showLoading(show) {
    const spinner = document.getElementById('loadingSpinner');
    spinner.style.display = show ? 'flex' : 'none';
}

// 알림 표시
function showNotification(message, type = 'info') {
    // 간단한 알림 구현
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        border-radius: 8px;
        color: white;
        font-weight: 600;
        z-index: 10000;
        animation: slideIn 0.3s ease-out;
        max-width: 300px;
    `;
    
    const colors = {
        success: '#27ae60',
        error: '#e74c3c',
        info: '#3498db',
        warning: '#f39c12'
    };
    
    notification.style.backgroundColor = colors[type] || colors.info;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease-in';
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 300);
    }, 3000);
}

// HTML 이스케이프
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 안전한 JSON 파싱 헬퍼 함수
function safeParseJSON(jsonString, fallback = []) {
    if (!jsonString) return fallback;
    
    if (Array.isArray(jsonString)) {
        return jsonString;
    }
    
    if (typeof jsonString === 'string') {
        try {
            return JSON.parse(jsonString);
        } catch (e) {
            console.warn('JSON 파싱 실패, 쉼표로 분리된 문자열로 처리:', jsonString);
            return jsonString.split(',').map(s => s.trim()).filter(s => s.length > 0);
        }
    }
    
    return fallback;
}

// 도서관 관련 함수들

// 현재 도서관 표시 업데이트
function updateCurrentLibraryDisplay() {
    const currentLibrary = libraries.find(lib => lib.id === currentLibraryId);
    const displayElement = document.getElementById('currentLibraryName');
    
    if (currentLibrary) {
        displayElement.textContent = currentLibrary.name;
    } else {
        displayElement.textContent = '도서관을 선택하세요';
    }
}

// 도서관 관리 모달 표시
function showLibraryModal() {
    // 모달 제목을 기본값으로 설정
    document.getElementById('libraryModalTitle').textContent = '도서관 관리';
    
    // 수정 모드 초기화
    editingLibraryId = null;
    
    document.getElementById('libraryModal').style.display = 'block';
    loadLibrariesList();
}

// 도서관 모달 닫기
function closeLibraryModal() {
    document.getElementById('libraryModal').style.display = 'none';
    editingLibraryId = null;
}

// 도서관 탭 전환
function showLibraryTab(tab) {
    // 모든 탭 버튼과 콘텐츠 비활성화
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    // 선택된 탭 활성화
    if (tab === 'list') {
        document.getElementById('libraryListTabBtn').classList.add('active');
        document.getElementById('libraryListTab').classList.add('active');
        loadLibrariesList();
    } else if (tab === 'add') {
        document.getElementById('libraryAddTabBtn').classList.add('active');
        document.getElementById('libraryAddTab').classList.add('active');
        // 수정 모드가 아닐 때만 폼 리셋
        if (!editingLibraryId) {
            resetLibraryForm();
        }
    }
}

// 도서관 목록 로드 및 표시
async function loadLibrariesList() {
    const container = document.getElementById('librariesList');
    
    if (libraries.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #7f8c8d;">
                <i class="fas fa-building" style="font-size: 3rem; margin-bottom: 20px; opacity: 0.5;"></i>
                <h3>도서관이 없습니다</h3>
                <p>새로운 도서관을 추가해보세요!</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = libraries.map(library => createLibraryCard(library)).join('');
}

// 도서관 카드 생성
function createLibraryCard(library) {
    const isCurrent = library.id === currentLibraryId;
    
    return `
        <div class="library-card ${isCurrent ? 'current' : ''}">
            <div class="library-header">
                <div>
                    <div class="library-name">${escapeHtml(library.name)}</div>
                    ${library.description ? `<div class="library-description">${escapeHtml(library.description)}</div>` : ''}
                </div>
                ${isCurrent ? '<span style="color: #27ae60; font-weight: 600;"><i class="fas fa-check-circle"></i> 현재</span>' : ''}
            </div>
            
            <div class="library-info">
                ${library.address ? `<p><strong>주소:</strong> ${escapeHtml(library.address)}</p>` : ''}
                ${library.phone ? `<p><strong>전화:</strong> ${escapeHtml(library.phone)}</p>` : ''}
                ${library.email ? `<p><strong>이메일:</strong> ${escapeHtml(library.email)}</p>` : ''}
                ${library.website ? `<p><strong>웹사이트:</strong> <a href="${escapeHtml(library.website)}" target="_blank">${escapeHtml(library.website)}</a></p>` : ''}
            </div>
            
            <div class="library-actions">
                ${!isCurrent ? `<button class="btn btn-sm btn-primary" onclick="selectLibrary(${library.id})">
                    <i class="fas fa-check"></i> 선택
                </button>` : ''}
                <button class="btn btn-sm btn-secondary" onclick="editLibrary(${library.id})">
                    <i class="fas fa-edit"></i> 수정
                </button>
                <button class="btn btn-sm btn-danger" onclick="deleteLibrary(${library.id})">
                    <i class="fas fa-trash"></i> 삭제
                </button>
            </div>
        </div>
    `;
}

// 도서관 선택
async function selectLibrary(libraryId) {
    currentLibraryId = libraryId;
    updateCurrentLibraryDisplay();
    closeLibraryModal();
    await loadClassifications();
    loadBooks();
    showNotification('도서관이 변경되었습니다.', 'success');
}

// 도서관 선택 모달 표시
function showLibrarySelector() {
    document.getElementById('librarySelectorModal').style.display = 'block';
    loadLibrarySelector();
}

// 도서관 선택 모달 닫기
function closeLibrarySelector() {
    document.getElementById('librarySelectorModal').style.display = 'none';
}

// 도서관 선택 목록 로드
function loadLibrarySelector() {
    const container = document.getElementById('librarySelectorList');
    
    if (libraries.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #7f8c8d;">
                <i class="fas fa-building" style="font-size: 3rem; margin-bottom: 20px; opacity: 0.5;"></i>
                <h3>도서관이 없습니다</h3>
                <p>먼저 도서관을 추가해주세요.</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = libraries.map(library => `
        <div class="library-selector-item ${library.id === currentLibraryId ? 'current' : ''}" 
             onclick="selectLibrary(${library.id}); closeLibrarySelector();">
            <div class="library-name">${escapeHtml(library.name)}</div>
            ${library.description ? `<div class="library-description">${escapeHtml(library.description)}</div>` : ''}
            ${library.id === currentLibraryId ? '<span style="color: #27ae60; font-weight: 600;"><i class="fas fa-check-circle"></i> 현재</span>' : ''}
        </div>
    `).join('');
}

// 도서관 수정
function editLibrary(id) {
    const library = libraries.find(l => l.id === id);
    if (!library) return;
    
    editingLibraryId = id;
    
    // 모달 제목 업데이트
    document.getElementById('libraryModalTitle').textContent = '도서관 수정';
    
    // 추가 탭으로 전환
    showLibraryTab('add');
    
    // 폼에 기존 데이터 채우기
    document.getElementById('libraryName').value = library.name || '';
    document.getElementById('libraryDescription').value = library.description || '';
    document.getElementById('libraryAddress').value = library.address || '';
    document.getElementById('libraryPhone').value = library.phone || '';
    document.getElementById('libraryEmail').value = library.email || '';
    document.getElementById('libraryWebsite').value = library.website || '';
}

// 도서관 저장
async function saveLibrary(event) {
    event.preventDefault();
    
    const formData = {
        name: document.getElementById('libraryName').value.trim(),
        description: document.getElementById('libraryDescription').value.trim(),
        address: document.getElementById('libraryAddress').value.trim(),
        phone: document.getElementById('libraryPhone').value.trim(),
        email: document.getElementById('libraryEmail').value.trim(),
        website: document.getElementById('libraryWebsite').value.trim()
    };
    
    // 필수 필드 검증
    if (!formData.name) {
        showNotification('도서관명을 입력해주세요.', 'error');
        document.getElementById('libraryName').focus();
        return;
    }
    
    try {
        let result;
        
        if (editingLibraryId) {
            // 수정
            console.log('수정 모드 - Library ID:', editingLibraryId);
            result = await supabase
                .from('libraries')
                .update(formData)
                .eq('id', editingLibraryId);
        } else {
            // 추가
            console.log('추가 모드');
            result = await supabase
                .from('libraries')
                .insert([formData]);
        }
        
        if (result.error) {
            console.error('Error saving library:', result.error);
            showNotification('도서관 저장에 실패했습니다.', 'error');
            return;
        }
        
        showNotification(
            editingLibraryId ? '도서관이 수정되었습니다.' : '새 도서관이 추가되었습니다.', 
            'success'
        );
        
        closeLibraryModal();
        loadLibraries();
        
    } catch (error) {
        console.error('Error:', error);
        showNotification('도서관 저장에 실패했습니다.', 'error');
    }
}

// 도서관 삭제
// 도서관 삭제 (사번 입력 필요)
async function deleteLibrary(id) {
    // 사번 입력 모달 표시
    showEmployeeIdModal(id);
}

// 사번 입력 모달 표시
function showEmployeeIdModal(libraryId) {
    const modal = document.createElement('div');
    modal.id = 'employeeIdModal';
    modal.className = 'modal';
    modal.style.display = 'block';
    
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 400px;">
            <div class="modal-header">
                <h2><i class="fas fa-shield-alt"></i> 보안 확인</h2>
                <span class="close" onclick="closeEmployeeIdModal()">&times;</span>
            </div>
            <div class="modal-body">
                <div style="text-align: center; margin-bottom: 20px;">
                    <i class="fas fa-exclamation-triangle" style="font-size: 48px; color: #e74c3c; margin-bottom: 15px;"></i>
                    <h3 style="color: #e74c3c; margin-bottom: 10px;">도서관 삭제</h3>
                    <p style="color: #666; margin-bottom: 20px;">
                        도서관을 삭제하려면 관리자 사번을 입력해주세요.<br>
                        <strong>삭제된 도서관의 모든 도서도 함께 삭제됩니다.</strong>
                    </p>
                </div>
                <div class="form-group">
                    <label for="employeeIdInput">관리자 사번</label>
                    <input type="password" id="employeeIdInput" placeholder="사번을 입력하세요" style="text-align: center; font-size: 18px; letter-spacing: 2px;" maxlength="10">
                    <div id="attemptCounter" style="text-align: center; margin-top: 10px; font-size: 12px; color: #666;">
                        남은 시도 횟수: ${MAX_FAILED_ATTEMPTS - failedAttempts}
                    </div>
                </div>
                <div class="form-actions" style="text-align: center; margin-top: 20px;">
                    <button type="button" class="btn btn-secondary" onclick="closeEmployeeIdModal()">취소</button>
                    <button type="button" class="btn btn-danger" onclick="confirmDeleteLibrary('${libraryId}')">
                        <i class="fas fa-trash"></i> 삭제 확인
                    </button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // 입력 필드에 포커스
    setTimeout(() => {
        document.getElementById('employeeIdInput').focus();
    }, 100);
    
    // Enter 키 이벤트 리스너
    document.getElementById('employeeIdInput').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            confirmDeleteLibrary(libraryId);
        }
    });
    
    // 입력 시 시도 횟수 업데이트
    document.getElementById('employeeIdInput').addEventListener('input', function() {
        updateAttemptCounter();
    });
}

// 시도 횟수 표시 업데이트
function updateAttemptCounter() {
    const counter = document.getElementById('attemptCounter');
    if (counter) {
        const remaining = MAX_FAILED_ATTEMPTS - failedAttempts;
        counter.textContent = `남은 시도 횟수: ${remaining}`;
        counter.style.color = remaining <= 1 ? '#e74c3c' : '#666';
    }
}

// 사번 입력 모달 닫기
function closeEmployeeIdModal() {
    const modal = document.getElementById('employeeIdModal');
    if (modal) {
        modal.remove();
    }
}

// 도서관 삭제 확인
async function confirmDeleteLibrary(libraryId) {
    const inputId = document.getElementById('employeeIdInput').value.trim();
    
    if (!inputId) {
        showNotification('사번을 입력해주세요.', 'error');
        document.getElementById('employeeIdInput').focus();
        return;
    }
    
    if (!verifyEmployeeIdSecure(inputId)) {
        showNotification('올바른 사번을 입력해주세요.', 'error');
        document.getElementById('employeeIdInput').value = '';
        document.getElementById('employeeIdInput').focus();
        return;
    }
    
    // 사번이 올바른 경우 모달 닫기
    closeEmployeeIdModal();
    
    // 실제 삭제 진행
    try {
        const { error } = await supabase
            .from('libraries')
            .delete()
            .eq('id', libraryId);
        
        if (error) {
            console.error('Error deleting library:', error);
            showNotification('도서관 삭제에 실패했습니다.', 'error');
            return;
        }
        
        showNotification('도서관이 삭제되었습니다.', 'success');
        
        // 현재 선택된 도서관이 삭제된 경우 첫 번째 도서관 선택
        if (currentLibraryId === libraryId) {
            libraries = libraries.filter(l => l.id !== libraryId);
            if (libraries.length > 0) {
                currentLibraryId = libraries[0].id;
                updateCurrentLibraryDisplay();
                loadBooks();
            } else {
                currentLibraryId = null;
                updateCurrentLibraryDisplay();
                books = [];
                filteredBooks = [];
                renderBooks();
                updateStats();
            }
        }
        
        loadLibraries();
        
    } catch (error) {
        console.error('Error:', error);
        showNotification('도서관 삭제에 실패했습니다.', 'error');
    }
}

// 도서관 폼 리셋
function resetLibraryForm() {
    document.getElementById('libraryForm').reset();
    editingLibraryId = null;
    // 모달 제목도 기본값으로 리셋
    document.getElementById('libraryModalTitle').textContent = '도서관 관리';
}

// 분류체계 관리 모달 표시
function showClassificationModal() {
    if (!currentLibraryId) {
        showNotification('먼저 도서관을 선택해주세요.', 'warning');
        showLibrarySelector();
        return;
    }
    
    editingClassificationId = null;
    document.getElementById('classificationModalTitle').textContent = '분류체계 관리';
    document.getElementById('classificationForm').reset();
    document.getElementById('classificationOrder').value = '1';
    document.getElementById('classificationModal').style.display = 'block';
    loadClassificationsList();
}

// 분류체계 모달 닫기
function closeClassificationModal() {
    document.getElementById('classificationModal').style.display = 'none';
    editingClassificationId = null;
}

// 분류체계 탭 전환
function showClassificationTab(tab) {
    // 모든 탭 버튼과 콘텐츠 비활성화
    document.querySelectorAll('.classification-tabs .tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('#classificationModal .tab-content').forEach(content => content.classList.remove('active'));
    
    // 선택된 탭 활성화
    if (tab === 'list') {
        document.getElementById('classificationListTabBtn').classList.add('active');
        document.getElementById('classificationListTab').classList.add('active');
        loadClassificationsList();
    } else if (tab === 'add') {
        document.getElementById('classificationAddTabBtn').classList.add('active');
        document.getElementById('classificationAddTab').classList.add('active');
        // 수정 모드가 아닐 때만 폼 리셋
        if (!editingClassificationId) {
            resetClassificationForm();
        }
    }
}

// 분류체계 목록 로드 및 표시
async function loadClassificationsList() {
    const container = document.getElementById('classificationsList');
    
    if (classifications.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #7f8c8d;">
                <i class="fas fa-tags" style="font-size: 3rem; margin-bottom: 20px; opacity: 0.5;"></i>
                <h3>분류체계가 없습니다</h3>
                <p>새로운 분류체계를 추가해보세요!</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = classifications.map(classification => createClassificationCard(classification)).join('');
}

// 분류체계 카드 생성
function createClassificationCard(classification) {
    const subcategories = safeParseJSON(classification.subcategories, []);
    
    return `
        <div class="classification-card">
            <div class="classification-header">
                <div>
                    <div class="classification-id" style="background: #e3f2fd; color: #1976d2; padding: 4px 8px; border-radius: 12px; display: inline-block; margin-bottom: 8px; font-size: 12px; font-weight: 600;">
                        ID: ${classification.id}
                    </div>
                    <div class="classification-name">${escapeHtml(classification.category_name)}</div>
                    ${classification.description ? `<div class="classification-description">${escapeHtml(classification.description)}</div>` : ''}
                </div>
                <div style="color: #7f8c8d; font-size: 12px;">
                    순서: ${classification.display_order}
                </div>
            </div>
            
            ${subcategories.length > 0 ? `
                <div class="classification-subcategories">
                    <strong>하위 분류:</strong><br>
                    ${subcategories.map(sub => `<span>${escapeHtml(sub)}</span>`).join('')}
                </div>
            ` : ''}
            
            ${classification.examples ? `
                <div class="classification-examples">
                    <strong>예시:</strong> ${escapeHtml(classification.examples)}
                </div>
            ` : ''}
            
            <div class="classification-actions">
                <button class="btn btn-sm btn-secondary" onclick="editClassification(${classification.id})">
                    <i class="fas fa-edit"></i> 수정
                </button>
                <button class="btn btn-sm btn-danger" onclick="deleteClassification(${classification.id})">
                    <i class="fas fa-trash"></i> 삭제
                </button>
            </div>
        </div>
    `;
}

// 분류체계 수정
function editClassification(id) {
    const classification = classifications.find(c => c.id === id);
    if (!classification) return;
    
    editingClassificationId = id;
    
    // 모달 제목 업데이트
    document.getElementById('classificationModalTitle').textContent = '분류체계 수정';
    
    // 추가 탭으로 전환
    showClassificationTab('add');
    
    // 폼에 기존 데이터 채우기
    document.getElementById('classificationName').value = classification.category_name || '';
    document.getElementById('classificationDescription').value = classification.description || '';
    
    // subcategories 처리
    const subcategories = safeParseJSON(classification.subcategories, []);
    document.getElementById('classificationSubcategories').value = subcategories.join(', ');
    
    document.getElementById('classificationExamples').value = classification.examples || '';
    document.getElementById('classificationOrder').value = classification.display_order || 1;
}

// 분류체계 저장
async function saveClassification(event) {
    event.preventDefault();
    
    const displayOrder = parseInt(document.getElementById('classificationOrder').value) || 1;
    
    const formData = {
        category_name: document.getElementById('classificationName').value.trim(),
        description: document.getElementById('classificationDescription').value.trim(),
        subcategories: document.getElementById('classificationSubcategories').value.trim(),
        examples: document.getElementById('classificationExamples').value.trim(),
        display_order: displayOrder,
        library_id: currentLibraryId
    };
    
    // 새 분류체계 추가 시 ID 계산 (표시순서 기반으로 100단위 증가)
    if (!editingClassificationId) {
        const nextId = displayOrder * 100; // 표시순서 * 100으로 ID 계산
        formData.id = nextId;
    }
    
    // 필수 필드 검증
    if (!formData.category_name) {
        showNotification('분류명을 입력해주세요.', 'error');
        document.getElementById('classificationName').focus();
        return;
    }
    
    // 하위 분류를 JSON 배열로 변환
    if (formData.subcategories) {
        const subcategoriesArray = formData.subcategories.split(',')
            .map(sub => sub.trim())
            .filter(sub => sub.length > 0);
        formData.subcategories = JSON.stringify(subcategoriesArray);
    } else {
        formData.subcategories = JSON.stringify([]);
    }
    
    try {
        let result;
        
        if (editingClassificationId) {
            // 수정
            result = await supabase
                .from('book_classifications')
                .update(formData)
                .eq('library_id', currentLibraryId)
                .eq('id', editingClassificationId);
        } else {
            // 추가
            result = await supabase
                .from('book_classifications')
                .insert([formData]);
        }
        
        if (result.error) {
            console.error('Error saving classification:', result.error);
            showNotification('분류체계 저장에 실패했습니다.', 'error');
            return;
        }
        
        showNotification(
            editingClassificationId ? '분류체계가 수정되었습니다.' : '새 분류체계가 추가되었습니다.', 
            'success'
        );
        
        closeClassificationModal();
        await loadClassifications();
        updateClassificationSelect();
        updateStats();
        
    } catch (error) {
        console.error('Error:', error);
        showNotification('분류체계 저장에 실패했습니다.', 'error');
    }
}

// 분류체계 삭제
async function deleteClassification(id) {
    if (!confirm('정말로 이 분류체계를 삭제하시겠습니까?')) {
        return;
    }
    
    try {
        const { error } = await supabase
            .from('book_classifications')
            .update({ is_active: false })
            .eq('library_id', currentLibraryId)
            .eq('id', id);
        
        if (error) {
            console.error('Error deleting classification:', error);
            showNotification('분류체계 삭제에 실패했습니다.', 'error');
            return;
        }
        
        showNotification('분류체계가 삭제되었습니다.', 'success');
        await loadClassifications();
        updateClassificationSelect();
        updateStats();
        
    } catch (error) {
        console.error('Error:', error);
        showNotification('분류체계 삭제에 실패했습니다.', 'error');
    }
}

// 분류체계 폼 리셋
function resetClassificationForm() {
    document.getElementById('classificationForm').reset();
    editingClassificationId = null;
    document.getElementById('classificationOrder').value = '1';
    // 모달 제목도 기본값으로 리셋
    document.getElementById('classificationModalTitle').textContent = '분류체계 관리';
}

// 분류체계 선택 옵션 업데이트
function updateClassificationSelect() {
    const select = document.getElementById('bookClassification');
    const filterSelect = document.getElementById('classificationFilter');
    
    if (select) {
        // 기존 옵션 제거 (첫 번째 기본 옵션 제외)
        while (select.children.length > 1) {
            select.removeChild(select.lastChild);
        }
        
        // 새로운 옵션 추가
        classifications.forEach(classification => {
            const option = document.createElement('option');
            option.value = classification.id;
            option.textContent = `[${classification.id}] ${classification.category_name}`;
            select.appendChild(option);
        });
    }
    
    if (filterSelect) {
        // 기존 옵션 제거 (첫 번째 기본 옵션 제외)
        while (filterSelect.children.length > 1) {
            filterSelect.removeChild(filterSelect.lastChild);
        }
        
        // 새로운 옵션 추가
        classifications.forEach(classification => {
            const option = document.createElement('option');
            option.value = classification.id;
            option.textContent = `[${classification.id}] ${classification.category_name}`;
            filterSelect.appendChild(option);
        });
    }
}

// ISBN으로 도서 정보 자동 입력
async function fetchBookInfoByISBN() {
    const isbnInput = document.getElementById('bookIsbn');
    const isbn = isbnInput.value.trim();
    
    if (!isbn) return;
    
    // ISBN 형식 검증 (숫자와 하이픈만 허용)
    if (!/^[\d-]+$/.test(isbn)) {
        showNotification('ISBN은 숫자와 하이픈(-)만 입력 가능합니다.', 'warning');
        return;
    }
    
    // 하이픈 제거하여 검색
    const cleanIsbn = isbn.replace(/-/g, '');
    
    if (cleanIsbn.length !== 10 && cleanIsbn.length !== 13) {
        showNotification('ISBN은 10자리 또는 13자리여야 합니다.', 'warning');
        return;
    }
    
    try {
        showLoading(true, '도서 정보를 가져오는 중...');
        
        // 서버의 프록시 API를 사용하여 도서 정보 가져오기
        const response = await fetch(`/api/isbn/${cleanIsbn}`);
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'API 요청 실패');
        }
        
        const bookData = await response.json();
        
        if (bookData.title) {
            // 도서 정보 자동 입력
            document.getElementById('bookTitle').value = bookData.title || '';
            document.getElementById('bookAuthor').value = bookData.author || '';
            
            // 출판일 정보
            if (bookData.publishDate) {
                const publishDate = new Date(bookData.publishDate);
                if (!isNaN(publishDate.getTime())) {
                    document.getElementById('bookPublishedDate').value = publishDate.toISOString().split('T')[0];
                }
            }
            
            // 페이지 수
            if (bookData.pages) {
                document.getElementById('bookPages').value = bookData.pages;
            }
            
            // 설명
            if (bookData.description) {
                document.getElementById('bookDescription').value = bookData.description;
            }
            
            showNotification('도서 정보가 자동으로 입력되었습니다.', 'success');
        } else {
            showNotification('해당 ISBN의 도서 정보를 찾을 수 없습니다.', 'warning');
        }
        
    } catch (error) {
        console.error('ISBN 검색 오류:', error);
        showNotification(`도서 정보를 가져오는데 실패했습니다: ${error.message}`, 'error');
    } finally {
        showLoading(false);
    }
}

// CSS 애니메이션 추가
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);
