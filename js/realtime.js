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

// 1. Lắng nghe Firebase Realtime danh sách lời chúc (RSVP)
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
    console.warn('[Realtime] Lỗi nạp dữ liệu lời chúc:', err.message);
  });

  wishesRef.on('child_removed', (snapshot) => {
    const removedKey = snapshot.key;
    wishesQueue = wishesQueue.filter(w => w._key !== removedKey);
    scheduleUIRefresh();
  });
}

// 2. Lắng nghe Realtime Album ảnh và Tích hợp Zoom & Pan 10x
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

  // --- HỆ THỐNG ZOOM TỐI ĐA 10X (PINCH, DOUBLE TAP & DRAG SIÊU MƯỢT) ---
  const zoomImg = document.getElementById('lightboxZoomImg');
  const lbStage = document.getElementById('lbMainStage');

  if (zoomImg && lbStage) {
    let currentScale = 1;
    let translateX = 0, translateY = 0;
    let startX = 0, startY = 0;
    let isDragging = false;
    let lastTapTime = 0;

    let initialDistance = 0;
    let initialScale = 1;

    const MIN_SCALE = 1;
    const MAX_SCALE = 10;
    const DOUBLE_TAP_SCALE = 3.5;

    function applyTransform(animate = false) {
      zoomImg.style.transition = animate ? 'transform 0.28s cubic-bezier(0.25, 1, 0.5, 1)' : 'none';
      zoomImg.style.transform = `translate3d(${translateX}px, ${translateY}px, 0) scale(${currentScale})`;
      window.isLightboxZoomed = currentScale > 1.05;
    }

    window.resetLightboxZoom = function() {
      currentScale = 1;
      translateX = 0;
      translateY = 0;
      window.isLightboxZoomed = false;
      applyTransform(true);
      zoomImg.style.cursor = 'zoom-in';
    };

    // 1. Double Tap: Phóng to 3.5x, chạm đúp lần nữa hồi về 1x
    zoomImg.addEventListener('touchend', (e) => {
      const now = Date.now();
      const tapInterval = now - lastTapTime;

      if (tapInterval < 300 && tapInterval > 0 && e.touches.length === 0) {
        e.preventDefault();
        if (currentScale > 1.2) {
          window.resetLightboxZoom();
        } else {
          currentScale = DOUBLE_TAP_SCALE;
          translateX = 0;
          translateY = 0;
          applyTransform(true);
          zoomImg.style.cursor = 'grab';
        }
      }
      lastTapTime = now;
    });

    // 2. Chạm ngón tay vào màn hình (TouchStart)
    lbStage.addEventListener('touchstart', (e) => {
      if (e.touches.length === 2) {
        isDragging = false;
        initialDistance = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        initialScale = currentScale;
      } else if (e.touches.length === 1 && currentScale > 1.05) {
        isDragging = true;
        startX = e.touches[0].clientX - translateX;
        startY = e.touches[0].clientY - translateY;
      }
    }, { passive: false });

    // 3. Di chuyển ngón tay (TouchMove)
    lbStage.addEventListener('touchmove', (e) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const currentDistance = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        if (initialDistance > 0) {
          const factor = currentDistance / initialDistance;
          currentScale = Math.min(Math.max(MIN_SCALE, initialScale * factor), MAX_SCALE);
          applyTransform(false);
        }
      } else if (e.touches.length === 1 && isDragging && currentScale > 1.05) {
        e.preventDefault();
        translateX = e.touches[0].clientX - startX;
        translateY = e.touches[0].clientY - startY;
        applyTransform(false);
      }
    }, { passive: false });

    // 4. Nhấc tay ra (TouchEnd)
    lbStage.addEventListener('touchend', (e) => {
      if (e.touches.length < 2) initialDistance = 0;
      if (e.touches.length === 0) {
        isDragging = false;
        if (currentScale < 1.05) {
          window.resetLightboxZoom();
        }
      }
    });

    // 5. Chuột máy tính: Wheel zoom tới 10x, click zoom 3.5x
    zoomImg.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomStep = e.deltaY < 0 ? 0.35 : -0.35;
      currentScale = Math.min(Math.max(MIN_SCALE, currentScale + zoomStep), MAX_SCALE);
      if (currentScale <= 1.05) {
        translateX = 0; translateY = 0;
        zoomImg.style.cursor = 'zoom-in';
      } else {
        zoomImg.style.cursor = 'grab';
      }
      applyTransform(false);
    }, { passive: false });

    zoomImg.addEventListener('click', (e) => {
      if (window.matchMedia('(pointer:fine)').matches) {
        if (currentScale > 1.2) {
          window.resetLightboxZoom();
        } else {
          currentScale = DOUBLE_TAP_SCALE;
          translateX = 0; translateY = 0;
          applyTransform(true);
        }
      }
    });
  }
});