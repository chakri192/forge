// Basic Rich Text Editor Component

export function renderRichTextEditor({
  id = 'forgeRichTextEditor',
  label = 'Content',
  placeholder = 'Write content here...',
  value = '',
  className = ''
}) {
  return `
    <div class="form-group ${className}" id="${id}">
      ${label ? `<label class="text-xs font-semibold text-outline">${label}</label>` : ''}
      <div class="forge-rte">
        <div class="forge-rte-toolbar">
          <button type="button" class="forge-rte-btn" data-cmd="bold" title="Bold"><b>B</b></button>
          <button type="button" class="forge-rte-btn" data-cmd="italic" title="Italic"><i>I</i></button>
          <button type="button" class="forge-rte-btn" data-cmd="underline" title="Underline"><u>U</u></button>
          <button type="button" class="forge-rte-btn" data-cmd="strikeThrough" title="Strikethrough"><s>S</s></button>
          <span class="w-[1px] h-4 bg-white/10 my-auto"></span>
          <button type="button" class="forge-rte-btn" data-cmd="insertUnorderedList" title="Bullet List">• List</button>
          <button type="button" class="forge-rte-btn" data-cmd="formatBlock" data-val="H3" title="Heading">H3</button>
          <button type="button" class="forge-rte-btn" data-cmd="createLink" title="Link">Link</button>
          <button type="button" class="forge-rte-btn" data-cmd="removeFormat" title="Clear Formatting">Clear</button>
        </div>
        <div class="forge-rte-content" contenteditable="true" data-placeholder="${placeholder}">${value}</div>
      </div>
    </div>
  `;
}

export function attachRichTextEditorEvents(containerId, onChange) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const toolbar = container.querySelector('.forge-rte-toolbar');
  const editor = container.querySelector('.forge-rte-content');

  if (!toolbar || !editor) return;

  toolbar.querySelectorAll('.forge-rte-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const cmd = btn.dataset.cmd;
      const val = btn.dataset.val || null;

      if (cmd === 'createLink') {
        const url = prompt('Enter URL:', 'https://');
        if (url) document.execCommand(cmd, false, url);
      } else {
        document.execCommand(cmd, false, val);
      }

      editor.focus();
      triggerChange();
    });
  });

  const triggerChange = () => {
    const html = editor.innerHTML;
    document.dispatchEvent(new CustomEvent('forge:rte-change', {
      detail: { containerId, content: html }
    }));
    if (onChange) onChange(html);
  };

  editor.addEventListener('input', triggerChange);
}
