const { Player } = require('./WorldState');

class BotController {
    constructor(gameEngine) {
        this.gameEngine = gameEngine;
        this.world = gameEngine.world;
        
        this.bots = new Map(); // Map of botId -> bot configuration
        this.minPlayers = (gameEngine.roomId === 'OFFLINE') ? 22 : 12; // More bots for offline mode, slightly more for multiplayer too
        this.botCounter = 0;
        
        this.targetAngleOffsetRange = Math.PI / 4; // Max deviation when wandering
        
        this.respawnQueue = []; // [{ time: spawnAtTime }]
        this.respawnDelay = (gameEngine.roomId === 'OFFLINE') ? 2000 : 5000; // Faster respawn in offline mode
    }

    update(pelletTree, bodyTree) {
        this.currentPelletTree = pelletTree;
        this.currentBodyTree = bodyTree;
        this.balancePopulation();
        this.calculateBotDecisions();
    }

    balancePopulation() {
        const totalPlayers = Object.keys(this.world.players).length;
        const now = Date.now();

        // Check if we need to queue a respawn
        if (totalPlayers + this.respawnQueue.length < this.minPlayers) {
            // In OFFLINE mode, spawn the first batch much faster (instant for the first 5)
            const gap = this.minPlayers - (totalPlayers + this.respawnQueue.length);
            const initialBurst = (this.gameEngine.roomId === 'OFFLINE' && totalPlayers < 5) ? 5 : 1;
            
            for (let i = 0; i < initialBurst && (totalPlayers + this.respawnQueue.length < this.minPlayers); i++) {
                this.respawnQueue.push(now + (i * 200)); // 200ms spacing for burst
            }
        }

        // Process queue
        if (this.respawnQueue.length > 0 && now >= this.respawnQueue[0]) {
            this.respawnQueue.shift();
            this.spawnBot();
        }

        // If real players join and we exceed cap, remove bots
        if (totalPlayers > this.minPlayers && this.bots.size > 0) {
            const firstBotId = this.bots.keys().next().value;
            this.removeBot(firstBotId);
        }
    }

    spawnBot() {
        const botId = `bot_${this.botCounter++}`;
        const newBotUser = new Player(botId, this.world.bounds);
        
        // Give bot a recognizable name
        newBotUser.name = `[BOT] ${this.getRandomName()}`;
        
        this.world.players[botId] = newBotUser;
        
        // Assign a personality
        const personalities = ['AGGRESSIVE', 'COWARD', 'SCAVENGER'];
        const personality = personalities[Math.floor(Math.random() * personalities.length)];

        this.bots.set(botId, {
            id: botId,
            personality,
            state: 'WANDER', // WANDER, FEED, FLEE, ATTACK, COIL
            targetAngle: Math.random() * Math.PI * 2,
            currentAngle: Math.random() * Math.PI * 2,
            actionTimer: 0,
            turnSpeed: 0.15, // Radians per tick
            targetPlayerId: null // For coiling/attacking
        });
        
        // Initialize an empty input object that the engine expects
        this.gameEngine.inputs[botId] = {
            angle: 0,
            isBoosting: false,
            useAbility: false
        };
    }

    getRandomName() {
        const names = ["Snek", "DangerNoodle", "Slither", "Viper", "Cobra", "Python", "Mamba", "Boa", "Adder"];
        return names[Math.floor(Math.random() * names.length)];
    }

    removeBot(botId) {
        this.bots.delete(botId);
        this.gameEngine.removePlayer(botId);
    }

    calculateBotDecisions() {
        const now = Date.now();
        for (const [botId, botData] of this.bots) {
            const botPlayer = this.world.players[botId];
            if (!botPlayer) continue;

            // 1. Initialize Resultants
            let desireX = 0;
            let desireY = 0;
            let isBoosting = false;
            let useAbility = false;

            // 2. Global Utility Modifiers (Personality based)
            const p = botData.personality;
            const aggression = (p === 'AGGRESSIVE') ? 1.5 : (p === 'SCAVENGER' ? 0.7 : 0.4);
            const caution = (p === 'COWARD') ? 1.8 : (p === 'AGGRESSIVE' ? 0.5 : 1.0);
            const hunger = (botPlayer.mass < 200) ? 2.0 : 1.0;

            // 3. Potential Field: Pellets (Attraction)
            const pelletSearchDist = 1000;
            for (const pid in this.world.pellets) {
                const pellet = this.world.pellets[pid];
                const dx = pellet.x - botPlayer.position.x;
                const dy = pellet.y - botPlayer.position.y;
                const distSq = dx * dx + dy * dy;
                
                if (distSq < pelletSearchDist * pelletSearchDist) {
                    const dist = Math.sqrt(distSq);
                    const weight = (100 / (dist + 10)) * hunger; 
                    desireX += (dx / dist) * weight;
                    desireY += (dy / dist) * weight;
                    
                    // Utility check for Magnet
                    if (dist < 400 && botPlayer.ability.type === 'MAGNET') useAbility = true;
                }
            }

            // 4. Potential Field: Other Players (Attraction/Repulsion)
            for (const pid in this.world.players) {
                if (pid === botId) continue;
                const other = this.world.players[pid];
                const dx = other.position.x - botPlayer.position.x;
                const dy = other.position.y - botPlayer.position.y;
                const distSq = dx * dx + dy * dy;
                const dist = Math.sqrt(distSq);

                if (dist < 1500) {
                    if (other.mass > botPlayer.mass * 1.1) {
                        // REPULSION (Fear)
                        const fearWeight = (1000000 / (distSq + 1)) * caution;
                        desireX -= (dx / dist) * fearWeight;
                        desireY -= (dy / dist) * fearWeight;
                        
                        if (dist < 600) isBoosting = true;
                        if (dist < 300 && botPlayer.ability.type === 'SHIELD') useAbility = true;
                    } else if (botPlayer.mass > other.mass * 1.3) {
                        // ATTRACTION (Predation)
                        const huntWeight = (500 / (dist + 1)) * aggression;
                        desireX += (dx / dist) * huntWeight;
                        desireY += (dy / dist) * huntWeight;
                        
                        if (dist < 500) isBoosting = true;
                    }
                }
            }

            // 5. Potential Field: Hazards (Strong Repulsion)
            for (const bh of this.world.blackHoles) {
                const dx = bh.x - botPlayer.position.x;
                const dy = bh.y - botPlayer.position.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < bh.pullRadius + 200) {
                    const bhWeight = (2000000 / (dist + 1));
                    desireX -= (dx / dist) * bhWeight;
                    desireY -= (dy / dist) * bhWeight;
                    isBoosting = true;
                }
            }

            // 6. Potential Field: Boundaries
            const m = 400;
            const b = this.world.bounds;
            if (botPlayer.position.x < m) desireX += (m - botPlayer.position.x) * 10;
            else if (botPlayer.position.x > b.width - m) desireX -= (botPlayer.position.x - (b.width - m)) * 10;
            if (botPlayer.position.y < m) desireY += (m - botPlayer.position.y) * 10;
            else if (botPlayer.position.y > b.height - m) desireY -= (botPlayer.position.y - (b.height - m)) * 10;

            // 7. Potential Field: Body Avoidance (Predictive)
            const lookAhead = 150 + botPlayer.radius * 2;
            const evasionRange = {
                x: botPlayer.position.x + Math.cos(botData.currentAngle) * lookAhead,
                y: botPlayer.position.y + Math.sin(botData.currentAngle) * lookAhead,
                radius: 120
            };
            if (this.currentBodyTree) {
                const threats = this.currentBodyTree.query(evasionRange);
                for (const t of threats) {
                    if (t.playerId === botId) continue;
                    const threatDx = t.x - botPlayer.position.x;
                    const threatDy = t.y - botPlayer.position.y;
                    const tDist = Math.sqrt(threatDx * threatDx + threatDy * threatDy);
                    const weight = 5000 / (tDist + 1);
                    desireX -= (threatDx / tDist) * weight;
                    desireY -= (threatDy / tDist) * weight;
                    if (botPlayer.ability.type === 'SHIELD' && tDist < 100) useAbility = true;
                }
            }

            // 8. Integrate Desire Vector to Angle
            if (Math.abs(desireX) > 0.1 || Math.abs(desireY) > 0.1) {
                botData.targetAngle = Math.atan2(desireY, desireX);
            } else {
                // Occasional random jitter if everything is neutral
                if (Math.random() < 0.05) botData.targetAngle += (Math.random() - 0.5);
            }

            // 9. Steering Smoothing
            let diff = botData.targetAngle - botData.currentAngle;
            while (diff < -Math.PI) diff += Math.PI * 2;
            while (diff > Math.PI) diff -= Math.PI * 2;
            botData.currentAngle += Math.max(-botData.turnSpeed, Math.min(botData.turnSpeed, diff));

            // 10. Emotes & Social
            if (Math.random() < 0.003) {
                const emotes = ['cool', 'laugh', 'angry', 'scared'];
                this.gameEngine.io.to(this.gameEngine.roomId).emit('emote', { 
                    playerId: botId, 
                    emoteId: emotes[Math.floor(Math.random() * emotes.length)] 
                });
            }

            // Apply to engine
            this.gameEngine.inputs[botId] = {
                angle: botData.currentAngle,
                isBoosting: isBoosting,
                useAbility: useAbility
            };
        }
    }
}

module.exports = { BotController };
