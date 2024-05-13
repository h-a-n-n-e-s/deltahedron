import { quaternionFromDirection } from "./algebra";
import { q } from "./ballPark";

export class Structure {

  // private maxEdgeCount!: number;
  private halfEdges!: Uint32Array;

  connection!: Int32Array;

  rods!: Float32Array;

  polyhedron(count:number, halfEdges:Uint32Array, ballRadius:number, cylinderRadius:number, cylinderLength:number) {

    this.halfEdges = halfEdges;

    const p = new Float32Array(3*count);
    for (let i=0; i<p.length; i++) p[i] = 1 * (0.5 - Math.random());

    const balls = new Float32Array(count * q);

    for (let i=0; i<count; i++) {

      const offset = i * q;

      balls.set(p.slice(3*i,3*i+3), offset); // position
      balls.set([1], offset+3); // size

      const c =  this.vertexEdgeCount(halfEdges, i);

      let color = [.4,.4,.4, 1];

      if (c === 4) color = [0,0,1, 1];
      else if (c === 5) color = [0,1,1, 1];
      else if (c === 6) color = [1,1,1, 1];
      else if (c === 7) color = [1,0,0, 1];
      else if (c === 8) color = [1,1,0, 1];

      balls.set(color, offset+8);

      balls.set([ballRadius], offset+16); // shapePara1
    }

    const rodCount = this.halfEdges.length/8;
    this.rods = new Float32Array(rodCount * q);

    // this.connection = new Int32Array(count * 16);
    // this.connection.fill(-1);

    for (let i=0; i<rodCount; i++) {

      const offset = i * q;

      // const j = this.edge[2*i];
      // const k = this.edge[2*i+1];

      // this.connection.set([j], this.connection.indexOf(-1, 16*k));
      // this.connection.set([k], this.connection.indexOf(-1, 16*j));

      this.rods.set([1], offset+3); // size
      this.rods.set([0.6,0.6,0.6, 1], offset+8); // color
      
      this.rods.set([cylinderRadius], offset+16); // shapePara1
      this.rods.set([cylinderLength], offset+17); // shapePara2

    }
    
    return [balls, this.rods] as [Float32Array, Float32Array];
  }

  // use in animation loop like
  // this.compute.setRodsBuffer(deltahedron.assidx*q, deltahedron.addRod(0, 5));
  // this.compute.setConnectionBuffer(deltahedron.connection);
  // this.compute.setEdgeBuffer(deltahedron.edge);
  // addRod(j:number, k:number) {
  //   this.rods.set([0,1,1, 1], this.assidx*q+8); // color
  //   this.rods.set([0.2], this.assidx*q+3); // size
  //   this.edge.set([j, k], 2*this.assidx);
  //   this.connection.set([j], this.connection.indexOf(-1, 16*k));
  //   this.connection.set([k], this.connection.indexOf(-1, 16*j));
  //   this.assidx++;
  //   return this.rods.slice((this.assidx-1)*q, (this.assidx-1)*q+16);
  // }

  entryCount = (a:Uint32Array, v:number) => {
    let count = 0;
    for(let i=0; i<a.length; ++i){
        if(a[i] === v)
        count++;
    }
    return count;
  }

  vertexEdgeCount = (halfEdges:Uint32Array, vertexIndex:number) => {
    let count = 0;
    for(let i=0; i<halfEdges.length/4; ++i){
        if(halfEdges[4*i+3] === vertexIndex)
        count++;
    }
    return count;
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