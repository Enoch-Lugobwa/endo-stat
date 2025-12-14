// src/renderer/js/update-manager.js
class UpdateManager {
  constructor() {
    this.isUpdateAvailable = false;
    this.isDownloading = false;
    this.downloadProgress = 0;
    this.updateInfo = null;
    this.init();
  }

  init() {
    this.setupEventListeners();
    this.checkAutoUpdateAvailability();
  }

  setupEventListeners() {
    // Check for updates button
    const checkUpdateBtn = document.getElementById("check-updates-btn");
    if (checkUpdateBtn) {
      checkUpdateBtn.addEventListener("click", () => {
        this.checkForUpdates(true);
      });
    }

    // Dashboard update button
    const dashboardUpdateBtn = document.getElementById("dashboard-update-btn");
    if (dashboardUpdateBtn) {
      dashboardUpdateBtn.addEventListener("click", () => {
        this.checkForUpdates(true);
      });
    }

    // Download update button
    const downloadBtn = document.getElementById("download-update-now-btn");
    if (downloadBtn) {
      downloadBtn.addEventListener("click", () => {
        this.downloadUpdate();
      });
    }

    // Install update button
    const installBtn = document.getElementById("install-update-btn");
    if (installBtn) {
      installBtn.addEventListener("click", () => {
        this.installUpdate();
      });
    }

    // Cancel update button
    const cancelBtn = document.getElementById("cancel-update-btn");
    if (cancelBtn) {
      cancelBtn.addEventListener("click", () => {
        this.cancelUpdate();
      });
    }

    // Close modal buttons
    const closeButtons = document.querySelectorAll('[data-action^="close-"]');
    closeButtons.forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const action = e.target.getAttribute("data-action");
        const modalId = action.replace("close-", "").replace("-modal", "");
        this.closeModal(`${modalId}-modal`);
      });
    });
  }

  async checkAutoUpdateAvailability() {
    try {
      console.log("🔍 Checking auto-update feature availability...");

      if (!window.electronAPI || !window.electronAPI.isAutoUpdateAvailable) {
        console.warn("Auto-update API not available");
        return;
      }

      const result = await window.electronAPI.isAutoUpdateAvailable();
      console.log("Auto-update availability result:", result);

      if (result.available) {
        console.log("✅ Auto-update feature is available");
        this.setupUpdateListeners();

        // Schedule auto-check after 5 seconds
        setTimeout(() => {
          this.checkForUpdates(false); // Silent check
        }, 5000);
      } else {
        console.log("Auto-update not available:", result.message);
        this.updateStatusUI("error", result.message);
      }
    } catch (error) {
      console.error("Error checking auto-update availability:", error);
    }
  }

  setupUpdateListeners() {
    console.log("🔌 Setting up update listeners...");

    // Setup all event listeners with cleanup functions
    this.updateListeners = {
      checking: window.electronAPI.onUpdateChecking(() => {
        console.log("📡 Update check started");
        this.onUpdateChecking();
      }),

      available: window.electronAPI.onUpdateAvailable((info) => {
        console.log("📡 Update available:", info);
        this.onUpdateAvailable(info);
      }),

      notAvailable: window.electronAPI.onUpdateNotAvailable((info) => {
        console.log("📡 No updates available:", info);
        this.onUpdateNotAvailable(info);
      }),

      downloadProgress: window.electronAPI.onUpdateDownloadProgress(
        (progress) => {
          console.log("📡 Download progress:", progress);
          this.onUpdateDownloadProgress(progress);
        }
      ),

      downloaded: window.electronAPI.onUpdateDownloaded((info) => {
        console.log("📡 Update downloaded:", info);
        this.onUpdateDownloaded(info);
      }),

      error: window.electronAPI.onUpdateError((error) => {
        console.error("📡 Update error:", error);
        this.onUpdateError(error);
      }),
    };
  }

  async checkForUpdates(showNotification = true) {
    try {
      console.log(
        "🔍 Checking for updates, show notification:",
        showNotification
      );

      if (showNotification) {
        this.showNotification("Checking for updates...", "info");
      }

      if (!window.electronAPI || !window.electronAPI.checkForUpdates) {
        this.showNotification("Update feature not available", "error");
        return;
      }

      const result = await window.electronAPI.checkForUpdates();
      console.log("Update check result:", result);

      if (result.status === "error") {
        this.showNotification(
          `Update check failed: ${result.message}`,
          "error"
        );
      }

      return result;
    } catch (error) {
      console.error("❌ Error checking for updates:", error);
      this.showNotification("Failed to check for updates", "error");
      return null;
    }
  }

  onUpdateChecking() {
    this.updateStatusUI("checking", "Checking for updates...");
  }

  onUpdateAvailable(info) {
    console.log("✅ Update available:", info);
    this.updateInfo = info;
    this.isUpdateAvailable = true;

    // Show update badge
    const updateBadge = document.getElementById("update-badge");
    if (updateBadge) {
      updateBadge.classList.add("available");
      updateBadge.textContent = "!";
    }

    this.updateStatusUI("available", `Update ${info.version} available`);

    // Show update notification modal
    this.showUpdateAvailableModal(info);

    // Show notification
    this.showNotification(`Update ${info.version} available!`, "success", 5000);
  }

  onUpdateNotAvailable(info) {
    console.log("✅ No updates available");
    this.isUpdateAvailable = false;

    // Hide update badge
    const updateBadge = document.getElementById("update-badge");
    if (updateBadge) {
      updateBadge.classList.remove("available");
    }

    this.updateStatusUI("current", "Up to date");
  }

  onUpdateDownloadProgress(progress) {
    console.log("📥 Download progress:", progress.percent);
    this.downloadProgress = Math.round(progress.percent || 0);
    this.showUpdateProgressModal(progress);
  }

  onUpdateDownloaded(info) {
    console.log("🎉 Update downloaded:", info);
    this.isDownloading = false;
    this.updateStatusUI("ready", "Ready to install");

    // Show install button
    this.showUpdateReadyModal(info);

    // Show notification
    this.showNotification(
      "Update downloaded and ready to install!",
      "success",
      5000
    );
  }

  onUpdateError(error) {
    console.error("❌ Update error:", error);
    this.updateStatusUI("error", "Update error");
    this.showNotification(`Update error: ${error.message}`, "error");
  }

  async downloadUpdate() {
    try {
      if (!window.electronAPI || !window.electronAPI.downloadUpdate) {
        this.showNotification("Download feature not available", "error");
        return;
      }

      console.log("⬇️ Starting update download...");
      this.isDownloading = true;
      this.updateStatusUI("downloading", "Downloading update...");
      this.showNotification("Starting update download...", "info");

      const result = await window.electronAPI.downloadUpdate();
      console.log("Download result:", result);

      if (!result.success) {
        this.showNotification(`Download failed: ${result.message}`, "error");
        this.isDownloading = false;
      }
    } catch (error) {
      console.error("❌ Error downloading update:", error);
      this.showNotification(`Download error: ${error.message}`, "error");
      this.isDownloading = false;
    }
  }

  async installUpdate() {
    try {
      if (!window.electronAPI || !window.electronAPI.installUpdate) {
        this.showNotification("Install feature not available", "error");
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
      }
    } catch (error) {
      console.error("❌ Error installing update:", error);
      this.showNotification(`Install error: ${error.message}`, "error");
    }
  }

  cancelUpdate() {
    console.log("❌ Update cancelled");
    this.isDownloading = false;
    this.closeModal("update-progress-modal");
    this.showNotification("Update cancelled", "info");
    this.updateStatusUI("available", "Update available");
  }

  // UI Methods
  updateStatusUI(status, message) {
    const statusItem = document.getElementById("update-status-item");
    const statusIcon = document.getElementById("update-status-icon");
    const statusText = document.getElementById("update-status-text");

    if (!statusItem || !statusIcon || !statusText) {
      return;
    }

    // Reset classes
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
    }

    statusText.textContent = message;
  }

  showUpdateAvailableModal(info) {
    const modal = document.getElementById("update-available-modal");
    if (!modal) return;

    // Set version info
    const currentVersion = document.getElementById("current-version-text");
    const newVersion = document.getElementById("new-version-text");
    const releaseNotes = document.getElementById("release-notes");
    const updateSize = document.getElementById("update-size-info");

    if (currentVersion) {
      currentVersion.textContent = window.app?.currentAppVersion || "1.0.0";
    }

    if (newVersion) {
      newVersion.textContent = info.version || "1.0.0";
    }

    if (releaseNotes) {
      releaseNotes.innerHTML = info.releaseNotes
        ? `<p>${info.releaseNotes}</p>`
        : `<p class="text-muted">No release notes available.</p>`;
    }

    if (updateSize) {
      updateSize.textContent = info.size
        ? `Update Size: ${this.formatBytes(info.size)}`
        : "Update Size: Calculating...";
    }

    modal.classList.add("active");
  }

  showUpdateProgressModal(progress) {
    const modal = document.getElementById("update-progress-modal");
    const progressFill = document.getElementById("update-progress-fill");
    const progressPercent = document.getElementById("update-progress-percent");
    const progressSpeed = document.getElementById("update-progress-speed");
    const downloaded = document.getElementById("update-downloaded");
    const total = document.getElementById("update-total");
    const timeRemaining = document.getElementById("update-time-remaining");

    if (!modal) return;

    // Show modal if not already shown
    if (!modal.classList.contains("active")) {
      modal.classList.add("active");
    }

    // Update progress
    const percent = Math.round(progress.percent || 0);
    if (progressFill) progressFill.style.width = `${percent}%`;
    if (progressPercent) progressPercent.textContent = `${percent}%`;

    if (progress.bytesPerSecond && progressSpeed) {
      progressSpeed.textContent = `${this.formatBytes(
        progress.bytesPerSecond
      )}/s`;
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
  }

  showUpdateReadyModal(info) {
    const modal = document.getElementById("update-progress-modal");
    const modalTitle = document.getElementById("update-modal-title");
    const modalMessage = document.getElementById("update-modal-message");
    const installBtn = document.getElementById("install-update-btn");
    const cancelBtn = document.getElementById("cancel-update-btn");

    if (!modal) return;

    if (modalTitle) modalTitle.textContent = "Update Ready!";
    if (modalMessage)
      modalMessage.textContent = `Update ${info.version} has been downloaded and is ready to install.`;
    if (installBtn) installBtn.style.display = "block";
    if (cancelBtn) cancelBtn.style.display = "none";
  }

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.remove("active");
    }
  }

  showNotification(message, type = "info", duration = 3000) {
    // Check if app has notification method
    if (window.app && window.app.showNotification) {
      window.app.showNotification(message, type, duration);
    } else {
      console.log(`[${type.toUpperCase()}] ${message}`);

      // Fallback: create a simple notification
      const notification = document.createElement("div");
      notification.className = `custom-notification ${type}`;
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

      notification.innerHTML = `
        <div class="notification-content">
          <i class="fa ${this.getNotificationIcon(type)}"></i>
          <span>${message}</span>
        </div>
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

  formatBytes(bytes) {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }

  // Cleanup method
  cleanup() {
    if (this.updateListeners) {
      Object.values(this.updateListeners).forEach((cleanup) => {
        if (typeof cleanup === "function") {
          cleanup();
        }
      });
    }
  }
}

// Initialize update manager when DOM is loaded
let updateManager;
document.addEventListener("DOMContentLoaded", () => {
  updateManager = new UpdateManager();
  window.updateManager = updateManager;
});
