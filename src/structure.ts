import { quaternionFromDirection } from "./algebra";
import { q } from "./ballPark";
import { Compute } from "./compute";
import { saveBinary } from "./io";
import { Mesh, cylinderMesh, icoSphereMesh } from "./mesh";

export interface Object {
  data: Float32Array,
  buffer?: GPUBuffer,
  mesh: Mesh,
  count: number,
  maxCount: number
}

export class Structure {

  private balls: Object;
  private rods: Object;
  private halfEdges: Uint32Array;

  private ballRadius: number;
  private cylinderRadius: number;
  private cylinderLength: number;

  private compute: Compute;

  constructor(maxVertexCount:number, maxEdgeCount:number, ballRadius:number, cylinderRadius:number, cylinderLength:number, compute:Compute) {

    this.compute = compute;

    this.ballRadius = ballRadius;
    this.cylinderRadius = cylinderRadius;
    this.cylinderLength = cylinderLength;

    this.halfEdges = new Uint32Array(8*maxEdgeCount);

    const ballData = new Float32Array(maxVertexCount * q);
    const rodData = new Float32Array(maxEdgeCount * q);

    this.balls = {
      data: ballData,
      mesh: icoSphereMesh(this.ballRadius, 4),
      count: 0,
      maxCount: maxVertexCount
    }

    this.rods = {
      data: rodData,
      mesh: cylinderMesh(32, this.cylinderRadius, this.cylinderLength/2, true),
      count: 0,
      maxCount: maxEdgeCount
    }
  }

  init(halfEdgesInit:Uint32Array) {

    this.halfEdges.set(halfEdgesInit);
    
    this.balls.count = this.vertexCount(halfEdgesInit);
    this.rods.count = halfEdgesInit.length/8;

    const p = new Float32Array(3*this.balls.count);
    for (let i=0; i<p.length; i++) p[i] = 1 * (0.5 - Math.random());

    for (let i=0; i<this.balls.count; i++) {
      this.createBall(i, p.slice(3*i,3*i+3));
      const coordinationNumber = this.vertexEdgeCount(halfEdgesInit, i);
      this.setCoordinationNumber(i, coordinationNumber);
      this.setColor(i, this.connectionsToColor(coordinationNumber));
    }

    for (let i=0; i<this.rods.count; i++) this.createRod(i);

    return [this.balls, this.rods, this.halfEdges] as [Object, Object, Uint32Array];
  }

  createBall(index:number, position:Float32Array) {
    
    const offset = index * q;

    this.balls.data.set(position, offset);
    this.balls.data.set([1], offset+3); // size
    this.balls.data.set([this.ballRadius], offset+16); // prop1
  }

  createRod(index:number) {

    const offset = index * q;

    this.rods.data.set([1], offset+3); // size
    this.rods.data.set([0.7,0.7,0.7, 1], offset+8); // color
    this.rods.data.set([this.cylinderRadius], offset+16); // prop1
    this.rods.data.set([this.cylinderLength], offset+17); // prop2
  }

  setColor(index:number, color:Array<number>) {
    this.balls.data.set(color, index*q+8);
  }

  setCoordinationNumber(index:number, coordinationNumber:number) {
    this.balls.data.set([coordinationNumber], index*q+19); // pro4 used for coordinationNumber
  }

  connectionsToColor = (coordinationNumber:number) => {
    if (coordinationNumber === 3) return [1,0,1, 1]
    else if (coordinationNumber === 4) return [0,0,1, 1];
    else if (coordinationNumber === 5) return [0,1,1, 1];
    else if (coordinationNumber === 6) return [1,1,1, 1];
    else if (coordinationNumber === 7) return [1,0,0, 1];
    else if (coordinationNumber === 8) return [1,1,0, 1];
    else if (coordinationNumber === 9) return [0,1,0, 1];
    else return [.5,.5,.5, 1];
  }

  changeCoordinationNumberAndColor = (index:number, diff:number) => {
    let prevCoordinationNumber = this.balls.data[q*index+19];
    this.setCoordinationNumber(index, prevCoordinationNumber+diff);
    this.setColor(index, this.connectionsToColor(prevCoordinationNumber+diff));
    this.compute.setBallsBuffer(index, this.balls.data.slice(q*index,q*index+q));
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

  insertVertex(rodIndex:number) {
    const A = 2*rodIndex;
    const iA = 4*A;
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
    this.halfEdges[iB+3] = this.balls.count; // new vertex index
    this.halfEdges[kB] = B;
    this.halfEdges[kB+1] = C;
    this.halfEdges[kB+2] = this.halfEdges[kA+1];
    this.halfEdges[kB+3] = this.halfEdges[4*this.halfEdges[kA+2]+3];
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
    this.halfEdges[kD+3] = this.halfEdges[4*this.halfEdges[iA+2]+3];
    // surrounding edges
    this.halfEdges[4*this.halfEdges[kA+2]+2] = B;
    this.halfEdges[4*this.halfEdges[kA+1]+1] = B+1;
    this.halfEdges[4*this.halfEdges[kA+1]+2] = C;
    this.halfEdges[4*this.halfEdges[iA+2]+1] = C+1;
    this.halfEdges[4*this.halfEdges[iA+2]+2] = D;
    this.halfEdges[4*this.halfEdges[iA+1]+1] = D+1;
    // A
    this.halfEdges[iA+2] = D+1;
    this.halfEdges[iA+3] = this.balls.count;
    this.halfEdges[kA+1] = B;
    

    let l;
    for (let o=0; o<3; o++) {
      l = this.rods.count;
      this.createRod(l);
      this.compute.setRodsBuffer(l, this.rods.data.slice(q*l,q*l+q));
      this.rods.count++;
    }
    
    l = this.halfEdges[kB+3];
    this.changeCoordinationNumberAndColor(l, 1);
    
    l = this.halfEdges[kD+3];
    this.changeCoordinationNumberAndColor(l, 1);

    l = this.balls.count;
    this.createBall(l, this.rods.data.slice(rodIndex*q,rodIndex*q+3));
    this.setCoordinationNumber(l, 4);
    this.setColor(l, this.connectionsToColor(4));
    this.compute.setBallsBuffer(l, this.balls.data.slice(q*l,q*l+q));
    this.balls.count++;

    this.compute.setHalfEdgeBuffer(this.halfEdges);
    this.compute.setCount(this.balls.count, this.rods.count);

    // console.log(this.halfEdges.slice(0, 8*this.rods.count));
    
  }

  flipEdge(rodIndex:number) {
    const ac = 2*rodIndex;
    const ca = ac+1;
    const ab = this.halfEdges[4*ca+2];
    const bc = this.halfEdges[4*ca+1];
    const cd = this.halfEdges[4*ac+2];
    const da = this.halfEdges[4*ac+1];

    this.halfEdges[4*ab+1] = da;
    this.halfEdges[4*ab+2] = ac;
    this.halfEdges[4*bc+1] = ca;
    this.halfEdges[4*bc+2] = cd;
    this.halfEdges[4*cd+1] = bc;
    this.halfEdges[4*cd+2] = ca;
    this.halfEdges[4*da+1] = ac;
    this.halfEdges[4*da+2] = ab;

    this.halfEdges[4*ac+1] = ab;
    this.halfEdges[4*ac+2] = da;
    this.halfEdges[4*ca+1] = cd;
    this.halfEdges[4*ca+2] = bc;

    // vertex pointer
    this.halfEdges[4*ac+3] = this.halfEdges[4*cd+3];
    this.halfEdges[4*ca+3] = this.halfEdges[4*ab+3];

    // color
    this.changeCoordinationNumberAndColor(this.halfEdges[4*da+3], -1);
    this.changeCoordinationNumberAndColor(this.halfEdges[4*ab+3],  1);
    this.changeCoordinationNumberAndColor(this.halfEdges[4*bc+3], -1);
    this.changeCoordinationNumberAndColor(this.halfEdges[4*cd+3],  1);

    this.compute.setHalfEdgeBuffer(this.halfEdges);
  }

  saveData() {
    saveBinary(this.halfEdges.slice(0,this.rods.count*8), 'data');
    console.log(this.rods.count+' edges saved to file.');
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