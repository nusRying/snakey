import type { GameManager } from './GameManager';

// Handles all input-related event binding and state for GameManager instances

export function setupInput(game: GameManager): void {
  game._keydownHandler = (e: KeyboardEvent) => {
    handleKeyDown(e, game);
  };

  game._keyupHandler = (e: KeyboardEvent) => {
    if (e.code === 'Space') {
      game.input.useAbility = false;
      game.socket.emit('input', game.input);
    }
  };

  game._mousedownHandler = () => {
    game.audio.resume();
    game.handleMouseDown();
  };

  game._touchstartHandler = (e: TouchEvent) => {
    game.audio.resume();
    handleTouchStart(e, game);
  };

  window.addEventListener('keydown', game._keydownHandler);
  window.addEventListener('keyup', game._keyupHandler);
  window.addEventListener('mousemove', game.handleMouseMove, { passive: true });
  window.addEventListener('mousedown', game._mousedownHandler);
  window.addEventListener('mouseup', game.handleMouseUp);
  window.addEventListener('resize', game.handleResize);

  game.canvas.addEventListener('touchstart', game._touchstartHandler, { passive: false });
  game.canvas.addEventListener('touchmove', game.handleTouchMove, { passive: false });
  game.canvas.addEventListener('touchend', game.handleTouchEnd, { passive: false });
  game.canvas.addEventListener('touchcancel', game.handleTouchEnd, { passive: false });
}

export function cleanupInput(game: GameManager): void {
  if (game._keydownHandler) {
    window.removeEventListener('keydown', game._keydownHandler);
  }
  if (game._keyupHandler) {
    window.removeEventListener('keyup', game._keyupHandler);
  }
  if (game._mousedownHandler) {
    window.removeEventListener('mousedown', game._mousedownHandler);
  }

  window.removeEventListener('mousemove', game.handleMouseMove);
  window.removeEventListener('mouseup', game.handleMouseUp);
  window.removeEventListener('resize', game.handleResize);

  if (game.canvas) {
    if (game._touchstartHandler) {
      game.canvas.removeEventListener('touchstart', game._touchstartHandler);
    }
    game.canvas.removeEventListener('touchmove', game.handleTouchMove);
    game.canvas.removeEventListener('touchend', game.handleTouchEnd);
    game.canvas.removeEventListener('touchcancel', game.handleTouchEnd);
  }
}

function handleKeyDown(e: KeyboardEvent, game: GameManager): void {
  const emoteKeys: Record<string, string> = {
    1: 'COOL',
    2: 'LOL',
    3: 'GG',
    4: 'ANGRY',
    5: 'SAD',
    6: 'LOVE',
  };

  if (emoteKeys[e.key]) {
    game.sendEmote(emoteKeys[e.key]);
  }

  if (e.code === 'Space') {
    game.activateAbilityInput();
    setTimeout(() => {
      game.input.useAbility = false;
      game.socket.emit('input', game.input);
    }, 100);
  }
}

function handleTouchStart(e: TouchEvent, game: GameManager): void {
  e.preventDefault();

  for (let i = 0; i < e.changedTouches.length; i++) {
    const touch = e.changedTouches[i];

    const dxB = touch.clientX - game.boostBtn.x;
    const dyB = touch.clientY - game.boostBtn.y;
    if (Math.sqrt(dxB * dxB + dyB * dyB) < game.boostBtn.radius * 1.5) {
      game.boostBtn.active = true;
      game.boostBtn.identifier = touch.identifier;
      game.setBoostState(true);
      continue;
    }

    const dxA = touch.clientX - game.abilityBtn.x;
    const dyA = touch.clientY - game.abilityBtn.y;
    if (Math.sqrt(dxA * dxA + dyA * dyA) < game.abilityBtn.radius * 1.5) {
      game.abilityBtn.active = true;
      game.abilityBtn.identifier = touch.identifier;
      game.activateAbilityInput();
      continue;
    }

    if (!game.joystick.active && touch.clientX < game.viewportWidth / 2) {
      game.joystick.active = true;
      game.joystick.identifier = touch.identifier;
      game.joystick.baseX = touch.clientX;
      game.joystick.baseY = touch.clientY;
      game.joystick.stickX = touch.clientX;
      game.joystick.stickY = touch.clientY;
    }
  }
}
