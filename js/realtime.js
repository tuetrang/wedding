// --- LẮNG NGHE & CẬP NHẬT REALTIME (TICKET, TICKER, LỜI CHÚC) ---
let wishesQueue = [];
let tickerTimer = null;
let currentWishIndex = 0;
let totalAttendees = 0;

function createWishScrollCard(author, msg, timeString) {
  const card = document.createElement('div');
  card.className = 'wish-scroll-card';

  const header = document.createElement('div');
  header.className = 'wish-card-header';

  const nameSpan = document.createElement('span');
  nameSpan.className = 'wish-author-name';
  nameSpan.textContent = author;

  const timeSpan = document.createElement('span');
  timeSpan.className = 'wish-time-stamp';
  timeSpan.textContent = timeString || (new Date().toLocaleTimeString('vi-VN') + ' ' + new Date().toLocaleDateString('vi-VN'));

  header.appendChild(nameSpan);
  header.appendChild(timeSpan);

  const body = document.createElement('div');
  body.className = 'wish-message-body';
  body.textContent = msg;

  card.appendChild(header);
  card.appendChild(body);
  return card;
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

// Lắng nghe sự kiện onChildAdded từ Firebase (< 100ms)
if (wishesRef) {
  wishesRef.on('child_added', (snapshot) => {
    const item = snapshot.val();
    const id = 'wish-' + snapshot.key;

    // 1. Cập nhật Live Ticket số người tham dự
    //if (item.attending === true || item.attendance === 'yes') {
     // totalAttendees += (parseInt(item.guests, 10) || 1);
      //const countEl = document.getElementById('statAttendeeCount');
      //if (countEl) countEl.textContent = totalAttendees;
    //}

    // 2. Cập nhật Danh sách Lời chúc & Ticker
    if (!document.getElementById(id)) {
      const card = createWishScrollCard(item.name, item.message, item.time);
      card.id = id;
      const container = document.getElementById('infiniteWishesBox');
      if (container) container.prepend(card);

      wishesQueue.unshift(item);
      startTickerLoop();
    }
  });
}
