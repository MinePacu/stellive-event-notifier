# Notification Policy

## Scopes

Supported preference scopes:
- `global`
- `generation`
- `member`
- `platform`
- `event_type`
- `generation_platform`
- `generation_event_type`
- `member_platform`
- `member_event_type`

Generations/categories include `gen1`, `gen2`, `gen3`, `gamja`, `official`, and `gen4-upcoming`.

## Defaults

- Global notifications: on
- 1기생/2기생/3기생/감자/기타: on
- upcoming: off
- Delivery mode: standard
- Realtime mode: off until user enables it
- CHZZK chat: off
- Official X post: on
- Official YouTube upload: on
- Official YouTube live events: unsupported and not generated

## Resolution

Global off blocks all notifications. Member explicit overrides can override generation/category settings. Platform and event-type settings apply to the event. More specific member/generation platform and event-type rules can override broader platform/event-type rules. Quiet hours, keyword block, and rate limit always apply last.

## Examples

- `global=false` means every notification is off.
- `gen2=false` plus `neneko-mashiro=true explicitOverride` allows Neneko Mashiro notifications.
- `youtube=false` plus `tenko-shibuki/youtube=true explicitOverride` allows Tenko Shibuki YouTube notifications.
- `gamja=false` plus `gangzi=true explicitOverride` allows Gangzi notifications.
- `official=false` plus `stellive-official=true explicitOverride` allows official X/upload notifications.
- Official YouTube live events are never generated even if a setting exists.

## Tap Action

`open_app` opens an app deep link. `open_platform` opens the original platform URL. Both values are included in push payloads and user-visible local history.
