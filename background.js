// background.js
// Listen for messages from content scripts or popup if needed later
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === 'APPEND_EMAILS') {
    appendEmails(msg.emails).then(({ added, total }) => {
      sendResponse({ ok: true, added, total });
    });
    return true; // async response
  }
});

// Dedup + persist in storage
async function appendEmails(newOnes = []) {
  const norm = s => (s || '').trim().toLowerCase();
  const { emails = [] } = await chrome.storage.local.get('emails');
  const set = new Set(emails.map(norm));
  const toAdd = [];
  for (const e of newOnes) {
    const n = norm(e);
    if (n && !set.has(n)) { set.add(n); toAdd.push(e.trim()); }
  }
  if (toAdd.length) {
    await chrome.storage.local.set({ emails: [...emails, ...toAdd] });
  }
  return { added: toAdd.length, total: set.size };
}
