// checkout-payments.js - Split payment handling for checkout page

// Global variables
let originalTotal = 0;
let currentDiscountedTotal = 0;

// Initialize the page
document.addEventListener('DOMContentLoaded', function() {
    // Get the original total from the hidden element or from the order total span
    const orderTotalSpan = document.getElementById('orderTotal');
    if (orderTotalSpan) {
        const totalText = orderTotalSpan.innerText.replace('₹', '');
        originalTotal = parseFloat(totalText);
        currentDiscountedTotal = originalTotal;
    }

    // Sale date: no default value (seller must pick manually)
    // (We do NOT set any default date)

    // Attach event listeners to existing payment rows
    attachEventToAllPaymentRows();

    // Add payment row button
    const addPaymentBtn = document.getElementById('addPaymentBtn');
    if (addPaymentBtn) {
        addPaymentBtn.addEventListener('click', addPaymentRow);
    }

    // Discount listeners
    const discountRadios = document.querySelectorAll('input[name="discount_type"]');
    discountRadios.forEach(radio => radio.addEventListener('change', updateDiscountedTotal));
    const discountValueInput = document.getElementById('discount_value');
    if (discountValueInput) {
        discountValueInput.addEventListener('input', updateDiscountedTotal);
    }

    // Form submission validation
    const checkoutForm = document.getElementById('checkoutForm');
    if (checkoutForm) {
        checkoutForm.addEventListener('submit', validateForm);
    }

    // Initial update
    updateRemaining();
});

// Helper: Update displayed discounted total from discount inputs (with rounding)
function updateDiscountedTotal() {
    const type = document.querySelector('input[name="discount_type"]:checked')?.value;
    const val = parseFloat(document.getElementById('discount_value')?.value) || 0;
    let discounted = originalTotal;

    if (type === 'percentage' && val >= 0 && val <= 100) {
        discounted = originalTotal * (1 - val / 100);
    } else if (type === 'fixed' && val >= 0 && val <= originalTotal) {
        discounted = originalTotal - val;
    }
    // Round up to the nearest whole rupee
    discounted = Math.ceil(discounted);
    currentDiscountedTotal = discounted;

    const discountedTotalSpan = document.getElementById('discounted_total');
    if (discountedTotalSpan) discountedTotalSpan.innerText = '₹' + discounted.toFixed(2);
    const orderTotalSpan = document.getElementById('orderTotal');
    if (orderTotalSpan) orderTotalSpan.innerText = '₹' + discounted.toFixed(2);

    updateRemaining();
}

// Calculate sum of all payment amounts
function getTotalPaid() {
    let total = 0;
    document.querySelectorAll('.payment-amount').forEach(input => {
        let val = parseFloat(input.value);
        if (!isNaN(val) && val > 0) total += val;
    });
        return total;
}

// Update remaining amount and check overpayment
function updateRemaining() {
    const totalPaid = getTotalPaid();
    let remaining = currentDiscountedTotal - totalPaid;
    const remainingSpan = document.getElementById('remainingAmount');
    const changeRow = document.getElementById('changeRow');
    const changeSpan = document.getElementById('changeAmount');
    const warningMsg = document.getElementById('warningMsg');
    const submitBtn = document.getElementById('submitBtn');

    if (!remainingSpan) return;

    if (remaining < 0) {
        // Overpayment: show change
        const change = -remaining;
        remainingSpan.innerText = '₹0.00';
        if (changeSpan) changeSpan.innerText = '₹' + change.toFixed(2);
        if (changeRow) changeRow.style.display = 'flex';
        if (warningMsg) {
            warningMsg.style.display = 'block';
            warningMsg.innerHTML = '<i class="fa-solid fa-circle-info"></i> Customer overpaid by ₹' + change.toFixed(2) + '. Change will be displayed on bill.';
        }
        if (submitBtn) submitBtn.disabled = false;
    } else {
        remainingSpan.innerText = '₹' + remaining.toFixed(2);
        if (changeRow) changeRow.style.display = 'none';
        if (warningMsg) warningMsg.style.display = 'none';
        if (submitBtn) submitBtn.disabled = (remaining > 0);
    }
}

// Auto-fill the last payment row when it loses focus if remaining > 0 and amount empty
function autoFillLastRow(row) {
    const rows = document.querySelectorAll('.payment-row');
    if (rows.length === 0) return;
    const lastRow = rows[rows.length - 1];
    if (row !== lastRow) return;

    const amountInput = lastRow.querySelector('.payment-amount');
    const methodSelect = lastRow.querySelector('.payment-method');
    if ((!amountInput.value || parseFloat(amountInput.value) === 0) && methodSelect.value) {
        const remaining = currentDiscountedTotal - getTotalPaid();
        if (remaining > 0) {
            amountInput.value = remaining.toFixed(2);
            updateRemaining();
        }
    }
}

// Add new payment row
function addPaymentRow() {
    const container = document.getElementById('payments-container');
    if (!container) return;
    const index = document.querySelectorAll('.payment-row').length;
    const newRow = document.createElement('div');
    newRow.className = 'payment-row';
    newRow.setAttribute('data-index', index);
    newRow.innerHTML = `
    <div class="row g-2 align-items-center">
    <div class="col-md-5">
    <label class="form-label">Payment Method</label>
    <select class="form-select payment-method" name="payments[${index}][method]" required>
    <option value="">Select</option>
    <option value="Cash">Cash</option>
    <option value="UPI">UPI</option>
    <option value="Card">Card</option>
    </select>
    </div>
    <div class="col-md-5">
    <label class="form-label">Amount (₹)</label>
    <input type="number" step="0.01" class="form-control payment-amount" name="payments[${index}][amount]" min="0" step="0.01" required>
    </div>
    <div class="col-md-2 text-center">
    <i class="fa-solid fa-trash remove-payment"></i>
    </div>
    </div>
    `;
    container.appendChild(newRow);
    attachRowEvents(newRow);
    updateRemoveButtonsVisibility();
}

// Attach event listeners to a single payment row
function attachRowEvents(row) {
    const methodSelect = row.querySelector('.payment-method');
    const amountInput = row.querySelector('.payment-amount');
    const removeBtn = row.querySelector('.remove-payment');

    if (methodSelect) {
        methodSelect.addEventListener('change', () => {
            updateRemaining();
            if (isLastRow(row) && (!amountInput.value || parseFloat(amountInput.value) === 0)) {
                autoFillLastRow(row);
            }
        });
    }
    if (amountInput) {
        amountInput.addEventListener('input', () => updateRemaining());
        amountInput.addEventListener('blur', () => {
            if (isLastRow(row) && (!amountInput.value || parseFloat(amountInput.value) === 0)) {
                autoFillLastRow(row);
            }
        });
    }
    if (removeBtn) {
        removeBtn.addEventListener('click', () => {
            if (document.querySelectorAll('.payment-row').length > 1) {
                row.remove();
                updateRemoveButtonsVisibility();
                updateRemaining();
            }
        });
    }
}

// Attach events to all existing payment rows
function attachEventToAllPaymentRows() {
    document.querySelectorAll('.payment-row').forEach(row => attachRowEvents(row));
    updateRemoveButtonsVisibility();
}

// Helper: check if a row is the last payment row
function isLastRow(row) {
    const rows = document.querySelectorAll('.payment-row');
    return rows.length > 0 && rows[rows.length - 1] === row;
}

// Update visibility of remove buttons (hide if only one row)
function updateRemoveButtonsVisibility() {
    const rows = document.querySelectorAll('.payment-row');
    rows.forEach((row, idx) => {
        const btn = row.querySelector('.remove-payment');
        if (btn) btn.style.display = rows.length > 1 ? 'inline-block' : 'none';
    });
}

// Validate form before submission: ensure total paid >= discounted total
function validateForm(e) {
    const totalPaid = getTotalPaid();
    if (totalPaid < currentDiscountedTotal) {
        e.preventDefault();
        showToast('Total paid amount is less than the bill total. Please add more payments or adjust.', 'danger');
    }
    // If overpaid, it's allowed (change will be given)
}
