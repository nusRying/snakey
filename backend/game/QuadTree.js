class QuadTree {
  constructor(bounds, capacity) {
    this.bounds = bounds; // { x, y, width, height }
    this.capacity = capacity;
    this.points = [];
    this.divided = false;
  }

  insert(point) {
    if (!this.contains(this.bounds, point)) {
      return false;
    }

    if (this.points.length < this.capacity) {
      this.points.push(point);
      return true;
    }

    if (!this.divided) {
      this.subdivide();
    }

    if (this.northeast.insert(point)) return true;
    if (this.northwest.insert(point)) return true;
    if (this.southeast.insert(point)) return true;
    if (this.southwest.insert(point)) return true;

    return false;
  }

  subdivide() {
    const { x, y, width, height } = this.bounds;
    const w2 = width / 2;
    const h2 = height / 2;

    const ne = { x: x + w2, y: y, width: w2, height: h2 };
    this.northeast = new QuadTree(ne, this.capacity);

    const nw = { x: x, y: y, width: w2, height: h2 };
    this.northwest = new QuadTree(nw, this.capacity);

    const se = { x: x + w2, y: y + h2, width: w2, height: h2 };
    this.southeast = new QuadTree(se, this.capacity);

    const sw = { x: x, y: y + h2, width: w2, height: h2 };
    this.southwest = new QuadTree(sw, this.capacity);

    this.divided = true;
  }

  query(range, found) {
    if (!found) {
      found = [];
    }

    if (!this.intersects(this.bounds, range)) {
      return found;
    }

    for (const p of this.points) {
      if (range.radius) {
        // Circle query
        const distSq = Math.pow(p.x - range.x, 2) + Math.pow(p.y - range.y, 2);
        if (distSq <= Math.pow(range.radius + (p.radius || 0), 2)) {
          found.push(p);
        }
      } else {
        // Rectangle query (AABB)
        if (this.contains(range, p)) {
          found.push(p);
        }
      }
    }

    if (this.divided) {
      this.northwest.query(range, found);
      this.northeast.query(range, found);
      this.southwest.query(range, found);
      this.southeast.query(range, found);
    }

    return found;
  }

  contains(bounds, point) {
    return (
      point.x >= bounds.x &&
      point.x <= bounds.x + bounds.width &&
      point.y >= bounds.y &&
      point.y <= bounds.y + bounds.height
    );
  }

  intersects(bounds, range) {
    const r = range.radius || 0;
    return !(
      range.x - r > bounds.x + bounds.width ||
      range.x + r < bounds.x ||
      range.y - r > bounds.y + bounds.height ||
      range.y + r < bounds.y
    );
  }
}

module.exports = { QuadTree };
