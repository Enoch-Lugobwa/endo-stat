class Dashboard {
  constructor() {
    this.init();
  }

  init() {
    this.setupEventListeners();
    this.loadDashboardData();
  }

  setupEventListeners() {
    // Quick action buttons
    const quickPatientBtn = document.getElementById("quick-patient");
    const quickExamBtn = document.getElementById("quick-examination");

    if (quickPatientBtn) {
      quickPatientBtn.addEventListener("click", () => {
        this.showPatientModal();
      });
    }

    if (quickExamBtn) {
      quickExamBtn.addEventListener("click", () => {
        this.showExaminationModal();
      });
    }

    // Sidebar menu items
    const menuItems = document.querySelectorAll(".menu-item");
    menuItems.forEach((item) => {
      item.addEventListener("click", () => {
        const view = item.getAttribute("data-view");
        this.switchView(view);
      });
    });
  }

  async loadDashboardData() {
    try {
      // Remove loading spinner
      const loadingElement = document.querySelector(".dashboard-loading");
      if (loadingElement) {
        loadingElement.remove();
      }

      // Load stats from database
      const stats = await this.loadStats();
      this.displayStats(stats);
    } catch (error) {
      console.error("Failed to load dashboard data:", error);
    }
  }

  async loadStats() {
    try {
      // Example stats - replace with actual database queries
      const patients = await window.electronAPI.dbQuery(
        "SELECT COUNT(*) as count FROM patients"
      );
      const examinations = await window.electronAPI.dbQuery(
        "SELECT COUNT(*) as count FROM examinations"
      );
      const reports = await window.electronAPI.dbQuery(
        "SELECT COUNT(*) as count FROM examinations WHERE report_generated = TRUE"
      );

      return {
        patients: patients[0]?.count || 0,
        examinations: examinations[0]?.count || 0,
        reports: reports[0]?.count || 0,
      };
    } catch (error) {
      console.error("Error loading stats:", error);
      return { patients: 0, examinations: 0, reports: 0 };
    }
  }

  displayStats(stats) {
    const contentArea = document.getElementById("content-area");
    contentArea.innerHTML = `
            <div class="dashboard-content">
                <div class="welcome-message">
                    <h2>Welcome to Endo-Stat</h2>
                    <p>Your endoscopy reporting system is ready to use.</p>
                    
                    <div class="stats-grid">
                        <div class="stat-card">
                            <i class="fas fa-user-injured"></i>
                            <div class="stat-info">
                                <span class="stat-number">${stats.patients}</span>
                                <span class="stat-label">Total Patients</span>
                            </div>
                        </div>
                        <div class="stat-card">
                            <i class="fas fa-procedures"></i>
                            <div class="stat-info">
                                <span class="stat-number">${stats.examinations}</span>
                                <span class="stat-label">Examinations</span>
                            </div>
                        </div>
                        <div class="stat-card">
                            <i class="fas fa-file-pdf"></i>
                            <div class="stat-info">
                                <span class="stat-number">${stats.reports}</span>
                                <span class="stat-label">Reports Generated</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="quick-actions">
                        <button class="btn btn-primary" id="quick-patient">
                            <i class="fas fa-user-plus"></i> New Patient
                        </button>
                        <button class="btn btn-secondary" id="quick-examination">
                            <i class="fas fa-stethoscope"></i> New Examination
                        </button>
                    </div>
                </div>
            </div>
        `;

    // Re-attach event listeners
    this.setupEventListeners();
  }

  showPatientModal() {
    console.log("Open patient modal");
    // Implement patient modal logic
  }

  showExaminationModal() {
    console.log("Open examination modal");
    // Implement examination modal logic
  }

  switchView(view) {
    console.log("Switch to view:", view);
    // Update active menu item
    document.querySelectorAll(".menu-item").forEach((item) => {
      item.classList.remove("active");
    });
    document.querySelector(`[data-view="${view}"]`).classList.add("active");

    // Update page title
    document.getElementById("page-title").textContent = this.getViewTitle(view);
  }

  getViewTitle(view) {
    const titles = {
      dashboard: "Dashboard",
      patients: "Patients",
      examinations: "Examinations",
      camera: "Image Capture",
      reports: "Reports",
      settings: "Settings",
    };
    return titles[view] || "Endo-Stat";
  }
}

// Initialize dashboard when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  new Dashboard();
});
