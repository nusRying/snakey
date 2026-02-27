const { Player } = require('./WorldState');

class BotController {
    constructor(gameEngine) {
        this.gameEngine = gameEngine;
        this.world = gameEngine.world;
        
        this.bots = new Map(); // Map of botId -> bot configuration
        this.minPlayers = 10;
        this.botCounter = 0;
        
        this.targetAngleOffsetRange = Math.PI / 4; // Max deviation when wandering
    }

    update() {
        this.balancePopulation();
        this.calculateBotDecisions();
    }

    balancePopulation() {
        const totalPlayers = Object.keys(this.world.players).length;
        
        if (totalPlayers < this.minPlayers) {
            this.spawnBot();
        } else if (totalPlayers > this.minPlayers && this.bots.size > 0) {
            // Remove a bot if real players join and we exceed the cap
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
        
        this.bots.set(botId, {
            id: botId,
            state: 'WANDER', // WANDER, FEED, FLEE, ATTACK
            targetAngle: Math.random() * Math.PI * 2,
            actionTimer: 0 // Used to prevent jitter in decisions
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
        for (const [botId, botData] of this.bots) {
            const botPlayer = this.world.players[botId];
            if (!botPlayer) continue; 

            // Basic AI inputs we will submit to engine
            let nextAngle = botPlayer.angle; // current angle default
            let isBoosting = false;
            let useAbility = false;
            
            botData.actionTimer--;

            // Find closest objects (Simple distance check for now, can be optimized with QuadTree later if needed, but 10 query range is cheap enough)
            let closestPellet = null;
            let closestPelletDist = 1000;
            
            let closestPlayer = null;
            let closestPlayerDist = 1500;

            for (const pid in this.world.pellets) {
                const p = this.world.pellets[pid];
                const dist = Math.sqrt(Math.pow(botPlayer.position.x - p.x, 2) + Math.pow(botPlayer.position.y - p.y, 2));
                if (dist < closestPelletDist) {
                    closestPelletDist = dist;
                    closestPellet = p;
                }
            }

            for (const pid in this.world.players) {
                if (pid === botId) continue;
                const p = this.world.players[pid];
                const dist = Math.sqrt(Math.pow(botPlayer.position.x - p.position.x, 2) + Math.pow(botPlayer.position.y - p.position.y, 2));
                if (dist < closestPlayerDist) {
                    closestPlayerDist = dist;
                    closestPlayer = p;
                }
            }

            // Decide State
            if (closestPlayer) {
                if (closestPlayer.mass > botPlayer.mass * 1.5) {
                    botData.state = 'FLEE';
                } else if (botPlayer.mass > closestPlayer.mass * 1.5 && closestPlayerDist < 500) {
                    botData.state = 'ATTACK';
                } else {
                    botData.state = 'FEED';
                }
            } else if (closestPellet) {
                botData.state = 'FEED';
            } else {
                botData.state = 'WANDER';
            }

            // Execute State Logic
            if (botData.state === 'FLEE') {
                // Run strictly away from the player
                nextAngle = Math.atan2(botPlayer.position.y - closestPlayer.position.y, botPlayer.position.x - closestPlayer.position.x);
                isBoosting = true;
                
                if (botPlayer.ability.type === 'DASH' || botPlayer.ability.type === 'SHIELD') {
                    useAbility = true;
                }

            } else if (botData.state === 'ATTACK') {
                // Aim exactly for the player's head trajectory
                const dx = closestPlayer.position.x - botPlayer.position.x;
                const dy = closestPlayer.position.y - botPlayer.position.y;
                nextAngle = Math.atan2(dy, dx);
                
                if (closestPlayerDist < 300) {
                    isBoosting = true;
                }

            } else if (botData.state === 'FEED') {
                if (closestPellet) {
                    const dx = closestPellet.x - botPlayer.position.x;
                    const dy = closestPellet.y - botPlayer.position.y;
                    
                    // Smooth steering
                    const targetA = Math.atan2(dy, dx);
                    
                    // If we only just picked a target, don't jitter instantly
                    if (botData.actionTimer <= 0) {
                        botData.targetAngle = targetA;
                        botData.actionTimer = 5; // Hold this decision for 5 ticks
                    }
                    
                    if (botPlayer.ability.type === 'MAGNET' && closestPelletDist < 500) {
                        useAbility = true;
                    }
                }
                nextAngle = botData.targetAngle;

            } else {
                // WANDER
                if (botData.actionTimer <= 0) {
                    // Randomly adjust angle slowly
                    botData.targetAngle += (Math.random() * this.targetAngleOffsetRange * 2) - this.targetAngleOffsetRange;
                    botData.actionTimer = 20; // Wander roughly in this direction for 20 ticks (1 second)
                }
                nextAngle = botData.targetAngle;
            }

            // Boundary avoidance (soft turn away from edges)
            const margin = 200;
            if (botPlayer.position.x < margin) botData.targetAngle = 0; // Turn right
            if (botPlayer.position.y < margin) botData.targetAngle = Math.PI/2; // Turn down
            if (botPlayer.position.x > this.world.bounds.width - margin) botData.targetAngle = Math.PI; // Turn left
            if (botPlayer.position.y > this.world.bounds.height - margin) botData.targetAngle = -Math.PI/2; // Turn up


            // Apply inputs
            this.gameEngine.inputs[botId] = {
                angle: nextAngle,
                isBoosting: isBoosting,
                useAbility: useAbility
            };
        }
    }
}

module.exports = { BotController };
