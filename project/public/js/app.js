// Toast notification system
const toastContainer = document.querySelector('.toast-container');
if (!toastContainer) {
  const container = document.createElement('div');
  container.className = 'toast-container';
  document.body.appendChild(container);
}

function showToast(message, type = 'success', duration = 3000) {
  const toast = document.createElement('div');
  toast.className = `toast align-items-center text-white bg-${type} border-0`;
  toast.setAttribute('role', 'alert');
  toast.setAttribute('aria-live', 'assertive');
  toast.setAttribute('aria-atomic', 'true');
  toast.innerHTML = `
  <div class="d-flex">
  <div class="toast-body">
  ${message}
  </div>
  <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
  </div>
  `;
  document.querySelector('.toast-container').appendChild(toast);
  const bsToast = new bootstrap.Toast(toast, { autohide: true, delay: duration });
  bsToast.show();
  toast.addEventListener('hidden.bs.toast', () => toast.remove());
}

// Loading spinner for buttons
function setLoading(button, isLoading) {
  if (isLoading) {
    button.disabled = true;
    button.dataset.originalText = button.innerHTML;
    button.innerHTML = `<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span> Loading...`;
  } else {
    button.disabled = false;
    button.innerHTML = button.dataset.originalText || 'Submit';
  }
}

// Format currency
function formatCurrency(amount) {
  return '₹' + parseFloat(amount).toFixed(2);
}

// Debounce function for search inputs
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Confirm dialog (Promise-based)
function confirmDialog(message, title = 'Confirm') {
  return new Promise((resolve) => {
    const modalId = 'confirmModal-' + Date.now();
    const modalHtml = `
    <div class="modal fade" id="${modalId}" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog">
    <div class="modal-content">
    <div class="modal-header">
    <h5 class="modal-title">${title}</h5>
    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
    </div>
    <div class="modal-body">
    <p>${message}</p>
    </div>
    <div class="modal-footer">
    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
    <button type="button" class="btn btn-primary" id="${modalId}-confirm">Confirm</button>
    </div>
    </div>
    </div>
    </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    const modalEl = document.getElementById(modalId);
    const modal = new bootstrap.Modal(modalEl);
    const confirmBtn = document.getElementById(`${modalId}-confirm`);

    const cleanup = () => {
      modal.dispose();
      modalEl.remove();
    };

    confirmBtn.addEventListener('click', () => {
      resolve(true);
      modal.hide();
      cleanup();
    });

    modalEl.addEventListener('hidden.bs.modal', () => {
      resolve(false);
      cleanup();
    });

    modal.show();
  });
}

// AJAX form submission helper (for delete buttons etc.)
async function submitForm(url, method = 'POST', data = {}) {
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
  };
  if (method !== 'GET' && method !== 'HEAD') {
    options.body = JSON.stringify(data);
  }
  const response = await fetch(url, options);
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Request failed');
  }
  return response.json();
}

// Attach global confirm for delete links/buttons with class 'needs-confirm'
document.addEventListener('DOMContentLoaded', () => {
  document.body.addEventListener('click', async (e) => {
    const target = e.target.closest('.needs-confirm');
    if (!target) return;
    if (target.classList.contains('confirmed')) return;

    e.preventDefault();
    const message = target.dataset.confirmMessage || 'Are you sure?';
    const title = target.dataset.confirmTitle || 'Confirm';
    const confirmed = await confirmDialog(message, title);
    if (confirmed) {
      target.classList.add('confirmed');
      if (target.tagName === 'A' && target.href) {
        window.location.href = target.href;
      } else if (target.tagName === 'BUTTON' || target.getAttribute('type') === 'submit') {
        target.form?.submit();
      } else {
        target.click();
      }
      target.classList.remove('confirmed');
    }
  });
});
