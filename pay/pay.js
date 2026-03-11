/*!
 * OpPay SDK v1.0.0
 * An embeddable payment widget — works like iDEAL
 * Usage: <script src="pay.js"></script>
 *        OpPay.open({ amount: 29.99, currency: 'EUR', merchant: 'My Shop', onSuccess, onFailure })
 */
(function (global) {
  'use strict';

  const BANKS = [
    { id: 'abn',       name: 'ABN AMRO',    icon: '🏦', color: '#007A3C' },
    { id: 'ing',       name: 'ING',         icon: '🦁', color: '#FF6200' },
    { id: 'rabo',      name: 'Rabobank',    icon: '🌱', color: '#003082' },
    { id: 'sns',       name: 'SNS Bank',    icon: '💙', color: '#0070B9' },
    { id: 'asn',       name: 'ASN Bank',    icon: '🌿', color: '#3AAA35' },
    { id: 'bunq',      name: 'bunq',        icon: '⚡', color: '#1DC9A4' },
    { id: 'revolut',   name: 'Revolut',     icon: '🔵', color: '#0075EB' },
    { id: 'n26',       name: 'N26',         icon: '⬛', color: '#26292C' },
  ];

  let overlayEl = null;
  let currentOptions = {};

  function generateTxId() {
    return 'OP' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 7).toUpperCase();
  }

  function formatAmount(amount, currency) {
    return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: currency || 'EUR' }).format(amount);
  }

  function injectStyles() {
    if (document.getElementById('oppay-styles')) return;
    const link = document.createElement('link');
    link.id = 'oppay-styles';
    link.rel = 'stylesheet';
    // Try same-origin relative path, fallback to inline
    const scripts = document.querySelectorAll('script[src]');
    let basePath = '';
    scripts.forEach(s => {
      if (s.src && s.src.includes('pay.js')) {
        basePath = s.src.replace('pay.js', '');
      }
    });
    link.href = basePath + 'pay.css';
    document.head.appendChild(link);
  }

  function buildModal(opts) {
    const { amount, currency, merchant, description } = opts;
    const amountFormatted = formatAmount(amount, currency);

    const banksHTML = BANKS.map(b => `
      <button class="oppay-bank-btn" data-bank="${b.id}" data-bank-name="${b.name}" data-bank-icon="${b.icon}" type="button">
        <span class="oppay-bank-icon" style="background:${b.color}18; font-size:20px;">${b.icon}</span>
        <span>${b.name}</span>
      </button>
    `).join('');

    return `
    <div class="oppay-overlay" id="oppay-overlay" role="dialog" aria-modal="true" aria-label="OpPay Payment">
      <div class="oppay-modal" id="oppay-modal">

        <!-- Header -->
        <div class="oppay-header">
          <div class="oppay-header-top">
            <div class="oppay-logo">
              <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect width="32" height="32" rx="8" fill="rgba(255,255,255,0.2)"/>
                <path d="M8 16C8 11.58 11.58 8 16 8C20.42 8 24 11.58 24 16C24 20.42 20.42 24 16 24" stroke="white" stroke-width="2.5" stroke-linecap="round"/>
                <path d="M16 12V16L19 19" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
                <circle cx="10" cy="22" r="2" fill="white"/>
              </svg>
              OpPay
            </div>
            <button class="oppay-close" id="oppay-close" aria-label="Close">&times;</button>
          </div>
          <div class="oppay-amount-label">Betalen aan / Pay to</div>
          <div style="font-size:15px; font-weight:600; opacity:0.9; margin-bottom:6px;">${merchant}</div>
          <div class="oppay-amount-display">${amountFormatted}</div>
        </div>

        <!-- Steps indicator -->
        <div class="oppay-steps-indicator" id="oppay-dots">
          <div class="oppay-dot active" data-step="0"></div>
          <div class="oppay-dot" data-step="1"></div>
          <div class="oppay-dot" data-step="2"></div>
          <div class="oppay-dot" data-step="3"></div>
        </div>

        <div class="oppay-body">

          <!-- Step 0: Select bank -->
          <div class="oppay-step oppay-active" id="oppay-step-0">
            <div class="oppay-step-title">Selecteer uw bank</div>
            <div class="oppay-step-sub">Choose your bank to continue</div>
            <div class="oppay-banks">${banksHTML}</div>
            <div class="oppay-field">
              <label>Omschrijving / Description (optional)</label>
              <input type="text" id="oppay-desc" placeholder="${description || 'Betaling voor bestelling'}" maxlength="80" />
            </div>
            <button class="oppay-btn oppay-btn-primary" id="oppay-btn-continue" disabled>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              Doorgaan naar bank
            </button>
            <div class="oppay-security">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              256-bit SSL encrypted &bull; Secured by OpPay &bull; PSD2 compliant
            </div>
          </div>

          <!-- Step 1: Confirm -->
          <div class="oppay-step" id="oppay-step-1">
            <div class="oppay-step-title">Bevestig betaling</div>
            <div class="oppay-step-sub">Review and confirm your payment</div>
            <div class="oppay-bank-form">
              <div class="oppay-bank-form-row">
                <span>Merchant</span>
                <span>${merchant}</span>
              </div>
              <div class="oppay-bank-form-row">
                <span>Bank</span>
                <span id="oppay-confirm-bank">—</span>
              </div>
              <div class="oppay-bank-form-row">
                <span>Description</span>
                <span id="oppay-confirm-desc">—</span>
              </div>
              <div class="oppay-bank-form-row">
                <span>Amount</span>
                <span>${amountFormatted}</span>
              </div>
            </div>
            <button class="oppay-btn oppay-btn-primary" id="oppay-btn-confirm">
              ✓ &nbsp;Betaling bevestigen
            </button>
            <button class="oppay-btn oppay-btn-secondary" id="oppay-btn-back">
              ← Terug / Back
            </button>
          </div>

          <!-- Step 2: Bank redirect simulation -->
          <div class="oppay-step" id="oppay-step-2">
            <div class="oppay-bank-screen">
              <div class="oppay-bank-logo-large" id="oppay-redir-icon">🏦</div>
              <div class="oppay-bank-screen-title" id="oppay-redir-title">Verbinding maken...</div>
              <div class="oppay-bank-screen-sub" id="oppay-redir-sub">U wordt doorgestuurd naar uw bank</div>
              <div class="oppay-bank-form" id="oppay-redir-form" style="display:none;">
                <div class="oppay-bank-form-row">
                  <span>Van</span>
                  <span id="oppay-redir-bank">—</span>
                </div>
                <div class="oppay-bank-form-row">
                  <span>Aan</span>
                  <span>${merchant}</span>
                </div>
                <div class="oppay-bank-form-row">
                  <span>Bedrag</span>
                  <span>${amountFormatted}</span>
                </div>
              </div>
              <button class="oppay-btn oppay-btn-primary" id="oppay-btn-authorize" style="display:none;">
                🔐 &nbsp;Autoriseer betaling
              </button>
            </div>
          </div>

          <!-- Step 3: Result -->
          <div class="oppay-step" id="oppay-step-3">
            <div class="oppay-result" id="oppay-result-content">
              <!-- filled dynamically -->
            </div>
          </div>

        </div>
      </div>
    </div>`;
  }

  function setStep(n) {
    document.querySelectorAll('.oppay-step').forEach((el, i) => {
      el.classList.toggle('oppay-active', i === n);
    });
    document.querySelectorAll('.oppay-dot').forEach((dot, i) => {
      dot.classList.toggle('active', i === n);
    });
  }

  function showResult(success, txId) {
    const resultEl = document.getElementById('oppay-result-content');
    if (success) {
      resultEl.innerHTML = `
        <div class="oppay-result-icon success">✓</div>
        <div class="oppay-result-title success">Betaling geslaagd!</div>
        <div class="oppay-result-sub">Your payment was processed successfully.</div>
        <div class="oppay-tx-id">TX: ${txId}</div>
        <button class="oppay-btn oppay-btn-success" id="oppay-btn-done">
          ← Terug naar winkel / Back to shop
        </button>
      `;
    } else {
      resultEl.innerHTML = `
        <div class="oppay-result-icon error">✗</div>
        <div class="oppay-result-title error">Betaling mislukt</div>
        <div class="oppay-result-sub">Something went wrong. Please try again.</div>
        <div class="oppay-tx-id">REF: ${txId}</div>
        <button class="oppay-btn oppay-btn-primary" id="oppay-btn-retry">
          ↺ &nbsp;Opnieuw proberen
        </button>
        <button class="oppay-btn oppay-btn-secondary" id="oppay-btn-done-fail">
          Cancel
        </button>
      `;
    }
    setStep(3);

    const done = document.getElementById('oppay-btn-done');
    if (done) done.addEventListener('click', () => {
      close();
      if (success && currentOptions.onSuccess) currentOptions.onSuccess({ txId, amount: currentOptions.amount });
    });

    const retry = document.getElementById('oppay-btn-retry');
    if (retry) retry.addEventListener('click', () => {
      close();
      if (currentOptions.onFailure) currentOptions.onFailure({ txId, reason: 'declined' });
    });

    const doneFail = document.getElementById('oppay-btn-done-fail');
    if (doneFail) doneFail.addEventListener('click', () => {
      close();
      if (currentOptions.onFailure) currentOptions.onFailure({ txId, reason: 'cancelled' });
    });
  }

  function runBankRedirect(bank) {
    const iconEl = document.getElementById('oppay-redir-icon');
    const titleEl = document.getElementById('oppay-redir-title');
    const subEl = document.getElementById('oppay-redir-sub');
    const formEl = document.getElementById('oppay-redir-form');
    const authBtn = document.getElementById('oppay-btn-authorize');
    const bankNameEl = document.getElementById('oppay-redir-bank');

    iconEl.textContent = bank.icon;
    titleEl.textContent = `${bank.name} — Online Bankieren`;
    subEl.textContent = 'Authenticating secure session...';
    bankNameEl.textContent = bank.name;

    setTimeout(() => {
      subEl.textContent = 'Session established. Please review.';
      formEl.style.display = 'block';
      setTimeout(() => {
        authBtn.style.display = 'flex';
      }, 400);
    }, 1800);

    authBtn.addEventListener('click', () => {
      authBtn.style.display = 'none';
      formEl.style.display = 'none';
      titleEl.textContent = 'Verwerken...';
      subEl.textContent = 'Securing your transaction...';

      // Simulate processing (90% success rate)
      const txId = generateTxId();
      setTimeout(() => {
        const success = Math.random() > 0.1;
        showResult(success, txId);
      }, 2000);
    });
  }

  function open(opts) {
    if (overlayEl) return;
    currentOptions = opts || {};
    injectStyles();

    const wrapper = document.createElement('div');
    wrapper.innerHTML = buildModal(opts);
    overlayEl = wrapper.firstElementChild;
    document.body.appendChild(overlayEl);

    // Prevent body scroll
    document.body.style.overflow = 'hidden';

    // Trigger animation
    requestAnimationFrame(() => {
      requestAnimationFrame(() => overlayEl.classList.add('oppay-visible'));
    });

    let selectedBank = null;

    // Bank selection
    overlayEl.querySelectorAll('.oppay-bank-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        overlayEl.querySelectorAll('.oppay-bank-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        selectedBank = BANKS.find(b => b.id === btn.dataset.bank);
        document.getElementById('oppay-btn-continue').disabled = false;
      });
    });

    // Continue to confirm
    document.getElementById('oppay-btn-continue').addEventListener('click', () => {
      if (!selectedBank) return;
      const desc = document.getElementById('oppay-desc').value || opts.description || 'Betaling';
      document.getElementById('oppay-confirm-bank').textContent = `${selectedBank.icon} ${selectedBank.name}`;
      document.getElementById('oppay-confirm-desc').textContent = desc;
      setStep(1);
    });

    // Back
    document.getElementById('oppay-btn-back').addEventListener('click', () => setStep(0));

    // Confirm → bank redirect
    document.getElementById('oppay-btn-confirm').addEventListener('click', () => {
      setStep(2);
      runBankRedirect(selectedBank);
    });

    // Close button
    document.getElementById('oppay-close').addEventListener('click', () => {
      close();
      if (opts.onCancel) opts.onCancel();
    });

    // Click overlay to close
    overlayEl.addEventListener('click', (e) => {
      if (e.target === overlayEl) {
        close();
        if (opts.onCancel) opts.onCancel();
      }
    });

    // ESC key
    document._oppayEscHandler = (e) => {
      if (e.key === 'Escape') { close(); if (opts.onCancel) opts.onCancel(); }
    };
    document.addEventListener('keydown', document._oppayEscHandler);
  }

  function close() {
    if (!overlayEl) return;
    overlayEl.classList.remove('oppay-visible');
    document.body.style.overflow = '';
    document.removeEventListener('keydown', document._oppayEscHandler);
    setTimeout(() => {
      if (overlayEl) { overlayEl.remove(); overlayEl = null; }
    }, 300);
  }

  // Auto-initialize buttons with data-oppay attributes
  function autoInit() {
    document.querySelectorAll('[data-oppay]').forEach(el => {
      if (el._oppayInit) return;
      el._oppayInit = true;
      el.addEventListener('click', () => {
        open({
          amount: parseFloat(el.dataset.oppayAmount || '0'),
          currency: el.dataset.oppayCurrency || 'EUR',
          merchant: el.dataset.oppayMerchant || document.title,
          description: el.dataset.oppayDescription || '',
          onSuccess: (data) => { console.log('[OpPay] Success', data); },
          onFailure: (data) => { console.log('[OpPay] Failed', data); },
          onCancel:  ()     => { console.log('[OpPay] Cancelled'); },
        });
      });
    });
  }

  // Public API
  const OpPay = { open, close, version: '1.0.0' };

  // Expose globally
  global.OpPay = OpPay;

  // Auto-init on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoInit);
  } else {
    autoInit();
  }

})(window);
