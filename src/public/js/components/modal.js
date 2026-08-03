// Accessible Modal Component

export function openModal({ title, contentHtml, onConfirm }) {
  closeModal();

  const overlay = document.createElement('div');
  overlay.id = 'forgeModalOverlay';
  overlay.className = 'modal-overlay';

  overlay.innerHTML = `
    <div class="modal-card">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
        <h3 style="font-weight:700;">${title}</h3>
        <button id="modalCloseBtn" style="background:none; border:none; color:var(--text-main); font-size:1.2rem; cursor:pointer;">&times;</button>
      </div>
      <div class="modal-body">
        ${contentHtml}
      </div>
      <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:1.5rem;">
        <button id="modalCancelBtn" class="btn btn-secondary">Cancel</button>
        <button id="modalConfirmBtn" class="btn btn-primary">Submit</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const close = () => closeModal();
  overlay.querySelector('#modalCloseBtn').addEventListener('click', close);
  overlay.querySelector('#modalCancelBtn').addEventListener('click', close);

  overlay.querySelector('#modalConfirmBtn').addEventListener('click', async () => {
    if (onConfirm) {
      const shouldClose = await onConfirm(overlay);
      if (shouldClose !== false) close();
    } else {
      close();
    }
  });
}

export function closeModal() {
  const existing = document.getElementById('forgeModalOverlay');
  if (existing) {
    existing.remove();
  }
}
