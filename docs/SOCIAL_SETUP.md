# Social linking: Discord and X

Players link Discord (and, optionally, X) onto the account they already use,
then sit with friends. The game never calls the paid X follower API. Discord
server ids are hashed on the server and are not stored.

Live PvP (`20261110130000_pvp_matches`) is not on main. Friend challenges go
through one function, `challenge_friend(friend_id, mode)`, which the client
calls as `challengeFriend(friendId, mode)` in `src/lib/social/client.js`.

- `ghost` deals a ghost brawl now (`ladder_matches`, kind `challenge`).
- `live` inserts `public.friend_challenges` (`mode = 'live'`, `status = 'open'`)
  and returns `seam: 'friend_challenges'`. It does not deal a deck. When the
  PvP migration lands, fulfill those rows or replace the live branch of
  `challenge_friend`. Do not add a second client entry.

Apply the migration before expecting any of this to work:

```sh
npx supabase db push
```

The file is `supabase/migrations/20261110140000_social_links.sql`. Do not
auto-merge a pull request that contains it; review the SQL, then push it to
the database yourself.

Project ref: `wqdrbywcktxgytkyqcco`.
Site: `https://terribleteddies.vercel.app`.
Supabase callback (the same URL for both providers):

```text
https://wqdrbywcktxgytkyqcco.supabase.co/auth/v1/callback
```

Until a provider is enabled, its link button stays hidden. The app reads
`GET /auth/v1/settings` and only shows a button when that provider is `true`.
Unlink stays available if the identity is already on the account.

## 1. Discord application

Discord is the primary link. The client asks for the scopes `identify` and
`guilds`. `identify` is the username. `guilds` is the server list, used once,
on the way back from Discord, to suggest players who linked and share a
server. The request to Discord is `GET https://discord.com/api/users/@me/guilds`.
Only the numeric server ids are sent to `remember_guilds`. The function
stores `sha256(pepper || ':' || guild_id)` and returns a count. Unlinking
Discord deletes the handle and those hashes.

1. Open <https://discord.com/developers/applications> and create an application.
   A bot is not required. Do not add privileged gateway intents.
2. Open **OAuth2**. Add this redirect:

   ```text
   https://wqdrbywcktxgytkyqcco.supabase.co/auth/v1/callback
   ```

3. Copy the **Client ID** and create a **Client Secret**. Reset the secret if
   it has been pasted anywhere else; the dashboard stores it, the repo does not.
4. In the Supabase dashboard, open
   <https://supabase.com/dashboard/project/wqdrbywcktxgytkyqcco/auth/providers>
   and enable **Discord**. Paste the client id and secret. Save.
5. The scopes are requested by the app (`identify guilds`). You do not put
   them on a bot. Leave the default Discord scopes in the provider if the
   form has a scopes field, and make sure `identify` and `guilds` are allowed.
   Do not request `guilds.members.read` or any scope that lists other people's
   accounts.

## 2. X (Twitter) OAuth 2.0

X is for a handle on the profile and for a "share invite" link
(`https://x.com/intent/post`). The app does not read followers.

1. Open <https://developer.x.com/> and create a project and an app with
   **User authentication settings** turned on.
2. Set the app type so users can sign in (OAuth 2.0). Set the callback URL to
   the same Supabase callback:

   ```text
   https://wqdrbywcktxgytkyqcco.supabase.co/auth/v1/callback
   ```

3. Permissions: Read. Scopes the app requests are `users.read` and `tweet.read`.
   Do not enable `follows.read`. Do not add a bearer token to this repo, and
   do not call `https://api.x.com`.
4. Copy the OAuth 2.0 **Client ID** and **Client Secret**.
5. In the same Supabase providers page, enable **X** (the dashboard still
   labels the provider Twitter). Paste the client id and secret. The provider
   id the API uses is `twitter`. Save.

## 3. Manual identity linking

Linking adds Discord or X onto an account that is already signed in. That is
manual linking, and it is off until you turn it on.

1. Open Authentication settings for the project:
   <https://supabase.com/dashboard/project/wqdrbywcktxgytkyqcco/auth/providers>
2. Enable **Manual linking** (the control sits with the provider configuration).
3. On a self-hosted GoTrue, the same switch is
   `GOTRUE_SECURITY_MANUAL_LINKING_ENABLED=true`.

If the switch is off, the link button still shows once the provider is
enabled, and the click tells the player that linking is not switched on. It
does not half-link.

A player can unlink whenever they have another way in (the email login counts).
Unlink calls `unlinkIdentity`, then `sync_links`, which deletes the derived
handle and, for Discord, the guild hashes.

## 4. Redirect allow list

`linkIdentity` sends the player back to the site, not to the Supabase callback.
The callback above is only for Discord and X to talk to Supabase.

In Authentication → URL configuration, set:

- Site URL: `https://terribleteddies.vercel.app`
- Redirect URLs, including local and preview if you use them:

  ```text
  https://terribleteddies.vercel.app/**
  http://localhost:8080/**
  ```

Add each preview origin you actually use. A redirect that is not on the list
is refused and the link never completes.

## 5. Realtime presence

Friends see each other as around, in a fight, or at the bar. A player can
appear offline. Strangers do not get the socket.

1. In Realtime settings, turn **Allow public access** off so private channels
   use the RLS policies. The migration adds `social_presence_select` and
   `social_presence_insert` on `realtime.messages` when that table already
   exists. It does not create or alter the table (hosted Supabase rejects that).
2. Apply `20261110140000_social_links.sql` after Realtime is enabled, or
   re-run the policy block at the bottom of that file if Realtime was enabled
   later. The function `can_see_presence(uuid)` is what the policy calls:
   friends only, and not someone who chose to appear offline.
3. The browser already allows `wss://*.supabase.co` and `https://discord.com`
   in `vercel.json`. No other host is required.

## 6. What the player can do after this

- Link or unlink Discord and X from **Rankings → The ladder → The room**,
  under Pals.
- Search by in-game name or by a linked Discord username.
- See suggestions for people who share a hashed Discord server.
- Send, accept, and decline a friend request. Accept also follows both ways.
  Unfriend leaves the follows. Block removes the friendship, the requests,
  and both follows.
- Share an invite link or its QR code. Opening `/?friend=<code>` after sign-in
  auto-friends, once, up to 40 redemptions. Invites and requests are rate
  limited.
- Challenge a friend to a ghost brawl from the pals list, their card, or the
  brawl picker (friend decks are listed before a stranger).
- Challenge them to a live brawl. Until PvP is on main, that books the
  `friend_challenges` row and tells them the room is not open yet.
- Open **This week → Friends** to rank against friends only.

## 7. If a button is missing

| What you see | What is wrong |
| --- | --- |
| No Link Discord / Link X | The provider is off, or `/auth/v1/settings` did not answer. Enable it in the dashboard. The rest of Pals still works. |
| "Linking is not switched on for this bar yet." | Manual linking is off. Step 3. |
| "Pals are not open on this server yet." | The migration is not applied. |
| Suggestions stay empty | Discord linked, but the return trip had no provider token, or the two players do not share a server. Link again from the game so the guild list can be hashed. |
| Live challenge does not start a fight | Expected until `20261110130000_pvp_matches` fulfills `friend_challenges`. |
