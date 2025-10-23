// content.js

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function clickAllViewEmailButtons() {
  const matches = [...document.querySelectorAll('button, input[type="button"], a')]
    .filter(el => ((el.textContent || el.value || '').trim().toLowerCase() === 'view email'));

  if (!matches.length) return { clicked: 0 };

  for (let i = 0; i < matches.length; i++) {
    const el = matches[i];
    try {
      el.scrollIntoView({ behavior: 'auto', block: 'center' });
      ['mousedown','mouseup','click'].forEach(type => el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window })));
    } catch (e) { /* ignore per-element error */ }
    await sleep(100);
  }
  return { clicked: matches.length };
}

function extractEmailsFromPage() {
  const pageText = document.documentElement.innerText || '';
  const hrefs = [...document.querySelectorAll('[href]')].map(a => a.getAttribute('href') || '').join(' ');
  const allAttrs = [...document.querySelectorAll('*')].map(el => [...el.attributes].map(attr => attr.value).join(' ')).join(' ');
  const blob = [pageText, hrefs, allAttrs].join(' ');
  const emailRe = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
  const found = blob.match(emailRe) || [];
  return [...new Set(found.map(s => s.trim()))];
}

function applyTargetFilter(emails) {
  const target = 'sales@contactout.com';
  const idx = emails.indexOf(target);
  if (idx === -1) return emails.slice();
  if (idx >= 2) return emails.slice(0, idx - 1);
  return [];
}

// Listen for command
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || msg.cmd !== 'CLICK_AND_SCRAPE') return;
  (async () => {
    try {
      await clickAllViewEmailButtons();
      await sleep(5000); // wait for revealed emails to appear
      const all = extractEmailsFromPage();
      const kept = applyTargetFilter(all);
      sendResponse({ ok: true, clicked: true, extracted: all.length, kept: kept });
    } catch (e) {
      sendResponse({ ok: false, error: e.message || String(e) });
    }
  })();
  return true; // indicates async sendResponse
});
