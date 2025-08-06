# PasteLite

Very lightweight and simple paste service. Can support any type of file configured, and can display in HTML, raw text, or JSON. Pastes can automatically expire after a set time.

Written in typescript and using Fastify & Handlebars, PasteLite is a fast, simple, and lightweight tool to just allow without registration users to paste content and retrieve it simply.

Pastes are stored using sqlite into a `pastes.db` file

## Routes

* `POST /paste` - Create a new paste with type based off content-type
  * Query Parameters:
    * `expires` - The time in seconds from creation for to expire, 0 if allowed to never expire
    * `textOnly` - Returns all information in plain text, per line to make it easier to parse without a JSON library
  * Returns:
    * JSON (default): `{ name, url, expires, type, deleteToken }`
    * Text (?textOnly): `name\ndeleteToken\nurl`
* `GET /:name` `GET /:name.html` - Returns HTML of a paste with syntax highlighting
  * Query Parameters:
    * `theme` - Can be set to 'light' to use a light theme
* `GET /:name/raw` `GET /:name.txt` - Returns text/plain of the paste's content
* `GET /:name/json` `GET /:name.json` - Returns paste's JSON if available
  * Returns:
    * 200 `{ name, content, expires, type }`
    * 404 if paste content not JSON (`$.error = PASTE_NOT_JSON`)
    * 404 if paste does not exist (`$.error = PASTE_NOT_FOUND`)
* `GET /:name/meta` `GET /:name.meta.json` - Returns metadata of the paste in JSON
  * Returns:
    * `{ name, content, expires, type }`
    * 404 if paste does not exist (`$.error = PASTE_NOT_FOUND`)
* `DELETE /:name/:deleteToken` - Deletes a paste with the given delete token (given on creation)
  * Returns:
    * 204 on success
    * 401 on incorrect/missing token
    * 404 if paste does not exist (`$.error = PASTE_NOT_FOUND`)

## Examples

### Paste a file (as plain text)

```bash
cat text.txt | curl http://localhost:8080/paste -X POST --data-binary @- -H "Content-Type: text/plain"
```

### Paste JSON

```bash
curl -H "Content-Type: application/json" -d @data.json http://localhost:8080/paste
```

### Paste & Get URL

```bash
#!/bin/bash
DOMAIN=http://localhost:8080
PASTE_ID=$(
    echo "test content im uploading" |
    curl -sbX POST $DOMAIN/paste?textOnly=1 -H 'Content-Type: text/plain' --data-binary @- | 
    # Returns id and delete token, only grab id
    head -1
)
echo Paste: $DOMAIN/$PASTE_ID.txt
```

###

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
