document.addEventListener('DOMContentLoaded', async () => {
      const specialtySelect = document.getElementById('filter-specialty');
      const nameInput = document.getElementById('filter-name');
      const doctorsContainer = document.getElementById('doctors-container');

      // 1. Load specialties
      try {
        const specialties = await apiRequest('/specialties');
        specialties.forEach(spec => {
          const opt = document.createElement('option');
          opt.value = spec.name;
          opt.textContent = spec.name;
          specialtySelect.appendChild(opt);
        });
      } catch (err) {
        console.error('Failed to load specialties:', err);
      }

      // 2. Fetch doctors
      async function loadDoctors() {
        doctorsContainer.innerHTML = '';
        const specialty = specialtySelect.value;
        const name = nameInput.value;

        const query = new URLSearchParams();
        if (specialty) query.append('specialty', specialty);
        if (name) query.append('name', name);

        try {
          const doctors = await apiRequest(`/doctors?${query.toString()}`);
          if (doctors.length === 0) {
            const empty = document.createElement('p');
            empty.textContent = 'No matching active doctors found.';
            empty.style.color = 'var(--text-muted)';
            doctorsContainer.appendChild(empty);
            return;
          }

          doctors.forEach(doc => {
            const card = document.createElement('div');
            card.className = 'doctor-card';

            const topDiv = document.createElement('div');
            const nameEl = document.createElement('h3');
            nameEl.className = 'doc-name';
            nameEl.textContent = doc.fullName;

            const specEl = document.createElement('div');
            specEl.className = 'doc-spec';
            specEl.textContent = doc.specialtyName;

            const infoEl = document.createElement('div');
            infoEl.className = 'doc-info';
            infoEl.textContent = `📍 ${doc.room} • ⏱️ ${doc.slotMinutes} min consultations`;

            topDiv.appendChild(nameEl);
            topDiv.appendChild(specEl);
            topDiv.appendChild(infoEl);

            const bookBtn = document.createElement('a');
            bookBtn.href = `book.html?doctorId=${doc.id}`;
            bookBtn.className = 'btn btn-primary btn-sm';
            bookBtn.textContent = 'View Free Slots & Book';

            card.appendChild(topDiv);
            card.appendChild(bookBtn);
            doctorsContainer.appendChild(card);
          });
        } catch (err) {
          doctorsContainer.innerHTML = '';
          showAlert('doctors-container', `Error loading doctors: ${err.message}`, 'error');
        }
      }

      specialtySelect.addEventListener('change', loadDoctors);
      nameInput.addEventListener('input', loadDoctors);
      loadDoctors();
    });
