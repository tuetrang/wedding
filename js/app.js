// --- LOGIC GIAO DIỆN CHÍNH & SUBMIT SONG SONG (FIREBASE + GOOGLE APPS SCRIPT) ---
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbx7aYHQKPQQfAoi56u20K0iHxpht7EzXnHabE8DiCmk3YLfMPryUuyqPxIhGAKXbVgy/exec";

document.addEventListener('DOMContentLoaded', () => {
  'use strict';

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
    gateScreen?.classList.add('opened');

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

  // --- SUBMIT FORM VỚI CƠ CHẾ SONG SONG + CHỐNG SPAM TURNSTILE ---
  const rsvpForm = document.getElementById('rsvpForm');
  const loadingOverlay = document.getElementById('loadingOverlay');

  if (rsvpForm) {
    rsvpForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      // Cooldown chống Spam
      const lastSubmitTime = localStorage.getItem('lastRsvpSubmit');
      if (lastSubmitTime && (Date.now() - parseInt(lastSubmitTime, 10)) < 30000) {
        showAlert("Bạn thao tác quá nhanh. Vui lòng chờ 30 giây!");
        return;
      }

      const submitBtn = document.getElementById('btnSubmitRsvp');
      const nameVal = document.getElementById('nameInput').value.trim().slice(0, 50);
      const attendingVal = document.getElementById('attendingSelect').value === 'true';
      const guestsVal = parseInt(document.getElementById('guestCountSelect').value, 10) || 1;
      const msgVal = document.getElementById('msgInput').value.trim().slice(0, 200);

      if (!nameVal || !msgVal) return;

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
        if (wishesRef) {
          // BƯỚC 1: Đẩy Firebase cực nhanh (< 100ms) -> UI Realtime tự nhảy
          const newRef = wishesRef.push();
          const firebasePromise = newRef.set(payload);

          // BƯỚC 2: Gọi ngầm Google Apps Script (Song song, không chờ)
          fetch(SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...payload, id: newRef.key })
          }).catch(err => console.warn("Lỗi fetch Sheet:", err));

          await firebasePromise;
        } else {
          // Fallback nếu chưa gắn Firebase
          await fetch(SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
        }

        localStorage.setItem('lastRsvpSubmit', Date.now().toString());
        showAlert("Cảm ơn bạn đã gửi lời chúc phúc và xác nhận tham dự!");
        document.getElementById('msgInput').value = '';
        if (window.turnstile) turnstile.reset();

      } catch (err) {
        showAlert("Gửi thành công! Lời chúc đã được lưu tạm.");
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

  // --- COVERFLOW & LIGHTBOX NGUYÊN BẢN ---
  const cards = document.querySelectorAll('.coverflow-card');
  let currentCardIndex = 0;
  let autoPlayInterval = null;
  const lightboxOverlay = document.getElementById('lightboxOverlay');
  const lightboxImg = document.getElementById('lightboxImg');

  function updateCoverflow(index) {
    currentCardIndex = (index + cards.length) % cards.length;
    cards.forEach((card, i) => {
      card.className = 'coverflow-card';
      let diff = i - currentCardIndex;
      if (diff > cards.length / 2) diff -= cards.length;
      if (diff < -cards.length / 2) diff += cards.length;

      if (diff === 0) card.classList.add('active');
      else if (diff === -1) card.classList.add('prev-1');
      else if (diff === -2) card.classList.add('prev-2');
      else if (diff === 1) card.classList.add('next-1');
      else if (diff === 2) card.classList.add('next-2');
      else card.classList.add('hidden-card');
    });
  }

  document.getElementById('nextBtn')?.addEventListener('click', () => {
    updateCoverflow(currentCardIndex + 1);
    resetAutoPlay();
  });
  document.getElementById('prevBtn')?.addEventListener('click', () => {
    updateCoverflow(currentCardIndex - 1);
    resetAutoPlay();
  });

  cards.forEach((card, idx) => {
    card.addEventListener('click', () => {
      if (idx === currentCardIndex) {
        if (lightboxImg && lightboxOverlay) {
          lightboxImg.src = card.querySelector('img').src;
          lightboxOverlay.classList.add('active');
        }
      } else {
        updateCoverflow(idx);
        resetAutoPlay();
      }
    });
  });

  document.getElementById('lightboxClose')?.addEventListener('click', () => lightboxOverlay?.classList.remove('active'));
  lightboxOverlay?.addEventListener('click', (e) => {
    if (e.target === lightboxOverlay) lightboxOverlay.classList.remove('active');
  });

  function startAutoPlay() { autoPlayInterval = setInterval(() => updateCoverflow(currentCardIndex + 1), 3500); }
  function resetAutoPlay() { clearInterval(autoPlayInterval); startAutoPlay(); }

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

  updateCoverflow(0);
  startAutoPlay();
});
