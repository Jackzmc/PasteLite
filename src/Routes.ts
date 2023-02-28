import { FastifyInstance, FastifyPluginOptions, FastifyReply, FastifyRequest } from 'fastify';
import { customAlphabet, nanoid } from 'nanoid/async'

const ID_ALPHABET = process.env.PASTE_ID_ALPHABET ?? "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"
const ID_SIZE = process.env.PASTE_ID_LENGTH ? Number(process.env.PASTE_ID_LENGTH) : 12
const nanoidName = customAlphabet(ID_ALPHABET, ID_SIZE)

import HighlightJs from 'highlight.js'

const MAX_EXPIRES_SECONDS = process.env.PASTE_MAX_EXPIRES ? Number(process.env.PASTE_MAX_EXPIRES) : null
const ALLOWED_MIMES = process.env.PASTE_ALLOWED_MIMES?.split(",")

export default async function routes(fastify: FastifyInstance, opts: FastifyPluginOptions) {
    fastify.post('/paste', async (req: FastifyRequest<{Querystring: { expires?: number, textOnly?: boolean }}>, res: FastifyReply) => {
        // Check if the content type is text/* or any whitelisted mime types
        if(!req.headers['content-type']?.startsWith("text/") && (!ALLOWED_MIMES || !ALLOWED_MIMES.includes(req.headers['content-type']!))) {
            if(req.query.textOnly)
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
        const expiresStr = req.query.expires ?? process.env.PASTE_DEFAULT_EXPIRES ?? 86400
        let expires = Number(expiresStr)
        // Clamp the empires seconds to MAX_EXPIRES_SECONDS, if set
        if(MAX_EXPIRES_SECONDS != null && expires > MAX_EXPIRES_SECONDS) {
            expires = MAX_EXPIRES_SECONDS
        }

        // If query ?expires is 0, then expires will be null (never expire)
        const expiresDate = req.query.expires !== 0 ? Math.floor(Date.now() / 1000) + expires : null

        await fastify.db.prepare("INSERT INTO PASTES (name, content, mime, expires, deleteToken) VALUES (?, ?, ?, ?, ?)")
            .bind(id, req.body, req.headers['content-type'], expiresDate, deleteToken)
            .run()

        if(req.query.textOnly)
            return {
                id,
                expires: expiresDate,
                type: req.headers['content-type'],
                deleteToken
            }
        else
            return `${id}\n${deleteToken}`
    })

    fastify.delete('/:id/:token?', async (req: FastifyRequest<{Params: { id: string, token?: string}}>, res: FastifyReply) => {
        if(!req.params.token) {
            return res.status(401).send({
                error: "DELETE_TOKEN_MISSING",
                message: "No delete token was found"
            })
        }

        const paste = await fastify.db.prepare("SELECT name, deleteToken FROM pastes WHERE name = ?")
            .get(req.params.id)
        if(!paste) {
            return res.status(404).send({
                error: "PASTE_NOT_FOUND",
                message: "Could not find a paste with that ID"
            })
        }

        if(paste.deleteToken == req.params.token) {
            await fastify.db.prepare("DELETE FROM pastes WHERE name = ? AND deleteToken = ?")
                .bind(paste.name, paste.deleteToken)
                .run()
            return res.status(204).send()
        } else {
            return res.status(401).send({
                error: "DELETE_TOKEN_INVALID",
                message: "Delete token is invalid"
            })
        }
    })

    fastify.get('/:id', async (req: FastifyRequest<{Params: { id: string}, Querystring: { theme?: string }}>, res: FastifyReply) => {
        const paste = await fastify.db.prepare("SELECT content, mime FROM pastes WHERE name = ?")
            .get(req.params.id)
        if(!paste) {
            return res.status(404).send({
                error: "PASTE_NOT_FOUND",
                message: "Could not find a paste with that ID"
            })
        }

        // if(paste.mime === "text/html")
        // res.header("Content-Type", paste.mime)
        
        res.header("Content-Type", "text/html")
        // const highlight = HighlightJs.highlight(paste.content, {
        //     language: 'markdown'
        // })
        return res.view("Index.hbs", {
            name: req.params.id,
            content: paste.content,
            mime: paste.mime,
            dark: req.query.theme !== "light",
            language: `language-markdown`
        })
    })

    fastify.get('/:id/raw', async (req: FastifyRequest<{Params: { id: string}, Querystring: { theme?: string }}>, res: FastifyReply) => {
        const paste = await fastify.db.prepare("SELECT content, mime FROM pastes WHERE name = ?")
            .get(req.params.id)
        if(!paste) {
            return res.status(404).send({
                error: "PASTE_NOT_FOUND",
                message: "Could not find a paste with that ID"
            })
        }

        res.header("Content-Type", "text/plain")
        res.header("Content-Disposition", `inline; filename="${req.params.id}.txt`)
        return res.send(paste.content)
    })

    fastify.get('/:id/json', async (req: FastifyRequest<{Params: { id: string}, Querystring: { theme?: string }}>, res: FastifyReply) => {
        const paste = await fastify.db.prepare("SELECT name, content, mime, expires FROM pastes WHERE name = ?")
            .get(req.params.id)
        if(!paste) {
            return res.status(404).send({
                error: "PASTE_NOT_FOUND",
                message: "Could not find a paste with that ID"
            })
        }

        return res.send({
            name: paste.name,
            content: paste.content,
            type: paste.mime,
            expires: paste.expires
        })
    })
}