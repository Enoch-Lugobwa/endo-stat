// main.js - Custom JavaScript for Endo-Stat
class EndoStatApp {
  constructor() {
    this.currentUser = null;
    this.patients = [];
    this.users = [];
    this.licenseStatus = null;
    this.init();
  }

  async init() {
    await this.loadCurrentUser();
    await this.loadLicenseStatus();
    await this.debugLicenseStatus();
    await this.loadPatients();
    this.setupEventListeners();
    this.updateDashboard();
    this.checkLicenseExpiry();
  }

  async loadCurrentUser() {
    try {
      const userData = await window.electronAPI.getUserSession();
      console.log("Loaded user session:", userData);
      if (userData) {
        this.currentUser = userData;
        document.getElementById("current-user").textContent =
          userData.fullName || userData.username || "User";
      } else {
        console.warn("No user session found");
        document.getElementById("current-user").textContent = "User";
      }
    } catch (error) {
      console.error("Error loading current user:", error);
      document.getElementById("current-user").textContent = "User";
    }
  }

  async loadLicenseStatus() {
    try {
      this.licenseStatus = await window.electronAPI.getLicenseStatus();
      console.log("Loaded license status:", this.licenseStatus);
      this.updateLicenseDisplay();
    } catch (error) {
      console.error("Error loading license status:", error);
      this.licenseStatus = { valid: false };
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

  async loadPatients() {
    try {
      const patients = await window.electronAPI.dbQuery(
        "SELECT * FROM patients ORDER BY created_at DESC LIMIT 10"
      );
      console.log("Loaded patients:", patients?.length || 0);
      if (patients) {
        this.patients = patients;
        this.renderPatientsTable();
        this.updatePatientCount();
      }
    } catch (error) {
      console.error("Error loading patients:", error);
      this.showNotification("Error loading patients", "error");
    }
  }

  async loadUsers() {
    try {
      const users = await window.electronAPI.dbQuery(
        "SELECT * FROM users ORDER BY created_at DESC"
      );
      console.log("Loaded users:", users?.length || 0);
      if (users) {
        this.users = users;
        this.renderUsersTable();
      }
    } catch (error) {
      console.error("Error loading users:", error);
      this.showNotification("Error loading users", "error");
    }
  }

  updateLicenseDisplay() {
    const statusBadge = document.querySelector(".status-badge.success");
    if (!statusBadge) {
      console.warn("License status badge not found");
      return;
    }

    console.log("Updating license display with:", this.licenseStatus);

    if (this.licenseStatus && this.licenseStatus.valid) {
      if (this.licenseStatus.expiresAt) {
        const expiresAt = new Date(this.licenseStatus.expiresAt);
        const now = new Date();
        const daysLeft = Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24));

        console.log("License expiry check:", {
          expiresAt: this.licenseStatus.expiresAt,
          daysLeft: daysLeft,
          valid: this.licenseStatus.valid,
        });

        if (daysLeft <= 0) {
          // License has expired
          statusBadge.className = "status-badge danger";
          statusBadge.innerHTML = `<i class="fa fa-exclamation-circle"></i> License Expired`;
          this.showNotification(
            "Your license has expired. Please renew immediately.",
            "error",
            10000
          );
        } else if (daysLeft <= 60) {
          // Less than 2 months
          if (daysLeft <= 14) {
            // Critical: less than 2 weeks
            statusBadge.className = "status-badge danger";
            statusBadge.innerHTML = `<i class="fa fa-exclamation-triangle"></i> ${daysLeft} days left`;
          } else {
            // Warning: less than 2 months
            statusBadge.className = "status-badge warning";
            statusBadge.innerHTML = `<i class="fa fa-exclamation-triangle"></i> ${daysLeft} days left`;
          }

          if (daysLeft <= 30) {
            this.showNotification(
              `License expires in ${daysLeft} days. Please renew soon.`,
              "warning"
            );
          }
        } else {
          // More than 2 months - show licensed with days
          statusBadge.className = "status-badge success";
          statusBadge.innerHTML = `<i class="fa fa-check-circle"></i> Licensed (${daysLeft} days)`;
        }
      } else {
        // No expiry date - perpetual license
        statusBadge.className = "status-badge success";
        statusBadge.innerHTML = `<i class="fa fa-check-circle"></i> Licensed`;
      }
    } else {
      // Invalid license
      statusBadge.className = "status-badge danger";
      statusBadge.innerHTML = `<i class="fa fa-exclamation-circle"></i> Unlicensed`;
    }
  }

  checkLicenseExpiry() {
    if (
      this.licenseStatus &&
      this.licenseStatus.valid &&
      this.licenseStatus.expiresAt
    ) {
      const expiresAt = new Date(this.licenseStatus.expiresAt);
      const now = new Date();
      const daysLeft = Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24));

      console.log("License expiry warning check:", { daysLeft });

      if (daysLeft <= 0) {
        this.showNotification(
          "❌ Your license has expired. Please renew immediately to continue using Endo-Stat.",
          "error",
          15000
        );
      } else if (daysLeft <= 7) {
        this.showNotification(
          `⚠️ CRITICAL: Your license expires in ${daysLeft} days. Please renew immediately.`,
          "error",
          10000
        );
      } else if (daysLeft <= 30) {
        this.showNotification(
          `⚠️ Warning: Your license expires in ${daysLeft} days. Please renew soon.`,
          "warning",
          8000
        );
      }
    }
  }

  renderPatientsTable() {
    const tbody = document.getElementById("patients-tbody");
    if (!tbody) {
      console.warn("Patients table body not found");
      return;
    }

    if (this.patients.length === 0) {
      tbody.innerHTML = `
        <tr class="empty-row">
          <td colspan="7" class="empty-message">
            <i class="fa fa-users"></i>
            <span>No patients found. Add your first patient to get started.</span>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = this.patients
      .map((patient) => {
        const age = patient.date_of_birth
          ? this.calculateAge(patient.date_of_birth)
          : "N/A";
        return `
          <tr>
            <td><strong>${patient.patient_id || "N/A"}</strong></td>
            <td>${patient.first_name} ${patient.last_name}</td>
            <td><span class="badge info">${patient.gender || "N/A"}</span></td>
            <td>${age}</td>
            <td>${patient.phone_number || "N/A"}</td>
            <td><small class="text-muted">${this.formatDate(
              patient.created_at
            )}</small></td>
            <td>
              <div class="table-actions">
                <button class="btn-icon primary" onclick="app.viewPatient(${
                  patient.id
                })" title="View Patient">
                  <i class="fa fa-eye"></i>
                </button>
                <button class="btn-icon success" onclick="app.startNewVisit(${
                  patient.id
                })" title="New Visit">
                  <i class="fa fa-plus"></i>
                </button>
              </div>
            </td>
          </tr>
        `;
      })
      .join("");
  }

  renderUsersTable() {
    const tbody = document.getElementById("users-tbody");
    if (!tbody) {
      console.warn("Users table body not found");
      return;
    }

    if (this.users.length === 0) {
      tbody.innerHTML = `
        <tr class="empty-row">
          <td colspan="6" class="empty-message">
            <i class="fa fa-users"></i>
            <span>No users found.</span>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = this.users
      .map(
        (user) => `
        <tr>
          <td>${user.username}</td>
          <td>${user.full_name}</td>
          <td><span class="badge ${
            user.role === "admin" ? "danger" : "primary"
          }">${user.role}</span></td>
          <td><span class="badge ${user.is_active ? "success" : "warning"}">${
          user.is_active ? "Active" : "Inactive"
        }</span></td>
          <td><small>${this.formatDate(user.created_at)}</small></td>
          <td>
            <div class="table-actions">
              <button class="btn-icon warning" onclick="app.editUser(${
                user.id
              })" title="Edit User">
                <i class="fa fa-edit"></i>
              </button>
              ${
                user.username !== "admin"
                  ? `
              <button class="btn-icon ${
                user.is_active ? "danger" : "success"
              }" onclick="app.toggleUserStatus(${user.id}, ${
                      user.is_active
                    })" title="${user.is_active ? "Deactivate" : "Activate"}">
                <i class="fa ${user.is_active ? "fa-ban" : "fa-check"}"></i>
              </button>
              `
                  : ""
              }
            </div>
          </td>
        </tr>
      `
      )
      .join("");
  }

  updateDashboard() {
    const totalPatientsEl = document.getElementById("total-patients");
    const patientCountEl = document.getElementById("patient-count");

    if (totalPatientsEl) {
      totalPatientsEl.textContent = this.patients.length;
    }
    if (patientCountEl) {
      patientCountEl.textContent = this.patients.length;
    }
  }

  updatePatientCount() {
    const patientCountEl = document.getElementById("patient-count");
    if (patientCountEl) {
      patientCountEl.textContent = this.patients.length;
    }
  }

  setupEventListeners() {
    console.log("Setting up event listeners...");

    // Navigation - User Management and Settings
    document.querySelectorAll("[data-view]").forEach((link) => {
      link.addEventListener("click", (e) => {
        e.preventDefault();
        const viewName = e.target
          .closest("[data-view]")
          .getAttribute("data-view");
        console.log("Navigating to view:", viewName);
        this.navigateToView(viewName);
      });
    });

    // Quick Actions
    document.querySelectorAll("[data-action]").forEach((button) => {
      button.addEventListener("click", (e) => {
        const action = e.target
          .closest("[data-action]")
          .getAttribute("data-action");
        console.log("Action triggered:", action);
        this.handleAction(action);
      });
    });

    // Logout
    const logoutBtn = document.getElementById("logout-btn");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", (e) => {
        e.preventDefault();
        console.log("Logout initiated");
        this.logout();
      });
    } else {
      console.warn("Logout button not found");
    }

    // User menu dropdown
    const userMenu = document.querySelector(".user-menu");
    if (userMenu) {
      userMenu.addEventListener("click", (e) => {
        e.stopPropagation();
        userMenu.classList.toggle("active");
      });

      // Close dropdown when clicking outside
      document.addEventListener("click", (e) => {
        if (!e.target.closest(".user-menu")) {
          userMenu.classList.remove("active");
        }
      });
    } else {
      console.warn("User menu not found");
    }
  }

  navigateToView(viewName) {
    console.log("Navigating to view:", viewName);

    // Hide all views
    document.querySelectorAll(".view-container").forEach((view) => {
      view.classList.remove("active");
    });

    // Show selected view
    const targetView = document.getElementById(`${viewName}-view`);
    if (targetView) {
      targetView.classList.add("active");
      console.log(`View ${viewName} activated`);

      // Load data for specific views
      if (viewName === "user-management") {
        this.loadUsers();
      } else if (viewName === "settings") {
        this.loadSettings();
      }
    } else {
      console.warn(`Target view not found: ${viewName}-view`);
      this.showNotification(`View '${viewName}' not implemented yet`, "info");
    }
  }

  handleAction(action) {
    console.log("Handling action:", action);
    switch (action) {
      case "new-patient":
        this.showNewPatientModal();
        break;
      case "new-visit":
        this.showNewVisitModal();
        break;
      case "manage-examiners":
        this.navigateToView("examiners");
        break;
      case "manage-referrers":
        this.navigateToView("referrers");
        break;
      case "view-all-patients":
        this.navigateToView("patients");
        break;
      case "add-user":
        this.showAddUserModal();
        break;
      default:
        console.warn("Unknown action:", action);
        this.showNotification(`Action '${action}' not implemented yet`, "info");
    }
  }

  async logout() {
    try {
      console.log("Starting logout process...");
      const result = await window.electronAPI.userLogout();
      console.log("Logout result:", result);

      if (result && result.success) {
        this.showNotification("Logout successful", "success");
        // Wait a moment before closing to show the notification
        setTimeout(() => {
          // Close the window or redirect to login
          if (window.electronAPI && window.electronAPI.send) {
            window.electronAPI.send("close-window");
          } else {
            window.close();
          }
        }, 1000);
      } else {
        const errorMsg = result?.error || "Unknown error";
        console.error("Logout failed:", errorMsg);
        this.showNotification(`Logout failed: ${errorMsg}`, "error");
      }
    } catch (error) {
      console.error("Error during logout:", error);
      this.showNotification("Logout failed: " + error.message, "error");
    }
  }

  async loadSettings() {
    try {
      console.log("Loading settings...");
      // Implement settings loading logic here
      this.showNotification("Settings loaded", "info");
    } catch (error) {
      console.error("Error loading settings:", error);
      this.showNotification("Error loading settings", "error");
    }
  }

  // Utility methods
  calculateAge(dateOfBirth) {
    if (!dateOfBirth) return "N/A";
    const today = new Date();
    const birthDate = new Date(dateOfBirth);

    if (isNaN(birthDate.getTime())) return "N/A";

    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < birthDate.getDate())
    ) {
      age--;
    }

    return age;
  }

  formatDate(dateString) {
    if (!dateString) return "Never";
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "Invalid Date";
    return date.toLocaleDateString();
  }

  // Modal methods - need implementation
  showNewPatientModal() {
    console.log("Show new patient modal");
    this.showNotification("New patient feature coming soon", "info");
    // Implementation for new patient modal
  }

  showNewVisitModal() {
    console.log("Show new visit modal");
    this.showNotification("New visit feature coming soon", "info");
    // Implementation for new visit modal
  }

  showAddUserModal() {
    console.log("Show add user modal");
    this.showNotification("Add user feature coming soon", "info");
    // Implementation for add user modal
  }

  viewPatient(patientId) {
    console.log("View patient:", patientId);
    this.showNotification(
      `View patient ${patientId} - feature coming soon`,
      "info"
    );
    // Implementation for viewing patient details
  }

  startNewVisit(patientId) {
    console.log("Start new visit for patient:", patientId);
    this.showNotification(
      `New visit for patient ${patientId} - feature coming soon`,
      "info"
    );
    // Implementation for starting new visit
  }

  editUser(userId) {
    console.log("Edit user:", userId);
    this.showNotification(`Edit user ${userId} - feature coming soon`, "info");
    // Implementation for editing user
  }

  async toggleUserStatus(userId, currentStatus) {
    try {
      console.log(
        `Toggling user ${userId} status from ${currentStatus} to ${!currentStatus}`
      );

      const result = await window.electronAPI.dbQuery(
        "UPDATE users SET is_active = ? WHERE id = ?",
        [!currentStatus, userId]
      );

      console.log("Toggle user status result:", result);

      if (result && result.changes > 0) {
        await this.loadUsers();
        this.showNotification(
          `User ${!currentStatus ? "activated" : "deactivated"} successfully`,
          "success"
        );
      } else {
        this.showNotification("Error updating user status", "error");
      }
    } catch (error) {
      console.error("Error toggling user status:", error);
      this.showNotification(
        "Error updating user status: " + error.message,
        "error"
      );
    }
  }

  showNotification(message, type = "info", duration = 3000) {
    // Remove existing notifications
    const existingNotifications = document.querySelectorAll(
      ".custom-notification"
    );
    existingNotifications.forEach((notification) => {
      if (notification.parentNode) {
        notification.remove();
      }
    });

    // Create new notification
    const notification = document.createElement("div");
    notification.className = `custom-notification ${type}`;
    notification.innerHTML = `
      <div class="notification-content">
        <i class="fa ${this.getNotificationIcon(type)}"></i>
        <span>${message}</span>
      </div>
    `;

    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 12px 20px;
      background: ${this.getNotificationColor(type)};
      color: white;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 10000;
      max-width: 400px;
      animation: slideInRight 0.3s ease-out;
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.style.animation = "slideOutRight 0.3s ease-in";
      setTimeout(() => {
        if (notification.parentNode) {
          notification.remove();
        }
      }, 300);
    }, duration);
  }

  getNotificationIcon(type) {
    const icons = {
      info: "fa-info-circle",
      success: "fa-check-circle",
      warning: "fa-exclamation-triangle",
      error: "fa-exclamation-circle",
    };
    return icons[type] || "fa-info-circle";
  }

  getNotificationColor(type) {
    const colors = {
      info: "#3498db",
      success: "#2ecc71",
      warning: "#f39c12",
      error: "#e74c3c",
    };
    return colors[type] || "#3498db";
  }
}

// Add CSS animations for notifications
if (!document.querySelector("#notification-styles")) {
  const style = document.createElement("style");
  style.id = "notification-styles";
  style.textContent = `
    @keyframes slideInRight {
      from {
        transform: translateX(100%);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
    
    @keyframes slideOutRight {
      from {
        transform: translateX(0);
        opacity: 1;
      }
      to {
        transform: translateX(100%);
        opacity: 0;
      }
    }
    
    .custom-notification {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
  `;
  document.head.appendChild(style);
}

// Initialize the application when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  console.log("DOM loaded, initializing EndoStatApp...");
  window.app = new EndoStatApp();
});

// Handle errors
window.addEventListener("error", (error) => {
  console.error("Global error:", error);
});
