const { autoUpdater, dialog } = require("electron-updater");
const { app } = require("electron");

class AutoUpdater {
  constructor() {
    this.initialized = false;
    this.isDev = process.env.NODE_ENV === "development";
    this.isPackaged = app.isPackaged;
    this.updateAvailable = false;
    this.updateDownloaded = false;
  }

  init(licenseKey) {
    try {
      console.log("Initializing auto-updater...");
      console.log("Environment:", {
        isDev: this.isDev,
        isPackaged: this.isPackaged,
        version: app.getVersion(),
      });

      // Only initialize in production with packaged app
      if (this.isDev || !this.isPackaged) {
        console.log(
          "Auto-updater disabled - Development mode or unpackaged app"
        );
        this.initialized = false;
        return;
      }

      // Check if electron-updater is available
      if (typeof autoUpdater === "undefined") {
        console.warn("Auto-updater not available");
        return;
      }

      // Configure logging
      try {
        const electronLog = require("electron-log");
        autoUpdater.logger = electronLog;
        autoUpdater.logger.transports.file.level = "info";
        console.log("Electron-log configured for auto-updater");
      } catch (error) {
        console.warn("Electron-log not available, using console logging");
        autoUpdater.logger = {
          info: (msg) => console.log("[Auto-updater]", msg),
          warn: (msg) => console.warn("[Auto-updater]", msg),
          error: (msg) => console.error("[Auto-updater]", msg),
        };
      }

      // Configure auto-updater settings
      autoUpdater.autoDownload = false;
      autoUpdater.allowPrerelease = false;
      autoUpdater.autoInstallOnAppQuit = true;
      autoUpdater.autoRunAppAfterInstall = true;
      autoUpdater.fullChangelog = true;

      console.log("Auto-updater configuration:", {
        autoDownload: autoUpdater.autoDownload,
        allowPrerelease: autoUpdater.allowPrerelease,
        autoInstallOnAppQuit: autoUpdater.autoInstallOnAppQuit,
      });

      // Set up event handlers
      this.setupEventHandlers();

      // Add license authentication if available
      if (licenseKey) {
        try {
          autoUpdater.addAuthHeader(`License ${licenseKey}`);
          console.log("License auth header added successfully");
        } catch (error) {
          console.warn("Failed to add license auth header:", error.message);
        }
      }

      // Check for updates on startup (with delay to ensure app is ready)
      setTimeout(() => {
        console.log("Performing initial update check...");
        autoUpdater
          .checkForUpdates()
          .then((result) => {
            console.log(
              "Initial update check completed:",
              result ? "Update available" : "No updates"
            );
          })
          .catch((error) => {
            console.error("Initial update check failed:", error);
          });
      }, 5000);

      // Set up periodic update checks (every 6 hours)
      setInterval(() => {
        if (this.initialized) {
          console.log("Performing periodic update check...");
          autoUpdater.checkForUpdates().catch((error) => {
            console.error("Periodic update check failed:", error);
          });
        }
      }, 6 * 60 * 60 * 1000); // 6 hours

      this.initialized = true;
      console.log("Auto-updater initialized successfully");
    } catch (error) {
      console.error("Failed to initialize auto-updater:", error);
      this.initialized = false;
    }
  }

  setupEventHandlers() {
    if (!autoUpdater) {
      console.error("Auto-updater not available for event handlers");
      return;
    }

    autoUpdater.on("checking-for-update", () => {
      console.log("Checking for updates...");
      this.updateAvailable = false;
      this.updateDownloaded = false;
    });

    autoUpdater.on("update-available", (info) => {
      console.log("Update available:", {
        version: info.version,
        releaseDate: info.releaseDate,
        releaseNotes: info.releaseNotes,
      });
      this.updateAvailable = true;
      this.updateDownloaded = false;
      this.onUpdateAvailable(info);
    });

    autoUpdater.on("update-not-available", (info) => {
      console.log(
        "No updates available. Current version:",
        info?.version || "unknown"
      );
      this.updateAvailable = false;
      this.updateDownloaded = false;
    });

    autoUpdater.on("error", (err) => {
      console.error("Auto-updater error:", err);
      this.updateAvailable = false;
      this.updateDownloaded = false;

      // Don't show dialog for network errors or other non-critical errors
      if (
        err.message &&
        (err.message.includes("net::") ||
          err.message.includes("ENOTFOUND") ||
          err.message.includes("timeout"))
      ) {
        console.log("Network-related update error, will retry later");
        return;
      }

      // Show dialog for other errors
      dialog
        .showMessageBox({
          type: "error",
          title: "Update Error",
          message: "An error occurred while checking for updates",
          detail: err.message,
          buttons: ["OK"],
        })
        .catch(console.error);
    });

    autoUpdater.on("download-progress", (progressObj) => {
      console.log("Download progress:", {
        percent: Math.round(progressObj.percent),
        bytesPerSecond: this.formatBytes(progressObj.bytesPerSecond),
        transferred: this.formatBytes(progressObj.transferred),
        total: this.formatBytes(progressObj.total),
      });

      // Emit progress to renderer if needed
      if (global.mainWindow && !global.mainWindow.isDestroyed()) {
        global.mainWindow.webContents.send(
          "update-download-progress",
          progressObj
        );
      }
    });

    autoUpdater.on("update-downloaded", (info) => {
      console.log("Update downloaded and ready to install:", {
        version: info.version,
        releaseDate: info.releaseDate,
      });
      this.updateAvailable = false;
      this.updateDownloaded = true;
      this.onUpdateDownloaded(info);

      // Notify renderer
      if (global.mainWindow && !global.mainWindow.isDestroyed()) {
        global.mainWindow.webContents.send("update-downloaded", info);
      }
    });

    console.log("Auto-updater event handlers configured");
  }

  async onUpdateAvailable(info) {
    try {
      console.log("Showing update available dialog for version:", info.version);

      const { response } = await dialog.showMessageBox({
        type: "info",
        title: "Update Available",
        message: `A new version ${info.version} is available!`,
        detail:
          "Would you like to download and install it now? The application will restart after installation.",
        buttons: ["Download Update", "Later"],
        defaultId: 0,
        cancelId: 1,
      });

      if (response === 0) {
        console.log("User chose to download update");
        this.downloadUpdate();
      } else {
        console.log("User postponed update download");
      }
    } catch (error) {
      console.error("Error showing update available dialog:", error);
    }
  }

  async onUpdateDownloaded(info) {
    try {
      console.log("Showing update ready dialog for version:", info.version);

      const { response } = await dialog.showMessageBox({
        type: "info",
        title: "Update Ready",
        message: "The update has been downloaded and is ready to install.",
        detail: `Version ${info.version} will be installed. The application will restart automatically. Save any unsaved work before proceeding.`,
        buttons: ["Install and Restart", "Later"],
        defaultId: 0,
        cancelId: 1,
      });

      if (response === 0) {
        console.log("User chose to install update and restart");
        this.installUpdate();
      } else {
        console.log("User postponed update installation");
        // Update will be installed on next app restart due to autoInstallOnAppQuit = true
      }
    } catch (error) {
      console.error("Error showing update ready dialog:", error);
    }
  }

  downloadUpdate() {
    if (!this.initialized) {
      console.error("Cannot download update - auto-updater not initialized");
      return false;
    }

    try {
      console.log("Starting update download...");
      autoUpdater.downloadUpdate();
      return true;
    } catch (error) {
      console.error("Error starting update download:", error);
      dialog
        .showMessageBox({
          type: "error",
          title: "Download Error",
          message: "Failed to start update download",
          detail: error.message,
          buttons: ["OK"],
        })
        .catch(console.error);
      return false;
    }
  }

  installUpdate() {
    if (!this.initialized) {
      console.error("Cannot install update - auto-updater not initialized");
      return false;
    }

    if (!this.updateDownloaded) {
      console.error("Cannot install update - no update downloaded");
      dialog
        .showMessageBox({
          type: "warning",
          title: "Update Not Ready",
          message: "No update has been downloaded yet.",
          buttons: ["OK"],
        })
        .catch(console.error);
      return false;
    }

    try {
      console.log("Installing update and restarting application...");

      // Give a brief moment for the dialog to close
      setTimeout(() => {
        autoUpdater.quitAndInstall(true, true);
      }, 1000);

      return true;
    } catch (error) {
      console.error("Error installing update:", error);
      dialog
        .showMessageBox({
          type: "error",
          title: "Installation Error",
          message: "Failed to install update",
          detail: error.message,
          buttons: ["OK"],
        })
        .catch(console.error);
      return false;
    }
  }

  checkForUpdates() {
    if (!this.initialized) {
      console.warn("Cannot check for updates - auto-updater not initialized");
      return Promise.resolve({
        status: "error",
        message: "Auto-updater not initialized",
      });
    }

    return new Promise((resolve) => {
      console.log("Manual update check requested");

      // Set timeout to avoid hanging
      const timeout = setTimeout(() => {
        cleanup();
        console.warn("Update check timed out");
        resolve({
          status: "error",
          message: "Update check timed out",
        });
      }, 30000); // 30 second timeout

      const cleanup = () => {
        clearTimeout(timeout);
        autoUpdater.removeListener("update-available", onUpdateAvailable);
        autoUpdater.removeListener(
          "update-not-available",
          onUpdateNotAvailable
        );
        autoUpdater.removeListener("error", onError);
      };

      const onUpdateAvailable = (info) => {
        console.log("Manual check: Update available", info.version);
        cleanup();
        resolve({
          status: "update-available",
          version: info.version,
          message: `Update available: ${info.version}`,
        });
      };

      const onUpdateNotAvailable = (info) => {
        console.log("Manual check: No updates available");
        cleanup();
        resolve({
          status: "update-not-available",
          version: info?.version,
          message: "You are using the latest version",
        });
      };

      const onError = (err) => {
        console.error("Manual check: Error", err);
        cleanup();
        resolve({
          status: "error",
          message: `Update check failed: ${err.message}`,
        });
      };

      // Set up one-time listeners
      autoUpdater.once("update-available", onUpdateAvailable);
      autoUpdater.once("update-not-available", onUpdateNotAvailable);
      autoUpdater.once("error", onError);

      // Start the update check
      autoUpdater.checkForUpdates().catch((err) => {
        console.error("Manual check: checkForUpdates error", err);
        cleanup();
        resolve({
          status: "error",
          message: `Update check failed: ${err.message}`,
        });
      });
    });
  }

  // Utility method to format bytes for display
  formatBytes(bytes) {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }

  // Get current update status
  getStatus() {
    return {
      initialized: this.initialized,
      isDev: this.isDev,
      isPackaged: this.isPackaged,
      updateAvailable: this.updateAvailable,
      updateDownloaded: this.updateDownloaded,
      currentVersion: app.getVersion(),
    };
  }

  // Check if auto-updater is available
  isAvailable() {
    return this.initialized && this.isPackaged && !this.isDev;
  }
}

module.exports = AutoUpdater;
