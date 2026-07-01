// Firebase SDK v10.12.2 (ES Modules)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, query, orderBy, limit, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// TODO: Bu objeyi Firebase Console'dan alınan kendi yapılandırmanız ile değiştirin.
const firebaseConfig = {
    apiKey: "AIzaSyBYIhRyrcuGXVCMjkm9g7vXKUeq2K9Rcyo",
    authDomain: "faizkari.firebaseapp.com",
    projectId: "faizkari",
    storageBucket: "faizkari.firebasestorage.app",
    messagingSenderId: "756372096869",
    appId: "1:756372096869:web:7e9a3b7c4bc4572757c38c",
    measurementId: "G-JVEXYF6EKZ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Cloud Firestore and get a reference to the service
export const db = getFirestore(app);

// Veritabanı fonksiyonları (Aşama 6 için ön hazırlık)
export { collection, addDoc, getDocs, query, orderBy, limit, onSnapshot, serverTimestamp };
