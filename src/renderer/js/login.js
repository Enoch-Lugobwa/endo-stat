class LoginScreen {
  constructor() {
    this.loginForm = document.getElementById("loginForm");
    this.usernameInput = document.getElementById("username");
    this.passwordInput = document.getElementById("password");
    this.loginBtn = document.getElementById("loginBtn");
    this.loginSpinner = document.getElementById("loginSpinner");
    this.loginBtnText = this.loginBtn.querySelector("span");

    this.init();
  }

  init() {
    this.setupEventListeners();
    this.loadAppVersion();
    this.setCurrentYear();
    this.focusUsername();
    this.addDebugButton(); // Add debug button for testing
  }

  setupEventListeners() {
    // Form submission
    this.loginForm.addEventListener("submit", (e) => {
      e.preventDefault();
      this.handleLogin();
    });

    // Enter key support
    this.passwordInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        this.handleLogin();
      }
    });

    // Input validation
    this.usernameInput.addEventListener("input", () => this.clearError());
    this.passwordInput.addEventListener("input", () => this.clearError());

    // Auto-fill default credentials for demo (optional)
    this.setupDemoCredentials();
  }

  setupDemoCredentials() {
    // Auto-fill demo credentials (optional - remove in production)
    this.usernameInput.value = "admin";
    this.passwordInput.value = "admin";
  }

  focusUsername() {
    // Focus on username field after a short delay
    setTimeout(() => {
      this.usernameInput.focus();
      this.usernameInput.select();
    }, 100);
  }

  async handleLogin() {
    const username = this.usernameInput.value.trim();
    const password = this.passwordInput.value;

    // Basic validation
    if (!username || !password) {
      this.showError("Please enter both username and password");
      return;
    }

    // Show loading state
    this.setLoadingState(true);

    try {
      console.log("🔄 Sending login request to main process...");
      console.log("📧 Username:", username);
      console.log("🔑 Password:", password ? "***" : "undefined");

      // Check if electronAPI is available
      if (!window.electronAPI) {
        console.error("❌ electronAPI not available");
        this.showError("Application error: Cannot connect to main process");
        return;
      }

      if (!window.electronAPI.userLogin) {
        console.error("❌ userLogin method not available");
        this.showError("Application error: Login method not available");
        return;
      }

      console.log("✅ electronAPI available, calling userLogin...");

      // First, test IPC connection with a simple call
      await this.testIPCConnection();

      // Now attempt login
      const result = await window.electronAPI.userLogin(username, password);
      console.log("📨 Login response received:", result);

      // Debug: Log the exact response structure
      console.log("Response type:", typeof result);
      console.log("Is result null?", result === null);
      console.log("Is result undefined?", result === undefined);

      if (result) {
        console.log("Result keys:", Object.keys(result));
        console.log("Result.success value:", result.success);
        console.log("Result.user:", result.user);

        // Try to stringify to check serialization
        try {
          const json = JSON.stringify(result);
          console.log("✅ Result can be serialized:", json.substring(0, 200));
        } catch (serializeError) {
          console.error("❌ Result serialization error:", serializeError);
        }
      }

      if (result && result.success === true) {
        console.log("✅ Login successful!");
        await this.handleSuccessfulLogin(result.user);
      } else if (result && result.success === false) {
        console.log("❌ Login failed with error:", result.error);
        this.handleFailedLogin(result.error || "Login failed");
      } else {
        console.log("⚠️ Unexpected response:", result);
        this.handleFailedLogin(
          "Unexpected response from server. Please try again."
        );
      }
    } catch (error) {
      console.error("💥 Login error:", error);
      console.error("📋 Error details:", error.message);
      console.error("📋 Error stack:", error.stack);

      // Provide more specific error messages
      let errorMessage =
        "Login failed due to a system error. Please try again.";

      if (
        error.message.includes("serialize") ||
        error.message.includes("JSON")
      ) {
        errorMessage = "Data format error. Please contact support.";
      } else if (error.message.includes("channel")) {
        errorMessage = "Communication error. Please restart the application.";
      } else if (error.message.includes("timeout")) {
        errorMessage = "Request timed out. Please try again.";
      }

      this.handleFailedLogin(errorMessage);
    } finally {
      this.setLoadingState(false);
    }
  }

  async testIPCConnection() {
    try {
      console.log("🧪 Testing IPC connection...");

      // Test 1: Get app version (should always work)
      if (window.electronAPI.getAppVersion) {
        const version = await window.electronAPI.getAppVersion();
        console.log("✅ App version test passed:", version);
      }

      // Test 2: Test simple response if available
      if (window.electronAPI.testLoginSimple) {
        const simpleResult = await window.electronAPI.testLoginSimple();
        console.log("✅ Simple login test passed:", simpleResult);
      }

      // Test 3: Test minimal login if available
      if (window.electronAPI.userLoginMinimal) {
        const minimalResult = await window.electronAPI.userLoginMinimal(
          "admin",
          "admin"
        );
        console.log("✅ Minimal login test passed:", minimalResult);
      }

      console.log("✅ All IPC tests passed");
      return true;
    } catch (error) {
      console.error("❌ IPC test failed:", error);
      this.showError("Cannot connect to application backend. Please restart.");
      throw error;
    }
  }

  async handleSuccessfulLogin(user) {
    console.log("🎉 Handling successful login for user:", user);

    // Show success message
    const displayName =
      user.full_name || user.fullName || user.username || "User";
    this.showSuccess(`Welcome back, ${displayName}!`);

    // Store user info locally (optional)
    try {
      localStorage.setItem("currentUser", JSON.stringify(user));
      console.log("💾 User info stored in localStorage");
    } catch (storageError) {
      console.warn("Could not store user in localStorage:", storageError);
    }

    // Wait a moment to show success message
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Notify main process to switch to main window
    console.log("🚀 Attempting to send loginSuccessful event...");

    // First, check if the send method exists
    if (!window.electronAPI || typeof window.electronAPI.send !== "function") {
      console.error("❌ electronAPI.send method not available");
      this.showError("Application error: Cannot navigate to main window");
      return;
    }

    try {
      console.log("📤 Sending 'login-successful' event...");
      window.electronAPI.send("login-successful");
      console.log("✅ loginSuccessful event sent successfully");

      // Show a loading message while transitioning
      this.showNotification("Redirecting to main application...", "info");
    } catch (sendError) {
      console.error("❌ Failed to send loginSuccessful event:", sendError);
      console.error("Error details:", sendError.message);

      // Try alternative method: Use ipcRenderer directly if available
      if (window.ipcRenderer) {
        console.log("🔄 Trying ipcRenderer directly...");
        try {
          window.ipcRenderer.send("login-successful");
          console.log("✅ Sent via ipcRenderer directly");
        } catch (ipcError) {
          console.error("❌ ipcRenderer also failed:", ipcError);
        }
      }

      this.showError("Failed to proceed to main application. Please restart.");
    }
  }

  handleFailedLogin(errorMessage) {
    console.log("❌ Login failed:", errorMessage);
    this.showError(errorMessage);
    this.shakeForm();
    this.passwordInput.focus();
    this.passwordInput.select();
  }

  setLoadingState(loading) {
    if (loading) {
      this.loginBtn.disabled = true;
      this.loginBtnText.textContent = "Signing In...";
      this.loginSpinner.classList.remove("hidden");
    } else {
      this.loginBtn.disabled = false;
      this.loginBtnText.textContent = "Sign In";
      this.loginSpinner.classList.add("hidden");
    }
  }

  showError(message) {
    this.clearMessages();

    const errorDiv = document.createElement("div");
    errorDiv.className = "login-message error";
    errorDiv.innerHTML = `
      <i class="fa fa-exclamation-circle"></i>
      <span>${message}</span>
    `;

    this.loginForm.insertBefore(errorDiv, this.loginForm.firstChild);
  }

  showSuccess(message) {
    this.clearMessages();

    const successDiv = document.createElement("div");
    successDiv.className = "login-message success";
    successDiv.innerHTML = `
      <i class="fa fa-check-circle"></i>
      <span>${message}</span>
    `;

    this.loginForm.insertBefore(successDiv, this.loginForm.firstChild);
  }

  clearError() {
    this.clearMessages();
  }

  clearMessages() {
    const messages = this.loginForm.querySelectorAll(".login-message");
    messages.forEach((msg) => msg.remove());
  }

  shakeForm() {
    this.loginForm.classList.add("shake");
    setTimeout(() => {
      this.loginForm.classList.remove("shake");
    }, 500);
  }

  async loadAppVersion() {
    try {
      if (window.electronAPI && window.electronAPI.getAppVersion) {
        const version = await window.electronAPI.getAppVersion();
        document.getElementById(
          "app-version"
        ).textContent = `Version ${version}`;
        console.log("📱 App version loaded:", version);
      }
    } catch (error) {
      console.error("Failed to load app version:", error);
      document.getElementById("app-version").textContent = "Version 1.0.0";
    }
  }

  setCurrentYear() {
    const currentYear = new Date().getFullYear();
    document.getElementById("current-year").textContent = currentYear;
  }

  // Add a debug button for testing
  addDebugButton() {
    const debugBtn = document.createElement("button");
    debugBtn.id = "debug-login-btn";
    debugBtn.innerHTML = "🐛 Debug";
    debugBtn.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      padding: 8px 12px;
      background: #3498db;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
      opacity: 0.3;
      z-index: 1000;
      transition: opacity 0.3s;
    `;

    debugBtn.addEventListener("click", (e) => {
      e.preventDefault();
      this.runDebugTests();
    });

    debugBtn.addEventListener("dblclick", () => {
      debugBtn.style.opacity = debugBtn.style.opacity === "1" ? "0.3" : "1";
    });

    document.body.appendChild(debugBtn);
  }

  async runDebugTests() {
    console.log("🔍 === RUNNING DEBUG TESTS ===");

    const tests = [];

    // Test 1: Check electronAPI
    tests.push({
      name: "electronAPI exists",
      test: () => !!window.electronAPI,
    });

    // Test 2: Check userLogin method
    tests.push({
      name: "userLogin method exists",
      test: () =>
        window.electronAPI &&
        typeof window.electronAPI.userLogin === "function",
    });

    // Test 3: Check getAppVersion
    tests.push({
      name: "getAppVersion works",
      test: async () => {
        try {
          await window.electronAPI.getAppVersion();
          return true;
        } catch {
          return false;
        }
      },
    });

    // Test 4: Try simple login test
    if (window.electronAPI.testLoginSimple) {
      tests.push({
        name: "testLoginSimple works",
        test: async () => {
          try {
            const result = await window.electronAPI.testLoginSimple();
            return result && result.success === true;
          } catch {
            return false;
          }
        },
      });
    }

    // Test 5: Try actual login
    tests.push({
      name: "Actual login attempt",
      test: async () => {
        try {
          const result = await window.electronAPI.userLogin("admin", "admin");
          console.log("Actual login debug result:", result);
          return result !== undefined && result !== null;
        } catch (error) {
          console.error("Actual login error:", error);
          return false;
        }
      },
    });

    // Run all tests
    for (const test of tests) {
      try {
        const result =
          typeof test.test === "function" ? await test.test() : test.test;
        console.log(
          `${result ? "✅" : "❌"} ${test.name}: ${result ? "PASS" : "FAIL"}`
        );
      } catch (error) {
        console.error(`❌ ${test.name}: ERROR - ${error.message}`);
      }
    }

    console.log("=== DEBUG TESTS COMPLETE ===");

    // Show results in a notification
    this.showNotification(
      "Debug tests completed. Check console for results.",
      "info"
    );
  }

  showNotification(message, type = "info") {
    const notification = document.createElement("div");
    notification.className = `login-notification ${type}`;
    notification.textContent = message;
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 12px 20px;
      background: ${
        type === "info" ? "#3498db" : type === "success" ? "#2ecc71" : "#e74c3c"
      };
      color: white;
      border-radius: 8px;
      z-index: 1001;
      animation: slideIn 0.3s ease-out;
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.style.animation = "slideOut 0.3s ease-in";
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }

  // Utility method to validate credentials locally (optional)
  validateCredentials(username, password) {
    if (!username || !password) {
      return { valid: false, error: "Username and password are required" };
    }

    if (username.length < 2) {
      return { valid: false, error: "Username must be at least 2 characters" };
    }

    if (password.length < 4) {
      return { valid: false, error: "Password must be at least 4 characters" };
    }

    return { valid: true };
  }
}

// Add CSS for animations
const style = document.createElement("style");
style.textContent = `
  @keyframes slideIn {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }
  
  @keyframes slideOut {
    from { transform: translateX(0); opacity: 1; }
    to { transform: translateX(100%); opacity: 0; }
  }
  
  .shake {
    animation: shake 0.5s ease-in-out;
  }
  
  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
    20%, 40%, 60%, 80% { transform: translateX(5px); }
  }
`;
document.head.appendChild(style);

// Initialize login screen when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  console.log("🚀 LoginScreen initializing...");
  window.loginScreen = new LoginScreen(); // Expose for debugging
  console.log("✅ LoginScreen initialized");
});

// Handle any unhandled errors
window.addEventListener("error", (error) => {
  console.error("Unhandled error in login screen:", error);
});

// Export for potential testing
if (typeof module !== "undefined" && module.exports) {
  module.exports = LoginScreen;
}

// Add a global debug function for console testing
window.debugLogin = async function () {
  console.log("🔍 Global debugLogin function");
  if (window.loginScreen) {
    await window.loginScreen.runDebugTests();
  } else {
    console.error("LoginScreen not initialized");
  }
};
