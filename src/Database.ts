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

    fastify.log.info(`Checking for expired pastes to purge every ${PURGE_TIME} seconds`)
    setInterval(() => {
        console.debug('purging any expired pastes...')
        purgeExpired(fastify, db)
    }, 1000 * PURGE_TIME)
}

async function purgeExpired( fastify: FastifyInstance, db: Database) {
    const a = await db.run( "DELETE FROM PASTES WHERE expires < UNIXEPOCH()" )
    if(a.changes && a.changes > 0)
        fastify.log.info(`purged ${a.changes} expired pastes`)
}


export default FastifyPlugin(db)