import { quaternionFromDirection } from "./algebra";
import { q } from "./ballPark";

export class Structure {

  edge!: Uint32Array;
  assidx = 0;

  connection!: Int32Array;

  rods!: Float32Array;

  polyhedron(count:number, edges:Uint32Array) {

    // const s= 0.4;

    const p = new Float32Array(3*count);
    for (let i=0; i<p.length; i++) p[i] = 1 * (0.5 - Math.random());
    // p.set([0,s,0, s,0,s, s,0,-s, -s,0,-s, -s,0,s, 0,-1,0, 0,-1,0]);
    
    this.edge = edges;

    const balls = new Float32Array(count * q);

    for (let i=0; i<count; i++) {

      const offset = i * q;

      balls.set(p.slice(3*i,3*i+3), offset); // position

      balls.set([1,0,0, 1], offset+8); // color
      if (i == count-5) balls.set([0,0,1, 1], offset+8);
      if (i == count-4) balls.set([0,1,0, 1], offset+8);
      if (i == count-3) balls.set([1,0,1, 1], offset+8);
      if (i == count-2) balls.set([1,1,0, 1], offset+8);
      if (i == count-1) balls.set([0,1,1, 1], offset+8);

      balls.set([0.1], offset+3); // size

      const d = [Math.random(), Math.random(), Math.random()];
      balls.set(quaternionFromDirection(new Float32Array(d)), offset+12);
    }

    const rodCount = this.edge.length/2;
    this.assidx = rodCount;
    this.rods = new Float32Array(rodCount * q);

    this.connection = new Int32Array(count * 16);
    this.connection.fill(-1);

    for (let i=0; i<this.assidx; i++) {

      const offset = i * q;

      const j = this.edge[2*i];
      const k = this.edge[2*i+1];

      this.connection.set([j], this.connection.indexOf(-1, 16*k));
      this.connection.set([k], this.connection.indexOf(-1, 16*j));  

      // const a = p.slice(3*j,3*j+3);
      // const b = p.slice(3*k,3*k+3);
      // rods.set(vec3.midpoint(a, b), offset); // position
      // rods.set(quaternionFromDirection(vec3.subtract(a, b)), offset+12); // orientation

      this.rods.set([1,1,1, 1], offset+8); // color
      this.rods.set([0.2], offset+3); // size
    }
    
    return [balls, this.rods, this.connection] as [Float32Array, Float32Array, Int32Array];
  }

  // use in animation loop like
  // this.compute.setRodsBuffer(deltahedron.assidx*q, deltahedron.addRod(0, 5));
  // this.compute.setConnectionBuffer(deltahedron.connection);
  // this.compute.setEdgeBuffer(deltahedron.edge);
  addRod(j:number, k:number) {
    this.rods.set([0,1,1, 1], this.assidx*q+8); // color
    this.rods.set([0.2], this.assidx*q+3); // size
    this.edge.set([j, k], 2*this.assidx);
    this.connection.set([j], this.connection.indexOf(-1, 16*k));
    this.connection.set([k], this.connection.indexOf(-1, 16*j));
    this.assidx++;
    return this.rods.slice((this.assidx-1)*q, (this.assidx-1)*q+16);
  }
}



export function createRandomCube(objectCount:number, size:number) {
    
  const object = new Float32Array(objectCount * q);

  for (let i=0; i<objectCount; i++) {

    const offset = i * q;
    
    const p = 5;

    const x = p*(Math.random()-0.5);
    const y = p*(Math.random()-0.5);
    const z = p*(Math.random()-0.5);

    object.set([x, y, z], offset); // position

    object.set([1], offset+7); // mass

    object.set([Math.random(), Math.random(), Math.random(), 1], offset+8); // color

    const s = size * Math.random();
    object.set([s], offset+3); // size

    const d = [Math.random(), Math.random(), Math.random()];
    object.set(quaternionFromDirection(new Float32Array(d)), offset+12);
  }
  return object;
}