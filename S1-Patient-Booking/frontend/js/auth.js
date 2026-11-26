/**
 * Frontend Authentication & Dynamic Navigation Helper
 */

function getCurrentUser() {
  const userJson = localStorage.getItem('user');
  if (!userJson) return null;
  try {
    return JSON.parse(userJson);
  } catch (e) {
    return null;
  }
}

function isLoggedIn() {
  return !!localStorage.getItem('token') && !!getCurrentUser();
}

function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = 'login.html';
}

function updateNavigation() {
  const navContainer = document.getElementById('main-nav');
  if (!navContainer) return;

  const user = getCurrentUser();

  // Clear existing items
  navContainer.innerHTML = '';

  const addLink = (href, text) => {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = href;
    a.textContent = text;
    if (window.location.pathname.endsWith(href)) {
      a.className = 'active';
    }
    li.appendChild(a);
    navContainer.appendChild(li);
  };

  addLink('index.html', 'Doctors');

  if (!user) {
    addLink('login.html', 'Log In / Register');
  } else {
    if (user.role === 'Patient') {
      addLink('book.html', 'Book Appointment');
      addLink('my-appointments.html', 'My Appointments');
    } else if (user.role === 'Receptionist') {
      addLink('reception.html', 'Reception Desk');
      addLink('book.html', 'Book Patient');
    } else if (user.role === 'Admin') {
      addLink('admin.html', 'Admin Console');
      addLink('reception.html', 'Reception Desk');
    }

    // User badge
    const badgeLi = document.createElement('li');
    const badgeDiv = document.createElement('div');
    badgeDiv.className = 'user-badge';

    const nameSpan = document.createElement('span');
    nameSpan.textContent = user.fullName;

    const roleSpan = document.createElement('span');
    roleSpan.className = 'role-tag';
    roleSpan.textContent = user.role;

    badgeDiv.appendChild(nameSpan);
    badgeDiv.appendChild(roleSpan);
    badgeLi.appendChild(badgeDiv);
    navContainer.appendChild(badgeLi);

    // Logout button
    const logoutLi = document.createElement('li');
    const logoutBtn = document.createElement('button');
    logoutBtn.className = 'btn btn-outline btn-sm';
    logoutBtn.textContent = 'Log Out';
    logoutBtn.addEventListener('click', logout);
    logoutLi.appendChild(logoutBtn);
    navContainer.appendChild(logoutLi);
  }
}

document.addEventListener('DOMContentLoaded', updateNavigation);

window.auth = {
  getCurrentUser,
  isLoggedIn,
  logout,
  updateNavigation
};
