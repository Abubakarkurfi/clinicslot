/**
 * Administration & Schedule Governance Logic (S2 Omar Osama & Shared Admin)
 */

document.addEventListener('DOMContentLoaded', () => {
  const user = auth.getCurrentUser();
  if (!user || user.role !== 'Admin') {
    window.location.href = 'login.html';
    return;
  }

  const specSelect = document.getElementById('doc-specialty');
  const addDocForm = document.getElementById('add-doctor-form');
  const addSpecForm = document.getElementById('add-specialty-form');
  const doctorsTbody = document.getElementById('doctors-admin-tbody');
  const auditTbody = document.getElementById('audit-log-tbody');
  const btnImportHolidays = document.getElementById('btn-import-holidays');
  const holidayYearInput = document.getElementById('holiday-year');
  const holidayStatus = document.getElementById('holiday-import-status');
  const btnRefreshAudit = document.getElementById('btn-refresh-audit');

  async function loadSpecialties() {
    try {
      const specs = await apiRequest('/specialties');
      specSelect.innerHTML = '<option value="">Select Specialty</option>';
      specs.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.id;
        opt.textContent = s.name;
        specSelect.appendChild(opt);
      });
    } catch (err) {
      console.error(err);
    }
  }

  async function loadDoctors() {
    doctorsTbody.innerHTML = '';
    try {
      const doctors = await apiRequest('/doctors');
      doctors.forEach(d => {
        const tr = document.createElement('tr');

        const nameTd = document.createElement('td');
        nameTd.style.fontWeight = '600';
        nameTd.textContent = d.fullName;

        const specTd = document.createElement('td');
        specTd.textContent = d.specialtyName;

        const roomTd = document.createElement('td');
        roomTd.textContent = d.room;

        const slotTd = document.createElement('td');
        slotTd.textContent = `${d.slotMinutes} mins`;

        const statusTd = document.createElement('td');
        const badge = document.createElement('span');
        badge.className = `badge ${d.isActive ? 'badge-completed' : 'badge-noshow'}`;
        badge.textContent = d.isActive ? 'Active' : 'Inactive';
        statusTd.appendChild(badge);

        const actionTd = document.createElement('td');
        const toggleBtn = document.createElement('button');
        toggleBtn.className = 'btn btn-outline btn-sm';
        toggleBtn.textContent = d.isActive ? 'Deactivate' : 'Activate';
        toggleBtn.addEventListener('click', async () => {
          try {
            await apiRequest(`/doctors/${d.id}`, {
              method: 'PATCH',
              body: { isActive: !d.isActive }
            });
            loadDoctors();
          } catch (err) {
            showAlert('admin-alert', err.message, 'error');
          }
        });
        actionTd.appendChild(toggleBtn);

        tr.appendChild(nameTd);
        tr.appendChild(specTd);
        tr.appendChild(roomTd);
        tr.appendChild(slotTd);
        tr.appendChild(statusTd);
        tr.appendChild(actionTd);
        doctorsTbody.appendChild(tr);
      });
    } catch (err) {
      console.error(err);
    }
  }

  async function loadAuditLogs() {
    auditTbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:var(--text-muted);">Loading logs...</td></tr>';
    try {
      const logs = await apiRequest('/audit-logs?limit=50');
      auditTbody.innerHTML = '';

      if (logs.length === 0) {
        auditTbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:var(--text-muted);">No audit entries found.</td></tr>';
        return;
      }

      logs.forEach(l => {
        const tr = document.createElement('tr');

        const timeTd = document.createElement('td');
        timeTd.style.fontSize = '0.8rem';
        const d = new Date(l.createdAt);
        timeTd.textContent = `${d.toLocaleDateString()} ${d.toLocaleTimeString()}`;

        const actorTd = document.createElement('td');
        actorTd.textContent = l.actorName || 'System';

        const roleTd = document.createElement('td');
        const rBadge = document.createElement('span');
        rBadge.className = 'badge';
        rBadge.style.backgroundColor = '#e2e8f0';
        rBadge.style.color = '#1e293b';
        rBadge.textContent = l.actorRole || 'System';
        roleTd.appendChild(rBadge);

        const actionTd = document.createElement('td');
        actionTd.style.fontWeight = '600';
        actionTd.textContent = l.action;

        const targetTd = document.createElement('td');
        targetTd.style.fontSize = '0.8rem';
        targetTd.textContent = l.targetId ? l.targetId.substring(0, 8) + '...' : '—';

        const detailsTd = document.createElement('td');
        detailsTd.style.fontSize = '0.85rem';
        detailsTd.textContent = l.details || '—';

        tr.appendChild(timeTd);
        tr.appendChild(actorTd);
        tr.appendChild(roleTd);
        tr.appendChild(actionTd);
        tr.appendChild(targetTd);
        tr.appendChild(detailsTd);
        auditTbody.appendChild(tr);
      });
    } catch (err) {
      auditTbody.innerHTML = `<tr><td colspan="6" style="color:var(--danger);">Error loading logs: ${err.message}</td></tr>`;
    }
  }

  // Handle Add Doctor
  addDocForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearAlert('admin-alert');

    const fullName = document.getElementById('doc-fullname').value;
    const specialtyId = document.getElementById('doc-specialty').value;
    const room = document.getElementById('doc-room').value;
    const slotMinutes = parseInt(document.getElementById('doc-slotminutes').value, 10);

    try {
      await apiRequest('/doctors', {
        method: 'POST',
        body: { fullName, specialtyId, room, slotMinutes }
      });
      showAlert('admin-alert', `Doctor ${fullName} created successfully!`, 'success');
      addDocForm.reset();
      loadDoctors();
      loadAuditLogs();
    } catch (err) {
      showAlert('admin-alert', err.message, 'error');
    }
  });

  // Handle Add Specialty
  addSpecForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearAlert('admin-alert');

    const name = document.getElementById('spec-name').value;
    const description = document.getElementById('spec-desc').value;

    try {
      await apiRequest('/specialties', {
        method: 'POST',
        body: { name, description }
      });
      showAlert('admin-alert', `Specialty "${name}" created!`, 'success');
      addSpecForm.reset();
      loadSpecialties();
      loadAuditLogs();
    } catch (err) {
      showAlert('admin-alert', err.message, 'error');
    }
  });

  // Handle Nager.Date Holiday Import
  btnImportHolidays.addEventListener('click', async () => {
    const year = holidayYearInput.value;
    holidayStatus.textContent = `Syncing Egyptian holidays for ${year} from Nager.Date...`;
    holidayStatus.style.color = 'var(--text-muted)';
    btnImportHolidays.disabled = true;

    try {
      const res = await apiRequest(`/holidays?year=${year}`, {
        method: 'POST'
      });
      holidayStatus.textContent = `✅ Successfully imported ${res.count} public holidays for Egypt (${year})!`;
      holidayStatus.style.color = 'var(--success)';
      loadAuditLogs();
    } catch (err) {
      holidayStatus.textContent = `❌ Failed to import holidays: ${err.message}`;
      holidayStatus.style.color = 'var(--danger)';
    } finally {
      btnImportHolidays.disabled = false;
    }
  });

  btnRefreshAudit.addEventListener('click', loadAuditLogs);

  // Initialize
  loadSpecialties();
  loadDoctors();
  loadAuditLogs();
});
