const { app, ipcMain, dialog } = require("electron");
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
    clearInvalidConfig: true, // This will clear corrupted config
  });
} catch (error) {
  console.error("Store initialization failed, creating new store:", error);
  // If store is corrupted, create a new one
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

const isDev = process.env.NODE_ENV === "development";

class EndoStatApp {
  constructor() {
    this.licenseManager = new LicenseManager(store);
    this.windowManager = new WindowManager();
    this.database = new Database();
    this.autoUpdater = new AutoUpdater();

    this.init();
  }

  init() {
    this.setupAppEvents();
    this.setupIpcHandlers();
  }

  setupAppEvents() {
    app.whenReady().then(() => this.onAppReady());
    app.on("window-all-closed", () => this.onWindowAllClosed());
    app.on("activate", () => this.onAppActivate());
    app.on("before-quit", () => this.onBeforeQuit());
  }

  async onAppReady() {
    try {
      console.log("Initializing Endo-Stat application...");

      // Initialize database
      await this.database.init();

      await this.testBcryptDirectly();
      await this.testDatabaseConnection();

      // Use strict license validation
      const validationResult =
        await this.licenseManager.performStrictLicenseValidation();

      if (validationResult.valid) {
        console.log("License valid, launching application...");
        await this.launchApplication();
      } else {
        console.log("License validation failed:", validationResult.reason);

        if (validationResult.requiresReactivation) {
          // Show specific message for machine limit or ownership issues
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

        console.log("Showing license gate...");
        await this.showLicenseGate();
      }
    } catch (error) {
      console.error("App initialization failed:", error);
      this.showErrorScreen(
        `Application failed to initialize: ${error.message}`
      );
    }
  }

  async debugLicenseStatus() {
    try {
      console.log("=== DEBUG LICENSE STATUS ===");
      const status = await window.electronAPI.getLicenseStatus();
      console.log("Raw license status:", status);

      if (status && status.valid) {
        console.log("✅ License is valid");
        if (status.expiresAt) {
          const expiresAt = new Date(status.expiresAt);
          const now = new Date();
          const daysLeft = Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24));
          console.log("📅 Expires at:", status.expiresAt);
          console.log("📅 Local expires at:", expiresAt);
          console.log("📅 Today:", now);
          console.log("⏰ Days left:", daysLeft);
          console.log("📝 Expiry date valid:", !isNaN(expiresAt.getTime()));
        } else {
          console.log("📅 No expiry date (perpetual license)");
        }
      } else {
        console.log("❌ License is invalid or missing");
      }
    } catch (error) {
      console.error("Debug license error:", error);
    }
  }

  async launchApplication() {
    try {
      // Show splash screen
      await this.windowManager.showSplashScreen();

      // Initialize auto-updater (only in production) with error handling
      if (!isDev) {
        try {
          const licenseKey = store.get("license.key");
          this.autoUpdater.init(licenseKey);
        } catch (error) {
          console.warn(
            "Auto-updater initialization failed, continuing without updates:",
            error.message
          );
          // Continue without auto-updater - it's not critical
        }
      }
      // Load login screen after splash
      setTimeout(() => {
        try {
          this.windowManager.createLoginWindow();
          this.windowManager.closeSplashScreen();
        } catch (error) {
          console.error("Failed to create login window:", error);
          this.showErrorScreen("Failed to create login window");
        }
      }, 3000);
    } catch (error) {
      console.error("Failed to launch application:", error);
      this.showErrorScreen("Failed to launch application: " + error.message);
    }
  }

  async showLicenseGate() {
    try {
      await this.windowManager.showLicenseGate();

      // Listen for license validation
      ipcMain.handle("validate-license", async (event, licenseKey) => {
        const result = await this.licenseManager.validateNewLicense(licenseKey);

        // If machine limit exceeded, show specific error
        if (result.code === "MACHINE_LIMIT_EXCEEDED") {
          result.userMessage =
            "This license is already activated on another device. You can only use this license on one machine at a time.";
        }

        return result;
      });
    } catch (error) {
      console.error("Failed to show license gate:", error);
      this.showErrorScreen("Failed to load license verification");
    }
  }

  async verifyUserCredentials(username, password) {
    try {
      console.log("🔐 === STARTING CREDENTIAL VERIFICATION ===");
      console.log("📧 Username received:", username);
      console.log("🔑 Password received:", password ? "***" : "undefined");

      // Query user from database
      const query =
        "SELECT * FROM users WHERE username = ? AND is_active = TRUE";
      console.log("📊 Executing query:", query);

      const users = await this.database.executeQuery(query, [username]);
      console.log("✅ Query completed. Results found:", users.length);

      if (users.length === 0) {
        console.log("❌ No user found with username:", username);
        return null;
      }

      const user = users[0];
      console.log("👤 User found:", {
        id: user.id,
        username: user.username,
        full_name: user.full_name,
        hasPasswordHash: !!user.password_hash,
        passwordHashLength: user.password_hash ? user.password_hash.length : 0,
      });

      // Verify password using synchronous bcrypt compare
      console.log("🔍 Starting password comparison...");

      const bcrypt = require("bcryptjs");
      console.log("🔧 bcrypt module loaded");

      console.log("📝 Stored hash:", user.password_hash);
      console.log("📝 Input password:", password);

      const isPasswordValid = bcrypt.compareSync(password, user.password_hash);
      console.log("🎯 Password comparison result:", isPasswordValid);

      if (isPasswordValid) {
        console.log("🎉 Login successful for user:", user.username);
        return {
          id: user.id,
          username: user.username,
          full_name: user.full_name,
          role: user.role,
        };
      }

      console.log("❌ Invalid password for user:", user.username);
      return null;
    } catch (error) {
      console.error("💥 Credential verification error:", error);
      console.error("📋 Error details:", {
        message: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }
  async testBcryptDirectly() {
    try {
      console.log("🧪 === TESTING BCRYPT DIRECTLY ===");

      const bcrypt = require("bcryptjs");
      const testPassword = "admin";
      const storedHash =
        "$2b$10$NaCM3TV93U7wFEP1/3UZreRIVBYkJiUeGntUJ1CfTA6CbXh4Jm8nS";

      console.log("🔑 Test password:", testPassword);
      console.log("📝 Stored hash:", storedHash);

      const isValid = bcrypt.compareSync(testPassword, storedHash);
      console.log("🎯 Direct bcrypt test result:", isValid);

      // Also test with a new hash
      const newHash = bcrypt.hashSync("admin", 10);
      console.log("🆕 New hash for 'admin':", newHash);
      const isValidNew = bcrypt.compareSync("admin", newHash);
      console.log("🎯 New hash test result:", isValidNew);
    } catch (error) {
      console.error("❌ Bcrypt test failed:", error);
    }
  }

  async testDatabaseConnection() {
    try {
      console.log("=== TESTING DATABASE CONNECTION ===");

      // Test basic query
      const testQuery = "SELECT name FROM sqlite_master WHERE type='table'";
      const tables = await this.database.executeQuery(testQuery);
      console.log("Database tables:", tables);

      // Test users table specifically
      const usersTable = await this.database.executeQuery(
        "SELECT * FROM sqlite_master WHERE type='table' AND name='users'"
      );
      console.log("Users table exists:", usersTable.length > 0);

      if (usersTable.length > 0) {
        const allUsers = await this.database.executeQuery(
          "SELECT * FROM users"
        );
        console.log("All users in database:", allUsers);

        // Check the admin user specifically
        const adminUser = await this.database.executeQuery(
          "SELECT * FROM users WHERE username = 'admin'"
        );
        console.log("Admin user details:", adminUser);

        if (adminUser.length > 0) {
          console.log("Admin user password hash:", adminUser[0].password_hash);
        }
      }
    } catch (error) {
      console.error("Database test failed:", error);
    }
  }
  onWindowAllClosed() {
    if (process.platform !== "darwin") {
      app.quit();
    }
  }

  onAppActivate() {
    if (this.windowManager.getWindowCount() === 0) {
      this.launchApplication();
    }
  }

  onBeforeQuit() {
    // Cleanup resources
    if (this.database) {
      this.database.close();
    }
  }

  setupIpcHandlers() {
    // Database operations
    ipcMain.handle("db-query", async (event, query, params) => {
      try {
        return await this.database.executeQuery(query, params);
      } catch (error) {
        console.error("Database query error:", error);
        throw error;
      }
    });

    ipcMain.handle("user-login", async (event, username, password) => {
      try {
        console.log("🚀 === LOGIN ATTEMPT STARTED ===");
        console.log("📧 Login attempt for user:", username);

        // Basic validation
        if (!username || !password) {
          console.log("❌ Missing username or password");
          return {
            success: false,
            error: "Username and password are required",
          };
        }

        console.log("🔐 Starting credential verification...");
        const user = await this.verifyUserCredentials(username, password);

        if (user) {
          console.log("✅ Credentials verified, storing user session...");

          // Store user session
          store.set("user.session", {
            id: user.id,
            username: user.username,
            fullName: user.full_name,
            role: user.role,
            loggedIn: true,
            loginTime: new Date().toISOString(),
          });

          console.log("💾 User session stored successfully");
          console.log("🎉 Login process completed successfully");
          return { success: true, user: user };
        } else {
          console.log("❌ Invalid credentials");
          return { success: false, error: "Invalid username or password" };
        }
      } catch (error) {
        console.error("💥 Login handler error:", error);
        console.error("📋 Error stack:", error.stack);
        return { success: false, error: "Login failed: " + error.message };
      }
    });

    ipcMain.handle("user-logout", async (event) => {
      try {
        // Clear user session
        store.delete("user.session");
        return { success: true };
      } catch (error) {
        console.error("Logout error:", error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle("get-user-session", async (event) => {
      return store.get("user.session") || null;
    });

    ipcMain.on("logout-successful", async () => {
      console.log("User logged out, switching to login window...");
      try {
        const mainWindow = this.windowManager.windows.get("main");
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.close();
          this.windowManager.windows.delete("main");
        }
        await this.windowManager.createLoginWindow();
      } catch (error) {
        console.error("Failed to switch to login window:", error);
      }
    });

    // Handle successful login - switch to main window
    ipcMain.on("login-successful", async () => {
      console.log("Login successful, switching to main application...");

      try {
        await this.windowManager.createMainWindowAfterLogin();
      } catch (error) {
        console.error("Failed to switch to main window after login:", error);
        this.showErrorScreen("Failed to load main application");
      }
    });

    // Window management
    ipcMain.handle("create-child-window", (event, options) => {
      return this.windowManager.createChildWindow(options);
    });

    // Application state
    ipcMain.handle("get-app-version", () => {
      return app.getVersion();
    });

    ipcMain.handle("get-license-status", () => {
      return this.licenseManager.getLicenseStatus();
    });

    // Store operations
    ipcMain.handle("store-get", (event, key) => {
      return store.get(key);
    });

    ipcMain.handle("store-set", (event, key, value) => {
      store.set(key, value);
    });

    ipcMain.handle("store-delete", (event, key) => {
      store.delete(key);
    });

    // License activation handler
    ipcMain.on("license-activated", async () => {
      console.log("License activated, launching application...");

      // Close license gate window
      const licenseGateWindow = this.windowManager.windows.get("license-gate");
      if (licenseGateWindow && !licenseGateWindow.isDestroyed()) {
        licenseGateWindow.close();
        this.windowManager.windows.delete("license-gate");
      }

      // Launch main application
      await this.launchApplication();
    });

    // License gate close handler
    ipcMain.on("close-license-gate", () => {
      const licenseGateWindow = this.windowManager.windows.get("license-gate");
      if (licenseGateWindow && !licenseGateWindow.isDestroyed()) {
        licenseGateWindow.close();
        this.windowManager.windows.delete("license-gate");
      }
    });

    ipcMain.handle("debug-machine-info", () => {
      const machineId = require("node-machine-id").machineIdSync();
      const registration = store.get("machine.registration");
      return {
        machineId,
        registration,
        licenseKey: store.get("license.key"),
      };
    });

    // Add this with your other ipcMain handlers
    ipcMain.handle("open-external", async (event, url) => {
      try {
        await shell.openExternal(url);
        return { success: true };
      } catch (error) {
        console.error("Failed to open external URL:", error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle("check-for-updates", () => {
      if (this.autoUpdater && this.autoUpdater.initialized) {
        this.autoUpdater.checkForUpdates();
        return { checking: true };
      }
      return { checking: false, error: "Auto-updater not initialized" };
    });

    // Manual update handler
    ipcMain.handle("check-for-updates-manually", async () => {
      try {
        console.log("Manual update check requested via IPC");

        if (!this.autoUpdater || !this.autoUpdater.initialized) {
          console.log("Auto-updater not initialized");
          return {
            status: "error",
            message: "Auto-updater not available in development mode",
          };
        }

        const { autoUpdater } = require("electron-updater");

        console.log("Starting manual update check...");

        return new Promise((resolve) => {
          // Set timeout to avoid hanging
          const timeout = setTimeout(() => {
            cleanup();
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
            console.log("Update available:", info.version);
            cleanup();
            resolve({
              status: "update-available",
              version: info.version,
              message: `Update available: ${info.version}`,
            });
          };

          const onUpdateNotAvailable = (info) => {
            console.log("No updates available");
            cleanup();
            resolve({
              status: "update-not-available",
              version: info?.version,
              message: "You are using the latest version",
            });
          };

          const onError = (err) => {
            console.error("Update check error:", err);
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
            console.error("checkForUpdates error:", err);
            cleanup();
            resolve({
              status: "error",
              message: `Update check failed: ${err.message}`,
            });
          });
        });
      } catch (error) {
        console.error("Manual update check error:", error);
        return {
          status: "error",
          message: `Update check failed: ${error.message}`,
        };
      }
    });

    // Trigger update download and install
    ipcMain.handle("download-and-install-update", async () => {
      try {
        const { autoUpdater } = require("electron-updater");
        if (autoUpdater) {
          console.log("Downloading and installing update...");
          autoUpdater.downloadUpdate();
          return { success: true, message: "Update download started" };
        }
        return { success: false, message: "Auto-updater not available" };
      } catch (error) {
        console.error("Download update error:", error);
        return { success: false, message: error.message };
      }
    });
  }

  showErrorScreen(message) {
    this.windowManager.showErrorScreen(message);
  }
}

// Start the application
try {
  new EndoStatApp();
} catch (error) {
  console.error("Fatal error starting application:", error);
  dialog.showErrorBox(
    "Fatal Error",
    `Failed to start Endo-Stat: ${error.message}`
  );
  app.quit();
}
