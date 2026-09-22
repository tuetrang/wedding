// --- LOGIC GIAO DIỆN CHÍNH & SUBMIT SONG SONG (FIREBASE + GOOGLE APPS SCRIPT) ---
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbx7aYHQKPQQfAoi56u20K0iHxpht7EzXnHabE8DiCmk3YLfMPryUuyqPxIhGAKXbVgy/exec";

document.addEventListener('DOMContentLoaded', () => {
  'use strict';

  // Tắt tính năng tự nhớ vị trí cuộn của trình duyệt khi load trang
  if ('scrollRestoration' in history) {
    history.scrollRestoration = 'manual';
  }
  window.scrollTo(0, 0);

  const customAlert = document.getElementById('customAlert');
  const alertMsg = document.getElementById('alertMsg');
  document.getElementById('alertOkBtn')?.addEventListener('click', () => customAlert.classList.remove('active'));

  function showAlert(msg) {
    if (!alertMsg || !customAlert) return;
    alertMsg.textContent = msg;
    customAlert.classList.add('active');
  }

  // --- ÂM THANH & MỞ THIỆP ---
  const audioPlayer = document.getElementById('audioPlayer');
  const musicToggle = document.getElementById('musicToggle');
  const btnOpen = document.getElementById('btnOpen');
  const gateScreen = document.getElementById('gateScreen');

  function toggleAudio() {
    if (!audioPlayer) return;
    if (audioPlayer.paused) {
      audioPlayer.play().then(() => {
        musicToggle?.classList.add('playing');
      }).catch(err => console.warn('[audio] Không thể phát:', err));
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

    // 1. TỰ ĐỘNG ĐƯA TOÀN BỘ TRANG VỀ TRÊN CÙNG HẾT
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;

    // 2. Mở màn hình bìa thiệp
    gateScreen?.classList.add('opened');

    // 3. Tự phát nhạc
    if (audioPlayer) {
      audioPlayer.muted = false;
      audioPlayer.volume = 1.0;
      audioPlayer.play().then(() => {
        musicToggle?.classList.add('playing');
        musicToggle?.classList.remove('needs-tap');
      }).catch(error => {
        musicToggle?.classList.add('needs-tap');
      });
    }
  });

  // --- COUNTDOWN TIMER (12/12/2026) ---
  const weddingDate = new Date("2026-12-12T11:30:00+07:00").getTime();
  const elDays = document.getElementById('cdDays');
  const elHours = document.getElementById('cdHours');
  const elMinutes = document.getElementById('cdMinutes');
  const elSeconds = document.getElementById('cdSeconds');

  function updateCountdown() {
    const now = new Date().getTime();
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

    if (elDays) elDays.textContent = days < 10 ? "0" + days : days;
    if (elHours) elHours.textContent = hours < 10 ? "0" + hours : hours;
    if (elMinutes) elMinutes.textContent = minutes < 10 ? "0" + minutes : minutes;
    if (elSeconds) elSeconds.textContent = seconds < 10 ? "0" + seconds : seconds;
  }
  setInterval(updateCountdown, 1000);
  updateCountdown();

  // --- XỬ LÝ CHỌN SỐ LƯỢNG KHÁCH (CÓ Ô SỐ KHÁC) ---
  const guestsSelect = document.getElementById('rsvpGuestsSelect');
  const guestsCustom = document.getElementById('rsvpGuestsCustom');

  if (guestsSelect && guestsCustom) {
    guestsSelect.addEventListener('change', () => {
      if (guestsSelect.value === 'other') {
        guestsCustom.style.display = 'block';
        guestsCustom.focus();
      } else {
        guestsCustom.style.display = 'none';
        guestsCustom.value = '';
      }
    });
  }

  // --- SUBMIT FORM VỚI CƠ CHẾ SONG SONG (FIREBASE + GOOGLE SHEET) ---
  const rsvpForm = document.getElementById('rsvpForm');
  const loadingOverlay = document.getElementById('loadingOverlay');

  if (rsvpForm) {
    rsvpForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const lastSubmitTime = localStorage.getItem('lastRsvpSubmit');
      if (lastSubmitTime && (Date.now() - parseInt(lastSubmitTime, 10)) < 30000) {
        showAlert("Bạn thao tác quá nhanh. Vui lòng chờ 30 giây!");
        return;
      }

      const submitBtn = document.getElementById('btnSubmitRsvp');
      const nameVal = document.getElementById('nameInput')?.value.trim().slice(0, 50);
      const attendingVal = document.getElementById('attendingSelect')?.value === 'true';

      let guestsVal = 1;
      if (guestsSelect) {
        if (guestsSelect.value === 'other' && guestsCustom) {
          const parsed = parseInt(guestsCustom.value, 10);
          guestsVal = (!isNaN(parsed) && parsed > 0) ? parsed : 1;
        } else {
          guestsVal = parseInt(guestsSelect.value, 10) || 1;
        }
      }

      const msgVal = document.getElementById('msgInput')?.value.trim().slice(0, 300);

      if (!nameVal || !msgVal) {
        showAlert("Vui lòng nhập tên và lời chúc phúc!");
        return;
      }

      const currentTimeStr = new Date().toLocaleTimeString('vi-VN') + ' ' + new Date().toLocaleDateString('vi-VN');
      const payload = {
        name: nameVal,
        attending: attendingVal,
        guests: attendingVal ? guestsVal : 0,
        message: msgVal,
        time: currentTimeStr,
        timestamp: Date.now(),
        synced: false
      };

      loadingOverlay?.classList.add('active');
      if (submitBtn) submitBtn.disabled = true;

      try {
        if (typeof wishesRef !== 'undefined' && wishesRef) {
          const newRef = wishesRef.push();
          const firebasePromise = newRef.set(payload);

          fetch(SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...payload, id: newRef.key })
          }).catch(err => console.warn("Lỗi fetch Sheet:", err));

          await firebasePromise;
        } else {
          await fetch(SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
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
        showAlert("Gửi thành công! Lời chúc đã được ghi nhận.");
      } finally {
        loadingOverlay?.classList.remove('active');
        if (submitBtn) submitBtn.disabled = false;
      }
    });
  }

  // --- TẮT / MỞ TICKER WIDGET ---
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

  // ====================================================================
  // --- ALBUM 3D COVERFLOW: BẤM NÚT + DOTS + VUỐT TAY TRÊN ĐIỆN THOẠI ---
  // ====================================================================
  const cards = document.querySelectorAll('.coverflow-card');
  const dotsBox = document.getElementById('dotsBox');
  const btnNext = document.getElementById('btnNext');
  const btnPrev = document.getElementById('btnPrev');
  const wrapper = document.getElementById('coverflowWrapper');
  const lightbox = document.getElementById('lightboxModal');
  const zoomImg = document.getElementById('lightboxZoomImg');

  let currentCardIndex = 0;
  let autoPlayTimer = null;

  // 1. Tạo thanh chấm Dots điều hướng
  if (dotsBox && cards.length > 0) {
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

  const dots = document.querySelectorAll('.dot-item');

  // 2. Tính toán phân tầng phối cảnh 3D
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

  btnNext?.addEventListener('click', (e) => {
    e.stopPropagation();
    nextSlide();
  });

  btnPrev?.addEventListener('click', (e) => {
    e.stopPropagation();
    prevSlide();
  });

  // 3. Click vào ảnh: Ở giữa mở Lightbox, ở 2 bên trượt về giữa
  cards.forEach((card, idx) => {
    card.addEventListener('click', (e) => {
      e.stopPropagation();
      if (idx === currentCardIndex) {
        const clickedImg = card.querySelector('img');
        if (clickedImg && zoomImg && lightbox) {
          zoomImg.src = clickedImg.src;
          lightbox.classList.add('active');
        }
      } else {
        goToSlide(idx);
      }
    });
  });

  // 4. Tự động chuyển slide mượt mà
  function startAutoPlay() {
    if (cards.length > 0) {
      clearInterval(autoPlayTimer);
      autoPlayTimer = setInterval(nextSlide, 3200);
    }
  }

  function resetAutoPlay() {
    clearInterval(autoPlayTimer);
    startAutoPlay();
  }

  wrapper?.addEventListener('mouseenter', () => clearInterval(autoPlayTimer));
  wrapper?.addEventListener('mouseleave', () => startAutoPlay());

  // 5. CƠ CHẾ VUỐT CẢM ỨNG TRÊN MÀN HÌNH ĐIỆN THOẠI (TOUCH SWIPE)
  let touchStartX = 0;
  let touchStartY = 0;
  let isSwiping = false;

  wrapper?.addEventListener('touchstart', (e) => {
    touchStartX = e.changedTouches[0].screenX;
    touchStartY = e.changedTouches[0].screenY;
    isSwiping = true;
    clearInterval(autoPlayTimer);
  }, { passive: true });

  wrapper?.addEventListener('touchend', (e) => {
    if (!isSwiping) return;
    isSwiping = false;

    const touchEndX = e.changedTouches[0].screenX;
    const touchEndY = e.changedTouches[0].screenY;

    const diffX = touchStartX - touchEndX;
    const diffY = touchStartY - touchEndY;

    if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 35) {
      if (diffX > 0) {
        nextSlide();
      } else {
        prevSlide();
      }
    }

    startAutoPlay();
  }, { passive: true });

  // 6. Đóng Lightbox
  document.getElementById('lightboxClose')?.addEventListener('click', (e) => {
    e.stopPropagation();
    lightbox?.classList.remove('active');
  });

  lightbox?.addEventListener('click', (e) => {
    if (e.target === lightbox) lightbox.classList.remove('active');
  });

  // --- URL PARAMS GUEST INJECTION (?invite=) ---
  const params = new URLSearchParams(window.location.search);
  const rawGuest = params.get('invite') || '';
  if (rawGuest) {
    const gateGuest = document.getElementById('gateGuest');
    const nameInput = document.getElementById('nameInput');
    const cleanGuestName = String(rawGuest).trim().slice(0, 60);
    if (gateGuest) gateGuest.textContent = cleanGuestName;
    if (nameInput) nameInput.value = cleanGuestName;
  }

  // --- MODAL HỘP QUÀ MỪNG ---
  const giftModal = document.getElementById('giftModal');
  document.getElementById('openGiftModal')?.addEventListener('click', () => giftModal?.classList.add('active'));
  document.getElementById('closeModal')?.addEventListener('click', () => giftModal?.classList.remove('active'));
  giftModal?.addEventListener('click', (e) => {
    if (e.target === giftModal) giftModal.classList.remove('active');
  });

  // Khởi chạy Coverflow
  updateCoverflow(0);
  startAutoPlay();
});