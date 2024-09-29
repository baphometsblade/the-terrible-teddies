-- Policies for terrible_teddies table
CREATE POLICY "Teddies are viewable by everyone" ON public.terrible_teddies FOR SELECT USING (true);

-- Policies for players table
CREATE POLICY "Players can view their own data" ON public.players FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Players can update their own data" ON public.players FOR UPDATE USING (auth.uid() = user_id);

-- Policies for player_teddies table
CREATE POLICY "Players can view their own teddies" ON public.player_teddies FOR SELECT USING (auth.uid() = (SELECT user_id FROM public.players WHERE id = player_id));
CREATE POLICY "Players can insert their own teddies" ON public.player_teddies FOR INSERT WITH CHECK (auth.uid() = (SELECT user_id FROM public.players WHERE id = player_id));

-- Policies for battles table
CREATE POLICY "Players can view their own battles" ON public.battles FOR SELECT USING (auth.uid() IN (SELECT user_id FROM public.players WHERE id IN (player1_id, player2_id)));

-- Policies for player_submissions table
CREATE POLICY "Players can view their own submissions" ON public.player_submissions FOR SELECT USING (auth.uid() = (SELECT user_id FROM public.players WHERE id = player_id));
CREATE POLICY "Players can insert their own submissions" ON public.player_submissions FOR INSERT WITH CHECK (auth.uid() = (SELECT user_id FROM public.players WHERE id = player_id));