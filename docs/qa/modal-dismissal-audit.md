# Modal dismissal follow-up

The shipped FosscordModals fix already covers native nested Change Banner backdrop clicks. No additional client source change was justified in this follow-up.

`node --test scripts/tests/modal-layering.test.cjs` passes three checks: the parent test and desktop/mobile subtests at 1440px and 390px widths. The isolated Chromium fixture loads the current cached native modal stylesheet and the actual FosscordModals stylesheet. With the older scrim-only rule, the inactive underlying modal layer intercepts an outside pointer click. Adding the current inactive-layer rule puts that layer below the scrim. The backdrop then closes only the nested picker, retains the underlying display-name draft, and does not receive clicks inside the dialog or its separate portal popup. The fixture makes no network request or account changes.

The fixture supplies representative modal DOM and dismissal callbacks; it does not prove every native React dialog or popover has identical behavior. The cached client stylesheet is required, and the test explicitly skips when that stylesheet or the local Playwright/browser is unavailable.

The earlier real native regression is `scripts/dev/modal-backdrop-smoke.mjs`; it covered a banner lightbox above a framed sidebar and nested Change Banner backdrop/Escape behavior with dirty profile input. It currently reuses the demo tester and friend DM. It was not rerun in this follow-up because existing-user fixtures must remain untouched. A future actual-native regression should create disposable Cap accounts and clean their own sessions/data.

The original expanded-profile/banner-under-frame failure remains unconfirmed. This fixture does not close MOD-001/002, inventory every custom popover (MOD-004), or establish unsaved-edit confirmation and keyboard focus restoration for all dialogs (MOD-008/009). Those require their own observed native cases rather than a general click-outside event listener that could discard forms or break portals.
