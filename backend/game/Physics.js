// pure helper functions related to movement and collisions
// these can be unit tested independently of sockets or world state

function distance(x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

// limit turn based on mass and mutation/boost modifiers
function calculateNewAngle(currentAngle, targetAngle, mass, turnSpeedMultiplier, dt) {
  // Slightly snappier than before with a gentler large-mass penalty.
  const baseTurnSpeed = 5.8 * (turnSpeedMultiplier || 1.0);
  const massTurnFactor = 1 + Math.max(0, mass - 50) / 1400;
  const maxTurnDelta = (baseTurnSpeed / massTurnFactor) * dt;

  let angleDiff = targetAngle - currentAngle;
  while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
  while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;

  const actualTurn = Math.max(-maxTurnDelta, Math.min(maxTurnDelta, angleDiff));
  return currentAngle + actualTurn;
}

function updateVelocityFromAngle(vxvy, angle, speed) {
  vxvy.x = Math.cos(angle) * speed;
  vxvy.y = Math.sin(angle) * speed;
}

function movePosition(pos, vxvy, dt) {
  pos.x += vxvy.x * dt;
  pos.y += vxvy.y * dt;
}

function isOutOfBounds(pos, radius, bounds) {
  return (
    pos.x <= radius ||
    pos.x >= bounds.width - radius ||
    pos.y <= radius ||
    pos.y >= bounds.height - radius
  );
}

module.exports = {
  distance,
  calculateNewAngle,
  updateVelocityFromAngle,
  movePosition,
  isOutOfBounds,
};
