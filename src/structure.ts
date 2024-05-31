import { q } from "./ballPark";
import { Compute } from "./compute";
import { exportSTL, saveBinary } from "./io";
import { Mesh, MeshBuffers, cylinderMesh, icoSphereMesh } from "./mesh";

export interface Object {
  data: Float32Array,
  buffer?: GPUBuffer,
  mesh: Mesh,
  isInstancedMesh: boolean,
  meshBuffers?: MeshBuffers, // optional for individual triangles
  visible: boolean,
  count: number,
  maxCount: number
}

export class Structure {

  private balls: Object;
  private rods: Object;
  private triangles: Object;
  private halfEdges: Uint32Array;
  private faceHalfEdgeMap: Uint32Array;

  private ballIndexPool!: Array<number>;
  private rodIndexPool!: Array<number>;

  private ballRadius: number;
  private cylinderRadius: number;
  private cylinderLength: number;

  private compute: Compute;

  constructor(maxVertexCount:number, maxEdgeCount:number, maxFaceCount:number, ballRadius:number, cylinderRadius:number, cylinderLength:number, compute:Compute) {

    this.compute = compute;

    this.ballRadius = ballRadius;
    this.cylinderRadius = cylinderRadius;
    this.cylinderLength = cylinderLength;

    this.halfEdges = new Uint32Array(8*maxEdgeCount);
    this.faceHalfEdgeMap = new Uint32Array(maxFaceCount);

    this.balls = {
      data: new Float32Array(maxVertexCount * q),
      mesh: icoSphereMesh(this.ballRadius, 4),
      isInstancedMesh: true,
      visible: true,
      count: 0,
      maxCount: maxVertexCount
    }

    this.rods = {
      data: new Float32Array(maxEdgeCount * q),
      mesh: cylinderMesh(32, this.cylinderRadius, this.cylinderLength/2, true),
      isInstancedMesh: true,
      visible: true,
      count: 0,
      maxCount: maxEdgeCount
    }

    this.triangles = {
      data: new Float32Array(q),
      mesh: {
        vertices: new Float32Array(),
        normals: new Float32Array(),
        indices: new Uint32Array()
      },
      isInstancedMesh: false,
      visible: true,
      count: 0,
      maxCount: maxFaceCount
    }
  }

  init(halfEdgesInit:Uint32Array, vertexPositions?:Float32Array) {

    this.halfEdges = new Uint32Array(this.halfEdges.length);
    this.halfEdges.set(halfEdgesInit);

    this.faceHalfEdgeMap = new Uint32Array(this.faceHalfEdgeMap.length);
    
    this.balls.data = new Float32Array(this.balls.maxCount * q);

    this.balls.count = this.vertexCount(halfEdgesInit);
    this.rods.count = halfEdgesInit.length/8;

    this.ballIndexPool = [];
    this.rodIndexPool = [];

    const p = new Float32Array(3*this.balls.count);
    if (vertexPositions === undefined)
      for (let i=0; i<p.length; i++) p[i] = 2 * (0.5 - Math.random());
    else
      p.set(vertexPositions);

    for (let i=0; i<this.balls.count; i++) {
      this.createBall(i, p.slice(3*i,3*i+3));
      const coordinationNumber = this.vertexCoordinationCount(halfEdgesInit, i);
      this.setCoordinationNumber(i, coordinationNumber);
      this.setColor(i, this.connectionsToColor(coordinationNumber));
    }

    for (let i=0; i<this.rods.count; i++) this.createRod(i);

    this.faceInit();

    this.triangles.data.set([1], 3); // size
    this.triangles.data.set([.8, .7, .5, 1], 8); // color
    
    return [this.balls, this.rods, this.triangles, this.halfEdges] as [Object, Object, Object, Uint32Array];
  }

  createBall(index:number, position:Float32Array) {
    
    const offset = index * q;

    this.balls.data.set(position, offset);
    this.balls.data.set([1], offset+3); // size
    this.balls.data.set([this.ballRadius], offset+16); // prop1
    this.balls.data.set([1], offset+20); // used
  }

  createRod(index:number) {

    const offset = index * q;

    this.rods.data.set([1], offset+3); // size
    this.rods.data.set([0.7,0.7,0.7, 1], offset+8); // color
    this.rods.data.set([this.cylinderRadius], offset+16); // prop1
    this.rods.data.set([this.cylinderLength], offset+17); // prop2
    this.rods.data.set([1], offset+20); // used
  }

  setColor(index:number, color:Array<number>) {
    this.balls.data.set(color, index*q+8);
  }

  activate(object:Object, index:number) {
    object.data.set([1], index*q+20); // used
    object.data.set([1], index*q+3); // size
  }

  deactivate(object:Object, index:number) {
    object.data.set([0], index*q+20); // used
    object.data.set([0], index*q+3); // size
    object.data.set([0,0,0], index*q+12) // velocity
  }

  setCoordinationNumber(index:number, coordinationNumber:number) {
    this.balls.data.set([coordinationNumber], index*q+19); // prop4
  }

  getRodIndex = (halfEdgeIndex:number) =>
    halfEdgeIndex%2 === 0 ? halfEdgeIndex/2 : (halfEdgeIndex-1)/2;

  getTwinHalfEdge = (index:number) =>
    index%2 === 0 ? index + 1 : index - 1;

  copyHalfEdge(source:number, destination:number) {
    if (source !== destination) {
      this.halfEdges.set(
        this.halfEdges.slice(4*source, 4*source+4),
        4*destination
      );
      this.halfEdges[4*this.halfEdges[4*destination+1]+2] = destination;
      this.halfEdges[4*this.halfEdges[4*destination+2]+1] = destination;
    }
  }

  addToBallIndexPool = (index:number) => {
    this.ballIndexPool.push(index);
    this.compute.setNextBallInPool(index);
  }

  addToRodIndexPool = (index:number) => this.rodIndexPool.push(index);

  getFromBallIndexPool() {
    if (this.ballIndexPool.length > 0) {
      const index = this.ballIndexPool.pop() as number;
      let next = this.balls.count;
      if (this.ballIndexPool.length > 0)
        next = this.ballIndexPool[this.ballIndexPool.length-1];
      this.compute.setNextBallInPool(next);
      return index;
    }
    else {
      this.balls.count++;
      this.compute.setNextBallInPool(this.balls.count);
      return this.balls.count - 1;
    }
  }

  getFromRodIndexPool() {
    if (this.rodIndexPool.length > 0)
      return this.rodIndexPool.pop() as number;
    else {
      this.rods.count++;
      return this.rods.count - 1;
    }
  }

  connectionsToColor(coordinationNumber:number) {
    if (coordinationNumber === 3) return [1,0,1, 1]
    else if (coordinationNumber === 4) return [0,0,1, 1];
    else if (coordinationNumber === 5) return [0,1,1, 1];
    else if (coordinationNumber === 6) return [1,1,1, 1];
    else if (coordinationNumber === 7) return [1,0,0, 1];
    else if (coordinationNumber === 8) return [1,1,0, 1];
    else if (coordinationNumber === 9) return [0,1,0, 1];
    else return [.5,.5,.5, 1];
  }

  changeCoordinationNumberAndColor(index:number, diff:number) {
    let prevCoordinationNumber = this.balls.data[q*index+19];
    this.setCoordinationNumber(index, prevCoordinationNumber+diff);
    this.setColor(index, this.connectionsToColor(prevCoordinationNumber+diff));
    this.compute.setBallsBuffer(index, this.balls.data.slice(q*index,q*index+q), false);
  }

  vertexCount(halfEdges:Uint32Array) {
    let count = 0;
    for(let i=0; i<halfEdges.length/4; ++i){
      const index = halfEdges[4*i+3];
      if( index > count)
      count = index;
    }
    return count + 1;
  }

  vertexCoordinationCount(halfEdges:Uint32Array, vertexIndex:number) {
    let count = 0;
    for(let i=0; i<halfEdges.length/4; ++i){
      const index = halfEdges[4*i+3];
      if(index === vertexIndex) {
        // if (count === 0) this.vertexEdgeMap[vertexIndex] = i;
        count++;
      }
    }
    return count;
  }

  removeTwoFaces(i:number, j:number) {
    let c = this.triangles.count-1;
    if (i === c)
      this.setFace(j, this.faceHalfEdgeMap[c-1]);
    else if (j === c)
      this.setFace(i, this.faceHalfEdgeMap[c-1]);
    else {
      this.setFace(i, this.faceHalfEdgeMap[c]);
      this.setFace(j, this.faceHalfEdgeMap[c-1]);
    }
    this.triangles.count -= 2;
  }

  setFace(triangleIndex:number, i:number) {
    const l = triangleIndex;
    const j = this.halfEdges[4*i+2];
    const k = this.halfEdges[4*j+2];
    this.halfEdges[4*i] = l;
    this.halfEdges[4*j] = l;
    this.halfEdges[4*k] = l;
    this.triangles.mesh.indices[3*l] = this.halfEdges[4*i+3];
    this.triangles.mesh.indices[3*l+1] = this.halfEdges[4*j+3];
    this.triangles.mesh.indices[3*l+2] = this.halfEdges[4*k+3];

    this.faceHalfEdgeMap[l] = i;
  }

  faceInit() {

    let f = 0; // face count
    // let lastFaceHalfEdge = 0;

    this.triangles.mesh.indices = new Uint32Array(3*this.triangles.maxCount);

    for (let i=0; i<this.halfEdges.length/4; i++) {

      const j = this.halfEdges[4*i+2];
      const k = this.halfEdges[4*j+2];

      if (i < j && i < k) {
        this.halfEdges[4*i] = f;
        this.halfEdges[4*j] = f;
        this.halfEdges[4*k] = f;

        this.triangles.mesh.indices[3*f  ] = this.halfEdges[4*i+3];
        this.triangles.mesh.indices[3*f+1] = this.halfEdges[4*j+3];
        this.triangles.mesh.indices[3*f+2] = this.halfEdges[4*k+3];

        this.faceHalfEdgeMap[f] = i;

        f++;
      }
    }

    this.triangles.count = f;
  }

  addVertex(rodIndex:number) {

    let l;
    const addedRodIndices = new Uint32Array(3);
    for (let o=0; o<3; o++) {
      l = this.getFromRodIndexPool();
      addedRodIndices[o] = l;
      this.createRod(l);
      this.compute.setRodsBuffer(l, this.rods.data.slice(q*l,q*l+q));
    }

    const addedBallIndex = this.getFromBallIndexPool();

    const ac = 2*rodIndex;
    const bn = 2*addedRodIndices[0];
    const cn = 2*addedRodIndices[1];
    const dn = 2*addedRodIndices[2];
    const ca = ac+1;
    const nb = bn+1;
    const nc = cn+1;
    const nd = dn+1;
    const ab = this.halfEdges[4*ca+2];
    const bc = this.halfEdges[4*ca+1];
    const cd = this.halfEdges[4*ac+2];
    const da = this.halfEdges[4*ac+1];
    // B
    this.halfEdges[4*bn] = nb;
    this.halfEdges[4*bn+1] = ab;
    this.halfEdges[4*bn+2] = ca;
    this.halfEdges[4*bn+3] = addedBallIndex;
    this.halfEdges[4*nb] = bn;
    this.halfEdges[4*nb+1] = cn;
    this.halfEdges[4*nb+2] = bc;
    this.halfEdges[4*nb+3] = this.halfEdges[4*ab+3];
    // C
    this.halfEdges[4*cn] = nc;
    this.halfEdges[4*cn+1] = bc;
    this.halfEdges[4*cn+2] = nb;
    this.halfEdges[4*cn+3] = addedBallIndex;
    this.halfEdges[4*nc] = cn;
    this.halfEdges[4*nc+1] = dn;
    this.halfEdges[4*nc+2] = cd;
    this.halfEdges[4*nc+3] = this.halfEdges[4*ac+3];
    // D
    this.halfEdges[4*dn] = nd;
    this.halfEdges[4*dn+1] = cd;
    this.halfEdges[4*dn+2] = nc;
    this.halfEdges[4*dn+3] = addedBallIndex;
    this.halfEdges[4*nd] = dn;
    this.halfEdges[4*nd+1] = ac;
    this.halfEdges[4*nd+2] = da;
    this.halfEdges[4*nd+3] = this.halfEdges[4*cd+3];
    // surrounding edges
    this.halfEdges[4*ab+2] = bn;
    this.halfEdges[4*bc+1] = nb;
    this.halfEdges[4*bc+2] = cn;
    this.halfEdges[4*cd+1] = nc;
    this.halfEdges[4*cd+2] = dn;
    this.halfEdges[4*da+1] = nd;
    // A
    this.halfEdges[4*ac+2] = nd;
    this.halfEdges[4*ac+3] = addedBallIndex;
    this.halfEdges[4*ca+1] = bn;
    
    l = this.halfEdges[4*nb+3];
    this.changeCoordinationNumberAndColor(l, 1);
    const vertexB = l;
    
    l = this.halfEdges[4*nd+3];
    this.changeCoordinationNumberAndColor(l, 1);
    const vertexD = l;

    l = addedBallIndex;
    this.createBall(l, this.rods.data.slice(rodIndex*q,rodIndex*q+3));
    this.setCoordinationNumber(l, 4);
    this.setColor(l, this.connectionsToColor(4));
    this.compute.setBallsBuffer(l, this.balls.data.slice(q*l,q*l+q), false);

    // faces
    this.setFace(this.halfEdges[4*ab], ab); // old faces
    this.setFace(this.halfEdges[4*da], da);
    this.setFace(this.triangles.count, bc); // new faces
    this.triangles.count++;
    this.setFace(this.triangles.count, cd);
    this.triangles.count++;

    this.compute.setTriangleIndexBuffer(this.triangles.mesh.indices);
    this.compute.setHalfEdgeBuffer(this.halfEdges);
    this.compute.setCount(this.balls.count, this.rods.count, this.triangles.count);

    // console.log(this.halfEdges.slice(0, 8*this.rods.count));
    
    return [vertexB, vertexD];
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
    const vertexA = this.halfEdges[4*da+3];
    const vertexB = this.halfEdges[4*ab+3];
    const vertexC = this.halfEdges[4*bc+3];
    const vertexD = this.halfEdges[4*cd+3];
    this.halfEdges[4*ac+3] = vertexD;
    this.halfEdges[4*ca+3] = vertexB;
    this.changeCoordinationNumberAndColor(vertexA, -1);
    this.changeCoordinationNumberAndColor(vertexB,  1);
    this.changeCoordinationNumberAndColor(vertexC, -1);
    this.changeCoordinationNumberAndColor(vertexD,  1);

    // faces
    this.setFace(this.halfEdges[4*ab], ab);
    this.setFace(this.halfEdges[4*cd], cd);

    this.compute.setTriangleIndexBuffer(this.triangles.mesh.indices);
    this.compute.setHalfEdgeBuffer(this.halfEdges);
  }

  collapseEdge(rodIndex:number) {
    
    if (this.triangles.count <= 4) return;

    const ac = 2*rodIndex;
    const ca = ac+1;
    const ab = this.halfEdges[4*ca+2];
    const bc = this.halfEdges[4*ca+1];
    const cd = this.halfEdges[4*ac+2];
    const da = this.halfEdges[4*ac+1];
    const cb = this.getTwinHalfEdge(bc);
    const dc = this.getTwinHalfEdge(cd);

    // reset vertex
    const vertexA = this.halfEdges[4*da+3];
    const vertexC = this.halfEdges[4*ac+3];
    
    this.changeCoordinationNumberAndColor(vertexA, -1);
    let i = dc;
    this.halfEdges[4*i+3] = vertexA;
    let next = this.halfEdges[4*i+2];
    const count = this.balls.data[q*vertexC+19];
    const cToAEdgeList = [];
    for (let o=0; o<count-3; o++) {
      i = this.getTwinHalfEdge(next);
      cToAEdgeList.push(i);
      this.halfEdges[4*i+3] = vertexA;
      this.changeCoordinationNumberAndColor(vertexA, 1);
      next = this.halfEdges[4*i+2];
    }
    this.changeCoordinationNumberAndColor(this.halfEdges[4*cb+3], -1); // B
    this.changeCoordinationNumberAndColor(this.halfEdges[4*cd+3], -1); // D
    let l = vertexC;
    this.deactivate(this.balls, l);
    this.compute.setBallsBuffer(l, this.balls.data.slice(q*l,q*l+q));
    this.addToBallIndexPool(l);

    // faces memory relocation
    const faceABC = this.halfEdges[4*ab];
    const faceACD = this.halfEdges[4*da];
    this.removeTwoFaces(faceABC, faceACD);
    
    // reset edges
    this.copyHalfEdge(dc, da);
    this.copyHalfEdge(cb, ab);
    for (const halfEdge of [dc, cb, ac]) {
      l = this.getRodIndex(halfEdge);
      this.deactivate(this.rods, l);
      this.compute.setRodsBuffer(l, this.rods.data.slice(q*l,q*l+q));
      this.addToRodIndexPool(l);
    }
    
    // faces
    cToAEdgeList.push(da);
    for (let o=0; o<count-2; o++) {
      const e = cToAEdgeList.pop() as number;
      this.setFace(this.halfEdges[4*e], e);
    }

    this.compute.setHalfEdgeBuffer(this.halfEdges);
    this.compute.setTriangleIndexBuffer(this.triangles.mesh.indices);
    this.compute.setCount(this.balls.count, this.rods.count, this.triangles.count);
  }

  // removeEdge(rodIndex:number) {
  //   const ac = 2*rodIndex;
  //   const ca = ac+1;
  //   const ab = this.halfEdges[4*ca+2];
  //   const bc = this.halfEdges[4*ca+1];
  //   const cd = this.halfEdges[4*ac+2];
  //   const da = this.halfEdges[4*ac+1];

  //   this.halfEdges[4*da+2] = ab;
  //   this.halfEdges[4*ab+1] = da;
  //   this.halfEdges[4*bc+2] = cd;
  //   this.halfEdges[4*cd+1] = bc;

  //   // deactivate edge
  //   this.halfEdges[4*ac+1] = 0;
  //   this.halfEdges[4*ac+2] = 0;

  //   // color
  //   this.changeCoordinationNumberAndColor(this.halfEdges[4*ac+3], -1);
  //   this.changeCoordinationNumberAndColor(this.halfEdges[4*ca+3], -1);

  //   this.compute.setHalfEdgeBuffer(this.halfEdges);

  //   // make edge invisible
  //   const l = rodIndex;
  //   this.rods.data.set([0], l*q+3); // size
  //   this.compute.setRodsBuffer(l, this.rods.data.slice(q*l,q*l+q));
  // }

  async saveData() {
    const intCount = this.rods.count*8;
    const floatCount = this.balls.count*3;

    // vertex positions
    const b = await this.compute.getBuffer('balls');
    const p = new Float32Array(floatCount);
    for (let i=0; i<this.balls.count; i++)
      p.set(b.slice(q*i,q*i+3),3*i);
      // console.log(b[q*i], b[q*i+1], b[q*i+2]);
      

    const buffy = new Uint32Array(1+intCount+floatCount);
    const floatView = new Float32Array(buffy.buffer);

    buffy.set([intCount]);
    buffy.set(this.halfEdges.slice(0,intCount), 1);
    floatView.set(p, 1+intCount);

    saveBinary(buffy, 'deltahedron_data');

    console.log(this.rods.count+' edges and '+this.balls.count+' vertices saved to file.');
  }

  async exportSTL() {
    const v = await this.compute.getBuffer('triangles');
    exportSTL(v.slice(0,9*this.triangles.count));
    console.log(this.triangles.count+' triangles exported.');
  }

  hideFaces = (areHidden:boolean) => {
    this.triangles.visible = !areHidden;
    this.compute.setTrianglesVisibility(!areHidden);
  }

  hideBallsAndRods = (areHidden:boolean) => {
    this.balls.visible = !areHidden;
    this.rods.visible = !areHidden;
    this.compute.setBallsAndRodsVisibility(!areHidden, !areHidden);
  }
}