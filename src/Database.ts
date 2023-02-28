import Sqlite from 'better-sqlite3'
import FastifyPlugin from 'fastify-plugin'
import { FastifyInstance } from 'fastify';

const PURGE_TIME = process.env.PASTE_CLEANUP_INTERVAL ? Number(process.env.PASTE_CLEANUP_INTERVAL) : 3600


async function db(fastify: FastifyInstance) {
    fastify.log.debug("setting up database")
    const db = Sqlite('pastes.db');
    db.prepare(`CREATE TABLE IF NOT EXISTS pastes (
        name VARCHAR(64) NOT NULL PRIMARY KEY, 
        content TEXT NOT NULL,
        mime VARCHAR(32) NOT NULL,
        expires INT,
        deleteToken VARCHAR(64) UNIQUE
    );`).run()
    db.pragma('journal_mode = WAL');
    fastify.decorate('db', db)

    fastify.log.info(`purging expired pastes every ${PURGE_TIME} seconds`)
    setInterval(() => {
        console.debug('purging expired pastes...')
        purgeExpired(db)
    }, 1000 * PURGE_TIME)
}

function purgeExpired(db: Sqlite.Database) {
    db.prepare("DELETE FROM PASTES WHERE expires < UNIXEPOCH()")
        .run()
}


export default FastifyPlugin(db)