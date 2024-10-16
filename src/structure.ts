import { colorArray, q } from "./ballPark";
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
  private vertexHalfEdgeMap: Uint32Array;

  private ballRadius: number;
  private cylinderRadius: number;
  private cylinderLength: number;

  private compute: Compute;

  rodBaseColor = [0.5,0.5,0.5];
  rodHighlightColor = [1,0.7,1];

  triangleColor = [.8, .7, .5];
  // triangleColor = [.7, .7, .7];

  ballGlossyness = 0.2;

  constructor(maxVertexCount:number, maxEdgeCount:number, maxFaceCount:number, ballRadius:number, cylinderRadius:number, cylinderLength:number, compute:Compute) {

    this.compute = compute;

    this.ballRadius = ballRadius;
    this.cylinderRadius = cylinderRadius;
    this.cylinderLength = cylinderLength;

    this.halfEdges = new Uint32Array(8*maxEdgeCount);
    this.faceHalfEdgeMap = new Uint32Array(maxFaceCount);
    this.vertexHalfEdgeMap = new Uint32Array(maxVertexCount);

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
    this.vertexHalfEdgeMap = new Uint32Array(this.vertexHalfEdgeMap.length);
    
    this.balls.data = new Float32Array(this.balls.maxCount * q);

    this.balls.count = this.vertexCount(halfEdgesInit);
    this.rods.count = halfEdgesInit.length/8;

    const p = new Float32Array(3*this.balls.count);
    if (vertexPositions === undefined)
      for (let i=0; i<p.length; i++) p[i] = 2 * (0.5 - Math.random());
    else
      p.set(vertexPositions);

    for (let i=0; i<this.balls.count; i++) {
      this.createBall(i, p.slice(3*i,3*i+3));
      const coordinationNumber = this.vertexCoordinationCount(halfEdgesInit, i);
      this.setCoordinationNumber(i, coordinationNumber);
      this.setBallColor(i, this.connectionsToColor(coordinationNumber));
    }

    for (let i=0; i<this.rods.count; i++) this.createRod(i);

    this.faceInit();

    this.triangles.data.set([1], 3); // size
    this.triangles.data.set(this.triangleColor, 8); // color
    this.triangles.data.set([1], 11); // alpha
    this.triangles.data.set([1], 21); // texture
    
    return [this.balls, this.rods, this.triangles, this.halfEdges] as [Object, Object, Object, Uint32Array];
  }

  createBall(index:number, position?:Float32Array) {
    
    const offset = index * q;

    if (position !== undefined)
      this.balls.data.set(position, offset);
    this.balls.data.set([1], offset+3); // size
    this.balls.data.set([this.ballRadius], offset+16); // prop1
    this.setBallGlossyness(index, this.ballGlossyness);
  }

  createRod(index:number) {

    const offset = index * q;

    this.rods.data.set([1], offset+3); // size
    this.rods.data.set(this.rodBaseColor, offset+8); // color
    this.rods.data.set([1], offset+11); // alpha
    this.rods.data.set([this.cylinderRadius], offset+16); // prop1
    this.rods.data.set([this.cylinderLength], offset+17); // prop2
  }

  setBallColor(index:number, color:Array<number>) {
    this.balls.data.set(color, index*q+8);
    this.balls.data.set([1], index*q+11); // alpha
  }

  setBallGlossyness(index:number, glossyness:number) {
    this.balls.data.set([glossyness], index*q+20);
  }

  setCoordinationNumber(index:number, coordinationNumber:number) {
    this.balls.data.set([coordinationNumber], index*q+19); // prop4
  }

  getCoordinationNumber(index:number) {
    return this.balls.data[index*q+19]; // prop4
  }

  connectionsToColor(coordinationNumber:number) {
    if (coordinationNumber < 4) throw new Error('coordination number < 4');
    else if (coordinationNumber > 10) return colorArray[7];
    else return colorArray[coordinationNumber - 4];
  }

  vertexCoordinationCount(halfEdges:Uint32Array, vertexIndex:number) {
    let count = 0;
    for(let i=0; i<halfEdges.length/4; ++i){
      const index = halfEdges[4*i+3];
      if(index === vertexIndex) {
        if (count === 0) this.vertexHalfEdgeMap[vertexIndex] = i;
        count++;
      }
    }
    return count;
  }

  changeCoordinationNumberAndColor(index:number, diff:number) {
    let prevCoordinationNumber = this.getCoordinationNumber(index);
    this.setCoordinationNumber(index, prevCoordinationNumber+diff);
    this.setBallColor(index, this.connectionsToColor(prevCoordinationNumber+diff));
    this.compute.setBallsBuffer(index, this.balls.data.slice(q*index,q*index+q), false);
  }

  changeRodColor(index:number, color:Array<number>) {
    this.rods.data.set(color, index*q+8);
    this.compute.setRodsBufferColor(index, this.rods.data.slice(q*index,q*index+q));
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
      this.vertexHalfEdgeMap[this.halfEdges[4*destination+3]] = destination;
      this.faceHalfEdgeMap[this.halfEdges[4*destination]] = destination;
    }
  }

  moveRod(source:number, destination:number) {
    if (source !== destination) {
      let i = 2 * source;
      let j = 2 * destination;
      for (let o=0; o<2; o++) {
        this.copyHalfEdge(i, j);
        i++;
        j++;
      }
    }
  }

  redirectVertex(source:number, destination:number) {
    let i = this.vertexHalfEdgeMap[source];
    this.vertexHalfEdgeMap[destination] = i;
    const c = this.getCoordinationNumber(source);
    for (let o=0; o<c; o++) {
      this.halfEdges[4*i+3] = destination;
      // reset face vertices because of new vertex
      this.setFace(this.halfEdges[4*i], i);
      const next = this.halfEdges[4*i+2];
      i = this.getTwinHalfEdge(next);
    }
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

    this.triangles.mesh.indices = new Uint32Array(3*this.triangles.maxCount);

    for (let i=0; i<this.halfEdges.length/4; i++) {

      const j = this.halfEdges[4*i+2];
      const k = this.halfEdges[4*j+2];

      if (i < j && i < k) {
        this.setFace(f, i);
        f++;
      }
    }
    this.triangles.count = f;
  }

  addVertex(rodIndex:number) {

    let l;
    const addedRodIndices = new Uint32Array(3);
    for (let o=0; o<3; o++) {
      l = this.rods.count;
      addedRodIndices[o] = l;
      this.createRod(l);
      this.compute.setRodsBuffer(l, this.rods.data.slice(q*l,q*l+q));
      this.rods.count++;
    }

    const addedBallIndex = this.balls.count;
    this.balls.count++;
    
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

    this.vertexHalfEdgeMap[addedBallIndex] = ac;
    
    l = this.halfEdges[4*nb+3];
    this.changeCoordinationNumberAndColor(l, 1);
    const vertexB = l;
    
    l = this.halfEdges[4*nd+3];
    this.changeCoordinationNumberAndColor(l, 1);
    const vertexD = l;

    l = addedBallIndex;
    this.createBall(l);
    this.setCoordinationNumber(l, 4);
    this.setBallColor(l, this.connectionsToColor(4));
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
    
    return [vertexB, vertexD];
  }

  flipEdge(rodIndex:number) {
    const ac = 2*rodIndex;
    const ca = ac+1;
    const ab = this.halfEdges[4*ca+2];
    const bc = this.halfEdges[4*ca+1];
    const cd = this.halfEdges[4*ac+2];
    const da = this.halfEdges[4*ac+1];

    const vertexA = this.halfEdges[4*da+3];
    const vertexB = this.halfEdges[4*ab+3];
    const vertexC = this.halfEdges[4*bc+3];
    const vertexD = this.halfEdges[4*cd+3];

    // check if a tetrahedron would be formed
    if (this.getCoordinationNumber(vertexA) < 5 ||
        this.getCoordinationNumber(vertexC) < 5 ) return 1;

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
    this.halfEdges[4*ca+3] = vertexB;
    this.halfEdges[4*ac+3] = vertexD;
    this.vertexHalfEdgeMap[vertexA] = da;
    this.vertexHalfEdgeMap[vertexB] = ab;
    this.vertexHalfEdgeMap[vertexC] = bc;
    this.vertexHalfEdgeMap[vertexD] = cd;
    this.changeCoordinationNumberAndColor(vertexA, -1);
    this.changeCoordinationNumberAndColor(vertexB,  1);
    this.changeCoordinationNumberAndColor(vertexC, -1);
    this.changeCoordinationNumberAndColor(vertexD,  1);

    // faces
    this.setFace(this.halfEdges[4*ab], ab);
    this.setFace(this.halfEdges[4*cd], cd);

    this.compute.setTriangleIndexBuffer(this.triangles.mesh.indices);
    this.compute.setHalfEdgeBuffer(this.halfEdges);

    return 0;
  }

  async collapseEdge(rodIndex:number) {
    
    // octahedron is smallest possible shape
    if (this.triangles.count < 9) return 1;

    const ac = 2*rodIndex;
    const ca = ac+1;
    const ab = this.halfEdges[4*ca+2];
    const bc = this.halfEdges[4*ca+1];
    const cd = this.halfEdges[4*ac+2];
    const da = this.halfEdges[4*ac+1];
    const ba = this.getTwinHalfEdge(ab);
    const cb = this.getTwinHalfEdge(bc);
    const dc = this.getTwinHalfEdge(cd);
    const ad = this.getTwinHalfEdge(da);

    // vertex
    let vertexA = this.halfEdges[4*da+3];
    let vertexB = this.halfEdges[4*ab+3];
    let vertexC = this.halfEdges[4*ac+3];
    let vertexD = this.halfEdges[4*ad+3];
    
    // check if a tetrahedron would be formed
    if (this.getCoordinationNumber(vertexB) < 5 ||
        this.getCoordinationNumber(vertexD) < 5 ) return 1;
    
    const faceABC = this.halfEdges[4*ab];
    const faceACD = this.halfEdges[4*da];

    // edges
    let vertexACoordinationNumberDifference = -1;
    let i = dc;
    this.halfEdges[4*i+3] = vertexA;
    let next = this.halfEdges[4*i+2];
    const coordinationNumberVertexC = this.getCoordinationNumber(vertexC);
    const cToAEdgeList = [];
    for (let o=0; o<coordinationNumberVertexC-3; o++) {
      i = this.getTwinHalfEdge(next);
      cToAEdgeList.push(i);
      this.halfEdges[4*i+3] = vertexA;
      vertexACoordinationNumberDifference++;
      next = this.halfEdges[4*i+2];
    }
    this.copyHalfEdge(dc, da);
    this.copyHalfEdge(cb, ab);

    this.vertexHalfEdgeMap[vertexA] = ba;
    this.vertexHalfEdgeMap[vertexB] = ab;
    this.vertexHalfEdgeMap[vertexD] = ad;

    // edges memory relocation
    const removableRodList = [];
    for (const halfEdge of [dc, cb, ac])
      removableRodList.push(this.getRodIndex(halfEdge));
    removableRodList.sort((a,b)=>a-b);
    for (let o=0; o<3; o++) {
      const x = removableRodList.pop() as number;
      const last = this.rods.count-1;
      // if last is in cToAEdgeList then replace it
      for (let u=0; u<2; u++)
        if (cToAEdgeList.includes(2*last+u) )
          cToAEdgeList[cToAEdgeList.indexOf(2*last+u)] = 2*x+u;
      this.moveRod(last, x);
      this.rods.count--;
    }
    
    this.changeCoordinationNumberAndColor(vertexA, vertexACoordinationNumberDifference);
    this.changeCoordinationNumberAndColor(vertexB, -1);
    this.changeCoordinationNumberAndColor(vertexD, -1);

    // vertex memory relocation (remove vertexC)
    let l = this.balls.count-1;
    if (l !== vertexC) {
      // the following routine needs the correct coordination number
      this.redirectVertex(l, vertexC);
      const p = (await this.compute.getBuffer('balls')).slice(q*l,q*l+3);
      this.balls.data.set(p, q*l);
      this.balls.data.set(this.balls.data.slice(q*l,q*l+q), q*vertexC);
      this.compute.setBallsBuffer(vertexC, this.balls.data.slice(q*l,q*l+q));
      if (l === vertexA) {
        vertexA = vertexC;
        this.halfEdges[4*da+3] = vertexA;
      }
      if (l === vertexB) vertexB = vertexC;
      if (l === vertexD) vertexD = vertexC;
    }
    this.balls.count--;
    
    // faces
    cToAEdgeList.push(da);
    for (let o=0; o<coordinationNumberVertexC-2; o++) {
      const e = cToAEdgeList.pop() as number;
      this.setFace(this.halfEdges[4*e], e);
    }
    
    // faces memory relocation
    const removableFaceList = [faceABC, faceACD];
    removableFaceList.sort((a,b)=>a-b);
    for (let o=0; o<2; o++) {
      let f = removableFaceList.pop() as number;
      let lastFace = this.triangles.count-1;
      if (f !== lastFace)
        this.setFace(f, this.faceHalfEdgeMap[lastFace]);
      this.triangles.count--;
    }

    this.compute.setHalfEdgeBuffer(this.halfEdges);
    this.compute.setTriangleIndexBuffer(this.triangles.mesh.indices);
    this.compute.setCount(this.balls.count, this.rods.count, this.triangles.count);
    
    return 0;
  }

  async saveData() {
    const intCount = this.rods.count*8;
    const floatCount = this.balls.count*3;

    // vertex positions
    const b = await this.compute.getBuffer('balls');
    const p = new Float32Array(floatCount);
    for (let i=0; i<this.balls.count; i++)
      p.set(b.slice(q*i,q*i+3),3*i);
    
    const buffy = new Uint32Array(1+intCount+floatCount);
    const floatView = new Float32Array(buffy.buffer);

    buffy.set([intCount]);
    buffy.set(this.halfEdges.slice(0,intCount), 1);
    floatView.set(p, 1+intCount);
    
    saveBinary(buffy, 'new_deltahedra_data');

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

  showAllRods = () => {
    for (let i=0; i<this.rods.count; i++) {
      const offset = i * q;
      this.rods.data.set([1], offset+3); // size
      this.compute.setRodsBuffer(i, this.rods.data.slice(q*i,q*i+q));
    }
  }
  
  showOnlyIsoRods = () => {
    for (let i=0; i<this.rods.count; i++) {
      const ac = 2*i;
      const ca = ac+1;
      const vertexA = this.halfEdges[4*ca+3];
      const vertexC = this.halfEdges[4*ac+3];
      const offset = i * q;
      if (this.getCoordinationNumber(vertexA) === this.getCoordinationNumber(vertexC))
        this.rods.data.set([1], offset+3); // size
      else
        this.rods.data.set([0], offset+3); // size
      this.compute.setRodsBuffer(i, this.rods.data.slice(q*i,q*i+q));
    }
  }

  getCoordinationNumberCount = () => {
    const count = new Uint32Array(16);
    for (let i=0; i<this.balls.count; i++) {
      const c = this.getCoordinationNumber(i);
      count[c] += 1;
    }
    return count;
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

  //   // color
  //   this.changeCoordinationNumberAndColor(this.halfEdges[4*ac+3], -1);
  //   this.changeCoordinationNumberAndColor(this.halfEdges[4*ca+3], -1);

  //   this.compute.setHalfEdgeBuffer(this.halfEdges);
  // }

  // bam() {
  //   const a = [4,15];
  //   for (let i=0; i<a.length; i++) {
  //     const j = a[i];
  //     this.balls.data.set([0.1*(0.5-Math.random()),0.1*(0.5-Math.random()),0.1*(0.5-Math.random())], q*j);
  //     this.compute.setBallsBuffer(j, this.balls.data.slice(q*j,q*j+q));
  //   }
  // }
}