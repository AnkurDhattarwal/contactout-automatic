// content.js

let abortFlag = false;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function extractEmailsFromBlob(blob) {
  const emailRe = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
  const found = blob.match(emailRe) || [];
  // unique
  return [...new Set(found.map(s => s.trim()))];
}

function checkNoResultsText(text) {
  if (!text) return false;
  const variants = [
    "We couldn't find what you’re searching for.",
    "We couldn't find what you're searching for.",
    "We couldn’t find what you’re searching for.",
    "We couldn’t find what you're searching for."
  ];
  for (const v of variants) {
    if (text.includes(v)) return true;
  }
  // also check lowercase
  const lower = text.toLowerCase();
  if (lower.includes("we couldn't find what you're searching for") || lower.includes("we couldn't find what you’re searching for")) return true;
  return false;
}

async function clickAllViewEmailButtons(clickGap = 50) {
  abortFlag = false;
  const matches = [...document.querySelectorAll('button, input[type="button"], a')]
    .filter(el => ((el.textContent || el.value || '').trim().toLowerCase() === 'view email'));

  if (!matches.length) return { clicked: 0 };

  for (let i = 0; i < matches.length; i++) {
    if (abortFlag) {
      return { clicked: i, aborted: true };
    }
    const el = matches[i];
    try {
      el.scrollIntoView({ behavior: 'auto', block: 'center' });
      ['mousedown','mouseup','click'].forEach(type =>
        el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }))
      );
    } catch (e) {
      // ignore single-element errors
    }
    await sleep(clickGap);
  }

  return { clicked: matches.length, aborted: false };
}

// GET_PAGE_TEXT handler returns document text quickly
function getPageText() {
  try {
    return { text: document.body ? document.body.innerText || '' : '' };
  } catch (e) {
    return { text: '' };
  }
}

// Listen for messages
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || !msg.cmd) return;

  if (msg.cmd === 'ABORT') {
    abortFlag = true;
    sendResponse({ ok: true, aborted: true });
    return;
  }

  if (msg.cmd === 'GET_PAGE_TEXT') {
    const res = getPageText();
    sendResponse({ ok: true, text: res.text });
    return;
  }

  if (msg.cmd === 'CLICK_AND_SCRAPE') {
    (async () => {
      try {
        const gap = typeof msg.clickGap === 'number' ? msg.clickGap : 50;
        abortFlag = false;
        const clickRes = await clickAllViewEmailButtons(gap);
        if (clickRes.aborted) {
          sendResponse({ ok: false, error: 'Aborted', clicked: clickRes.clicked });
          return;
        }
        // wait 5s to let emails appear
        let totalWait = 0;
        const waitStep = 200;
        while (totalWait < 5000) {
          if (abortFlag) {
            sendResponse({ ok: false, error: 'Aborted', clicked: clickRes.clicked });
            return;
          }
          await sleep(waitStep);
          totalWait += waitStep;
        }

        // extract emails from page text, hrefs, attrs
        const pageText = document.documentElement ? document.documentElement.innerText || '' : '';
        const hrefs = [...document.querySelectorAll('[href]')].map(a => a.getAttribute('href') || '').join(' ');
        const allAttrs = [...document.querySelectorAll('*')].map(el => {
          return [...el.attributes].map(attr => attr.value).join(' ');
        }).join(' ');
        const blob = [pageText, hrefs, allAttrs].join(' ');

        const allEmails = extractEmailsFromBlob(blob);

        // check for no-results text
        const foundEmpty = checkNoResultsText(pageText);

        sendResponse({ ok: true, clicked: clickRes.clicked, all: allEmails, foundEmptyMessage: foundEmpty });
      } catch (e) {
        sendResponse({ ok: false, error: e && e.message ? e.message : String(e) });
      }
    })();
    return true; // indicate async
  }
});
