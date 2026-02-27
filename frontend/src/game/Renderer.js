export class Renderer {
  constructor(ctx) {
    this.ctx = ctx;
  }
  
  drawGrid(bounds, cameraX = bounds.width/2, cameraY = bounds.height/2, viewWidth = window.innerWidth, viewHeight = window.innerHeight) {
    const step = 100; // grid size
    this.ctx.strokeStyle = 'rgba(30, 30, 40, 0.5)';
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    
    // Calculate visible bounds to only draw what's on screen
    const startX = Math.max(0, Math.floor((cameraX - viewWidth / 2) / step) * step);
    const endX = Math.min(bounds.width, startX + viewWidth + step * 2);

    const startY = Math.max(0, Math.floor((cameraY - viewHeight / 2) / step) * step);
    const endY = Math.min(bounds.height, startY + viewHeight + step * 2);
    
    for (let x = startX; x <= endX; x += step) {
      this.ctx.moveTo(x, startY);
      this.ctx.lineTo(x, endY);
    }
    for (let y = startY; y <= endY; y += step) {
      this.ctx.moveTo(startX, y);
      this.ctx.lineTo(endX, y);
    }
    this.ctx.stroke();
  }

  drawBounds(bounds) {
    this.ctx.strokeStyle = '#ff0055';
    this.ctx.lineWidth = 10;
    this.ctx.shadowBlur = 30;
    this.ctx.shadowColor = '#ff0055';
    this.ctx.strokeRect(0, 0, bounds.width, bounds.height);
    this.ctx.shadowBlur = 0;
  }

  drawStorm(stormCenter, stormRadius, bounds) {
      if (!stormCenter || !stormRadius) return;
      
      this.ctx.save();
      
      // Draw the safe zone
      this.ctx.beginPath();
      this.ctx.arc(stormCenter.x, stormCenter.y, stormRadius, 0, Math.PI * 2);
      this.ctx.lineWidth = 5;
      this.ctx.strokeStyle = '#ff0055';
      this.ctx.shadowBlur = 20;
      this.ctx.shadowColor = '#ff0055';
      this.ctx.stroke();
      
      // Fill the storm area (everything outside the circle)
      this.ctx.beginPath();
      this.ctx.rect(0, 0, bounds.width, bounds.height); // Outer bounds
      this.ctx.arc(stormCenter.x, stormCenter.y, stormRadius, 0, Math.PI * 2, true); // Inner safe hole (counter-clockwise)
      this.ctx.fillStyle = 'rgba(255, 0, 85, 0.2)';
      this.ctx.fill();
      
      this.ctx.restore();
  }
  
  drawBlackHoles(blackHoles, time) {
      if (!blackHoles) return;
      
      this.ctx.save();
      for (const bh of blackHoles) {
          // Draw the swirling event horizon
          this.ctx.beginPath();
          this.ctx.arc(bh.x, bh.y, bh.radius, 0, Math.PI * 2);
          this.ctx.fillStyle = '#050510';
          this.ctx.fill();
          this.ctx.strokeStyle = '#3300ff';
          this.ctx.lineWidth = 4;
          this.ctx.shadowBlur = 30;
          this.ctx.shadowColor = '#3300ff';
          this.ctx.stroke();
          
          // Draw accretion disk (swirling effect)
          this.ctx.save();
          this.ctx.translate(bh.x, bh.y);
          this.ctx.rotate(time * 0.002);
          this.ctx.beginPath();
          this.ctx.arc(0, 0, bh.radius * 2, 0, Math.PI);
          this.ctx.strokeStyle = 'rgba(100, 50, 255, 0.5)';
          this.ctx.lineWidth = 2;
          this.ctx.stroke();
          
          this.ctx.rotate(Math.PI / 2);
          this.ctx.beginPath();
          this.ctx.arc(0, 0, bh.radius * 1.5, 0, Math.PI);
          this.ctx.strokeStyle = 'rgba(50, 0, 255, 0.8)';
          this.ctx.lineWidth = 3;
          this.ctx.stroke();
          this.ctx.restore();
          
          // Draw pull radius (faint)
          this.ctx.beginPath();
          this.ctx.arc(bh.x, bh.y, bh.pullRadius, 0, Math.PI * 2);
          this.ctx.fillStyle = 'rgba(20, 0, 50, 0.1)';
          this.ctx.fill();
      }
      this.ctx.restore();
  }
  
  drawWormholes(wormholes, time) {
      if (!wormholes) return;
      
      this.ctx.save();
      for (const wh of wormholes) {
          this.ctx.beginPath();
          this.ctx.arc(wh.x, wh.y, wh.radius, 0, Math.PI * 2);
          this.ctx.fillStyle = '#000';
          this.ctx.fill();
          
          this.ctx.strokeStyle = wh.color;
          this.ctx.lineWidth = 5 + Math.sin(time * 0.005) * 2; // Pulsing ring
          this.ctx.shadowBlur = 20 + Math.sin(time * 0.005) * 10;
          this.ctx.shadowColor = wh.color;
          this.ctx.stroke();
          
          // Draw inner spiral
          this.ctx.save();
          this.ctx.translate(wh.x, wh.y);
          this.ctx.rotate(-time * 0.003); // Opposite rotation of black holes
          this.ctx.beginPath();
          for (let i = 0; i < 5; i++) {
               const angle = (i / 5) * Math.PI * 2;
               this.ctx.moveTo(0, 0);
               this.ctx.quadraticCurveTo(
                   Math.cos(angle + 0.5) * wh.radius * 0.8, Math.sin(angle + 0.5) * wh.radius * 0.8,
                   Math.cos(angle) * wh.radius, Math.sin(angle) * wh.radius
               );
          }
          this.ctx.strokeStyle = 'rgba(255,255,255,0.8)';
          this.ctx.lineWidth = 2;
          this.ctx.stroke();
          this.ctx.restore();
      }
      this.ctx.globalAlpha = 1.0;
  }

  drawPowerUps(powerUps, time) {
      if (!powerUps) return;
      for (const id in powerUps) {
          const pu = powerUps[id];
          const pulse = Math.sin(time / 200) * 5;
          const radius = pu.radius + pulse;

          // Outer glow
          this.ctx.shadowBlur = 20;
          this.ctx.shadowColor = pu.color;
          
          this.ctx.beginPath();
          this.ctx.arc(pu.x, pu.y, radius, 0, Math.PI * 2);
          this.ctx.fillStyle = pu.color;
          this.ctx.fill();
          
          // Inner icon / detail
          this.ctx.beginPath();
          this.ctx.arc(pu.x, pu.y, radius * 0.6, 0, Math.PI * 2);
          this.ctx.fillStyle = '#fff';
          this.ctx.fill();
          
          this.ctx.shadowBlur = 0;

          // Label
          this.ctx.fillStyle = '#fff';
          this.ctx.font = 'bold 12px Inter';
          this.ctx.textAlign = 'center';
          this.ctx.fillText(pu.type, pu.x, pu.y + radius + 15);
      }
  }

  drawPellets(pellets) {
    for (const id in pellets) {
      const p = pellets[id];
      this.ctx.beginPath();
      // Slightly larger glowing pellets
      this.ctx.arc(p.x, p.y, p.value * 1.5, 0, Math.PI * 2);
      this.ctx.fillStyle = p.color;
      this.ctx.shadowBlur = 15;
      this.ctx.shadowColor = p.color;
      this.ctx.fill();
    }
    this.ctx.shadowBlur = 0;
  }

  drawPlayers(players, myId, kingId, activeEmotes = {}) {
    // Draw players (smaller mass lower so bigger snakes on top)
    const sortedPlayers = Object.values(players).sort((a,b) => a.mass - b.mass);

    for (const p of sortedPlayers) {
      const isMe = p.id === myId;
      const isKing = p.id === kingId;
      const emoteData = activeEmotes[p.id];
      
      this.ctx.lineCap = 'round';
      this.ctx.lineJoin = 'round';
      
      // Draw body segments
      for (let i = p.segments.length - 1; i >= 0; i--) {
        const seg = p.segments[i];
        
        // Dynamic tapering size
        const sizeCoef = 1 - (i / Math.max(1, p.segments.length)) * 0.4; 
        const radius = p.radius * sizeCoef;
        
        this.ctx.beginPath();
        this.ctx.arc(seg.x, seg.y, radius, 0, Math.PI * 2);
        
        // Boost glow effect logic
        if (p.isBoosting || (p.ability.isActive && p.ability.type === 'DASH')) {
           this.ctx.shadowBlur = 20;
           this.ctx.shadowColor = '#ffffff';
           this.ctx.fillStyle = '#ffffff';
        } else {
           this.ctx.shadowBlur = isMe ? 15 : 5;
           this.ctx.shadowColor = p.color;
           this.ctx.fillStyle = p.color;
        }
        
        this.ctx.fill();
        this.ctx.strokeStyle = 'rgba(0,0,0,0.5)';
        this.ctx.lineWidth = 1.5;
        this.ctx.stroke();
      }
      this.ctx.shadowBlur = 0;
      
      // Draw Head
      this.ctx.beginPath();
      this.ctx.arc(p.position.x, p.position.y, p.radius * 1.05, 0, Math.PI * 2);
      this.ctx.fillStyle = isMe ? '#ffffff' : (p.isBoosting ? '#fff' : p.color);
      
      // Head Glow
      this.ctx.shadowBlur = 25;
      this.ctx.shadowColor = isMe ? '#ffffff' : p.color;
      
      this.ctx.fill();
      this.ctx.shadowBlur = 0;
      
      // Calculate visual angle for eyes
      let angle = 0;
      if (p.velocity.x !== 0 || p.velocity.y !== 0) {
         angle = Math.atan2(p.velocity.y, p.velocity.x);
      }
      
      // Eyes
      const eyeOffset = p.radius * 0.55;
      const eyeSize = p.radius * 0.3;
      
      // Left eye base
      this.ctx.beginPath();
      let ex1 = p.position.x + Math.cos(angle - 0.6) * eyeOffset;
      let ey1 = p.position.y + Math.sin(angle - 0.6) * eyeOffset;
      this.ctx.arc(ex1, ey1, eyeSize, 0, Math.PI * 2);
      this.ctx.fillStyle = '#0f0f0f';
      this.ctx.fill();
      // Left Iris
      this.ctx.beginPath();
      this.ctx.arc(ex1 + Math.cos(angle)*eyeSize*0.4, ey1 + Math.sin(angle)*eyeSize*0.4, eyeSize*0.4, 0, Math.PI * 2);
      this.ctx.fillStyle = '#fff';
      this.ctx.fill();

      // Right eye base
      this.ctx.beginPath();
      let ex2 = p.position.x + Math.cos(angle + 0.6) * eyeOffset;
      let ey2 = p.position.y + Math.sin(angle + 0.6) * eyeOffset;
      this.ctx.arc(ex2, ey2, eyeSize, 0, Math.PI * 2);
      this.ctx.fillStyle = '#0f0f0f';
      this.ctx.fill();
      // Right Iris
      this.ctx.beginPath();
      this.ctx.arc(ex2 + Math.cos(angle)*eyeSize*0.4, ey2 + Math.sin(angle)*eyeSize*0.4, eyeSize*0.4, 0, Math.PI * 2);
      this.ctx.fillStyle = '#fff';
      this.ctx.fill();
      
      // Draw Shield Aura
      if (p.ability.isActive && p.ability.type === 'SHIELD') {
          this.ctx.beginPath();
          this.ctx.arc(p.position.x, p.position.y, p.radius * 2, 0, Math.PI * 2);
          this.ctx.strokeStyle = 'rgba(100, 200, 255, 0.8)';
          this.ctx.lineWidth = 4;
          this.ctx.stroke();
          
          this.ctx.beginPath();
          this.ctx.arc(p.position.x, p.position.y, p.radius * 2, 0, Math.PI * 2);
          this.ctx.fillStyle = 'rgba(100, 200, 255, 0.2)';
          this.ctx.fill();
      }
      
      // Draw Magnet Aura
      if (p.ability.isActive && p.ability.type === 'MAGNET') {
          this.ctx.beginPath();
          this.ctx.arc(p.position.x, p.position.y, p.radius + 150, 0, Math.PI * 2);
          this.ctx.strokeStyle = 'rgba(255, 100, 255, 0.3)';
          this.ctx.lineWidth = 2;
          this.ctx.setLineDash([10, 10]);
          this.ctx.stroke();
          this.ctx.setLineDash([]);
      }
      
      // Draw Crown if King
      if (isKing) {
          this.ctx.save();
          this.ctx.translate(p.position.x, p.position.y);
          this.ctx.rotate(angle + Math.PI / 2); // Sit on top of head
          this.ctx.fillStyle = '#FFD700'; // Gold
          this.ctx.shadowBlur = 15;
          this.ctx.shadowColor = '#FFD700';
          
          const crW = p.radius * 1.5;
          const crH = p.radius;
          const offsetY = p.radius * 0.8;
          
          this.ctx.beginPath();
          this.ctx.moveTo(-crW/2, -offsetY); // Bottom left
          this.ctx.lineTo(crW/2, -offsetY); // Bottom right
          this.ctx.lineTo(crW/2 + crW*0.2, -offsetY - crH); // Top right tip
          this.ctx.lineTo(crW*0.2, -offsetY - crH*0.5); // Inner right
          this.ctx.lineTo(0, -offsetY - crH*1.2); // Top middle tip
          this.ctx.lineTo(-crW*0.2, -offsetY - crH*0.5); // Inner left
          this.ctx.lineTo(-crW/2 - crW*0.2, -offsetY - crH); // Top left tip
          this.ctx.fill();
          this.ctx.restore();
      }
      
      // Mass and Name Tag
      if (isMe) {
        this.ctx.fillStyle = isKing ? '#FFD700' : 'rgba(255, 255, 255, 0.8)';
        this.ctx.font = 'bold 14px Inter';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(`${p.name || 'You'} - Mass: ${Math.floor(p.mass)}`, p.position.x, p.position.y - p.radius * 2 - (isKing ? 15 : 0));
      } else if (p.name) {
        // Show names for bots and other players
        this.ctx.fillStyle = isKing ? '#FFD700' : 'rgba(255, 255, 255, 0.5)';
        this.ctx.font = '12px Inter';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(`${p.name}`, p.position.x, p.position.y - p.radius * 2 - (isKing ? 15 : 0));
      }

      // Draw Emote
      if (emoteData) {
          const emojiMap = {
              'COOL': '😎',
              'SAD': '😢',
              'ANGRY': '😡',
              'GG': '🤝',
              'LOVE': '❤️',
              'LOL': '😂'
          };
          const emoji = emojiMap[emoteData.emoteId] || '❓';
          
          this.ctx.save();
          this.ctx.font = '30px Arial';
          this.ctx.textAlign = 'center';
          
          // Floating animation
          const elapsed = Date.now() - emoteData.time;
          const floatY = Math.sin(elapsed / 200) * 10 - 20;
          const opacity = Math.min(1, 2 - (elapsed / 1000));
          
          this.ctx.globalAlpha = opacity;
          this.ctx.fillText(emoji, p.position.x, p.position.y - p.radius * 3 - (isKing ? 30 : 15) + floatY);
          this.ctx.restore();
      }
    }
  }

  drawHUD(player, canvasWidth, canvasHeight) {
      if (!player) return;

      const ability = player.ability;
      const padding = 30;
      
      this.ctx.fillStyle = 'white';
      this.ctx.font = 'bold 20px Inter, sans-serif';
      this.ctx.textAlign = 'right';
      
      // Position HUD at bottom right
      const textX = canvasWidth - padding;
      const textY = canvasHeight - padding - 40;
      
      this.ctx.fillText(`ABILITY: ${ability.type}`, textX, textY);
      this.ctx.font = '14px Inter, sans-serif';
      this.ctx.fillText(`(Press SPACE)`, textX, textY + 20);
      
      // Cooldown bar
      const barWidth = 200;
      const barHeight = 20;
      const barX = textX - barWidth;
      const barY = canvasHeight - padding - 20;
      
      this.ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
      this.ctx.fillRect(barX, barY, barWidth, barHeight);
      
      const fillPercent = ability.cooldown > 0 ? 1 - (ability.cooldown / ability.maxCooldown) : 1;
      this.ctx.fillStyle = fillPercent === 1 ? '#00ff55' : '#ff5500';
      this.ctx.fillRect(barX, barY, barWidth * fillPercent, barHeight);
      
      if (ability.isActive) {
          this.ctx.fillStyle = '#00ffff';
          this.ctx.font = 'bold 24px Inter, sans-serif';
          this.ctx.fillText('ACTIVE!', textX, textY - 30);
      }

      this.ctx.font = '12px Inter, sans-serif';
      this.ctx.textAlign = 'left';
      this.ctx.fillText("SPACE: Ability | Mouse/Touch: Boost | 1-6: Emotes", 20, canvasHeight - 20);

      // Active Power-Ups Central Display
      if (player.activePowerUps && Object.keys(player.activePowerUps).length > 0) {
          let powerUpIdx = 0;
          for (const type in player.activePowerUps) {
              const remaining = player.activePowerUps[type];
              const x = canvasWidth / 2 - 100 + (powerUpIdx * 110);
              const y = canvasHeight - 120;
              
              const colorMap = {
                  'SHIELD': '#00ffff',
                  'MAGNET': '#ff00ff',
                  'FRENZY': '#ff0000',
                  'GHOST': '#ffffff'
              };
              const color = colorMap[type] || '#fff';

              this.ctx.fillStyle = 'rgba(0,0,0,0.6)';
              this.ctx.fillRect(x, y, 100, 40);
              this.ctx.strokeStyle = color;
              this.ctx.lineWidth = 2;
              this.ctx.strokeRect(x, y, 100, 40);

              this.ctx.fillStyle = color;
              this.ctx.font = 'bold 12px Inter';
              this.ctx.textAlign = 'center';
              this.ctx.fillText(type, x + 50, y + 18);
              
              const sec = (remaining / 1000).toFixed(1);
              this.ctx.fillStyle = '#fff';
              this.ctx.fillText(`${sec}s`, x + 50, y + 34);
              
              powerUpIdx++;
          }
      }
  }

  drawLeaderboard(players, myId) {
      const sortedPlayers = Object.values(players).sort((a,b) => b.score - a.score).slice(0, 5);
      
      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      this.ctx.fillRect(10, 10, 200, 30 + sortedPlayers.length * 25);
      
      this.ctx.fillStyle = '#ff0055';
      this.ctx.font = 'bold 16px Inter, sans-serif';
      this.ctx.textAlign = 'left';
      this.ctx.fillText("LEADERBOARD", 20, 30);
      
      this.ctx.font = '14px Inter, sans-serif';
      sortedPlayers.forEach((p, idx) => {
          this.ctx.fillStyle = p.id === myId ? '#00ffcc' : '#ffffff';
          const name = p.name ? p.name : (p.id === myId ? 'You' : `Player ${p.id.slice(0,3)}`);
          this.ctx.fillText(`${idx + 1}. ${name} - ${Math.floor(p.score)}`, 20, 55 + idx * 25);
      });
  }

  drawTeamScores(teamScores, canvasWidth) {
      if (!teamScores) return;
      
      const maxScore = 50000;
      const barWidth = 400;
      const barHeight = 20;
      const startX = (canvasWidth - barWidth) / 2;
      const startY = 30;
      
      // Background track
      this.ctx.fillStyle = 'rgba(0,0,0,0.5)';
      this.ctx.fillRect(startX, startY, barWidth, barHeight);
      this.ctx.strokeStyle = '#333';
      this.ctx.strokeRect(startX, startY, barWidth, barHeight);
      
      // Calculate widths
      const redPercent = Math.min(1, teamScores['RED'] / maxScore);
      const bluePercent = Math.min(1, teamScores['BLUE'] / maxScore);
      
      // Draw Red
      this.ctx.fillStyle = '#ff0033';
      this.ctx.fillRect(startX, startY, barWidth * redPercent, barHeight);
      // Draw Blue
      this.ctx.fillStyle = '#0033ff';
      // Fill from right to left
      this.ctx.fillRect(startX + barWidth - (barWidth * bluePercent), startY, barWidth * bluePercent, barHeight);
      
      // Text
      this.ctx.fillStyle = 'white';
      this.ctx.font = 'bold 14px Inter, sans-serif';
      this.ctx.textAlign = 'center';
      
      if (teamScores['RED'] >= maxScore) {
          this.ctx.fillText("TEAM RED WINS!", canvasWidth/2, startY + 15);
      } else if (teamScores['BLUE'] >= maxScore) {
          this.ctx.fillText("TEAM BLUE WINS!", canvasWidth/2, startY + 15);
      } else {
          this.ctx.fillText(`${Math.floor(teamScores['RED'])} - GOAL: 50,000 - ${Math.floor(teamScores['BLUE'])}`, canvasWidth/2, startY + 15);
      }
  }

  drawKillFeed(killFeed, canvasWidth) {
      this.ctx.textAlign = 'right';
      this.ctx.font = 'bold 14px Inter, sans-serif';
      
      killFeed.forEach((k, idx) => {
          // Fade out based on time
          const age = Date.now() - k.time;
          let alpha = 1;
          if (age > 2000) {
              alpha = 1 - (age - 2000) / 1000;
          }
          alpha = Math.max(0, alpha);
          
          this.ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
          
          const killerName = k.killerName || `Player ${k.killerId.slice(0,3)}`;
          const victimName = k.victimName || `Player ${k.victimId.slice(0,3)}`;
          
          const text = `${killerName} killed ${victimName}`;
          this.ctx.fillText(text, canvasWidth - 20, 30 + idx * 20);
      });
  }

  drawMinimap(players, myId, bounds, canvasWidth, canvasHeight) {
      const mmWidth = 150;
      const mmHeight = 150;
      const mmX = canvasWidth - mmWidth - 20;
      const mmY = canvasHeight - mmHeight - 120; // Above HUD
      
      // Minimap background
      this.ctx.fillStyle = 'rgba(20, 20, 30, 0.7)';
      this.ctx.fillRect(mmX, mmY, mmWidth, mmHeight);
      this.ctx.strokeStyle = '#333';
      this.ctx.lineWidth = 2;
      this.ctx.strokeRect(mmX, mmY, mmWidth, mmHeight);

      // Draw players on minimap
      const scaleX = mmWidth / bounds.width;
      const scaleY = mmHeight / bounds.height;
      
      for (const id in players) {
          const p = players[id];
          const px = mmX + p.position.x * scaleX;
          const py = mmY + p.position.y * scaleY;
          
          this.ctx.beginPath();
          this.ctx.arc(px, py, id === myId ? 4 : 2, 0, Math.PI * 2);
          this.ctx.fillStyle = id === myId ? '#ffffff' : '#ff0055';
          this.ctx.fill();
      }
  }

  drawMobileUI(joystick, boostBtn, abilityBtn) {
      // Draw Joystick Base
      if (joystick.active) {
          this.ctx.beginPath();
          this.ctx.arc(joystick.baseX, joystick.baseY, joystick.radius, 0, Math.PI * 2);
          this.ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
          this.ctx.fill();
          this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
          this.ctx.lineWidth = 2;
          this.ctx.stroke();
          
          // Draw Stick
          this.ctx.beginPath();
          this.ctx.arc(joystick.stickX, joystick.stickY, joystick.radius * 0.4, 0, Math.PI * 2);
          this.ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
          this.ctx.fill();
      }

      // Draw Buttons
      const drawBtn = (btn, text, color) => {
          this.ctx.beginPath();
          this.ctx.arc(btn.x, btn.y, btn.radius, 0, Math.PI * 2);
          this.ctx.fillStyle = btn.active ? `rgba(${color}, 0.6)` : `rgba(${color}, 0.2)`;
          this.ctx.fill();
          this.ctx.strokeStyle = `rgba(${color}, 0.5)`;
          this.ctx.lineWidth = 2;
          this.ctx.stroke();
          
          this.ctx.fillStyle = 'white';
          this.ctx.font = 'bold 12px Inter, sans-serif';
          this.ctx.textAlign = 'center';
          this.ctx.fillText(text, btn.x, btn.y + 4);
      };

      drawBtn(boostBtn, "BOOST", "255, 80, 80");
      drawBtn(abilityBtn, "SKILL", "80, 200, 255");
  }
}
