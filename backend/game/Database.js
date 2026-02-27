const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class Database {
    constructor() {
        const dbPath = path.resolve(__dirname, '../../database.sqlite');
        this.db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                console.error("Could not connect to database", err);
            } else {
                console.log("Connected to SQLite database.");
                this.init();
            }
        });
    }

    init() {
        this.db.run(`
            CREATE TABLE IF NOT EXISTS users (
                name TEXT PRIMARY KEY,
                xp INTEGER DEFAULT 0,
                level INTEGER DEFAULT 1,
                total_kills INTEGER DEFAULT 0,
                max_mass INTEGER DEFAULT 0,
                unlocked_skins TEXT DEFAULT '["default"]',
                selected_skin TEXT DEFAULT 'default'
            )
        `);
    }

    // Upsert user profile (Create if doesn't exist, ignore if it does)
    async ensureUser(name) {
        return new Promise((resolve, reject) => {
            this.db.run(
                `INSERT OR IGNORE INTO users (name) VALUES (?)`,
                [name],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });
    }

    async getUser(name) {
        return new Promise((resolve, reject) => {
            this.db.get(`SELECT * FROM users WHERE name = ?`, [name], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    }

    async saveMatchData(name, matchXp, matchKills, matchMass) {
        await this.ensureUser(name);
        
        return new Promise((resolve, reject) => {
            this.db.get(`SELECT xp, total_kills, max_mass FROM users WHERE name = ?`, [name], (err, row) => {
                if (err) {
                    return reject(err);
                }
                
                const newXp = (row.xp || 0) + matchXp;
                const newLevel = Math.floor(Math.sqrt(newXp / 500)) + 1;
                const newKills = (row.total_kills || 0) + matchKills;
                const newMaxMass = Math.max((row.max_mass || 0), matchMass);

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
            });
        });
    }
    
    async saveCosmetics(name, selectedSkin, unlockedSkinsArr) {
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
        return new Promise((resolve, reject) => {
            this.db.all(`SELECT name, xp, level, total_kills, max_mass FROM users ORDER BY xp DESC LIMIT 10`, [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }
}

module.exports = new Database();
