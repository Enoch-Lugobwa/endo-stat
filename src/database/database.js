const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

class EndoStatDatabase {
  constructor() {
    this.db = null;
    this.dbPath = path.join(
      require("electron").app.getPath("userData"),
      "endostat.db"
    );
  }

  init() {
    return new Promise((resolve, reject) => {
      try {
        this.db = new Database(this.dbPath);
        this.db.pragma("journal_mode = WAL");

        this.createTables();
        this.initializeData();

        console.log("Database initialized successfully");
        resolve();
      } catch (error) {
        console.error("Database initialization failed:", error);
        reject(error);
      }
    });
  }

  createTables() {
    // Patients table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS patients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        patient_id TEXT UNIQUE NOT NULL,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        date_of_birth DATE,
        gender TEXT,
        phone_number TEXT,
        email TEXT,
        address TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Examinations table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS examinations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        patient_id INTEGER,
        examination_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        procedure_type TEXT,
        indications TEXT,
        findings TEXT,
        diagnosis TEXT,
        recommendations TEXT,
        examiner_name TEXT,
        images_count INTEGER DEFAULT 0,
        report_generated BOOLEAN DEFAULT FALSE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (patient_id) REFERENCES patients (id)
      )
    `);

    // Images table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS images (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        examination_id INTEGER,
        image_data BLOB,
        image_path TEXT,
        description TEXT,
        annotations TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (examination_id) REFERENCES examinations (id)
      )
    `);

    // Users table (for login)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        full_name TEXT NOT NULL,
        role TEXT DEFAULT 'examiner',
        is_active BOOLEAN DEFAULT TRUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create indexes
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_patients_name ON patients (last_name, first_name);
      CREATE INDEX IF NOT EXISTS idx_examinations_date ON examinations (examination_date);
      CREATE INDEX IF NOT EXISTS idx_examinations_patient ON examinations (patient_id);
    `);
  }

  initializeData() {
    try {
      console.log("=== INITIALIZING DATABASE DATA ===");

      // Create default admin user if not exists
      const bcrypt = require("bcryptjs");
      const defaultPassword = "admin";
      console.log("Setting admin user password to:", defaultPassword);

      const saltRounds = 10;
      const passwordHash = bcrypt.hashSync(defaultPassword, saltRounds);
      console.log("Generated password hash:", passwordHash);

      // First, check if admin user exists
      const checkUser = this.db.prepare(
        "SELECT * FROM users WHERE username = 'admin'"
      );
      const existingUser = checkUser.get();

      if (existingUser) {
        console.log("Admin user already exists, updating password...");
        // Update existing user's password
        const updateUser = this.db.prepare(`
        UPDATE users 
        SET password_hash = ?, full_name = ?, role = ?, is_active = TRUE
        WHERE username = ?
      `);

        const result = updateUser.run(
          passwordHash,
          "System Administrator",
          "admin",
          "admin"
        );
        console.log("User update result:", result);
      } else {
        console.log("Creating new admin user...");
        // Insert new user
        const insertUser = this.db.prepare(`
        INSERT INTO users (username, password_hash, full_name, role) 
        VALUES (?, ?, ?, ?)
      `);

        const result = insertUser.run(
          "admin",
          passwordHash,
          "System Administrator",
          "admin"
        );
        console.log("User insertion result:", result);
      }

      // Verify the user was created/updated
      const verifyUser = this.db.prepare(
        "SELECT * FROM users WHERE username = 'admin'"
      );
      const adminUser = verifyUser.get();
      console.log("Verified admin user:", {
        id: adminUser.id,
        username: adminUser.username,
        password_hash: adminUser.password_hash,
        full_name: adminUser.full_name,
        role: adminUser.role,
      });

      console.log("✅ Database initialization completed");
    } catch (error) {
      console.error("❌ Database initialization failed:", error);
      throw error;
    }
  }

  executeQuery(query, params = []) {
    try {
      if (query.trim().toUpperCase().startsWith("SELECT")) {
        const stmt = this.db.prepare(query);
        return stmt.all(...params);
      } else {
        const stmt = this.db.prepare(query);
        const result = stmt.run(...params);
        return {
          changes: result.changes,
          lastInsertRowid: result.lastInsertRowid,
        };
      }
    } catch (error) {
      console.error("Query execution error:", error);
      throw error;
    }
  }

  // Specific methods for common operations
  addPatient(patientData) {
    const query = `
      INSERT INTO patients (patient_id, first_name, last_name, date_of_birth, gender, phone_number, email, address)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      patientData.patientId,
      patientData.firstName,
      patientData.lastName,
      patientData.dateOfBirth,
      patientData.gender,
      patientData.phoneNumber,
      patientData.email,
      patientData.address,
    ];

    return this.executeQuery(query, params);
  }

  getPatients(searchTerm = "") {
    let query = `
      SELECT * FROM patients 
      WHERE first_name LIKE ? OR last_name LIKE ? OR patient_id LIKE ?
      ORDER BY last_name, first_name
    `;

    const searchParam = `%${searchTerm}%`;
    return this.executeQuery(query, [searchParam, searchParam, searchParam]);
  }

  close() {
    if (this.db) {
      this.db.close();
    }
  }
}

module.exports = EndoStatDatabase;
