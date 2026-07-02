(() => {
  function bootSwitchFix() {
    const flashPanel = document.querySelector('#card')?.closest('.panel');
    const studyHead = document.querySelector('.study-head');
    const shuffleInput = document.querySelector('#shuffleInput');
    const readingInput = document.querySelector('#showReadingInput');
    if (!flashPanel || !studyHead || !shuffleInput || !readingInput) return setTimeout(bootSwitchFix, 120);

    shuffleInput.closest('label')?.classList.add('hidden-native-switch');
    readingInput.closest('label')?.classList.add('hidden-native-switch');

    document.querySelector('#studySwitches')?.remove();
    const row = document.createElement('div');
    row.id = 'studySwitches';
    row.className = 'study-switches';
    row.innerHTML = `
      <label class="ios-switch"><span>Shuffle</span><input id="shuffleSwitch" type="checkbox"><span class="switch-track"></span></label>
      <label class="ios-switch"><span>Reading</span><input id="readingSwitch" type="checkbox"><span class="switch-track"></span></label>
    `;
    studyHead.after(row);

    const shuffleSwitch = row.querySelector('#shuffleSwitch');
    const readingSwitch = row.querySelector('#readingSwitch');
    shuffleSwitch.checked = shuffleInput.checked;
    readingSwitch.checked = readingInput.checked;

    shuffleSwitch.addEventListener('change', () => {
      shuffleInput.checked = shuffleSwitch.checked;
      shuffleInput.dispatchEvent(new Event('change', { bubbles: true }));
    });

    readingSwitch.addEventListener('change', () => {
      readingInput.checked = readingSwitch.checked;
      readingInput.dispatchEvent(new Event('change', { bubbles: true }));
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootSwitchFix); else bootSwitchFix();
})();
