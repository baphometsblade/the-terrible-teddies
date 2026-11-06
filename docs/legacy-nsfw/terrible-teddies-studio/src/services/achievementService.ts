import { Achievement, AchievementStat } from '../types';

const STATS_STORAGE_KEY = 'terrible-teddies-stats';
const UNLOCKED_ACHIEVEMENTS_KEY = 'terrible-teddies-unlocked-achievements';

const achievements: Achievement[] = [
    {
        id: 'first_seduction',
        name: 'First Seduction',
        description: 'Win your first intimate encounter.',
        category: 'milestone',
        icon: '💋',
        condition: (stats) => stats.gamesWon >= 1
    },
    {
        id: 'bear_enthusiast',
        name: 'Bear Enthusiast',
        description: 'Summon 10 seductive bears.',
        category: 'collection',
        icon: '🧸',
        condition: (stats) => stats.bearsSummoned >= 10
    },
     {
        id: 'bear_master',
        name: 'Bear-ristocrat Master',
        description: 'Summon 50 seductive bears.',
        category: 'collection',
        icon: '👑',
        condition: (stats) => stats.bearsSummoned >= 50
    },
    {
        id: 'card_slinger',
        name: 'Card Slinger',
        description: 'Play 25 cards.',
        category: 'combat',
        icon: '✨',
        condition: (stats) => stats.cardsPlayed >= 25
    },
    {
        id: 'grand_schemer',
        name: 'Grand Schemer',
        description: 'Play 100 cards.',
        category: 'combat',
        icon: '📜',
        condition: (stats) => stats.cardsPlayed >= 100
    },
    {
        id: 'damage_dealer',
        name: 'Satisfaction Destroyer',
        description: 'Deal 100 total damage.',
        category: 'combat',
        icon: '💥',
        condition: (stats) => stats.damageDealt >= 100
    },
     {
        id: 'overlord_of_agony',
        name: 'Overlord of Agony',
        description: 'Deal 500 total damage.',
        category: 'combat',
        icon: '🔥',
        condition: (stats) => stats.damageDealt >= 500
    },
    {
        id: 'veteran_player',
        name: 'Experienced Seducer',
        description: 'Play 10 intimate encounters.',
        category: 'milestone',
        icon: '🎭',
        condition: (stats) => stats.gamesPlayed >= 10
    }
];

class AchievementService {
    private stats: Record<AchievementStat, number>;
    private unlocked: Set<string>;

    constructor() {
        this.stats = this.load(STATS_STORAGE_KEY, {
            gamesPlayed: 0,
            gamesWon: 0,
            cardsPlayed: 0,
            damageDealt: 0,
            bearsSummoned: 0
        });
        
        const unlockedArray = this.load<string[]>(UNLOCKED_ACHIEVEMENTS_KEY, []);
        this.unlocked = new Set(unlockedArray);
    }

    private load<T>(key: string, defaultValue: T): T {
        try {
            const stored = window.localStorage.getItem(key);
            return stored ? JSON.parse(stored) : defaultValue;
        } catch (error) {
            console.error(`Error loading ${key} from localStorage`, error);
            return defaultValue;
        }
    }

    private save(key: string, data: any): void {
        try {
            window.localStorage.setItem(key, JSON.stringify(data));
        } catch (error) {
            console.error(`Error saving ${key} to localStorage`, error);
        }
    }

    public track(stat: AchievementStat, value: number): Achievement[] {
        this.stats[stat] = (this.stats[stat] || 0) + value;
        this.save(STATS_STORAGE_KEY, this.stats);
        return this.checkAndUnlock();
    }

    public checkAndUnlock(): Achievement[] {
        const newlyUnlocked: Achievement[] = [];
        for (const achievement of achievements) {
            if (!this.unlocked.has(achievement.id) && achievement.condition(this.stats)) {
                this.unlocked.add(achievement.id);
                newlyUnlocked.push(achievement);
            }
        }
        if (newlyUnlocked.length > 0) {
            this.save(UNLOCKED_ACHIEVEMENTS_KEY, Array.from(this.unlocked));
        }
        return newlyUnlocked;
    }

    public getAllAchievements(): (Achievement & { isUnlocked: boolean })[] {
        return achievements.map(ach => ({
            ...ach,
            isUnlocked: this.unlocked.has(ach.id)
        }));
    }
    
    public getStats(): Record<AchievementStat, number> {
        return this.stats;
    }
}

// Singleton instance
const achievementService = new AchievementService();
export default achievementService;
