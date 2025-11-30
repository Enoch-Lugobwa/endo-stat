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
      // Send login request to main process
      const result = await window.electronAPI.userLogin(username, password);

      if (result.success) {
        await this.handleSuccessfulLogin(result.user);
      } else {
        this.handleFailedLogin(result.error);
      }
    } catch (error) {
      console.error("Login error:", error);
      this.handleFailedLogin(
        "Login failed due to a system error. Please try again."
      );
    } finally {
      this.setLoadingState(false);
    }
  }

  async handleSuccessfulLogin(user) {
    // Show success message
    this.showSuccess(`Welcome back, ${user.full_name || user.username}!`);

    // Store user info locally (optional)
    localStorage.setItem("currentUser", JSON.stringify(user));

    // Wait a moment to show success message
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Notify main process to switch to main window
    window.electronAPI.loginSuccessful();
  }

  handleFailedLogin(errorMessage) {
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
    errorDiv.textContent = message;

    this.loginForm.insertBefore(errorDiv, this.loginForm.firstChild);
  }

  showSuccess(message) {
    this.clearMessages();

    const successDiv = document.createElement("div");
    successDiv.className = "login-message success";
    successDiv.textContent = message;

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
      const result = await window.electronAPI.userLogin(username, password);
      console.log("📨 Login response received:", result);

      if (result.success) {
        await this.handleSuccessfulLogin(result.user);
      } else {
        this.handleFailedLogin(result.error);
      }
    } catch (error) {
      console.error("💥 Login error:", error);
      console.error("📋 Error details:", error.message);
      this.handleFailedLogin(
        "Login failed due to a system error. Please try again."
      );
    } finally {
      this.setLoadingState(false);
    }
  }

  async loadAppVersion() {
    try {
      if (window.electronAPI && window.electronAPI.getAppVersion) {
        const version = await window.electronAPI.getAppVersion();
        document.getElementById(
          "app-version"
        ).textContent = `Version ${version}`;
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

// Initialize login screen when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  new LoginScreen();
});

// Handle any unhandled errors
window.addEventListener("error", (error) => {
  console.error("Unhandled error in login screen:", error);
});

// Export for potential testing
if (typeof module !== "undefined" && module.exports) {
  module.exports = LoginScreen;
}
