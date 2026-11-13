-- Performance advisor clean-up: RLS initplan and unindexed foreign keys.
--
-- 1. auth_rls_initplan. A policy that calls auth.uid() bare is evaluated once
--    per row the query touches; wrapped as (SELECT auth.uid()) the planner
--    hoists it into an InitPlan and evaluates it once per statement. The
--    predicate is otherwise byte-for-byte the one already live, and ALTER
--    POLICY keeps each policy's command, roles and permissiveness, so who can
--    read or write what does not change. purchases_select_own and
--    user_gems_select_own are left alone on purpose: they sit on the money
--    tables, which this pass does not touch.
--
-- 2. unindexed_foreign_keys. Every flagged FK gets a plain btree on its
--    column, so the cascade from auth.users / parent rows (and the
--    "my rows" lookups these columns serve) is an index scan instead of a
--    sequential one. The tables are small, so a plain CREATE INDEX inside the
--    migration's transaction is fine. purchases_user_id_fkey is skipped for
--    the same money-table reason.

ALTER POLICY admins_select_self ON public.admins
  USING ((user_id = (SELECT auth.uid())));
ALTER POLICY friend_challenges_party ON public.friend_challenges
  USING ((((SELECT auth.uid()) = challenger_id) OR ((SELECT auth.uid()) = friend_id)));
ALTER POLICY friend_redemptions_party ON public.friend_invite_redemptions
  USING ((((SELECT auth.uid()) = redeemer) OR ((SELECT auth.uid()) = (SELECT i.inviter FROM public.friend_invites i WHERE i.code = friend_invite_redemptions.code))));
ALTER POLICY friend_invites_own ON public.friend_invites
  USING (((SELECT auth.uid()) = inviter));
ALTER POLICY friend_requests_party ON public.friend_requests
  USING ((((SELECT auth.uid()) = from_user) OR ((SELECT auth.uid()) = to_user)));
ALTER POLICY friendships_member ON public.friendships
  USING ((((SELECT auth.uid()) = user_low) OR ((SELECT auth.uid()) = user_high)));
ALTER POLICY linked_identities_own ON public.linked_identities
  USING (((SELECT auth.uid()) = user_id));
ALTER POLICY player_blocks_own ON public.player_blocks
  USING (((SELECT auth.uid()) = blocker));
ALTER POLICY player_saves_delete_own ON public.player_saves
  USING (((SELECT auth.uid()) = user_id));
ALTER POLICY player_saves_insert_own ON public.player_saves
  WITH CHECK (((SELECT auth.uid()) = user_id));
ALTER POLICY player_saves_select_own ON public.player_saves
  USING (((SELECT auth.uid()) = user_id));
ALTER POLICY player_saves_update_own ON public.player_saves
  USING (((SELECT auth.uid()) = user_id))
  WITH CHECK (((SELECT auth.uid()) = user_id));
ALTER POLICY players_select_own ON public.players
  USING (((SELECT auth.uid()) = user_id));
ALTER POLICY presence_prefs_own ON public.presence_prefs
  USING (((SELECT auth.uid()) = user_id));
ALTER POLICY push_inbox_own ON public.push_inbox
  USING (((SELECT auth.uid()) = user_id));
ALTER POLICY push_subscriptions_own ON public.push_subscriptions
  USING (((SELECT auth.uid()) = user_id));
ALTER POLICY pvp_views_own ON public.pvp_views
  USING ((user_id = (SELECT auth.uid())));

CREATE INDEX IF NOT EXISTS cup_entries_user_id_fk_idx ON public.cup_entries (user_id);
CREATE INDEX IF NOT EXISTS follows_followee_fk_idx ON public.follows (followee);
CREATE INDEX IF NOT EXISTS friend_challenges_challenger_id_fk_idx ON public.friend_challenges (challenger_id);
CREATE INDEX IF NOT EXISTS friend_challenges_ladder_match_id_fk_idx ON public.friend_challenges (ladder_match_id);
CREATE INDEX IF NOT EXISTS friend_invite_redemptions_redeemer_fk_idx ON public.friend_invite_redemptions (redeemer);
CREATE INDEX IF NOT EXISTS friend_invites_inviter_fk_idx ON public.friend_invites (inviter);
CREATE INDEX IF NOT EXISTS friend_requests_to_user_fk_idx ON public.friend_requests (to_user);
CREATE INDEX IF NOT EXISTS gang_members_gang_id_fk_idx ON public.gang_members (gang_id);
CREATE INDEX IF NOT EXISTS gangs_founder_fk_idx ON public.gangs (founder);
CREATE INDEX IF NOT EXISTS ladder_matches_ghost_id_fk_idx ON public.ladder_matches (ghost_id);
CREATE INDEX IF NOT EXISTS pack_owned_card_id_fk_idx ON public.pack_owned (card_id);
CREATE INDEX IF NOT EXISTS player_blocks_blocked_fk_idx ON public.player_blocks (blocked);
CREATE INDEX IF NOT EXISTS player_reports_target_fk_idx ON public.player_reports (target);
CREATE INDEX IF NOT EXISTS push_outbox_user_id_fk_idx ON public.push_outbox (user_id);
CREATE INDEX IF NOT EXISTS pvp_invites_host_id_fk_idx ON public.pvp_invites (host_id);
CREATE INDEX IF NOT EXISTS pvp_views_user_id_fk_idx ON public.pvp_views (user_id);
CREATE INDEX IF NOT EXISTS referrals_referrer_fk_idx ON public.referrals (referrer);
