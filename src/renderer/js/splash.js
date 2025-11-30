class SplashScreen {
  constructor() {
    this.currentStep = 1;
    this.totalSteps = 4;
    this.init();
  }

  init() {
    this.startLoadingAnimation();
    this.loadAppVersion();
    this.setCurrentYear();
  }

  startLoadingAnimation() {
    const progressBar = document.getElementById("loading-progress");
    const percentage = document.getElementById("loading-percentage");

    // Simulate loading progress
    const interval = setInterval(() => {
      this.currentStep++;
      const progress = (this.currentStep / this.totalSteps) * 100;

      // Update progress bar and percentage
      progressBar.style.width = `${progress}%`;
      percentage.textContent = `${Math.round(progress)}%`;

      // Update active step with status
      this.updateActiveStep(this.currentStep);

      if (this.currentStep >= this.totalSteps) {
        clearInterval(interval);
        // Add completion animation
        setTimeout(() => {
          this.completeLoading();
        }, 500);
      }
    }, 1000);
  }

  updateActiveStep(step) {
    // Update previous step status
    const prevStep = document.getElementById(`step${step - 1}`);
    if (prevStep) {
      const status = prevStep.querySelector(".step-status");
      if (status) status.textContent = "Completed";
    }

    // Update current step
    document.querySelectorAll(".step").forEach((stepEl) => {
      stepEl.classList.remove("active");
    });

    const currentStepEl = document.getElementById(`step${step}`);
    if (currentStepEl) {
      currentStepEl.classList.add("active");
      const status = currentStepEl.querySelector(".step-status");
      if (status) status.textContent = "In Progress...";
    }
  }

  completeLoading() {
    // Update final step
    const finalStep = document.getElementById(`step${this.totalSteps}`);
    if (finalStep) {
      const status = finalStep.querySelector(".step-status");
      if (status) status.textContent = "Completed";
    }

    // The main process will close the splash screen and open the main window
    console.log("Splash screen loading complete");
  }

  async loadAppVersion() {
    try {
      // Get version from package.json via Electron
      if (window.electronAPI && window.electronAPI.getAppVersion) {
        const version = await window.electronAPI.getAppVersion();
        document.getElementById(
          "app-version"
        ).textContent = `Version ${version}`;
      } else {
        // Fallback for development
        document.getElementById("app-version").textContent = "Version 1.0.0";
      }
    } catch (error) {
      console.error("Failed to load app version:", error);
      document.getElementById("app-version").textContent = "Version 1.0.0";
    }
  }

  async setCurrentYear() {
    const currentYear = new Date().getFullYear();
    document.getElementById("current-year").textContent = currentYear;
  }
}

// Initialize the splash screen when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  new SplashScreen();
});
