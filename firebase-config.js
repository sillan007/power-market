import { initializeApp } from "https://gstatic.com";
import {
  getFirestore, collection, addDoc, doc, getDoc, setDoc, updateDoc,
  onSnapshot, query, orderBy, runTransaction, getDocs, deleteDoc,
  arrayUnion, arrayRemove,
} from "https://gstatic.com";
import {
  getStorage, ref as sRef, uploadBytes, getDownloadURL, deleteObject
} from "https://gstatic.com";

const firebaseConfig = {
  apiKey: "AIzaSyAfizlzLBNDRHwzEkSpJ35mSJAKvbuw6uo",
  authDomain: "://firebaseapp.com",
  projectId: "power-market-f9573",
  storageBucket: "power-market-f9573.firebasestorage.app",
  messagingSenderId: "1005808106144",
  appId: "1:1005808106144:web:faef2e17c612833aec67c5",
  measurementId: "G-59F20MY2ST"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);

window.fb = {
  watchItems(cb) {
    const q = query(collection(db, "items"), orderBy("createdAt", "desc"));
    return onSnapshot(q, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
  },
  async addItem(data) {
    await addDoc(collection(db, "items"), { ...data, createdAt: Date.now() });
  },
  async updateItem(id, data) {
    await updateDoc(doc(db, "items", id), data);
  },
  async deleteItem(id, imagePath) {
    await deleteDoc(doc(db, "items", id));
    if (imagePath) {
      try {
        await deleteObject(sRef(storage, imagePath));
      } catch (e) {
        console.error("실물 사진 파기 실패:", e);
      }
    }
  },
  async uploadImage(file, myId) {
    const imagePath = `items/${Date.now()}_${myId}`;
    const fileRef = sRef(storage, imagePath);
    await uploadBytes(fileRef, file);
    const url = await getDownloadURL(fileRef);
    return { url, imagePath };
  },
  async requestItem(id, myId) {
    await updateDoc(doc(db, "items", id), { requesters: arrayUnion(myId) });
  },
  async cancelRequest(id, myId) {
    await updateDoc(doc(db, "items", id), { requesters: arrayRemove(myId) });
  },
  async getSeason() {
    const ref = doc(db, "meta", "season");
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, { value: 1 });
      return 1;
    }
    return snap.data().value || 1;
  },
  async nextId(season) {
    const ref = doc(db, "meta", `counter-${season}`);
    return runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      const current = snap.exists() ? snap.data().value || 0 : 0;
      const next = current + 1;
      tx.set(ref, { value: next });
      return next;
    });
  },
  async startNewSeason(currentSeason) {
    const nextSeason = currentSeason + 1;
    await setDoc(doc(db, "meta", "season"), { value: nextSeason });
    const snap = await getDocs(collection(db, "items"));
    await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
    return nextSeason;
  },
};
window.__fbReady = true;
