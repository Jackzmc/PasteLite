# PasteLite

I could not find any alternatives to hastebin that requires no developer token, so I finally gave up and made my own.

Written in typescript with Fastify & Handlebars.

Uses sqlite, saving to a `pastes.db` file

## Routes

* `POST /paste` - Create a new paste
  * Query Parameters:
    * `expires` - The time in seconds from creation for to expire, 0 if allowed to never expire
  * Returns:
    * `{ id, expires, type, deleteToken }`
* `GET /:id` - Returns HTML of a paste with syntax highlighting
  * Query Parameters:
    * `theme` - Can be set to 'light' to use a light theme
* `GET /:id/raw` - Returns text/plain of the paste's content
* `GET /:id/json` - Returns JSON of the paste
  * Returns:
    * `{ id, content, expires, type }`
    * * `GET /:id/json` - Returns JSON of the paste
* `DELETE /:id/:deleteToken` - Deletes a paste with the given delete token (given on creation)
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
```
