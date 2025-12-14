// src/main/ipcHandlers.js
const { ipcMain, dialog, shell } = require("electron");
const Store = require("electron-store");
const path = require("path");
const fs = require("fs").promises;
const fsSync = require("fs");

class IpcHandlers {
  constructor(
    app,
    database,
    store,
    licenseManager,
    windowManager,
    autoUpdater
  ) {
    this.app = app;
    this.database = database;
    this.store = store;
    this.licenseManager = licenseManager;
    this.windowManager = windowManager;
    this.autoUpdater = autoUpdater;
    this.isDev = process.env.NODE_ENV === "development";
  }

  setupAllHandlers() {
    this.setupAuthHandlers();
    this.setupDatabaseHandlers();
    this.setupUserManagementHandlers();
    this.setupSettingsHandlers();
    this.setupLicenseHandlers();
    this.setupWindowHandlers();
    this.setupUpdateHandlers();
    this.setupUtilityHandlers();
  }

  setupAuthHandlers() {
    // In setupUpdateHandlers() method
    ipcMain.handle("is-auto-update-available", async () => {
      try {
        console.log("🔍 Checking if auto-update is available");

        // For stub auto-updater (development/unpackaged mode)
        if (this.autoUpdater && this.autoUpdater.disabledReason) {
          return {
            available: true, // Still "available" but disabled for specific reason
            disabled: true,
            reason: this.autoUpdater.disabledReason,
            message: `Auto-updates ${
              this.autoUpdater.disabledReason === "development"
                ? "disabled in development mode"
                : "not available for unpackaged app"
            }`,
            isDev: this.isDev,
          };
        }

        // Check if we have a valid auto-updater instance
        if (!this.autoUpdater) {
          return {
            available: false,
            disabled: true,
            reason: "not-initialized",
            message: "Auto-updater not initialized",
            isDev: this.isDev,
          };
        }

        // For real auto-updater
        const isInitialized = this.autoUpdater.initialized || false;

        return {
          available: true, // Feature is available (even if no updates right now)
          disabled: !isInitialized,
          initialized: isInitialized,
          message: isInitialized
            ? "Auto-update feature available"
            : "Auto-updater not initialized",
          reason: isInitialized ? "available" : "not-initialized",
          isDev: this.isDev,
        };
      } catch (error) {
        console.error("Error checking auto-update availability:", error);
        return {
          available: false,
          disabled: true,
          reason: "error",
          message: `Error: ${error.message}`,
          isDev: this.isDev,
        };
      }
    });

    // Also add a handler for checking if in dev mode
    ipcMain.handle("is-dev", () => {
      return this.isDev;
    });

    // User login
    // Replace the user-login handler in setupAuthHandlers with this:
    ipcMain.handle("user-login", async (event, username, password) => {
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

      try {
        console.log("🔐 Starting credential verification...");
        const user = await this.verifyUserCredentials(username, password);

        if (user) {
          console.log("✅ Credentials verified, storing user session...");

          // Store user session
          this.store.set("user.session", {
            id: user.id,
            username: user.username,
            fullName: user.full_name,
            role: user.role,
            loggedIn: true,
            loginTime: new Date().toISOString(),
          });

          console.log("💾 User session stored successfully");

          // Create a clean, serializable response
          const response = {
            success: true,
            user: {
              id: user.id,
              username: user.username,
              fullName: user.full_name || user.fullName || "",
              role: user.role,
            },
          };

          // Test serialization
          try {
            const testJson = JSON.stringify(response);
            console.log("✅ Response serialization test passed:", testJson);
          } catch (serializeError) {
            console.error("❌ Response serialization failed:", serializeError);
            // Return a simpler response
            return {
              success: true,
              user: {
                id: user.id,
                username: user.username,
                role: user.role,
              },
            };
          }

          console.log("📤 Returning success response");
          console.log("🎉 Login process completed successfully");
          return response;
        } else {
          console.log("❌ Invalid credentials");
          return {
            success: false,
            error: "Invalid username or password",
          };
        }
      } catch (error) {
        console.error("💥 Login handler error:", error);
        console.error("📋 Error stack:", error.stack);

        // Return a safe error response
        return {
          success: false,
          error: "Login failed. Please try again.",
        };
      }
    });

    // User logout
    ipcMain.handle("user-logout", async (event) => {
      try {
        // Clear user session
        this.store.delete("user.session");
        return { success: true };
      } catch (error) {
        console.error("Logout error:", error);
        return { success: false, error: error.message };
      }
    });

    // Get user session
    ipcMain.handle("get-user-session", async (event) => {
      return this.store.get("user.session") || null;
    });

    // Logout successful
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

    // Login successful
    ipcMain.on("login-successful", async () => {
      console.log("Login successful, switching to main application...");
      try {
        await this.windowManager.createMainWindowAfterLogin();
      } catch (error) {
        console.error("Failed to switch to main window after login:", error);
        this.windowManager.showErrorScreen("Failed to load main application");
      }
    });
  }

  setupDatabaseHandlers() {
    // General database query
    ipcMain.handle("db-query", async (event, query, params) => {
      try {
        return await this.database.executeQuery(query, params);
      } catch (error) {
        console.error("Database query error:", error);
        throw error;
      }
    });

    // Get patients
    ipcMain.handle("get-patients", async (event, searchTerm = "") => {
      try {
        return this.database.getPatients(searchTerm);
      } catch (error) {
        console.error("Error getting patients:", error);
        throw error;
      }
    });

    // Add patient
    ipcMain.handle("add-patient", async (event, patientData) => {
      try {
        return this.database.addPatient(patientData);
      } catch (error) {
        console.error("Error adding patient:", error);
        return { success: false, error: error.message };
      }
    });

    // Database backup
    ipcMain.handle("backup-database", async () => {
      try {
        console.log("💾 Creating database backup");

        const dbPath = this.database.dbPath;
        const backupDir = path.join(
          this.app.getPath("documents"),
          "EndoStat Backups"
        );

        // Create backup directory if it doesn't exist
        if (!fsSync.existsSync(backupDir)) {
          fsSync.mkdirSync(backupDir, { recursive: true });
        }

        // Create backup filename with timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const backupPath = path.join(
          backupDir,
          `endostat-backup-${timestamp}.db`
        );

        // Copy database file
        await fs.copyFile(dbPath, backupPath);

        // Show success dialog
        const result = await dialog.showMessageBox({
          type: "info",
          title: "Backup Successful",
          message: `Database backup created successfully!`,
          detail: `Backup saved to:\n${backupPath}`,
          buttons: ["Open Folder", "OK"],
          defaultId: 1,
        });

        if (result.response === 0) {
          // Open backup folder
          shell.openPath(backupDir);
        }

        return { success: true, backupPath };
      } catch (error) {
        console.error("Error creating backup:", error);
        await dialog.showErrorBox(
          "Backup Failed",
          `Failed to create backup: ${error.message}`
        );
        return { success: false, error: error.message };
      }
    });

    // Restore database
    ipcMain.handle("restore-database", async (event, backupPath) => {
      try {
        console.log("🔄 Restoring database from backup");

        if (!backupPath) {
          // Show file dialog to select backup
          const result = await dialog.showOpenDialog({
            title: "Select Database Backup",
            filters: [
              {
                name: "Database Files",
                extensions: ["db", "sqlite", "sqlite3"],
              },
              { name: "All Files", extensions: ["*"] },
            ],
            properties: ["openFile"],
          });

          if (result.canceled) {
            return { success: false, error: "Operation cancelled" };
          }

          backupPath = result.filePaths[0];
        }

        // Confirm restore
        const confirmResult = await dialog.showMessageBox({
          type: "warning",
          title: "Confirm Restore",
          message: "Are you sure you want to restore from backup?",
          detail:
            "This will replace your current database with the backup. This action cannot be undone!",
          buttons: ["Cancel", "Restore"],
          defaultId: 0,
          cancelId: 0,
        });

        if (confirmResult.response !== 1) {
          return { success: false, error: "Restore cancelled" };
        }

        // Close current database connection
        this.database.close();

        // Backup current database first (just in case)
        const currentDbPath = this.database.dbPath;
        const backupCurrentPath = currentDbPath + ".before-restore";
        await fs.copyFile(currentDbPath, backupCurrentPath);

        // Copy backup to current database location
        await fs.copyFile(backupPath, currentDbPath);

        // Reinitialize database
        await this.database.init();

        await dialog.showMessageBox({
          type: "info",
          title: "Restore Successful",
          message: "Database restored successfully!",
          detail: "The application will continue with the restored database.",
          buttons: ["OK"],
        });

        return { success: true };
      } catch (error) {
        console.error("Error restoring database:", error);

        // Try to restore from backup if restore failed
        try {
          const backupCurrentPath = this.database.dbPath + ".before-restore";
          if (fsSync.existsSync(backupCurrentPath)) {
            await fs.copyFile(backupCurrentPath, this.database.dbPath);
            await this.database.init();
          }
        } catch (restoreError) {
          console.error("Failed to restore original database:", restoreError);
        }

        await dialog.showErrorBox(
          "Restore Failed",
          `Failed to restore database: ${error.message}`
        );
        return { success: false, error: error.message };
      }
    });

    // Clear database
    ipcMain.handle("clear-database", async () => {
      try {
        console.log("🗑️ Clearing database");

        // Confirm with user
        const confirmResult = await dialog.showMessageBox({
          type: "warning",
          title: "Confirm Clear Database",
          message: "Are you sure you want to clear all data?",
          detail:
            "This will delete ALL patients, examinations, and user data (except admin user). This action cannot be undone!",
          buttons: ["Cancel", "Clear All Data"],
          defaultId: 0,
          cancelId: 0,
        });

        if (confirmResult.response !== 1) {
          return { success: false, error: "Operation cancelled" };
        }

        // Get confirmation again with different message
        const confirmResult2 = await dialog.showMessageBox({
          type: "warning",
          title: "Final Warning",
          message: "This is your last chance to cancel!",
          detail:
            'Are you absolutely sure you want to delete ALL data? Type "DELETE" to confirm.',
          buttons: ["Cancel", "Confirm"],
          defaultId: 0,
          cancelId: 0,
        });

        if (confirmResult2.response !== 1) {
          return { success: false, error: "Operation cancelled" };
        }

        // Backup database first
        const backupDir = path.join(
          this.app.getPath("documents"),
          "EndoStat Backups"
        );
        if (!fsSync.existsSync(backupDir)) {
          fsSync.mkdirSync(backupDir, { recursive: true });
        }
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const backupPath = path.join(
          backupDir,
          `endostat-before-clear-${timestamp}.db`
        );
        await fs.copyFile(this.database.dbPath, backupPath);

        // Clear data (keep admin user and users table structure)
        this.database.executeQuery("DELETE FROM patients");
        this.database.executeQuery("DELETE FROM examinations");
        this.database.executeQuery("DELETE FROM images");
        this.database.executeQuery(
          "DELETE FROM users WHERE username != 'admin'"
        );

        // Reset admin user password
        const bcrypt = require("bcryptjs");
        const hashedPassword = bcrypt.hashSync("admin", 10);
        this.database.executeQuery(
          "UPDATE users SET password_hash = ? WHERE username = 'admin'",
          [hashedPassword]
        );

        // Vacuum database to reclaim space
        this.database.executeQuery("VACUUM");

        await dialog.showMessageBox({
          type: "info",
          title: "Database Cleared",
          message: "All data has been cleared successfully!",
          detail: `A backup was saved to:\n${backupPath}`,
          buttons: ["OK"],
        });

        return { success: true, backupPath };
      } catch (error) {
        console.error("Error clearing database:", error);
        await dialog.showErrorBox(
          "Clear Failed",
          `Failed to clear database: ${error.message}`
        );
        return { success: false, error: error.message };
      }
    });

    // Get database stats
    ipcMain.handle("get-database-stats", async () => {
      try {
        console.log("📊 Getting database stats");

        // Get counts from database
        const patientsCount = this.database.executeQuery(
          "SELECT COUNT(*) as count FROM patients"
        )[0].count;
        const usersCount = this.database.executeQuery(
          "SELECT COUNT(*) as count FROM users"
        )[0].count;
        const examsCount = this.database.executeQuery(
          "SELECT COUNT(*) as count FROM examinations"
        )[0].count;

        // Get database file info
        const dbPath = this.database.dbPath;
        const stats = fsSync.statSync(dbPath);

        return {
          success: true,
          stats: {
            patients: patientsCount,
            users: usersCount,
            examinations: examsCount,
            fileSize: stats.size,
            fileSizeFormatted: this.formatBytes(stats.size),
            lastModified: stats.mtime,
            path: dbPath,
          },
        };
      } catch (error) {
        console.error("Error getting database stats:", error);
        return { success: false, error: error.message };
      }
    });
  }

  setupUserManagementHandlers() {
    // Get all users
    ipcMain.handle("get-users", async () => {
      try {
        const users = this.database.getUsers();
        console.log("📋 [Main Process] Returning users:", users.length);
        return users;
      } catch (error) {
        console.error("❌ [Main Process] Error getting users:", error);
        return [];
      }
    });

    // Add new user
    ipcMain.handle("add-user", async (event, userData) => {
      try {
        console.log("📋 [Main Process] Adding user:", userData.username);
        const result = this.database.addUser(userData);
        console.log("✅ [Main Process] User added result:", result);
        return result;
      } catch (error) {
        console.error("❌ [Main Process] Error adding user:", error);
        return { success: false, error: error.message };
      }
    });

    // Update user
    ipcMain.handle("update-user", async (event, userId, userData) => {
      try {
        console.log("📋 [Main Process] Updating user:", userId);
        const result = this.database.updateUser(userId, userData);
        console.log("✅ [Main Process] User updated result:", result);
        return result;
      } catch (error) {
        console.error("❌ [Main Process] Error updating user:", error);
        return { success: false, error: error.message };
      }
    });

    // Delete user
    ipcMain.handle("delete-user", async (event, userId) => {
      try {
        console.log("📋 [Main Process] Deleting user:", userId);
        const result = this.database.deleteUser(userId);
        console.log("✅ [Main Process] User deleted result:", result);
        return result;
      } catch (error) {
        console.error("❌ [Main Process] Error deleting user:", error);
        return { success: false, error: error.message };
      }
    });

    // Toggle user status
    ipcMain.handle("toggle-user-status", async (event, userId) => {
      try {
        console.log("📋 [Main Process] Toggling user status:", userId);
        const result = this.database.toggleUserStatus(userId);
        console.log("✅ [Main Process] User status toggled result:", result);
        return result;
      } catch (error) {
        console.error("❌ [Main Process] Error toggling user status:", error);
        return { success: false, error: error.message };
      }
    });
  }

  setupSettingsHandlers() {
    // Get application settings
    ipcMain.handle("get-application-settings", async () => {
      try {
        console.log("⚙️ Getting application settings");

        const settingsPath = path.join(
          this.app.getPath("userData"),
          "settings.json"
        );

        let settings = {
          general: {
            appName: "EndoStat",
            version: this.app.getVersion(),
            autoStart: false,
            minimizeToTray: true,
            checkForUpdates: true,
            language: "en-US",
            theme: "light",
          },
          database: {
            autoBackup: true,
            backupInterval: 24, // hours
            keepBackups: 30, // days
            backupLocation: path.join(
              this.app.getPath("documents"),
              "EndoStat Backups"
            ),
          },
          notifications: {
            enableNotifications: true,
            showPatientAlerts: true,
            showSystemAlerts: true,
            soundEnabled: true,
          },
          performance: {
            cacheEnabled: true,
            imageCompression: true,
            maxImageSize: 1024,
          },
        };

        // Try to load saved settings
        try {
          if (fsSync.existsSync(settingsPath)) {
            const savedSettings = JSON.parse(
              await fs.readFile(settingsPath, "utf8")
            );
            settings = { ...settings, ...savedSettings };
          }
        } catch (error) {
          console.warn("Could not load settings file:", error);
        }

        return { success: true, settings };
      } catch (error) {
        console.error("Error getting application settings:", error);
        return { success: false, error: error.message };
      }
    });

    // Save application settings
    ipcMain.handle("save-application-settings", async (event, settings) => {
      try {
        console.log("💾 Saving application settings");

        const settingsPath = path.join(
          this.app.getPath("userData"),
          "settings.json"
        );

        // Load existing settings first
        let existingSettings = {};
        try {
          if (fsSync.existsSync(settingsPath)) {
            existingSettings = JSON.parse(
              await fs.readFile(settingsPath, "utf8")
            );
          }
        } catch (error) {
          console.warn("Could not load existing settings:", error);
        }

        // Merge settings
        const mergedSettings = { ...existingSettings, ...settings };

        // Save to file
        await fs.writeFile(
          settingsPath,
          JSON.stringify(mergedSettings, null, 2),
          "utf8"
        );

        return { success: true };
      } catch (error) {
        console.error("Error saving application settings:", error);
        return { success: false, error: error.message };
      }
    });

    // Get advanced settings
    ipcMain.handle("get-advanced-settings", async () => {
      try {
        console.log("🔧 Getting advanced settings");

        const settingsPath = path.join(
          this.app.getPath("userData"),
          "advanced-settings.json"
        );

        let settings = {
          logging: {
            enableDebug: false,
            logLevel: "info",
            maxLogSize: 10, // MB
            keepLogs: 7, // days
          },
          network: {
            enableProxy: false,
            proxyHost: "",
            proxyPort: "",
            proxyAuth: false,
            proxyUsername: "",
            proxyPassword: "",
          },
          security: {
            requireReauth: true,
            sessionTimeout: 30, // minutes
            maxLoginAttempts: 5,
            passwordPolicy: {
              minLength: 8,
              requireUppercase: true,
              requireLowercase: true,
              requireNumbers: true,
              requireSpecialChars: true,
            },
          },
          experimental: {
            enableBetaFeatures: false,
            hardwareAcceleration: true,
            enableTelemetry: false,
          },
        };

        // Try to load saved settings
        try {
          if (fsSync.existsSync(settingsPath)) {
            const savedSettings = JSON.parse(
              await fs.readFile(settingsPath, "utf8")
            );
            settings = { ...settings, ...savedSettings };
          }
        } catch (error) {
          console.warn("Could not load advanced settings:", error);
        }

        return { success: true, settings };
      } catch (error) {
        console.error("Error getting advanced settings:", error);
        return { success: false, error: error.message };
      }
    });

    // Save advanced settings
    ipcMain.handle("save-advanced-settings", async (event, settings) => {
      try {
        console.log("💾 Saving advanced settings");

        const settingsPath = path.join(
          this.app.getPath("userData"),
          "advanced-settings.json"
        );

        // Load existing settings first
        let existingSettings = {};
        try {
          if (fsSync.existsSync(settingsPath)) {
            existingSettings = JSON.parse(
              await fs.readFile(settingsPath, "utf8")
            );
          }
        } catch (error) {
          console.warn("Could not load existing advanced settings:", error);
        }

        // Merge settings
        const mergedSettings = { ...existingSettings, ...settings };

        // Save to file
        await fs.writeFile(
          settingsPath,
          JSON.stringify(mergedSettings, null, 2),
          "utf8"
        );

        return { success: true };
      } catch (error) {
        console.error("Error saving advanced settings:", error);
        return { success: false, error: error.message };
      }
    });

    // Reset settings
    ipcMain.handle("reset-settings", async () => {
      try {
        console.log("🔄 Resetting settings to defaults");

        // Confirm reset
        const confirmResult = await dialog.showMessageBox({
          type: "warning",
          title: "Confirm Reset Settings",
          message: "Are you sure you want to reset all settings to defaults?",
          detail: "This will restore all settings to their original values.",
          buttons: ["Cancel", "Reset"],
          defaultId: 0,
          cancelId: 0,
        });

        if (confirmResult.response !== 1) {
          return { success: false, error: "Operation cancelled" };
        }

        // Delete settings files
        const settingsPath = path.join(
          this.app.getPath("userData"),
          "settings.json"
        );
        const advancedSettingsPath = path.join(
          this.app.getPath("userData"),
          "advanced-settings.json"
        );

        try {
          if (fsSync.existsSync(settingsPath)) {
            await fs.unlink(settingsPath);
          }
        } catch (error) {
          console.warn("Could not delete settings file:", error);
        }

        try {
          if (fsSync.existsSync(advancedSettingsPath)) {
            await fs.unlink(advancedSettingsPath);
          }
        } catch (error) {
          console.warn("Could not delete advanced settings file:", error);
        }

        await dialog.showMessageBox({
          type: "info",
          title: "Settings Reset",
          message: "Settings have been reset to defaults.",
          buttons: ["OK"],
        });

        return { success: true };
      } catch (error) {
        console.error("Error resetting settings:", error);
        return { success: false, error: error.message };
      }
    });
  }

  setupLicenseHandlers() {
    // Validate license (for new activation)
    ipcMain.handle("validate-license", async (event, licenseKey) => {
      return await this.licenseManager.validateNewLicense(licenseKey);
    });

    // Activate license
    ipcMain.handle("activate-license", async (event, licenseKey) => {
      try {
        console.log("🔑 Activating license");

        // Simulate license activation
        await new Promise((resolve) => setTimeout(resolve, 1500));

        // In a real app, you would activate with a license server
        const success = licenseKey && licenseKey.length > 10;

        if (success) {
          // Save license info
          const licensePath = path.join(
            this.app.getPath("userData"),
            "license.json"
          );
          const licenseInfo = {
            key: licenseKey,
            activated: true,
            activatedAt: new Date().toISOString(),
            expiresAt: new Date(
              Date.now() + 365 * 24 * 60 * 60 * 1000
            ).toISOString(), // 1 year from now
            type: "premium",
          };

          await fs.writeFile(licensePath, JSON.stringify(licenseInfo, null, 2));

          return {
            success: true,
            license: licenseInfo,
            message: "License activated successfully!",
          };
        } else {
          return {
            success: false,
            message: "Invalid license key",
          };
        }
      } catch (error) {
        console.error("Error activating license:", error);
        return { success: false, error: error.message };
      }
    });

    // Deactivate license
    ipcMain.handle("deactivate-license", async () => {
      try {
        console.log("🔑 Deactivating license");

        // Confirm deactivation
        const confirmResult = await dialog.showMessageBox({
          type: "warning",
          title: "Confirm License Deactivation",
          message: "Are you sure you want to deactivate the license?",
          detail: "This will revert the application to trial mode.",
          buttons: ["Cancel", "Deactivate"],
          defaultId: 0,
          cancelId: 0,
        });

        if (confirmResult.response !== 1) {
          return { success: false, error: "Operation cancelled" };
        }

        // Delete license file
        const licensePath = path.join(
          this.app.getPath("userData"),
          "license.json"
        );

        try {
          if (fsSync.existsSync(licensePath)) {
            await fs.unlink(licensePath);
          }
        } catch (error) {
          console.warn("Could not delete license file:", error);
        }

        return {
          success: true,
          message: "License deactivated successfully",
        };
      } catch (error) {
        console.error("Error deactivating license:", error);
        return { success: false, error: error.message };
      }
    });

    // Check license validity
    ipcMain.handle("check-license-validity", async () => {
      try {
        console.log("🔍 Checking license validity");

        const licensePath = path.join(
          this.app.getPath("userData"),
          "license.json"
        );

        if (fsSync.existsSync(licensePath)) {
          const licenseData = JSON.parse(
            await fs.readFile(licensePath, "utf8")
          );

          // Check if license is expired
          const now = new Date();
          const expiresAt = new Date(licenseData.expiresAt);

          if (expiresAt < now) {
            return {
              success: true,
              valid: false,
              expired: true,
              message: "License has expired",
              license: licenseData,
            };
          }

          return {
            success: true,
            valid: true,
            expired: false,
            message: "License is valid",
            license: licenseData,
          };
        }

        // No license found - trial mode
        return {
          success: true,
          valid: false,
          trial: true,
          message: "Trial version",
          daysRemaining: 30, // Example: 30-day trial
        };
      } catch (error) {
        console.error("Error checking license validity:", error);
        return { success: false, error: error.message };
      }
    });

    // Get license status
    ipcMain.handle("get-license-status", () => {
      return this.licenseManager.getLicenseStatus();
    });

    // License activated event
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
  }

  setupWindowHandlers() {
    // Create child window
    ipcMain.handle("create-child-window", (event, options) => {
      return this.windowManager.createChildWindow(options);
    });

    // Debug machine info
    ipcMain.handle("debug-machine-info", () => {
      const machineId = require("node-machine-id").machineIdSync();
      const registration = this.store.get("machine.registration");
      return {
        machineId,
        registration,
        licenseKey: this.store.get("license.key"),
      };
    });
  }

  setupUpdateHandlers() {
    // Check for updates
    ipcMain.handle("check-for-updates", async () => {
      try {
        console.log("🔍 Update check requested via IPC");

        if (!this.autoUpdater) {
          console.log("Auto-updater not available");
          return {
            status: "error",
            message: "Auto-updater not available",
          };
        }

        // Use the checkForUpdates method (not manualCheckForUpdates)
        const result = await this.autoUpdater.checkForUpdates(true); // true = user requested
        console.log("Update check result:", result);
        return result;
      } catch (error) {
        console.error("Update check error:", error);
        return {
          status: "error",
          message: `Update check failed: ${error.message}`,
        };
      }
    });

    // Alternative handler for compatibility
    ipcMain.handle("check-for-updates-manually", async () => {
      console.log("🔍 Using alternative update check handler");
      return this.handleUpdateCheck();
    });

    // Download update
    ipcMain.handle("download-update", async () => {
      try {
        console.log("📥 Download update requested via IPC");

        if (!this.autoUpdater) {
          console.log("Auto-updater not available");
          return {
            success: false,
            message: "Auto-updater not available",
          };
        }

        const success = this.autoUpdater.downloadUpdate();

        return {
          success: success,
          message: success
            ? "Update download started"
            : "Failed to start download",
        };
      } catch (error) {
        console.error("Download update error:", error);
        return {
          success: false,
          message: `Download failed: ${error.message}`,
        };
      }
    });

    // Install update
    ipcMain.handle("install-update", async () => {
      try {
        console.log("⚡ Install update requested via IPC");

        if (!this.autoUpdater) {
          console.log("Auto-updater not available");
          return {
            success: false,
            message: "Auto-updater not available",
          };
        }

        const success = this.autoUpdater.installUpdate();

        return {
          success: success,
          message: success
            ? "Update installation started"
            : "Failed to install update",
        };
      } catch (error) {
        console.error("Install update error:", error);
        return {
          success: false,
          message: `Installation failed: ${error.message}`,
        };
      }
    });

    // Get update status
    ipcMain.handle("get-update-status", async () => {
      try {
        if (!this.autoUpdater) {
          return {
            initialized: false,
            isDev: this.isDev,
            currentVersion: this.app.getVersion(),
            message: "Auto-updater not available",
          };
        }

        const status = this.autoUpdater.getStatus();
        return status;
      } catch (error) {
        console.error("Get update status error:", error);
        return {
          initialized: false,
          isDev: this.isDev,
          currentVersion: this.app.getVersion(),
          error: error.message,
        };
      }
    });

    // Set up event forwarding
    this.setupUpdateEventForwarding();
  }

  setupUpdateEventForwarding() {
    if (!this.autoUpdater) {
      console.log("Auto-updater not available for event forwarding");
      return;
    }

    console.log("Setting up update event forwarding...");

    // Define event mappings - send both old and new event names for compatibility
    const eventMappings = {
      "checking-for-update": (data) => {
        console.log("🔍 Checking for updates...");
        // Send old event name (for compatibility)
        this.forwardToRenderer("auto-updater:checking-for-update", data);
        // Send new event name
        this.forwardToRenderer("update-checking", data);
      },
      "update-available": (info) => {
        console.log("📦 Update available:", info.version);
        // Send old event name (for compatibility)
        this.forwardToRenderer("auto-updater:update-available", info);
        // Send new event name
        this.forwardToRenderer("update-available", info);
      },
      "update-not-available": (info) => {
        console.log("✅ No updates available");
        // Send old event name (for compatibility)
        this.forwardToRenderer("auto-updater:update-not-available", info);
        // Send new event name
        this.forwardToRenderer("update-not-available", info);
      },
      "download-progress": (progress) => {
        console.log(
          `📥 Download progress: ${Math.round(progress.percent || 0)}%`
        );
        // Send old event name (for compatibility)
        this.forwardToRenderer("auto-updater:download-progress", progress);
        // Send new event name
        this.forwardToRenderer("update-download-progress", progress);
      },
      "update-downloaded": (info) => {
        console.log("🎉 Update downloaded:", info.version);
        // Send old event name (for compatibility)
        this.forwardToRenderer("auto-updater:update-downloaded", info);
        // Send new event name
        this.forwardToRenderer("update-downloaded", info);
      },
      error: (error) => {
        console.error("❌ Update error:", error.message);
        const errorData = {
          message: error.message,
          stack: error.stack,
        };
        // Send old event name (for compatibility)
        this.forwardToRenderer("auto-updater:update-error", errorData);
        // Send new event name
        this.forwardToRenderer("update-error", errorData);
      },
    };

    // Set up event listeners on auto-updater
    Object.keys(eventMappings).forEach((eventName) => {
      if (typeof this.autoUpdater.on === "function") {
        this.autoUpdater.on(eventName, eventMappings[eventName]);
        console.log(`Event listener added for: ${eventName}`);
      }
    });
  }

  // Simple helper method for update check
  async handleUpdateCheck() {
    try {
      console.log("🔍 Handling update check");

      if (!this.autoUpdater) {
        console.log("Auto-updater not available");
        return {
          status: "error",
          message: "Auto-updater not available",
        };
      }

      const result = await this.autoUpdater.checkForUpdates(true); // true = user requested
      console.log("Update check result:", result);
      return result;
    } catch (error) {
      console.error("Update check error:", error);
      return {
        status: "error",
        message: `Update check failed: ${error.message}`,
      };
    }
  }

  forwardToRenderer(eventName, data) {
    // Send to all windows
    this.windowManager.windows.forEach((window) => {
      if (window && !window.isDestroyed()) {
        window.webContents.send(eventName, data);
      }
    });
  }

  // Helper method for update check
  async handleUpdateCheck() {
    try {
      console.log("🔍 Handling update check");

      if (!this.autoUpdater || !this.autoUpdater.initialized) {
        console.log("Auto-updater not initialized");
        return {
          status: "error",
          message: "Auto-updater not available",
        };
      }

      const result = await this.autoUpdater.manualCheckForUpdates();
      console.log("Update check result:", result);
      return result;
    } catch (error) {
      console.error("Update check error:", error);
      return {
        status: "error",
        message: `Update check failed: ${error.message}`,
      };
    }
  }

  setupUtilityHandlers() {
    // Get app version
    ipcMain.handle("get-app-version", () => {
      return this.app.getVersion();
    });

    // Store operations
    ipcMain.handle("store-get", (event, key) => {
      return this.store.get(key);
    });

    ipcMain.handle("store-set", (event, key, value) => {
      this.store.set(key, value);
    });

    ipcMain.handle("store-delete", (event, key) => {
      this.store.delete(key);
    });

    // Open external URL
    ipcMain.handle("open-external", async (event, url) => {
      try {
        await shell.openExternal(url);
        return { success: true };
      } catch (error) {
        console.error("Failed to open external URL:", error);
        return { success: false, error: error.message };
      }
    });

    // File dialogs
    ipcMain.handle("show-open-dialog", async (event, options) => {
      return await dialog.showOpenDialog(options);
    });

    ipcMain.handle("show-save-dialog", async (event, options) => {
      return await dialog.showSaveDialog(options);
    });

    ipcMain.handle("show-message-box", async (event, options) => {
      return await dialog.showMessageBox(options);
    });

    ipcMain.handle("test-login-simple", async () => {
      console.log("🧪 Testing simple login response");

      // Return a hardcoded success response
      return {
        success: true,
        user: {
          id: 1,
          username: "admin",
          fullName: "System Administrator",
          role: "admin",
        },
      };
    });
  }

  // Helper methods
  async verifyUserCredentials(username, password) {
    try {
      console.log("🔐 === STARTING CREDENTIAL VERIFICATION ===");
      console.log("📧 Username:", username);

      // Query user from database
      const query = "SELECT * FROM users WHERE username = ?";
      const users = await this.database.executeQuery(query, [username]);

      if (users.length === 0) {
        console.log("❌ No user found with username:", username);
        return null;
      }

      const user = users[0];

      // Check if user is active
      if (!user.is_active) {
        console.log("❌ User account is inactive:", user.username);
        return null;
      }

      // Verify password
      const bcrypt = require("bcryptjs");

      if (!user.password_hash) {
        console.log("❌ No password hash found");
        return null;
      }

      console.log("🔍 Comparing passwords...");
      const isPasswordValid = bcrypt.compareSync(password, user.password_hash);

      if (isPasswordValid) {
        console.log("✅ Password valid");

        // Update login stats
        await this.database.executeQuery(
          "UPDATE users SET login_count = COALESCE(login_count, 0) + 1, last_login = CURRENT_TIMESTAMP WHERE id = ?",
          [user.id]
        );

        // Return a clean user object
        return {
          id: Number(user.id),
          username: String(user.username),
          full_name: String(user.full_name || ""),
          role: String(user.role || "user"),
        };
      } else {
        console.log("❌ Password invalid");
        return null;
      }
    } catch (error) {
      console.error("💥 Verification error:", error);
      throw error;
    }
  }

  formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
  }

  async launchApplication() {
    try {
      // Show splash screen
      await this.windowManager.showSplashScreen();

      // Initialize auto-updater (only in production) with error handling
      if (!this.isDev) {
        try {
          const licenseKey = this.store.get("license.key");
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
          this.windowManager.showErrorScreen("Failed to create login window");
        }
      }, 3000);
    } catch (error) {
      console.error("Failed to launch application:", error);
      this.windowManager.showErrorScreen(
        "Failed to launch application: " + error.message
      );
    }
  }
}

module.exports = IpcHandlers;
