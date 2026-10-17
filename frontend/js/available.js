// frontend/js/available.js
// Browse, search, filter and claim donations via the real API.

let allDonations = [];

async function fetchAvailableDonations() {
  const params = new URLSearchParams();
  const search = document.getElementById('search').value.trim();
  const category = document.getElementById('category-filter').value;
  if (search) params.set('search', search);
  if (category) params.set('category', category);
  const query = params.toString();
  const data = await api('/api/donations/available' + (query ? '?' + query : ''));
  return data.donations;
}

async function claimDonation(id) {
  return api('/api/donations/' + id + '/claim', { method: 'PATCH' });
}

function showListMessage(text) {
  document.getElementById('donation-list').replaceChildren(el('p', 'empty-state', text));
}

function buildCard(d) {
  const card = el('article', 'card');

  const head = el('div', 'donation-head');
  head.append(foodTitle(d),
    el('span', 'badge badge-available', CATEGORY_LABELS[d.category] || d.category));

  const meta = el('p', 'donation-meta',
    d.quantity + ' ' + (UNIT_LABELS[d.unit] || d.unit) + ' \u00B7 ' + d.pickup_area);
  const donor = el('p', null, 'Donor: ' + d.donor_name);
  const desc = el('p', null, d.description || 'No description provided.');

  const actions = el('div', 'donation-actions');
  const claim = el('button', 'btn btn-primary btn-small', 'Claim this donation');
  claim.addEventListener('click', async () => {
    const ok = await confirmDialog('Claim this donation?',
      'You will be responsible for collecting "' + d.food_name + '" before ' +
      formatDateTime(d.expires_at) + '. The full pickup address will be shown after you claim.',
      'Yes, claim it');
    if (!ok) return;
    claim.disabled = true;   // convenience only: the backend prevents double claims
    try {
      await claimDonation(d.id);
      showMessage('success', 'Claimed "' + d.food_name + '". Find pickup details under My claims.');
    } catch (err) {
      showMessage('error', err.message);
    }
    await load();
  });
  actions.append(claim);

  card.append(head, countdown(d.expires_at), meta, donor, desc, actions);
  return card;
}

function render() {
  if (allDonations.length === 0) {
    showListMessage('No donations match your search.');
    return;
  }
  const list = document.getElementById('donation-list');
  list.replaceChildren();
  allDonations.forEach(d => list.append(buildCard(d)));
}

async function load() {
  try {
    allDonations = await fetchAvailableDonations();
    render();
  } catch (err) {
    showListMessage('Could not load donations. Please try again.');
  }
}

let searchTimer;
const searchBox = document.getElementById('search');
searchBox.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(load, 300);   // wait until typing pauses
});
document.getElementById('category-filter').addEventListener('change', load);

// Press "/" anywhere to jump to the search box.
document.addEventListener('keydown', (e) => {
  const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName);
  if (e.key === '/' && !typing) { e.preventDefault(); searchBox.focus(); }
});

document.getElementById('donation-list').replaceChildren(...skeletonCards(3));
requireLogin('NGO').then((user) => { if (user) { greet(user); load(); } });