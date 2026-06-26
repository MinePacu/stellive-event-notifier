# Member YouTube Channel ID Sync Plan

## Summary

Add verified YouTube channel IDs for the five target music members that were missing channel IDs, then ensure music sync writes the catalog member data into `MusicMember` before syncing songs.

Missing members:

- `ayatsuno-yuni`
- `shirayuki-hina`
- `neneko-mashiro`
- `akane-lize`
- `arahashi-tabi`

## Implementation

- Update `shared/member-catalog/members.seed.json` with verified public YouTube channel IDs and handles.
- Keep `MusicMember.youtubeChannelId` as the existing DB field; do not change Prisma schema.
- Add a catalog-to-DB upsert input helper for the 10 target music members only.
- Run catalog member upsert before `syncAllMusic` and `syncOfficialStelliveMusicPlaylists`.
- Do not add Former members, official channel rows, Gangzi, or upcoming members to music member sync.

## Git Flow

- Commit this plan, seed data, DB sync code, and focused tests on `youtube-song-page-ui-docs`.
- Push `youtube-song-page-ui-docs` to both `origin` and `gitlab`.
- Rebase `feat/android-shared-ui-chrome-card-filter` onto the latest `youtube-song-page-ui-docs`.
- Push the rebased Android branch to both `origin` and `gitlab`, using `--force-with-lease` if needed.

## Tests

- Verify catalog seed has YouTube channel IDs for all 10 target music members.
- Verify DB upsert inputs include exactly the 10 target music members and all have channel IDs.
- Run only focused backend tests affected by this change.
