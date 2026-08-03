// File Upload Drag and Drop Component

export function renderFileUpload({
  id = 'forgeFileUpload',
  label = 'Upload File',
  accept = '*/*',
  className = ''
}) {
  return `
    <div class="form-group ${className}" id="${id}">
      ${label ? `<label class="text-xs font-semibold text-outline">${label}</label>` : ''}
      <div class="forge-dropzone" id="${id}_dropzone">
        <input type="file" id="${id}_input" class="hidden" accept="${accept}" multiple />
        <span class="material-symbols-outlined text-3xl text-royal-slate-blue mb-2">cloud_upload</span>
        <p class="text-xs font-bold text-white mb-0.5">Drag & drop files here, or <span class="text-royal-slate-blue hover:underline">browse</span></p>
        <p class="text-[10px] text-outline">Supports files up to 10MB</p>
        
        <div class="file-progress-bar hidden w-full bg-white/10 h-1.5 rounded-full overflow-hidden mt-4">
          <div class="file-progress-fill bg-royal-slate-blue h-full w-0 transition-all duration-300"></div>
        </div>
        <div class="file-list-preview mt-3 space-y-1.5 text-left"></div>
      </div>
    </div>
  `;
}

export function attachFileUploadEvents(containerId, onFilesSelected) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const dropzone = container.querySelector('.forge-dropzone');
  const fileInput = container.querySelector('input[type="file"]');
  const preview = container.querySelector('.file-list-preview');
  const progressBar = container.querySelector('.file-progress-bar');
  const progressFill = container.querySelector('.file-progress-fill');

  if (!dropzone || !fileInput) return;

  dropzone.addEventListener('click', () => fileInput.click());

  ['dragenter', 'dragover'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.add('dragover');
    });
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.remove('dragover');
    });
  });

  const handleFiles = (files) => {
    const fileArray = Array.from(files);
    if (!fileArray.length) return;

    if (progressBar && progressFill) {
      progressBar.classList.remove('hidden');
      progressFill.style.width = '0%';
      let percent = 0;
      const interval = setInterval(() => {
        percent += 25;
        progressFill.style.width = `${percent}%`;
        if (percent >= 100) {
          clearInterval(interval);
          setTimeout(() => progressBar.classList.add('hidden'), 600);
        }
      }, 100);
    }

    if (preview) {
      preview.innerHTML = fileArray.map(f => `
        <div class="flex items-center justify-between p-2 rounded-lg bg-white/5 border border-white/10 text-xs">
          <div class="flex items-center gap-2 truncate">
            <span class="material-symbols-outlined text-base text-royal-slate-blue">description</span>
            <span class="font-semibold text-white truncate">${f.name}</span>
            <span class="text-[10px] text-outline">(${(f.size / 1024).toFixed(1)} KB)</span>
          </div>
          <span class="material-symbols-outlined text-xs text-emerald-400">check_circle</span>
        </div>
      `).join('');
    }

    document.dispatchEvent(new CustomEvent('forge:file-upload', {
      detail: { containerId, files: fileArray }
    }));

    if (onFilesSelected) onFilesSelected(fileArray);
  };

  dropzone.addEventListener('drop', (e) => {
    handleFiles(e.dataTransfer.files);
  });

  fileInput.addEventListener('change', (e) => {
    handleFiles(e.target.files);
  });
}
