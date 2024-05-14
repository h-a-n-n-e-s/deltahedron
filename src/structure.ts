import { quaternionFromDirection } from "./algebra";
import { q } from "./ballPark";
import { Compute } from "./compute";
import { cylinderMesh, icoSphereMesh } from "./mesh";
import { Object } from "./render";

export class Structure {

  private balls!: Object;
  private rods!: Object;
  private halfEdges!: Uint32Array;

  private ballRadius!: number;
  private cylinderRadius!: number;
  private cylinderLength!: number;

  init(maxVertexCount:number, maxEdgeCount:number, halfEdgesInit:Uint32Array, ballRadius:number, cylinderRadius:number, cylinderLength:number) {

    this.ballRadius = ballRadius;
    this.cylinderRadius = cylinderRadius;
    this.cylinderLength = cylinderLength;

    this.halfEdges = new Uint32Array(8*maxEdgeCount);
    this.halfEdges.set(halfEdgesInit);
    
    const ballCount = this.vertexCount(halfEdgesInit);
    const rodCount = halfEdgesInit.length/8;

    const ballData = new Float32Array(maxVertexCount * q);
    const rodData = new Float32Array(maxEdgeCount * q);

    const p = new Float32Array(3*ballCount);
    for (let i=0; i<p.length; i++) p[i] = 1 * (0.5 - Math.random());

    this.balls = {
      data: ballData,
      mesh: icoSphereMesh(ballRadius, 4),
      count: ballCount,
      maxCount: maxVertexCount
    }

    this.rods = {
      data: rodData,
      mesh: cylinderMesh(32, cylinderRadius, cylinderLength/2, true),
      count: rodCount,
      maxCount: maxEdgeCount
    }

    for (let i=0; i<ballCount; i++) {
      this.createBall(i, p.slice(3*i,3*i+3));
      const connections = this.vertexEdgeCount(halfEdgesInit, i);
      this.setColor(i, this.connectionsToColor(connections));
    }

    for (let i=0; i<rodCount; i++) this.createRod(i);

    return [this.balls, this.rods, this.halfEdges] as [Object, Object, Uint32Array];
  }

  createBall(index:number, position:Float32Array) {
    
    const offset = index * q;

    this.balls.data.set(position, offset);
    this.balls.data.set([1], offset+3); // size
    this.balls.data.set([this.ballRadius], offset+16); // shapePara1
  }

  createRod(index:number) {

    const offset = index * q;

    this.rods.data.set([1], offset+3); // size
    this.rods.data.set([0.7,0.7,0.7, 1], offset+8); // color
    this.rods.data.set([this.cylinderRadius], offset+16); // shapePara1
    this.rods.data.set([this.cylinderLength], offset+17); // shapePara2
  }

  setColor(index:number, color:Array<number>) {
    this.balls.data.set(color, index*q+8);
  }

  connectionsToColor = (connections:number) => {
    if (connections === 4) return [0,0,1, 1];
    else if (connections === 5) return [0,1,1, 1];
    else if (connections === 6) return [1,1,1, 1];
    else if (connections === 7) return [1,0,0, 1];
    else if (connections === 8) return [1,1,0, 1];
    else return [.5,.5,.5, 1];
  }

  vertexCount = (halfEdges:Uint32Array) => {
    let count = 0;
    for(let i=0; i<halfEdges.length/4; ++i){
      const index = halfEdges[4*i+3];
      if( index > count)
      count = index;
    }
    return count + 1;
  }

  vertexEdgeCount = (halfEdges:Uint32Array, vertexIndex:number) => {
    let count = 0;
    for(let i=0; i<halfEdges.length/4; ++i){
      if(halfEdges[4*i+3] === vertexIndex)
      count++;
    }
    return count;
  }

  insertVertex(rodIndex:number, compute:Compute) {
    const A = 2*rodIndex;
    const iA = 2*A;
    const kA = iA+4;
    const B = 2*this.rods.count;
    const iB = 4*B;
    const kB = iB+4;
    const C = 2*this.rods.count+2;
    const iC = 4*C;
    const kC = iC+4;
    const D = 2*this.rods.count+4;
    const iD = 4*D;
    const kD = iD+4;
    // B
    this.halfEdges[iB] = B+1;
    this.halfEdges[iB+1] = this.halfEdges[kA+2];
    this.halfEdges[iB+2] = A+1;
    this.halfEdges[iB+3] = this.balls.count;
    this.halfEdges[kB] = B;
    this.halfEdges[kB+1] = C;
    this.halfEdges[kB+2] = this.halfEdges[kA+1];
    this.halfEdges[kB+3] = this.halfEdges[this.halfEdges[kA+2]+3];
    // C
    this.halfEdges[iC] = C+1;
    this.halfEdges[iC+1] = this.halfEdges[kA+1];
    this.halfEdges[iC+2] = B+1;
    this.halfEdges[iC+3] = this.balls.count;
    this.halfEdges[kC] = C;
    this.halfEdges[kC+1] = D;
    this.halfEdges[kC+2] = this.halfEdges[iA+2];
    this.halfEdges[kC+3] = this.halfEdges[iA+3];
    // D
    this.halfEdges[iD] = D+1;
    this.halfEdges[iD+1] = this.halfEdges[iA+2];
    this.halfEdges[iD+2] = C+1;
    this.halfEdges[iD+3] = this.balls.count;
    this.halfEdges[kD] = D;
    this.halfEdges[kD+1] = A;
    this.halfEdges[kD+2] = this.halfEdges[iA+1];
    this.halfEdges[kD+3] = this.halfEdges[this.halfEdges[iA+2]+3];
    // A
    this.halfEdges[iA+2] = D+1;
    this.halfEdges[iA+3] = this.balls.count;
    this.halfEdges[kA+1] = B;

    const i = this.halfEdges[kA+3];
    const j = this.halfEdges[kC+3];
    let p = new Float32Array(3);
    for (let o=0; o<3; o++) {
      p[o] = (this.balls.data[q*i+o]+this.balls.data[q*j+o])/2;
      this.createRod(this.rods.count);
      compute.setRodsBuffer(this.rods.count, this.rods.data.slice(q*this.rods.count,q*this.rods.count+q));
      this.rods.count++;
    }
    this.createBall(this.balls.count, p);
    this.setColor(this.balls.count, this.connectionsToColor(4));
    compute.setBallsBuffer(this.balls.count, this.balls.data.slice(q*this.balls.count,q*this.rods.count+q));
    this.balls.count++;

    compute.setHalfEdgeBuffer(this.halfEdges);
    compute.setCount(this.balls.count, this.rods.count);
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