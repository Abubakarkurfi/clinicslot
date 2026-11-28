document.addEventListener('DOMContentLoaded', async () => {
      if (!auth.isLoggedIn()) {
        window.location.href = 'login.html';
        return;
      }

      const tbody = document.getElementById('appointments-tbody');
      const modal = document.getElementById('reschedule-modal');
      const modalDate = document.getElementById('reschedule-date');
      const modalSlots = document.getElementById('modal-slots');
      const modalNewSlot = document.getElementById('modal-new-slot');
      const btnSaveReschedule = document.getElementById('btn-save-reschedule');
      const btnCloseModal = document.getElementById('btn-close-modal');

      let currentReschedulingApt = null;

      async function loadAppointments() {
        tbody.innerHTML = '';
        try {
          const appointments = await apiRequest('/appointments');
          if (appointments.length === 0) {
            const tr = document.createElement('tr');
            const td = document.createElement('td');
            td.colSpan = 6;
            td.style.textAlign = 'center';
            td.style.color = 'var(--text-muted)';
            td.textContent = 'You have no appointments booked.';
            tr.appendChild(td);
            tbody.appendChild(tr);
            return;
          }

          appointments.forEach(apt => {
            const tr = document.createElement('tr');

            // Date & Time
            const dateTd = document.createElement('td');
            const d = new Date(apt.startTime);
            dateTd.textContent = `${d.toLocaleDateString()} at ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
            tr.appendChild(dateTd);

            // Doctor
            const docTd = document.createElement('td');
            docTd.style.fontWeight = '600';
            docTd.textContent = apt.doctorName;
            tr.appendChild(docTd);

            // Specialty / Room
            const specTd = document.createElement('td');
            specTd.textContent = `${apt.specialtyName} (${apt.doctorRoom || 'Clinic'})`;
            tr.appendChild(specTd);

            // Status Badge
            const statusTd = document.createElement('td');
            const badge = document.createElement('span');
            badge.className = `badge badge-${apt.status.toLowerCase()}`;
            badge.textContent = apt.status;
            statusTd.appendChild(badge);
            tr.appendChild(statusTd);

            // Reason
            const reasonTd = document.createElement('td');
            reasonTd.textContent = apt.reason || '—';
            if (apt.cancelReason) {
              const cr = document.createElement('div');
              cr.style.fontSize = '0.75rem';
              cr.style.color = 'var(--danger)';
              cr.textContent = `Reason: ${apt.cancelReason}`;
              reasonTd.appendChild(cr);
            }
            tr.appendChild(reasonTd);

            // Actions
            const actionsTd = document.createElement('td');
            const hoursUntil = (new Date(apt.startTime).getTime() - Date.now()) / (1000 * 3600);
            const canModify = apt.status === 'Booked' && hoursUntil >= 2;

            if (canModify) {
              const reschedBtn = document.createElement('button');
              reschedBtn.className = 'btn btn-outline btn-sm';
              reschedBtn.textContent = 'Reschedule';
              reschedBtn.style.marginRight = '0.5rem';
              reschedBtn.addEventListener('click', () => openRescheduleModal(apt));

              const cancelBtn = document.createElement('button');
              cancelBtn.className = 'btn btn-danger btn-sm';
              cancelBtn.textContent = 'Cancel';
              cancelBtn.addEventListener('click', () => handleCancel(apt.id));

              actionsTd.appendChild(reschedBtn);
              actionsTd.appendChild(cancelBtn);
            } else if (apt.status === 'Booked' && hoursUntil < 2) {
              const span = document.createElement('span');
              span.style.fontSize = '0.8rem';
              span.style.color = 'var(--text-muted)';
              span.textContent = 'Within 2h lock window';
              actionsTd.appendChild(span);
            } else {
              const span = document.createElement('span');
              span.style.fontSize = '0.8rem';
              span.style.color = 'var(--text-muted)';
              span.textContent = '—';
              actionsTd.appendChild(span);
            }

            tr.appendChild(actionsTd);
            tbody.appendChild(tr);
          });
        } catch (err) {
          showAlert('appointments-alert', `Error loading appointments: ${err.message}`, 'error');
        }
      }

      async function handleCancel(id) {
        if (!confirm('Are you sure you want to cancel this appointment? This cannot be undone.')) return;
        try {
          await apiRequest(`/appointments/${id}/cancel`, {
            method: 'POST',
            body: { reason: 'Cancelled by patient via portal' }
          });
          showAlert('appointments-alert', 'Appointment cancelled successfully.', 'success');
          loadAppointments();
        } catch (err) {
          showAlert('appointments-alert', `Could not cancel: ${err.message}`, 'error');
        }
      }

      function openRescheduleModal(apt) {
        currentReschedulingApt = apt;
        modalDate.value = '';
        modalDate.min = new Date().toISOString().split('T')[0];
        modalSlots.innerHTML = '';
        modalNewSlot.value = '';
        btnSaveReschedule.disabled = true;
        clearAlert('modal-alert');
        modal.classList.add('active');
      }

      btnCloseModal.addEventListener('click', () => {
        modal.classList.remove('active');
      });

      modalDate.addEventListener('change', async () => {
        if (!currentReschedulingApt || !modalDate.value) return;
        modalSlots.innerHTML = '<p style="color:var(--text-muted); font-size:0.85rem;">Checking availability...</p>';
        btnSaveReschedule.disabled = true;
        modalNewSlot.value = '';

        try {
          const res = await apiRequest(`/doctors/${currentReschedulingApt.doctorId}/slots?date=${modalDate.value}`);
          modalSlots.innerHTML = '';

          if (res.closed) {
            modalSlots.textContent = `Doctor unavailable: ${res.closureReason}`;
            return;
          }

          if (res.slots.length === 0) {
            modalSlots.textContent = 'No free slots on this date.';
            return;
          }

          res.slots.forEach(s => {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'slot-btn';
            b.textContent = s.timeDisplay;
            b.addEventListener('click', () => {
              document.querySelectorAll('#modal-slots .slot-btn').forEach(btn => btn.classList.remove('selected'));
              b.classList.add('selected');
              modalNewSlot.value = s.startTime;
              btnSaveReschedule.disabled = false;
            });
            modalSlots.appendChild(b);
          });
        } catch (err) {
          showAlert('modal-alert', err.message, 'error');
        }
      });

      btnSaveReschedule.addEventListener('click', async () => {
        if (!currentReschedulingApt || !modalNewSlot.value) return;
        try {
          await apiRequest(`/appointments/${currentReschedulingApt.id}`, {
            method: 'PATCH',
            body: { startTime: modalNewSlot.value }
          });
          modal.classList.remove('active');
          showAlert('appointments-alert', 'Appointment rescheduled successfully!', 'success');
          loadAppointments();
        } catch (err) {
          showAlert('modal-alert', err.message, 'error');
        }
      });

      loadAppointments();
    });
