// main.js - Enhanced JavaScript for Endo-Stat
class EndoStatApp {
  constructor() {
    this.currentUser = null;
    this.patients = [];
    this.users = [];
    this.licenseStatus = null;
    this.currentPage = 1;
    this.patientsPerPage = 10;
    this.searchTerm = "";
    this.init();
  }

  async init() {
    await this.loadAppVersion();
    await this.loadCurrentUser();
    await this.loadLicenseStatus();
    await this.loadPatients();
    this.setCurrentDate();
    this.setupEventListeners();
    this.updateDashboard();
    this.checkLicenseExpiry();
    this.setupUpdateListeners();
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

  async loadCurrentUser() {
    try {
      const userData = await window.electronAPI.getUserSession();
      console.log("Loaded user session:", userData);
      if (userData) {
        this.currentUser = userData;
        document.getElementById("current-user").textContent =
          userData.fullName || userData.username || "User";
        document.getElementById("current-user-role").textContent =
          userData.role || "User";
      } else {
        console.warn("No user session found");
        document.getElementById("current-user").textContent = "User";
        document.getElementById("current-user-role").textContent = "User";
      }
    } catch (error) {
      console.error("Error loading current user:", error);
      document.getElementById("current-user").textContent = "User";
      document.getElementById("current-user-role").textContent = "User";
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

  setCurrentDate() {
    const now = new Date();
    const options = {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    };
    const dateString = now.toLocaleDateString("en-US", options);
    document.getElementById("current-date").textContent = dateString;
    document.getElementById("todays-date").textContent = now.toLocaleDateString(
      "en-US",
      { month: "short", day: "numeric" }
    );
  }

  async loadPatients() {
    try {
      let query = "SELECT * FROM patients";
      const params = [];

      if (this.searchTerm) {
        query +=
          " WHERE first_name LIKE ? OR last_name LIKE ? OR patient_id LIKE ?";
        const searchParam = `%${this.searchTerm}%`;
        params.push(searchParam, searchParam, searchParam);
      }

      query += " ORDER BY created_at DESC";

      const patients = await window.electronAPI.dbQuery(query, params);
      console.log("Loaded patients:", patients?.length || 0);
      if (patients) {
        this.allPatients = patients;
        this.updatePagination();
        this.renderPatientsTable();
        this.updatePatientCount();
      }
    } catch (error) {
      console.error("Error loading patients:", error);
      this.showNotification("Error loading patients", "error");
    }
  }

  updatePagination() {
    const totalPatients = this.allPatients?.length || 0;
    const totalPages = Math.ceil(totalPatients / this.patientsPerPage);
    const startIndex = (this.currentPage - 1) * this.patientsPerPage;
    const endIndex = startIndex + this.patientsPerPage;

    this.patients = this.allPatients?.slice(startIndex, endIndex) || [];

    // Update pagination controls
    document.getElementById("showing-count").textContent = Math.min(
      this.patients.length,
      this.patientsPerPage
    );
    document.getElementById("total-count").textContent = totalPatients;
    document.getElementById("current-page").textContent = this.currentPage;

    const prevBtn = document.getElementById("prev-page");
    const nextBtn = document.getElementById("next-page");

    prevBtn.disabled = this.currentPage === 1;
    nextBtn.disabled = this.currentPage === totalPages || totalPages === 0;
  }

  updateLicenseDisplay() {
    const statusBadge = document.querySelector(".license-status");
    const statusText = document.getElementById("license-status-text");
    const statusValue = document.getElementById("license-status-value");

    if (!statusBadge || !statusText || !statusValue) {
      console.warn("License display elements not found");
      return;
    }

    console.log("Updating license display with:", this.licenseStatus);

    if (this.licenseStatus && this.licenseStatus.valid) {
      if (this.licenseStatus.expiresAt) {
        const expiresAt = new Date(this.licenseStatus.expiresAt);
        const now = new Date();
        const daysLeft = Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24));

        console.log("License expiry check:", { daysLeft });

        if (daysLeft <= 0) {
          // License has expired
          statusBadge.className = "status-badge license-status danger";
          statusText.textContent = "License Expired";
          statusValue.textContent = "Expired";
          this.showNotification(
            "Your license has expired. Please renew immediately.",
            "error",
            10000
          );
        } else if (daysLeft <= 60) {
          // Less than 2 months
          if (daysLeft <= 14) {
            // Critical: less than 2 weeks
            statusBadge.className = "status-badge license-status danger";
            statusText.textContent = `${daysLeft} days left`;
            statusValue.textContent = `Expires in ${daysLeft} days`;
          } else {
            // Warning: less than 2 months
            statusBadge.className = "status-badge license-status warning";
            statusText.textContent = `${daysLeft} days left`;
            statusValue.textContent = `Expires in ${daysLeft} days`;
          }

          if (daysLeft <= 30) {
            this.showNotification(
              `License expires in ${daysLeft} days. Please renew soon.`,
              "warning"
            );
          }
        } else {
          // More than 2 months - show licensed with days
          statusBadge.className = "status-badge license-status success";
          statusText.textContent = `Licensed (${daysLeft} days)`;
          statusValue.textContent = `Active (${daysLeft} days)`;
        }
      } else {
        // No expiry date - perpetual license
        statusBadge.className = "status-badge license-status success";
        statusText.textContent = "Licensed";
        statusValue.textContent = "Active";
      }
    } else {
      // Invalid license
      statusBadge.className = "status-badge license-status danger";
      statusText.textContent = "Unlicensed";
      statusValue.textContent = "Invalid";
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
            <span>${
              this.searchTerm
                ? "No patients match your search"
                : "No patients found. Add your first patient to get started."
            }</span>
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
        const lastVisit = patient.updated_at || patient.created_at;
        return `
          <tr>
            <td><strong>${patient.patient_id || "N/A"}</strong></td>
            <td>
              <div class="patient-name">
                <strong>${patient.first_name} ${patient.last_name}</strong>
                ${
                  patient.email
                    ? `<div class="patient-email">${patient.email}</div>`
                    : ""
                }
              </div>
            </td>
            <td><span class="badge ${
              patient.gender === "Male"
                ? "info"
                : patient.gender === "Female"
                ? "primary"
                : "warning"
            }">${patient.gender || "N/A"}</span></td>
            <td><span class="age-badge">${age}</span></td>
            <td>${patient.phone_number || "N/A"}</td>
            <td><small class="text-muted">${this.formatDate(
              lastVisit
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
                <button class="btn-icon warning" onclick="app.editPatient(${
                  patient.id
                })" title="Edit Patient">
                  <i class="fa fa-edit"></i>
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
          <td>
            <div class="user-info-cell">
              <strong>${user.username}</strong>
              ${user.email ? `<div class="user-email">${user.email}</div>` : ""}
            </div>
          </td>
          <td>${user.full_name}</td>
          <td><span class="badge ${
            user.role === "admin"
              ? "danger"
              : user.role === "doctor"
              ? "info"
              : "primary"
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
      totalPatientsEl.textContent = this.allPatients?.length || 0;
    }
    if (patientCountEl) {
      patientCountEl.textContent = this.allPatients?.length || 0;
    }

    // Update today's visits (placeholder - implement based on your data)
    const todayVisitsEl = document.getElementById("today-visits");
    if (todayVisitsEl) {
      const today = new Date().toISOString().split("T")[0];
      const todaysPatients =
        this.allPatients?.filter(
          (p) => p.created_at && p.created_at.startsWith(today)
        ) || [];
      todayVisitsEl.textContent = todaysPatients.length;
    }
  }

  setupEventListeners() {
    console.log("Setting up event listeners...");

    // Navigation
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
    }

    // User menu dropdown
    const userMenu = document.querySelector(".user-menu");
    if (userMenu) {
      userMenu.addEventListener("click", (e) => {
        e.stopPropagation();
        userMenu.classList.toggle("active");
      });

      document.addEventListener("click", (e) => {
        if (!e.target.closest(".user-menu")) {
          userMenu.classList.remove("active");
        }
      });
    }

    // Patient search
    const searchInput = document.getElementById("patient-search");
    if (searchInput) {
      let searchTimeout;
      searchInput.addEventListener("input", (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
          this.searchTerm = e.target.value.trim();
          this.currentPage = 1;
          this.loadPatients();
        }, 300);
      });
    }

    // Pagination
    document.getElementById("prev-page")?.addEventListener("click", () => {
      if (this.currentPage > 1) {
        this.currentPage--;
        this.updatePagination();
        this.renderPatientsTable();
      }
    });

    document.getElementById("next-page")?.addEventListener("click", () => {
      const totalPages = Math.ceil(
        (this.allPatients?.length || 0) / this.patientsPerPage
      );
      if (this.currentPage < totalPages) {
        this.currentPage++;
        this.updatePagination();
        this.renderPatientsTable();
      }
    });

    // Update check buttons
    const checkUpdateBtns = document.querySelectorAll(
      "#check-updates-btn, #dashboard-update-btn"
    );
    checkUpdateBtns.forEach((btn) => {
      btn.addEventListener("click", () => this.checkForUpdates());
    });

    // Modal close buttons
    document
      .querySelectorAll(
        ".modal-close, [data-action='close-update-modal'], [data-action='cancel-update']"
      )
      .forEach((btn) => {
        btn.addEventListener("click", () => {
          this.closeUpdateModal();
        });
      });
  }

  setupUpdateListeners() {
    // Listen for update events from main process
    if (window.electronAPI && window.electronAPI.on) {
      window.electronAPI.on("update-download-progress", (progress) => {
        this.showUpdateProgress(progress);
      });

      window.electronAPI.on("update-downloaded", (info) => {
        this.showUpdateReady(info);
      });

      window.electronAPI.on("update-notification", (data) => {
        this.showNotification(data.message, "info");
      });
    }
  }

  async checkForUpdates() {
    try {
      this.showNotification("Checking for updates...", "info");
      const result = await window.electronAPI.checkForUpdatesManually();

      if (result.status === "update-available") {
        this.showNotification(`Update ${result.version} available!`, "success");
        // Auto-updater should automatically start download based on our configuration
      } else if (result.status === "update-not-available") {
        this.showNotification("You're using the latest version", "success");
      } else {
        this.showNotification(
          `Update check failed: ${result.message}`,
          "error"
        );
      }
    } catch (error) {
      console.error("Error checking for updates:", error);
      this.showNotification("Failed to check for updates", "error");
    }
  }

  showUpdateProgress(progress) {
    const modal = document.getElementById("update-progress-modal");
    const progressFill = document.getElementById("update-progress-fill");
    const progressPercent = document.getElementById("update-progress-percent");
    const progressSpeed = document.getElementById("update-progress-speed");
    const downloaded = document.getElementById("update-downloaded");
    const total = document.getElementById("update-total");
    const timeRemaining = document.getElementById("update-time-remaining");

    if (!modal) return;

    // Show modal
    modal.classList.add("active");

    // Update progress
    const percent = Math.round(progress.percent);
    progressFill.style.width = `${percent}%`;
    progressPercent.textContent = `${percent}%`;
    progressSpeed.textContent =
      this.formatBytes(progress.bytesPerSecond) + "/s";
    downloaded.textContent = this.formatBytes(progress.transferred);
    total.textContent = this.formatBytes(progress.total);

    // Calculate time remaining
    if (progress.bytesPerSecond > 0) {
      const remainingBytes = progress.total - progress.transferred;
      const secondsRemaining = remainingBytes / progress.bytesPerSecond;
      const minutesRemaining = Math.ceil(secondsRemaining / 60);
      timeRemaining.textContent = `${minutesRemaining} minute${
        minutesRemaining !== 1 ? "s" : ""
      }`;
    }
  }

  showUpdateReady(info) {
    this.closeUpdateModal();
    this.showNotification(
      `Update ${info.version} downloaded and ready to install!`,
      "success",
      5000
    );
  }

  closeUpdateModal() {
    const modal = document.getElementById("update-progress-modal");
    if (modal) {
      modal.classList.remove("active");
    }
  }

  navigateToView(viewName) {
    document.querySelectorAll(".view-container").forEach((view) => {
      view.classList.remove("active");
    });

    const targetView = document.getElementById(`${viewName}-view`);
    if (targetView) {
      targetView.classList.add("active");
      console.log(`View ${viewName} activated`);

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
      case "view-all-patients":
        this.currentPage = 1;
        this.searchTerm = "";
        document.getElementById("patient-search").value = "";
        this.loadPatients();
        break;
      case "add-user":
        this.showAddUserModal();
        break;
      case "check-updates":
        this.checkForUpdates();
        break;
      case "quick-stats":
        this.showQuickStats();
        break;
      case "generate-report":
        this.generateReport();
        break;
      default:
        console.warn("Unknown action:", action);
        this.showNotification(`Action '${action}' not implemented yet`, "info");
    }
  }

  async logout() {
    try {
      console.log("Logging out...");

      // 1. Clear the stored session
      const response = await window.electronAPI.userLogout();

      if (response.success) {
        console.log("Session cleared, redirecting to login...");

        // 2. Tell the main process to show the login window
        window.electronAPI.send("logout-successful");
      } else {
        console.error("Logout failed:", response.error);
      }
    } catch (error) {
      console.error("Logout error:", error);
    }
  }

  async loadSettings() {
    try {
      console.log("Loading settings...");
      this.showNotification("Settings loaded", "info");
    } catch (error) {
      console.error("Error loading settings:", error);
      this.showNotification("Error loading settings", "error");
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

  formatBytes(bytes) {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }

  // New methods for enhanced features
  showQuickStats() {
    const stats = {
      totalPatients: this.allPatients?.length || 0,
      todayVisits:
        this.allPatients?.filter(
          (p) =>
            p.created_at &&
            new Date(p.created_at).toDateString() === new Date().toDateString()
        ).length || 0,
      monthlyGrowth: "+15%", // Placeholder
      activeUsers: this.users?.filter((u) => u.is_active).length || 0,
    };

    const message = `📊 Quick Stats:\n
    • Total Patients: ${stats.totalPatients}
    • Today's Visits: ${stats.todayVisits}
    • Monthly Growth: ${stats.monthlyGrowth}
    • Active Users: ${stats.activeUsers}`;

    this.showNotification("Quick stats displayed in console", "info");
    console.log(message);
  }

  generateReport() {
    this.showNotification("Report generation feature coming soon", "info");
  }

  showNewPatientModal() {
    console.log("Show new patient modal");
    this.showNotification("New patient feature coming soon", "info");
  }

  showNewVisitModal() {
    console.log("Show new visit modal");
    this.showNotification("New visit feature coming soon", "info");
  }

  showAddUserModal() {
    console.log("Show add user modal");
    this.showNotification("Add user feature coming soon", "info");
  }

  viewPatient(patientId) {
    console.log("View patient:", patientId);
    this.showNotification(
      `View patient ${patientId} - feature coming soon`,
      "info"
    );
  }

  startNewVisit(patientId) {
    console.log("Start new visit for patient:", patientId);
    this.showNotification(
      `New visit for patient ${patientId} - feature coming soon`,
      "info"
    );
  }

  editPatient(patientId) {
    console.log("Edit patient:", patientId);
    this.showNotification(
      `Edit patient ${patientId} - feature coming soon`,
      "info"
    );
  }

  editUser(userId) {
    console.log("Edit user:", userId);
    this.showNotification(`Edit user ${userId} - feature coming soon`, "info");
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
    const existingNotifications = document.querySelectorAll(
      ".custom-notification"
    );
    existingNotifications.forEach((notification) => {
      if (notification.parentNode) {
        notification.remove();
      }
    });

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
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
    
    @keyframes slideOutRight {
      from { transform: translateX(0); opacity: 1; }
      to { transform: translateX(100%); opacity: 0; }
    }
  `;
  document.head.appendChild(style);
}

// Initialize the application
document.addEventListener("DOMContentLoaded", () => {
  console.log("DOM loaded, initializing EndoStatApp...");
  window.app = new EndoStatApp();
});

window.addEventListener("error", (error) => {
  console.error("Global error:", error);
});
