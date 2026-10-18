// js/realtime.js
'use strict';

let wishesQueue = [];
let tickerTimer = null;
let currentWishIndex = 0;
let renderDebounceTimer = null;
let lastRenderedSignature = '';
const MAX_WISHES_LIMIT = 50;

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

function renderCardHTML(w) {
  return `
    <div class="wish-scroll-card">
      <div class="wish-card-header">
        <span class="wish-author-name">${escapeHTML(w.name)}</span>
        <span class="wish-time-stamp">${escapeHTML(w.time || '')}</span>
      </div>
      <div class="wish-message-body">${escapeHTML(w.message)}</div>
    </div>
  `;
}

function refreshWishesDOM() {
  const container = document.getElementById('infiniteWishesBox');
  if (!container) return;

  if (wishesQueue.length === 0) {
    container.innerHTML = '<div style="text-align:center; padding: 24px; color: var(--text-muted); font-size: 0.9rem; font-style: italic;">Chưa có lời chúc nào. Hãy là người đầu tiên gửi lời chúc nhé!</div>';
    lastRenderedSignature = '';
    return;
  }

  const currentSignature = wishesQueue.map(w => w._key).join(',');
  if (currentSignature === lastRenderedSignature) {
    return;
  }
  lastRenderedSignature = currentSignature;

  if (wishesQueue.length <= 3) {
    container.innerHTML = `<div class="marquee-static-track">${wishesQueue.map(renderCardHTML).join('')}</div>`;
    return;
  }

  const cardsHtml = wishesQueue.map(renderCardHTML).join('');
  const duration = Math.max(16, wishesQueue.length * 5);

  container.innerHTML = `
    <div class="marquee-wishes-wrapper" style="overflow: hidden; position: relative; height: 100%;">
      <div class="marquee-track" style="animation-duration: ${duration}s;">
        ${cardsHtml}
      </div>
      <div class="marquee-track" aria-hidden="true" style="animation-duration: ${duration}s;">
        ${cardsHtml}
      </div>
    </div>
  `;

  if (!container.dataset.touchBound) {
    container.dataset.touchBound = "1";
    container.addEventListener('touchstart', () => container.classList.add('is-paused'), { passive: true });
    container.addEventListener('touchend', () => container.classList.remove('is-paused'), { passive: true });
    container.addEventListener('touchcancel', () => container.classList.remove('is-paused'), { passive: true });
  }
}

function scheduleUIRefresh() {
  if (renderDebounceTimer) clearTimeout(renderDebounceTimer);
  renderDebounceTimer = setTimeout(() => {
    refreshWishesDOM();
    startTickerLoop();
  }, 50);
}

// 1. Lắng nghe Firebase Realtime danh sách lời chúc
if (typeof wishesRef !== 'undefined' && wishesRef) {
  wishesRef.limitToLast(MAX_WISHES_LIMIT).on('child_added', (snapshot) => {
    const item = snapshot.val();
    const key = snapshot.key;

    if (!item || !item.name || !item.message) return;

    const exists = wishesQueue.some(w => w._key === key);
    if (!exists) {
      item._key = key;
      item.timestamp = (typeof item.timestamp === 'number' && !isNaN(item.timestamp)) ? item.timestamp : Date.now();
      
      wishesQueue.push(item);
      wishesQueue.sort((a, b) => (Number(b.timestamp) || 0) - (Number(a.timestamp) || 0));

      if (wishesQueue.length > MAX_WISHES_LIMIT) {
        wishesQueue.pop();
      }

      scheduleUIRefresh();
    }
  }, (err) => {
    console.warn('[Realtime] Lỗi nạp dữ liệu:', err.message);
  });

  wishesRef.on('child_removed', (snapshot) => {
    const removedKey = snapshot.key;
    wishesQueue = wishesQueue.filter(w => w._key !== removedKey);
    scheduleUIRefresh();
  });
}

// 2. Lắng nghe Realtime Album ảnh và Tích hợp Zoom & Pan Chuẩn Xác bằng Pointer Events
window.addEventListener('DOMContentLoaded', () => {
  if (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length > 0) {
    const albumRef = firebase.database().ref('album_photos');
    const track = document.getElementById('coverflowTrack');

    function isValidHttpUrl(str) {
      try {
        const url = new URL(str);
        return url.protocol === 'http:' || url.protocol === 'https:';
      } catch (_) {
        return false;
      }
    }

    albumRef.on('value', (snapshot) => {
      const urls = snapshot.val();
      if (!Array.isArray(urls) || urls.length === 0 || !track) return;

      track.innerHTML = '';
      urls.forEach((url, i) => {
        const cleanUrl = String(url).trim();
        if (isValidHttpUrl(cleanUrl)) {
          const card = document.createElement('div');
          card.className = 'coverflow-card';
          
          const img = document.createElement('img');
          img.src = cleanUrl;
          img.alt = `Wedding Photo ${i + 1}`;
          img.loading = 'lazy';

          card.appendChild(img);
          track.appendChild(card);
        }
      });

      if (typeof window.reinitCoverflow === 'function') {
        window.reinitCoverflow();
      }
    });
  }

  // --- HỆ THỐNG ZOOM & PAN DÙNG POINTER EVENTS (FIX TRIỆT ĐỂ MỌI LỖI KÉO THẢ) ---
  const zoomImg = document.getElementById('lightboxZoomImg');
  if (zoomImg) {
    let currentScale = 1;
    let isPointerDragging = false;
    let startX = 0, startY = 0;
    let translateX = 0, translateY = 0;
    let savedTranslateX = 0, savedTranslateY = 0;
    let pointerStartTime = 0;

    window.resetLightboxZoom = function() {
      currentScale = 1;
      translateX = 0; translateY = 0;
      savedTranslateX = 0; savedTranslateY = 0;
      zoomImg.style.transform = `translate(0px, 0px) scale(1)`;
      zoomImg.style.cursor = 'zoom-in';
    };

    zoomImg.addEventListener('dragstart', (e) => e.preventDefault());

    // Click / Tap để phóng to hoặc thu nhỏ
    zoomImg.addEventListener('click', (e) => {
      e.stopPropagation();
      // Nếu thời gian giữ pointer nhỏ hơn 250ms thì tính là click bình thường
      if (Date.now() - pointerStartTime < 250 && Math.abs(translateX - savedTranslateX) < 5) {
        if (currentScale === 1) {
          currentScale = 2.5;
          zoomImg.style.cursor = 'grab';
        } else {
          currentScale = 1;
          translateX = 0; translateY = 0;
          savedTranslateX = 0; savedTranslateY = 0;
          zoomImg.style.cursor = 'zoom-in';
        }
        zoomImg.style.transform = `translate(${translateX}px, ${translateY}px) scale(${currentScale})`;
      }
    });

    // Cuộn chuột zoom trên PC (Ctrl + Wheel)
    zoomImg.addEventListener('wheel', (e) => {
      e.preventDefault();
      if (e.ctrlKey) {
        let zoomFactor = e.deltaY < 0 ? 0.25 : -0.25;
        currentScale = Math.min(Math.max(1, currentScale + zoomFactor), 4);
        if (currentScale === 1) {
          translateX = 0; translateY = 0;
          savedTranslateX = 0; savedTranslateY = 0;
          zoomImg.style.cursor = 'zoom-in';
        } else {
          zoomImg.style.cursor = 'grab';
        }
        zoomImg.style.transform = `translate(${translateX}px, ${translateY}px) scale(${currentScale})`;
      }
    }, { passive: false });

    // --- POINTER DOWN (Bắt đầu kéo chuột/cảm ứng) ---
    zoomImg.addEventListener('pointerdown', (e) => {
      if (currentScale > 1) {
        isPointerDragging = true;
        pointerStartTime = Date.now();
        zoomImg.style.cursor = 'grabbing';
        startX = e.clientX - savedTranslateX;
        startY = e.clientY - savedTranslateY;
        zoomImg.setPointerCapture(e.pointerId);
        e.preventDefault();
      }
    });

    // --- POINTER MOVE (Đang di chuyển kéo thả) ---
    zoomImg.addEventListener('pointermove', (e) => {
      if (!isPointerDragging || currentScale <= 1) return;
      translateX = e.clientX - startX;
      translateY = e.clientY - startY;
      zoomImg.style.transform = `translate(${translateX}px, ${translateY}px) scale(${currentScale})`;
    });

    // --- POINTER UP / CANCEL (Kết thúc kéo) ---
    const endPointerDrag = (e) => {
      if (isPointerDragging) {
        isPointerDragging = false;
        savedTranslateX = translateX;
        savedTranslateY = translateY;
        if (currentScale > 1) zoomImg.style.cursor = 'grab';
        try { zoomImg.releasePointerCapture(e.pointerId); } catch (_) {}
      }
    };

    zoomImg.addEventListener('pointerup', endPointerDrag);
    zoomImg.addEventListener('pointercancel', endPointerDrag);
  }
});