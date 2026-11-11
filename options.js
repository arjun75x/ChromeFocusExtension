/* FocusBlock Modern Options Script */

const browser = chrome;

// Days mapping: index 0 = Sun, 1 = Mon, ..., 6 = Sat
let groupDays1 = [false, true, true, true, true, true, false]; // default Mon-Fri
let groupDays2 = [false, true, true, true, true, true, false];

// Helper to convert "0900-1700" to { start: "09:00", end: "17:00" }
function parseTimes(timesStr) {
  if (!timesStr || !/^\d{4}-\d{4}$/.test(timesStr.trim())) {
    return { start: "09:00", end: "17:00" };
  }
  const parts = timesStr.trim().split("-");
  const s = parts[0];
  const e = parts[1];
  return {
    start: `${s.slice(0, 2)}:${s.slice(2, 4)}`,
    end: `${e.slice(0, 2)}:${e.slice(2, 4)}`
  };
}

// Helper to convert "09:00" and "17:00" to "0900-1700"
function encodeTimes(startStr, endStr) {
  const s = (startStr || "09:00").replace(":", "");
  const e = (endStr || "17:00").replace(":", "");
  return `${s}-${e}`;
}

// Show feedback toast
function showToast(message) {
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => {
    toast.classList.remove("show");
  }, 2400);
}

// Load and populate settings
function loadSettings() {
  browser.storage.local.get(null).then((options) => {
    // Group 1
    const name1 = options["setName1"] || "Focus List";
    const sites1 = (options["sites1"] || "").split(/\s+/).filter(Boolean).join("\n");
    const times1 = options["times1"] || "";
    if (Array.isArray(options["days1"])) {
      groupDays1 = options["days1"].slice();
    }

    document.getElementById("setName1").value = name1;
    document.getElementById("sites1").value = sites1;

    const schedToggle1 = document.getElementById("schedToggle1");
    const schedConfig1 = document.getElementById("schedConfig1");
    if (times1 && times1.trim().length > 0 && times1 !== "0000-0000") {
      schedToggle1.checked = true;
      schedConfig1.style.display = "flex";
      const parsed = parseTimes(times1);
      document.getElementById("schedStart1").value = parsed.start;
      document.getElementById("schedEnd1").value = parsed.end;
    } else {
      schedToggle1.checked = false;
      schedConfig1.style.display = "none";
    }
    updateDayPills(1);

    // Group 2
    const name2 = options["setName2"] || "Deep Work";
    const sites2 = (options["sites2"] || "").split(/\s+/).filter(Boolean).join("\n");
    const times2 = options["times2"] || "";
    if (Array.isArray(options["days2"])) {
      groupDays2 = options["days2"].slice();
    }

    document.getElementById("setName2").value = name2;
    document.getElementById("sites2").value = sites2;

    const schedToggle2 = document.getElementById("schedToggle2");
    const schedConfig2 = document.getElementById("schedConfig2");
    if (times2 && times2.trim().length > 0 && times2 !== "0000-0000") {
      schedToggle2.checked = true;
      schedConfig2.style.display = "flex";
      const parsed = parseTimes(times2);
      document.getElementById("schedStart2").value = parsed.start;
      document.getElementById("schedEnd2").value = parsed.end;
    } else {
      schedToggle2.checked = false;
      schedConfig2.style.display = "none";
    }
    updateDayPills(2);

    // General Preferences
    document.getElementById("customMsg").value = options["customMsg1"] || "";
  });
}

// Update active states on day selector pills
function updateDayPills(setNum) {
  const container = document.getElementById(`daysPills${setNum}`);
  const daysArr = setNum === 1 ? groupDays1 : groupDays2;
  if (!container) return;

  container.querySelectorAll(".day-pill").forEach((pill) => {
    const dayIdx = parseInt(pill.getAttribute("data-day"), 10);
    pill.classList.toggle("active", Boolean(daysArr[dayIdx]));
  });
}

// Save all settings
function saveSettings() {
  const name1 = document.getElementById("setName1").value.trim() || "Focus List";
  const rawSites1 = document.getElementById("sites1").value;
  const sites1 = rawSites1.split(/[\s,]+/).filter(Boolean).join(" ");
  const schedEnabled1 = document.getElementById("schedToggle1").checked;
  const times1 = schedEnabled1
    ? encodeTimes(document.getElementById("schedStart1").value, document.getElementById("schedEnd1").value)
    : "";

  const name2 = document.getElementById("setName2").value.trim() || "Deep Work";
  const rawSites2 = document.getElementById("sites2").value;
  const sites2 = rawSites2.split(/[\s,]+/).filter(Boolean).join(" ");
  const schedEnabled2 = document.getElementById("schedToggle2").checked;
  const times2 = schedEnabled2
    ? encodeTimes(document.getElementById("schedStart2").value, document.getElementById("schedEnd2").value)
    : "";

  const customMsg = document.getElementById("customMsg").value.trim();

  // Save Group 1
  browser.runtime.sendMessage({
    type: "save-group-settings",
    set: 1,
    setName: name1,
    sites: sites1,
    schedule: {
      enabled: schedEnabled1,
      times: times1,
      days: groupDays1
    },
    customMsg: customMsg
  }, () => {
    // Save Group 2
    browser.runtime.sendMessage({
      type: "save-group-settings",
      set: 2,
      setName: name2,
      sites: sites2,
      schedule: {
        enabled: schedEnabled2,
        times: times2,
        days: groupDays2
      },
      customMsg: customMsg
    }, () => {
      showToast("Settings saved successfully!");
    });
  });
}

// Document Ready
document.addEventListener("DOMContentLoaded", () => {
  loadSettings();

  // Close / Back button
  document.getElementById("closeSettingsBtn").addEventListener("click", () => {
    window.close();
  });

  // Schedule Toggles
  const toggle1 = document.getElementById("schedToggle1");
  const config1 = document.getElementById("schedConfig1");
  toggle1.addEventListener("change", () => {
    config1.style.display = toggle1.checked ? "flex" : "none";
  });

  const toggle2 = document.getElementById("schedToggle2");
  const config2 = document.getElementById("schedConfig2");
  toggle2.addEventListener("change", () => {
    config2.style.display = toggle2.checked ? "flex" : "none";
  });

  // Day Pills Click Listeners
  document.querySelectorAll("#daysPills1 .day-pill").forEach((pill) => {
    pill.addEventListener("click", () => {
      const dayIdx = parseInt(pill.getAttribute("data-day"), 10);
      groupDays1[dayIdx] = !groupDays1[dayIdx];
      updateDayPills(1);
    });
  });

  document.querySelectorAll("#daysPills2 .day-pill").forEach((pill) => {
    pill.addEventListener("click", () => {
      const dayIdx = parseInt(pill.getAttribute("data-day"), 10);
      groupDays2[dayIdx] = !groupDays2[dayIdx];
      updateDayPills(2);
    });
  });

  // Quick Add Chips in Options
  document.querySelectorAll(".opt-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      const setNum = chip.getAttribute("data-set");
      const domain = chip.getAttribute("data-domain");
      const textarea = document.getElementById(`sites${setNum}`);
      if (textarea) {
        const lines = textarea.value.split(/\s+/).filter(Boolean);
        if (!lines.includes(domain)) {
          lines.push(domain);
          textarea.value = lines.join("\n");
        }
      }
    });
  });

  // Save Button
  document.getElementById("saveBtn").addEventListener("click", saveSettings);
});
