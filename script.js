// Supabase 설정
const supabaseUrl = 'https://nqwjvrznwzmfytjlpfsk.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5xd2p2cnpud3ptZnl0amxwZnNrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzE0MjQ4MDAsImV4cCI6MjA0NzAwMDgwMH0.example';

const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

// 전역 변수
let books = [];
let filteredBooks = [];
let currentView = 'grid';
let editingBookId = null;

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', function() {
    loadBooks();
    setupEventListeners();
});

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

// 도서 목록 로드
async function loadBooks() {
    showLoading(true);
    
    try {
        const { data, error } = await supabase
            .from('books')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error loading books:', error);
            showNotification('도서 목록을 불러오는데 실패했습니다.', 'error');
            return;
        }

        books = data || [];
        filteredBooks = [...books];
        renderBooks();
        updateStats();
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
    
    const stockStatus = book.stock_quantity > 0 ? 
        `<span style="color: #27ae60;">재고: ${book.stock_quantity}권</span>` : 
        `<span style="color: #e74c3c;">품절</span>`;

    return `
        <div class="book-card ${currentView === 'list' ? 'list-view' : ''}" onclick="showBookDetail(${book.id})">
            <div class="book-header">
                <div>
                    <div class="book-title">${escapeHtml(book.title)}</div>
                    <div class="book-author">${escapeHtml(book.author)}</div>
                </div>
                <div class="book-genre">${escapeHtml(book.genre || '미분류')}</div>
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
                <button class="btn btn-sm btn-secondary" onclick="editBook(${book.id})">
                    <i class="fas fa-edit"></i> 수정
                </button>
                <button class="btn btn-sm btn-danger" onclick="deleteBook(${book.id})">
                    <i class="fas fa-trash"></i> 삭제
                </button>
            </div>
        </div>
    `;
}

// 도서 검색
function searchBooks() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    
    filteredBooks = books.filter(book => 
        book.title.toLowerCase().includes(searchTerm) ||
        book.author.toLowerCase().includes(searchTerm) ||
        (book.genre && book.genre.toLowerCase().includes(searchTerm)) ||
        (book.isbn && book.isbn.toLowerCase().includes(searchTerm))
    );
    
    renderBooks();
}

// 도서 필터링
function filterBooks() {
    const genreFilter = document.getElementById('genreFilter').value;
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    
    filteredBooks = books.filter(book => {
        const matchesGenre = !genreFilter || book.genre === genreFilter;
        const matchesSearch = !searchTerm || 
            book.title.toLowerCase().includes(searchTerm) ||
            book.author.toLowerCase().includes(searchTerm) ||
            (book.genre && book.genre.toLowerCase().includes(searchTerm)) ||
            (book.isbn && book.isbn.toLowerCase().includes(searchTerm));
        
        return matchesGenre && matchesSearch;
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
    const totalGenres = new Set(books.map(book => book.genre).filter(Boolean)).size;
    const totalStock = books.reduce((sum, book) => sum + (book.stock_quantity || 0), 0);
    const avgPrice = books.length > 0 ? 
        Math.round(books.reduce((sum, book) => sum + (book.price || 0), 0) / books.length) : 0;
    
    document.getElementById('totalBooks').textContent = totalBooks;
    document.getElementById('totalGenres').textContent = totalGenres;
    document.getElementById('totalStock').textContent = totalStock;
    document.getElementById('avgPrice').textContent = new Intl.NumberFormat('ko-KR').format(avgPrice) + '원';
}

// 새 도서 추가 모달 표시
function showAddBookModal() {
    editingBookId = null;
    document.getElementById('modalTitle').textContent = '새 도서 추가';
    document.getElementById('bookForm').reset();
    document.getElementById('bookLanguage').value = 'Korean';
    document.getElementById('bookStock').value = '0';
    document.getElementById('bookModal').style.display = 'block';
}

// 도서 수정
function editBook(id) {
    const book = books.find(b => b.id === id);
    if (!book) return;
    
    editingBookId = id;
    document.getElementById('modalTitle').textContent = '도서 수정';
    
    // 폼에 기존 데이터 채우기
    document.getElementById('bookTitle').value = book.title || '';
    document.getElementById('bookAuthor').value = book.author || '';
    document.getElementById('bookIsbn').value = book.isbn || '';
    document.getElementById('bookPublishedDate').value = book.published_date || '';
    document.getElementById('bookGenre').value = book.genre || '';
    document.getElementById('bookPages').value = book.pages || '';
    document.getElementById('bookLanguage').value = book.language || 'Korean';
    document.getElementById('bookDescription').value = book.description || '';
    document.getElementById('bookPrice').value = book.price || '';
    document.getElementById('bookStock').value = book.stock_quantity || 0;
    
    document.getElementById('bookModal').style.display = 'block';
}

// 도서 저장
async function saveBook(event) {
    event.preventDefault();
    
    const formData = {
        title: document.getElementById('bookTitle').value.trim(),
        author: document.getElementById('bookAuthor').value.trim(),
        isbn: document.getElementById('bookIsbn').value.trim(),
        published_date: document.getElementById('bookPublishedDate').value,
        genre: document.getElementById('bookGenre').value,
        pages: parseInt(document.getElementById('bookPages').value) || null,
        language: document.getElementById('bookLanguage').value.trim(),
        description: document.getElementById('bookDescription').value.trim(),
        price: parseFloat(document.getElementById('bookPrice').value) || null,
        stock_quantity: parseInt(document.getElementById('bookStock').value) || 0
    };
    
    try {
        let result;
        
        if (editingBookId) {
            // 수정
            result = await supabase
                .from('books')
                .update(formData)
                .eq('id', editingBookId);
        } else {
            // 추가
            result = await supabase
                .from('books')
                .insert([formData]);
        }
        
        if (result.error) {
            console.error('Error saving book:', result.error);
            showNotification('도서 저장에 실패했습니다.', 'error');
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
        showNotification('도서 저장에 실패했습니다.', 'error');
    }
}

// 도서 삭제
async function deleteBook(id) {
    if (!confirm('정말로 이 도서를 삭제하시겠습니까?')) {
        return;
    }
    
    try {
        const { error } = await supabase
            .from('books')
            .delete()
            .eq('id', id);
        
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
function showBookDetail(id) {
    const book = books.find(b => b.id === id);
    if (!book) return;
    
    const publishedDate = book.published_date ? 
        new Date(book.published_date).toLocaleDateString('ko-KR') : '미상';
    
    const price = book.price ? 
        new Intl.NumberFormat('ko-KR').format(book.price) + '원' : '미상';
    
    const createdDate = new Date(book.created_at).toLocaleDateString('ko-KR');
    const updatedDate = new Date(book.updated_at).toLocaleDateString('ko-KR');
    
    document.getElementById('detailContent').innerHTML = `
        <div style="padding: 30px;">
            <div style="text-align: center; margin-bottom: 30px;">
                <h1 style="color: #2c3e50; margin-bottom: 10px;">${escapeHtml(book.title)}</h1>
                <h2 style="color: #7f8c8d; font-weight: 400;">${escapeHtml(book.author)}</h2>
                <div style="margin-top: 15px;">
                    <span class="book-genre">${escapeHtml(book.genre || '미분류')}</span>
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
                    <strong>재고</strong><br>
                    ${book.stock_quantity || 0}권
                </div>
                ${book.isbn ? `
                    <div style="background: #f8f9fa; padding: 15px; border-radius: 8px;">
                        <strong>ISBN</strong><br>
                        ${escapeHtml(book.isbn)}
                    </div>
                ` : ''}
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
                <button class="btn btn-primary" onclick="editBook(${book.id}); closeDetailModal();">
                    <i class="fas fa-edit"></i> 수정
                </button>
                <button class="btn btn-danger" onclick="deleteBook(${book.id}); closeDetailModal();" style="margin-left: 10px;">
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
    const headers = ['ID', '도서명', '저자', 'ISBN', '출판일', '장르', '페이지', '언어', '설명', '가격', '재고', '등록일'];
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
            book.stock_quantity || 0,
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
