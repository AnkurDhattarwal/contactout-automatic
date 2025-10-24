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
const stopBtn = document.getElementById('stopBtn');
const emailInp = document.getElementById('email');
const passInp = document.getElementById('password');
const authStatus = document.getElementById('authStatus');
const phaseEl = document.getElementById('phase');
const countsEl = document.getElementById('counts');
const progressBar = document.getElementById('progressBar');
const googleBtn = document.getElementById('googleBtn');
const logoutBtn = document.getElementById('logoutBtn');

const titlesListEl = document.getElementById('titlesList');
const newTitleInp = document.getElementById('newTitle');
const addTitleBtn = document.getElementById('addTitleBtn');
const companyInp = document.getElementById('company');
const pageFromInp = document.getElementById('pageFrom');
const pageToInp = document.getElementById('pageTo');

let stopRequested = false; // controlled by Stop button

// Default titles
let titles = [
  "Talent Acquisition Specialist",
  "Talent Acquisition Manager",
  "Talent Acquisition",
  "Talent Manager",
  "Talent Acquisition Consultant",
  "Talent Acquisition Coordinator",
  "Talent Acquisition partner",
  "Engineering  manager"
];

// render titles UI
function renderTitles() {
  titlesListEl.innerHTML = '';
  titles.forEach((t, idx) => {
    const wrap = document.createElement('div');
    wrap.style.display = 'flex';
    wrap.style.gap = '8px';
    wrap.style.marginTop = '6px';
    const span = document.createElement('div');
    span.textContent = t;
    span.style.flex = '1';
    const btn = document.createElement('button');
    btn.textContent = 'Remove';
    btn.style.flex = '0 0 auto';
    btn.addEventListener('click', () => {
      // must keep at least 1
      if (titles.length <= 1) {
        setPhase('At least one title required.');
        return;
      }
      titles.splice(idx, 1);
      renderTitles();
    });
    wrap.appendChild(span);
    wrap.appendChild(btn);
    titlesListEl.appendChild(wrap);
  });
}
renderTitles();

addTitleBtn.addEventListener('click', () => {
  const v = newTitleInp.value.trim();
  if (!v) return;
  titles.push(v);
  newTitleInp.value = '';
  renderTitles();
});

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
    // pendingMails is now an array directly on the doc
    const pending = Array.isArray(data.pendingMails) ? data.pendingMails.length : 0;
    countsEl.textContent = `Stored: ${pending}`;
  } catch (err) {
    console.error('count fetch error', err);
    countsEl.textContent = 'Stored: ?';
  }
}

// Google sign-in (keeps your existing popup-based approach)
googleBtn.addEventListener('click', async () => {
  setPhase('Signing in with Google...');
  try {
    const provider = new firebase.auth.GoogleAuthProvider();
    const result = await auth.signInWithPopup(provider);
    setPhase(`Signed in: ${result.user.email}`);
  } catch (err) {
    console.error('Google sign-in popup error', err);
    setPhase('Google sign-in failed: ' + (err.message || err));
  }
});

// logout handler
logoutBtn.addEventListener('click', async () => {
  try {
    await auth.signOut();
    setPhase('Signed out.');
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

// signup & signin handlers (unchanged)
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

// helper: wait for tab load complete (resolves when changeInfo.status === 'complete' for that tab)
function waitForTabComplete(tabId, timeoutMs = 20000) {
  return new Promise((resolve, reject) => {
    const onUpdated = (updatedTabId, changeInfo, tab) => {
      if (updatedTabId === tabId && changeInfo.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(onUpdated);
        resolve(tab);
      }
    };
    chrome.tabs.onUpdated.addListener(onUpdated);

    // timeout
    const timer = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(onUpdated);
      reject(new Error('Tab load timeout'));
    }, timeoutMs);
  });
}

// helper: inject content.js into tab
function injectContentScript(tabId) {
  return chrome.scripting.executeScript({
    target: { tabId },
    files: ['content.js']
  });
}

// helper: send message to content script and await response (promisified)
function sendMessageToTab(tabId, message, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    let called = false;
    chrome.tabs.sendMessage(tabId, message, (response) => {
      called = true;
      if (chrome.runtime.lastError) {
        return reject(new Error(chrome.runtime.lastError.message));
      }
      resolve(response);
    });
    // timeout guard
    setTimeout(() => {
      if (!called) reject(new Error('content script timed out'));
    }, timeoutMs);
  });
}

// Stop button behavior
stopBtn.addEventListener('click', () => {
  stopRequested = true;
  setPhase('Stopping requested...');
  stopBtn.disabled = true;
  // broadcast ABORT to the active tab's content script (best-effort)
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs && tabs[0]) {
      try {
        chrome.tabs.sendMessage(tabs[0].id, { cmd: 'ABORT' }, () => { /* ignore */ });
      } catch (e) { /* ignore */ }
    }
  });
});

// MAIN START behavior
startBtn.addEventListener('click', async () => {
  const user = auth.currentUser;
  if (!user) { setPhase('Sign in first'); return; }

  // Validation
  if (!titles || titles.length === 0) {
    setPhase('At least one title is required.');
    return;
  }
  const company = companyInp.value.trim();
  if (!company) {
    setPhase('Company is required.');
    return;
  }
  let pageFrom = parseInt(pageFromInp.value, 10) || 1;
  let pageTo = parseInt(pageToInp.value, 10) || 2147483647;
  if (pageFrom < 1) pageFrom = 1;
  if (pageTo < pageFrom) {
    setPhase('Page to must be >= Page from.');
    return;
  }

  stopRequested = false;
  startBtn.disabled = true;
  stopBtn.disabled = false;

  // compute total pages for progress calculation (cap to something reasonable if INT_MAX)
  const totalPages = (pageTo === 2147483647) ? 1000000 : (pageTo - pageFrom + 1);

  // active tab check: require active tab host contains contactout.com
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.url) {
    setPhase('Open a contactout.com tab and try again.');
    startBtn.disabled = false;
    stopBtn.disabled = true;
    return;
  }
  let hostname = '';
  try {
    hostname = new URL(tab.url).hostname;
  } catch (e) {
    hostname = '';
  }
  if (!hostname.includes('contactout.com')) {
    setPhase('Active tab must be on contactout.com.');
    startBtn.disabled = false;
    stopBtn.disabled = true;
    return;
  }

  setPhase('Starting pages loop...');
  let currentPage = pageFrom;
  let addedTotal = 0;

  // loop over pages
  for (; currentPage <= pageTo; currentPage++) {
    if (stopRequested) {
      setPhase('Stopped by user.');
      break;
    }

    // build titles param: join with pipe and encode
    const titleParam = encodeURIComponent(titles.join('|'));
    const encCompany = encodeURIComponent(company);
    const url = `https://contactout.com/dashboard/search?company=${encCompany}&location=India&page=${currentPage}&title=${titleParam}`;

    setPhase(`Navigating to page ${currentPage}...`);
    try {
      await chrome.tabs.update(tab.id, { url });
    } catch (e) {
      console.error('tabs.update error', e);
      setPhase('Navigation failed: ' + (e && e.message ? e.message : e));
      break;
    }

    // wait for complete (or timeout)
    try {
      const loadedTab = await waitForTabComplete(tab.id, 30000);
      // small extra delay to let dynamic content settle
      await new Promise(r => setTimeout(r, 1000));

      // check login redirect
      const finalUrl = loadedTab.url || '';
      if (finalUrl.includes('/login')) {
        setPhase('Not logged in on contactout.com (redirected to /login). Aborting.');
        break;
      }

      // check for the "We couldn't find what you’re searching for." message immediately on page
      // We'll also let content script report it after scraping.
      const pageText = await sendMessageToTab(tab.id, { cmd: 'GET_PAGE_TEXT' }).catch(() => null);
      const bodyText = (pageText && pageText.text) ? pageText.text : '';
      if (bodyText && (bodyText.includes("We couldn't find what you’re searching for.") || bodyText.includes("We couldn't find what you're searching for."))) {
        setPhase('No results on page: stopping loop.');
        break;
      }

      // inject content script to ensure listener present
      try {
        await injectContentScript(tab.id);
      } catch (e) {
        // injection might fail due to CSP; still try sending message
        console.warn('Injection might have failed (CSP). Continuing to send message if allowed.', e);
      }

      // Ask content script to click all "view email" (50ms gap) and extract emails
      setPhase(`Clicking view-email buttons on page ${currentPage}...`);
      const msg = { cmd: 'CLICK_AND_SCRAPE', clickGap: 50 };
      const res = await sendMessageToTab(tab.id, msg, 60000).catch(err => {
        console.error('sendMessageToTab error', err);
        return { ok: false, error: String(err) };
      });

      if (!res || !res.ok) {
        setPhase('Content script failed: ' + (res && res.error ? res.error : 'unknown'));
        // If it failed due to not being logged in, check
        if (res && res.error && String(res.error).toLowerCase().includes('login')) {
          break;
        }
        // continue to next page or break? continue
        continue;
      }

      // if page contains the "we couldn't find..." message reported by content script, break
      if (res.foundEmptyMessage) {
        setPhase('Search returned no results on this page. Stopping.');
        break;
      }

      const allExtracted = res.all || [];
      // apply "up to two before sales@contactout.com" rule (same as content did, but safe to reapply)
      const target = 'sales@contactout.com';
      const targetIndex = allExtracted.indexOf(target);
      let kept;
      if (targetIndex === -1) kept = allExtracted.slice();
      else if (targetIndex >= 2) kept = allExtracted.slice(0, targetIndex - 1);
      else kept = [];

      setPhase(`Found ${allExtracted.length}, keeping ${kept.length}. Pushing to Firestore...`);
      setProgress((currentPage - pageFrom + 1) / Math.max(1, totalPages));

      if (kept.length > 0) {
        try {
          const docRef = firestore.collection('users').doc(user.email);
          // merge with arrayUnion on pendingMails array
          await docRef.set({ pendingMails: firebase.firestore.FieldValue.arrayUnion(...kept) }, { merge: true });
          addedTotal += kept.length;
        } catch (err) {
          console.error('Firestore write error', err);
          setPhase('Firestore write error: ' + (err && err.message ? err.message : String(err)));
        }
      } else {
        // nothing to push
      }

      // refresh stored count
      await refreshStoredCount(user.email);

      // update progress; small delay before next page
      await new Promise(r => setTimeout(r, 200));
      // check stopRequested again
      if (stopRequested) {
        setPhase('Stopped by user.');
        break;
      }

      // continue to next page
    } catch (err) {
      console.error('Error during page processing', err);
      setPhase('Error: ' + (err && err.message ? err.message : String(err)));
      break;
    }
  } // loop end

  setPhase(`Finished. Added approx ${addedTotal} (may include duplicates filtered by Firestore).`);
  setProgress(1);
  startBtn.disabled = false;
  stopBtn.disabled = true;
});
