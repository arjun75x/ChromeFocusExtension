/* FocusBlock Modern Popup Script */

const browser = chrome;

let currentSet = 1;
let currentDomain = "";
let currentBlockedSites = [];
let selectedDurationMins = 25;
let sessionState = null;
let countdownTimerId = null;

// Clean domain helper
function extractDomain(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return parsed.hostname.replace(/^www\./i, "").toLowerCase();
    }
  } catch (e) {}
  return "";
}

// Format seconds into MM:SS
function formatTime(seconds) {
  seconds = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

// Show feedback toast
function showToast(message) {
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => {
    toast.classList.remove("show");
  }, 2200);
}

// Open extension page
function openExtensionPage(url) {
  const fullURL = browser.runtime.getURL(url);
  browser.tabs.query({ url: fullURL }).then((tabs) => {
    if (tabs.length > 0) {
      browser.tabs.update(tabs[0].id, { active: true });
      if (browser.windows) {
        browser.windows.update(tabs[0].windowId, { focused: true });
      }
    } else {
      browser.tabs.create({ url: fullURL });
    }
    window.close();
  }, () => {
    browser.tabs.create({ url: fullURL });
    window.close();
  });
}

// Fetch comprehensive state from background
function fetchState(callback) {
  browser.runtime.sendMessage({ type: "get-session-state", set: currentSet }, (response) => {
    if (browser.runtime.lastError || !response) {
      // Fallback
      browser.storage.local.get(null).then((data) => {
        const raw = (data && data[`sites${currentSet}`]) || "";
        currentBlockedSites = raw.split(/\s+/).filter(Boolean);
        sessionState = {
          set: currentSet,
          setName: (data && data[`setName${currentSet}`]) || (currentSet === 1 ? "Focus List" : "Deep Work"),
          setName1: (data && data["setName1"]) || "Focus List",
          setName2: (data && data["setName2"]) || "Deep Work",
          sites: raw,
          isSessionActive: false,
          secondsRemaining: 0,
          isBreakActive: false,
          breakSecondsRemaining: 0,
          hasSchedule: false
        };
        if (callback) callback();
      });
      return;
    }

    sessionState = response;
    const raw = response.sites || "";
    currentBlockedSites = raw.split(/\s+/).filter(Boolean);
    if (callback) callback();
  });
}

// Check if domain is in blocked list
function isDomainInList(domain) {
  if (!domain) return false;
  domain = domain.toLowerCase();
  return currentBlockedSites.some((item) => {
    const cleanItem = item.replace(/^\*+|\*+$/g, "").toLowerCase();
    return domain === cleanItem || domain.endsWith("." + cleanItem);
  });
}

// Main Render Function
function renderUI() {
  if (!sessionState) return;

  const currentGroupName = sessionState.setName || (currentSet === 1 ? "Focus List" : "Deep Work");

  // 1. Group Switcher Tab Names and Active States
  const tab1 = document.getElementById("groupTab1");
  const tab2 = document.getElementById("groupTab2");
  const tabName1 = document.getElementById("groupTabName1");
  const tabName2 = document.getElementById("groupTabName2");

  tabName1.textContent = sessionState.setName1 || "Focus List";
  tabName2.textContent = sessionState.setName2 || "Deep Work";

  tab1.classList.toggle("active", currentSet === 1);
  tab2.classList.toggle("active", currentSet === 2);

  // 2. Global Header Status Pill
  const globalPill = document.getElementById("globalStatusPill");
  if (sessionState.isBreakActive) {
    globalPill.className = "status-pill status-break";
    globalPill.textContent = "On Break";
  } else if (sessionState.isSessionActive) {
    globalPill.className = "status-pill status-active";
    globalPill.textContent = "Focus Active";
  } else {
    globalPill.className = "status-pill status-idle";
    globalPill.textContent = "Idle";
  }

  // 3. Hero Timer Card
  const idleView = document.getElementById("timerIdleView");
  const activeView = document.getElementById("timerActiveView");
  const breakView = document.getElementById("timerBreakView");
  const timerCard = document.getElementById("timerCard");

  if (sessionState.isBreakActive) {
    timerCard.classList.remove("is-active-session");
    idleView.style.display = "none";
    activeView.style.display = "none";
    breakView.style.display = "block";

    document.getElementById("breakCountdown").textContent = formatTime(sessionState.breakSecondsRemaining);
  } else if (sessionState.isSessionActive) {
    timerCard.classList.add("is-active-session");
    idleView.style.display = "none";
    breakView.style.display = "none";
    activeView.style.display = "block";

    document.getElementById("sessionCountdown").textContent = formatTime(sessionState.secondsRemaining);
    document.getElementById("sessionTargetSubtext").textContent = `Sites in "${currentGroupName}" are now blocked`;

    // Progress bar calculation
    const progressFill = document.getElementById("sessionProgressFill");
    if (sessionState.totalDurationSecs) {
      const pct = Math.max(0, Math.min(100, (sessionState.secondsRemaining / sessionState.totalDurationSecs) * 100));
      progressFill.style.width = `${pct}%`;
    } else {
      progressFill.style.width = "100%";
    }
  } else {
    timerCard.classList.remove("is-active-session");
    activeView.style.display = "none";
    breakView.style.display = "none";
    idleView.style.display = "block";

    document.getElementById("startSessionBtnText").textContent = `Start Focus Session (${selectedDurationMins} min)`;
  }

  // 4. Current Tab Card
  const tabDomainEl = document.getElementById("tabDomain");
  const siteStatusBadge = document.getElementById("siteStatusBadge");
  const quickSiteActionBtn = document.getElementById("quickSiteActionBtn");

  if (!currentDomain) {
    tabDomainEl.textContent = "Browser / System Tab";
    siteStatusBadge.textContent = "Protected";
    siteStatusBadge.className = "status-pill status-allowed";
    quickSiteActionBtn.disabled = true;
    quickSiteActionBtn.className = "btn btn-secondary btn-block";
    quickSiteActionBtn.textContent = "Cannot block system tabs";
  } else {
    tabDomainEl.textContent = currentDomain;
    quickSiteActionBtn.disabled = false;

    const inList = isDomainInList(currentDomain);
    if (inList) {
      if (sessionState.isSessionActive && !sessionState.isBreakActive) {
        siteStatusBadge.textContent = "Blocked right now";
        siteStatusBadge.className = "status-pill status-blocked";
      } else {
        siteStatusBadge.textContent = "In " + currentGroupName;
        siteStatusBadge.className = "status-pill status-in-list";
      }
      quickSiteActionBtn.className = "btn btn-danger-outline btn-block";
      quickSiteActionBtn.textContent = `✕ Remove ${currentDomain} from ${currentGroupName}`;
    } else {
      siteStatusBadge.textContent = "Not in list";
      siteStatusBadge.className = "status-pill status-allowed";
      quickSiteActionBtn.className = "btn btn-secondary btn-block";
      quickSiteActionBtn.textContent = `+ Add ${currentDomain} to ${currentGroupName}`;
    }
  }

  // 5. Websites in this Group Card
  document.getElementById("activeGroupNameLabel").textContent = currentGroupName;
  document.getElementById("sitesCountBadge").textContent = `${currentBlockedSites.length} site${currentBlockedSites.length === 1 ? "" : "s"}`;

  // Presets
  document.querySelectorAll(".preset-chip").forEach((chip) => {
    const domain = chip.getAttribute("data-domain");
    if (isDomainInList(domain)) {
      chip.classList.add("is-in-list");
      chip.textContent = `✓ ${domain}`;
      chip.title = `Click to remove ${domain}`;
    } else {
      chip.classList.remove("is-in-list");
      chip.textContent = `+ ${domain}`;
      chip.title = `Click to add ${domain}`;
    }
  });

  // Chips list
  const chipsContainer = document.getElementById("blockedChipsContainer");
  chipsContainer.innerHTML = "";

  if (currentBlockedSites.length === 0) {
    chipsContainer.innerHTML = `<div class="empty-state">No websites in "${currentGroupName}" yet. Add one above!</div>`;
  } else {
    currentBlockedSites.forEach((site) => {
      const chip = document.createElement("div");
      chip.className = "site-chip";

      const text = document.createElement("span");
      text.className = "chip-domain";
      text.textContent = site;
      chip.appendChild(text);

      const removeBtn = document.createElement("button");
      removeBtn.className = "remove-chip-btn";
      removeBtn.title = `Remove ${site}`;
      removeBtn.innerHTML = "&times;";
      removeBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        removeWebsite(site);
      });
      chip.appendChild(removeBtn);

      chipsContainer.appendChild(chip);
    });
  }

  // 6. Schedule Banner
  const scheduleBanner = document.getElementById("scheduleBanner");
  const scheduleText = document.getElementById("scheduleBannerText");
  if (sessionState.hasSchedule && sessionState.scheduleTimes) {
    scheduleBanner.style.display = "flex";
    scheduleText.textContent = `Schedule active: ${sessionState.scheduleTimes}`;
  } else {
    scheduleBanner.style.display = "none";
  }
}

// 1-second live countdown ticker
function startLiveTicker() {
  if (countdownTimerId) clearInterval(countdownTimerId);

  countdownTimerId = setInterval(() => {
    if (!sessionState) return;

    if (sessionState.isBreakActive) {
      if (sessionState.breakSecondsRemaining > 0) {
        sessionState.breakSecondsRemaining--;
        const el = document.getElementById("breakCountdown");
        if (el) el.textContent = formatTime(sessionState.breakSecondsRemaining);
      } else {
        // Break expired, refresh
        fetchState(renderUI);
      }
    } else if (sessionState.isSessionActive) {
      if (sessionState.secondsRemaining > 0) {
        sessionState.secondsRemaining--;
        const el = document.getElementById("sessionCountdown");
        if (el) el.textContent = formatTime(sessionState.secondsRemaining);
      } else {
        // Session expired, refresh
        fetchState(renderUI);
      }
    }
  }, 1000);
}

// Add website to current group
function addWebsite(domain) {
  domain = domain.trim().toLowerCase()
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/\/.*$/, "");

  if (!domain) return;

  browser.runtime.sendMessage({
    type: "add-sites",
    sites: domain,
    set: currentSet
  }, () => {
    showToast(`Added ${domain} to group`);
    fetchState(renderUI);
  });
}

// Remove website from current group
function removeWebsite(domain) {
  browser.runtime.sendMessage({
    type: "remove-site",
    site: domain,
    set: currentSet
  }, () => {
    showToast(`Removed ${domain}`);
    fetchState(renderUI);
  });
}

// Start focus session
function startFocusSession() {
  const duration = selectedDurationMins || 25;
  browser.runtime.sendMessage({
    type: "start-session",
    set: currentSet,
    durationMinutes: duration
  }, (res) => {
    if (res && res.ok) {
      showToast(`⚡ Started ${duration}m focus session!`);
      if (sessionState) {
        sessionState.totalDurationSecs = duration * 60;
      }
      fetchState(renderUI);
    }
  });
}

// Stop focus session
function stopFocusSession() {
  browser.runtime.sendMessage({
    type: "stop-session",
    set: currentSet
  }, () => {
    showToast("Focus session ended");
    fetchState(renderUI);
  });
}

// Take a 5-minute break
function takeBreak() {
  browser.runtime.sendMessage({
    type: "take-break",
    durationMinutes: 5
  }, () => {
    showToast("Enjoy your 5m break!");
    fetchState(renderUI);
  });
}

// End break and resume focus
function endBreak() {
  browser.runtime.sendMessage({
    type: "end-break"
  }, () => {
    showToast("Focus resumed!");
    fetchState(renderUI);
  });
}

// Document Ready Setup
document.addEventListener("DOMContentLoaded", () => {
  // Options & links
  document.getElementById("optionsBtn").addEventListener("click", () => openExtensionPage("options.html"));
  document.getElementById("openSettingsLink").addEventListener("click", () => openExtensionPage("options.html"));

  // Group Switcher
  document.getElementById("groupTab1").addEventListener("click", () => {
    if (currentSet !== 1) {
      currentSet = 1;
      fetchState(renderUI);
    }
  });
  document.getElementById("groupTab2").addEventListener("click", () => {
    if (currentSet !== 2) {
      currentSet = 2;
      fetchState(renderUI);
    }
  });

  // Duration selection chips
  document.querySelectorAll(".duration-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      document.querySelectorAll(".duration-chip").forEach(c => c.classList.remove("active"));
      chip.classList.add("active");
      document.getElementById("customMinsInput").value = "";
      selectedDurationMins = parseInt(chip.getAttribute("data-mins"), 10);
      renderUI();
    });
  });

  // Custom duration input
  const customInput = document.getElementById("customMinsInput");
  customInput.addEventListener("input", () => {
    const val = parseInt(customInput.value, 10);
    if (!isNaN(val) && val > 0) {
      document.querySelectorAll(".duration-chip").forEach(c => c.classList.remove("active"));
      selectedDurationMins = val;
      renderUI();
    }
  });

  // Session Control buttons
  document.getElementById("startSessionBtn").addEventListener("click", startFocusSession);
  document.getElementById("stopSessionBtn").addEventListener("click", stopFocusSession);
  document.getElementById("takeBreakBtn").addEventListener("click", takeBreak);
  document.getElementById("endBreakBtn").addEventListener("click", endBreak);

  // Quick Site Action Button
  document.getElementById("quickSiteActionBtn").addEventListener("click", () => {
    if (!currentDomain) return;
    if (isDomainInList(currentDomain)) {
      removeWebsite(currentDomain);
    } else {
      addWebsite(currentDomain);
    }
  });

  // Custom Site Input Form
  const addForm = document.getElementById("addSiteForm");
  const siteInput = document.getElementById("customSiteInput");
  addForm.addEventListener("submit", (e) => {
    e.preventDefault();
    if (siteInput.value) {
      addWebsite(siteInput.value);
      siteInput.value = "";
    }
  });

  // Preset Chips
  document.querySelectorAll(".preset-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      const domain = chip.getAttribute("data-domain");
      if (isDomainInList(domain)) {
        removeWebsite(domain);
      } else {
        addWebsite(domain);
      }
    });
  });

  // Query Active Tab to identify current site
  browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
    if (tabs && tabs.length > 0) {
      const activeTab = tabs[0];
      currentDomain = extractDomain(activeTab.url);
      if (activeTab.favIconUrl && !activeTab.favIconUrl.startsWith("chrome://")) {
        const iconEl = document.getElementById("tabFavicon");
        if (iconEl) iconEl.src = activeTab.favIconUrl;
      }
    }
    fetchState(renderUI);
    startLiveTicker();
  }, () => {
    fetchState(renderUI);
    startLiveTicker();
  });
});
