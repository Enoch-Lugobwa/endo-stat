const { app, BrowserWindow, screen, dialog } = require("electron");
const path = require("path");

const isDev = process.env.NODE_ENV === "development";

class WindowManager {
  constructor() {
    this.windows = new Map();
    this.splashScreen = null;
  }

  createMainWindow() {
    try {
      const mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1200,
        minHeight: 800,
        autoHideMenuBar: true,
        show: false,
        icon: path.join(__dirname, "../../build/icon.png"),
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          enableRemoteModule: false,
          preload: path.join(__dirname, "../renderer/preload.js"),
        },
        titleBarStyle: "default",
      });

      // Load the main application
      mainWindow.loadFile(path.join(__dirname, "../renderer/views/index.html"));

      mainWindow.once("ready-to-show", () => {
        mainWindow.show();
        mainWindow.maximize();
      });

      // Handle window errors
      mainWindow.webContents.on(
        "did-fail-load",
        (event, errorCode, errorDescription) => {
          console.error("Window failed to load:", errorDescription);
        }
      );

      if (isDev) {
        mainWindow.webContents.openDevTools();
      }

      this.windows.set("main", mainWindow);
      return mainWindow;
    } catch (error) {
      console.error("Failed to create main window:", error);
      throw error;
    }
  }

  async showSplashScreen() {
    try {
      this.splashScreen = new BrowserWindow({
        width: 400,
        height: 800,
        transparent: true,
        frame: false,
        alwaysOnTop: true,
        resizable: false,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
        },
      });

      this.splashScreen.loadFile(
        path.join(__dirname, "../renderer/views/splash.html")
      );
      this.splashScreen.show();

      return this.splashScreen;
    } catch (error) {
      console.error("Failed to show splash screen:", error);
      throw error;
    }
  }

  closeSplashScreen() {
    if (this.splashScreen && !this.splashScreen.isDestroyed()) {
      this.splashScreen.close();
      this.splashScreen = null;
    }
  }

  async showLicenseGate() {
    try {
      const gateWindow = new BrowserWindow({
        width: 500,
        height: 640,
        resizable: false,
        frame: false,
        modal: true,
        show: false,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          preload: path.join(__dirname, "../renderer/preload.js"),
        },
      });

      gateWindow.loadFile(
        path.join(__dirname, "../renderer/views/license-gate.html")
      );

      gateWindow.once("ready-to-show", () => {
        gateWindow.show();
      });

      this.windows.set("license-gate", gateWindow);
      return gateWindow;
    } catch (error) {
      console.error("Failed to create license gate window:", error);
      throw error;
    }
  }

  createLoginWindow() {
    try {
      const loginWindow = new BrowserWindow({
        width: 500,
        height: 700,
        show: false,
        resizable: false,
        autoHideMenuBar: true,
        icon: path.join(__dirname, "../../build/icon.png"),
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          enableRemoteModule: false,
          preload: path.join(__dirname, "../renderer/preload.js"),
        },
        titleBarStyle: "default",
      });

      // Load the login screen
      loginWindow.loadFile(
        path.join(__dirname, "../renderer/views/login.html")
      );

      loginWindow.once("ready-to-show", () => {
        loginWindow.show();
      });

      // Handle window closed
      loginWindow.on("closed", () => {
        this.windows.delete("login");
        // If login window is closed and no other windows, quit app
        if (this.windows.size === 0) {
          app.quit();
        }
      });

      this.windows.set("login", loginWindow);
      return loginWindow;
    } catch (error) {
      console.error("Failed to create login window:", error);
      throw error;
    }
  }

  createMainWindowAfterLogin() {
    try {
      // Close login window
      const loginWindow = this.windows.get("login");
      if (loginWindow && !loginWindow.isDestroyed()) {
        loginWindow.close();
        this.windows.delete("login");
      }

      // Create main window
      return this.createMainWindow();
    } catch (error) {
      console.error("Failed to switch to main window:", error);
      throw error;
    }
  }

  createChildWindow(options) {
    try {
      const parent = BrowserWindow.getFocusedWindow();
      const childWindow = new BrowserWindow({
        width: options.width || 400,
        height: options.height || 500,
        parent: parent,
        modal: true,
        show: false,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          preload: path.join(__dirname, "../renderer/preload.js"),
        },
        ...options,
      });

      childWindow.loadFile(
        path.join(__dirname, `../renderer/views/${options.view}.html`)
      );

      childWindow.once("ready-to-show", () => {
        childWindow.show();
      });

      return childWindow;
    } catch (error) {
      console.error("Failed to create child window:", error);
      throw error;
    }
  }

  showErrorScreen(message) {
    try {
      dialog.showErrorBox("Application Error", message);
    } catch (error) {
      console.error("Failed to show error screen:", error);
    }
  }

  getWindowCount() {
    return this.windows.size;
  }

  closeAllWindows() {
    this.windows.forEach((window) => {
      if (!window.isDestroyed()) {
        window.close();
      }
    });
    this.windows.clear();
  }
}

module.exports = WindowManager;
