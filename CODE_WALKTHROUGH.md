# Deep Dive: Architecture Walkthrough

Here are deep dives into the two most complex architectural pieces of the game: Client-Side Interpolation in the `GameManager` and Spatial Partitioning in the `GameEngine`.

---

### 1. The Geometry of Networking: `GameManager.js` (Frontend)

The biggest challenge in building a real-time `.io` game is the latency between the server and the client. If the frontend only renders what the backend sends, the game will stutter horribly at the server's tick rate (e.g., 20 frames per second).

The `GameManager` solves this using **Client-Side Snapshot Interpolation**.

#### The Snapshot Buffer

Instead of overwriting the game state every time an update arrives over WebSockets, the `GameManager` stores the snapshots in a time-stamped array buffer.

```javascript
this.socket.on("state", (snapshot) => {
  snapshot.time = snapshot.time || Date.now();
  this.stateBuffer.push(snapshot);

  // Keep only the last 10 snapshots to save memory
  if (this.stateBuffer.length > 10) {
    this.stateBuffer.shift();
  }
});
```

#### Time-travel Rendering

Inside the `requestAnimationFrame` loop (which runs at your monitor's refresh rate, typically 60 FPS or higher), the `interpolateState()` function is called right before drawing the canvas.

We intentionally render the game **100 milliseconds in the past**. Why? Because it guarantees that the client always has _two_ server snapshots to interpolate between, even if internet packets arrive inconsistently.

```javascript
interpolateState() {
     // Look 100ms into the past
     const renderTime = Date.now() - this.renderDelay;

     let s0 = null; // Snapshot before renderTime
     let s1 = null; // Snapshot after renderTime

     // Find the two snapshots wrapping our target render time
     for (let i = 0; i < this.stateBuffer.length - 1; i++) {
        if (this.stateBuffer[i].time <= renderTime && this.stateBuffer[i+1].time >= renderTime) {
           s0 = this.stateBuffer[i];
           s1 = this.stateBuffer[i+1];
           break;
        }
     }
```

#### The LERP (Linear Interpolation) formula

Once we have our two snapshots, we calculate a fraction `t` representing exactly where our 100ms target lies between `s0` and `s1`. If `s0` is at 0ms and `s1` is at 100ms, and our `renderTime` is at 50ms, `t` is exactly `0.5`.

For every player and every single body segment on the map, we mathematically drag them across the screen using this `t` value:

```javascript
// Calculate the fraction (0.0 to 1.0)
t = (renderTime - s0.time) / (s1.time - s0.time);

// Apply LERP to the snake head
interpPlayer.position.x = p0.position.x + (p1.position.x - p0.position.x) * t;
interpPlayer.position.y = p0.position.y + (p1.position.y - p0.position.y) * t;

// Apply LERP to every single trailing body segment
for (let j = 0; j < p0.segments.length; j++) {
  interpPlayer.segments[j].x =
    p0.segments[j].x + (p1.segments[j].x - p0.segments[j].x) * t;
  interpPlayer.segments[j].y =
    p0.segments[j].y + (p1.segments[j].y - p0.segments[j].y) * t;
}
```

This is how we guarantee a buttery-smooth 60+ FPS experience on the React Canvas, even if the Node.js backend operates at a sluggish 20 ticks per second.

---

### 2. High-Performance Physics: `GameEngine.js` (Backend)

In an `.io` game with hundreds of pellets and dozens of giant snakes, naive collision math crashes the backend. If you have 10 players, each with 50 body segments, and 500 pellets, checking every head against every single object requires O(N²) calculations—tens of thousands of math operations 20 times a second.

This is why we implemented a **QuadTree**.

#### Building the Spatial Tree

At the very start of every single server tick, the `GameEngine` deletes the old QuadTree and builds a new one from scratch. A QuadTree recursively divides the 3000x3000 arena into four smaller quarters whenever a specific zone gets too crowded (e.g., more than 10 items).

```javascript
tick() {
    // 1. Create fresh trees for the 3000x3000 bounds
    const qBounds = { x: 0, y: 0, width: 3000, height: 3000 };
    const pelletTree = new QuadTree(qBounds, 10);
    const bodyTree = new QuadTree(qBounds, 10);

    // 2. Insert all 500+ pellets
    for (const id in this.world.pellets) {
        const p = this.world.pellets[id];
        pelletTree.insert({ x: p.x, y: p.y, pelletId: id, radius: p.value });
    }

    // 3. Insert every snake's body segments
    for (const id in this.world.players) {
        for (const seg of this.world.players[id].segments) {
            bodyTree.insert({ x: seg.x, y: seg.y, playerId: id });
        }
    }
```

#### Querying Local Space

Now, when it is time to check if a player's head has crashed into a pellet or another snake's body, we **don't** loop over everything. We ask the QuadTree to slice out only the objects immediately surrounding the player's head.

```javascript
// Define the player's immediate surrounding area
// (If the player has used the 'MAGNET' ability, we massively expand this query circle)
const queryRange = {
  x: player.position.x,
  y: player.position.y,
  radius:
    player.radius +
    (player.ability.isActive && player.ability.type === "MAGNET" ? 150 : 10),
};

// Grab only the nearby pellets and bodies (O(log N) instead of O(N))
const nearbyPellets = pelletTree.query(queryRange);
const nearbyBodies = bodyTree.query(queryRange);
```

Because of this, if two players are on the opposite sides of the massive arena, the server completely skips doing the expensive Pythagorean Theorem distance checks between them.

#### Resolving Complex Hitboxes

Once we have our tiny subset of `nearbyBodies`, we perform the final precision math:

```javascript
let hit = false;

// Ignore logic if the player activated their SHIELD ability
if (!(player.ability.isActive && player.ability.type === "SHIELD")) {
  for (const b of nearbyBodies) {
    if (b.playerId === id) continue; // Snakes cannot hit their own bodies

    // Precise Circle Collision Math
    const dx = b.x - player.position.x;
    const dy = b.y - player.position.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < player.radius + b.radius) {
      hit = true;
      killerId = b.playerId;
      break; // Target Neutralized.
    }
  }
}
```

Together, the `GameManager` makes the game feel responsive on the client, and the `GameEngine` ensures the Node backend can scale to handle enormous lobbies.
