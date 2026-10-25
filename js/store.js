import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, signOut as fbOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, collection, setDoc, getDoc, onSnapshot, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from './config.js';
const app = initializeApp(firebaseConfig), auth = getAuth(app), db = getFirestore(app);
let timer = null;
const plain = g => JSON.parse(JSON.stringify(g));
export const onAuth = cb => onAuthStateChanged(auth, cb);
export const signIn = (e, p) => signInWithEmailAndPassword(auth, e, p);
export const signOut = () => fbOut(auth);
export async function signUp(e, p, name) { const c = await createUserWithEmailAndPassword(auth, e, p); if (name) await updateProfile(c.user, { displayName: name }); }
export async function create(g) { const ref = doc(collection(db, 'games')); await setDoc(ref, plain(g)); return ref.id; }
// Human actions save immediately (so closing the tab cannot undo a roll); NPC steps are debounced.
export function save(id, g, now = false) {
  clearTimeout(timer);
  const w = () => setDoc(doc(db, 'games', id), plain(g)).catch(console.error);
  now ? w() : timer = setTimeout(w, 350);
}
export const get = async id => { const s = await getDoc(doc(db, 'games', id)); return s.exists() ? s.data() : null; };
export const watch = (id, cb) => onSnapshot(doc(db, 'games', id), s => s.exists() && cb(s.data()));
export async function mine(uid) { const s = await getDocs(query(collection(db, 'games'), where('ownerUid', '==', uid))); return s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => b.created - a.created); }
