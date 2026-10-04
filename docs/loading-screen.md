# Instance loading screen

In **Admin → Site settings → Loading screen**, enter one “Did you know?” tip per line and paste a self-contained loading SVG. The controls apply to the whole instance. The order follows the textarea, and the client randomly selects a tip on startup. Empty tips or SVG restore the built-in defaults. Preview shows the first custom tip and animation; Restore defaults clears the fields, and Save settings publishes them.

Tips are limited to 100 entries of 500 characters each. SVGs are limited to 64 KB, 1,000 elements and 64 nested levels. Strict XML validation permits drawing elements, gradients, local fragment references, CSS and SVG animation. Scripts, event handlers, embedded HTML, external resources and document declarations are rejected. Custom SVGs render as images rather than injected page markup. Tips render as text.

Saving invalid markup returns HTTP 400 before changing configuration. Saved values appear in the next page load through local `GLOBAL_ENV` values; no third-party API is involved. Changes invalidate the generated HTML cache, including the slowmode and encryption settings published in the same environment. Existing open pages pick up changes on reload.

Validation: `node --test scripts/tests/loading-screen.test.cjs scripts/tests/admin-captcha-settings.test.cjs`. The isolated browser check `node scripts/dev/loading-screen-smoke.mjs` verifies actual API persistence, unsafe SVG rejection, HTML cache invalidation, preview/reset, narrow admin layout, and the native loading screen while temporarily delaying gateway delivery. It restores the original loading configuration and logs out its own test session. Screenshots are in `docs/qa/loading-screen`.
