// frontend/js/landing.js
// Adapts the landing page nav and buttons to the logged-in state.

(async function () {
  let user = null;
  try {
    const data = await api('/api/auth/me');
    user = data.user;
  } catch (err) {
    return;   // not logged in: leave the default links
  }

  const nav = document.querySelector('.navbar .nav-links');
  nav.querySelectorAll('a[href="login.html"], a[href="register.html"]').forEach(a => a.remove());

  const dashboard = el('a', 'btn btn-primary', 'Go to dashboard');
  dashboard.href = dashboardFor(user.role);
  const logoutLink = el('a', null, 'Log out');
  logoutLink.href = '#';
  logoutLink.addEventListener('click', (e) => { e.preventDefault(); logout(); });
  nav.append(logoutLink, dashboard);

  // Point the hero buttons at the right place for this role.
  const donate = document.querySelector('.hero-actions a[href^="register.html?role=DONOR"]');
  const find = document.querySelector('.hero-actions a[href^="register.html?role=NGO"]');
  if (donate) donate.href = user.role === 'DONOR' ? 'donate.html' : dashboardFor(user.role);
  if (find) find.href = user.role === 'NGO' ? 'available.html' : dashboardFor(user.role);
})();