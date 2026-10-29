/* FocusBlock Modern Popup Script */

const browser = chrome;
let currentDomain = "";
let currentBlockedSites = [];
const ACTIVE_SET = 1;

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

// Show feedback toast
function showToast(message) {
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => {
    toast.classList.remove("show");
  }, 2000);
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

// Fetch current block set sites
function loadBlockedSites(callback) {
  browser.runtime.sendMessage({ type: "get-block-sites", set: ACTIVE_SET }, (response) => {
    if (browser.runtime.lastError || !response) {
      // Fallback directly to storage
      browser.storage.local.get(`sites${ACTIVE_SET}`).then((data) => {
        const raw = (data && data[`sites${ACTIVE_SET}`]) || "";
        currentBlockedSites = raw.split(/\s+/).filter(Boolean);
        if (callback) callback();
      });
      return;
    }
    const raw = response.sites || "";
    currentBlockedSites = raw.split(/\s+/).filter(Boolean);
    if (callback) callback();
  });
}

// Check if domain is in blocked list
function isDomainBlocked(domain) {
  if (!domain) return false;
  domain = domain.toLowerCase();
  return currentBlockedSites.some((item) => {
    const cleanItem = item.replace(/^\*+|\*+$/g, "").toLowerCase();
    return domain === cleanItem || domain.endsWith("." + cleanItem);
  });
}

// Render UI states
function renderUI() {
  const tabDomainEl = document.getElementById("tabDomain");
  const siteStatusBadge = document.getElementById("siteStatusBadge");
  const quickBlockBtn = document.getElementById("quickBlockBtn");
  const quickBlockText = document.getElementById("quickBlockText");
  const blockedCount = document.getElementById("blockedCount");
  const chipsContainer = document.getElementById("blockedChipsContainer");

  // 1. Current Tab Card
  if (!currentDomain) {
    tabDomainEl.textContent = "Internal / Browser Tab";
    siteStatusBadge.textContent = "Protected";
    siteStatusBadge.className = "status-pill status-allowed";
    quickBlockBtn.disabled = true;
    quickBlockBtn.className = "btn btn-secondary btn-block";
    quickBlockText.textContent = "Cannot block system tabs";
  } else {
    tabDomainEl.textContent = currentDomain;
    quickBlockBtn.disabled = false;

    if (isDomainBlocked(currentDomain)) {
      siteStatusBadge.textContent = "Blocked";
      siteStatusBadge.className = "status-pill status-blocked";
      quickBlockBtn.className = "btn btn-danger btn-block";
      quickBlockText.textContent = `Unblock ${currentDomain}`;
    } else {
      siteStatusBadge.textContent = "Not blocked";
      siteStatusBadge.className = "status-pill status-allowed";
      quickBlockBtn.className = "btn btn-primary btn-block";
      quickBlockText.textContent = `+ Block ${currentDomain}`;
    }
  }

  // 2. Preset Chips state
  document.querySelectorAll(".preset-chip").forEach((chip) => {
    const domain = chip.getAttribute("data-domain");
    if (isDomainBlocked(domain)) {
      chip.classList.add("is-blocked");
      chip.textContent = `✓ ${domain}`;
    } else {
      chip.classList.remove("is-blocked");
      chip.textContent = `+ ${domain}`;
    }
  });

  // 3. Blocked List Chips
  blockedCount.textContent = `${currentBlockedSites.length} site${currentBlockedSites.length === 1 ? "" : "s"}`;
  chipsContainer.innerHTML = "";

  if (currentBlockedSites.length === 0) {
    chipsContainer.innerHTML = `<div class="empty-state">No websites blocked yet. Add one above!</div>`;
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
}

// Add website and auto-save
function addWebsite(domain) {
  domain = domain.trim().toLowerCase()
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/\/.*$/, "");

  if (!domain) return;

  browser.runtime.sendMessage({
    type: "add-sites",
    sites: domain,
    set: ACTIVE_SET
  }, () => {
    showToast(`Added ${domain} & saved!`);
    loadBlockedSites(renderUI);
  });
}

// Remove website and auto-save
function removeWebsite(domain) {
  browser.runtime.sendMessage({
    type: "remove-site",
    site: domain,
    set: ACTIVE_SET
  }, () => {
    showToast(`Removed ${domain}`);
    loadBlockedSites(renderUI);
  });
}

// Initialize
document.addEventListener("DOMContentLoaded", () => {
  // Navigation & buttons
  document.getElementById("optionsBtn").addEventListener("click", () => openExtensionPage("options.html"));
  document.getElementById("statsBtn").addEventListener("click", () => openExtensionPage("stats.html"));
  document.getElementById("lockdownBtn").addEventListener("click", () => openExtensionPage("lockdown.html"));
  document.getElementById("overrideBtn").addEventListener("click", () => openExtensionPage("override.html"));

  // Quick Block Button
  document.getElementById("quickBlockBtn").addEventListener("click", () => {
    if (!currentDomain) return;
    if (isDomainBlocked(currentDomain)) {
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
      if (isDomainBlocked(domain)) {
        removeWebsite(domain);
      } else {
        addWebsite(domain);
      }
    });
  });

  // Query Active Tab to populate current website
  browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
    if (tabs && tabs.length > 0) {
      const activeTab = tabs[0];
      currentDomain = extractDomain(activeTab.url);
      if (activeTab.favIconUrl && !activeTab.favIconUrl.startsWith("chrome://")) {
        document.getElementById("tabFavicon").src = activeTab.favIconUrl;
      }
    }
    loadBlockedSites(renderUI);
  }, () => {
    loadBlockedSites(renderUI);
  });
});
