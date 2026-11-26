/**
 * Booking Client Logic (S1 Patient Booking Lead: Abubakar Mansur kurfi)
 */

function onBookingTurnstileSuccess(token) {
  const input = document.getElementById('booking-turnstile-token');
  if (input) input.value = token;
}

document.addEventListener('DOMContentLoaded', async () => {
  // Authentication Guard: require logged in session
  if (!auth.isLoggedIn()) {
    window.location.href = 'login.html';
    return;
  }

  const specialtySelect = document.getElementById('book-specialty');
  const doctorSelect = document.getElementById('book-doctor');
  const dateInput = document.getElementById('book-date');
  const slotsContainer = document.getElementById('slots-container');
  const slotsLoading = document.getElementById('slots-loading');
  const selectedSlotInput = document.getElementById('selected-slot-time');
  const submitBtn = document.getElementById('btn-confirm-booking');
  const doctorInfoBanner = document.getElementById('doctor-info-banner');
  const bookingForm = document.getElementById('booking-form');

  // Set min date to today
  const todayStr = new Date().toISOString().split('T')[0];
  dateInput.min = todayStr;

  let allDoctors = [];

  // 1. Load specialties and doctors
  try {
    const [specialties, doctors] = await Promise.all([
      apiRequest('/specialties'),
      apiRequest('/doctors')
    ]);

    allDoctors = doctors;

    specialties.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.id;
      opt.textContent = s.name;
      specialtySelect.appendChild(opt);
    });

    // Check URL parameters for pre-selected doctor
    const urlParams = new URLSearchParams(window.location.search);
    const preselectedDocId = urlParams.get('doctorId');

    if (preselectedDocId) {
      const foundDoc = allDoctors.find(d => d.id === preselectedDocId);
      if (foundDoc) {
        specialtySelect.value = foundDoc.specialtyId;
        populateDoctorsForSpecialty(foundDoc.specialtyId, foundDoc.id);
      }
    }
  } catch (err) {
    showAlert('booking-alert', `Failed to load clinic options: ${err.message}`, 'error');
  }

  function populateDoctorsForSpecialty(specialtyId, selectedId = null) {
    doctorSelect.innerHTML = '<option value="">Select a Doctor</option>';
    const filtered = allDoctors.filter(d => d.specialtyId === specialtyId);

    filtered.forEach(d => {
      const opt = document.createElement('option');
      opt.value = d.id;
      opt.textContent = `${d.fullName} (${d.room})`;
      if (selectedId && d.id === selectedId) {
        opt.selected = true;
      }
      doctorSelect.appendChild(opt);
    });

    doctorSelect.disabled = filtered.length === 0;
    if (selectedId) {
      onDoctorSelected(selectedId);
    }
  }

  function onDoctorSelected(doctorId) {
    const doc = allDoctors.find(d => d.id === doctorId);
    if (doc) {
      doctorInfoBanner.style.display = 'block';
      safeText(doctorInfoBanner, `Selected: ${doc.fullName} • Room: ${doc.room} • Consultation Length: ${doc.slotMinutes} minutes`);
      dateInput.disabled = false;
      if (dateInput.value) {
        loadFreeSlots();
      }
    } else {
      doctorInfoBanner.style.display = 'none';
      dateInput.disabled = true;
    }
  }

  specialtySelect.addEventListener('change', () => {
    doctorInfoBanner.style.display = 'none';
    dateInput.disabled = true;
    selectedSlotInput.value = '';
    submitBtn.disabled = true;
    slotsContainer.innerHTML = '<p style="color: var(--text-muted); font-size: 0.9rem;">Please select a doctor and date above.</p>';
    populateDoctorsForSpecialty(specialtySelect.value);
  });

  doctorSelect.addEventListener('change', () => {
    selectedSlotInput.value = '';
    submitBtn.disabled = true;
    onDoctorSelected(doctorSelect.value);
  });

  dateInput.addEventListener('change', () => {
    loadFreeSlots();
  });

  // 2. Fetch free slots
  async function loadFreeSlots() {
    const doctorId = doctorSelect.value;
    const date = dateInput.value;

    if (!doctorId || !date) return;

    clearAlert('booking-alert');
    slotsContainer.innerHTML = '';
    slotsLoading.style.display = 'block';
    selectedSlotInput.value = '';
    submitBtn.disabled = true;

    try {
      const result = await apiRequest(`/doctors/${doctorId}/slots?date=${date}`);
      slotsLoading.style.display = 'none';

      if (result.closed) {
        const closedMsg = document.createElement('p');
        closedMsg.className = 'alert alert-info';
        closedMsg.textContent = `📅 Notice: ${result.closureReason}`;
        slotsContainer.appendChild(closedMsg);
        return;
      }

      if (!result.slots || result.slots.length === 0) {
        const noneMsg = document.createElement('p');
        noneMsg.style.color = 'var(--text-muted)';
        noneMsg.textContent = 'No available slots remaining for this date. Please pick another date or doctor.';
        slotsContainer.appendChild(noneMsg);
        return;
      }

      result.slots.forEach(slot => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'slot-btn';
        btn.textContent = slot.timeDisplay;

        btn.addEventListener('click', () => {
          // Deselect all
          document.querySelectorAll('.slot-btn').forEach(b => b.classList.remove('selected'));
          btn.classList.add('selected');
          selectedSlotInput.value = slot.startTime;
          submitBtn.disabled = false;
        });

        slotsContainer.appendChild(btn);
      });
    } catch (err) {
      slotsLoading.style.display = 'none';
      showAlert('booking-alert', err.message, 'error');
    }
  }

  // 3. Submit booking
  bookingForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearAlert('booking-alert');

    const doctorId = doctorSelect.value;
    const startTime = selectedSlotInput.value;
    const reason = document.getElementById('book-reason').value;
    const turnstileToken = document.getElementById('booking-turnstile-token').value || '1x00000000000000000000AA';

    if (!startTime) {
      showAlert('booking-alert', 'Please select a consultation slot.', 'error');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Securing Booking...';

    try {
      const booking = await apiRequest('/appointments', {
        method: 'POST',
        headers: {
          'X-Turnstile-Token': turnstileToken
        },
        body: {
          doctorId,
          startTime,
          reason
        }
      });

      showAlert('booking-alert', 'Appointment booked successfully! Redirecting to your appointments...', 'success');
      setTimeout(() => {
        window.location.href = 'my-appointments.html';
      }, 1000);
    } catch (err) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Confirm & Book Appointment';

      if (err.code === 'SLOT_TAKEN') {
        showAlert('booking-alert', '⚠️ That slot was just reserved by another patient. The schedule has been refreshed.', 'error');
        loadFreeSlots();
      } else {
        showAlert('booking-alert', err.message, 'error');
      }
    }
  });
});
