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
// 1. FLOATING TICKER (CHẠY LẦN LƯỢT TỪNG LỜI CHÚC)
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
// 2. KHUNG LỜI CHÚC: HOVER/TOUCH DỪNG ĐỌC + QUÁN TÍNH CUỘN MƯỢT
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
let isTouching = false;
let isHovering = false;
let scrollPos = 0;
let velocity = 0;
let lastFrameTime = performance.now();
let wheelResumeTimer = null;

function setupSeamlessInfiniteScroller(trackEl) {
  if (marqueeRafId) {
    cancelAnimationFrame(marqueeRafId);
    marqueeRafId = null;
  }

  const BASE_AUTO_SPEED = 32; // pixel/giây khi tự động trôi
  const FRICTION = 0.955;      // Lực cản ma sát quán tính mượt mà
  lastFrameTime = performance.now();

  function getSingleGroupHeight() {
    const group = trackEl.firstElementChild;
    return group ? group.offsetHeight : 0;
  }

  function frameLoop(now) {
    const dt = (now - lastFrameTime) / 1000;
    lastFrameTime = now;
    const safeDt = Math.min(dt, 0.05);

    const groupHeight = getSingleGroupHeight();

    if (groupHeight > 0) {
      // 1. Nếu đang có lực quán tính (từ vuốt tay hoặc lăn chuột) -> tiếp tục xả trớn
      if (Math.abs(velocity) > 0.15) {
        scrollPos += velocity;
        velocity *= FRICTION;
      } 
      // 2. Nếu đang chạm tay (touch) HOẶC đang rê chuột (hover) trên PC -> ĐỨNG YÊN ĐỂ ĐỌC
      else if (isTouching || isHovering) {
        velocity = 0;
      } 
      // 3. Khi không chạm, không hover và hết lực trớn -> TỰ ĐỘNG TRÔI TIẾP
      else {
        velocity = 0;
        scrollPos += BASE_AUTO_SPEED * safeDt;
      }

      // Vòng lặp vị trí liền mạch 2 chiều
      if (scrollPos >= groupHeight) {
        scrollPos -= groupHeight;
      } else if (scrollPos < 0) {
        scrollPos += groupHeight;
      }

      const renderY = Math.round(scrollPos * 100) / 100;
      trackEl.style.transform = `translate3d(0, -${renderY}px, 0)`;
    }

    marqueeRafId = requestAnimationFrame(frameLoop);
  }

  marqueeRafId = requestAnimationFrame(frameLoop);

  const outerBox = trackEl.parentElement;
  if (outerBox && !outerBox.dataset.boundGesture) {
    outerBox.dataset.boundGesture = '1';

    let touchStartY = 0;
    let initialTouchPos = 0;
    let prevTouchY = 0;
    let prevTouchTime = 0;

    // --- 1. XỬ LÝ TRÊN PC (HOVER DỪNG + LĂN CHUỘT CUỘN) ---
    outerBox.addEventListener('mouseenter', () => {
      isHovering = true;
      velocity = 0; // Rê chuột vào là đứng yên ngay để đọc
    });

    outerBox.addEventListener('mouseleave', () => {
      isHovering = false;
      lastFrameTime = performance.now(); // Rê chuột ra ngoài là tự chạy lại
    });

    outerBox.addEventListener('wheel', (e) => {
      e.preventDefault();
      e.stopPropagation();

      // Khi lăn chuột, nạp lực trớn quán tính cho PC
      const impulse = e.deltaY * 0.18;
      velocity = Math.max(Math.min(velocity + impulse, 35), -35);
      lastFrameTime = performance.now();

      // Nếu đang hover mà lăn chuột, cho phép xả trớn xong tự đứng lại để đọc tiếp
      clearTimeout(wheelResumeTimer);
      wheelResumeTimer = setTimeout(() => {
        velocity = 0;
      }, 700);
    }, { passive: false });

    // --- 2. XỬ LÝ TRÊN ĐIỆN THOẠI (CHẠM DỪNG + VUỐT QUÁN TÍNH) ---
    outerBox.addEventListener('touchstart', (e) => {
      if (e.touches.length !== 1) return;
      isTouching = true;
      velocity = 0; // Chạm ngón tay vào là dừng lại ngay lập tức để đọc

      touchStartY = e.touches[0].clientY;
      prevTouchY = touchStartY;
      prevTouchTime = performance.now();
      initialTouchPos = scrollPos;
    }, { passive: true });

    outerBox.addEventListener('touchmove', (e) => {
      if (!isTouching || e.touches.length !== 1) return;

      if (e.cancelable) e.preventDefault();
      e.stopPropagation();

      const currentY = e.touches[0].clientY;
      const now = performance.now();
      const diffY = touchStartY - currentY;

      // Đo vận tốc vuốt thực tế để nạp trớn quán tính
      const timeDelta = now - prevTouchTime;
      if (timeDelta > 0) {
        const instantVelocity = (prevTouchY - currentY) / (timeDelta / 16.6);
        velocity = velocity * 0.35 + instantVelocity * 0.65;
      }
      prevTouchY = currentY;
      prevTouchTime = now;

      scrollPos = initialTouchPos + diffY;

      const groupHeight = getSingleGroupHeight();
      if (groupHeight > 0) {
        if (scrollPos >= groupHeight) {
          scrollPos -= groupHeight;
          initialTouchPos -= groupHeight;
        } else if (scrollPos < 0) {
          scrollPos += groupHeight;
          initialTouchPos += groupHeight;
        }
        const renderY = Math.round(scrollPos * 100) / 100;
        trackEl.style.transform = `translate3d(0, -${renderY}px, 0)`;
      }
    }, { passive: false });

    outerBox.addEventListener('touchend', () => {
      isTouching = false;
      lastFrameTime = performance.now();
      // Nhấc tay ra: phóng trớn quán tính lướt tiếp rồi dừng từ từ
      velocity = Math.max(Math.min(velocity * 1.05, 40), -40);
    }, { passive: true });

    outerBox.addEventListener('touchcancel', () => {
      isTouching = false;
      velocity = 0;
    }, { passive: true });
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
  if (currentSignature === lastRenderedSignature) return;
  lastRenderedSignature = currentSignature;

  if (wishesQueue.length <= 2) {
    container.innerHTML = `<div style="padding: 10px 0; display: flex; flex-direction: column; gap: 14px;">${wishesQueue.map(renderCardHTML).join('')}</div>`;
    return;
  }

  let baseList = [...wishesQueue];
  while (baseList.length < 6) {
    baseList = baseList.concat(wishesQueue);
  }
  const cardsHtml = baseList.map(renderCardHTML).join('');

  container.innerHTML = `
    <div class="marquee-wishes-wrapper" style="will-change: transform; display: flex; flex-direction: column;">
      <div class="marquee-group">${cardsHtml}</div>
      <div class="marquee-group" aria-hidden="true">${cardsHtml}</div>
    </div>
  `;

  const trackEl = container.querySelector('.marquee-wishes-wrapper');
  if (trackEl) {
    scrollPos = 0;
    velocity = 0;
    setupSeamlessInfiniteScroller(trackEl);
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
// 4. REALTIME ALBUM & ZOOM/PAN CHO LIGHTBOX
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

    // Chuột PC
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

    // Touch Mobile
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