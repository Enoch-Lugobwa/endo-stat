const { contextBridge, ipcRenderer } = require("electron");

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld("electronAPI", {
  // === UPDATE MANAGEMENT METHODS ===
  isAutoUpdateAvailable: () => ipcRenderer.invoke("is-auto-update-available"),
  checkForUpdates: () => ipcRenderer.invoke("check-for-updates"),
  checkForUpdatesManually: () =>
    ipcRenderer.invoke("check-for-updates-manually"),
  downloadUpdate: () => ipcRenderer.invoke("download-update"),
  installUpdate: () => ipcRenderer.invoke("install-update"),
  getUpdateStatus: () => ipcRenderer.invoke("get-update-status"),
  isDev: () => ipcRenderer.invoke("is-dev"),

  // === UPDATE EVENT LISTENERS (New simplified event names) ===
  onUpdateChecking: (callback) => {
    // Listen for both event names
    const handler1 = (event, ...args) => callback(...args);
    const handler2 = (event, ...args) => callback(...args);

    ipcRenderer.on("update-checking", handler1);
    ipcRenderer.on("auto-updater:checking-for-update", handler2);

    // Return cleanup function
    return () => {
      ipcRenderer.removeListener("update-checking", handler1);
      ipcRenderer.removeListener("auto-updater:checking-for-update", handler2);
    };
  },
  onUpdateAvailable: (callback) => {
    const handler1 = (event, ...args) => callback(...args);
    const handler2 = (event, ...args) => callback(...args);

    ipcRenderer.on("update-available", handler1);
    ipcRenderer.on("auto-updater:update-available", handler2);

    return () => {
      ipcRenderer.removeListener("update-available", handler1);
      ipcRenderer.removeListener("auto-updater:update-available", handler2);
    };
  },
  onUpdateNotAvailable: (callback) => {
    const handler1 = (event, ...args) => callback(...args);
    const handler2 = (event, ...args) => callback(...args);

    ipcRenderer.on("update-not-available", handler1);
    ipcRenderer.on("auto-updater:update-not-available", handler2);

    return () => {
      ipcRenderer.removeListener("update-not-available", handler1);
      ipcRenderer.removeListener("auto-updater:update-not-available", handler2);
    };
  },
  onUpdateDownloadProgress: (callback) => {
    const handler1 = (event, ...args) => callback(...args);
    const handler2 = (event, ...args) => callback(...args);

    ipcRenderer.on("update-download-progress", handler1);
    ipcRenderer.on("auto-updater:download-progress", handler2);

    return () => {
      ipcRenderer.removeListener("update-download-progress", handler1);
      ipcRenderer.removeListener("auto-updater:download-progress", handler2);
    };
  },
  onUpdateDownloaded: (callback) => {
    const handler1 = (event, ...args) => callback(...args);
    const handler2 = (event, ...args) => callback(...args);

    ipcRenderer.on("update-downloaded", handler1);
    ipcRenderer.on("auto-updater:update-downloaded", handler2);

    return () => {
      ipcRenderer.removeListener("update-downloaded", handler1);
      ipcRenderer.removeListener("auto-updater:update-downloaded", handler2);
    };
  },
  onUpdateError: (callback) => {
    const handler1 = (event, ...args) => callback(...args);
    const handler2 = (event, ...args) => callback(...args);

    ipcRenderer.on("update-error", handler1);
    ipcRenderer.on("auto-updater:update-error", handler2);

    return () => {
      ipcRenderer.removeListener("update-error", handler1);
      ipcRenderer.removeListener("auto-updater:update-error", handler2);
    };
  },

  onAutoUpdateChecking: (callback) =>
    ipcRenderer.on("auto-updater:checking-for-update", (event, ...args) =>
      callback(...args)
    ),
  onAutoUpdateAvailable: (callback) =>
    ipcRenderer.on("auto-updater:update-available", (event, ...args) =>
      callback(...args)
    ),
  onAutoUpdateNotAvailable: (callback) =>
    ipcRenderer.on("auto-updater:update-not-available", (event, ...args) =>
      callback(...args)
    ),
  onAutoUpdateDownloadProgress: (callback) =>
    ipcRenderer.on("auto-updater:download-progress", (event, ...args) =>
      callback(...args)
    ),
  onAutoUpdateDownloaded: (callback) =>
    ipcRenderer.on("auto-updater:update-downloaded", (event, ...args) =>
      callback(...args)
    ),
  onAutoUpdateError: (callback) =>
    ipcRenderer.on("auto-updater:update-error", (event, ...args) =>
      callback(...args)
    ),

  // === AUTHENTICATION METHODS ===
  userLogin: (username, password) =>
    ipcRenderer.invoke("user-login", username, password),
  userLogout: () => ipcRenderer.invoke("user-logout"),
  getUserSession: () => ipcRenderer.invoke("get-user-session"),
  testLoginSimple: () => ipcRenderer.invoke("test-login-simple"),

  // === DATABASE OPERATIONS ===
  dbQuery: (query, params) => ipcRenderer.invoke("db-query", query, params),
  getPatients: (searchTerm) => ipcRenderer.invoke("get-patients", searchTerm),
  addPatient: (patientData) => ipcRenderer.invoke("add-patient", patientData),

  // === DATABASE MANAGEMENT ===
  backupDatabase: () => ipcRenderer.invoke("backup-database"),
  restoreDatabase: (backupPath) =>
    ipcRenderer.invoke("restore-database", backupPath),
  getDatabaseStats: () => ipcRenderer.invoke("get-database-stats"),
  clearDatabase: () => ipcRenderer.invoke("clear-database"),

  // === USER MANAGEMENT ===
  getUsers: () => ipcRenderer.invoke("get-users"),
  addUser: (userData) => ipcRenderer.invoke("add-user", userData),
  updateUser: (userId, userData) =>
    ipcRenderer.invoke("update-user", userId, userData),
  deleteUser: (userId) => ipcRenderer.invoke("delete-user", userId),
  toggleUserStatus: (userId) =>
    ipcRenderer.invoke("toggle-user-status", userId),

  // === APPLICATION SETTINGS ===
  getApplicationSettings: () => ipcRenderer.invoke("get-application-settings"),
  saveApplicationSettings: (settings) =>
    ipcRenderer.invoke("save-application-settings", settings),
  getAdvancedSettings: () => ipcRenderer.invoke("get-advanced-settings"),
  saveAdvancedSettings: (settings) =>
    ipcRenderer.invoke("save-advanced-settings", settings),
  resetSettings: () => ipcRenderer.invoke("reset-settings"),

  // === LICENSE MANAGEMENT ===
  getLicenseStatus: () => ipcRenderer.invoke("get-license-status"),
  validateLicense: (licenseKey) =>
    ipcRenderer.invoke("validate-license", licenseKey),
  activateLicense: (licenseKey) =>
    ipcRenderer.invoke("activate-license", licenseKey),
  deactivateLicense: () => ipcRenderer.invoke("deactivate-license"),
  checkLicenseValidity: () => ipcRenderer.invoke("check-license-validity"),

  // === FILE DIALOGS ===
  showOpenDialog: (options) => ipcRenderer.invoke("show-open-dialog", options),
  showSaveDialog: (options) => ipcRenderer.invoke("show-save-dialog", options),
  showMessageBox: (options) => ipcRenderer.invoke("show-message-box", options),

  // === WINDOW MANAGEMENT ===
  createChildWindow: (options) =>
    ipcRenderer.invoke("create-child-window", options),

  // === STORE OPERATIONS ===
  storeGet: (key) => ipcRenderer.invoke("store-get", key),
  storeSet: (key, value) => ipcRenderer.invoke("store-set", key, value),
  storeDelete: (key) => ipcRenderer.invoke("store-delete", key),

  // === APPLICATION INFO ===
  getAppVersion: () => ipcRenderer.invoke("get-app-version"),

  // === EXTERNAL OPERATIONS ===
  openExternal: (url) => ipcRenderer.invoke("open-external", url),

  // === DEBUG METHODS ===
  debugMachineInfo: () => ipcRenderer.invoke("debug-machine-info"),

  // === SEND EVENTS TO MAIN PROCESS ===
  send: (channel, data) => {
    const validChannels = [
      "license-activated",
      "close-license-gate",
      "login-successful",
      "logout-successful",
    ];
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, data);
    }
  },

  // === OTHER EVENT LISTENERS ===
  on: (channel, callback) => {
    const validChannels = [
      "license-validated",
      "database-updated",
      "user-session-updated",
      "notification",
    ];
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, (event, ...args) => callback(...args));
    }
  },

  // === REMOVE LISTENERS ===
  removeAllUpdateListeners: () => {
    // Remove new-style listeners
    ipcRenderer.removeAllListeners("update-checking");
    ipcRenderer.removeAllListeners("update-available");
    ipcRenderer.removeAllListeners("update-not-available");
    ipcRenderer.removeAllListeners("update-download-progress");
    ipcRenderer.removeAllListeners("update-downloaded");
    ipcRenderer.removeAllListeners("update-error");

    // Remove old-style listeners
    ipcRenderer.removeAllListeners("auto-updater:checking-for-update");
    ipcRenderer.removeAllListeners("auto-updater:update-available");
    ipcRenderer.removeAllListeners("auto-updater:update-not-available");
    ipcRenderer.removeAllListeners("auto-updater:download-progress");
    ipcRenderer.removeAllListeners("auto-updater:update-downloaded");
    ipcRenderer.removeAllListeners("auto-updater:update-error");
  },

  removeAllListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel);
  },

  // === EVENT REMOVAL HELPERS ===
  removeUpdateCheckingListener: (callback) => {
    ipcRenderer.removeListener("update-checking", callback);
    ipcRenderer.removeListener("auto-updater:checking-for-update", callback);
  },

  removeUpdateAvailableListener: (callback) => {
    ipcRenderer.removeListener("update-available", callback);
    ipcRenderer.removeListener("auto-updater:update-available", callback);
  },

  removeUpdateNotAvailableListener: (callback) => {
    ipcRenderer.removeListener("update-not-available", callback);
    ipcRenderer.removeListener("auto-updater:update-not-available", callback);
  },
});

// Expose versions for debugging
contextBridge.exposeInMainWorld("versions", {
  node: () => process.versions.node,
  chrome: () => process.versions.chrome,
  electron: () => process.versions.electron,
});

// Expose environment
contextBridge.exposeInMainWorld("environment", {
  isDev: process.env.NODE_ENV === "development",
  platform: process.platform,
  arch: process.arch,
});

// Add a utility method for testing IPC connectivity
contextBridge.exposeInMainWorld("ipcTest", {
  ping: () => ipcRenderer.invoke("ping"),
});

// Add this to your preload.js contextBridge
contextBridge.exposeInMainWorld("debug", {
  // ... existing debug functions ...

  testIPC: async () => {
    const results = {};

    // Test each API method
    const methods = [
      "getAppVersion",
      "isDev",
      "isAutoUpdateAvailable",
      "checkForUpdates",
      "getUpdateStatus",
    ];

    for (const method of methods) {
      try {
        if (window.electronAPI[method]) {
          results[method] = await window.electronAPI[method]();
        } else {
          results[method] = { error: "Method not available" };
        }
      } catch (error) {
        results[method] = { error: error.message };
      }
    }

    console.log("IPC API Test Results:", results);
    return results;
  },
});

// Helper to list all exposed methods
const listExposedMethods = () => {
  const methods = [];

  // List main electronAPI methods
  if (window.electronAPI) {
    const apiMethods = Object.getOwnPropertyNames(window.electronAPI)
      .filter((prop) => typeof window.electronAPI[prop] === "function")
      .sort();
    methods.push(...apiMethods.map((m) => `electronAPI.${m}`));
  }

  // List versions methods
  if (window.versions) {
    const versionMethods = Object.getOwnPropertyNames(window.versions)
      .filter((prop) => typeof window.versions[prop] === "function")
      .sort();
    methods.push(...versionMethods.map((m) => `versions.${m}`));
  }

  // List environment properties
  if (window.environment) {
    const envProps = Object.getOwnPropertyNames(window.environment).sort();
    methods.push(...envProps.map((p) => `environment.${p}`));
  }

  // List ipcTest methods
  if (window.ipcTest) {
    const testMethods = Object.getOwnPropertyNames(window.ipcTest)
      .filter((prop) => typeof window.ipcTest[prop] === "function")
      .sort();
    methods.push(...testMethods.map((m) => `ipcTest.${m}`));
  }

  return methods;
};

// Expose the method listing function
contextBridge.exposeInMainWorld("debug", {
  listMethods: listExposedMethods,
  logIPC: (message, data) => {
    console.log(`[IPC] ${message}:`, data);
  },
});

console.log("✅ Preload script initialized with all IPC handlers");

// Log when preload script loads (for debugging)
console.log("🔧 Preload script loaded successfully");
console.log(
  "📋 Available electronAPI methods:",
  Object.keys(window.electronAPI || {})
);

// Add a test to verify IPC communication
setTimeout(() => {
  console.log("🔄 Preload script ready, testing IPC communication...");

  // Test basic IPC
  if (window.electronAPI && window.electronAPI.getAppVersion) {
    window.electronAPI
      .getAppVersion()
      .then((version) => {
        console.log(`✅ App version via IPC: ${version}`);
      })
      .catch((err) => {
        console.warn("⚠️ Could not get app version via IPC:", err.message);
      });
  }

  // Test update availability
  if (window.electronAPI && window.electronAPI.isAutoUpdateAvailable) {
    window.electronAPI
      .isAutoUpdateAvailable()
      .then((result) => {
        console.log(`✅ Auto-update availability:`, result);
      })
      .catch((err) => {
        console.warn(
          "⚠️ Could not check auto-update availability:",
          err.message
        );
      });
  }
}, 1000);
