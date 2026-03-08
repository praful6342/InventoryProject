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