# Local standard stickers

Standard sticker pack metadata does not include its artwork. An instance with imported metadata but no local sticker files displays failed tiles in the native picker when outbound sticker requests are disabled.

Provision the official catalog and artwork once, then serve them locally:

```sh
DOTENV_CONFIG_PATH=/path/to/instance/.env node scripts/provision-stickers.mjs --import-catalog
```

If the standard catalog is already present, omit `--import-catalog`. This operator command contacts only Discord's official catalog API and static CDN. It does not change runtime network settings. Existing pack metadata and artwork are preserved. It currently supports PostgreSQL and file storage; set `STORAGE_LOCATION` to the instance's actual file storage directory when it differs from the environment file's sibling `files` directory.

The provisioner uses four workers, a 15-second request timeout, a 4 MiB per-artwork limit and a 256 MiB download/cache budget. Redirects are rejected. Lottie animations must be valid, self-contained documents: remote URLs and unresolved image paths fail validation. A local manifest records each asset's format, byte count, canonical source and SHA-256 checksum. Reruns validate existing files against those pins and download only missing files. A partial run exits unsuccessfully and reports failed sticker IDs; correct the cause and rerun. Do not commit the artwork cache to Git. Back up the storage directory and its manifest with other instance data.

The local CDN serves installed standard and custom guild stickers before considering any upstream fallback. Runtime fallback for canonical Discord sticker artwork requires `externalRequests.discordStickerPacks` explicitly enabled; the broader asset fallback switch does not override that choice. The default remains disabled.

On the isolated demo, 361 standard assets (136 APNG and 225 Lottie) occupied 86,202,583 bytes. A second provision run preserved all 361 files and fetched zero bytes. The native picker changed from ten visible “Uh Oh!” tiles and asset HTTP 404 responses to zero failed tiles and HTTP 200 responses. Sending and custom-upload evidence are tracked separately from this artwork provisioning check.

Reproduce the bounded native artwork check on the isolated admin demo:

```sh
DOTENV_CONFIG_PATH=/tmp/fosscord-admin-perf/.env node scripts/dev/sticker-picker-smoke.mjs --trace
```

It registers two disposable accounts through Cap, accepts their friendship, logs in through the native client, creates one temporary guild/PNG sticker, checks Lottie/APNG/custom PNG rendering, and removes only its fixtures. The final run passed all three formats, recorded only HTTP 200 sticker responses, and had no failed tiles or browser errors. Screenshots: [Lottie](qa/stickers/local-lottie-picker.png), [APNG](qa/stickers/local-apng-picker.png), [custom PNG](qa/stickers/local-custom-picker.png).

`--send` additionally tests native tile activation and the recipient's decrypted render. This remains a separate unresolved regression: native activation produced no message request in the scoped test. The sender's wire and native premium type were both 2, and native custom-sticker eligibility was true. Artwork provisioning does not establish sending compatibility.
