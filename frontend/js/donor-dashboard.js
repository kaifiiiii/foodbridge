// frontend/js/donor-dashboard.js
// Donor dashboard: GET /api/donations/mine.

let donations = [];

function renderStats() {
  const stats = document.getElementById('stats');
  stats.replaceChildren();
  const items = [['Total', donations.length]];
  for (const status of Object.keys(STATUS_LABELS)) {
    items.push([STATUS_LABELS[status], donations.filter(d => d.status === status).length]);
  }
  for (const [label, count] of items) {
    const card = el('div', 'card stat');
    card.append(el('div', 'stat-number', String(count)), el('div', 'stat-label', label));
    stats.append(card);
  }
}

function buildDetails(d) {
  const list = el('dl', 'donation-details');
  const rows = [
    ['Description', d.description || 'None'],
    ['Category', CATEGORY_LABELS[d.category] || d.category],
    ['Quantity', d.quantity + ' ' + (UNIT_LABELS[d.unit] || d.unit)],
    ['Prepared at', d.prepared_at ? formatDateTime(d.prepared_at) : 'Not given'],
    ['Collect before', formatDateTime(d.expires_at)],
    ['Pickup area', d.pickup_area],
    ['Pickup address', d.pickup_address],
    ['Claimed by', d.claimed_by_name || 'Not claimed yet']
  ];
  for (const [term, value] of rows) list.append(el('dt', null, term), el('dd', null, value));
  return list;
}

function buildCard(d) {
  const card = el('article', 'card');

  const head = el('div', 'donation-head');
  head.append(foodTitle(d), statusBadge(d.status));

  const meta = el('p', 'donation-meta',
    d.quantity + ' ' + (UNIT_LABELS[d.unit] || d.unit) + ' \u00B7 ' + (d.pickup_area || ''));

  const actions = el('div', 'donation-actions');
  const details = buildDetails(d);
  details.hidden = true;

  const toggle = el('button', 'btn btn-outline btn-small', 'View details');
  toggle.addEventListener('click', () => {
    details.hidden = !details.hidden;
    toggle.textContent = details.hidden ? 'View details' : 'Hide details';
  });
  actions.append(toggle);

  if (d.status === 'AVAILABLE') {
    const cancel = el('button', 'btn btn-danger btn-small', 'Cancel donation');
    cancel.addEventListener('click', async () => {
      const ok = await confirmDialog('Cancel this donation?',
        '"' + d.food_name + '" will no longer be visible to NGOs.', 'Yes, cancel it', true);
      if (!ok) return;
      try {
        await api('/api/donations/' + d.id + '/cancel', { method: 'PATCH' });
        showMessage('success', 'Donation cancelled.');
      } catch (err) {
        showMessage('error', err.message);
      }
      await load();
    });
    actions.append(cancel);
  }

  card.append(head);
  if (d.status === 'AVAILABLE') card.append(countdown(d.expires_at));
  card.append(meta, actions, details);
  return card;
}

function renderList() {
  const list = document.getElementById('donation-list');
  list.replaceChildren();
  const filter = document.getElementById('status-filter').value;
  const shown = filter ? donations.filter(d => d.status === filter) : donations;
  if (shown.length === 0) {
    list.append(el('p', 'empty-state', 'No donations to show.'));
    return;
  }
  shown.forEach(d => list.append(buildCard(d)));
}

function render() { renderStats(); renderList(); }

async function load() {
  try {
    const data = await api('/api/donations/mine');
    donations = data.donations;
    render();
  } catch (err) {
    document.getElementById('donation-list').replaceChildren(
      el('p', 'empty-state', 'Could not load your donations. Please try again.'));
  }
}

document.getElementById('status-filter').addEventListener('change', renderList);
document.getElementById('donation-list').replaceChildren(...skeletonCards(3));
requireLogin('DONOR').then((user) => { if (user) { greet(user); load(); } });