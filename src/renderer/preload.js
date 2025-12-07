const { contextBridge, ipcRenderer } = require("electron");

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld("electronAPI", {
  // === LOGIN METHODS (NEWLY ADDED) ===
  userLogin: (username, password) =>
    ipcRenderer.invoke("user-login", username, password),
  userLogout: () => ipcRenderer.invoke("user-logout"),
  getUserSession: () => ipcRenderer.invoke("get-user-session"),
  verifyUserCredentials: (username, password) =>
    ipcRenderer.invoke("verify-user-credentials", username, password),
  loginSuccessful: () => ipcRenderer.send("login-successful"),

  // User management - ADD THESE
  getUsers: () => ipcRenderer.invoke("get-users"),
  addUser: (userData) => ipcRenderer.invoke("add-user", userData),
  updateUser: (userId, userData) =>
    ipcRenderer.invoke("update-user", userId, userData),
  deleteUser: (userId) => ipcRenderer.invoke("delete-user", userId),
  toggleUserStatus: (userId) =>
    ipcRenderer.invoke("toggle-user-status", userId),

  // Patient management
  addPatient: (patientData) => ipcRenderer.invoke("add-patient", patientData),
  getPatients: (searchTerm) => ipcRenderer.invoke("get-patients", searchTerm),

  // Settings functionality - ADD THESE
  backupDatabase: () => ipcRenderer.invoke("backup-database"),
  restoreDatabase: (backupPath) =>
    ipcRenderer.invoke("restore-database", backupPath),
  getDatabaseStats: () => ipcRenderer.invoke("get-database-stats"),
  clearDatabase: () => ipcRenderer.invoke("clear-database"),
  exportData: (format) => ipcRenderer.invoke("export-data", format),
  importData: (filePath) => ipcRenderer.invoke("import-data", filePath),
  getApplicationSettings: () => ipcRenderer.invoke("get-application-settings"),
  saveApplicationSettings: (settings) =>
    ipcRenderer.invoke("save-application-settings", settings),
  resetSettings: () => ipcRenderer.invoke("reset-settings"),
  getAdvancedSettings: () => ipcRenderer.invoke("get-advanced-settings"),
  saveAdvancedSettings: (settings) =>
    ipcRenderer.invoke("save-advanced-settings", settings),
  validateLicense: (licenseKey) =>
    ipcRenderer.invoke("validate-license", licenseKey),
  activateLicense: (licenseKey) =>
    ipcRenderer.invoke("activate-license", licenseKey),
  deactivateLicense: () => ipcRenderer.invoke("deactivate-license"),
  checkLicenseValidity: () => ipcRenderer.invoke("check-license-validity"),

  // File dialogs
  showOpenDialog: (options) => ipcRenderer.invoke("show-open-dialog", options),
  showSaveDialog: (options) => ipcRenderer.invoke("show-save-dialog", options),
  showMessageBox: (options) => ipcRenderer.invoke("show-message-box", options),

  // License management
  validateLicense: (licenseKey) =>
    ipcRenderer.invoke("validate-license", licenseKey),
  getLicenseStatus: () => ipcRenderer.invoke("get-license-status"),

  checkForUpdates: () => ipcRenderer.invoke("check-for-updates"),

  // Database operations
  dbQuery: (query, params) => ipcRenderer.invoke("db-query", query, params),

  // Window management
  createChildWindow: (options) =>
    ipcRenderer.invoke("create-child-window", options),

  // Store operations
  storeGet: (key) => ipcRenderer.invoke("store-get", key),
  storeSet: (key, value) => ipcRenderer.invoke("store-set", key, value),
  storeDelete: (key) => ipcRenderer.invoke("store-delete", key),

  // Application info
  getAppVersion: () => ipcRenderer.invoke("get-app-version"),

  // External links
  openExternal: (url) => ipcRenderer.invoke("open-external", url),

  // Send events to main process
  send: (channel, data) => {
    const validChannels = [
      "license-activated",
      "close-license-gate",
      "login-successful", // Added login-successful to valid channels
      "logout-successful",
    ];
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, data);
    }
  },

  // Events
  on: (channel, callback) => {
    const validChannels = [
      "license-validated",
      "update-available",
      "database-updated",
      "login-success",
      "logout-successful",
    ];
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, (event, ...args) => callback(...args));
    }
  },

  // Remove listeners
  removeAllListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel);
  },

  // Update methods
  checkForUpdatesManually: () =>
    ipcRenderer.invoke("check-for-updates-manually"),
  downloadAndInstallUpdate: () =>
    ipcRenderer.invoke("download-and-install-update"),

  // Listen for update events
  onUpdateDownloadProgress: (callback) =>
    ipcRenderer.on("update-download-progress", callback),
  onUpdateDownloaded: (callback) =>
    ipcRenderer.on("update-downloaded", callback),

  // Remove listeners
  removeAllUpdateListeners: () => {
    ipcRenderer.removeAllListeners("update-download-progress");
    ipcRenderer.removeAllListeners("update-downloaded");
  },

  // Debug methods
  debugMachineInfo: () => ipcRenderer.invoke("debug-machine-info"),
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
});

// Log when preload script loads (for debugging)
console.log("🔧 Preload script loaded successfully");
console.log("📋 Available electronAPI methods:", [
  "userLogin",
  "userLogout",
  "getUserSession",
  "verifyUserCredentials",
  "loginSuccessful",
  "validateLicense",
  "getLicenseStatus",
  "checkForUpdates",
  "dbQuery",
  "createChildWindow",
  "storeGet",
  "storeSet",
  "storeDelete",
  "getAppVersion",
  "openExternal",
  "send",
  "on",
  "removeAllListeners",
  "checkForUpdatesManually",
  "downloadAndInstallUpdate",
  "onUpdateDownloadProgress",
  "onUpdateDownloaded",
  "removeAllUpdateListeners",
  "debugMachineInfo",
]);
