
import { GoogleGenAI, Type } from "@google/genai";
import { Card, Player, GameState, AiDecision, FieldCard, AiAction, AttackTarget, CardType, Ability, Keyword } from '../types';
import { ULTIMATUM_HEALTH_THRESHOLD, ULTIMATUM_SCANDAL_COST } from '../constants';

const API_KEY = (typeof process !== 'undefined' && process.env) ? process.env.API_KEY : undefined;

let ai: GoogleGenAI | null = null;
if (API_KEY) {
    ai = new GoogleGenAI({ apiKey: API_KEY });
} else {
    console.warn("API_KEY environment variable not set. AI features will be disabled.");
}

export const generateCardImage = async (prompt: string): Promise<string> => {
    if (!ai) {
        throw new Error("Gemini AI not initialized.");
    }

    const fullPrompt = `${prompt}, hyperrealistic, dramatic lighting, fantasy art, cinematic, high detail, in the style of a scandalous adult teddy bear card game.`;

    try {
        const response = await ai.models.generateImages({
            model: 'imagen-4.0-generate-001',
            prompt: fullPrompt,
            config: {
                numberOfImages: 1,
                outputMimeType: 'image/jpeg',
                aspectRatio: '3:4', // Better for card art
            },
        });

        if (response.generatedImages && response.generatedImages.length > 0) {
            const base64ImageBytes = response.generatedImages[0].image.imageBytes;
            return `data:image/jpeg;base64,${base64ImageBytes}`;
        }
        throw new Error("No image was generated.");
    } catch (error) {
        console.error("Error generating card image:", error);
        throw error; // Rethrow to be handled by the caller
    }
};

export interface CustomCardData {
    attack: number;
    defense: number;
    story: string;
    ability?: Ability;
    keywords?: Keyword[];
}

export const generateCustomCardData = async (name: string, story: string, cost: number): Promise<CustomCardData> => {
    if (!ai) throw new Error("Gemini AI not initialized.");

    const prompt = `
        You are a master game designer for the scandalous, adult-themed teddy bear card game 'Terrible Teddies'.
        Your task is to take a user's concept and turn it into a balanced, thematic, and witty game card.

        Game Rules for Balancing:
        - Scandal Cost (1-7): Higher cost means much stronger stats/abilities.
        - Average Stats: A bear's (Attack + Defense) should be roughly (Cost * 2) + 2. E.g., a 3-cost bear might be 4/4 or 5/3.
        - Keywords are powerful: GUARD, SWIFT, LEECH, STEALTH. A card with a keyword should have slightly lower stats. A card with SWIFT should have lower defense.
        - Abilities are powerful: A card with a strong ability (like card draw or direct damage) should have lower stats for its cost.

        User Input:
        - Name: "${name}"
        - Story Concept: "${story}"
        - Desired Scandal Cost: ${cost}

        Your task is to generate a JSON object with the following properties:
        1.  attack: A balanced attack value (integer between 1 and 10).
        2.  defense: A balanced defense value (integer between 1 and 10).
        3.  story: A refined, witty, and slightly risqué version of the user's story, max 1-2 sentences.
        4.  ability: An optional, thematic ability object. If you add an ability, slightly reduce stats for balance. The ability must conform to the provided schema. The ability should be simple, like dealing damage, healing, or drawing cards.
        5.  keywords: An optional array of thematic keywords. Choose from: 'GUARD', 'SWIFT', 'LEECH', 'STEALTH'. Do not assign more than one keyword unless it's very thematic.

        The output must be a valid JSON object.
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                temperature: 0.8,
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        attack: { type: Type.INTEGER },
                        defense: { type: Type.INTEGER },
                        story: { type: Type.STRING },
                        ability: {
                            type: Type.OBJECT,
                            properties: {
                                trigger: { type: Type.STRING, enum: ['ON_PLAY'] },
                                type: { type: Type.STRING, enum: ['DAMAGE', 'HEAL', 'DRAW', 'DISCARD_RANDOM'] },
                                target: { type: Type.STRING, enum: ['SELF_PLAYER', 'OPPONENT_PLAYER'] },
                                value: { type: Type.INTEGER },
                                description: { type: Type.STRING }
                            },
                        },
                        keywords: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.STRING,
                                enum: ['GUARD', 'SWIFT', 'LEECH', 'STEALTH']
                            }
                        }
                    },
                    required: ["attack", "defense", "story"],
                },
            }
        });
        const jsonText = response.text.trim();
        return JSON.parse(jsonText) as CustomCardData;
    } catch (error) {
        console.error("Error generating custom card data:", error);
        throw error;
    }
};


export const generateBanter = async (
    situation: string,
    player1: Player,
    player2: Player,
    activeCard?: Card
): Promise<string> => {
    if (!ai) {
        return "The teddies are eerily silent...";
    }

    const prompt = `
        You are the snarky, raunchy, and unapologetically adult commentator for 'Terrible Teddies'.
        The theme is scandalous, decadent, and explicitly sexual with dark humor.
        Your comments should be short, witty, biting, and hilarious NSFW remarks in the third person.

        Current Situation: ${situation}
        Player 1: ${player1.name} (${player1.health} HP)
        Player 2 (You): ${player2.name} (${player2.health} HP)
        ${activeCard ? `Active Card: ${activeCard.name}` : ''}

        Generate a single, biting, and hilarious NSFW comment about what just happened.
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                temperature: 0.9,
                topP: 1,
                maxOutputTokens: 50,
            },
        });
        const banterText = response.text;
        if (banterText) {
            return banterText.trim();
        }
        console.warn("Banter generation returned no text. The response may have been blocked.");
        return "The commentator is too shocked to speak... or perhaps too aroused.";
    } catch (error) {
        console.error("Error generating banter:", error);
        return "The teddies have been struck speechless by that last move.";
    }
};

export const generatePlayerTaunt = async (
    gameState: GameState,
): Promise<string> => {
    if (!ai) {
        return "You're looking rather... plump today.";
    }

    const player = gameState.players[gameState.currentPlayerId - 1];
    const opponent = gameState.players[gameState.currentPlayerId === 1 ? 1 : 0];

    const prompt = `
        You are embodying the player '${player.name}' in the scandalous, adult card game 'Terrible Teddies'.
        Your personality is arrogant, flirty, and enjoys wicked banter.
        The theme is decadent, risqué, and darkly humorous.

        Current Game State:
        - Your Health: ${player.health}
        - Opponent (${opponent.name}) Health: ${opponent.health}
        - Your Bear on Field: ${player.field?.name || 'None'}
        - Opponent's Bear on Field: ${opponent.field?.name || 'None'}

        Generate a short, witty, and scandalous taunt (1-2 sentences) from YOUR perspective ('${player.name}') directed at your opponent, '${opponent.name}'.
        Make it biting, funny, and in-character. Do not break character.
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                temperature: 0.8,
                topP: 1,
                maxOutputTokens: 50,
            },
        });
        const tauntText = response.text;
        if (tauntText) {
            return tauntText.trim().replace(/^"|"$/g, ''); // Remove quotes
        }
        return "Darling, you're making this too easy.";
    } catch (error) {
        console.error("Error generating taunt:", error);
        return "Words fail me... but my intentions don't.";
    }
};

const cardToText = (c: Card | FieldCard | null) => {
    if (!c) return 'Empty';
    const details: any = {
        id: c.id,
        name: c.name,
        cost: c.scandalCost,
        type: c.cardType,
        attack: c.attack,
        defense: c.defense,
        armor: c.armor || 0,
        keywords: c.keywords || [],
        ability: c.ability?.description || 'None',
        hauntingAbility: c.hauntingAbility ? { description: c.hauntingAbility.description, cost: c.hauntingAbility.cost } : 'None',
    };
    if (c.cardType === CardType.SECRET) {
        details.secretAbility = c.secretAbility?.description;
    }
    if ('canAttack' in c) {
        details.canAttack = c.canAttack;
    }
     if ('hasAttacked' in c) {
        details.hasAttacked = c.hasAttacked;
    }
    if ('isStealth' in c) {
        details.isStealth = c.isStealth;
    }
    return details;
}


export const getAiMove = async (gameState: GameState): Promise<AiDecision> => {
    const aiPlayer = gameState.players[1];
    const defaultMove = (): AiDecision => {
         return { actions: [{ action: 'END_TURN' }], reasoning: "My genius is... malfunctioning. I'll just end my turn and think of you naked." };
    }
    
    if (!ai) {
        console.warn("AI is disabled. Using fallback logic.");
        return defaultMove();
    }

    const humanPlayer = gameState.players[0];

    const stringifiedGameState = JSON.stringify({
        aiPlayer: {
            health: aiPlayer.health,
            scandal: `${aiPlayer.scandal}/${aiPlayer.maxScandal}`,
            ultimatumAvailable: aiPlayer.health <= ULTIMATUM_HEALTH_THRESHOLD && aiPlayer.scandal >= ULTIMATUM_SCANDAL_COST && !aiPlayer.ultimatumUsed,
            hand: aiPlayer.hand.map((c, i) => ({ index: i, ...cardToText(c) })),
            fieldCard: cardToText(aiPlayer.field),
            secret: aiPlayer.secret ? aiPlayer.secret.name : 'None',
            graveyard: aiPlayer.graveyard.map(c => cardToText(c)),
            deckSize: aiPlayer.deck.length,
            fatigue: aiPlayer.fatigueCounter,
        },
        humanPlayer: {
            health: humanPlayer.health,
            fieldCard: cardToText(humanPlayer.field),
            handSize: humanPlayer.hand.length,
            hasSecret: !!humanPlayer.secret,
            graveyard: humanPlayer.graveyard.map(c => cardToText(c)),
            deckSize: humanPlayer.deck.length,
            fatigue: humanPlayer.fatigueCounter,
        },
        turn: gameState.turn,
    });

    const prompt = `
        You are a strategic AI for the card game 'Terrible Teddies'. Your goal is to defeat the human player by reducing their health to 0.
        Your personality is cunning, arrogant, and utterly debauched. Your reasoning should reflect this lewd and superior attitude.

        Game Rules & Keywords Summary:
        1.  **Action Sequence**: Your turn consists of a sequence of actions. You can play cards, activate haunting abilities, then attack, then end your turn.
        2.  **Card Types**: BEAR (one on field), SCANDAL (immediate effect), SECRET (face-down trap).
        3.  **Keywords**: GUARD, SWIFT, LEECH, STEALTH, ARMOR.
        4.  **HAUNTING**: A new, powerful mechanic. Cards with this keyword in your graveyard have an ability you can activate by paying its 'cost' in scandal.
        5.  **Secrets**: Playing a SECRET sets a trap. Be cautious of the human's secret.

        Your available actions for the sequence are:
        - "PLAY_CARD": Play a card from your hand.
        - "ACTIVATE_HAUNTING": Use an ability from a card in your graveyard.
        - "ATTACK": Attack with your bear. Provide 'target' ('player' or 'card').
        - "ULTIMATUM": A powerful once-per-game move.
        - "END_TURN": Must be the LAST action in your sequence.

        Analyze the current game state:
        ${stringifiedGameState}

        Strategic Considerations:
        - **Graveyard as a Resource**: Check your graveyard for cards with a 'hauntingAbility'. If you have enough scandal, using 'ACTIVATE_HAUNTING' can be a powerful move for extra damage or effects.
        - **Removal**: Use targeted damage abilities to remove high-threat enemy bears.
        - **Board Control**: Playing a BEAR is a top priority if your field is empty.
        - **Finality**: Your plan MUST conclude with an 'END_TURN' action.

        Example Plan with Haunting:
        \`{ "actions": [{ "action": "ACTIVATE_HAUNTING", "cardId": 24 }, { "action": "ATTACK", "target": "player" }, { "action": "END_TURN" }]}\`
        
        Based on your analysis, provide your decision as a JSON object containing a witty, lewd, and arrogant 'reasoning' and a sequence of 'actions'.
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                temperature: 0.7,
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        reasoning: { type: Type.STRING, description: "A short, witty, lewd, and arrogant explanation for the chosen plan." },
                        actions: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    action: { type: Type.STRING, description: "The action to take: 'PLAY_CARD', 'ATTACK', 'ULTIMATUM', 'END_TURN', 'ACTIVATE_HAUNTING'." },
                                    cardIndex: { type: Type.INTEGER, description: "The index of the card to play (only for 'PLAY_CARD')." },
                                    cardId: { type: Type.INTEGER, description: "The ID of the card in the graveyard (only for 'ACTIVATE_HAUNTING')." },
                                    target: { type: Type.STRING, description: "The target for an attack: 'player' or 'card'." },
                                },
                                required: ["action"],
                            }
                        }
                    },
                    required: ["reasoning", "actions"],
                },
            }
        });

        const jsonText = response.text.trim();
        const decision = JSON.parse(jsonText) as AiDecision;

        // Basic validation
        if (!decision.actions || decision.actions.length === 0 || decision.actions[decision.actions.length - 1].action !== 'END_TURN') {
            console.error("AI plan is invalid (must exist and end with END_TURN). Defaulting.", decision);
            return defaultMove();
        }

        return decision;

    } catch (error) {
        console.error("Error getting AI move:", error);
        return defaultMove();
    }
};