// src/renderer/js/main.js - Enhanced JavaScript for Endo-Stat
class EndoStatApp {
  constructor() {
    this.currentUser = null;
    this.patients = [];
    this.users = [];
    this.licenseStatus = null;
    this.currentPage = 1;
    this.patientsPerPage = 10;
    this.searchTerm = "";
    this.currentEditingUserId = null;
    this.settings = this.loadSettings();
    this.updateInfo = null;
    this.updateAvailable = false;
    this.updateDownloaded = false;
    this.downloadProgress = 0;
    this.currentAppVersion = "1.0.0";
    this.isUpdateFeatureAvailable = false;
    this.init();
  }

  async init() {
    await this.loadAppVersion();
    await this.loadCurrentUser();
    await this.loadLicenseStatus();
    await this.loadPatients();
    this.setCurrentDate();
    this.setupEventListeners();
    this.updateDashboard();
    this.checkLicenseExpiry();
    this.addUpdateStyles();
  }

  async loadAppVersion() {
    try {
      if (window.electronAPI && window.electronAPI.getAppVersion) {
        const version = await window.electronAPI.getAppVersion();
        document.getElementById(
          "app-version"
        ).textContent = `Version ${version}`;
        this.currentAppVersion = version;
        console.log("📱 App version loaded:", version);
      } else {
        document.getElementById("app-version").textContent = "Version 1.0.0";
        this.currentAppVersion = "1.0.0";
        console.warn("getAppVersion API not available, using default");
      }
    } catch (error) {
      console.error("Failed to load app version:", error);
      document.getElementById("app-version").textContent = "Version 1.0.0";
      this.currentAppVersion = "1.0.0";
    }
  }

  async initializeAutoUpdateCheck() {
    try {
      // Only auto-check if feature is available
      if (this.isUpdateFeatureAvailable) {
        // Check for updates on startup (silently) after delay
        console.log("🔄 Scheduling auto-update check in 5 seconds...");
        setTimeout(() => {
          this.checkForUpdates(false); // false = silent check
        }, 5000);
      }
    } catch (error) {
      console.error("Failed to initialize auto-update check:", error);
    }
  }

  setupUpdateListeners() {
    console.log("🔌 Setting up update listeners...");

    // Remove any existing listeners first
    if (window.electronAPI && window.electronAPI.removeAllUpdateListeners) {
      window.electronAPI.removeAllUpdateListeners();
    }

    // Set up new listeners
    if (window.electronAPI) {
      // Use new event names first (update-checking, update-available, etc.)
      window.electronAPI.onUpdateChecking(() => {
        console.log("📡 Received update-checking event");
        this.onUpdateChecking();
      });

      window.electronAPI.onUpdateAvailable((event, info) => {
        console.log("📡 Received update-available event:", info);
        this.onUpdateAvailable(info);
      });

      window.electronAPI.onUpdateNotAvailable((event, info) => {
        console.log("📡 Received update-not-available event:", info);
        this.onUpdateNotAvailable(info);
      });

      window.electronAPI.onUpdateDownloadProgress((event, progress) => {
        console.log("📡 Received update-download-progress event:", progress);
        this.onUpdateDownloadProgress(progress);
      });

      window.electronAPI.onUpdateDownloaded((event, info) => {
        console.log("📡 Received update-downloaded event:", info);
        this.onUpdateDownloaded(info);
      });

      window.electronAPI.onUpdateError((event, error) => {
        console.log("📡 Received update-error event:", error);
        this.onUpdateError(error);
      });

      // Also set up old event names for compatibility
      window.electronAPI.onAutoUpdateChecking(() => {
        console.log("📡 Received old auto-updater:checking-for-update event");
        this.onUpdateChecking();
      });

      window.electronAPI.onAutoUpdateAvailable((event, info) => {
        console.log(
          "📡 Received old auto-updater:update-available event:",
          info
        );
        this.onUpdateAvailable(info);
      });

      console.log("✅ Update listeners setup complete");
    } else {
      console.warn(
        "⚠️ electronAPI not available for setting up update listeners"
      );
    }
  }

  onUpdateChecking() {
    console.log("🔍 Update check in progress...");
    this.updateStatusUI("checking", "Checking for updates...");
  }

  onUpdateAvailable(info) {
    console.log("✅ Update available:", info);
    this.updateInfo = info;
    this.updateAvailable = true;

    // Show update badge
    const updateBadge = document.getElementById("update-badge");
    if (updateBadge) {
      updateBadge.classList.add("available");
      updateBadge.textContent = "!";
      console.log("📛 Update badge shown");
    }

    this.updateStatusUI("available", `Update ${info.version} available`);

    // Show update notification
    this.showUpdateAvailableNotification(info);
  }

  onUpdateNotAvailable(info) {
    console.log("✅ No updates available:", info);
    this.updateAvailable = false;
    this.updateStatusUI("current", "Up to date");

    // Hide update badge
    const updateBadge = document.getElementById("update-badge");
    if (updateBadge) {
      updateBadge.classList.remove("available");
      console.log("📛 Update badge hidden");
    }
  }

  onUpdateDownloadProgress(progress) {
    console.log("📥 Download progress:", progress.percent);
    this.downloadProgress = Math.round(progress.percent || 0);
    this.showUpdateProgress(progress);
  }

  onUpdateDownloaded(info) {
    console.log("🎉 Update downloaded:", info);
    this.updateDownloaded = true;
    this.updateAvailable = false;

    this.updateStatusUI("ready", "Ready to install");

    // Hide progress modal and show install button
    this.showUpdateReady(info);
  }

  onUpdateError(error) {
    console.error("❌ Update error:", error);
    this.updateStatusUI("error", "Update error");

    // Check if it's a development mode error
    const errorMessage = error.message || String(error);
    if (
      errorMessage.includes("development") ||
      errorMessage.includes("dev mode")
    ) {
      this.showNotification(
        "Auto-updates are disabled in development mode",
        "info"
      );
    } else {
      this.showNotification(`Update error: ${errorMessage}`, "error");
    }

    // Hide update badge
    const updateBadge = document.getElementById("update-badge");
    if (updateBadge) {
      updateBadge.classList.remove("available");
    }
  }

  updateStatusUI(status, message) {
    const statusItem = document.getElementById("update-status-item");
    const statusIcon = document.getElementById("update-status-icon");
    const statusText = document.getElementById("update-status-text");

    if (!statusItem || !statusIcon || !statusText) {
      console.warn("Update status UI elements not found");
      return;
    }

    console.log(`🔄 Updating status UI: ${status} - ${message}`);

    // Reset all classes
    statusItem.className = "status-item";
    statusIcon.className = "fa";

    switch (status) {
      case "checking":
        statusItem.classList.add("info");
        statusIcon.classList.add("fa-refresh", "fa-spin");
        break;
      case "available":
        statusItem.classList.add("warning");
        statusIcon.classList.add("fa-download");
        break;
      case "downloading":
        statusItem.classList.add("info");
        statusIcon.classList.add("fa-download");
        break;
      case "ready":
        statusItem.classList.add("success");
        statusIcon.classList.add("fa-check-circle");
        break;
      case "error":
        statusItem.classList.add("danger");
        statusIcon.classList.add("fa-exclamation-circle");
        break;
      case "current":
        statusItem.classList.add("success");
        statusIcon.classList.add("fa-check-circle");
        break;
      case "info":
        statusItem.classList.add("info");
        statusIcon.classList.add("fa-info-circle");
        break;
      default:
        statusItem.classList.add("info");
        statusIcon.classList.add("fa-info-circle");
    }

    statusText.textContent = message;
  }

  async checkForUpdates(showNotifications = true) {
    try {
      console.log(
        "🔍 Manual update check requested, showNotifications:",
        showNotifications
      );

      // Check if update feature is available
      if (!this.isUpdateFeatureAvailable) {
        let isDev = false;
        try {
          if (window.electronAPI?.isDev) {
            isDev = await window.electronAPI.isDev();
          }
        } catch (error) {
          console.warn("Could not check dev mode:", error);
        }

        const message = isDev
          ? "Auto-updates are disabled in development mode"
          : "Auto-update feature is not available";

        if (showNotifications) {
          this.showNotification(message, "info");
        }
        this.updateStatusUI("error", "Updates disabled");
        return { status: "error", message: message };
      }

      if (showNotifications) {
        this.showNotification("Checking for updates...", "info");
      }

      // Check if the API exists before calling it
      if (!window.electronAPI.checkForUpdates) {
        const message = "Update check API not available";
        if (showNotifications) {
          this.showNotification(message, "error");
        }
        return { status: "error", message: message };
      }

      // Call the IPC handler
      console.log("📡 Calling checkForUpdates via IPC...");
      const result = await window.electronAPI.checkForUpdates();
      console.log("📡 Update check result:", result);

      if (showNotifications) {
        if (result.status === "update-available") {
          this.showNotification(
            `Update ${result.version} available!`,
            "success"
          );
        } else if (result.status === "update-not-available") {
          this.showNotification("You're using the latest version", "success");
        } else if (result.status === "error") {
          this.showNotification(
            `Update check failed: ${result.message}`,
            "error"
          );
        }
      }

      return result;
    } catch (error) {
      console.error("❌ Error checking for updates:", error);
      if (showNotifications) {
        this.showNotification("Failed to check for updates", "error");
      }
      this.updateStatusUI("error", "Check failed");
      return { status: "error", message: error.message };
    }
  }

  showUpdateAvailableNotification(info) {
    const modal = document.getElementById("update-available-modal");
    if (!modal) {
      console.warn("Update available modal not found");
      return;
    }

    console.log("🪟 Showing update available notification");

    // Set version info
    document.getElementById("current-version-text").textContent =
      this.currentAppVersion;
    document.getElementById("new-version-text").textContent = info.version;

    // Set release notes
    const releaseNotesEl = document.getElementById("release-notes");
    if (info.releaseNotes) {
      releaseNotesEl.innerHTML = `<p>${info.releaseNotes}</p>`;
    } else {
      releaseNotesEl.innerHTML = `<p class="text-muted">No release notes available.</p>`;
    }

    // Set update size if available
    const updateSizeEl = document.getElementById("update-size-info");
    if (info.size) {
      updateSizeEl.textContent = `Update Size: ${this.formatBytes(info.size)}`;
    } else {
      updateSizeEl.textContent = "Update Size: Calculating...";
    }

    // Show modal
    modal.classList.add("active");

    // Setup download button
    const downloadBtn = document.getElementById("download-update-now-btn");
    if (downloadBtn) {
      downloadBtn.onclick = () => {
        console.log("⬇️ Download update button clicked");
        this.downloadUpdate();
        this.closeModal("update-available-modal");
      };
    }
  }

  showUpdateProgress(progress) {
    const modal = document.getElementById("update-progress-modal");
    const progressFill = document.getElementById("update-progress-fill");
    const progressPercent = document.getElementById("update-progress-percent");
    const progressSpeed = document.getElementById("update-progress-speed");
    const downloaded = document.getElementById("update-downloaded");
    const total = document.getElementById("update-total");
    const timeRemaining = document.getElementById("update-time-remaining");
    const installBtn = document.getElementById("install-update-btn");
    const cancelBtn = document.getElementById("cancel-update-btn");
    const modalTitle = document.getElementById("update-modal-title");
    const modalMessage = document.getElementById("update-modal-message");

    if (!modal) {
      console.warn("Update progress modal not found");
      return;
    }

    // Show modal if not already shown
    if (!modal.classList.contains("active")) {
      console.log("🪟 Showing update progress modal");
      modal.classList.add("active");
      modalTitle.textContent = "Downloading Update";
      modalMessage.textContent = "Please wait while the update downloads...";
      if (installBtn) installBtn.style.display = "none";
      if (cancelBtn) {
        cancelBtn.style.display = "block";
        cancelBtn.onclick = () => this.cancelUpdate();
      }
    }

    // Update progress
    const percent = Math.round(progress.percent || 0);
    if (progressFill) progressFill.style.width = `${percent}%`;
    if (progressPercent) progressPercent.textContent = `${percent}%`;

    if (progress.bytesPerSecond && progressSpeed) {
      progressSpeed.textContent =
        this.formatBytes(progress.bytesPerSecond) + "/s";
    }

    if (progress.transferred && downloaded) {
      downloaded.textContent = this.formatBytes(progress.transferred);
    }

    if (progress.total && total) {
      total.textContent = this.formatBytes(progress.total);
    }

    // Calculate time remaining
    if (
      progress.bytesPerSecond > 0 &&
      progress.total &&
      progress.transferred &&
      timeRemaining
    ) {
      const remainingBytes = progress.total - progress.transferred;
      const secondsRemaining = remainingBytes / progress.bytesPerSecond;

      if (secondsRemaining < 60) {
        timeRemaining.textContent = `${Math.ceil(secondsRemaining)} second${
          secondsRemaining !== 1 ? "s" : ""
        }`;
      } else {
        const minutesRemaining = Math.ceil(secondsRemaining / 60);
        timeRemaining.textContent = `${minutesRemaining} minute${
          minutesRemaining !== 1 ? "s" : ""
        }`;
      }
    }

    // Update UI status
    this.updateStatusUI("downloading", `Downloading ${percent}%`);
  }

  showUpdateReady(info) {
    const modal = document.getElementById("update-progress-modal");
    const modalTitle = document.getElementById("update-modal-title");
    const modalMessage = document.getElementById("update-modal-message");
    const installBtn = document.getElementById("install-update-btn");
    const cancelBtn = document.getElementById("cancel-update-btn");

    if (!modal) {
      console.warn("Update progress modal not found");
      return;
    }

    console.log("✅ Showing update ready screen");

    if (modalTitle) modalTitle.textContent = "Update Ready!";
    if (modalMessage)
      modalMessage.textContent = `Update ${info.version} has been downloaded and is ready to install.`;
    if (installBtn) {
      installBtn.style.display = "block";
      installBtn.onclick = () => this.installUpdate();
    }
    if (cancelBtn) cancelBtn.style.display = "none";

    // Show notification
    this.showNotification(
      `Update ${info.version} downloaded and ready to install!`,
      "success",
      5000
    );
  }

  async downloadUpdate() {
    try {
      if (!this.isUpdateFeatureAvailable) {
        this.showNotification("Update feature is not available", "error");
        return;
      }

      console.log("⬇️ Starting update download...");
      this.showNotification("Starting download...", "info");

      const result = await window.electronAPI.downloadUpdate();
      console.log("Download result:", result);

      if (result.success) {
        this.showNotification("Download started successfully", "success");
        // Progress will be shown via event listeners
      } else {
        this.showNotification(`Download failed: ${result.message}`, "error");
      }
    } catch (error) {
      console.error("❌ Error starting download:", error);
      this.showNotification(`Download error: ${error.message}`, "error");
    }
  }

  async installUpdate() {
    try {
      if (!this.isUpdateFeatureAvailable) {
        this.showNotification("Update feature is not available", "error");
        return;
      }

      if (
        confirm(
          "The application will restart to install the update. Please save any unsaved work before continuing."
        )
      ) {
        console.log("⚡ Installing update...");
        this.showNotification("Installing update...", "info");

        const result = await window.electronAPI.installUpdate();
        console.log("Install result:", result);

        if (!result.success) {
          this.showNotification(`Install failed: ${result.message}`, "error");
        }
        // If successful, the app will restart automatically
      }
    } catch (error) {
      console.error("❌ Error installing update:", error);
      this.showNotification(`Install error: ${error.message}`, "error");
    }
  }

  cancelUpdate() {
    console.log("❌ Update cancelled");
    this.closeModal("update-progress-modal");
    this.showNotification("Update cancelled", "info");
    this.updateStatusUI("available", "Update available");
  }

  setupEventListeners() {
    console.log("🔌 Setting up event listeners...");

    // Navigation
    document.querySelectorAll("[data-view]").forEach((link) => {
      link.addEventListener("click", (e) => {
        e.preventDefault();
        const viewName = e.target
          .closest("[data-view]")
          .getAttribute("data-view");
        console.log("Navigating to view:", viewName);
        this.navigateToView(viewName);
      });
    });

    // Quick Actions
    document.querySelectorAll("[data-action]").forEach((button) => {
      button.addEventListener("click", (e) => {
        const action = e.target
          .closest("[data-action]")
          .getAttribute("data-action");
        console.log("Action triggered:", action);
        this.handleAction(action);
      });
    });

    // Logout
    const logoutBtn = document.getElementById("logout-btn");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", (e) => {
        e.preventDefault();
        console.log("Logout initiated");
        this.logout();
      });
    }

    // User menu dropdown
    const userMenu = document.querySelector(".user-menu");
    if (userMenu) {
      userMenu.addEventListener("click", (e) => {
        e.stopPropagation();
        userMenu.classList.toggle("active");
      });

      document.addEventListener("click", (e) => {
        if (!e.target.closest(".user-menu")) {
          userMenu.classList.remove("active");
        }
      });
    }

    // Patient search
    const searchInput = document.getElementById("patient-search");
    if (searchInput) {
      let searchTimeout;
      searchInput.addEventListener("input", (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
          this.searchTerm = e.target.value.trim();
          this.currentPage = 1;
          this.loadPatients();
        }, 300);
      });
    }

    // Pagination
    document.getElementById("prev-page")?.addEventListener("click", () => {
      if (this.currentPage > 1) {
        this.currentPage--;
        this.updatePagination();
        this.renderPatientsTable();
      }
    });

    document.getElementById("next-page")?.addEventListener("click", () => {
      const totalPages = Math.ceil(
        (this.allPatients?.length || 0) / this.patientsPerPage
      );
      if (this.currentPage < totalPages) {
        this.currentPage++;
        this.updatePagination();
        this.renderPatientsTable();
      }
    });

    // Update check buttons
    const checkUpdateBtns = document.querySelectorAll(
      "#check-updates-btn, #dashboard-update-btn"
    );
    checkUpdateBtns.forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        console.log("🔘 Update check button clicked");
        this.checkForUpdates(true);
      });
    });

    // Modal close buttons
    document
      .querySelectorAll(".modal-close, [data-action^='close-']")
      .forEach((btn) => {
        btn.addEventListener("click", (e) => {
          const action = e.target.getAttribute("data-action");
          const modalId = action.replace("close-", "").replace("-modal", "");
          this.closeModal(`${modalId}-modal`);
        });
      });

    // Add User Modal
    document.getElementById("save-new-user")?.addEventListener("click", () => {
      this.saveNewUser();
    });

    // Edit User Modal
    document
      .getElementById("save-user-changes")
      ?.addEventListener("click", () => {
        this.saveUserChanges();
      });

    // Delete User
    document
      .getElementById("delete-user-btn")
      ?.addEventListener("click", () => {
        if (this.currentEditingUserId) {
          this.showConfirmDeleteModal(this.currentEditingUserId);
        }
      });

    // Confirm Delete
    document
      .getElementById("confirm-delete-btn")
      ?.addEventListener("click", () => {
        this.confirmDeleteUser();
      });

    // Cancel Delete
    document
      .querySelector("[data-action='cancel-delete']")
      ?.addEventListener("click", () => {
        this.closeModal("confirm-delete-modal");
      });

    // Toggle password change fields
    document
      .getElementById("toggle-password-change")
      ?.addEventListener("click", () => {
        this.togglePasswordChangeFields();
      });

    // Settings modal
    const settingsModalBtn = document.querySelector("[data-view='settings']");
    if (settingsModalBtn) {
      settingsModalBtn.addEventListener("click", () => {
        this.showSettingsModal();
      });
    }

    // Update available modal close buttons
    const updateAvailableModalClose = document.querySelector(
      "[data-action='close-update-available-modal']"
    );
    if (updateAvailableModalClose) {
      updateAvailableModalClose.addEventListener("click", () => {
        this.closeModal("update-available-modal");
      });
    }

    // Close modals when clicking outside
    document.querySelectorAll(".modal-overlay").forEach((modal) => {
      modal.addEventListener("click", (e) => {
        if (e.target === modal) {
          modal.classList.remove("active");
        }
      });
    });
  }

  addUpdateStyles() {
    if (!document.querySelector("#update-styles")) {
      const style = document.createElement("style");
      style.id = "update-styles";
      style.textContent = `
        .update-indicator {
          position: relative;
          display: inline-flex;
          align-items: center;
          gap: 5px;
        }
        
        .update-badge {
          position: absolute;
          top: -8px;
          right: -8px;
          background: #ff4757;
          color: white;
          font-size: 10px;
          font-weight: bold;
          padding: 2px 6px;
          border-radius: 10px;
          min-width: 16px;
          text-align: center;
          display: none;
          z-index: 1;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }
        
        .update-badge.available {
          display: inline-block;
          animation: pulse 2s infinite;
        }
        
        .update-info-card {
          background: #f8f9fa;
          border-radius: 8px;
          padding: 20px;
          margin-bottom: 20px;
        }
        
        .update-header {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 20px;
          margin-bottom: 20px;
          padding-bottom: 15px;
          border-bottom: 1px solid #e9ecef;
        }
        
        .current-version, .new-version {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 5px;
        }
        
        .current-version span:first-child,
        .new-version span:first-child {
          font-size: 12px;
          color: #6c757d;
        }
        
        .update-details {
          margin: 15px 0;
        }
        
        .update-details h4 {
          margin-bottom: 10px;
          color: #495057;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        
        .release-notes {
          background: white;
          border: 1px solid #e9ecef;
          border-radius: 6px;
          padding: 15px;
          max-height: 150px;
          overflow-y: auto;
          font-size: 14px;
          line-height: 1.5;
        }
        
        .update-size-info {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
          color: #6c757d;
          padding: 10px 15px;
          background: white;
          border-radius: 6px;
          border: 1px solid #e9ecef;
        }
        
        @keyframes pulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.1); }
          100% { transform: scale(1); }
        }
        
        .btn.update-btn {
          position: relative;
          overflow: visible;
        }
        
        .status-item.danger {
          background-color: #f8d7da;
          border-color: #f5c6cb;
        }
        
        .status-item.danger i {
          color: #dc3545;
        }
        
        .fa-spin {
          animation: fa-spin 1s infinite linear;
        }
        
        @keyframes fa-spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `;
      document.head.appendChild(style);
      console.log("🎨 Update styles added");
    }
  }

  async loadCurrentUser() {
    try {
      const userData = await window.electronAPI.getUserSession();
      console.log("Loaded user session:", userData);
      if (userData) {
        this.currentUser = userData;
        document.getElementById("current-user").textContent =
          userData.fullName || userData.username || "User";
        document.getElementById("current-user-role").textContent =
          userData.role || "User";
      } else {
        console.warn("No user session found");
        document.getElementById("current-user").textContent = "User";
        document.getElementById("current-user-role").textContent = "User";
      }
    } catch (error) {
      console.error("Error loading current user:", error);
      document.getElementById("current-user").textContent = "User";
      document.getElementById("current-user-role").textContent = "User";
    }
  }

  async loadLicenseStatus() {
    try {
      this.licenseStatus = await window.electronAPI.getLicenseStatus();
      console.log("Loaded license status:", this.licenseStatus);
      this.updateLicenseDisplay();
    } catch (error) {
      console.error("Error loading license status:", error);
      this.licenseStatus = { valid: false };
    }
  }

  setCurrentDate() {
    const now = new Date();
    const options = {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    };
    const dateString = now.toLocaleDateString("en-US", options);
    document.getElementById("current-date").textContent = dateString;
    document.getElementById("todays-date").textContent = now.toLocaleDateString(
      "en-US",
      { month: "short", day: "numeric" }
    );
  }

  async loadPatients() {
    try {
      let query = "SELECT * FROM patients";
      const params = [];

      if (this.searchTerm) {
        query +=
          " WHERE first_name LIKE ? OR last_name LIKE ? OR patient_id LIKE ?";
        const searchParam = `%${this.searchTerm}%`;
        params.push(searchParam, searchParam, searchParam);
      }

      query += " ORDER BY created_at DESC";

      const patients = await window.electronAPI.dbQuery(query, params);
      console.log("Loaded patients:", patients?.length || 0);
      if (patients) {
        this.allPatients = patients;
        this.updatePagination();
        this.renderPatientsTable();
        this.updatePatientCount();
      }
    } catch (error) {
      console.error("Error loading patients:", error);
      this.showNotification("Error loading patients", "error");
    }
  }

  updatePagination() {
    const totalPatients = this.allPatients?.length || 0;
    const totalPages = Math.ceil(totalPatients / this.patientsPerPage);
    const startIndex = (this.currentPage - 1) * this.patientsPerPage;
    const endIndex = startIndex + this.patientsPerPage;

    this.patients = this.allPatients?.slice(startIndex, endIndex) || [];

    // Update pagination controls
    document.getElementById("showing-count").textContent = this.patients.length;
    document.getElementById("total-count").textContent = totalPatients;
    document.getElementById("current-page").textContent = this.currentPage;

    const prevBtn = document.getElementById("prev-page");
    const nextBtn = document.getElementById("next-page");

    prevBtn.disabled = this.currentPage === 1;
    nextBtn.disabled = this.currentPage === totalPages || totalPages === 0;
  }

  updatePatientCount() {
    const patientCountEl = document.getElementById("patient-count");
    if (patientCountEl) {
      patientCountEl.textContent = this.allPatients?.length || 0;
    }
  }

  updateLicenseDisplay() {
    const statusBadge = document.querySelector(".license-status");
    const statusText = document.getElementById("license-status-text");
    const statusValue = document.getElementById("license-status-value");

    if (!statusBadge || !statusText || !statusValue) {
      console.warn("License display elements not found");
      return;
    }

    console.log("Updating license display with:", this.licenseStatus);

    if (this.licenseStatus && this.licenseStatus.valid) {
      if (this.licenseStatus.expiresAt) {
        const expiresAt = new Date(this.licenseStatus.expiresAt);
        const now = new Date();
        const daysLeft = Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24));

        console.log("License expiry check:", { daysLeft });

        if (daysLeft <= 0) {
          // License has expired
          statusBadge.className = "status-badge license-status danger";
          statusText.textContent = "License Expired";
          statusValue.textContent = "Expired";
          this.showNotification(
            "Your license has expired. Please renew immediately.",
            "error",
            10000
          );
        } else if (daysLeft <= 60) {
          // Less than 2 months
          if (daysLeft <= 14) {
            // Critical: less than 2 weeks
            statusBadge.className = "status-badge license-status danger";
            statusText.textContent = `${daysLeft} days left`;
            statusValue.textContent = `Expires in ${daysLeft} days`;
          } else {
            // Warning: less than 2 months
            statusBadge.className = "status-badge license-status warning";
            statusText.textContent = `${daysLeft} days left`;
            statusValue.textContent = `Expires in ${daysLeft} days`;
          }

          if (daysLeft <= 30) {
            this.showNotification(
              `License expires in ${daysLeft} days. Please renew soon.`,
              "warning"
            );
          }
        } else {
          // More than 2 months - show licensed with days
          statusBadge.className = "status-badge license-status success";
          statusText.textContent = `Licensed (${daysLeft} days)`;
          statusValue.textContent = `Active (${daysLeft} days)`;
        }
      } else {
        // No expiry date - perpetual license
        statusBadge.className = "status-badge license-status success";
        statusText.textContent = "Licensed";
        statusValue.textContent = "Active";
      }
    } else {
      // Invalid license
      statusBadge.className = "status-badge license-status danger";
      statusText.textContent = "Unlicensed";
      statusValue.textContent = "Invalid";
    }
  }

  checkLicenseExpiry() {
    if (
      this.licenseStatus &&
      this.licenseStatus.valid &&
      this.licenseStatus.expiresAt
    ) {
      const expiresAt = new Date(this.licenseStatus.expiresAt);
      const now = new Date();
      const daysLeft = Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24));

      console.log("License expiry warning check:", { daysLeft });

      if (daysLeft <= 0) {
        this.showNotification(
          "❌ Your license has expired. Please renew immediately to continue using Endo-Stat.",
          "error",
          15000
        );
      } else if (daysLeft <= 7) {
        this.showNotification(
          `⚠️ CRITICAL: Your license expires in ${daysLeft} days. Please renew immediately.`,
          "error",
          10000
        );
      } else if (daysLeft <= 30) {
        this.showNotification(
          `⚠️ Warning: Your license expires in ${daysLeft} days. Please renew soon.`,
          "warning",
          8000
        );
      }
    }
  }

  renderPatientsTable() {
    const tbody = document.getElementById("patients-tbody");
    if (!tbody) {
      console.warn("Patients table body not found");
      return;
    }

    if (this.patients.length === 0) {
      tbody.innerHTML = `
        <tr class="empty-row">
          <td colspan="7" class="empty-message">
            <i class="fa fa-users"></i>
            <span>${
              this.searchTerm
                ? "No patients match your search"
                : "No patients found. Add your first patient to get started."
            }</span>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = this.patients
      .map((patient) => {
        const age = patient.date_of_birth
          ? this.calculateAge(patient.date_of_birth)
          : "N/A";
        const lastVisit = patient.updated_at || patient.created_at;
        return `
          <tr>
            <td><strong>${patient.patient_id || "N/A"}</strong></td>
            <td>
              <div class="patient-name">
                <strong>${patient.first_name} ${patient.last_name}</strong>
                ${
                  patient.email
                    ? `<div class="patient-email">${patient.email}</div>`
                    : ""
                }
              </div>
            </td>
            <td><span class="badge ${
              patient.gender === "Male"
                ? "info"
                : patient.gender === "Female"
                ? "primary"
                : "warning"
            }">${patient.gender || "N/A"}</span></td>
            <td><span class="age-badge">${age}</span></td>
            <td>${patient.phone_number || "N/A"}</td>
            <td><small class="text-muted">${this.formatDate(
              lastVisit
            )}</small></td>
            <td>
              <div class="table-actions">
                <button class="btn-icon primary" onclick="app.viewPatient(${
                  patient.id
                })" title="View Patient">
                  <i class="fa fa-eye"></i>
                </button>
                <button class="btn-icon success" onclick="app.startNewVisit(${
                  patient.id
                })" title="New Visit">
                  <i class="fa fa-plus"></i>
                </button>
                <button class="btn-icon warning" onclick="app.editPatient(${
                  patient.id
                })" title="Edit Patient">
                  <i class="fa fa-edit"></i>
                </button>
              </div>
            </td>
          </tr>
        `;
      })
      .join("");
  }

  renderUsersTable() {
    const tbody = document.getElementById("users-tbody");
    if (!tbody) {
      console.warn("Users table body not found");
      return;
    }

    if (this.users.length === 0) {
      tbody.innerHTML = `
        <tr class="empty-row">
          <td colspan="6" class="empty-message">
            <i class="fa fa-users"></i>
            <span>No users found.</span>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = this.users
      .map(
        (user) => `
        <tr>
          <td>
            <div class="user-info-cell">
              <strong>${user.username}</strong>
              ${user.email ? `<div class="user-email">${user.email}</div>` : ""}
            </div>
          </td>
          <td>${user.full_name}</td>
          <td><span class="badge ${
            user.role === "admin"
              ? "danger"
              : user.role === "doctor"
              ? "info"
              : "primary"
          }">${user.role}</span></td>
          <td><span class="badge ${user.is_active ? "success" : "warning"}">${
          user.is_active ? "Active" : "Inactive"
        }</span></td>
          <td><small>${this.formatDate(user.created_at)}</small></td>
          <td>
            <div class="table-actions">
              <button class="btn-icon warning" onclick="app.editUserModal(${
                user.id
              })" title="Edit User">
                <i class="fa fa-edit"></i>
              </button>
              <button class="btn-icon ${
                user.is_active ? "danger" : "success"
              }" onclick="app.toggleUserStatus(${user.id}, ${
          user.is_active
        })" title="${user.is_active ? "Deactivate" : "Activate"}">
                <i class="fa ${user.is_active ? "fa-ban" : "fa-check"}"></i>
              </button>
            </div>
          </td>
        </tr>
      `
      )
      .join("");
  }

  updateDashboard() {
    const totalPatientsEl = document.getElementById("total-patients");
    const patientCountEl = document.getElementById("patient-count");

    if (totalPatientsEl) {
      totalPatientsEl.textContent = this.allPatients?.length || 0;
    }
    if (patientCountEl) {
      patientCountEl.textContent = this.allPatients?.length || 0;
    }

    // Update today's visits (placeholder - implement based on your data)
    const todayVisitsEl = document.getElementById("today-visits");
    if (todayVisitsEl) {
      const today = new Date().toISOString().split("T")[0];
      const todaysPatients =
        this.allPatients?.filter(
          (p) => p.created_at && p.created_at.startsWith(today)
        ) || [];
      todayVisitsEl.textContent = todaysPatients.length;
    }
  }

  togglePasswordChangeFields() {
    const fields = document.getElementById("password-change-fields");
    const toggleBtn = document.getElementById("toggle-password-change");

    if (fields.classList.contains("hidden")) {
      fields.classList.remove("hidden");
      toggleBtn.textContent = "Cancel Password Change";
    } else {
      fields.classList.add("hidden");
      toggleBtn.textContent = "Change Password";
      // Clear password fields
      document.getElementById("edit-password").value = "";
      document.getElementById("edit-confirm-password").value = "";
    }
  }

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.remove("active");
    }
  }

  navigateToView(viewName) {
    document.querySelectorAll(".view-container").forEach((view) => {
      view.classList.remove("active");
    });

    const targetView = document.getElementById(`${viewName}-view`);
    if (targetView) {
      targetView.classList.add("active");
      console.log(`View ${viewName} activated`);

      if (viewName === "user-management") {
        this.loadUsers();
      }
    } else {
      console.warn(`Target view not found: ${viewName}-view`);
      this.showNotification(`View '${viewName}' not implemented yet`, "info");
    }
  }

  handleAction(action) {
    console.log("Handling action:", action);
    switch (action) {
      case "new-patient":
        this.showNewPatientModal();
        break;
      case "new-visit":
        this.showNewVisitModal();
        break;
      case "manage-examiners":
        this.navigateToView("examiners");
        break;
      case "view-all-patients":
        this.currentPage = 1;
        this.searchTerm = "";
        document.getElementById("patient-search").value = "";
        this.loadPatients();
        break;
      case "add-user":
        this.showAddUserModal();
        break;
      case "check-updates":
        this.checkForUpdates(true);
        break;
      case "quick-stats":
        this.showQuickStats();
        break;
      case "generate-report":
        this.generateReport();
        break;
      default:
        console.warn("Unknown action:", action);
        // Don't show notification for close actions to avoid spam
        if (!action.startsWith("close-")) {
          this.showNotification(
            `Action '${action}' not implemented yet`,
            "info"
          );
        }
    }
  }

  async logout() {
    try {
      console.log("Logging out...");
      const response = await window.electronAPI.userLogout();

      if (response.success) {
        console.log("Session cleared, redirecting to login...");
        window.electronAPI.send("logout-successful");
      } else {
        console.error("Logout failed:", response.error);
      }
    } catch (error) {
      console.error("Logout error:", error);
    }
  }

  async loadSettings() {
    try {
      console.log("Loading settings...");
      this.showNotification("Settings loaded", "info");
    } catch (error) {
      console.error("Error loading settings:", error);
      this.showNotification("Error loading settings", "error");
    }
  }

  async loadUsers() {
    try {
      // Use the proper IPC handler instead of direct SQL
      const users = await window.electronAPI.getUsers();
      console.log("Loaded users:", users?.length || 0);
      if (users) {
        this.users = users;
        this.renderUsersTable();
      }
    } catch (error) {
      console.error("Error loading users:", error);
      this.showNotification("Error loading users", "error");
    }
  }

  showAddUserModal() {
    console.log("Showing add user modal");
    const modal = document.getElementById("add-user-modal");
    const form = document.getElementById("add-user-form");

    if (modal && form) {
      form.reset();
      modal.classList.add("active");

      // Set default values
      document.getElementById("new-status").value = "1";
      document.getElementById("new-role").value = "doctor";

      // Focus first field
      setTimeout(() => {
        document.getElementById("new-username").focus();
      }, 100);
    }
  }

  editUserModal(userId) {
    console.log("Showing edit user modal for user:", userId);
    const modal = document.getElementById("edit-user-modal");
    const form = document.getElementById("edit-user-form");

    if (!modal || !form) return;

    const user = this.users.find((u) => u.id === userId);
    if (!user) {
      this.showNotification("User not found", "error");
      return;
    }

    this.currentEditingUserId = userId;

    // Populate form fields
    document.getElementById("edit-user-id").value = user.id;
    document.getElementById("edit-username").value = user.username;
    document.getElementById("edit-fullname").value = user.full_name;
    document.getElementById("edit-email").value = user.email || "";
    document.getElementById("edit-role").value = user.role || "doctor";
    document.getElementById("edit-status").value = user.is_active ? "1" : "0";
    document.getElementById("edit-notes").value = user.notes || "";

    // Set user statistics
    document.getElementById("user-created").textContent = this.formatDate(
      user.created_at
    );
    document.getElementById("user-last-login").textContent = user.last_login
      ? this.formatDate(user.last_login)
      : "Never";
    document.getElementById("user-total-logins").textContent =
      user.login_count || "0";

    // Hide password fields initially
    document.getElementById("password-change-fields").classList.add("hidden");
    document.getElementById("toggle-password-change").textContent =
      "Change Password";

    // Clear password fields
    document.getElementById("edit-password").value = "";
    document.getElementById("edit-confirm-password").value = "";

    modal.classList.add("active");

    // Focus first editable field
    setTimeout(() => {
      document.getElementById("edit-fullname").focus();
    }, 100);
  }

  async saveNewUser() {
    try {
      const username = document.getElementById("new-username").value.trim();
      const fullname = document.getElementById("new-fullname").value.trim();
      const email = document.getElementById("new-email").value.trim();
      const password = document.getElementById("new-password").value;
      const confirmPassword = document.getElementById("confirm-password").value;
      const role = document.getElementById("new-role").value;
      const status = document.getElementById("new-status").value === "1";
      const notes = document.getElementById("new-notes").value.trim();

      // Validation
      if (!username || !fullname || !password || !role) {
        this.showNotification("Please fill in all required fields", "error");
        return;
      }

      if (username.length < 3 || username.length > 20) {
        this.showNotification("Username must be 3-20 characters", "error");
        return;
      }

      if (password.length < 6) {
        this.showNotification(
          "Password must be at least 6 characters",
          "error"
        );
        return;
      }

      if (password !== confirmPassword) {
        this.showNotification("Passwords do not match", "error");
        return;
      }

      // Check if username already exists
      const existingUser = this.users.find(
        (u) => u.username.toLowerCase() === username.toLowerCase()
      );
      if (existingUser) {
        this.showNotification("Username already exists", "error");
        return;
      }

      // Use the proper IPC handler for adding users
      const result = await window.electronAPI.addUser({
        username: username,
        full_name: fullname,
        email: email,
        password: password, // Password will be hashed in the main process
        role: role,
        is_active: status,
        notes: notes,
      });

      if (result && result.success) {
        this.showNotification("User added successfully", "success");
        this.closeModal("add-user-modal");
        await this.loadUsers();
      } else {
        throw new Error(result.error || "Failed to add user");
      }
    } catch (error) {
      console.error("Error adding user:", error);
      this.showNotification("Error adding user: " + error.message, "error");
    }
  }

  async saveUserChanges() {
    try {
      const userId = this.currentEditingUserId;
      const fullname = document.getElementById("edit-fullname").value.trim();
      const email = document.getElementById("edit-email").value.trim();
      const role = document.getElementById("edit-role").value;
      const status = document.getElementById("edit-status").value === "1";
      const notes = document.getElementById("edit-notes").value.trim();
      const password = document.getElementById("edit-password").value;
      const confirmPassword = document.getElementById(
        "edit-confirm-password"
      ).value;

      // Validation
      if (!fullname || !role) {
        this.showNotification("Please fill in all required fields", "error");
        return;
      }

      if (password) {
        if (password.length < 6) {
          this.showNotification(
            "Password must be at least 6 characters",
            "error"
          );
          return;
        }

        if (password !== confirmPassword) {
          this.showNotification("Passwords do not match", "error");
          return;
        }
      }

      // Prepare user data for update
      const userData = {
        full_name: fullname,
        email: email,
        role: role,
        is_active: status,
        notes: notes,
      };

      // Add password only if provided
      if (password && password.trim() !== "") {
        userData.password = password;
      }

      // Use the proper IPC handler for updating users
      const result = await window.electronAPI.updateUser(userId, userData);

      if (result && result.success) {
        this.showNotification("User updated successfully", "success");
        this.closeModal("edit-user-modal");
        await this.loadUsers();
      } else {
        this.showNotification(result.error || "No changes were made", "info");
      }
    } catch (error) {
      console.error("Error updating user:", error);
      this.showNotification("Error updating user: " + error.message, "error");
    }
  }

  showConfirmDeleteModal(userId) {
    const user = this.users.find((u) => u.id === userId);
    if (!user) {
      this.showNotification("User not found", "error");
      return;
    }

    // Don't allow deleting admin user
    if (user.username === "admin") {
      this.showNotification("Cannot delete the admin user", "error");
      return;
    }

    document.getElementById(
      "delete-user-name"
    ).textContent = `User: ${user.username} (${user.full_name})`;
    document.getElementById("confirm-delete-modal").classList.add("active");
  }

  async confirmDeleteUser() {
    try {
      const userId = this.currentEditingUserId;

      // Use the proper IPC handler for deleting users
      const result = await window.electronAPI.deleteUser(userId);

      if (result && result.success) {
        this.showNotification("User deleted successfully", "success");
        this.closeModal("confirm-delete-modal");
        this.closeModal("edit-user-modal");
        await this.loadUsers();
      } else {
        this.showNotification(result.error || "Failed to delete user", "error");
      }
    } catch (error) {
      console.error("Error deleting user:", error);
      this.showNotification("Error deleting user: " + error.message, "error");
    }
  }

  async toggleUserStatus(userId, currentStatus) {
    try {
      console.log(
        `Toggling user ${userId} status from ${currentStatus} to ${!currentStatus}`
      );

      // Use the proper IPC handler for toggling user status
      const result = await window.electronAPI.toggleUserStatus(userId);

      console.log("Toggle user status result:", result);

      if (result && result.success) {
        await this.loadUsers();
        this.showNotification(
          `User ${result.newStatus ? "activated" : "deactivated"} successfully`,
          "success"
        );
      } else {
        this.showNotification(
          result.error || "Error updating user status",
          "error"
        );
      }
    } catch (error) {
      console.error("Error toggling user status:", error);
      this.showNotification(
        "Error updating user status: " + error.message,
        "error"
      );
    }
  }

  showSettingsModal() {
    console.log("Showing settings modal");
    const modal = document.getElementById("settings-modal");
    if (modal) {
      modal.classList.add("active");
      this.loadSettingsContent();
    }
  }

  loadSettingsContent() {
    // Load settings content if needed
    console.log("Loading settings content...");
  }

  // Utility methods
  calculateAge(dateOfBirth) {
    if (!dateOfBirth) return "N/A";
    const today = new Date();
    const birthDate = new Date(dateOfBirth);

    if (isNaN(birthDate.getTime())) return "N/A";

    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < birthDate.getDate())
    ) {
      age--;
    }

    return age;
  }

  formatDate(dateString) {
    if (!dateString) return "Never";
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "Invalid Date";
    return date.toLocaleDateString();
  }

  formatBytes(bytes) {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }

  // New methods for enhanced features
  showQuickStats() {
    const stats = {
      totalPatients: this.allPatients?.length || 0,
      todayVisits:
        this.allPatients?.filter(
          (p) =>
            p.created_at &&
            new Date(p.created_at).toDateString() === new Date().toDateString()
        ).length || 0,
      monthlyGrowth: "+15%", // Placeholder
      activeUsers: this.users?.filter((u) => u.is_active).length || 0,
    };

    const message = `📊 Quick Stats:\n
    • Total Patients: ${stats.totalPatients}
    • Today's Visits: ${stats.todayVisits}
    • Monthly Growth: ${stats.monthlyGrowth}
    • Active Users: ${stats.activeUsers}`;

    this.showNotification("Quick stats displayed in console", "info");
    console.log(message);
  }

  generateReport() {
    this.showNotification("Report generation feature coming soon", "info");
  }

  showNewPatientModal() {
    console.log("Show new patient modal");
    this.showNotification("New patient feature coming soon", "info");
  }

  showNewVisitModal() {
    console.log("Show new visit modal");
    this.showNotification("New visit feature coming soon", "info");
  }

  viewPatient(patientId) {
    console.log("View patient:", patientId);
    this.showNotification(
      `View patient ${patientId} - feature coming soon`,
      "info"
    );
  }

  startNewVisit(patientId) {
    console.log("Start new visit for patient:", patientId);
    this.showNotification(
      `New visit for patient ${patientId} - feature coming soon`,
      "info"
    );
  }

  editPatient(patientId) {
    console.log("Edit patient:", patientId);
    this.showNotification(
      `Edit patient ${patientId} - feature coming soon`,
      "info"
    );
  }

  showNotification(message, type = "info", duration = 3000) {
    const existingNotifications = document.querySelectorAll(
      ".custom-notification"
    );
    existingNotifications.forEach((notification) => {
      if (notification.parentNode) {
        notification.remove();
      }
    });

    const notification = document.createElement("div");
    notification.className = `custom-notification ${type}`;
    notification.innerHTML = `
      <div class="notification-content">
        <i class="fa ${this.getNotificationIcon(type)}"></i>
        <span>${message}</span>
      </div>
    `;

    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 12px 20px;
      background: ${this.getNotificationColor(type)};
      color: white;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 10000;
      max-width: 400px;
      animation: slideInRight 0.3s ease-out;
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.style.animation = "slideOutRight 0.3s ease-in";
      setTimeout(() => {
        if (notification.parentNode) {
          notification.remove();
        }
      }, 300);
    }, duration);
  }

  getNotificationIcon(type) {
    const icons = {
      info: "fa-info-circle",
      success: "fa-check-circle",
      warning: "fa-exclamation-triangle",
      error: "fa-exclamation-circle",
    };
    return icons[type] || "fa-info-circle";
  }

  getNotificationColor(type) {
    const colors = {
      info: "#3498db",
      success: "#2ecc71",
      warning: "#f39c12",
      error: "#e74c3c",
    };
    return colors[type] || "#3498db";
  }
}

// Add CSS animations for notifications
if (!document.querySelector("#notification-styles")) {
  const style = document.createElement("style");
  style.id = "notification-styles";
  style.textContent = `
    @keyframes slideInRight {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
    
    @keyframes slideOutRight {
      from { transform: translateX(0); opacity: 1; }
      to { transform: translateX(100%); opacity: 0; }
    }
  `;
  document.head.appendChild(style);
}

// Initialize the application
document.addEventListener("DOMContentLoaded", () => {
  console.log("DOM loaded, initializing EndoStatApp...");
  console.log(
    "Available electronAPI methods:",
    Object.keys(window.electronAPI || {})
  );
  window.app = new EndoStatApp();
});

window.addEventListener("error", (error) => {
  console.error("Global error:", error);
});

window.debug.testIPC();
