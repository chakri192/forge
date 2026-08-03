// Date & Time Picker Component

export function renderDateTimePicker({
  id = 'forgeDateTimePicker',
  label = 'Select Date & Time',
  value = '',
  className = ''
}) {
  return `
    <div class="form-group ${className}" id="${id}">
      ${label ? `<label class="text-xs font-semibold text-outline">${label}</label>` : ''}
      <div class="relative">
        <input type="datetime-local" class="form-control w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:border-royal-slate-blue focus:outline-none" value="${value}" />
        <span class="material-symbols-outlined absolute right-3 top-2.5 text-outline text-base pointer-events-none">calendar_today</span>
      </div>
    </div>
  `;
}

export function attachDateTimePickerEvents(containerId, onChange) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const input = container.querySelector('input');
  if (input) {
    input.addEventListener('change', (e) => {
      const val = e.target.value;
      document.dispatchEvent(new CustomEvent('forge:datetime-change', {
        detail: { containerId, value: val }
      }));
      if (onChange) onChange(val);
    });
  }
}
