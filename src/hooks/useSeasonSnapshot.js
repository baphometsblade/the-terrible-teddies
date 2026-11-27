import { useSyncExternalStore } from 'react';
import { getSeasonSnapshot, seasonComingUp, seasonOnTheFloor, subscribeSeasons, visibleSeasons } from '@/lib/seasons';

export const useSeasonSnapshot = () => useSyncExternalStore(subscribeSeasons, getSeasonSnapshot, getSeasonSnapshot);

export const useVisibleSeasons = () => visibleSeasons(useSeasonSnapshot());

export const useSeasonOnTheFloor = () => seasonOnTheFloor(useSeasonSnapshot());

export const useSeasonComingUp = () => seasonComingUp(useSeasonSnapshot());
