// frontend/js/format.js
// Shared helpers: labels, safe element builder, dates, badges, icons,
// countdowns, skeletons, confirm dialog, greeting, logout link.

const CATEGORY_LABELS = {
  COOKED_MEAL: 'Cooked meal',
  BAKERY: 'Bakery',
  FRUITS_VEGETABLES: 'Fruits and vegetables',
  PACKAGED: 'Packaged food',
  DAIRY: 'Dairy',
  OTHER: 'Other'
};

const CATEGORY_ICONS = {
  COOKED_MEAL: '\uD83C\uDF72',
  BAKERY: '\uD83E\uDD56',
  FRUITS_VEGETABLES: '\uD83E\uDD55',
  PACKAGED: '\uD83D\uDCE6',
  DAIRY: '\uD83E\uDD5B',
  OTHER: '\uD83C\uDF7D'
};

const UNIT_LABELS = { PORTIONS: 'portions', KG: 'kg', ITEMS: 'items', LITRES: 'litres' };

const STATUS_LABELS = {
  AVAILABLE: 'Available',
  ACCEPTED: 'Accepted',
  COLLECTED: 'Collected',
  CANCELLED: 'Cancelled',
  EXPIRED: 'Expired'
};

// Create an element safely. Text goes in via textContent, so it can never run as HTML.
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

// MySQL gives "2026-10-16 21:24:00"; a "T" makes it parse the same in every browser.
function parseDate(value) {
  return new Date(String(value).replace(' ', 'T'));
}

function formatDateTime(value) {
  return parseDate(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

function statusBadge(status) {
  return el('span', 'badge badge-' + status.toLowerCase(), STATUS_LABELS[status] || status);
}

// <h3> with a category icon and the food name (name inserted as text).
function foodTitle(d) {
  const h = el('h3');
  const icon = el('span', 'cat-icon', CATEGORY_ICONS[d.category] || CATEGORY_ICONS.OTHER);
  icon.setAttribute('aria-hidden', 'true');
  h.append(icon, document.createTextNode(d.food_name));
  return h;
}

// ---- live countdown ----
function timeLeftText(ms) {
  if (ms <= 0) return 'Expired';
  const minutes = Math.floor(ms / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days >= 1) return 'Expires in ' + days + 'd ' + (hours % 24) + 'h';
  if (hours >= 1) return 'Expires in ' + hours + 'h ' + (minutes % 60) + 'm';
  return 'Expires in ' + Math.max(minutes, 1) + 'm';
}

function updateCountdown(node) {
  const ms = parseDate(node.dataset.expires) - Date.now();
  node.textContent = '\u23F1 ' + timeLeftText(ms);
  node.classList.toggle('soon', ms > 0 && ms < 3600000);
  node.classList.toggle('over', ms <= 0);
}

function countdown(expiresAt) {
  const node = el('span', 'countdown');
  node.dataset.expires = expiresAt;
  updateCountdown(node);
  return node;
}

setInterval(() => document.querySelectorAll('.countdown').forEach(updateCountdown), 30000);

// ---- skeleton loading cards ----
function skeletonCards(count) {
  return Array.from({ length: count || 3 }, () => {
    const card = el('div', 'card skeleton');
    card.setAttribute('aria-hidden', 'true');
    card.append(el('div', 'sk-line sk-title'), el('div', 'sk-line'), el('div', 'sk-line sk-short'));
    return card;
  });
}

// ---- confirm dialog: returns a Promise<boolean> ----
function confirmDialog(title, message, confirmText, danger) {
  return new Promise((resolve) => {
    const dlg = document.createElement('dialog');
    dlg.className = 'confirm-dialog';
    const actions = el('div', 'confirm-actions');
    const no = el('button', 'btn btn-outline btn-small', 'Not now');
    const yes = el('button', 'btn btn-small ' + (danger ? 'btn-danger-solid' : 'btn-primary'), confirmText || 'Confirm');
    no.type = 'button';
    yes.type = 'button';
    actions.append(no, yes);
    dlg.append(el('h3', null, title), el('p', null, message), actions);
    document.body.append(dlg);

    let result = false;
    no.addEventListener('click', () => dlg.close());
    yes.addEventListener('click', () => { result = true; dlg.close(); });
    dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });   // click outside
    dlg.addEventListener('close', () => { dlg.remove(); resolve(result); });        // also fires on Esc
    dlg.showModal();
    no.focus();
  });
}

// ---- dashboard greeting ----
function greet(user) {
  const h = document.querySelector('.page-header h1');
  if (!h) return;
  const hour = new Date().getHours();
  const word = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  h.textContent = word + ', ' + user.name;
}

document.addEventListener('DOMContentLoaded', () => {
  const link = document.getElementById('logout-link');
  if (link) link.addEventListener('click', (e) => { e.preventDefault(); logout(); });
});