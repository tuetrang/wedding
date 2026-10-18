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

// =========================================================
// 1. FLOATING TICKER (TỰ ĐỘNG CHẠY BÌNH THƯỜNG)
// =========================================================
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
  renderTicker(wishesQueue[currentWishIndex]);
  
  tickerTimer = setInterval(() => {
    currentWishIndex = (currentWishIndex + 1) % wishesQueue.length;
    renderTicker(wishesQueue[currentWishIndex]);
  }, 4000);
}

// =========================================================
// 2. KHUNG LỜI CHÚC: CUỘN VÔ HẠN 2 CHIỀU (LÊN / XUỐNG ĐỀU VÔ HẠN)
// =========================================================
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

let marqueeRafId = null;
let isMarqueePaused = false;
let marqueeResumeTimer = null;

function setupSeamlessInfiniteScroller(scrollWrapper) {
  if (marqueeRafId) {
    cancelAnimationFrame(marqueeRafId);
    marqueeRafId = null;
  }

  const scrollSpeed = 0.65; // Tốc độ tự trôi nhẹ nhàng

  // 1 block chiếm đúng 1/3 tổng chiều dài scrollHeight (vì có 3 khối bản sao)
  function getSingleBlockHeight() {
    return scrollWrapper.scrollHeight / 3;
  }

  // Khởi tạo vị trí đứng ngay đầu khối ở giữa (block 2)
  requestAnimationFrame(() => {
    const single = getSingleBlockHeight();
    if (single > 0 && scrollWrapper.scrollTop < 10) {
      scrollWrapper.scrollTop = single;
    }
  });

  // Cơ chế tái định vị vô hạn 2 chiều
  function checkBoundaryLoop() {
    const single = getSingleBlockHeight();
    if (single <= 0) return;

    // Khi cuộn xuống sâu chạm vào khối 3 -> kéo ngược về khối 2
    if (scrollWrapper.scrollTop >= single * 2) {
      scrollWrapper.scrollTop -= single;
    } 
    // Khi cuộn ngược lên trên đụng vào khối 1 -> đẩy xuống khối 2
    else if (scrollWrapper.scrollTop <= 10) {
      scrollWrapper.scrollTop += single;
    }
  }

  function stepMarquee() {
    if (!isMarqueePaused) {
      scrollWrapper.scrollTop += scrollSpeed;
      checkBoundaryLoop();
    }
    marqueeRafId = requestAnimationFrame(stepMarquee);
  }

  marqueeRafId = requestAnimationFrame(stepMarquee);

  function pause() {
    isMarqueePaused = true;
    clearTimeout(marqueeResumeTimer);
  }

  function resume(delay = 1200) {
    clearTimeout(marqueeResumeTimer);
    marqueeResumeTimer = setTimeout(() => {
      checkBoundaryLoop();
      isMarqueePaused = false;
    }, delay);
  }

  if (!scrollWrapper.dataset.infiniteBound) {
    scrollWrapper.dataset.infiniteBound = '1';

    // Bắt sự kiện cuộn liên tục để luôn đảm bảo không bao giờ kịch đáy/đỉnh
    scrollWrapper.addEventListener('scroll', () => {
      checkBoundaryLoop();
    }, { passive: true });

    // Thao tác vuốt ngón tay (Mobile touch)
    scrollWrapper.addEventListener('touchstart', pause, { passive: true });
    scrollWrapper.addEventListener('touchend', () => resume(1200), { passive: true });
    scrollWrapper.addEventListener('touchcancel', () => resume(1200), { passive: true });

    // Thao tác lăn chuột (Desktop wheel)
    scrollWrapper.addEventListener('wheel', () => {
      pause();
      resume(1200);
    }, { passive: true });

    scrollWrapper.addEventListener('mouseenter', pause);
    scrollWrapper.addEventListener('mouseleave', () => resume(600));
  }
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

  if (wishesQueue.length <= 2) {
    container.innerHTML = `<div class="marquee-static-track">${wishesQueue.map(renderCardHTML).join('')}</div>`;
    return;
  }

  const cardsHtml = wishesQueue.map(renderCardHTML).join('');

  // Nhân bản thành 3 khối (A + A + A) để triệt tiêu hoàn toàn điểm chết kịch đáy
  container.innerHTML = `
    <div class="marquee-wishes-wrapper" style="overflow-y: auto !important; height: 100%; position: relative; scrollbar-width: none; -ms-overflow-style: none; -webkit-overflow-scrolling: touch;">
      <div class="marquee-track" style="animation: none !important;">
        ${cardsHtml}
      </div>
      <div class="marquee-track" aria-hidden="true" style="animation: none !important;">
        ${cardsHtml}
      </div>
      <div class="marquee-track" aria-hidden="true" style="animation: none !important;">
        ${cardsHtml}
      </div>
    </div>
  `;

  const scrollWrapper = container.querySelector('.marquee-wishes-wrapper');
  if (scrollWrapper) {
    setupSeamlessInfiniteScroller(scrollWrapper);
  }
}

function scheduleUIRefresh() {
  if (renderDebounceTimer) clearTimeout(renderDebounceTimer);
  renderDebounceTimer = setTimeout(() => {
    refreshWishesDOM();
    startTickerLoop();
  }, 50);
}

// =========================================================
// 3. FIREBASE REALTIME LẮNG NGHE LỜI CHÚC (RSVP)
// =========================================================
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

// =========================================================
// 4. REALTIME ALBUM & ZOOM/PAN 10X
// =========================================================
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

  // --- HỆ THỐNG ZOOM & PAN CHUẨN XÁC CHO CẢ PC & MOBILE ---
  const zoomImg = document.getElementById('lightboxZoomImg');
  const lbStage = document.getElementById('lbMainStage');

  if (zoomImg && lbStage) {
    let currentScale = 1;
    let translateX = 0, translateY = 0;
    let startX = 0, startY = 0;
    let isDragging = false;
    let isPinching = false;
    let initialDistance = 0;
    let initialScale = 1;
    let lastTapTime = 0;
    let hasMoved = false;

    const MIN_SCALE = 1;
    const MAX_SCALE = 10;
    const DOUBLE_TAP_SCALE = 3.0;

    zoomImg.ondragstart = (e) => e.preventDefault();
    zoomImg.addEventListener('dragstart', (e) => e.preventDefault());

    function applyTransform(animate = false) {
      zoomImg.style.transition = animate ? 'transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)' : 'none';
      zoomImg.style.transform = `translate3d(${translateX}px, ${translateY}px, 0) scale(${currentScale})`;
      window.isLightboxZoomed = currentScale > 1.05;
      
      if (currentScale > 1.05) {
        zoomImg.style.cursor = isDragging ? 'grabbing' : 'grab';
      } else {
        zoomImg.style.cursor = 'zoom-in';
      }
    }

    window.resetLightboxZoom = function() {
      currentScale = 1;
      translateX = 0;
      translateY = 0;
      window.isLightboxZoomed = false;
      isDragging = false;
      applyTransform(true);
    };

    // Điều khiển bằng chuột trên máy tính (PC)
    lbStage.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomStep = e.deltaY < 0 ? 0.35 : -0.35;
      currentScale = Math.min(Math.max(MIN_SCALE, currentScale + zoomStep), MAX_SCALE);
      
      if (currentScale <= 1.05) {
        translateX = 0;
        translateY = 0;
      }
      applyTransform(false);
    }, { passive: false });

    lbStage.addEventListener('mousedown', (e) => {
      if (e.button === 0 && currentScale > 1.05) {
        e.preventDefault();
        isDragging = true;
        hasMoved = false;
        startX = e.clientX - translateX;
        startY = e.clientY - translateY;
        applyTransform(false);
      }
    });

    window.addEventListener('mousemove', (e) => {
      if (!isDragging || currentScale <= 1.05) return;
      e.preventDefault();
      hasMoved = true;
      translateX = e.clientX - startX;
      translateY = e.clientY - startY;
      applyTransform(false);
    });

    window.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        applyTransform(false);
      }
    });

    zoomImg.addEventListener('click', () => {
      if (hasMoved) return;
      if (currentScale > 1.2) {
        window.resetLightboxZoom();
      } else {
        currentScale = DOUBLE_TAP_SCALE;
        translateX = 0;
        translateY = 0;
        applyTransform(true);
      }
    });

    // Điều khiển cảm ứng trên điện thoại (Touch)
    lbStage.addEventListener('touchend', (e) => {
      if (e.changedTouches.length === 1 && !isPinching) {
        const now = Date.now();
        const tapInterval = now - lastTapTime;

        if (tapInterval < 300 && tapInterval > 0) {
          e.preventDefault();
          if (currentScale > 1.1) {
            window.resetLightboxZoom();
          } else {
            currentScale = DOUBLE_TAP_SCALE;
            translateX = 0;
            translateY = 0;
            applyTransform(true);
          }
        }
        lastTapTime = now;
      }
    });

    lbStage.addEventListener('touchstart', (e) => {
      if (e.touches.length === 2) {
        isPinching = true;
        isDragging = false;
        window.isLightboxZoomed = true;
        initialDistance = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        initialScale = currentScale;
      } else if (e.touches.length === 1 && currentScale > 1.01) {
        isDragging = true;
        startX = e.touches[0].clientX - translateX;
        startY = e.touches[0].clientY - translateY;
      }
    }, { passive: false });

    lbStage.addEventListener('touchmove', (e) => {
      if (e.touches.length === 2 && isPinching) {
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
      } else if (e.touches.length === 1 && isDragging && currentScale > 1.01) {
        e.preventDefault();
        translateX = e.touches[0].clientX - startX;
        translateY = e.touches[0].clientY - startY;
        applyTransform(false);
      }
    }, { passive: false });

    lbStage.addEventListener('touchend', (e) => {
      if (e.touches.length === 0) {
        isDragging = false;
        setTimeout(() => { isPinching = false; }, 150);
        if (currentScale < 0.95) {
          window.resetLightboxZoom();
        } else {
          applyTransform(false);
        }
      } else if (e.touches.length === 1) {
        startX = e.touches[0].clientX - translateX;
        startY = e.touches[0].clientY - translateY;
      }
    });
  }
});