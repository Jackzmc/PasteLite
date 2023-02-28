# PasteLite

Since hastebin now seems to require a developer token, I needed a new tool to paste content from my projects that my users can use without registration.
After a lot of researching for alternatives that were light, that didn't use formdata and instead used the HTTP body for paste contents, I finally decided to make my own.

Written in typescript and using Fastify & Handlebars, PasteLite is a fast, simple, and lightweight tool to just allow without registration users to paste content and retrieve it simply.

Pastes are stored using sqlite into a `pastes.db` file

## Routes

* `POST /paste` - Create a new paste
  * Query Parameters:
    * `expires` - The time in seconds from creation for to expire, 0 if allowed to never expire
    * `textOnly` - Returns all information in plain text, per line to make it easier to parse without a JSON library
  * Returns:
    * JSON (default): `{ name, url, expires, type, deleteToken }`
    * Text (?textOnly): `name\ndeleteToken\nurl`
* `GET /:name` - Returns HTML of a paste with syntax highlighting
  * Query Parameters:
    * `theme` - Can be set to 'light' to use a light theme
* `GET /:name/raw` - Returns text/plain of the paste's content
* `GET /:name/json` - Returns JSON of the paste
  * Returns:
    * `{ name, content, expires, type }`
    * * `GET /:name/json` - Returns JSON of the paste
* `DELETE /:name/:deleteToken` - Deletes a paste with the given delete token (given on creation)
  * Returns:
    * 204 on success
    * 401 on incorrect/missing token
    * 404 on unknown paste

## Config

All the settings you want to change can be configured through environmental variables:

```
WEB_PORT = The port the server to run on
PASTE_DEFAULT_EXPIRES - The default amount of seconds a paste will expire, default is 1 day
PASTE_MAX_EXPIRES - If set, will put maximum amount of seconds that a paste can expire 
PASTE_ALLOWED_MIMES - The mime types that are allowed, by default is any text/*
PASTE_ID_ALPHABET - The characters to use for generating ids, default is '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
PASTE_ID_LENGTH - The number of characters to generate for an id, default is 12
PASTE_URL_PREFIX - If set, creating a paste will return 'url' with this being prefixed with paste name
```
