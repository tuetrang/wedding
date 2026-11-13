const firebaseConfig = {
  apiKey: "AIzaSyDx1qlBYwO8wcCZSea7p59G5AzALtxowSE",
  authDomain: "wedding-tue-trang.firebaseapp.com",
  databaseURL: "https://wedding-tue-trang-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "wedding-tue-trang",
  storageBucket: "wedding-tue-trang.firebasestorage.app",
  messagingSenderId: "334588024809",
  appId: "1:334588024809:web:53a5e782af631506fadd78"
};

let wishesRef = null;
let firebaseReady = false;

try {
  if (typeof firebase === 'undefined') {
    throw new Error('SDK Firebase chưa tải được.');
  }
  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }
  if (firebaseConfig.databaseURL) {
    wishesRef = firebase.database().ref('rsvp');
  }
  firebaseReady = true;
} catch (e) {
  firebaseReady = false;
  console.error('[firebase-config] Lỗi khởi tạo Firebase:', e.message || e);
}