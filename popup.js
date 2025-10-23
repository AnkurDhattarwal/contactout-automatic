// popup.js

// ---------- FIREBASE CONFIG - REPLACE with your project's config ----------
const firebaseConfig = {
  apiKey: "AIzaSyBqcYdVljekXaMZuGsI8csstyDgMYG6f8s",
  authDomain: "bulk-cold-mailer.firebaseapp.com",
  projectId: "bulk-cold-mailer",
  storageBucket: "bulk-cold-mailer.firebasestorage.app",
  messagingSenderId: "592930324212",
  appId: "1:592930324212:web:60727390742b02fcbaa8a1",
  measurementId: "G-FHFV89P5PJ"
};
// -------------------------------------------------------------------------

// Initialize Firebase (compat)
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const firestore = firebase.firestore();

const signupBtn = document.getElementById('signupBtn');
const signinBtn = document.getElementById('signinBtn');
const startBtn = document.getElementById('startBtn');
const emailInp = document.getElementById('email');
const passInp = document.getElementById('password');
const authStatus = document.getElementById('authStatus');
const phaseEl = document.getElementById('phase');
const countsEl = document.getElementById('counts');
const progressBar = document.getElementById('progressBar');
const googleBtn = document.getElementById('googleBtn');
const logoutBtn = document.getElementById('logoutBtn'); // NEW



function setPhase(t) { phaseEl.textContent = t; }
function setProgress(r) { progressBar.style.width = Math.max(0, Math.min(1, r)) * 100 + '%'; }

async function refreshStoredCount(userEmail) {
  if (!userEmail) {
    countsEl.textContent = 'Stored: 0';
    return;
  }
  try {
    const docRef = firestore.collection('users').doc(userEmail);
    const docSnap = await docRef.get();
    if (!docSnap.exists) { countsEl.textContent = 'Stored: 0'; return; }
    const data = docSnap.data() || {};
    // <-- UPDATED: pendingMails is now an array directly on the user doc
    const pending = Array.isArray(data.pendingMails) ? data.pendingMails.length : 0;
    countsEl.textContent = `Stored: ${pending}`;
  } catch (err) {
    console.error('count fetch error', err);
    countsEl.textContent = 'Stored: ?';
  }
}



// NEW: logout handler
logoutBtn.addEventListener('click', async () => {
  try {
    await auth.signOut();
    setPhase('Signed out.');
    // auth.onAuthStateChanged will update UI and counts
  } catch (err) {
    console.error('Sign out error', err);
    setPhase('Sign out failed: ' + (err && err.message ? err.message : String(err)));
  }
});

// auth observers
auth.onAuthStateChanged(user => {
  if (user) {
    authStatus.textContent = `Signed in: ${user.email}`;
    authStatus.style.color = '#0b6';
    startBtn.disabled = false;
    refreshStoredCount(user.email);
  } else {
    authStatus.textContent = 'Not signed in.';
    authStatus.style.color = '#c33';
    startBtn.disabled = true;
    refreshStoredCount(null);
  }
});

// signup & signin handlers
signupBtn.addEventListener('click', async () => {
  const email = emailInp.value.trim();
  const pass = passInp.value;
  if (!email || !pass) { authStatus.textContent = 'Provide email/password.'; return; }
  setPhase('Signing up...');
  try {
    await auth.createUserWithEmailAndPassword(email, pass);
    setPhase('Signed up.');
  } catch (e) {
    console.error(e);
    setPhase('Signup error: ' + e.message);
  }
});

signinBtn.addEventListener('click', async () => {
  const email = emailInp.value.trim();
  const pass = passInp.value;
  if (!email || !pass) { authStatus.textContent = 'Provide email/password.'; return; }
  setPhase('Signing in...');
  try {
    await auth.signInWithEmailAndPassword(email, pass);
    setPhase('Signed in.');
  } catch (e) {
    console.error(e);
    setPhase('Signin error: ' + e.message);
  }
});

// START button: inject content.js to active tab and request CLICK_AND_SCRAPE
startBtn.addEventListener('click', async () => {
  const user = auth.currentUser;
  if (!user) { setPhase('Sign in first'); return; }
  setPhase('Preparing...');
  setProgress(0);

  // get active tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) { setPhase('No active tab'); return; }

  // Inject content.js into the page
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js']
    });
  } catch (e) {
    console.error('inject error', e);
    setPhase('Injection failed: ' + e.message);
    return;
  }

  setPhase('Clicking & scraping...');
  setProgress(0.1);

  // Send message to content script to start flow and wait for response
  chrome.tabs.sendMessage(tab.id, { cmd: 'CLICK_AND_SCRAPE' }, async (res) => {
    if (chrome.runtime.lastError) {
      console.error('sendMessage error', chrome.runtime.lastError);
      setPhase('Page script failed (see console)');
      return;
    }

    if (!res || !res.ok) {
      setPhase('Scrape failed: ' + (res && res.error ? res.error : 'unknown'));
      return;
    }

    setPhase('Scrape finished; pushing to Firestore...');
    setProgress(0.6);

    const kept = res.kept || [];
    const userEmail = user.email;

    if (!kept.length) {
      setPhase('No emails to append after filter.');
      setProgress(1);
      // still refresh count
      refreshStoredCount(userEmail);
      return;
    }

    try {
      // Build the field: pendingMails (array) directly on the user doc
      const docRef = firestore.collection('users').doc(userEmail);
      // Use arrayUnion to append without duplicates to pendingMails array
      await docRef.set({ pendingMails: firebase.firestore.FieldValue.arrayUnion(...kept) }, { merge: true });

      setPhase(`Appended ${kept.length} emails.`);
      setProgress(1);
      // Refresh stored count (reads doc)
      await refreshStoredCount(userEmail);
    } catch (err) {
      console.error('Firestore write error', err);
      setPhase('Firestore write error: ' + err.message);
    }
  });
});
