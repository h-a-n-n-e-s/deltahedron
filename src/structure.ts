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
      const coordinationNumber = this.vertexEdgeCount(halfEdgesInit, i);
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

  getRodIndex = (halfEdgeIndex:number) =>
    halfEdgeIndex%2 === 0 ? halfEdgeIndex/2 : (halfEdgeIndex-1)/2;

  getTwinHalfEdge = (index:number) =>
    index%2 === 0 ? index + 1 : index - 1;

  copyHalfEdge = (sourceIndex:number, targetIndex:number) => {
    if (sourceIndex !== targetIndex)
      this.halfEdges.set(
        this.halfEdges.slice(4*sourceIndex, 4*sourceIndex+4),
        4*targetIndex
      );
  }

  moveWholeEdge = (sourceIndex:number, targetIndex:number) => {
    const a = 2*sourceIndex;
    const b = a + 1;
    const c = 2*targetIndex;
    const d = c + 1;
    this.copyHalfEdge(a, c);
    this.copyHalfEdge(b, d);
    this.halfEdges[4*this.halfEdges[4*c+1]+2] = c;
    this.halfEdges[4*this.halfEdges[4*c+2]+1] = c;
    this.halfEdges[4*this.halfEdges[4*d+1]+2] = d;
    this.halfEdges[4*this.halfEdges[4*d+2]+1] = d;
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

  setFace(triangleIndex:number, i:number, j:number, k:number) {
    const l = triangleIndex;
    this.halfEdges[4*i] = l;
    this.halfEdges[4*j] = l;
    this.halfEdges[4*k] = l;
    this.triangles.mesh.indices[3*l] = this.halfEdges[4*i+3];
    this.triangles.mesh.indices[3*l+1] = this.halfEdges[4*j+3];
    this.triangles.mesh.indices[3*l+2] = this.halfEdges[4*k+3];
  }

  faceInit() {

    let f = 0; // face count

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

        f++;
      }
    }

    this.triangles.count = f;
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
    const ab = this.halfEdges[4*ca+2];
    const bc = this.halfEdges[4*ca+1];
    const cd = this.halfEdges[4*ac+2];
    const da = this.halfEdges[4*ac+1];
    // B
    this.halfEdges[4*bn] = nb;
    this.halfEdges[4*bn+1] = ab;
    this.halfEdges[4*bn+2] = ca;
    this.halfEdges[4*bn+3] = this.balls.count; // new vertex index
    this.halfEdges[4*nb] = bn;
    this.halfEdges[4*nb+1] = cn;
    this.halfEdges[4*nb+2] = bc;
    this.halfEdges[4*nb+3] = this.halfEdges[4*ab+3];
    // C
    this.halfEdges[4*cn] = nc;
    this.halfEdges[4*cn+1] = bc;
    this.halfEdges[4*cn+2] = nb;
    this.halfEdges[4*cn+3] = this.balls.count;
    this.halfEdges[4*nc] = cn;
    this.halfEdges[4*nc+1] = dn;
    this.halfEdges[4*nc+2] = cd;
    this.halfEdges[4*nc+3] = this.halfEdges[4*ac+3];
    // D
    this.halfEdges[4*dn] = nd;
    this.halfEdges[4*dn+1] = cd;
    this.halfEdges[4*dn+2] = nc;
    this.halfEdges[4*dn+3] = this.balls.count;
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
    const vertexB = l;
    
    l = this.halfEdges[4*nd+3];
    this.changeCoordinationNumberAndColor(l, 1);
    const vertexD = l;

    l = this.balls.count;
    this.createBall(l, this.rods.data.slice(rodIndex*q,rodIndex*q+3));
    this.setCoordinationNumber(l, 4);
    this.setColor(l, this.connectionsToColor(4));
    this.compute.setBallsBuffer(l, this.balls.data.slice(q*l,q*l+q));
    this.balls.count++;

    // faces
    this.setFace(this.halfEdges[4*ab], ab, bn, ca); // old faces
    this.setFace(this.halfEdges[4*da], da, ac, nd);
    this.setFace(this.triangles.count, bc, cn, nb); // new faces
    this.triangles.count++;
    this.setFace(this.triangles.count, cd, dn, nc);
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
    this.halfEdges[4*ac+3] = this.halfEdges[4*cd+3];
    this.halfEdges[4*ca+3] = this.halfEdges[4*ab+3];

    // color
    this.changeCoordinationNumberAndColor(this.halfEdges[4*da+3], -1);
    this.changeCoordinationNumberAndColor(this.halfEdges[4*ab+3],  1);
    this.changeCoordinationNumberAndColor(this.halfEdges[4*bc+3], -1);
    this.changeCoordinationNumberAndColor(this.halfEdges[4*cd+3],  1);

    // faces
    this.setFace(this.halfEdges[4*ab], ab, ac, da);
    this.setFace(this.halfEdges[4*cd], cd, ca, bc);

    this.compute.setTriangleIndexBuffer(this.triangles.mesh.indices);
    this.compute.setHalfEdgeBuffer(this.halfEdges);
  }

  collapseEdge(rodIndex:number) {
    const ac = 2*rodIndex;
    const ca = ac+1;
    const ab = this.halfEdges[4*ca+2];
    const bc = this.halfEdges[4*ca+1];
    const cd = this.halfEdges[4*ac+2];
    const da = this.halfEdges[4*ac+1];
    // const ba = this.getTwinHalfEdge(ab);
    const cb = this.getTwinHalfEdge(bc);
    const dc = this.getTwinHalfEdge(cd);
    // const ad = this.getTwinHalfEdge(da);

    // reset vertex
    const vertexA = this.halfEdges[4*da+3];
    let i = dc;
    let j = -1;
    while (j !== cb) {
      this.halfEdges[4*i+3] = vertexA;
      j = this.halfEdges[4*i+2];
      i = this.getTwinHalfEdge(j);
    }
    // relocation in memory

    // reset edges
    this.copyHalfEdge(dc, da);
    this.copyHalfEdge(cb, ab);
    // relocation in memory
    this.moveWholeEdge(this.rods.count-1, this.getRodIndex(dc));
    this.rods.count--;
    this.moveWholeEdge(this.rods.count-1, this.getRodIndex(cb));
    this.rods.count--;
    this.moveWholeEdge(this.rods.count-1, this.getRodIndex(ac));
    this.rods.count--;


    // reset faces

    // color
    this.changeCoordinationNumberAndColor(this.halfEdges[4*cb+3], -1);
    this.changeCoordinationNumberAndColor(this.halfEdges[4*cd+3], -1);

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