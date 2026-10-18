// js/app.js
// --- LOGIC GIAO DIỆN CHÍNH & XỬ LÝ SUBMIT DUY NHẤT (FIREBASE + APPS SCRIPT) ---
'use strict';

const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbx7aYHQKPQQfAoi56u20K0iHxpht7EzXnHabE8DiCmk3YLfMPryUuyqPxIhGAKXbVgy/exec";
const SUBMIT_THROTTLE_MS = 30000; // 30s rate limit phía client

document.addEventListener('DOMContentLoaded', () => {
  // 1. Tắt tính năng tự nhớ vị trí cuộn của trình duyệt khi load trang
  if ('scrollRestoration' in history) {
    history.scrollRestoration = 'manual';
  }
  window.scrollTo(0, 0);

  // 2. Custom Alert UI Controller
  const customAlert = document.getElementById('customAlert');
  const alertMsg = document.getElementById('alertMsg');
  const alertOkBtn = document.getElementById('alertOkBtn');
  
  alertOkBtn?.addEventListener('click', () => customAlert?.classList.remove('active'));

  function showAlert(msg) {
    if (!alertMsg || !customAlert) return;
    alertMsg.textContent = String(msg);
    customAlert.classList.add('active');
  }

  // --- HỆ THỐNG TỰ ĐỘNG CUỘN TRANG (CHUẨN 60FPS/120FPS KHÔNG GIẬT CỤC) ---
  let autoScrollRafId = null;
  let isAutoScrolling = false;
  let isScrollPaused = false;
  let wheelResumeTimer = null;
  let currentScrollY = window.scrollY || window.pageYOffset || 0;
  const scrollSpeed = 1.4; // Tốc độ trôi êm dịu, không giật hình

  function stepAutoScroll() {
    if (!isAutoScrolling) return;

    if (!isScrollPaused) {
      currentScrollY += scrollSpeed;
      
      // Cuộn tức thời bằng tọa độ thực float, triệt tiêu xung đột với scroll-behavior: smooth
      window.scrollTo({
        top: currentScrollY,
        left: 0,
        behavior: 'instant'
      });

      // Kiểm tra chạm đáy trang
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      if (currentScrollY >= maxScroll - 10) {
        stopAutoScroll();
        return;
      }
    }

    autoScrollRafId = requestAnimationFrame(stepAutoScroll);
  }

  function startAutoScroll() {
    if (isAutoScrolling) return;
    isAutoScrolling = true;
    isScrollPaused = false;
    currentScrollY = window.scrollY || window.pageYOffset || 0;
    autoScrollRafId = requestAnimationFrame(stepAutoScroll);
  }

  function stopAutoScroll() {
    isAutoScrolling = false;
    if (autoScrollRafId) {
      cancelAnimationFrame(autoScrollRafId);
      autoScrollRafId = null;
    }
  }

  // Đồng bộ lại toạ độ khi người dùng chủ động tương tác
  function syncScrollPos() {
    currentScrollY = window.scrollY || window.pageYOffset || 0;
  }

  // Chạm giữ (điện thoại) hoặc bấm đè chuột (máy tính) để đứng yên giống mục lời chúc
  window.addEventListener('touchstart', () => {
    if (window.isLightboxZoomed) return;
    isScrollPaused = true;
    syncScrollPos();
  }, { passive: true });

  window.addEventListener('touchend', () => {
    syncScrollPos();
    isScrollPaused = false;
  }, { passive: true });

  window.addEventListener('mousedown', () => {
    isScrollPaused = true;
    syncScrollPos();
  });

  window.addEventListener('mouseup', () => {
    syncScrollPos();
    isScrollPaused = false;
  });

  // Khi lăn chuột: Tạm dừng để đọc, sau khi dừng lăn chuột 1.2s thì tự động cuộn tiếp
  window.addEventListener('wheel', () => {
    isScrollPaused = true;
    syncScrollPos();
    clearTimeout(wheelResumeTimer);
    wheelResumeTimer = setTimeout(() => {
      const lbActive = document.getElementById('lightboxModal')?.classList.contains('active');
      if (!lbActive) {
        syncScrollPos();
        isScrollPaused = false;
      }
    }, 1200);
  }, { passive: true });

  function scheduleAutoScroll() {
    setTimeout(() => {
      startAutoScroll();
    }, 3000); // Đợi đúng 3 giây sau khi mở màn hình chính
  }

  // 3. Audio & Mở Thiệp Controller
  const audioPlayer = document.getElementById('audioPlayer');
  const musicToggle = document.getElementById('musicToggle');
  const btnOpen = document.getElementById('btnOpen');
  const gateScreen = document.getElementById('gateScreen');

  function toggleAudio() {
    if (!audioPlayer) return;
    if (audioPlayer.paused) {
      audioPlayer.play().then(() => {
        musicToggle?.classList.add('playing');
      }).catch(err => console.warn('[Audio] Autoplay blocked:', err));
    } else {
      audioPlayer.pause();
      musicToggle?.classList.remove('playing');
    }
  }

  musicToggle?.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleAudio();
  });

  btnOpen?.addEventListener('click', () => {
    if (btnOpen.dataset.opened === '1') return;
    btnOpen.dataset.opened = '1';

    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;

    gateScreen?.classList.add('opened');

    if (audioPlayer) {
      audioPlayer.muted = false;
      audioPlayer.volume = 1.0;
      audioPlayer.play().then(() => {
        musicToggle?.classList.add('playing');
        musicToggle?.classList.remove('needs-tap');
      }).catch(() => {
        musicToggle?.classList.add('needs-tap');
      });
    }

    // Bắt đầu đếm 3s để tự động cuộn sau khi mở thiệp
    scheduleAutoScroll();
  });

  // 4. Countdown Timer (12/12/2026)
  const weddingDate = new Date("2026-12-12T11:30:00+07:00").getTime();
  const elDays = document.getElementById('cdDays');
  const elHours = document.getElementById('cdHours');
  const elMinutes = document.getElementById('cdMinutes');
  const elSeconds = document.getElementById('cdSeconds');

  function updateCountdown() {
    const now = Date.now();
    const distance = weddingDate - now;

    if (distance < 0) {
      if (elDays) elDays.textContent = "00";
      if (elHours) elHours.textContent = "00";
      if (elMinutes) elMinutes.textContent = "00";
      if (elSeconds) elSeconds.textContent = "00";
      return;
    }

    const days = Math.floor(distance / (1000 * 60 * 60 * 24));
    const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((distance % (1000 * 60)) / 1000);

    if (elDays) elDays.textContent = days < 10 ? "0" + days : String(days);
    if (elHours) elHours.textContent = hours < 10 ? "0" + hours : String(hours);
    if (elMinutes) elMinutes.textContent = minutes < 10 ? "0" + minutes : String(minutes);
    if (elSeconds) elSeconds.textContent = seconds < 10 ? "0" + seconds : String(seconds);
  }
  setInterval(updateCountdown, 1000);
  updateCountdown();

  // 5. Dynamic Guest Selector Controller
  const guestsSelect = document.getElementById('rsvpGuestsSelect');
  const guestsCustom = document.getElementById('rsvpGuestsCustom');

  if (guestsSelect && guestsCustom) {
    guestsSelect.addEventListener('change', () => {
      if (guestsSelect.value === 'other') {
        guestsCustom.style.display = 'block';
        guestsCustom.required = true;
        guestsCustom.focus();
      } else {
        guestsCustom.style.display = 'none';
        guestsCustom.required = false;
        guestsCustom.value = '';
      }
    });
  }

  // 6. RSVP Form Submission Handler (Single Point of Entry - Anti-Double Submit)
  const rsvpForm = document.getElementById('rsvpForm');
  const loadingOverlay = document.getElementById('loadingOverlay');
  let isSubmitting = false; // Mutex lock chống Race Condition / Double Click

  if (rsvpForm) {
    rsvpForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      if (isSubmitting) return;

      // Rate limit kiểm tra client-side
      const lastSubmitTime = localStorage.getItem('lastRsvpSubmit');
      if (lastSubmitTime && (Date.now() - parseInt(lastSubmitTime, 10)) < SUBMIT_THROTTLE_MS) {
        showAlert("Bạn thao tác quá nhanh. Vui lòng chờ 30 giây trước khi gửi tiếp!");
        return;
      }

      const submitBtn = document.getElementById('btnSubmitRsvp');
      const nameInput = document.getElementById('nameInput');
      const attendingSelect = document.getElementById('attendingSelect');
      const msgInput = document.getElementById('msgInput');

      // Sanitize & Validate Client Boundaries
      const nameVal = (nameInput?.value || '').trim().slice(0, 50);
      const attendingVal = attendingSelect?.value === 'true';
      const msgVal = (msgInput?.value || '').trim().slice(0, 1000);

      let guestsVal = 1;
      if (attendingVal && guestsSelect) {
        if (guestsSelect.value === 'other' && guestsCustom) {
          const parsed = parseInt(guestsCustom.value, 10);
          guestsVal = (!isNaN(parsed) && parsed >= 1 && parsed <= 50) ? parsed : 1;
        } else {
          guestsVal = parseInt(guestsSelect.value, 10) || 1;
        }
      } else if (!attendingVal) {
        guestsVal = 0;
      }

      if (!nameVal || !msgVal) {
        showAlert("Vui lòng điền đầy đủ họ tên và lời chúc phúc!");
        return;
      }

      // Khóa Mutex và cập nhật UI State
      isSubmitting = true;
      loadingOverlay?.classList.add('active');
      if (submitBtn) submitBtn.disabled = true;

      // Format chuẩn xác: HH:mm:ss DD/MM/YYYY
      const now = new Date();
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const seconds = String(now.getSeconds()).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const year = now.getFullYear();

      const timeStr = `${hours}:${minutes}:${seconds} ${day}/${month}/${year}`;

      // Payload đồng bộ hoàn toàn với Firebase RTDB Security Rules Schema
      const payload = {
        name: nameVal,
        attending: attendingVal,
        guests: guestsVal,
        message: msgVal,
        time: timeStr,
        timestamp: (typeof firebase !== 'undefined' && firebase.database?.ServerValue) 
          ? firebase.database.ServerValue.TIMESTAMP 
          : Date.now(),
        synced: false
      };

      try {
        if (typeof wishesRef !== 'undefined' && wishesRef) {
          const newRef = wishesRef.push();
          const firebasePromise = newRef.set(payload);

          // Đẩy ngầm sang Google Sheet (Apps Script)
          fetch(SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              ...payload, 
              id: newRef.key,
              timestamp: Date.now()
            })
          }).catch(err => console.warn('[AppsScript] Async push failed:', err));

          await firebasePromise;
        } else {
          // Fallback nếu Firebase offline
          await fetch(SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...payload, timestamp: Date.now() })
          });
        }

        localStorage.setItem('lastRsvpSubmit', Date.now().toString());
        showAlert("Cảm ơn bạn đã gửi lời chúc phúc và xác nhận tham dự!");
        
        rsvpForm.reset();
        if (guestsCustom) {
          guestsCustom.style.display = 'none';
          guestsCustom.value = '';
        }
      } catch (err) {
        console.error('[RSVP Error]:', err);
        showAlert("Không thể lưu lời chúc do lỗi kết nối. Vui lòng thử lại!");
      } finally {
        isSubmitting = false;
        loadingOverlay?.classList.remove('active');
        if (submitBtn) submitBtn.disabled = false;
      }
    });
  }

  // 7. Ticker Widget UI Controls
  const floatingWidget = document.getElementById('floatingWidget');
  const widgetToggleBtn = document.getElementById('widgetToggleBtn');
  const widgetFabIcon = document.getElementById('widgetFabIcon');

  widgetToggleBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    floatingWidget?.classList.add('minimized');
  });
  widgetFabIcon?.addEventListener('click', () => {
    floatingWidget?.classList.remove('minimized');
  });

  // 8. Coverflow 3D Album & Lightbox Modal Controller
  const dotsBox = document.getElementById('dotsBox');
  const btnNext = document.getElementById('btnNext');
  const btnPrev = document.getElementById('btnPrev');
  const wrapper = document.getElementById('coverflowWrapper');

  const lbModal = document.getElementById('lightboxModal');
  const lbZoomImg = document.getElementById('lightboxZoomImg');
  const lbCounter = document.getElementById('lbCounter');
  const lbBtnClose = document.getElementById('lightboxClose');
  const lbBtnPrev = document.getElementById('lbBtnPrev');
  const lbBtnNext = document.getElementById('lbBtnNext');
  const lbThumbStrip = document.getElementById('lbThumbStrip');
  const lbMainStage = document.getElementById('lbMainStage');

  let currentCardIndex = 0;
  let currentGalleryIndex = 0;
  let autoPlayTimer = null;
  let imageList = [];
  let cards = [];

  function openGalleryAt(index) {
    if (typeof window.resetLightboxZoom === 'function') {
      window.resetLightboxZoom();
    }

    if (imageList.length === 0) return;
    if (index < 0) index = imageList.length - 1;
    if (index >= imageList.length) index = 0;
    currentGalleryIndex = index;

    if (lbZoomImg) {
      lbZoomImg.style.opacity = '0.25';
      lbZoomImg.style.transform = 'scale(0.96)';

      setTimeout(() => {
        lbZoomImg.src = imageList[currentGalleryIndex];
        lbZoomImg.style.opacity = '1';
        lbZoomImg.style.transform = 'scale(1)';
      }, 100);
    }

    if (lbCounter) {
      lbCounter.textContent = `${currentGalleryIndex + 1} / ${imageList.length}`;
    }

    const thumbs = lbThumbStrip?.querySelectorAll('.lb-thumb-item');
    thumbs?.forEach((t, i) => {
      if (i === currentGalleryIndex) {
        t.classList.add('active');
        t.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      } else {
        t.classList.remove('active');
      }
    });
  }

  function updateCoverflow(index) {
    const total = cards.length;
    if (total === 0) return;

    currentCardIndex = (index + total) % total;

    cards.forEach((card, i) => {
      card.className = 'coverflow-card';
      let diff = i - currentCardIndex;

      if (diff > total / 2) diff -= total;
      if (diff < -total / 2) diff += total;

      if (diff === 0) {
        card.classList.add('active');
      } else if (diff === -1) {
        card.classList.add('prev-1');
      } else if (diff === -2) {
        card.classList.add('prev-2');
      } else if (diff === 1) {
        card.classList.add('next-1');
      } else if (diff === 2) {
        card.classList.add('next-2');
      } else {
        card.classList.add('hidden-card');
      }
    });

    const dots = dotsBox?.querySelectorAll('.dot-item') || [];
    dots.forEach((dot, idx) => {
      dot.classList.toggle('active', idx === currentCardIndex);
    });
  }

  function goToSlide(index) {
    updateCoverflow(index);
    resetAutoPlay();
  }

  function nextSlide() { goToSlide(currentCardIndex + 1); }
  function prevSlide() { goToSlide(currentCardIndex - 1); }

  function startAutoPlay() {
    if (cards.length > 0) {
      clearInterval(autoPlayTimer);
      autoPlayTimer = setInterval(nextSlide, 3500);
    }
  }

  function resetAutoPlay() {
    clearInterval(autoPlayTimer);
    startAutoPlay();
  }

  function setupAlbumGallery() {
    cards = Array.from(document.querySelectorAll('.coverflow-card'));
    if (cards.length === 0) return;

    imageList = cards.map(card => {
      const img = card.querySelector('img');
      return img ? img.src : '';
    }).filter(src => src !== '');

    if (dotsBox) {
      dotsBox.innerHTML = '';
      cards.forEach((_, idx) => {
        const dot = document.createElement('div');
        dot.className = `dot-item ${idx === 0 ? 'active' : ''}`;
        dot.addEventListener('click', (e) => {
          e.stopPropagation();
          goToSlide(idx);
        });
        dotsBox.appendChild(dot);
      });
    }

    if (lbThumbStrip && imageList.length > 0) {
      lbThumbStrip.innerHTML = '';
      imageList.forEach((src, idx) => {
        const thumb = document.createElement('div');
        thumb.className = `lb-thumb-item ${idx === 0 ? 'active' : ''}`;
        
        const thumbImg = document.createElement('img');
        thumbImg.src = src;
        thumbImg.alt = `Thumbnail ${idx + 1}`;
        thumb.appendChild(thumbImg);

        thumb.addEventListener('click', (e) => {
          e.stopPropagation();
          openGalleryAt(idx);
        });
        lbThumbStrip.appendChild(thumb);
      });
    }

    cards.forEach((card, idx) => {
      card.onclick = (e) => {
        e.stopPropagation();
        if (idx === currentCardIndex) {
          openGalleryAt(idx);
          lbModal?.classList.add('active');
          document.body.style.overflow = 'hidden';
          isScrollPaused = true; // Dừng cuộn khi vào Lightbox
        } else {
          goToSlide(idx);
        }
      };
    });

    updateCoverflow(0);
    resetAutoPlay();
  }

  // Expose cho realtime.js gọi lại an toàn
  window.reinitCoverflow = setupAlbumGallery;

  btnNext?.addEventListener('click', (e) => { e.stopPropagation(); nextSlide(); });
  btnPrev?.addEventListener('click', (e) => { e.stopPropagation(); prevSlide(); });

  wrapper?.addEventListener('mouseenter', () => clearInterval(autoPlayTimer));
  wrapper?.addEventListener('mouseleave', () => startAutoPlay());

  // Touch Swipe Gesture Handling (CoverFlow)
  let cfTouchStartX = 0;
  let cfTouchStartY = 0;
  let cfIsSwiping = false;

  wrapper?.addEventListener('touchstart', (e) => {
    cfTouchStartX = e.changedTouches[0].screenX;
    cfTouchStartY = e.changedTouches[0].screenY;
    cfIsSwiping = true;
    clearInterval(autoPlayTimer);
  }, { passive: true });

  wrapper?.addEventListener('touchend', (e) => {
    if (!cfIsSwiping) return;
    cfIsSwiping = false;

    const diffX = cfTouchStartX - e.changedTouches[0].screenX;
    const diffY = cfTouchStartY - e.changedTouches[0].screenY;

    if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 35) {
      if (diffX > 0) nextSlide();
      else prevSlide();
    }
    startAutoPlay();
  }, { passive: true });

  // Lightbox Navigation Controls
  lbBtnPrev?.addEventListener('click', (e) => {
    e.stopPropagation();
    openGalleryAt(currentGalleryIndex - 1);
  });

  lbBtnNext?.addEventListener('click', (e) => {
    e.stopPropagation();
    openGalleryAt(currentGalleryIndex + 1);
  });

  function closeLightbox() {
    if (typeof window.resetLightboxZoom === 'function') {
      window.resetLightboxZoom();
    }
    lbModal?.classList.remove('active');
    document.body.style.overflow = '';
    syncScrollPos();
    isScrollPaused = false; // Tiếp tục cuộn khi đóng album
  }

  lbBtnClose?.addEventListener('click', closeLightbox);
  lbModal?.addEventListener('click', (e) => {
    if (e.target === lbModal || e.target === lbMainStage) {
      closeLightbox();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (!lbModal?.classList.contains('active')) return;
    if (e.key === 'ArrowLeft') openGalleryAt(currentGalleryIndex - 1);
    if (e.key === 'ArrowRight') openGalleryAt(currentGalleryIndex + 1);
    if (e.key === 'Escape') closeLightbox();
  });

  // Vuốt chuyển ảnh trong Lightbox: Chỉ cho phép chuyển khi ảnh KHÔNG phóng to
  let lbTouchStartX = 0;
  lbMainStage?.addEventListener('touchstart', (e) => {
    lbTouchStartX = e.changedTouches[0].screenX;
  }, { passive: true });

  lbMainStage?.addEventListener('touchend', (e) => {
    if (window.isLightboxZoomed) return;

    const diff = lbTouchStartX - e.changedTouches[0].screenX;
    if (Math.abs(diff) > 50) {
      if (diff > 0) openGalleryAt(currentGalleryIndex + 1);
      else openGalleryAt(currentGalleryIndex - 1);
    }
  }, { passive: true });

  // 9. URL Guest Parameter Injection (DOM-XSS Safe)
  const params = new URLSearchParams(window.location.search);
  const rawGuest = params.get('invite') || '';
  if (rawGuest) {
    const gateGuest = document.getElementById('gateGuest');
    const nameInput = document.getElementById('nameInput');
    const cleanGuestName = String(rawGuest).trim().slice(0, 60);
    if (gateGuest) gateGuest.textContent = cleanGuestName;
    if (nameInput) nameInput.value = cleanGuestName;
  }

  // 10. Modal Hộp Quà Mừng
  const giftModal = document.getElementById('giftModal');
  document.getElementById('openGiftModal')?.addEventListener('click', () => {
    giftModal?.classList.add('active');
    isScrollPaused = true;
  });
  document.getElementById('closeModal')?.addEventListener('click', () => {
    giftModal?.classList.remove('active');
    syncScrollPos();
    isScrollPaused = false;
  });
  giftModal?.addEventListener('click', (e) => {
    if (e.target === giftModal) {
      giftModal.classList.remove('active');
      syncScrollPos();
      isScrollPaused = false;
    }
  });

  // Khởi tạo Album 3D ban đầu
  setupAlbumGallery();
});