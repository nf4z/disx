# Attachment upload buffering

Attachment uploads reserve buffering capacity after their internal signature or cloud reservation is authorized, before the raw or multipart parser starts reading the body. The reservation stays active while parsing, storage writes and the cloud attachment transaction finish. A client disconnect during a storage write does not release its capacity early. Parser errors and aborted raw or multipart bodies release capacity after parser cleanup; handler completion or failure drops buffered body references before releasing the lease.

Two environment variables control each CDN worker:

| Variable | Default | Accepted values |
| --- | ---: | --- |
| `CDN_UPLOAD_BUFFER_BUDGET_BYTES` | 1073741824 (1 GiB) | Positive safe integer in bytes |
| `CDN_UPLOAD_MAX_CONCURRENT` | 16 | Integer from 1 through 64 |

Every upload counts toward concurrency, including a zero-byte file. The admission pool does not queue waiting uploads or parse rejected bodies. An upload whose reservation exceeds the entire byte budget receives 413 with a buffering-capacity message. Exhausted current capacity receives 503 and `Retry-After: 1`. Invalid environment values fail closed with 503 and an upload-buffering configuration diagnostic; values and credentials are not included in that message.

Cloud uploads reserve twice the attachment's declared file size plus 64 KiB for multipart fields and framing. The existing configured per-file cap and the reservation's own file cap still apply. Raw decompression remains disabled. The default byte budget admits a 500 MiB file, reserving 1000 MiB plus 64 KiB; another upload is admitted only if its reservation fits the remaining capacity.

Internal signed multipart uploads retain the existing 100 MiB parser file cap. With a valid `Content-Length`, file buffering is bounded by the smaller of that total body length and 100 MiB. The field allowance is the smaller of 64 MiB and four times the total body length plus 64 KiB, conservatively covering strings and field parsing without making tiny files reserve the maximum. Missing lengths, including chunked requests, reserve the full 100 MiB file cap plus 64 MiB allowance. Malformed lengths return 400; bodies declared larger than the file cap plus that allowance return 413 before parsing. The pool supports an ordinary fifteen-attachment batch; sixteen tiny signed uploads can remain in storage concurrently, and a seventeenth receives 503.

The weight includes space for incoming chunks and their concatenated file buffer; it is a bound on upload admission rather than a complete process RSS limit. Storage backends, network buffers, other routes and the runtime also use memory. Set a budget appropriate to the worker's available memory and leave room for those uses. Each worker has its own pool, so deployment capacity must account for all workers. To retain a chosen cloud per-file size, the budget must fit twice that size plus 64 KiB. Increasing the configured file cap does not bypass the buffering budget. Lowering concurrency below the configured maximum attachment batch size may require the caller to retry busy uploads.

This pool covers internal attachment POSTs and cloud raw/multipart PUTs. Other CDN multipart families, image decoding and persistent storage quotas have separate limits.

## Verification

```sh
node --test scripts/tests/upload-admission.test.cjs scripts/tests/cdn-upload-authorization.test.cjs
```

The real HTTP/route tests cover authorization before parsing, declared file limits, zero-byte uploads, raw and multipart abort cleanup, storage failures, disconnects during held storage, busy and permanent capacity errors, sixteen concurrent tiny signed uploads, malformed configuration, and the existing reservation deletion race.

A bounded before/after experiment held eight authorized 8 MiB payloads at mocked storage, each using a 500 MiB reservation. Before admission, all eight reached storage and retained 64 MiB of handler buffers. After admission, one retained 8 MiB and seven returned 503. RSS changed by approximately 303 MB before and 239 MB after, but that test ran HTTP clients and the server in the same process. Those RSS values include client-side buffers and are not a server capacity claim. The sanitized results are in `docs/qa/security/upload-buffering.json`; no production files were written or deleted.
