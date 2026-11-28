function onTurnstileSuccess(token) {
      document.getElementById('reg-turnstile-token').value = token;
    }

    document.addEventListener('DOMContentLoaded', () => {
      const tabLogin = document.getElementById('tab-login');
      const tabRegister = document.getElementById('tab-register');
      const loginForm = document.getElementById('login-form');
      const registerForm = document.getElementById('register-form');

      tabLogin.addEventListener('click', () => {
        tabLogin.style.borderBottom = '2px solid var(--primary)';
        tabLogin.style.color = 'var(--primary)';
        tabLogin.style.fontWeight = '700';
        tabRegister.style.borderBottom = 'none';
        tabRegister.style.color = 'var(--text-muted)';
        tabRegister.style.fontWeight = '500';
        loginForm.style.display = 'block';
        registerForm.style.display = 'none';
        clearAlert('auth-alert');
      });

      tabRegister.addEventListener('click', () => {
        tabRegister.style.borderBottom = '2px solid var(--primary)';
        tabRegister.style.color = 'var(--primary)';
        tabRegister.style.fontWeight = '700';
        tabLogin.style.borderBottom = 'none';
        tabLogin.style.color = 'var(--text-muted)';
        tabLogin.style.fontWeight = '500';
        loginForm.style.display = 'none';
        registerForm.style.display = 'block';
        clearAlert('auth-alert');
      });

      // Handle Login
      loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearAlert('auth-alert');
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;

        try {
          const res = await apiRequest('/sessions', {
            method: 'POST',
            body: { email, password }
          });

          localStorage.setItem('token', res.token);
          localStorage.setItem('user', JSON.stringify(res.user));

          showAlert('auth-alert', 'Signed in successfully! Redirecting...', 'success');
          setTimeout(() => {
            if (res.user.role === 'Admin') window.location.href = 'admin.html';
            else if (res.user.role === 'Receptionist') window.location.href = 'reception.html';
            else window.location.href = 'book.html';
          }, 800);
        } catch (err) {
          showAlert('auth-alert', err.message, 'error');
        }
      });

      // Handle Registration
      registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearAlert('auth-alert');

        const fullName = document.getElementById('reg-name').value;
        const email = document.getElementById('reg-email').value;
        const phone = document.getElementById('reg-phone').value;
        const password = document.getElementById('reg-password').value;
        const turnstileToken = document.getElementById('reg-turnstile-token').value || '1x00000000000000000000AA';

        try {
          const res = await apiRequest('/users', {
            method: 'POST',
            headers: {
              'X-Turnstile-Token': turnstileToken
            },
            body: {
              fullName,
              email,
              phone,
              password
            }
          });

          localStorage.setItem('token', res.token);
          localStorage.setItem('user', JSON.stringify(res.user));

          showAlert('auth-alert', 'Account created! Redirecting to booking...', 'success');
          setTimeout(() => {
            window.location.href = 'book.html';
          }, 800);
        } catch (err) {
          showAlert('auth-alert', err.message, 'error');
        }
      });
    });
