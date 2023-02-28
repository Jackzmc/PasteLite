import Sqlite from 'better-sqlite3'

const PURGE_TIME = process.env.PASTE_CLEANUP_INTERVAL ? Number(process.env.PASTE_CLEANUP_INTERVAL) : 3600


export default function() {
    const db = Sqlite('pastes.db');
    db.prepare(`CREATE TABLE IF NOT EXISTS pastes (
        name VARCHAR(64) NOT NULL PRIMARY KEY, 
        content TEXT NOT NULL,
        mime VARCHAR(32) NOT NULL,
        expires INT,
        deleteToken VARCHAR(64) UNIQUE
    );`).run()
    db.pragma('journal_mode = WAL');

    setInterval(() => {
        purgeExpired(db)
    }, 1000 * PURGE_TIME)

    return db
}

function purgeExpired(db: Sqlite.Database) {
    db.prepare("DELETE FROM PASTES WHERE expires < UNIXEPOCH()")
        .run()
}

