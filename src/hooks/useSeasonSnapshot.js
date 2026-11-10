import { useSyncExternalStore } from 'react';
import { getSeasonSnapshot, seasonOnTheFloor, subscribeSeasons, visibleSeasons } from '@/lib/seasons';

export const useSeasonSnapshot = () => useSyncExternalStore(subscribeSeasons, getSeasonSnapshot, getSeasonSnapshot);

export const useVisibleSeasons = () => visibleSeasons(useSeasonSnapshot());

export const useSeasonOnTheFloor = () => seasonOnTheFloor(useSeasonSnapshot());
