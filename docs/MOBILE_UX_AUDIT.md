# Mobile UX Audit — October 2026

## Scope and limitation

This is a source/PR-level audit of the mobile-comfort changes. It is **not** a claim that the app passed a browser, device, accessibility, or production-build test. Those checks remain pending because this audit did not run the app in real mobile viewports.

## Pull-request overlap check

These open PRs touch the same file and should be reviewed together. They are not necessarily identical fixes, but parallel changes can conflict or leave one change untested if merged independently.

| PRs | Shared file | Review guidance |
| --- | --- | --- |
| [#4](https://github.com/tradervishal790-art/Learning-Os-/pull/4), [#57](https://github.com/tradervishal790-art/Learning-Os-/pull/57) | `src/Onboarding3D.tsx` | Check the short-screen/continue-button behavior and compact choice cards together. |
| [#9](https://github.com/tradervishal790-art/Learning-Os-/pull/9), [#58](https://github.com/tradervishal790-art/Learning-Os-/pull/58), [#60](https://github.com/tradervishal790-art/Learning-Os-/pull/60) | `src/StudyPlan.tsx` | Review subject/topic wrapping and attached-file remove control together. #60 is related but targets a separate interaction. |
| [#5](https://github.com/tradervishal790-art/Learning-Os-/pull/5), [#13](https://github.com/tradervishal790-art/Learning-Os-/pull/13), [#55](https://github.com/tradervishal790-art/Learning-Os-/pull/55), [#59](https://github.com/tradervishal790-art/Learning-Os-/pull/59) | `src/Dashboard.tsx` | Review sidebar scrolling, modal fit, and sticky header together; confirm stacking and scroll behavior do not conflict. |
| [#14](https://github.com/tradervishal790-art/Learning-Os-/pull/14), [#56](https://github.com/tradervishal790-art/Learning-Os-/pull/56) | `src/Mentor.tsx` | Review composer sizing and keyboard Send hint together. |
| [#11](https://github.com/tradervishal790-art/Learning-Os-/pull/11), [#16](https://github.com/tradervishal790-art/Learning-Os-/pull/16), [#20](https://github.com/tradervishal790-art/Learning-Os-/pull/20), [#61](https://github.com/tradervishal790-art/Learning-Os-/pull/61) | `src/CurrentAffairs.tsx` | Review tab wrapping, quiz option wrapping, and loading feedback together. |
| [#12](https://github.com/tradervishal790-art/Learning-Os-/pull/12), [#17](https://github.com/tradervishal790-art/Learning-Os-/pull/17), [#24](https://github.com/tradervishal790-art/Learning-Os-/pull/24), [#34](https://github.com/tradervishal790-art/Learning-Os-/pull/34), [#44](https://github.com/tradervishal790-art/Learning-Os-/pull/44), [#52](https://github.com/tradervishal790-art/Learning-Os-/pull/52), [#53](https://github.com/tradervishal790-art/Learning-Os-/pull/53) | `src/ChannelDigest.tsx` | Group the add form, title wrapping, accessible state/input, touch target, and hydration guard in one regression pass. |

**Recommended merge discipline:** do not assume same-file PRs are duplicates or merge them blindly. Review each diff, merge/rebase in a deliberate sequence, then re-run checks against the combined branch. Keep only changes that still add value after earlier PRs land.

## User-friction review and corrections

A second pass over the proposed diffs identified several avoidable inconveniences. Corrections were committed to the existing focused PR branches:

- [PR #2](https://github.com/tradervishal790-art/Learning-Os-/pull/2): the Next Video action was fixed-positioned on desktop as well as mobile. It now returns to normal inline placement at desktop widths, and the extra desktop bottom padding is removed.
- [PR #18](https://github.com/tradervishal790-art/Learning-Os-/pull/18): the file viewer now shows localized loading text with the spinner in English, Hindi, and Hinglish instead of relying on a spinner alone.
- [PR #20](https://github.com/tradervishal790-art/Learning-Os-/pull/20): the lazy-loaded Channel Digest fallback now includes visible localized status text and a polite screen-reader announcement.
- [PR #53](https://github.com/tradervishal790-art/Learning-Os-/pull/53): the channel remove control keeps its 44px target without making the icon permanently faded, improving discoverability.
- [PR #59](https://github.com/tradervishal790-art/Learning-Os-/pull/59): the custom-playlist modal header stays visible while the modal scrolls, so users can still reach its close action.

These are source-level corrections; they still need to be tested in the combined app before merging.

## Remaining risks to verify

- **Onboarding tour card (PR #3):** the card is pinned near the bottom on mobile. Check short screens and landscape so it does not cover the highlighted target or the action needed to continue/skip.
- **Sticky dashboard header (PR #55):** verify it does not obscure dialogs, focus targets, or too much of the page on short phone screens.
- **Touch targets inside compact chips/cards:** confirm the larger Channel Digest remove button does not overlap the channel-selection tap area or make the row feel crowded.
- **Long content:** wrapping is preferable to truncation for study topics and messages, but confirm it does not push important actions off-screen without a clear scroll path.

## Manual verification checklist

Run after integrating the selected PRs:

- [ ] Build and lint: `npm run build` and `npm run lint`.
- [ ] Check widths 320px, 360px, 390px, 768px, and desktop 1366px; also rotate a phone to landscape.
- [ ] Confirm there is no unintended horizontal page scrolling or clipped text/actions.
- [ ] Test onboarding choices and Continue on a short viewport.
- [ ] Open/close the mobile sidebar; scroll long navigation on a short screen; check header layering.
- [ ] Open the custom playlist modal, scroll it, and focus its inputs with the mobile keyboard open.
- [ ] Use Mentor chat with a long message and the keyboard Send action; confirm the composer stays visible.
- [ ] Check Study Plan long topic names, attached-file removal, and file opening.
- [ ] Check Current Affairs tabs, long quiz options, and loading/success/error states.
- [ ] Check Channel Digest add/remove, long titles, tab/channel state, and loading/hydration behavior.
- [ ] Verify touch actions are easy to tap and screen-reader status/labels are announced meaningfully.
- [ ] Re-test affected screens after every same-file PR is merged, not just each branch in isolation.

## Audit outcome

The source/PR review found **overlapping work that needs coordinated review**, but did not establish that the app currently passes mobile usability testing. No production or real-device pass is claimed here.
