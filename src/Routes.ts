import { FastifyInstance, FastifyPluginOptions, FastifyReply, FastifyRequest } from 'fastify';
import { customAlphabet, nanoid } from 'nanoid/async'
import { resolve } from 'path'
import { createReadStream } from 'fs'

const ID_ALPHABET = process.env.PASTE_ID_ALPHABET ?? "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"
const ID_SIZE = process.env.PASTE_ID_LENGTH ? Number(process.env.PASTE_ID_LENGTH) : 12
const nanoidName = customAlphabet(ID_ALPHABET, ID_SIZE)

/** The default expiration time for pastes */
const DEFAULT_EXPIRES_SECONDS = process.env.PASTE_DEFAULT_EXPIRES ?? 86400 // sets to 1 day if not configured
/** The maximum value to clamp the expiration time of paste */
const MAX_EXPIRES_SECONDS = process.env.PASTE_MAX_EXPIRES ? Number( process.env.PASTE_MAX_EXPIRES ) : null
/** Allowed MIME types (ignoring text/*) */
const ALLOWED_MIMES = process.env.PASTE_ALLOWED_MIMES?.split( "," )
/** Optional prefix to provide quick URL */
const URL_PREFIX = process.env.PASTE_URL_PREFIX

export default async function routes( fastify: FastifyInstance, opts: FastifyPluginOptions ) {
    if(URL_PREFIX != undefined)
        fastify.log.info( "URL Prefix: " + URL_PREFIX )
    else 
        fastify.log.info( "URL Prefix: (not configured, set PASTE_URL_PREFIX)" )
    
    fastify.log.info(`Paste expiration (default: ${DEFAULT_EXPIRES_SECONDS}s)\t(max: ${MAX_EXPIRES_SECONDS ?? "-none-"}s)`)

    fastify.get('/', (req, res) => {
        const homepageStream = createReadStream(resolve('./static/index.html'))
        return res.type('text/html').send(homepageStream)
    })

    fastify.post( '/paste', async ( req: FastifyRequest<{ Querystring: { expires?: number, textOnly?: boolean } }>, res: FastifyReply ) => {
        const textResponse = req.query.textOnly != undefined
        // Check if the content type is text/* or any whitelisted mime types
        if(!req.headers['content-type']?.startsWith("text/") && (!ALLOWED_MIMES || !ALLOWED_MIMES.includes(req.headers['content-type']!))) {
            if(textResponse)
                return res.status(400).send("INVALID_CONTENT_TYPE\nPaste is not a valid text file, must be a text/ mime type")
            else
                return res.status(400).send({
                    error: "INVALID_CONTENT_TYPE",
                    message: "Paste is not a valid text file, must be a text/ mime type"
                })
        }

        const id = await nanoidName()
        const deleteToken = await nanoid(32)
        // Get the expires date or fallback to the default expires, or fallback to 1 day
        const expiresStr = req.query.expires ?? DEFAULT_EXPIRES_SECONDS
        let expires = Number(expiresStr)
        // Clamp the empires seconds to MAX_EXPIRES_SECONDS, if set
        if(MAX_EXPIRES_SECONDS != null && expires > MAX_EXPIRES_SECONDS) {
            expires = MAX_EXPIRES_SECONDS
        }

        // If query ?expires is 0, then expires will be null (never expire)
        const expiresDate = req.query.expires !== 0 ? Math.floor(Date.now() / 1000) + expires : null

        await fastify.db.run(
            "INSERT INTO PASTES (name, content, mime, expires, deleteToken) VALUES (?, ?, ?, ?, ?)",
            [id, req.body, req.headers['content-type'], expiresDate, deleteToken]
        )

        fastify.log.info(`created new paste name = ${id}, type = ${req.headers['content-type']} `)

        if ( textResponse ) {
            let str = `${id}\n$${deleteToken}`
            if(URL_PREFIX) str += `\n${URL_PREFIX + id}`
            return str
        } else
            return {
                name: id,
                url: URL_PREFIX ? URL_PREFIX + id : undefined,
                expires: expiresDate,
                type: req.headers['content-type'],
                deleteToken
            }
    })

    fastify.delete('/:id/:token?', async (req: FastifyRequest<{Params: { id: string, token?: string}}>, res: FastifyReply) => {
        if(!req.params.token) {
            return res.status(401).send({
                error: "DELETE_TOKEN_MISSING",
                message: "No delete token was found"
            })
        }

        const paste = await fastify.db.get("SELECT name, deleteToken FROM pastes WHERE name = ?", [req.params.id])
        if(!paste) {
            return res.status(404).send({
                error: "PASTE_NOT_FOUND",
                message: "Could not find a paste with that ID"
            })
        }
        if(paste.deleteToken == req.params.token) {
            await fastify.db.run("DELETE FROM pastes WHERE name = ? AND deleteToken = ?", [paste.name, paste.deleteToken])
            fastify.log.info(`paste deleted ${paste.name}`)
            return res.status(204).send()
        } else {
            return res.status(401).send({
                error: "DELETE_TOKEN_INVALID",
                message: "Delete token is invalid"
            })
        }
    } )
    
    async function htmlHandler( req: FastifyRequest<{ Params: { id: string }, Querystring: { theme?: string } }>, res: FastifyReply ) {
        if ( req.params.id === "favicon.ico" ) return res.status( 404 ).send( "404 Not Found" )
        const paste = await fastify.db.get( "SELECT content, mime FROM pastes WHERE name = ?", [req.params.id] )
        if ( !paste ) {
            return res.status( 404 ).send( {
                error: "PASTE_NOT_FOUND",
                message: "Could not find a paste with that ID"
            } )
        }

        addHeaders( paste, res )
        res.header( "Content-Type", "text/html" )

        return res.view( "Paste.hbs", {
            name: req.params.id,
            content: paste.content,
            mime: paste.mime,
            dark: req.query.theme !== "light",
            language: `language-markdown`
        } )
    }

    async function textHandler( req: FastifyRequest<{ Params: { id: string }, Querystring: { theme?: string } }>, res: FastifyReply ) {
        const paste = await fastify.db.get( "SELECT content, mime FROM pastes WHERE name = ?", [req.params.id] )
        if ( !paste ) {
            return res.status( 404 ).send( {
                error: "PASTE_NOT_FOUND",
                message: "Could not find a paste with that ID"
            } )
        }

        addHeaders( paste, res )

        res.header( "Content-Type", "text/plain" )
        res.header( "Content-Disposition", `inline; filename="${req.params.id}.txt"` )
        return res.send( paste.content )
    }

    async function jsonHandler( req: FastifyRequest<{ Params: { id: string }, Querystring: { theme?: string } }>, res: FastifyReply ) {
        const paste = await fastify.db.get( "SELECT name, content, mime, expires FROM pastes WHERE name = ?", [req.params.id] )
        if ( !paste ) {
            return res.status( 404 ).send( {
                error: "PASTE_NOT_FOUND",
                message: "Could not find a paste with that ID"
            } )
        }

        addHeaders( paste, res )

        if ( paste.mime.startsWith( "application/json" ) ) {
            res.type( "application/json" )
            return JSON.stringify(paste.content, null, 2)
        } 

        return res.status( 404 ).send( {
            error: "PASTE_NOT_JSON",
            message: "Paste exists but is not valid JSON"
        })
    }

    async function metaHandler( req: FastifyRequest<{ Params: { id: string }, Querystring: { theme?: string } }>, res: FastifyReply ) {
        const paste = await fastify.db.get( "SELECT name, content, mime, expires FROM pastes WHERE name = ?", [req.params.id] )
        if ( !paste ) {
            return res.status( 404 ).send( {
                error: "PASTE_NOT_FOUND",
                message: "Could not find a paste with that ID"
            } )
        }

        addHeaders(paste, res)

        return res.send( {
            name: paste.name,
            content: paste.content,
            type: paste.mime,
            expires: paste.expires
        } )
    }

    fastify.get( '/:id', htmlHandler )
    fastify.get( '/:id.html', htmlHandler )

    fastify.get( '/:id/raw', textHandler )
    fastify.get( '/:id.txt', textHandler )

    fastify.get( '/:id/json', jsonHandler )
    fastify.get( '/:id.json', jsonHandler )

    fastify.get( '/:id/meta', metaHandler )
    fastify.get( '/:id.meta.json', metaHandler )
}

/**
 * Adds headers about the paste:
 * 'PASTE_EXPIRES' - unix timestamp when paste expires
 * 'PASTE_MIME' - the content type of the paste
 * @param paste paste obj
 * @param res fastify reply
 */ 
function addHeaders( paste: any, res: FastifyReply ) {
    res.header( "PASTE_EXPIRES", paste.expires )
    res.header( "PASTE_MIME", paste.mime )
}