(function () {
  "use strict";

  const DEFAULT_SETTINGS = {
    enabled: true,
    showMode: "always"
  };

  const enabledInput = document.getElementById("enabled");
  const showModeInputs = Array.from(document.querySelectorAll("[name='showMode']"));
  const storage = chrome.storage.sync || chrome.storage.local;

  function render(settings) {
    enabledInput.checked = settings.enabled;

    for (const input of showModeInputs) {
      input.checked = input.value === settings.showMode;
    }
  }

  function save(patch) {
    storage.set(patch);
  }

  storage.get(DEFAULT_SETTINGS, (settings) => {
    render({ ...DEFAULT_SETTINGS, ...settings });
  });

  enabledInput.addEventListener("change", () => {
    save({ enabled: enabledInput.checked });
  });

  for (const input of showModeInputs) {
    input.addEventListener("change", () => {
      if (input.checked) {
        save({ showMode: input.value });
      }
    });
  }
})();
