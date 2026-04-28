const firebaseConfig = {
  apiKey: "AIzaSyAkuutHn_l4CkiVX8j_OmTzHKYfL4JVxHY",
  authDomain: "trecker-work.firebaseapp.com",
  databaseURL: "https://trecker-work-default-rtdb.firebaseio.com",
  projectId: "trecker-work",
  storageBucket: "trecker-work.firebasestorage.app",
  messagingSenderId: "940486950825",
  appId: "1:940486950825:web:e5bb521dfdcab3d3b28eb8",
  measurementId: "G-772486F5NC"
};

const isConfigured = Object.values(firebaseConfig).every(
  (value) => typeof value === "string" && value.length > 0 && !value.startsWith("PASTE_YOUR_"),
);

// ... остальной код в файле остается БЕЗ ИЗМЕНЕНИЙ! ...

let firebase = {
  isConfigured: false,
  auth: null,
  db: null,
  GoogleAuthProvider: null,
  signInWithPopup: null, // Изменили с Popup на Redirect для телефонов
  signOut: null,
  onAuthStateChanged: null, // Добавили слушатель сессии
  collection: null,
  query: null,
  where: null,
  orderBy: null,
  onSnapshot: null,
  addDoc: null,
  updateDoc: null,
  deleteDoc: null,
  doc: null,
  serverTimestamp: null,
};

if (isConfigured) {
  const { initializeApp } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js");
  const {
    browserLocalPersistence,
    getAuth,
    GoogleAuthProvider,
    setPersistence,
    signInWithPopup, // Изменили
    signOut,
    onAuthStateChanged // Добавили
  } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js");
  const {
    addDoc, collection, deleteDoc, doc, getFirestore, onSnapshot,
    orderBy, query, serverTimestamp, updateDoc, where
  } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");

  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  await setPersistence(auth, browserLocalPersistence);

  firebase = {
    isConfigured: true,
    auth,
    db: getFirestore(app),
    GoogleAuthProvider,
    signInWithPopup,
    signOut,
    onAuthStateChanged,
    collection, query, where, orderBy, onSnapshot,
    addDoc, updateDoc, deleteDoc, doc, serverTimestamp,
  };
}

window.firebaseServices = firebase;
