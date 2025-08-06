// MIME types that get processed as plain text
export const SUPPORTED_APP_MIME_TYPES = [
  "application/xml", "application/yaml"
]

/** Allowed MIME types (ignoring text/*) */
export const ALLOWED_MIMES = process.env.PASTE_ALLOWED_MIMES ? process.env.PASTE_ALLOWED_MIMES.split( "," ) : ["application/json"]

export const ID_ALPHABET = process.env.PASTE_ID_ALPHABET ?? "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"
export const ID_SIZE = process.env.PASTE_ID_LENGTH ? Number(process.env.PASTE_ID_LENGTH) : 12

/** The default expiration time for pastes */
export const DEFAULT_EXPIRES_SECONDS = process.env.PASTE_DEFAULT_EXPIRES ?? 86400 // sets to 1 day if not configured
/** The maximum value to clamp the expiration time of paste */
export const MAX_EXPIRES_SECONDS = process.env.PASTE_MAX_EXPIRES ? Number( process.env.PASTE_MAX_EXPIRES ) : null
/** Optional prefix to provide quick URL */
export const URL_PREFIX = process.env.PASTE_URL_PREFIX != undefined && process.env.PASTE_URL_PREFIX != "" ? process.env.PASTE_URL_PREFIX : null