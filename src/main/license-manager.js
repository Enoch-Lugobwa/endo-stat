const fetch = require("node-fetch");
const { machineIdSync } = require("node-machine-id");
const { app, dialog } = require("electron");
const os = require("os");

class LicenseManager {
  constructor(store) {
    this.store = store;
    this.accountId = "4c4eb227-341c-4b6e-a4ff-889e2d253b39";
    this.productId = "9bd2a575-eb3e-4491-8904-26a6f12abe57";
  }

  // Generate persistent machine fingerprint
  getMachineFingerprint() {
    try {
      const machineId = machineIdSync({ original: true });
      console.log("Machine fingerprint:", machineId);
      return machineId;
    } catch (error) {
      console.warn("Failed to get machine ID, using fallback:", error.message);
      return `${os.hostname()}-${os.arch()}-${os.platform()}-${app.getPath(
        "userData"
      )}`;
    }
  }

  // ---------------------- STRICT LICENSE VALIDATION ----------------------
  async performStrictLicenseValidation() {
    try {
      const storedKey = this.store.get("license.key");
      if (!storedKey) {
        console.log("No license key found");
        return {
          valid: false,
          reason: "No license",
          requiresReactivation: false,
        };
      }

      // Step 1: Validate license with Keygen
      console.log("Validating license with Keygen API...");
      const validation = await this.validateLicenseKey(storedKey);

      if (
        !validation.valid ||
        !["VALID", "EXPIRED"].includes(validation.code)
      ) {
        console.log("License validation failed");
        return {
          valid: false,
          reason: "License invalid",
          requiresReactivation: false,
        };
      }

      // Store the validation result
      const licenseData = {
        key: storedKey,
        id: validation.data?.id,
        status: validation.code,
        validatedAt: new Date().toISOString(),
        expiry: validation.data?.attributes?.expiry || null,
        type: validation.data?.attributes?.type || "standard",
        features: validation.data?.attributes?.features || [],
        machineRegistered:
          this.store.get("license")?.machineRegistered || false,
      };
      this.store.set("license", licenseData);

      // Rest of your existing code...
      // Step 2: Check if this machine is already registered
      const machineCheck = await this.checkMachineRegistration(storedKey);

      if (machineCheck.registered) {
        // Machine is registered, verify it's the same machine
        const ownership = await this.verifyMachineOwnership(storedKey);
        if (ownership.owned) {
          console.log("License valid and machine ownership verified");
          return { valid: true };
        } else {
          console.log("Machine ownership verification failed");
          await this.clearLicense();
          return {
            valid: false,
            reason: "License activated on different machine",
            requiresReactivation: true,
          };
        }
      } else {
        // Machine not registered, try to register it
        console.log("Machine not registered, attempting registration...");
        const licenseId = validation.data?.id;
        const registration = await this.registerMachine(storedKey, licenseId);

        if (registration.success) {
          console.log("Machine registered successfully");
          // Update license data with machine registration
          licenseData.machineRegistered = true;
          this.store.set("license", licenseData);
          return { valid: true };
        } else {
          console.log("Machine registration failed:", registration.error);
          // Check if it's a machine limit error
          if (
            registration.error &&
            registration.error.includes("MACHINE_LIMIT_EXCEEDED")
          ) {
            await this.clearLicense();
            return {
              valid: false,
              reason: "License already activated on another device",
              requiresReactivation: true,
            };
          }
          // For other errors, still clear the license to be safe
          await this.clearLicense();
          return {
            valid: false,
            reason: "Machine registration failed",
            requiresReactivation: true,
          };
        }
      }
    } catch (error) {
      console.error("Strict license validation error:", error);
      return {
        valid: false,
        reason: error.message,
        requiresReactivation: false,
      };
    }
  }

  // ---------------------- LICENSE VALIDATION ----------------------
  async validateLicenseKey(licenseKey) {
    try {
      console.log("Validating license with Keygen API...");

      const response = await fetch(
        `https://api.keygen.sh/v1/accounts/${this.accountId}/licenses/actions/validate-key`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            meta: {
              scope: { product: this.productId },
              key: licenseKey,
            },
          }),
        }
      );

      const data = await response.json();
      const { meta, errors, data: licenseData } = data;

      if (!response.ok || errors) {
        console.error("License validation failed:", errors || meta);
        return {
          valid: false,
          code: meta?.code,
          errors,
          status: response.status,
        };
      }

      console.log(`License validation successful: ${meta.code}`);
      return {
        valid: meta.valid,
        code: meta.code,
        data: licenseData,
        status: response.status,
      };
    } catch (error) {
      console.error("License validation error:", error);
      return {
        valid: false,
        code: "NETWORK_ERROR",
        errors: [{ code: "NETWORK_ERROR", detail: error.message }],
        status: 0,
      };
    }
  }

  async validateNewLicense(licenseKey) {
    try {
      const cleanKey = licenseKey.trim().toUpperCase();
      const validation = await this.validateLicenseKey(cleanKey);

      console.log("Validation result:", validation);

      if (validation.valid && ["VALID", "EXPIRED"].includes(validation.code)) {
        const licenseId = validation.data?.id;
        if (!licenseId) {
          throw new Error("License ID not found in validation response");
        }

        // Store comprehensive license info
        const licenseData = {
          key: cleanKey,
          id: licenseId,
          status: validation.code,
          validatedAt: new Date().toISOString(),
          expiry: validation.data?.attributes?.expiry || null,
          type: validation.data?.attributes?.type || "standard",
          features: validation.data?.attributes?.features || [],
          machineRegistered: false,
        };

        this.store.set("license", licenseData);
        console.log("License data stored:", licenseData);

        // Now try to register machine
        const registration = await this.registerMachine(cleanKey, licenseId);

        if (!registration.success) {
          // If machine registration fails, check if it's due to machine limit
          if (
            registration.error &&
            registration.error.includes("MACHINE_LIMIT_EXCEEDED")
          ) {
            await this.clearLicense();
            return {
              valid: false,
              code: "MACHINE_LIMIT_EXCEEDED",
              errors: [
                {
                  code: "MACHINE_LIMIT_EXCEEDED",
                  detail: "License already activated on another device",
                },
              ],
            };
          }
          // For other errors, we still store the license but mark machine as not registered
          licenseData.machineRegistered = false;
          this.store.set("license", licenseData);
          console.warn("License stored but machine registration failed");
        } else {
          // Update license with successful machine registration
          licenseData.machineRegistered = true;
          this.store.set("license", licenseData);
        }

        console.log("License validation completed");
        return {
          ...validation,
          stored: true,
          machineRegistered: registration.success,
        };
      } else {
        this.store.delete("license");
        this.store.delete("machine.registration");
        console.warn("License invalid or expired.");
        return validation;
      }
    } catch (error) {
      console.error("validateNewLicense error:", error);
      await this.clearLicense();
      return {
        valid: false,
        code: "VALIDATION_ERROR",
        errors: [{ detail: error.message }],
      };
    }
  }

  // ---------------------- MACHINE REGISTRATION ----------------------
  async registerMachine(licenseKey, licenseId) {
    try {
      const fingerprint = this.getMachineFingerprint();
      const machineName = `Endo-Stat-${os.hostname()}`;

      console.log("Registering machine:", machineName);
      console.log("Using license ID (UUID):", licenseId);

      const response = await fetch(
        `https://api.keygen.sh/v1/accounts/${this.accountId}/machines`,
        {
          method: "POST",
          headers: {
            Authorization: `License ${licenseKey}`,
            "Content-Type": "application/vnd.api+json",
            Accept: "application/vnd.api+json",
          },
          body: JSON.stringify({
            data: {
              type: "machines",
              attributes: {
                name: machineName,
                fingerprint,
                platform: process.platform,
              },
              relationships: {
                license: {
                  data: {
                    type: "licenses",
                    id: licenseId,
                  },
                },
              },
            },
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Machine registration failed:", errorData);

        // Check for machine limit exceeded error
        if (response.status === 422) {
          const errorCode = errorData.errors?.[0]?.code;

          if (errorCode === "FINGERPRINT_NOT_UNIQUE") {
            console.log("Machine already registered. Retrieving ID...");
            const machine = await this.getExistingMachine(
              licenseKey,
              fingerprint
            );
            if (machine) {
              this.store.set("machine.registration", {
                id: machine.id,
                fingerprint,
                registeredAt: new Date().toISOString(),
              });
              return {
                success: true,
                alreadyRegistered: true,
                machineId: machine.id,
              };
            }
          } else if (errorCode === "MACHINE_LIMIT_EXCEEDED") {
            console.error(
              "LICENSE LIMIT: License already used on maximum number of machines"
            );
            return {
              success: false,
              error:
                "MACHINE_LIMIT_EXCEEDED - License already activated on another device",
            };
          }
        }

        throw new Error(
          `Registration failed: ${response.status} ${JSON.stringify(errorData)}`
        );
      }

      const result = await response.json();
      this.store.set("machine.registration", {
        id: result.data.id,
        fingerprint,
        registeredAt: new Date().toISOString(),
      });

      console.log("Machine registered successfully:", result.data.id);
      return { success: true, machineId: result.data.id };
    } catch (error) {
      console.error("registerMachine error:", error);
      return { success: false, error: error.message };
    }
  }

  async getExistingMachine(licenseKey, fingerprint) {
    try {
      const res = await fetch(
        `https://api.keygen.sh/v1/accounts/${this.accountId}/machines?filter[fingerprint]=${fingerprint}`,
        {
          headers: {
            Authorization: `License ${licenseKey}`,
            Accept: "application/vnd.api+json",
          },
        }
      );
      if (!res.ok) return null;
      const data = await res.json();
      return data.data?.[0] || null;
    } catch {
      return null;
    }
  }

  async checkMachineRegistration(licenseKey) {
    const registration = this.store.get("machine.registration");
    if (!registration) return { registered: false };

    try {
      const res = await fetch(
        `https://api.keygen.sh/v1/accounts/${this.accountId}/machines/${registration.id}`,
        {
          headers: {
            Authorization: `License ${licenseKey}`,
            Accept: "application/vnd.api+json",
          },
        }
      );

      if (res.ok) {
        return { registered: true, machineId: registration.id };
      } else if (res.status === 404) {
        this.store.delete("machine.registration");
        return { registered: false };
      } else {
        console.error("Machine check failed:", res.status);
        return { registered: "unknown" };
      }
    } catch (error) {
      console.error("checkMachineRegistration error:", error);
      return { registered: "unknown", error: error.message };
    }
  }

  // Check if current machine is the one registered with the license
  async verifyMachineOwnership(licenseKey) {
    try {
      const registration = this.store.get("machine.registration");
      const currentFingerprint = this.getMachineFingerprint();

      if (!registration) {
        return { owned: false, reason: "No machine registration found" };
      }

      if (registration.fingerprint !== currentFingerprint) {
        console.error("Machine fingerprint mismatch!");
        console.log("Stored fingerprint:", registration.fingerprint);
        console.log("Current fingerprint:", currentFingerprint);
        return { owned: false, reason: "Machine fingerprint mismatch" };
      }

      const machineCheck = await this.checkMachineRegistration(licenseKey);
      if (!machineCheck.registered) {
        return { owned: false, reason: "Machine not registered with license" };
      }

      return { owned: true };
    } catch (error) {
      console.error("verifyMachineOwnership error:", error);
      return { owned: false, reason: error.message };
    }
  }

  async unregisterMachine(licenseKey) {
    const registration = this.store.get("machine.registration");
    if (!registration) return { success: true };

    try {
      const res = await fetch(
        `https://api.keygen.sh/v1/accounts/${this.accountId}/machines/${registration.id}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `License ${licenseKey}`,
            Accept: "application/vnd.api+json",
          },
        }
      );

      if (res.ok || res.status === 404) {
        this.store.delete("machine.registration");
        console.log("Machine unregistered successfully.");
        return { success: true };
      }

      const errorData = await res.json();
      console.error("unregisterMachine failed:", errorData);
      return { success: false, error: errorData };
    } catch (error) {
      console.error("unregisterMachine error:", error);
      return { success: false, error: error.message };
    }
  }

  // ---------------------- STATUS & CLEAR ----------------------
  // In your license-manager.js, ensure getLicenseStatus returns expiresAt
  getLicenseStatus() {
    const licenseKey = this.store.get("license.key");
    const licenseData = this.store.get("license");

    console.log("License Manager - Current license data:", licenseData);

    if (!licenseKey || !licenseData) {
      console.log("No license key or data found");
      return { valid: false };
    }

    // Extract expiry date - check multiple possible locations
    let expiresAt = null;
    if (licenseData.expiry) {
      expiresAt = licenseData.expiry;
    } else if (licenseData.expires_at) {
      expiresAt = licenseData.expires_at;
    } else if (licenseData.attributes && licenseData.attributes.expiry) {
      expiresAt = licenseData.attributes.expiry;
    }

    const status = {
      valid: licenseData.status === "VALID",
      expiresAt: expiresAt,
      type: licenseData.type || "standard",
      features: licenseData.features || [],
      status: licenseData.status,
    };

    console.log("License Manager - Returning status:", status);
    return status;
  }

  async clearLicense() {
    try {
      const licenseKey = this.store.get("license.key");
      if (licenseKey) {
        await this.unregisterMachine(licenseKey);
      }
      this.store.delete("license");
      this.store.delete("machine.registration");
      console.log("License cleared from local storage.");
    } catch (error) {
      console.error("clearLicense error:", error);
    }
  }
}

module.exports = LicenseManager;
