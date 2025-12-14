// src/main/auto-updater.js
const { autoUpdater } = require("electron-updater");
const { app } = require("electron");

class AutoUpdater {
  constructor(windowManager) {
    this.initialized = false;
    this.isDev = process.env.NODE_ENV === "development";
    this.isPackaged = app.isPackaged;
    this.updateAvailable = false;
    this.updateDownloaded = false;
    this.currentVersion = app.getVersion();
    this.updateInfo = null;
    this.downloadProgress = 0;
    this.windowManager = windowManager;
    this.userRequestedCheck = false;
  }

  init(licenseKey = null) {
    try {
      console.log("🚀 Initializing auto-updater...");
      console.log("Configuration:", {
        isDev: this.isDev,
        isPackaged: this.isPackaged,
        currentVersion: this.currentVersion,
        licenseKey: licenseKey ? "Provided" : "None"
      });

      // Disable in development
      if (this.isDev) {
        console.log("Auto-updater disabled in development mode");
        this.initialized = false;
        return;
      }

      if (!this.isPackaged) {
        console.log("Auto-updater disabled for unpackaged app");
        this.initialized = false;
        return;
      }

      if (typeof autoUpdater === "undefined") {
        console.warn("Auto-updater not available");
        this.initialized = false;
        return;
      }

      // Configure for GitHub releases
      const configured = this.configureGitHubUpdater();
      if (!configured) {
        console.warn("GitHub updater configuration failed");
        this.initialized = false;
        return;
      }

      // Set up event handlers
      this.setupEventHandlers();

      this.initialized = true;
      console.log("✅ Auto-updater initialized for GitHub releases");

      // Check for updates after a delay (only if licensed)
      if (licenseKey) {
        setTimeout(() => {
          this.checkForUpdates(false); // false = automatic check
        }, 10000);
      }
    } catch (error) {
      console.error("❌ Failed to initialize auto-updater:", error);
      this.initialized = false;
    }
  }

  configureGitHubUpdater() {
    try {
      // For GitHub releases, we need to configure it properly
      const owner = "Enoch-Lugobwa";
      const repo = "endo-stat";

      console.log("Configuring GitHub updater for:", { owner, repo });

      // GitHub configuration for electron-updater
      autoUpdater.setFeedURL({
        provider: "github",
        owner: owner,
        repo: repo,
      });

      // Configure auto-updater behavior
      autoUpdater.autoDownload = false; // Let user choose when to download
      autoUpdater.allowPrerelease = false;
      autoUpdater.autoInstallOnAppQuit = true;
      autoUpdater.fullChangelog = true;

      // Add request headers for GitHub API
      autoUpdater.requestHeaders = {
        "User-Agent": `EndoStat/${this.currentVersion}`,
      };

      console.log("GitHub updater configured successfully");
      return true;
    } catch (error) {
      console.error("Error configuring GitHub updater:", error);
      return false;
    }
  }

  setupEventHandlers() {
    // Store original listeners
    this.eventHandlers = {};

    autoUpdater.on("checking-for-update", () => {
      console.log("🔍 Checking for updates on GitHub...");
      this.emitEvent("checking-for-update");
    });

    autoUpdater.on("update-available", (info) => {
      console.log("📦 Update available:", info.version);
      this.updateAvailable = true;
      this.updateDownloaded = false;
      this.updateInfo = info;
      this.downloadProgress = 0;

      this.emitEvent("update-available", info);
    });

    autoUpdater.on("update-not-available", (info) => {
      console.log("✅ No updates available");
      this.updateAvailable = false;
      this.updateInfo = null;

      this.emitEvent("update-not-available", info);
    });

    autoUpdater.on("download-progress", (progress) => {
      this.downloadProgress = Math.round(progress.percent || 0);
      console.log(`📥 Download progress: ${this.downloadProgress}%`);

      this.emitEvent("download-progress", progress);
    });

    autoUpdater.on("update-downloaded", (info) => {
      console.log("🎉 Update downloaded successfully:", info.version);
      this.updateDownloaded = true;
      this.updateAvailable = false;

      this.emitEvent("update-downloaded", info);
    });

    autoUpdater.on("error", (err) => {
      console.error("❌ Update error:", err.message || err);
      
      // Provide more user-friendly error messages
      let userMessage = err.message || "Update failed";
      if (err.message && err.message.includes("404")) {
        userMessage = "Update server not found. Please check your internet connection.";
      } else if (err.message && err.message.includes("rate limit")) {
        userMessage = "GitHub rate limit exceeded. Please try again later.";
      } else if (err.message && err.message.includes("net")) {
        userMessage = "Network error. Please check your internet connection.";
      }

      this.emitEvent("error", { message: userMessage, originalError: err.message });
    });
  }

  // Emit events to renderer processes
  emitEvent(eventName, data) {
    if (!this.windowManager) {
      console.log(`No window manager to emit event: ${eventName}`);
      return;
    }

    try {
      // Send to all windows
      this.windowManager.windows.forEach((window) => {
        if (window && !window.isDestroyed()) {
          const safeData = this.safeSerialize(data);
          window.webContents.send(`auto-updater:${eventName}`, safeData);
        }
      });
      console.log(`📤 Event emitted: ${eventName}`);
    } catch (error) {
      console.error(`Error emitting event ${eventName}:`, error);
    }
  }

  safeSerialize(data) {
    try {
      if (!data) return {};
      
      // Create a safe object with only serializable properties
      const safeData = {};
      
      if (typeof data === 'object') {
        for (const [key, value] of Object.entries(data)) {
          // Skip non-serializable properties
          if (value === undefined || typeof value === 'function') continue;
          
          if (value && typeof value === 'object' && value.constructor) {
            // Handle specific object types
            if (value.constructor.name === 'Date') {
              safeData[key] = value.toISOString();
            } else if (Array.isArray(value)) {
              safeData[key] = value.map(item => 
                typeof item === 'object' ? this.safeSerialize(item) : item
              );
            } else if (value.constructor.name === 'Object') {
              safeData[key] = this.safeSerialize(value);
            } else {
              // Convert other objects to string representation
              safeData[key] = String(value);
            }
          } else {
            safeData[key] = value;
          }
        }
      }
      
      return safeData;
    } catch (error) {
      console.error("Error serializing data:", error);
      return { message: "Data serialization error" };
    }
  }

  // Check for updates (with userRequested parameter)
  async checkForUpdates(userRequested = false) {
    this.userRequestedCheck = userRequested;

    if (!this.initialized) {
      console.log("Auto-updater not initialized");
      return {
        status: "error",
        message: "Auto-updater not initialized",
      };
    }

    try {
      console.log("Starting update check...");
      await autoUpdater.checkForUpdates();
      
      // Return a default response since electron-updater doesn't return the check result directly
      return {
        status: "checked",
        message: "Update check completed",
        userRequested: userRequested
      };
    } catch (error) {
      console.error("Update check error:", error);
      
      let userMessage = error.message || "Update check failed";
      if (error.message && error.message.includes("404")) {
        userMessage = "No updates found or repository not accessible";
      }
      
      return {
        status: "error",
        message: userMessage,
        error: error.message
      };
    }
  }

  downloadUpdate() {
    if (!this.initialized) {
      console.error("Cannot download update - auto-updater not initialized");
      return false;
    }

    if (!this.updateAvailable) {
      console.error("No update available to download");
      return false;
    }

    try {
      console.log("Starting update download...");
      autoUpdater.downloadUpdate();
      return true;
    } catch (error) {
      console.error("Error starting download:", error);
      this.emitEvent("error", { message: `Download failed: ${error.message}` });
      return false;
    }
  }

  installUpdate() {
    if (!this.initialized || !this.updateDownloaded) {
      console.error("Cannot install update - no update downloaded");
      return false;
    }

    try {
      console.log("Installing update and restarting...");
      
      // Give a small delay to ensure the message is sent
      setTimeout(() => {
        autoUpdater.quitAndInstall(true, true);
      }, 1000);
      
      return true;
    } catch (error) {
      console.error("Error installing update:", error);
      this.emitEvent("error", { message: `Installation failed: ${error.message}` });
      return false;
    }
  }

  getStatus() {
    return {
      initialized: this.initialized,
      updateAvailable: this.updateAvailable,
      updateDownloaded: this.updateDownloaded,
      currentVersion: this.currentVersion,
      updateInfo: this.updateInfo ? {
        version: this.updateInfo.version,
        releaseDate: this.updateInfo.releaseDate,
        releaseName: this.updateInfo.releaseName
      } : null,
      downloadProgress: this.downloadProgress,
      isDev: this.isDev,
      isPackaged: this.isPackaged,
    };
  }

  // Cleanup method
  cleanup() {
    if (this.eventHandlers) {
      Object.keys(this.eventHandlers).forEach(eventName => {
        autoUpdater.removeAllListeners(eventName);
      });
    }
  }
}

module.exports = AutoUpdater;