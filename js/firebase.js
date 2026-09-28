// ===== FIREBASE INIT =====

const firebaseConfig = {
  apiKey: "AIzaSyCF1o7_h-70-HwfC_5YoxOmTJFTBfFa04w",
  authDomain: "fighting-path-patch.firebaseapp.com",
  projectId: "fighting-path-patch",
  storageBucket: "fighting-path-patch.firebasestorage.app",
  messagingSenderId: "1071337898551",
  appId: "1:1071337898551:web:d6f2c10f0f29e430a675b2",
  measurementId: "G-VMY3PHGN4C"
};

firebase.initializeApp(firebaseConfig);

var db = firebase.firestore();
var auth = firebase.auth();

// Firebase Storage는 더 이상 사용하지 않습니다.
// 이미지 업로드는 GitHub API + jsDelivr CDN으로 대체되었습니다.