import Sqlite3 from 'sqlite3'
import { Database, open } from 'sqlite'
import FastifyPlugin from 'fastify-plugin'
import { FastifyInstance } from 'fastify';

const PURGE_TIME = process.env.PASTE_CLEANUP_INTERVAL ? Number(process.env.PASTE_CLEANUP_INTERVAL) : 3600


async function db(fastify: FastifyInstance) {
    fastify.log.debug("Setting up database")
    const db = await open( { filename: 'pastes.db', driver: Sqlite3.Database } );
    await db.run(`CREATE TABLE IF NOT EXISTS pastes (
        name VARCHAR(64) NOT NULL PRIMARY KEY, 
        content TEXT NOT NULL,
        mime VARCHAR(32) NOT NULL,
        expires INT,
        deleteToken VARCHAR(64) UNIQUE
    );`)
    fastify.log.debug( "Database ready" )
    fastify.decorate('db', db)

    fastify.log.info(`Purging expired pastes every ${PURGE_TIME} seconds`)
    setInterval(() => {
        console.debug('purging expired pastes...')
        purgeExpired(db)
    }, 1000 * PURGE_TIME)
}

async function purgeExpired(db: Database) {
    await db.run("DELETE FROM PASTES WHERE expires < UNIXEPOCH()")
}


export default FastifyPlugin(db)