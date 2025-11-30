class LicenseGate {
  constructor() {
    this.init();
  }

  init() {
    this.setupEventListeners();
    this.loadAppVersion();
    this.setCurrentYear();
  }

  setupEventListeners() {
    const form = document.getElementById("license-form");
    const licenseInput = document.getElementById("license-key");
    const activateBtn = document.getElementById("activate-btn");
    const purchaseLink = document.getElementById("purchase-link");
    const contactLink = document.getElementById("contact-link");

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      this.handleLicenseActivation();
    });

    // Format license key input
    licenseInput.addEventListener("input", (e) => {
      this.formatLicenseKey(e.target);
    });

    // Allow paste and auto-format
    licenseInput.addEventListener("paste", (e) => {
      setTimeout(() => {
        this.formatLicenseKey(e.target);
      }, 0);
    });

    // Handle external links
    purchaseLink.addEventListener("click", (e) => {
      e.preventDefault();
      this.openExternalLink("https://detale.co.ug/");
    });

    contactLink.addEventListener("click", (e) => {
      e.preventDefault();
      this.openEmailClient();
    });
  }

  formatLicenseKey(input) {
    // Remove all non-alphanumeric characters and convert to uppercase
    let value = input.value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();

    // Format as XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX (8 groups of 4)
    const groups = [];
    for (let i = 0; i < value.length; i += 4) {
      groups.push(value.substring(i, i + 4));
    }

    // Join with hyphens and limit to 32 characters (8 groups × 4 characters)
    value = groups.join("-").substring(0, 39); // 32 chars + 7 hyphens

    input.value = value;
  }

  async loadAppVersion() {
    try {
      // Get version from package.json via Electron
      if (window.electronAPI && window.electronAPI.getAppVersion) {
        const version = await window.electronAPI.getAppVersion();
        document.getElementById("app-version").textContent = version;
      }
    } catch (error) {
      console.error("Failed to load app version:", error);
    }
  }

  async setCurrentYear() {
    const currentYear = new Date().getFullYear();
    document.getElementById("current-year").textContent = currentYear;
  }

  async handleLicenseActivation() {
    const licenseKey = document.getElementById("license-key").value.trim();
    const activateBtn = document.getElementById("activate-btn");

    if (!licenseKey) {
      this.showError("Please enter a license key");
      return;
    }

    // Validate format: 8 groups of 4 alphanumeric characters separated by hyphens
    const licenseRegex =
      /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;

    if (!licenseRegex.test(licenseKey)) {
      this.showError(
        "Please enter a valid license key format: XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX"
      );
      return;
    }

    // Show loading state
    activateBtn.disabled = true;
    activateBtn.innerHTML = '<div class="spinner"></div> Activating...';

    try {
      console.log("Validating license key:", licenseKey);
      const result = await window.electronAPI.validateLicense(licenseKey);
      console.log("License validation result:", result);

      if (
        result.valid &&
        (result.code === "VALID" || result.code === "EXPIRED")
      ) {
        this.showSuccess(
          "License activated successfully! Redirecting to application..."
        );

        // Notify main process that license was activated successfully
        window.electronAPI.send("license-activated");

        // Add a small delay to show success message before redirect
        setTimeout(() => {
          // The main process will handle the transition
        }, 2000);
      } else {
        const error = result.errors?.[0];
        if (error?.code === "NETWORK_ERROR") {
          this.showError(
            "No internet connection. Please check your connection and try again."
          );
        } else if (error?.code === "FINGERPRINT_SCOPE_MISMATCH") {
          this.showError(
            "This license is already activated on another device."
          );
        } else if (error?.code === "EXPIRED") {
          this.showError(
            "Your license has expired. Please renew your license."
          );
        } else {
          this.showError(
            "Invalid license key. Please check your key and try again."
          );
        }
      }
    } catch (error) {
      console.error("License activation error:", error);
      this.showError("Failed to activate license. Please try again.");
    } finally {
      // Reset button state
      activateBtn.disabled = false;
      activateBtn.innerHTML = '<i class="fas fa-key"></i> Activate License';
    }
  }

  openExternalLink(url) {
    if (window.electronAPI && window.electronAPI.openExternal) {
      window.electronAPI.openExternal(url);
    } else {
      // Fallback for browser environment
      window.open(url, "_blank");
    }
  }

  openEmailClient() {
    const email = "support@detale.co.ug";
    const subject = "Endo-Stat License Support";
    const body =
      "Hello Detale Support Team,\n\nI need assistance with my Endo-Stat license.\n\n";

    const mailtoLink = `mailto:${email}?subject=${encodeURIComponent(
      subject
    )}&body=${encodeURIComponent(body)}`;

    if (window.electronAPI && window.electronAPI.openExternal) {
      window.electronAPI.openExternal(mailtoLink);
    } else {
      // Fallback for browser environment
      window.location.href = mailtoLink;
    }
  }

  showError(message) {
    this.showMessage(message, "error");
  }

  showSuccess(message) {
    this.showMessage(message, "success");
  }

  showMessage(message, type) {
    // Remove existing messages
    const existingMessage = document.querySelector(".license-message");
    if (existingMessage) {
      existingMessage.remove();
    }

    // Create new message
    const messageDiv = document.createElement("div");
    messageDiv.className = `license-message ${type}`;
    messageDiv.textContent = message;

    const form = document.getElementById("license-form");
    form.parentNode.insertBefore(messageDiv, form);

    // Auto-remove after 5 seconds (except for success which might need longer for redirect)
    if (type === "error") {
      setTimeout(() => {
        if (messageDiv.parentNode) {
          messageDiv.remove();
        }
      }, 5000);
    }
  }
}

// Initialize the license gate when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  new LicenseGate();
});
