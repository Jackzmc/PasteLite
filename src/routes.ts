import { FastifyInstance, FastifyPluginOptions, FastifyReply, FastifyRequest } from 'fastify';
import { customAlphabet, nanoid } from 'nanoid'
import { resolve } from 'path'
import { createReadStream } from 'fs'
import { ALLOWED_MIMES, DEFAULT_EXPIRES_SECONDS, ID_ALPHABET, ID_SIZE, MAX_EXPIRES_SECONDS, URL_PREFIX } from './config.js';

export const nanoidName = customAlphabet( ID_ALPHABET, ID_SIZE )

interface PasteObject {
    name: string,
    mime: string,
    content: string,
    expires: number | null
}

export default async function routes( fastify: FastifyInstance, opts: FastifyPluginOptions ) {
    fastify.get( '/', ( req, reply ) => {
        reply.sendFile("index.html")
    })

    fastify.post( '/paste', async ( req: FastifyRequest<{ Querystring: { expires?: number, textOnly?: boolean } }>, res: FastifyReply ) => {
        const textResponse = req.query.textOnly != undefined
        // Check if the content type is text/* or any whitelisted mime types
        if ( !req.headers['content-type']?.startsWith( "text/" ) && !ALLOWED_MIMES.includes( req.headers['content-type']! )) {
            const mimes = ["text/*", ...ALLOWED_MIMES]
            const msg = `Paste content-type is not supported, must be one of ${mimes.join(", ")}`
            if(textResponse)
                return res.status(400).send("INVALID_CONTENT_TYPE\n" + msg)
            else
                return res.status(400).send({
                    error: "INVALID_CONTENT_TYPE",
                    message: msg,
                    supportedMimes: mimes
                })
        }
        const deleteToken = nanoid(32)
        // Get the expires date or fallback to the default expires, or fallback to 1 day
        const expiresStr = req.query.expires ?? DEFAULT_EXPIRES_SECONDS
        let expires = Number(expiresStr)
        // Clamp the empires seconds to MAX_EXPIRES_SECONDS, if set
        if ( MAX_EXPIRES_SECONDS != null && expires > MAX_EXPIRES_SECONDS ) {
            expires = MAX_EXPIRES_SECONDS
        }

        // If query ?expires is 0, then expires will be null (never expire)
        const expiresDate = req.query.expires !== 0 ? Math.floor( Date.now() / 1000 ) + expires : null
            

        const paste: PasteObject = {
            name: nanoidName(),
            mime: req.headers['content-type']!,
            expires: expiresDate,
            content: req.body as string
        }

        await fastify.db.run(
            "INSERT INTO PASTES (name, content, mime, expires, deleteToken) VALUES (?, ?, ?, ?, ?)",
            [paste.name, paste.content, paste.mime, paste.expires, deleteToken]
        )

        fastify.log.info( `created new paste name = ${paste.name}, type = ${req.headers['content-type']} ` )
        addHeaders(paste, res, deleteToken)

        if ( textResponse ) {
            let str = `${paste.name}\n$${deleteToken}`
            if ( URL_PREFIX ) str += `\n${URL_PREFIX + paste.name}`
            return str
        } else {
            return {
                name: paste.name,
                url: URL_PREFIX && `${URL_PREFIX}${paste.name}`,
                expires: paste.expires,
                type: paste.mime,
                deleteToken
            }
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
        const paste = await fastify.db.get( "SELECT content, mime, expires FROM pastes WHERE name = ?", [req.params.id] )
        if ( !paste ) {
            return res.status( 404 ).send( {
                error: "PASTE_NOT_FOUND",
                message: "Could not find a paste with that ID"
            } )
        }

        addHeaders( paste, res )
        res.header( "Content-Type", "text/html" )

        return res.view( "paste.html.hbs", {
            name: req.params.id,
            content: paste.content,
            mime: paste.mime,
            dark: req.query.theme !== "light",
            language: `language-markdown`
        } )
    }

    async function textHandler( req: FastifyRequest<{ Params: { id: string }, Querystring: { theme?: string } }>, res: FastifyReply ) {
        const paste = await fastify.db.get<PasteObject>( "SELECT content, mime, expires  FROM pastes WHERE name = ?", [req.params.id] )
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
        const paste = await fastify.db.get<PasteObject>( "SELECT name, content, mime, expires FROM pastes WHERE name = ?", [req.params.id] )
        if ( !paste ) {
            return res.status( 404 ).send( {
                error: "PASTE_NOT_FOUND",
                message: "Could not find a paste with that ID"
            } )
        }

        addHeaders( paste, res )

        if ( paste.mime.startsWith( "application/json" ) ) {
            res.type( "application/json" )
            return paste.content
        } 

        return res.status( 404 ).send( {
            error: "PASTE_NOT_JSON",
            message: "Paste exists but is not valid JSON"
        })
    }

    async function metaHandler( req: FastifyRequest<{ Params: { id: string }, Querystring: { theme?: string } }>, res: FastifyReply ) {
        const paste = await fastify.db.get<PasteObject>( "SELECT name, content, mime, expires FROM pastes WHERE name = ?", [req.params.id] )
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
function addHeaders( paste: PasteObject, res: FastifyReply, deleteToken?: string ) {
    res.header( "PASTE_EXPIRES", paste.expires )
    res.header( "PASTE_MIME", paste.mime )
    if(deleteToken)
        res.header( "PASTE_DELETE_TOKEN", deleteToken)
}