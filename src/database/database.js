const Database = require("better-sqlite3");
const path = require("path");

class EndoStatDatabase {
  constructor() {
    this.db = null;
    this.dbPath = path.join(
      require("electron").app.getPath("userData"),
      "endostat.db"
    );
  }

  async init() {
    try {
      this.db = new Database(this.dbPath);
      this.db.pragma("journal_mode = WAL");

      this.createTables();
      await this.initializeData();

      console.log("✅ Database initialized successfully");
    } catch (error) {
      console.error("❌ Database initialization failed:", error);
      throw error;
    }
  }

  createTables() {
    // Check and update users table structure if needed
    const tableInfo = this.db.prepare("PRAGMA table_info(users)").all();
    console.log("Current users table structure:", tableInfo);

    // Check if password_hash column exists
    const hasPasswordHash = tableInfo.some(
      (col) => col.name === "password_hash"
    );
    const hasPassword = tableInfo.some((col) => col.name === "password");

    if (!hasPasswordHash && hasPassword) {
      console.log("⚠️  Renaming password column to password_hash...");
      this.db.exec(`
        ALTER TABLE users RENAME COLUMN password TO password_hash;
      `);
    } else if (!hasPasswordHash && !hasPassword) {
      console.log("⚠️  Adding password_hash column...");
      this.db.exec(`
        ALTER TABLE users ADD COLUMN password_hash TEXT;
      `);
    }

    // Check if email column exists
    const hasEmail = tableInfo.some((col) => col.name === "email");
    if (!hasEmail) {
      console.log("⚠️  Adding email column...");
      this.db.exec(`
        ALTER TABLE users ADD COLUMN email TEXT;
      `);
    }

    // Check if login_count column exists
    const hasLoginCount = tableInfo.some((col) => col.name === "login_count");
    if (!hasLoginCount) {
      console.log("⚠️  Adding login_count column...");
      this.db.exec(`
        ALTER TABLE users ADD COLUMN login_count INTEGER DEFAULT 0;
      `);
    }

    // Check if last_login column exists
    const hasLastLogin = tableInfo.some((col) => col.name === "last_login");
    if (!hasLastLogin) {
      console.log("⚠️  Adding last_login column...");
      this.db.exec(`
        ALTER TABLE users ADD COLUMN last_login DATETIME;
      `);
    }

    // Check if notes column exists
    const hasNotes = tableInfo.some((col) => col.name === "notes");
    if (!hasNotes) {
      console.log("⚠️  Adding notes column...");
      this.db.exec(`
        ALTER TABLE users ADD COLUMN notes TEXT;
      `);
    }

    // Create other tables if they don't exist
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

    // Create indexes
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_patients_name ON patients (last_name, first_name);
      CREATE INDEX IF NOT EXISTS idx_examinations_date ON examinations (examination_date);
      CREATE INDEX IF NOT EXISTS idx_examinations_patient ON examinations (patient_id);
      CREATE INDEX IF NOT EXISTS idx_users_username ON users (username);
    `);
  }

  async initializeData() {
    try {
      console.log("=== INITIALIZING DATABASE DATA ===");

      // Check what columns actually exist
      const tableInfo = this.db.prepare("PRAGMA table_info(users)").all();
      console.log(
        "Users table columns after update:",
        tableInfo.map((col) => col.name)
      );

      // Get the password column name
      const passwordColumn =
        tableInfo.find(
          (col) => col.name === "password_hash" || col.name === "password"
        )?.name || "password_hash";

      console.log(`Using password column: ${passwordColumn}`);

      const defaultPassword = "admin";
      console.log("Setting admin user password to:", defaultPassword);

      // Check if admin user exists
      const checkUser = this.db.prepare(
        "SELECT * FROM users WHERE username = 'admin'"
      );
      const existingUser = checkUser.get();

      if (existingUser) {
        console.log("Admin user already exists, updating...");

        // Update with hashed password
        let updateQuery;
        try {
          const bcrypt = require("bcryptjs");
          const hashedPassword = bcrypt.hashSync(defaultPassword, 10);

          updateQuery = this.db.prepare(`
            UPDATE users 
            SET ${passwordColumn} = ?, full_name = ?, email = ?, role = 'admin', is_active = 1
            WHERE username = 'admin'
          `);
          updateQuery.run(
            hashedPassword,
            "System Administrator",
            "admin@localhost"
          );
        } catch (hashError) {
          console.warn("Could not hash password, using plain text:", hashError);
          updateQuery = this.db.prepare(`
            UPDATE users 
            SET ${passwordColumn} = ?, full_name = ?, email = ?, role = 'admin', is_active = 1
            WHERE username = 'admin'
          `);
          updateQuery.run(
            defaultPassword,
            "System Administrator",
            "admin@localhost"
          );
        }

        console.log("Admin user updated");
      } else {
        console.log("Creating new admin user...");

        let insertQuery;
        try {
          const bcrypt = require("bcryptjs");
          const hashedPassword = bcrypt.hashSync(defaultPassword, 10);

          insertQuery = this.db.prepare(`
            INSERT INTO users (username, ${passwordColumn}, full_name, email, role, is_active) 
            VALUES (?, ?, ?, ?, ?, ?)
          `);

          insertQuery.run(
            "admin",
            hashedPassword,
            "System Administrator",
            "admin@localhost",
            "admin",
            1
          );
        } catch (hashError) {
          console.warn("Could not hash password, using plain text:", hashError);
          insertQuery = this.db.prepare(`
            INSERT INTO users (username, ${passwordColumn}, full_name, email, role, is_active) 
            VALUES (?, ?, ?, ?, ?, ?)
          `);

          insertQuery.run(
            "admin",
            defaultPassword,
            "System Administrator",
            "admin@localhost",
            "admin",
            1
          );
        }

        console.log("Admin user created");
      }

      // Verify
      const verifyUser = this.db.prepare(
        "SELECT id, username, full_name, role, is_active FROM users WHERE username = 'admin'"
      );
      const adminUser = verifyUser.get();
      console.log("✅ Verified admin user:", adminUser);

      console.log("✅ Database initialization completed");
    } catch (error) {
      console.error("❌ Database initialization failed:", error);
      throw error;
    }
  }

  // User authentication
  async authenticateUser(username, password) {
    try {
      console.log(`🔐 Authenticating user: ${username}`);

      // Get column names
      const tableInfo = this.db.prepare("PRAGMA table_info(users)").all();
      const passwordColumn =
        tableInfo.find(
          (col) => col.name === "password_hash" || col.name === "password"
        )?.name || "password_hash";

      const getUser = this.db.prepare(`
        SELECT id, username, ${passwordColumn} as password_hash, full_name, role, is_active 
        FROM users WHERE username = ?
      `);

      const user = getUser.get(username);

      if (!user) {
        console.log("❌ User not found:", username);
        return {
          success: false,
          error: "Invalid username or password",
        };
      }

      if (!user.is_active) {
        console.log("❌ User is inactive:", username);
        return {
          success: false,
          error: "Account is deactivated. Please contact administrator.",
        };
      }

      console.log("📋 User found:", {
        id: user.id,
        username: user.username,
        hasPassword: !!user.password_hash,
        passwordLength: user.password_hash?.length || 0,
      });

      // Check password
      const bcrypt = require("bcryptjs");
      let passwordValid = false;

      if (user.password_hash) {
        try {
          // Try bcrypt compare first (for hashed passwords)
          passwordValid = bcrypt.compareSync(password, user.password_hash);

          if (!passwordValid) {
            // Try direct comparison (for plain text passwords during migration)
            passwordValid = password === user.password_hash;
          }
        } catch (compareError) {
          console.warn(
            "Password comparison error, trying direct match:",
            compareError
          );
          passwordValid = password === user.password_hash;
        }
      }

      if (!passwordValid) {
        console.log("❌ Password mismatch for user:", username);
        return {
          success: false,
          error: "Invalid username or password",
        };
      }

      console.log("✅ Password valid for user:", username);

      // Update login count and last login
      const updateLogin = this.db.prepare(`
        UPDATE users 
        SET login_count = COALESCE(login_count, 0) + 1, 
            last_login = CURRENT_TIMESTAMP 
        WHERE id = ?
      `);
      updateLogin.run(user.id);

      // If password is plain text, hash it for security
      if (!user.password_hash.startsWith("$2a$")) {
        try {
          const hashedPassword = bcrypt.hashSync(password, 10);
          const updatePassword = this.db.prepare(`
            UPDATE users 
            SET ${passwordColumn} = ? 
            WHERE id = ?
          `);
          updatePassword.run(hashedPassword, user.id);
          console.log("🔒 Password hashed for user:", username);
        } catch (hashError) {
          console.warn("Could not hash password:", hashError);
        }
      }

      console.log("✅ Authentication successful for user:", username);

      return {
        success: true,
        user: {
          id: user.id,
          username: user.username,
          full_name: user.full_name,
          fullName: user.full_name, // Include both formats for compatibility
          role: user.role,
        },
      };
    } catch (error) {
      console.error("💥 Authentication error:", error);
      return {
        success: false,
        error: "Authentication failed. Please try again.",
      };
    }
  }

  // Get all users
  getUsers() {
    try {
      const query = `
        SELECT id, username, full_name, email, role, is_active, 
               COALESCE(login_count, 0) as login_count, 
               last_login, created_at, notes
        FROM users 
        ORDER BY created_at DESC
      `;
      const stmt = this.db.prepare(query);
      return stmt.all();
    } catch (error) {
      console.error("Error getting users:", error);
      throw error;
    }
  }

  // Add new user with hashed password
  addUser(userData) {
    try {
      const bcrypt = require("bcryptjs");
      const hashedPassword = bcrypt.hashSync(userData.password, 10);

      // Get column name
      const tableInfo = this.db.prepare("PRAGMA table_info(users)").all();
      const passwordColumn =
        tableInfo.find(
          (col) => col.name === "password_hash" || col.name === "password"
        )?.name || "password_hash";

      const query = `
        INSERT INTO users (username, ${passwordColumn}, full_name, email, role, is_active, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `;

      const stmt = this.db.prepare(query);
      const result = stmt.run(
        userData.username,
        hashedPassword,
        userData.full_name,
        userData.email || null,
        userData.role || "examiner",
        userData.is_active ? 1 : 0,
        userData.notes || null
      );

      return {
        success: true,
        id: result.lastInsertRowid,
        changes: result.changes,
      };
    } catch (error) {
      console.error("Error adding user:", error);
      return { success: false, error: error.message };
    }
  }

  // Update user
  updateUser(userId, userData) {
    try {
      let query = "UPDATE users SET ";
      const params = [];
      const updates = [];

      if (userData.full_name !== undefined) {
        updates.push("full_name = ?");
        params.push(userData.full_name);
      }
      if (userData.email !== undefined) {
        updates.push("email = ?");
        params.push(userData.email || null);
      }
      if (userData.role !== undefined) {
        updates.push("role = ?");
        params.push(userData.role);
      }
      if (userData.is_active !== undefined) {
        updates.push("is_active = ?");
        params.push(userData.is_active ? 1 : 0);
      }
      if (userData.notes !== undefined) {
        updates.push("notes = ?");
        params.push(userData.notes || null);
      }
      if (userData.password !== undefined && userData.password.trim() !== "") {
        const bcrypt = require("bcryptjs");
        const hashedPassword = bcrypt.hashSync(userData.password, 10);

        // Get column name
        const tableInfo = this.db.prepare("PRAGMA table_info(users)").all();
        const passwordColumn =
          tableInfo.find(
            (col) => col.name === "password_hash" || col.name === "password"
          )?.name || "password_hash";

        updates.push(`${passwordColumn} = ?`);
        params.push(hashedPassword);
      }

      if (updates.length === 0) {
        return { success: false, error: "No data to update" };
      }

      query += updates.join(", ") + " WHERE id = ?";
      params.push(userId);

      const stmt = this.db.prepare(query);
      const result = stmt.run(...params);

      return {
        success: true,
        changes: result.changes,
      };
    } catch (error) {
      console.error("Error updating user:", error);
      return { success: false, error: error.message };
    }
  }

  // Delete user
  deleteUser(userId) {
    try {
      // Check if admin user
      const checkUser = this.db.prepare(
        "SELECT username FROM users WHERE id = ?"
      );
      const user = checkUser.get(userId);

      if (user && user.username === "admin") {
        return { success: false, error: "Cannot delete admin user" };
      }

      const query = "DELETE FROM users WHERE id = ?";
      const stmt = this.db.prepare(query);
      const result = stmt.run(userId);

      return {
        success: result.changes > 0,
        changes: result.changes,
      };
    } catch (error) {
      console.error("Error deleting user:", error);
      return { success: false, error: error.message };
    }
  }

  // Toggle user status
  toggleUserStatus(userId) {
    try {
      const getUser = this.db.prepare(
        "SELECT is_active FROM users WHERE id = ?"
      );
      const user = getUser.get(userId);

      if (!user) {
        return { success: false, error: "User not found" };
      }

      const newStatus = user.is_active ? 0 : 1;
      const updateQuery = "UPDATE users SET is_active = ? WHERE id = ?";
      const updateStmt = this.db.prepare(updateQuery);
      const result = updateStmt.run(newStatus, userId);

      return {
        success: true,
        changes: result.changes,
        newStatus: newStatus === 1,
      };
    } catch (error) {
      console.error("Error toggling user status:", error);
      return { success: false, error: error.message };
    }
  }

  // Patient methods
  addPatient(patientData) {
    try {
      const query = `
        INSERT INTO patients (patient_id, first_name, last_name, date_of_birth, 
                             gender, phone_number, email, address)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const stmt = this.db.prepare(query);
      const result = stmt.run(
        patientData.patient_id,
        patientData.first_name,
        patientData.last_name,
        patientData.date_of_birth,
        patientData.gender,
        patientData.phone_number,
        patientData.email,
        patientData.address
      );

      return {
        success: true,
        id: result.lastInsertRowid,
        changes: result.changes,
      };
    } catch (error) {
      console.error("Error adding patient:", error);
      return { success: false, error: error.message };
    }
  }

  getPatients(searchTerm = "") {
    try {
      let query = `
        SELECT * FROM patients 
        WHERE 1=1
      `;
      const params = [];

      if (searchTerm) {
        query += ` AND (first_name LIKE ? OR last_name LIKE ? OR patient_id LIKE ?)`;
        const searchParam = `%${searchTerm}%`;
        params.push(searchParam, searchParam, searchParam);
      }

      query += ` ORDER BY last_name, first_name`;

      const stmt = this.db.prepare(query);
      return stmt.all(...params);
    } catch (error) {
      console.error("Error getting patients:", error);
      throw error;
    }
  }

  // General query execution
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

  close() {
    if (this.db) {
      this.db.close();
    }
  }
}

module.exports = EndoStatDatabase;
