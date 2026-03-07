const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class Database {
  constructor() {
    this.db = null;
    this.connectionPromise = null;
  }

  async connect() {
    if (this.db) return this.db;
    if (this.connectionPromise) return this.connectionPromise;

    const dbPath = path.resolve(__dirname, '../../database.sqlite');
    this.connectionPromise = new Promise((resolve, reject) => {
      const db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
          this.connectionPromise = null;
          console.error('Could not connect to database', err);
          reject(err);
          return;
        }

        this.db = db;
        console.log('Connected to SQLite database.');
        this.init()
          .then(() => resolve(db))
          .catch((initErr) => {
            this.connectionPromise = null;
            reject(initErr);
          });
      });
    });

    return this.connectionPromise;
  }

  init() {
    return new Promise((resolve, reject) => {
      this.db.serialize(() => {
        this.db.run(
          `
              CREATE TABLE IF NOT EXISTS users (
                  name TEXT PRIMARY KEY,
                  xp INTEGER DEFAULT 0,
                  level INTEGER DEFAULT 1,
                  total_kills INTEGER DEFAULT 0,
                  max_mass INTEGER DEFAULT 0,
                  unlocked_skins TEXT DEFAULT '["default"]',
                  selected_skin TEXT DEFAULT 'default'
              )
          `,
          (userErr) => {
            if (userErr) {
              reject(userErr);
              return;
            }

            this.db.run(
              `
                  CREATE TABLE IF NOT EXISTS analytics_events (
                      id INTEGER PRIMARY KEY AUTOINCREMENT,
                      session_id TEXT,
                      event_name TEXT NOT NULL,
                      player_name TEXT,
                      platform TEXT,
                      payload TEXT,
                      created_at TEXT NOT NULL
                  )
              `,
              (analyticsErr) => {
                if (analyticsErr) {
                  reject(analyticsErr);
                  return;
                }

                this.db.run(
                  `
                      CREATE TABLE IF NOT EXISTS push_tokens (
                          token TEXT PRIMARY KEY,
                          platform TEXT,
                          player_name TEXT,
                          updated_at TEXT NOT NULL
                      )
                  `,
                  (pushErr) => {
                    if (pushErr) {
                      reject(pushErr);
                      return;
                    }

                    this.ensureUserColumns()
                      .then(() => resolve())
                      .catch(reject);
                  }
                );
              }
            );
          }
        );
      });
    });
  }

  ensureUserColumns() {
    return new Promise((resolve, reject) => {
      this.db.all(`PRAGMA table_info(users)`, [], (err, rows) => {
        if (err) {
          reject(err);
          return;
        }

        const existingColumns = new Set((rows || []).map((row) => row.name));
        const missingStatements = [];

        if (!existingColumns.has('google_uid')) {
          missingStatements.push(`ALTER TABLE users ADD COLUMN google_uid TEXT`);
        }
        if (!existingColumns.has('google_email')) {
          missingStatements.push(`ALTER TABLE users ADD COLUMN google_email TEXT`);
        }
        if (!existingColumns.has('google_photo_url')) {
          missingStatements.push(`ALTER TABLE users ADD COLUMN google_photo_url TEXT`);
        }
        if (!existingColumns.has('auth_provider')) {
          missingStatements.push(`ALTER TABLE users ADD COLUMN auth_provider TEXT`);
        }

        const runNext = (index) => {
          if (index >= missingStatements.length) {
            resolve();
            return;
          }

          this.db.run(missingStatements[index], (alterErr) => {
            if (alterErr) {
              reject(alterErr);
              return;
            }

            runNext(index + 1);
          });
        };

        runNext(0);
      });
    });
  }

  // Upsert user profile (Create if doesn't exist, ignore if it does)
  async ensureUser(name) {
    await this.connect();
    return new Promise((resolve, reject) => {
      this.db.run(`INSERT OR IGNORE INTO users (name) VALUES (?)`, [name], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async getUser(name) {
    await this.connect();
    return new Promise((resolve, reject) => {
      this.db.get(`SELECT * FROM users WHERE name = ?`, [name], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  async saveMatchData(name, matchXp, matchKills, matchMass) {
    await this.connect();
    await this.ensureUser(name);

    return new Promise((resolve, reject) => {
      this.db.get(
        `SELECT xp, total_kills, max_mass FROM users WHERE name = ?`,
        [name],
        (err, row) => {
          if (err) {
            return reject(err);
          }

          const newXp = (row.xp || 0) + matchXp;
          const newLevel = Math.floor(Math.sqrt(newXp / 500)) + 1;
          const newKills = (row.total_kills || 0) + matchKills;
          const newMaxMass = Math.max(row.max_mass || 0, matchMass);

          this.db.run(
            `UPDATE users 
                     SET xp = ?, level = ?, total_kills = ?, max_mass = ?
                     WHERE name = ?`,
            [newXp, newLevel, newKills, newMaxMass, name],
            (updateErr) => {
              if (updateErr) reject(updateErr);
              else resolve({ newXp, newLevel });
            }
          );
        }
      );
    });
  }

  async saveCosmetics(name, selectedSkin, unlockedSkinsArr) {
    await this.connect();
    await this.ensureUser(name);
    return new Promise((resolve, reject) => {
      this.db.run(
        `UPDATE users SET selected_skin = ?, unlocked_skins = ? WHERE name = ?`,
        [selectedSkin, JSON.stringify(unlockedSkinsArr), name],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  async getLeaderboard() {
    await this.connect();
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT name, xp, level, total_kills, max_mass FROM users ORDER BY xp DESC LIMIT 10`,
        [],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  }

  async saveAnalyticsEvents(events) {
    await this.connect();
    if (!Array.isArray(events) || events.length === 0) {
      return 0;
    }

    return new Promise((resolve, reject) => {
      this.db.serialize(() => {
        const stmt = this.db.prepare(
          `INSERT INTO analytics_events (session_id, event_name, player_name, platform, payload, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`
        );

        for (const event of events.slice(0, 100)) {
          stmt.run([
            typeof event.sessionId === 'string' ? event.sessionId : null,
            typeof event.name === 'string' ? event.name : 'unknown',
            typeof event.payload?.playerName === 'string' ? event.payload.playerName : null,
            typeof event.payload?.platform === 'string' ? event.payload.platform : null,
            JSON.stringify(event.payload || {}),
            typeof event.createdAt === 'string' ? event.createdAt : new Date().toISOString(),
          ]);
        }

        stmt.finalize((err) => {
          if (err) reject(err);
          else resolve(Math.min(events.length, 100));
        });
      });
    });
  }

  async savePushToken({ token, platform, playerName }) {
    await this.connect();
    if (!token || typeof token !== 'string') {
      return false;
    }

    const updatedAt = new Date().toISOString();
    return new Promise((resolve, reject) => {
      this.db.run(
        `INSERT INTO push_tokens (token, platform, player_name, updated_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(token) DO UPDATE SET
           platform = excluded.platform,
           player_name = excluded.player_name,
           updated_at = excluded.updated_at`,
        [token, typeof platform === 'string' ? platform : null, typeof playerName === 'string' ? playerName : null, updatedAt],
        (err) => {
          if (err) reject(err);
          else resolve(true);
        }
      );
    });
  }

  async linkGoogleAccount({ name, googleUid, googleEmail, googlePhotoUrl }) {
    await this.connect();
    if (!name || !googleUid) {
      return false;
    }

    await this.ensureUser(name);

    return new Promise((resolve, reject) => {
      this.db.run(
        `UPDATE users
         SET google_uid = ?,
             google_email = ?,
             google_photo_url = ?,
             auth_provider = ?
         WHERE name = ?`,
        [googleUid, googleEmail || null, googlePhotoUrl || null, 'google', name],
        (err) => {
          if (err) reject(err);
          else resolve(true);
        }
      );
    });
  }
}

module.exports = new Database();
