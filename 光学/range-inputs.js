const controls = new Map();

function syncRangeNumberInputs() {
  for (const [range, numberInput] of controls) {
    if (document.activeElement !== numberInput) numberInput.value = range.value;
    numberInput.disabled = range.disabled;
  }
}

function installRangeNumberInputs() {
  for (const range of document.querySelectorAll('label.range-control input[type="range"]')) {
    if (controls.has(range)) continue;
    const label = range.closest('label.range-control');
    const caption = label?.querySelector('span');
    if (!label || !caption || !range.id) continue;

    const wrapper = document.createElement('div');
    wrapper.className = 'range-control-with-number';
    if (label.classList.contains('geometry-control')) wrapper.classList.add('geometry-control');
    if (label.id) {
      wrapper.id = label.id;
      label.removeAttribute('id');
    }
    wrapper.hidden = label.hidden;
    label.hidden = false;
    label.parentNode.insertBefore(wrapper, label);
    wrapper.appendChild(label);

    const numberInput = document.createElement('input');
    numberInput.type = 'number';
    numberInput.id = `${range.id}-number`;
    numberInput.className = 'range-number-input';
    numberInput.min = range.min;
    numberInput.max = range.max;
    numberInput.step = range.step;
    numberInput.value = range.value;
    numberInput.inputMode = 'decimal';
    numberInput.setAttribute('aria-label', `${caption.textContent.trim()}，手动输入`);
    numberInput.title = `可输入 ${range.min} 至 ${range.max}，步进 ${range.step}`;
    wrapper.appendChild(numberInput);
    controls.set(range, numberInput);

    let editingNumber = false;
    range.addEventListener('input', () => {
      if (!editingNumber && document.activeElement !== numberInput) numberInput.value = range.value;
    });
    numberInput.addEventListener('input', () => {
      if (numberInput.value === '' || numberInput.validity.badInput) return;
      const value = Number(numberInput.value);
      if (!Number.isFinite(value) || value < Number(range.min) || value > Number(range.max)) return;
      editingNumber = true;
      range.value = String(value);
      range.dispatchEvent(new Event('input', { bubbles: true }));
      editingNumber = false;
    });

    const commit = () => {
      if (numberInput.value === '' || numberInput.validity.badInput) {
        numberInput.value = range.value;
        return;
      }
      const value = Number(numberInput.value);
      if (!Number.isFinite(value)) {
        numberInput.value = range.value;
        return;
      }
      const clamped = Math.max(Number(range.min), Math.min(Number(range.max), value));
      editingNumber = true;
      range.value = String(clamped);
      range.dispatchEvent(new Event('input', { bubbles: true }));
      numberInput.value = range.value;
      editingNumber = false;
    };
    numberInput.addEventListener('change', commit);
    numberInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        commit();
        numberInput.blur();
      }
    });
  }
  syncRangeNumberInputs();
  window.syncRangeNumberInputs = syncRangeNumberInputs;
}

export { installRangeNumberInputs, syncRangeNumberInputs };
