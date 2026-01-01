
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getFirestore, doc, setDoc, getDoc, updateDoc, collection, onSnapshot } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { User, Tournament } from '../types';

// NOTE: Aapko Firebase Console (console.firebase.google.com) se apni config yahan paste karni hogi.
// Tab tak ye "Simulation Mode" me rahega taake app crash na ho.
const firebaseConfig = {
  apiKey: "AIzaSy...", // Paste your API Key
  authDomain: "your-app.firebaseapp.com",
  projectId: "your-app",
  storageBucket: "your-app.appspot.com",
  messagingSenderId: "...",
  appId: "..."
};

let app, auth, db;
let isConfigured = false;

try {
  if (firebaseConfig.apiKey !== "AIzaSy...") {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    isConfigured = true;
  }
} catch (e) {
  console.error("Firebase Initialization Error:", e);
}

export const FirebaseService = {
  isConfigured: () => isConfigured,

  async signUp(userData: any) {
    if (!isConfigured) throw new Error("Firebase Config missing!");
    const userCredential = await createUserWithEmailAndPassword(auth, userData.email, userData.password);
    const user = userCredential.user;
    
    const newUser: User = {
      uid: user.uid,
      username: userData.username,
      email: userData.email,
      balance: 100, // Welcome Bonus
      matchesPlayed: 0,
      totalEarnings: 0
    };

    await setDoc(doc(db, 'users', user.uid), newUser);
    return newUser;
  },

  async signIn(email: string, pass: string) {
    if (!isConfigured) throw new Error("Firebase Config missing!");
    const userCredential = await signInWithEmailAndPassword(auth, email, pass);
    const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));
    return userDoc.data() as User;
  },

  async logout() {
    if (isConfigured) await signOut(auth);
  },

  // Real-time listener for user data (balance etc)
  subscribeUser(uid: string, callback: (user: User) => void) {
    if (!isConfigured) return () => {};
    return onSnapshot(doc(db, 'users', uid), (doc) => {
      if (doc.exists()) callback(doc.data() as User);
    });
  },

  async updateBalance(uid: string, amount: number) {
    if (!isConfigured) return false;
    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, { balance: amount });
    return true;
  }
};
