// frontend/js/ngo-dashboard.js
// This NGO's claimed donations: GET /api/donations/claimed.

let claimed = [];

function renderStats() {
  const stats = document.getElementById('stats');
  stats.replaceChildren();
  const items = [
    ['Total claimed', claimed.length],
    ['To collect', claimed.filter(d => d.status === 'ACCEPTED').length],
    ['Collected', claimed.filter(d => d.status === 'COLLECTED').length]
  ];
  for (const [label, count] of items) {
    const card = el('div', 'card stat');
    card.append(el('div', 'stat-number', String(count)), el('div', 'stat-label', label));
    stats.append(card);
  }
}

function buildCard(d) {
  const card = el('article', 'card');

  const head = el('div', 'donation-head');
  head.append(foodTitle(d), statusBadge(d.status));

  const meta = el('p', 'donation-meta',
    d.quantity + ' ' + (UNIT_LABELS[d.unit] || d.unit) + ' \u00B7 Collect before ' + formatDateTime(d.expires_at));

  // Full address is shown because this NGO claimed the donation.
  const pickup = el('dl', 'donation-details');
  pickup.append(
    el('dt', null, 'Pickup address'), el('dd', null, d.pickup_address),
    el('dt', null, 'Donor'), el('dd', null, d.donor_name)
  );

  card.append(head);
  if (d.status === 'ACCEPTED') card.append(countdown(d.expires_at));
  card.append(meta, pickup);

  if (d.status === 'ACCEPTED') {
    const actions = el('div', 'donation-actions');
    const done = el('button', 'btn btn-primary btn-small', 'Mark as collected');
    done.addEventListener('click', async () => {
      const ok = await confirmDialog('Mark as collected?',
        'Confirm that you have picked up "' + d.food_name + '".', 'Yes, collected');
      if (!ok) return;
      try {
        await api('/api/donations/' + d.id + '/status', { method: 'PATCH', body: { status: 'COLLECTED' } });
        showMessage('success', '"' + d.food_name + '" marked as collected.');
      } catch (err) {
        showMessage('error', err.message);
      }
      await load();
    });
    actions.append(done);
    card.append(actions);
  }
  return card;
}

function renderList() {
  const list = document.getElementById('donation-list');
  list.replaceChildren();
  const filter = document.getElementById('status-filter').value;
  const shown = filter ? claimed.filter(d => d.status === filter) : claimed;
  if (shown.length === 0) {
    list.append(el('p', 'empty-state', 'Nothing here yet. Browse available donations to claim some.'));
    return;
  }
  shown.forEach(d => list.append(buildCard(d)));
}

function render() { renderStats(); renderList(); }

async function load() {
  try {
    const data = await api('/api/donations/claimed');
    claimed = data.donations;
    render();
  } catch (err) {
    document.getElementById('donation-list').replaceChildren(
      el('p', 'empty-state', 'Could not load your claims. Please try again.'));
  }
}

document.getElementById('status-filter').addEventListener('change', renderList);
document.getElementById('donation-list').replaceChildren(...skeletonCards(2));
requireLogin('NGO').then((user) => { if (user) { greet(user); load(); } });