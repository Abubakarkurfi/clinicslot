// S3 Reception page logic. All API data is shown with textContent (never innerHTML) -> no XSS.

const $ = (id) => document.getElementById(id);
// S1's login saves the user (with role) in localStorage. The role only shows/hides buttons;
// the API checks the real role on every request.
function getRole() {
  try { return JSON.parse(localStorage.getItem('user') || 'null')?.role || null; } catch { return null; }
}
const TURNSTILE_SITE_KEY = window.CONFIG.TURNSTILE_SITE_KEY;
const role = getRole();
let currentDoctor = null;      // { id, name } of the open schedule
let selectedPatient = null;    // { id, fullName } for booking
let rebookingId = null;        // appointment id when moving a booking
let doctors = [];              // from the overview, for the booking dropdown

// ---------- small helpers ----------
function cairoToday() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo' }).format(new Date());
}
function timeOf(iso) {
  return new Date(iso).toLocaleTimeString('en-GB', { timeZone: 'Africa/Cairo', hour: '2-digit', minute: '2-digit' });
}
function showMessage(text, isError = false) {
  const box = $('message');
  box.textContent = text;
  box.classList.toggle('error', isError);
  box.hidden = false;
  clearTimeout(showMessage.timer);
  showMessage.timer = setTimeout(() => { box.hidden = true; }, 6000);
}
function el(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined && text !== null) node.textContent = text;
  if (className) node.className = className;
  return node;
}
function button(label, onClick, className) {
  const b = el('button', label, className);
  b.type = 'button';
  b.addEventListener('click', onClick);
  return b;
}
function cell(row, content) {
  const td = document.createElement('td');
  if (content instanceof Node) td.appendChild(content); else td.textContent = content ?? '';
  row.appendChild(td);
  return td;
}

// ---------- 1. Day overview ----------
async function loadOverview() {
  const date = $('date-input').value;
  try {
    const data = await apiRequest('/schedules?date=' + encodeURIComponent(date));
    doctors = data.doctors;

    const totals = $('totals');
    totals.replaceChildren();
    const labels = { total: 'Total', booked: 'Booked', checkedIn: 'Checked in',
                     completed: 'Completed', noShow: 'No-show', cancelled: 'Cancelled' };
    for (const [key, label] of Object.entries(labels)) {
      const box = el('div', label, 'total');
      box.prepend(el('strong', data.totals[key]));
      totals.appendChild(box);
    }

    const body = $('overview-body');
    body.replaceChildren();
    for (const d of data.doctors) {
      const tr = document.createElement('tr');
      [d.doctorName, d.specialty, d.room, d.total, d.booked, d.checkedIn, d.completed, d.noShow, d.cancelled]
        .forEach((v) => cell(tr, v));
      cell(tr, button('Open schedule', () => openSchedule(d.doctorId, d.doctorName)));
      body.appendChild(tr);
    }
    fillDoctorDropdown();
    if (currentDoctor) await openSchedule(currentDoctor.id, currentDoctor.name);
  } catch (err) {
    handleError(err);
  }
}

// ---------- 2. One doctor's schedule ----------
async function openSchedule(doctorId, doctorName) {
  currentDoctor = { id: doctorId, name: doctorName };
  const date = $('date-input').value;
  try {
    const data = await apiRequest(`/doctors/${encodeURIComponent(doctorId)}/appointments?date=${encodeURIComponent(date)}`);
    $('schedule-section').hidden = false;
    $('schedule-title').textContent = `${doctorName} - ${date}`;
    const body = $('schedule-body');
    body.replaceChildren();
    if (data.appointments.length === 0) {
      const tr = document.createElement('tr');
      cell(tr, 'No appointments on this day.').colSpan = 6;
      body.appendChild(tr);
    }
    for (const a of data.appointments) {
      const tr = document.createElement('tr');
      cell(tr, `${timeOf(a.startTime)}-${timeOf(a.endTime)}`);
      cell(tr, a.patientName);
      cell(tr, a.patientPhone);
      cell(tr, a.cancelReason ? `${a.reason || ''} (cancelled: ${a.cancelReason})` : a.reason);
      cell(tr, el('span', a.status, 'badge status-' + a.status));
      cell(tr, actionButtons(a));
      body.appendChild(tr);
    }
  } catch (err) {
    handleError(err);
  }
}

// Buttons depend on the status AND the role (only for convenience; the API checks again)
function actionButtons(a) {
  const box = document.createElement('div');
  const isReceptionist = role === 'Receptionist';
  if (a.status === 'Booked') {
    if (isReceptionist) {
      box.append(button('Check in', () => changeStatus(a.id, 'CheckedIn')),
                 button('No-show', () => changeStatus(a.id, 'NoShow'), 'secondary'),
                 button('Rebook', () => startRebook(a), 'secondary'));
    }
    box.append(button('Cancel', () => cancelAppointment(a.id), 'danger'));
  } else if (a.status === 'CheckedIn' && isReceptionist) {
    box.append(button('Complete', () => changeStatus(a.id, 'Completed')));
  }
  return box;
}

async function changeStatus(id, status, reason) {
  try {
    const body = reason ? { status, reason } : { status };
    await apiRequest(`/appointments/${encodeURIComponent(id)}/status`, { method: 'PATCH', body });
    showMessage(`Appointment updated: ${status}.`);
    await loadOverview();
  } catch (err) {
    handleError(err);
  }
}

function cancelAppointment(id) {
  const reason = prompt('Reason for cancelling (required):');
  if (reason === null) return;           // the receptionist pressed Cancel
  changeStatus(id, 'Cancelled', reason);
}

// ---------- 3. Find a patient ----------
$('search-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const term = $('search-input').value.trim();
  try {
    const patients = await apiRequest('/patients?search=' + encodeURIComponent(term));
    const list = $('search-results');
    list.replaceChildren();
    if (patients.length === 0) list.appendChild(el('li', 'No patients found.', 'muted'));
    for (const p of patients) {
      const li = document.createElement('li');
      const info = el('span', p.fullName);
      info.appendChild(el('span', '  ' + (p.phone || ''), 'muted'));
      li.appendChild(info);
      if (role === 'Receptionist') li.appendChild(button('Select', () => selectPatient(p), 'secondary'));
      list.appendChild(li);
    }
  } catch (err) {
    handleError(err);
  }
});

function selectPatient(p) {
  selectedPatient = p;
  $('selected-patient').textContent = `${p.fullName} (${p.phone || 'no phone'})`;
  $('booking-section').scrollIntoView({ behavior: 'smooth' });
}

// ---------- 4. Register a walk-in ----------
$('walkin-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const body = {
    fullName: $('walkin-name').value,
    phone: $('walkin-phone').value,
    email: $('walkin-email').value || undefined
  };
  try {
    const patient = await apiRequest('/patients', { method: 'POST', body });
    showMessage(`Walk-in registered: ${patient.fullName}.`);
    event.target.reset();
    selectPatient(patient);
  } catch (err) {
    handleError(err);
  }
});

// ---------- 5. Book or rebook (Student 1's endpoints) ----------
function fillDoctorDropdown() {
  const select = $('booking-doctor');
  const keep = select.value;
  select.replaceChildren(el('option', 'Pick a doctor'));
  select.firstChild.value = '';
  for (const d of doctors) {
    const opt = el('option', `${d.doctorName} (${d.specialty})`);
    opt.value = d.doctorId;
    select.appendChild(opt);
  }
  select.value = keep;
}

$('load-slots').addEventListener('click', async () => {
  const doctorId = $('booking-doctor').value;
  const date = $('booking-date').value;
  if (!doctorId || !date) return showMessage('Pick a doctor and a date first.', true);
  try {
    const slots = await apiRequest(`/doctors/${encodeURIComponent(doctorId)}/slots?date=${encodeURIComponent(date)}`);
    const select = $('booking-slot');
    select.replaceChildren();
    for (const s of slots) {
      const start = typeof s === 'string' ? s : s.startTime;   // accept both formats
      const opt = el('option', timeOf(start));
      opt.value = start;
      select.appendChild(opt);
    }
    if (slots.length === 0) select.appendChild(el('option', 'No free slots'));
  } catch (err) {
    handleError(err);
  }
});

function startRebook(appt) {
  rebookingId = appt.id;
  selectedPatient = { id: appt.patientId, fullName: appt.patientName };
  $('booking-title').textContent = 'Rebook an appointment';
  $('selected-patient').textContent = `${appt.patientName} (moving the ${timeOf(appt.startTime)} visit)`;
  $('booking-submit').textContent = 'Move appointment';
  $('cancel-rebook').hidden = false;
  if (currentDoctor) $('booking-doctor').value = currentDoctor.id;
  $('booking-section').scrollIntoView({ behavior: 'smooth' });
}

function stopRebook() {
  rebookingId = null;
  $('booking-title').textContent = 'Book for a patient';
  $('booking-submit').textContent = 'Book';
  $('cancel-rebook').hidden = true;
}
$('cancel-rebook').addEventListener('click', stopRebook);

$('booking-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!selectedPatient) return showMessage('Select or register a patient first.', true);
  const doctorId = $('booking-doctor').value;
  const startTime = $('booking-slot').value;
  if (!doctorId || !startTime) return showMessage('Pick a doctor and a free slot.', true);

  try {
    if (rebookingId) {
      await apiRequest(`/appointments/${encodeURIComponent(rebookingId)}`, {
        method: 'PATCH', body: { doctorId, startTime }
      });
      showMessage('Appointment moved.');
      stopRebook();
    } else {
      const token = window.turnstile ? turnstile.getResponse() : '';
      await apiRequest('/appointments', {
        method: 'POST',
        body: { doctorId, startTime, patientId: selectedPatient.id },
        headers: { 'X-Turnstile-Token': token || '' }
      });
      if (window.turnstile) turnstile.reset();
      showMessage(`Booked for ${selectedPatient.fullName}.`);
    }
    await loadOverview();
  } catch (err) {
    handleError(err);
  }
});

// Turnstile widget (the script loads async, so wait for it)
function renderTurnstile() {
  if (window.turnstile) turnstile.render('#turnstile-box', { sitekey: TURNSTILE_SITE_KEY });
  else setTimeout(renderTurnstile, 300);
}

// ---------- errors and start-up ----------
function handleError(err) {
  if (err.status === 401) {
    showMessage('Please log in again (your session is missing or expired).', true);
  } else {
    showMessage(err.message, true);
  }
}

function start() {
  if (!role) {
        location.href = 'login.html';   // not logged in -> go to S1's login page
    return;
  }
  $('role-badge').textContent = role;
  // Hide what this role cannot use (the API still checks every request)
  if (role !== 'Receptionist') document.querySelectorAll('.receptionist-only').forEach((n) => { n.hidden = true; });
  if (role === 'Patient') document.querySelectorAll('.staff-only').forEach((n) => { n.hidden = true; });

  $('date-input').value = cairoToday();
  $('booking-date').value = cairoToday();
  $('date-input').addEventListener('change', loadOverview);
  if (role === 'Receptionist') renderTurnstile();
  loadOverview();
}

start();
