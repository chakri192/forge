// Tooltip System Component

let tooltipBubble = null;

function getTooltipBubble() {
  if (!tooltipBubble) {
    tooltipBubble = document.createElement('div');
    tooltipBubble.className = 'forge-tooltip-bubble';
    document.body.appendChild(tooltipBubble);
  }
  return tooltipBubble;
}

export function initTooltips() {
  const bubble = getTooltipBubble();

  document.addEventListener('mouseover', (e) => {
    const target = e.target.closest('[data-tooltip]');
    if (!target) {
      bubble.style.opacity = '0';
      return;
    }

    const text = target.getAttribute('data-tooltip');
    const pos = target.getAttribute('data-tooltip-pos') || 'top';

    if (!text) return;

    bubble.textContent = text;
    bubble.style.opacity = '1';

    const rect = target.getBoundingClientRect();
    const bubbleRect = bubble.getBoundingClientRect();

    let top = 0;
    let left = 0;

    if (pos === 'top') {
      top = rect.top - bubbleRect.height - 8;
      left = rect.left + (rect.width / 2) - (bubbleRect.width / 2);
    } else if (pos === 'bottom') {
      top = rect.bottom + 8;
      left = rect.left + (rect.width / 2) - (bubbleRect.width / 2);
    } else if (pos === 'left') {
      top = rect.top + (rect.height / 2) - (bubbleRect.height / 2);
      left = rect.left - bubbleRect.width - 8;
    } else if (pos === 'right') {
      top = rect.top + (rect.height / 2) - (bubbleRect.height / 2);
      left = rect.right + 8;
    }

    bubble.style.top = `${Math.max(4, top + window.scrollY)}px`;
    bubble.style.left = `${Math.max(4, left + window.scrollX)}px`;
  });

  document.addEventListener('mouseout', (e) => {
    if (e.target.closest('[data-tooltip]')) {
      bubble.style.opacity = '0';
    }
  });
}
