import fastify from 'fastify'
import Database from './Database.js'
import Sqlite from 'better-sqlite3'
import FastifyView from '@fastify/view'
import Handlebars from 'handlebars'
import FastifyStatic from '@fastify/static'
import Path from 'path'
import * as dotenv from 'dotenv'
dotenv.config()

const SUPPORTED_APP_MIME_TYPES = [
    "application/xml", "application/yaml"
]

declare module 'fastify' {
    export interface FastifyInstance {
      db: Sqlite.Database;
    }
  }
  
const server = fastify({ 
    trustProxy: process.env.NODE_ENV === "production",
    logger: process.env.NODE_ENV === "production" 
        ? true
        : {
            transport: {
            target: 'pino-pretty',
            options: {
                translateTime: 'HH:MM:ss Z',
                ignore: 'pid,hostname',
            },
            },
            level: 'debug'
        },
})
server.register(Database)

import Routes from './Routes.js'
server.addContentTypeParser(/^text\/.*/, { parseAs: "string" }, textParser)
server.addContentTypeParser(SUPPORTED_APP_MIME_TYPES, { parseAs: "string" }, textParser)
function textParser(req: any, body: any, done: any) { return done(null, body )}

server.setErrorHandler((error, req, reply) => {
    req.log.error(error)
    return reply.status(500).send({
        error: "INTERNAL_SERVER_ERROR",
        message: process.env.NODE_ENV === "production" ? "An internal server error ocurred" : error.stack
    })
})

server.register(FastifyStatic, {
    root: Path.resolve('static/'),
    prefix: '/static'
})

server.register(FastifyView, {
    engine: {
      handlebars: Handlebars
    },
    viewExt: "hbs",
    root: 'views/'
  });
  
server.register(Routes)

server.listen({ port: Number(process.env.WEB_PORT ?? 8080) }, (err, address) => {
    if (err) {
      console.error(err)
      process.exit(1)
    }
    console.log(`Server listening at ${address}`)
})

process.on('exit', () => server.db.close());
process.on('SIGHUP', () => process.exit(128 + 1));
process.on('SIGINT', () => process.exit(128 + 2));
process.on('SIGTERM', () => process.exit(128 + 15));