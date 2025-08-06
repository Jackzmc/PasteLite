import * as dotenv from 'dotenv'
dotenv.config()

import fastify from 'fastify'
import Database from './Database.js'
import Sqlite from 'sqlite'
import FastifyView from '@fastify/view'
import Handlebars from 'handlebars'
import FastifyStatic from '@fastify/static'
import Path from 'path'
import cors from '@fastify/cors'
import Routes from './Routes.js'

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
  bodyLimit: process.env.BODY_LIMIT ? Number( process.env.BODY_LIMIT ) : undefined
} )

// Log all the settings

server.log.info( "Supported MIMES: " + ["text/plain", "application/json", ...SUPPORTED_APP_MIME_TYPES].join( "," ) )
server.log.info( "Allowed MIMES: " + ALLOWED_MIMES.join( ", " ) )
if(URL_PREFIX != undefined)
    server.log.info( "URL Prefix: " + URL_PREFIX )
else 
    server.log.info( "URL Prefix: (not configured, set PASTE_URL_PREFIX)" )
server.log.info(`Paste expiration (default: ${DEFAULT_EXPIRES_SECONDS}s)\t(max: ${MAX_EXPIRES_SECONDS ?? "-none-"}s)`)

// Setup middleware

server.register(cors, { 
  origin: '*',
  
})
server.register( Database )

// Setup req body parsers

import { ALLOWED_MIMES, DEFAULT_EXPIRES_SECONDS, MAX_EXPIRES_SECONDS, SUPPORTED_APP_MIME_TYPES, URL_PREFIX } from './Config.js'
server.addContentTypeParser( /^text\/.*/, { parseAs: "string" }, textParser )
server.addContentTypeParser( SUPPORTED_APP_MIME_TYPES, { parseAs: "string" }, textParser )
class ParseError extends Error {}
server.addContentTypeParser( 'application/json', { parseAs: 'string' }, function ( req, body, done ) {
  try {
    // Parse to verify it's valid JSON - but we just want the raw json
    JSON.parse( body as string )
    done( null, body )
  } catch ( err: any ) {
    done( new ParseError(err.message), undefined )
  }
} )
function textParser( req: any, body: any, done: any ) { return done( null, body ) }


server.setErrorHandler((error, req, reply) => {
    req.log.error(error)
    if(error.code == "FST_ERR_CTP_INVALID_MEDIA_TYPE") {
      return reply.status(500).send({
        error: "INVALID_MEDIA_TYPE",
        message: error.message
      })
    } else if(error instanceof ParseError) {
      return reply.status( 400 ).send( {
        error: "PARSE_ERROR",
        message: error.message
      } )
    }

    return reply.status(500).send({
        error: "INTERNAL_SERVER_ERROR",
        message: process.env.NODE_ENV === "production" ? "An internal server error ocurred" : error.stack
    })
})

server.register(FastifyView, {
    engine: {
      handlebars: Handlebars
    },
    viewExt: "hbs",
    root: 'views/'
  });
  
server.register( Routes )

server.register( FastifyStatic, {
  root: Path.resolve( 'static/' ),
  prefix: '/static',
  index: "index.html"
} )

server.listen({ port: Number(process.env.WEB_PORT ?? 8080) }, (err, address) => {
  if (err) {
    console.error(err)
    process.exit(1)
  }
})

process.on('exit', () => server.db?.close());
process.on('SIGHUP', () => process.exit(128 + 1));
process.on('SIGINT', () => process.exit(128 + 2));
process.on('SIGTERM', () => process.exit(128 + 15));