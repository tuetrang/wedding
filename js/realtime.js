// --- LẮNG NGHE & CẬP NHẬT REALTIME (TICKER & LỜI CHÚC CUỘN VÔ TẬN) ---
let wishesQueue = [];
let tickerTimer = null;
let currentWishIndex = 0;
let isLoopBound = false;

function escapeHTML(str) {
  if (!str) return '';
  return String(str).replace(/[&<>'"]/g, 
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  );
}

function renderTicker(item) {
  const box = document.getElementById('tickerContentBox');
  if (!box || !item) return;
  box.textContent = '';
  const div = document.createElement('div');
  div.className = 'ticker-slide-item';
  const strong = document.createElement('strong');
  strong.textContent = `${item.name}: `;
  div.appendChild(strong);
  div.appendChild(document.createTextNode(item.message));
  box.appendChild(div);
}

function startTickerLoop() {
  if (wishesQueue.length === 0) return;
  if (tickerTimer) clearInterval(tickerTimer);
  renderTicker(wishesQueue[0]);
  tickerTimer = setInterval(() => {
    currentWishIndex = (currentWishIndex + 1) % wishesQueue.length;
    renderTicker(wishesQueue[currentWishIndex]);
  }, 4000);
}

// Hàm render toàn bộ danh sách lời chúc kèm cơ chế Infinite Loop Scroll
function refreshWishesDOM() {
  const container = document.getElementById('infiniteWishesBox');
  if (!container) return;

  if (wishesQueue.length === 0) {
    container.innerHTML = '<div style="text-align:center; padding: 24px; color: var(--text-muted); font-size: 0.9rem; font-style: italic;">Chưa có lời chúc nào. Hãy là người đầu tiên gửi lời chúc phúc nhé!</div>';
    return;
  }

  // Tạo HTML cho từng lời chúc
  const renderCardHTML = (w, idxKey) => `
    <div class="wish-scroll-card" data-key="${idxKey}">
      <div class="wish-card-header">
        <span class="wish-author-name">${escapeHTML(w.name)}</span>
        <span class="wish-time-stamp">${escapeHTML(w.time || '')}</span>
      </div>
      <div class="wish-message-body">${escapeHTML(w.message)}</div>
    </div>
  `;

  // Nếu có từ 3 lời chúc trở lên: Nhân đôi danh sách để tạo chu kỳ vòng tròn vô tận (5, 4, 3, 2, 1 -> 5, 4, 3, 2, 1)
  let renderList = wishesQueue;
  if (wishesQueue.length >= 3) {
    renderList = [...wishesQueue, ...wishesQueue];
  }

  container.innerHTML = renderList.map((item, idx) => renderCardHTML(item, idx)).join('');

  // Cơ chế Infinite Scroll: Khi người dùng cuộn đến đáy chu kỳ 1, tự động lùi cuộn mượt mà không khựng
  if (wishesQueue.length >= 3 && !isLoopBound) {
    isLoopBound = true;
    container.addEventListener('scroll', () => {
      const halfHeight = container.scrollHeight / 2;
      if (container.scrollTop >= halfHeight) {
        container.scrollTop -= halfHeight;
      } else if (container.scrollTop <= 0) {
        container.scrollTop += halfHeight;
      }
    });
  }
}

// Lắng nghe sự kiện realtime onChildAdded từ Firebase
if (typeof wishesRef !== 'undefined' && wishesRef) {
  wishesRef.on('child_added', (snapshot) => {
    const item = snapshot.val();
    const key = snapshot.key;

    // Kiểm tra chống trùng lặp dữ liệu
    const exists = wishesQueue.some(w => w._key === key);
    if (!exists) {
      item._key = key;
      // Đưa lời chúc mới nhất lên đầu danh sách
      wishesQueue.unshift(item);
      refreshWishesDOM();
      startTickerLoop();
    }
  });
}