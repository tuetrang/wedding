// --- LẮNG NGHE & CẬP NHẬT REALTIME (TICKER & LỜI CHÚC TRÔI VÒNG LẶP MƯỢT 100%) ---
let wishesQueue = [];
let tickerTimer = null;
let currentWishIndex = 0;

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

// Render danh sách lời chúc và xử lý cảm ứng nhấc tay trôi tiếp
function refreshWishesDOM() {
  const container = document.getElementById('infiniteWishesBox');
  if (!container) return;

  if (wishesQueue.length === 0) {
    container.innerHTML = '<div style="text-align:center; padding: 24px; color: var(--text-muted); font-size: 0.9rem; font-style: italic;">Chưa có lời chúc nào. Hãy là người đầu tiên gửi lời chúc phúc nhé!</div>';
    return;
  }

  const renderCardHTML = (w) => `
    <div class="wish-scroll-card">
      <div class="wish-card-header">
        <span class="wish-author-name">${escapeHTML(w.name)}</span>
        <span class="wish-time-stamp">${escapeHTML(w.time || '')}</span>
      </div>
      <div class="wish-message-body">${escapeHTML(w.message)}</div>
    </div>
  `;

  if (wishesQueue.length <= 2) {
    container.innerHTML = `<div class="marquee-static-track">${wishesQueue.map(renderCardHTML).join('')}</div>`;
    return;
  }

  const cardsHtml = wishesQueue.map(renderCardHTML).join('');
  const duration = Math.max(14, wishesQueue.length * 3.8);

  container.innerHTML = `
    <div class="marquee-wishes-wrapper">
      <div class="marquee-track" style="animation-duration: ${duration}s;">
        ${cardsHtml}
      </div>
      <div class="marquee-track" aria-hidden="true" style="animation-duration: ${duration}s;">
        ${cardsHtml}
      </div>
    </div>
  `;

  // GẮN SỰ KIỆN CHẠM TAY DỪNG - NHẤC TAY CHẠY TIẾP CHO IPHONE
  if (!container.dataset.touchBound) {
    container.dataset.touchBound = "1";

    container.addEventListener('touchstart', () => {
      container.classList.add('is-paused');
    }, { passive: true });

    container.addEventListener('touchend', () => {
      container.classList.remove('is-paused');
    }, { passive: true });

    container.addEventListener('touchcancel', () => {
      container.classList.remove('is-paused');
    }, { passive: true });
  }
}

// Lắng nghe sự kiện realtime từ Firebase
if (typeof wishesRef !== 'undefined' && wishesRef) {
  wishesRef.on('child_added', (snapshot) => {
    const item = snapshot.val();
    const key = snapshot.key;

    const exists = wishesQueue.some(w => w._key === key);
    if (!exists) {
      item._key = key;
      wishesQueue.unshift(item);
      refreshWishesDOM();
      startTickerLoop();
    }
  });
}