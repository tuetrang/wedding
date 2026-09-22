// --- CẤU HÌNH FIREBASE REALTIME DATABASE ---
const firebaseConfig = {
  // Thay URL:
  databaseURL: "https://wedding-tue-trang-default-rtdb.asia-southeast1.firebasedatabase.app"
};

let wishesRef = null;
if (firebaseConfig.databaseURL && firebaseConfig.databaseURL !== "FIREBASE_URL") {
  try {
    firebase.initializeApp(firebaseConfig);
    wishesRef = firebase.database().ref('rsvp');
  } catch (e) {
    console.error("Lỗi khởi tạo Firebase:", e);
  }
} else {
  console.warn("Chưa cấu hình Firebase URL trong js/firebase-config.js");
}
