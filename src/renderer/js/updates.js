class UpdateManager {
  constructor() {
    this.isChecking = false;
    this.isDownloading = false;
    this.init();
  }

  init() {
    this.setupEventListeners();
    this.loadAppVersion();
  }

  setupEventListeners() {
    // Update check button
    const updateBtn = document.getElementById("update-check-btn");
    if (updateBtn) {
      updateBtn.addEventListener("click", () => {
        this.checkForUpdates();
      });
    }

    // Close update panel
    const closeBtn = document.getElementById("close-update-panel");
    if (closeBtn) {
      closeBtn.addEventListener("click", () => {
        this.hideUpdatePanel();
      });
    }

    // Cancel update button
    const cancelBtn = document.getElementById("cancel-update");
    if (cancelBtn) {
      cancelBtn.addEventListener("click", () => {
        this.cancelUpdate();
      });
    }

    // Listen for update events from main process
    if (window.electronAPI) {
      window.electronAPI.onUpdateDownloadProgress((event, progressObj) => {
        this.onDownloadProgress(progressObj);
      });

      window.electronAPI.onUpdateDownloaded((event, info) => {
        this.onUpdateDownloaded(info);
      });
    }
  }

  async checkForUpdates() {
    if (this.isChecking) return;

    this.isChecking = true;
    this.showUpdatePanel();

    const updateBtn = document.getElementById("update-check-btn");
    const statusBody = document.getElementById("update-status-body");

    // Update button state
    if (updateBtn) {
      updateBtn.disabled = true;
      updateBtn.innerHTML =
        '<i class="fas fa-spinner fa-spin"></i><span>Checking...</span>';
    }

    // Show checking status
    if (statusBody) {
      statusBody.innerHTML = `
                <div class="update-checking">
                    <i class="fas fa-spinner fa-spin"></i>
                    <p>Checking for updates...</p>
                </div>
            `;
    }

    try {
      const result = await window.electronAPI.checkForUpdatesManually();
      this.handleUpdateCheckResult(result);
    } catch (error) {
      console.error("Update check error:", error);
      this.showUpdateError("Failed to check for updates: " + error.message);
    } finally {
      this.isChecking = false;

      // Reset button state
      if (updateBtn) {
        updateBtn.disabled = false;
        updateBtn.innerHTML =
          '<i class="fas fa-sync-alt"></i><span>Check for Updates</span>';
      }

      // Update last check time
      this.updateLastCheckTime();
    }
  }

  handleUpdateCheckResult(result) {
    const statusBody = document.getElementById("update-status-body");
    if (!statusBody) return;

    switch (result.status) {
      case "update-available":
        statusBody.innerHTML = `
                    <div class="update-available">
                        <div class="update-success">
                            <i class="fas fa-download"></i>
                            <h4>Update Available!</h4>
                            <p>Version ${result.version} is available for download.</p>
                        </div>
                        <div class="update-actions">
                            <button class="btn btn-primary" id="download-update-btn">
                                <i class="fas fa-download"></i> Download Update
                            </button>
                            <button class="btn btn-outline" id="remind-later-btn">
                                Remind Me Later
                            </button>
                        </div>
                    </div>
                `;

        // Add event listeners for the new buttons
        const downloadBtn = document.getElementById("download-update-btn");
        const remindBtn = document.getElementById("remind-later-btn");

        if (downloadBtn) {
          downloadBtn.addEventListener("click", () => {
            this.downloadUpdate();
          });
        }

        if (remindBtn) {
          remindBtn.addEventListener("click", () => {
            this.hideUpdatePanel();
          });
        }
        break;

      case "update-not-available":
        statusBody.innerHTML = `
                    <div class="update-success">
                        <i class="fas fa-check-circle"></i>
                        <h4>You're up to date!</h4>
                        <p>${result.message}</p>
                    </div>
                `;
        break;

      case "error":
        this.showUpdateError(result.message);
        break;

      default:
        this.showUpdateError("Unknown update status");
    }
  }

  async downloadUpdate() {
    if (this.isDownloading) return;

    this.isDownloading = true;
    this.showDownloadModal();

    try {
      const result = await window.electronAPI.downloadAndInstallUpdate();
      if (!result.success) {
        this.showUpdateError(result.message);
        this.hideDownloadModal();
      }
      // If successful, the main process will handle the rest
    } catch (error) {
      console.error("Download error:", error);
      this.showUpdateError("Download failed: " + error.message);
      this.hideDownloadModal();
    }
  }

  onDownloadProgress(progressObj) {
    const progressFill = document.getElementById("update-progress-fill");
    const progressText = document.getElementById("update-progress-text");
    const speedText = document.getElementById("update-speed-text");

    if (progressFill) {
      progressFill.style.width = `${progressObj.percent}%`;
    }

    if (progressText) {
      progressText.textContent = `Downloaded ${Math.round(
        progressObj.percent
      )}%`;
    }

    if (speedText && progressObj.bytesPerSecond) {
      const speed = this.formatBytes(progressObj.bytesPerSecond);
      speedText.textContent = `Speed: ${speed}/s`;
    }
  }

  onUpdateDownloaded(info) {
    this.hideDownloadModal();
    this.showUpdatePanel();

    const statusBody = document.getElementById("update-status-body");
    if (statusBody) {
      statusBody.innerHTML = `
                <div class="update-success">
                    <i class="fas fa-check-circle"></i>
                    <h4>Update Ready to Install!</h4>
                    <p>Version ${info.version} has been downloaded and is ready to install.</p>
                    <p>The application will restart automatically to complete the installation.</p>
                </div>
            `;
    }
  }

  cancelUpdate() {
    this.hideDownloadModal();
    this.isDownloading = false;
    // Note: We can't actually cancel the download once started with electron-updater
    // This just hides the modal
  }

  showUpdatePanel() {
    const panel = document.getElementById("update-status-panel");
    if (panel) {
      panel.classList.remove("hidden");
    }
  }

  hideUpdatePanel() {
    const panel = document.getElementById("update-status-panel");
    if (panel) {
      panel.classList.add("hidden");
    }
  }

  showDownloadModal() {
    const modal = document.getElementById("update-progress-modal");
    if (modal) {
      modal.classList.remove("hidden");
    }
  }

  hideDownloadModal() {
    const modal = document.getElementById("update-progress-modal");
    if (modal) {
      modal.classList.add("hidden");
    }
  }

  showUpdateError(message) {
    const statusBody = document.getElementById("update-status-body");
    if (statusBody) {
      statusBody.innerHTML = `
                <div class="update-error">
                    <i class="fas fa-exclamation-triangle"></i>
                    <h4>Update Check Failed</h4>
                    <p>${message}</p>
                    <button class="btn btn-outline" onclick="updateManager.checkForUpdates()">
                        <i class="fas fa-redo"></i> Try Again
                    </button>
                </div>
            `;
    }
  }

  loadAppVersion() {
    if (window.electronAPI) {
      window.electronAPI.getAppVersion().then((version) => {
        const versionElement = document.getElementById("app-version");
        if (versionElement) {
          versionElement.textContent = version;
        }
      });
    }
  }

  updateLastCheckTime() {
    const lastCheckElement = document.getElementById("last-update-check");
    if (lastCheckElement) {
      const now = new Date();
      lastCheckElement.textContent = now.toLocaleString();
    }
  }

  formatBytes(bytes) {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }
}

// Initialize update manager when DOM is loaded
let updateManager;
document.addEventListener("DOMContentLoaded", () => {
  updateManager = new UpdateManager();
});
