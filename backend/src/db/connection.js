import sqlite3 from 'sqlite3';
import pg from 'pg';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

let usePostgres = !!process.env.DATABASE_URL;
let dbInstance = null;
let pgPool = null;

export const initDb = async () => {
  if (usePostgres) {
    try {
      console.log('Connecting to PostgreSQL database...');
      pgPool = new pg.Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
        connectionTimeoutMillis: 15000,
        idleTimeoutMillis: 10000,
        max: 10
      });

      const client = await Promise.race([
        pgPool.connect(),
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error('PostgreSQL connection timed out after 15s')), 15000);
        })
      ]);
      client.release();
      console.log('PostgreSQL connected successfully.');
      
      await createTablesPostgres();
      try {
        await pgPool.query('ALTER TABLE missions ADD COLUMN screenshot_path VARCHAR(255)');
      } catch (e) {}
      try {
        await pgPool.query("ALTER TABLE missions ADD COLUMN input_mode VARCHAR(50) DEFAULT 'text'");
      } catch (e) {}
      try {
        await pgPool.query('ALTER TABLE mirror_sessions ADD COLUMN project_context TEXT');
      } catch (e) {}
      try {
        await pgPool.query('ALTER TABLE mirror_sessions ADD COLUMN session_mode VARCHAR(50)');
      } catch (e) {}
      try {
        await pgPool.query('ALTER TABLE mirror_sessions ADD COLUMN completed_at TIMESTAMP');
      } catch (e) {}
      return; // PG initialized successfully
    } catch (err) {
      console.error('PostgreSQL connection failed. Falling back to SQLite database...', err);
      usePostgres = false;
    }
  }

  // SQLite fallback
  console.log('Using SQLite fallback database...');
  const dbPath = path.resolve(process.cwd(), 'devmirror.db');
  
  dbInstance = new sqlite3.Database(dbPath);
  console.log(`SQLite database file loaded: ${dbPath}`);
  
  await createTablesSqlite();
  const sqliteAlter = (sql) => new Promise((resolve) => {
    dbInstance.run(sql, () => resolve());
  });
  await sqliteAlter('ALTER TABLE missions ADD COLUMN screenshot_path TEXT');
  await sqliteAlter("ALTER TABLE missions ADD COLUMN input_mode TEXT DEFAULT 'text'");
  await sqliteAlter('ALTER TABLE mirror_sessions ADD COLUMN project_context TEXT');
  await sqliteAlter('ALTER TABLE mirror_sessions ADD COLUMN session_mode TEXT');
  await sqliteAlter('ALTER TABLE mirror_sessions ADD COLUMN completed_at DATETIME');
};

const createTablesPostgres = async () => {
  const queries = [
    `CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      full_name VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS projects (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS missions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
      voice_transcript TEXT,
      status VARCHAR(50) DEFAULT 'INVESTIGATING',
      language VARCHAR(50) DEFAULT 'javascript',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS mission_files (
      id SERIAL PRIMARY KEY,
      mission_id INTEGER NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
      filename VARCHAR(255) NOT NULL,
      file_content TEXT,
      is_original BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS agent_events (
      id SERIAL PRIMARY KEY,
      mission_id INTEGER NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
      agent_name VARCHAR(100) NOT NULL,
      message TEXT NOT NULL,
      event_type VARCHAR(100),
      status VARCHAR(50),
      timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS code_changes (
      id SERIAL PRIMARY KEY,
      mission_id INTEGER NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
      filename VARCHAR(255) NOT NULL,
      before_content TEXT,
      after_content TEXT,
      status VARCHAR(50) DEFAULT 'PENDING',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS test_runs (
      id SERIAL PRIMARY KEY,
      mission_id INTEGER NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
      attempt_number INTEGER NOT NULL,
      stdout TEXT,
      stderr TEXT,
      exit_code INTEGER,
      status VARCHAR(50),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS skill_sessions (
      id SERIAL PRIMARY KEY,
      mission_id INTEGER NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS skill_signals (
      id SERIAL PRIMARY KEY,
      skill_session_id INTEGER NOT NULL REFERENCES skill_sessions(id) ON DELETE CASCADE,
      communication INTEGER NOT NULL,
      problem_solving INTEGER NOT NULL,
      debugging INTEGER NOT NULL,
      technical_understanding INTEGER NOT NULL,
      independent_reasoning INTEGER NOT NULL,
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS skill_challenges (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      title VARCHAR(255) NOT NULL,
      description TEXT NOT NULL,
      code_language VARCHAR(50) NOT NULL,
      initial_code TEXT,
      test_code TEXT,
      bug_description TEXT,
      mode VARCHAR(50) DEFAULT 'GUIDED',
      status VARCHAR(50) DEFAULT 'AVAILABLE',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS presentation_sessions (
      id SERIAL PRIMARY KEY,
      skill_session_id INTEGER NOT NULL REFERENCES skill_sessions(id) ON DELETE CASCADE,
      fluency VARCHAR(100),
      engagement VARCHAR(100),
      composure VARCHAR(100),
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS mirror_sessions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      prep_type VARCHAR(255) NOT NULL,
      prep_title VARCHAR(255),
      topics TEXT,
      skills TEXT,
      requirements TEXT,
      difficulty VARCHAR(50) DEFAULT 'medium',
      important_areas TEXT,
      project_context TEXT,
      session_mode VARCHAR(50),
      status VARCHAR(50) DEFAULT 'ACTIVE',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      completed_at TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS mirror_dialogs (
      id SERIAL PRIMARY KEY,
      session_id INTEGER NOT NULL REFERENCES mirror_sessions(id) ON DELETE CASCADE,
      question_text TEXT NOT NULL,
      answer_text TEXT,
      input_mode VARCHAR(50),
      communication_feedback TEXT,
      technical_feedback TEXT,
      gaze_observational_signals TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS mirror_reports (
      id SERIAL PRIMARY KEY,
      session_id INTEGER NOT NULL REFERENCES mirror_sessions(id) ON DELETE CASCADE,
      communication_json TEXT,
      technical_json TEXT,
      presentation_json TEXT,
      strengths_json TEXT,
      weaknesses_json TEXT,
      next_challenge TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`
  ];

  for (const query of queries) {
    await pgPool.query(query);
  }
};

const createTablesSqlite = () => {
  return new Promise((resolve, reject) => {
    dbInstance.serialize(() => {
      dbInstance.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        full_name TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      dbInstance.run(`CREATE TABLE IF NOT EXISTS projects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )`);

      dbInstance.run(`CREATE TABLE IF NOT EXISTS missions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        project_id INTEGER,
        voice_transcript TEXT,
        status TEXT DEFAULT 'INVESTIGATING',
        language TEXT DEFAULT 'javascript',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
      )`);

      dbInstance.run(`CREATE TABLE IF NOT EXISTS mission_files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        mission_id INTEGER NOT NULL,
        filename TEXT NOT NULL,
        file_content TEXT,
        is_original INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (mission_id) REFERENCES missions(id) ON DELETE CASCADE
      )`);

      dbInstance.run(`CREATE TABLE IF NOT EXISTS agent_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        mission_id INTEGER NOT NULL,
        agent_name TEXT NOT NULL,
        message TEXT NOT NULL,
        event_type TEXT,
        status TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (mission_id) REFERENCES missions(id) ON DELETE CASCADE
      )`);

      dbInstance.run(`CREATE TABLE IF NOT EXISTS code_changes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        mission_id INTEGER NOT NULL,
        filename TEXT NOT NULL,
        before_content TEXT,
        after_content TEXT,
        status TEXT DEFAULT 'PENDING',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (mission_id) REFERENCES missions(id) ON DELETE CASCADE
      )`);

      dbInstance.run(`CREATE TABLE IF NOT EXISTS test_runs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        mission_id INTEGER NOT NULL,
        attempt_number INTEGER NOT NULL,
        stdout TEXT,
        stderr TEXT,
        exit_code INTEGER,
        status TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (mission_id) REFERENCES missions(id) ON DELETE CASCADE
      )`);

      dbInstance.run(`CREATE TABLE IF NOT EXISTS skill_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        mission_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        completed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (mission_id) REFERENCES missions(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )`);

      dbInstance.run(`CREATE TABLE IF NOT EXISTS skill_signals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        skill_session_id INTEGER NOT NULL,
        communication INTEGER NOT NULL,
        problem_solving INTEGER NOT NULL,
        debugging INTEGER NOT NULL,
        technical_understanding INTEGER NOT NULL,
        independent_reasoning INTEGER NOT NULL,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (skill_session_id) REFERENCES skill_sessions(id) ON DELETE CASCADE
      )`);

      dbInstance.run(`CREATE TABLE IF NOT EXISTS skill_challenges (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        code_language TEXT NOT NULL,
        initial_code TEXT,
        test_code TEXT,
        bug_description TEXT,
        mode TEXT DEFAULT 'GUIDED',
        status TEXT DEFAULT 'AVAILABLE',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )`);

      dbInstance.run(`CREATE TABLE IF NOT EXISTS presentation_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        skill_session_id INTEGER NOT NULL,
        fluency TEXT,
        engagement TEXT,
        composure TEXT,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (skill_session_id) REFERENCES skill_sessions(id) ON DELETE CASCADE
      )`);

      dbInstance.run(`CREATE TABLE IF NOT EXISTS mirror_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        prep_type TEXT NOT NULL,
        prep_title TEXT,
        topics TEXT,
        skills TEXT,
        requirements TEXT,
        difficulty TEXT DEFAULT 'medium',
        important_areas TEXT,
        project_context TEXT,
        session_mode TEXT,
        status TEXT DEFAULT 'ACTIVE',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        completed_at DATETIME,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )`);

      dbInstance.run(`CREATE TABLE IF NOT EXISTS mirror_dialogs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id INTEGER NOT NULL,
        question_text TEXT NOT NULL,
        answer_text TEXT,
        input_mode TEXT,
        communication_feedback TEXT,
        technical_feedback TEXT,
        gaze_observational_signals TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (session_id) REFERENCES mirror_sessions(id) ON DELETE CASCADE
      )`);

      dbInstance.run(`CREATE TABLE IF NOT EXISTS mirror_reports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id INTEGER NOT NULL,
        communication_json TEXT,
        technical_json TEXT,
        presentation_json TEXT,
        strengths_json TEXT,
        weaknesses_json TEXT,
        next_challenge TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (session_id) REFERENCES mirror_sessions(id) ON DELETE CASCADE
      )`, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  });
};

export const query = (text, params = []) => {
  if (usePostgres) {
    return pgPool.query(text, params);
  } else {
    let sqliteSql = text.replace(/\$(\d+)/g, '?');
    // Replace serial / auto_increment differences if any (not needed since we create tables separately)
    // Run SQLite query
    return new Promise((resolve, reject) => {
      // If it is an INSERT statement, we might want to return { rows: [{ id: this.lastID }] } for Postgres compatibility
      const isInsert = text.trim().toUpperCase().startsWith('INSERT');
      const isSelect = text.trim().toUpperCase().startsWith('SELECT');

      if (isSelect) {
        dbInstance.all(sqliteSql, params, (err, rows) => {
          if (err) {
            console.error('SQLITE SELECT ERROR:', err, sqliteSql, params);
            reject(err);
          } else {
            resolve({ rows });
          }
        });
      } else {
        dbInstance.run(sqliteSql, params, function (err) {
          if (err) {
            console.error('SQLITE EXEC ERROR:', err, sqliteSql, params);
            reject(err);
          } else {
            // Return compatibility format
            resolve({
              rows: isInsert ? [{ id: this.lastID }] : [],
              rowCount: this.changes
            });
          }
        });
      }
    });
  }
};
