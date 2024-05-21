import { quaternionFromDirection } from "./algebra";
import { q } from "./ballPark";
import { Compute } from "./compute";
import { saveBinary } from "./io";
import { Mesh, MeshBuffers, cylinderMesh, icoSphereMesh } from "./mesh";

export interface Object {
  data: Float32Array,
  buffer?: GPUBuffer,
  mesh?: Mesh,
  meshBuffers?: MeshBuffers, // optional for individual triangles
  count: number,
  maxCount: number
}

export class Structure {

  private balls: Object;
  private rods: Object;
  private triangles: Object;
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

    this.balls = {
      data: new Float32Array(maxVertexCount * q),
      mesh: icoSphereMesh(this.ballRadius, 4),
      count: 0,
      maxCount: maxVertexCount
    }

    this.rods = {
      data: new Float32Array(maxEdgeCount * q),
      mesh: cylinderMesh(32, this.cylinderRadius, this.cylinderLength/2, true),
      count: 0,
      maxCount: maxEdgeCount
    }

    this.triangles = {
      data: new Float32Array(q),
      count: 1,
      maxCount: 1000
    }
  }

  init(halfEdgesInit:Uint32Array, vertexPositions?:Float32Array) {

    this.halfEdges.set(halfEdgesInit);
    
    this.balls.count = this.vertexCount(halfEdgesInit);
    this.rods.count = halfEdgesInit.length/8;

    const p = new Float32Array(3*this.balls.count);
    if (vertexPositions === undefined)
      for (let i=0; i<p.length; i++) p[i] = 5 * (0.5 - Math.random());
    else
      p.set(vertexPositions);

    for (let i=0; i<this.balls.count; i++) {
      this.createBall(i, p.slice(3*i,3*i+3));
      const coordinationNumber = this.vertexEdgeCount(halfEdgesInit, i);
      this.setCoordinationNumber(i, coordinationNumber);
      this.setColor(i, this.connectionsToColor(coordinationNumber));
    }

    for (let i=0; i<this.rods.count; i++) this.createRod(i);

    this.triangles.data.set([1], 3); // size
    this.triangles.data.set([0.3, 0.2, 0.2, 1], 8); // color

    return [this.balls, this.rods, this.triangles, this.halfEdges] as [Object, Object, Object, Uint32Array];
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

  addVertex(rodIndex:number) {
    const ac = 2*rodIndex;
    const bn = 2*this.rods.count;
    const cn = 2*this.rods.count+2;
    const dn = 2*this.rods.count+4;
    const ca = ac+1;
    const nb = bn+1;
    const nc = cn+1;
    const nd = dn+1;
    // B
    this.halfEdges[4*bn] = nb;
    this.halfEdges[4*bn+1] = this.halfEdges[4*ca+2];
    this.halfEdges[4*bn+2] = ca;
    this.halfEdges[4*bn+3] = this.balls.count; // new vertex index
    this.halfEdges[4*nb] = bn;
    this.halfEdges[4*nb+1] = cn;
    this.halfEdges[4*nb+2] = this.halfEdges[4*ca+1];
    this.halfEdges[4*nb+3] = this.halfEdges[4*this.halfEdges[4*ca+2]+3];
    // C
    this.halfEdges[4*cn] = nc;
    this.halfEdges[4*cn+1] = this.halfEdges[4*ca+1];
    this.halfEdges[4*cn+2] = nb;
    this.halfEdges[4*cn+3] = this.balls.count;
    this.halfEdges[4*nc] = cn;
    this.halfEdges[4*nc+1] = dn;
    this.halfEdges[4*nc+2] = this.halfEdges[4*ac+2];
    this.halfEdges[4*nc+3] = this.halfEdges[4*ac+3];
    // D
    this.halfEdges[4*dn] = nd;
    this.halfEdges[4*dn+1] = this.halfEdges[4*ac+2];
    this.halfEdges[4*dn+2] = nc;
    this.halfEdges[4*dn+3] = this.balls.count;
    this.halfEdges[4*nd] = dn;
    this.halfEdges[4*nd+1] = ac;
    this.halfEdges[4*nd+2] = this.halfEdges[4*ac+1];
    this.halfEdges[4*nd+3] = this.halfEdges[4*this.halfEdges[4*ac+2]+3];
    // surrounding edges
    this.halfEdges[4*this.halfEdges[4*ca+2]+2] = bn;
    this.halfEdges[4*this.halfEdges[4*ca+1]+1] = nb;
    this.halfEdges[4*this.halfEdges[4*ca+1]+2] = cn;
    this.halfEdges[4*this.halfEdges[4*ac+2]+1] = nc;
    this.halfEdges[4*this.halfEdges[4*ac+2]+2] = dn;
    this.halfEdges[4*this.halfEdges[4*ac+1]+1] = nd;
    // A
    this.halfEdges[4*ac+2] = nd;
    this.halfEdges[4*ac+3] = this.balls.count;
    this.halfEdges[4*ca+1] = bn;
    

    let l;
    for (let o=0; o<3; o++) {
      l = this.rods.count;
      this.createRod(l);
      this.compute.setRodsBuffer(l, this.rods.data.slice(q*l,q*l+q));
      this.rods.count++;
    }
    
    l = this.halfEdges[4*nb+3];
    this.changeCoordinationNumberAndColor(l, 1);
    
    l = this.halfEdges[4*nd+3];
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

  removeEdge(rodIndex:number) {
    const ac = 2*rodIndex;
    const ca = ac+1;
    const ab = this.halfEdges[4*ca+2];
    const bc = this.halfEdges[4*ca+1];
    const cd = this.halfEdges[4*ac+2];
    const da = this.halfEdges[4*ac+1];

    this.halfEdges[4*da+2] = ab;
    this.halfEdges[4*ab+1] = da;
    this.halfEdges[4*bc+2] = cd;
    this.halfEdges[4*cd+1] = bc;

    // deactivate edge
    this.halfEdges[4*ac+1] = 0;
    this.halfEdges[4*ac+2] = 0;

    // color
    this.changeCoordinationNumberAndColor(this.halfEdges[4*ac+3], -1);
    this.changeCoordinationNumberAndColor(this.halfEdges[4*ca+3], -1);

    this.compute.setHalfEdgeBuffer(this.halfEdges);

    // make edge invisible
    const l = rodIndex;
    this.rods.data.set([0], l*q+3); // size
    this.compute.setRodsBuffer(l, this.rods.data.slice(q*l,q*l+q));
  }

  async saveData() {
    saveBinary(this.halfEdges.slice(0,this.rods.count*8), 'data');
    console.log(this.rods.count+' edges saved to file.');

    // put out vertex positions
    // const b = await this.compute.getBallsBuffer();
    // for (let i=0; i<this.balls.count; i++)
    //   console.log(b[q*i], b[q*i+1], b[q*i+2]);
     
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