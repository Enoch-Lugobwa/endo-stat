// src/main/main.js
const { app, ipcMain, dialog, BrowserWindow } = require("electron");
const path = require("path");
const unhandled = require("electron-unhandled");
const Store = require("electron-store");
const { shell } = require("electron");

// Initialize error handling first
unhandled();

// Initialize store with better error handling
let store;
try {
  store = new Store({
    encryptionKey: "your-encryption-key-here",
    clearInvalidConfig: true,
  });
} catch (error) {
  console.error("Store initialization failed, creating new store:", error);
  const Store = require("electron-store");
  store = new Store({
    encryptionKey: "your-encryption-key-here",
    clearInvalidConfig: true,
  });
}

// Custom modules
const LicenseManager = require("./license-manager");
const AutoUpdater = require("./auto-updater");
const WindowManager = require("./window-manager");
const Database = require("../database/database");
const IpcHandlers = require("./ipcHandlers");

const isDev = process.env.NODE_ENV === "development";

class EndoStatApp {
  constructor() {
    this.licenseManager = new LicenseManager(store);
    this.windowManager = new WindowManager();
    this.database = new Database();
    this.autoUpdater = null; // Will be initialized later
    this.ipcHandlers = null;
    this.mainWindow = null;

    this.init();
  }

  init() {
    this.setupAppEvents();
  }

  setupAppEvents() {
    app.whenReady().then(() => this.onAppReady());
    app.on("window-all-closed", () => this.onWindowAllClosed());
    app.on("activate", () => this.onAppActivate());
    app.on("before-quit", () => this.onBeforeQuit());

    // Add updater event handlers
    this.setupUpdaterEvents();
  }

  setupUpdaterEvents() {
    // Listen for when main window is created
    app.on("browser-window-created", (event, window) => {
      if (window && window.id === this.windowManager.windows.get("main")?.id) {
        this.mainWindow = window;
        console.log("Main window created, updating auto-updater reference");

        // Update auto-updater with main window reference if available
        if (this.autoUpdater && this.autoUpdater.setMainWindow) {
          this.autoUpdater.setMainWindow(window);
        }
      }
    });
  }

  async onAppReady() {
    try {
      console.log("🚀 Initializing Endo-Stat application...");

      // Initialize database
      console.log("📊 Initializing database...");
      await this.database.init();

      // Initialize auto-updater EARLY
      console.log("🔄 Initializing auto-updater...");
      this.initializeAutoUpdater();

      // Initialize IPC handlers AFTER database is ready
      console.log("🔌 Setting up IPC handlers...");
      this.ipcHandlers = new IpcHandlers(
        app,
        this.database,
        store,
        this.licenseManager,
        this.windowManager,
        this.autoUpdater
      );
      this.ipcHandlers.setupAllHandlers();

      // Run tests
      await this.testBcryptDirectly();
      await this.testDatabaseConnection();

      // Use strict license validation
      console.log("🔐 Validating license...");
      const validationResult =
        await this.licenseManager.performStrictLicenseValidation();

      if (validationResult.valid) {
        console.log("✅ License valid, launching application...");
        await this.launchApplication();
      } else {
        console.log("❌ License validation failed:", validationResult.reason);

        if (validationResult.requiresReactivation) {
          dialog.showMessageBox({
            type: "error",
            title: "License Activation Failed",
            message: "License Activation Issue",
            detail:
              validationResult.reason +
              ". Please contact support if you believe this is an error.",
            buttons: ["OK"],
          });
        }

        console.log("🔒 Showing license gate...");
        await this.showLicenseGate();
      }
    } catch (error) {
      console.error("💥 App initialization failed:", error);
      this.showErrorScreen(
        `Application failed to initialize: ${error.message}`
      );
    }
  }

  initializeAutoUpdater() {
    try {
      console.log("🔄 Initializing auto-updater...");

      // Better way to check if we should enable auto-updater
      const isDevelopment = process.env.NODE_ENV === "development";
      const isPackaged = app.isPackaged;

      console.log("📋 Auto-updater config check:", {
        isDev: isDevelopment,
        isPackaged: isPackaged,
        appPath: app.getAppPath(),
        exePath: process.execPath,
        currentVersion: app.getVersion(),
      });

      // Check if we're in a development environment
      if (isDevelopment) {
        console.log("🚫 Auto-updater disabled in development mode");
        this.autoUpdater = this.createStubAutoUpdater("development");
        return;
      }

      // Check if we're running from source vs packaged
      // Better check: if running from node_modules/.bin/electron, it's dev
      const isRunningFromElectronBin =
        process.execPath.includes("node_modules") &&
        process.execPath.includes("electron");
      const isRunningFromApp = app.getAppPath().includes("app.asar");

      console.log("📋 Running from checks:", {
        isRunningFromElectronBin,
        isRunningFromApp,
        execPath: process.execPath,
        appPath: app.getAppPath(),
      });

      if (isRunningFromElectronBin && !isRunningFromApp) {
        console.log("🚫 Auto-updater disabled for unpackaged app");
        this.autoUpdater = this.createStubAutoUpdater("unpackaged");
        return;
      }

      // Try to create the real auto-updater
      try {
        console.log("🔄 Attempting to create real auto-updater...");

        // Create auto-updater instance with window manager reference
        this.autoUpdater = new AutoUpdater(this.windowManager);

        console.log("✅ Auto-updater instance created, initializing...");

        // Initialize auto-updater with license key
        const licenseKey = store.get("license.key");
        console.log(
          "📋 License key for auto-updater:",
          licenseKey ? "present" : "not found"
        );

        this.autoUpdater.init(licenseKey);

        console.log("✅ Auto-updater initialized successfully");

        // Test the auto-updater
        setTimeout(() => {
          this.testAutoUpdater();
        }, 5000);
      } catch (autoUpdaterError) {
        console.error(
          "❌ Failed to create auto-updater instance:",
          autoUpdaterError
        );
        this.autoUpdater = this.createStubAutoUpdater(
          "initialization-error",
          autoUpdaterError.message
        );
      }
    } catch (error) {
      console.error("❌ Failed to initialize auto-updater:", error);
      this.autoUpdater = this.createStubAutoUpdater(
        "fatal-error",
        error.message
      );
    }
  }

  // Add this test method
  testAutoUpdater() {
    if (this.autoUpdater && this.autoUpdater.checkForUpdates) {
      console.log("🧪 Testing auto-updater...");
      this.autoUpdater
        .checkForUpdates(false)
        .then((result) => {
          console.log("✅ Auto-updater test result:", result);
        })
        .catch((error) => {
          console.error("❌ Auto-updater test failed:", error);
        });
    }
  }

  createStubAutoUpdater(reason, errorMessage = "") {
    console.log(`📋 Creating stub auto-updater due to: ${reason}`);

    const stub = {
      initialized: false,
      setMainWindow: () => {
        console.log("📝 Stub auto-updater: setMainWindow called");
      },
      checkForUpdates: () => {
        console.log("🔍 Stub auto-updater: checkForUpdates called");
        return Promise.resolve({
          status: reason === "development" ? "disabled" : "error",
          message:
            reason === "development"
              ? "Auto-updater disabled in development mode"
              : `Auto-updater not available: ${reason}${
                  errorMessage ? ` (${errorMessage})` : ""
                }`,
        });
      },
      downloadUpdate: () => {
        console.log("📥 Stub auto-updater: downloadUpdate called");
        return false;
      },
      installUpdate: () => {
        console.log("⚡ Stub auto-updater: installUpdate called");
        return false;
      },
      getStatus: () => {
        return {
          initialized: false,
          isDev: isDev,
          isPackaged: app.isPackaged,
          currentVersion: app.getVersion(),
          disabledReason: reason,
          errorMessage: errorMessage,
        };
      },
      on: (eventName, callback) => {
        console.log(`🎧 Stub auto-updater: on(${eventName}) called`);
        // Store callback for potential future use
        if (!stub.listeners) {
          stub.listeners = {};
        }
        stub.listeners[eventName] = callback;
      },
      init: () => {
        console.log("🔧 Stub auto-updater: init called");
      },
    };

    return stub;
  }

  async debugLicenseStatus() {
    try {
      console.log("=== DEBUG LICENSE STATUS ===");
      const status = await window.electronAPI.getLicenseStatus();
      console.log("Raw license status:", status);
    } catch (error) {
      console.error("Debug license error:", error);
    }
  }

  async launchApplication() {
    try {
      console.log("🚀 Launching application...");

      // Show splash screen
      await this.windowManager.showSplashScreen();

      // Check if auto-updater needs main window reference
      if (this.autoUpdater && this.autoUpdater.setMainWindow) {
        console.log("📝 Setting main window reference in auto-updater...");
        // We'll set the main window when it's created via the browser-window-created event
      }

      // Load login screen after splash
      setTimeout(() => {
        try {
          console.log("🔐 Creating login window...");
          this.windowManager.createLoginWindow();
          this.windowManager.closeSplashScreen();
        } catch (error) {
          console.error("❌ Failed to create login window:", error);
          this.showErrorScreen("Failed to create login window");
        }
      }, 3000);
    } catch (error) {
      console.error("💥 Failed to launch application:", error);
      this.showErrorScreen("Failed to launch application: " + error.message);
    }
  }

  async showLicenseGate() {
    try {
      console.log("🔒 Showing license gate window...");
      await this.windowManager.showLicenseGate();
    } catch (error) {
      console.error("❌ Failed to show license gate:", error);
      this.showErrorScreen("Failed to load license verification");
    }
  }

  async testBcryptDirectly() {
    try {
      console.log("🧪 Testing bcrypt directly...");
      const bcrypt = require("bcryptjs");
      const testPassword = "admin";
      const storedHash =
        "$2b$10$NaCM3TV93U7wFEP1/3UZreRIVBYkJiUeGntUJ1CfTA6CbXh4Jm8nS";
      const isValid = bcrypt.compareSync(testPassword, storedHash);
      console.log(
        `🎯 Direct bcrypt test result: ${isValid ? "✅ PASS" : "❌ FAIL"}`
      );
    } catch (error) {
      console.error("❌ Bcrypt test failed:", error);
    }
  }

  async testDatabaseConnection() {
    try {
      console.log("📊 Testing database connection...");
      const tables = await this.database.executeQuery(
        "SELECT name FROM sqlite_master WHERE type='table'"
      );
      console.log(
        `✅ Database connection successful. Found ${tables.length} tables.`
      );
      console.log(
        "📋 Database tables:",
        tables.map((t) => t.name)
      );
    } catch (error) {
      console.error("❌ Database test failed:", error);
    }
  }

  onWindowAllClosed() {
    console.log("🚪 All windows closed");
    if (process.platform !== "darwin") {
      console.log("👋 Quitting application...");
      app.quit();
    }
  }

  onAppActivate() {
    console.log("🔓 App activated");
    if (this.windowManager.getWindowCount() === 0) {
      console.log("🔄 No windows open, launching application...");
      this.launchApplication();
    }
  }

  onBeforeQuit() {
    console.log("🧹 Cleaning up resources before quit...");

    // Cleanup database
    if (this.database) {
      try {
        this.database.close();
        console.log("✅ Database closed");
      } catch (error) {
        console.error("❌ Error closing database:", error);
      }
    }

    // Cleanup auto-updater if needed
    if (this.autoUpdater && this.autoUpdater.cleanup) {
      try {
        this.autoUpdater.cleanup();
        console.log("✅ Auto-updater cleaned up");
      } catch (error) {
        console.error("❌ Error cleaning up auto-updater:", error);
      }
    }
  }

  showErrorScreen(message) {
    console.error("🆘 Showing error screen:", message);
    try {
      this.windowManager.showErrorScreen(message);
    } catch (error) {
      console.error("❌ Failed to show error screen:", error);
      // Fallback: show dialog
      dialog.showErrorBox(
        "Critical Error",
        `${message}\n\n${error.message || "Unknown error"}`
      );
    }
  }
}

// Start the application
console.log("🎬 Starting Endo-Stat application...");
try {
  new EndoStatApp();
} catch (error) {
  console.error("💥 Fatal error starting application:", error);

  // Try to show error dialog
  try {
    dialog.showErrorBox(
      "Fatal Error",
      `Failed to start Endo-Stat:\n\n${error.message}\n\n${
        error.stack || "No stack trace available"
      }`
    );
  } catch (dialogError) {
    console.error("❌ Could not show error dialog:", dialogError);
  }

  // Exit the application
  app.quit();
}
