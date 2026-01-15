import { q } from './ballPark'
import { Compute, F32Arr, U32Arr } from './compute'
import { colorArray } from './display'
import { exportSTL, saveBinary } from './io'
import { Mesh, MeshBuffers, cylinderMesh, icoSphereMesh } from './mesh'

export interface Object {
  data: F32Arr
  buffer?: GPUBuffer // holds data for individual instances
  mesh: Mesh
  isInstancedMesh: boolean
  meshBuffers?: MeshBuffers // optional for individual triangles
  visible: boolean
  count: number
  maxCount: number
}

const twin = (i: number): number => i ^ 1

const face = (h: U32Arr, i: number): number => h[4 * i]
const next = (h: U32Arr, i: number): number => h[4 * i + 1]
const prev = (h: U32Arr, i: number): number => h[4 * i + 2]
const vert = (h: U32Arr, i: number): number => h[4 * i + 3]

const setFace = (h: U32Arr, i: number, j: number) => (h[4 * i] = j)
const setNext = (h: U32Arr, i: number, j: number) => (h[4 * i + 1] = j)
const setPrev = (h: U32Arr, i: number, j: number) => (h[4 * i + 2] = j)
const setVert = (h: U32Arr, i: number, j: number) => (h[4 * i + 3] = j)

export class Structure {
  private balls: Object
  private rods: Object
  private triangles: Object
  private halfEdges: U32Arr
  private faceHalfEdgeMap: U32Arr
  private vertexHalfEdgeMap: U32Arr

  private ballRadius: number
  private cylinderRadius: number
  private cylinderLength: number

  private compute: Compute

  rodBaseColor = [0.5, 0.5, 0.5]
  rodHighlightColor = [1, 0.7, 1]

  triangleColor = [0.8, 0.7, 0.5]
  // triangleColor = [.7, .7, .7];

  ballGlossyness = 0.2

  allowTetrahedra = false

  constructor(
    maxVertexCount: number,
    maxEdgeCount: number,
    maxFaceCount: number,
    ballRadius: number,
    cylinderRadius: number,
    cylinderLength: number,
    compute: Compute
  ) {
    this.compute = compute

    this.ballRadius = ballRadius
    this.cylinderRadius = cylinderRadius
    this.cylinderLength = cylinderLength

    this.halfEdges = new Uint32Array(8 * maxEdgeCount)
    this.faceHalfEdgeMap = new Uint32Array(maxFaceCount)
    this.vertexHalfEdgeMap = new Uint32Array(maxVertexCount)

    this.balls = {
      data: new Float32Array(maxVertexCount * q),
      mesh: icoSphereMesh(this.ballRadius, 4),
      isInstancedMesh: true,
      visible: false,
      count: 0,
      maxCount: maxVertexCount,
    }

    this.rods = {
      data: new Float32Array(maxEdgeCount * q),
      mesh: cylinderMesh(32, this.cylinderRadius, this.cylinderLength / 2, true),
      isInstancedMesh: true,
      visible: false,
      count: 0,
      maxCount: maxEdgeCount,
    }

    this.triangles = {
      data: new Float32Array(q),
      mesh: {
        vertices: new Float32Array(),
        normals: new Float32Array(),
        indices: new Uint32Array(),
      },
      isInstancedMesh: false,
      visible: false,
      count: 0,
      maxCount: maxFaceCount,
    }
  }

  init(halfEdgesInit: U32Arr, vertexPositions?: F32Arr) {
    this.halfEdges = new Uint32Array(this.halfEdges.length)
    this.halfEdges.set(halfEdgesInit)

    this.faceHalfEdgeMap = new Uint32Array(this.faceHalfEdgeMap.length)
    this.vertexHalfEdgeMap = new Uint32Array(this.vertexHalfEdgeMap.length)

    this.balls.data = new Float32Array(this.balls.maxCount * q)

    this.balls.count = this.vertexCount(halfEdgesInit)
    this.rods.count = halfEdgesInit.length / 8

    const p = new Float32Array(3 * this.balls.count)
    if (vertexPositions === undefined)
      for (let i = 0; i < p.length; i++) p[i] = 2 * (0.5 - Math.random())
    else p.set(vertexPositions)

    for (let i = 0; i < this.balls.count; i++) {
      this.createBall(i, p.slice(3 * i, 3 * i + 3))
      const coordinationNumber = this.vertexCoordinationCount(halfEdgesInit, i)
      this.setCoordinationNumber(i, coordinationNumber)
      this.setBallColor(i, this.connectionsToColor(coordinationNumber))
    }

    for (let i = 0; i < this.rods.count; i++) this.createRod(i)

    this.faceInit()

    this.triangles.data.set([1], 3) // size
    this.triangles.data.set(this.triangleColor, 8) // color
    // this.triangles.data.set([1], 11); // mass
    // this.triangles.data.set([this.triangles.count], 21); // triangleCount

    return [this.balls, this.rods, this.triangles, this.halfEdges] as [
      Object,
      Object,
      Object,
      U32Arr,
    ]
  }

  createBall(index: number, position?: F32Arr) {
    const offset = index * q

    if (position !== undefined) this.balls.data.set(position, offset)
    this.balls.data.set([1], offset + 3) // size
    this.balls.data.set([this.ballRadius], offset + 16) // prop1
    this.setBallGlossyness(index, this.ballGlossyness)
  }

  createRod(index: number) {
    const offset = index * q

    this.rods.data.set([1], offset + 3) // size
    this.rods.data.set(this.rodBaseColor, offset + 8) // color
    this.rods.data.set([1], offset + 11) // alpha
    this.rods.data.set([this.cylinderRadius], offset + 16) // prop1
    this.rods.data.set([this.cylinderLength], offset + 17) // prop2
  }

  setBallColor(index: number, color: Array<number>) {
    this.balls.data.set(color, index * q + 8)
    this.balls.data.set([1], index * q + 11) // alpha
  }

  setBallGlossyness(index: number, glossyness: number) {
    this.balls.data.set([glossyness], index * q + 20)
  }

  setCoordinationNumber(index: number, coordinationNumber: number) {
    this.balls.data.set([coordinationNumber], index * q + 19) // prop4
  }

  getCoordinationNumber(index: number) {
    return this.balls.data[index * q + 19] // prop4
  }

  connectionsToColor(coordinationNumber: number) {
    if (!this.allowTetrahedra && coordinationNumber < 4) throw new Error('coordination number < 4')
    else if (coordinationNumber == 3) return [0.1, 0.1, 0.1]
    else if (coordinationNumber > 10) return colorArray[7]
    else return colorArray[coordinationNumber - 4]
  }

  vertexCoordinationCount(halfEdges: U32Arr, vertexIndex: number) {
    let count = 0
    for (let i = 0; i < halfEdges.length / 4; ++i) {
      const index = halfEdges[4 * i + 3]
      if (index === vertexIndex) {
        if (count === 0) this.vertexHalfEdgeMap[vertexIndex] = i
        count++
      }
    }
    return count
  }

  changeCoordinationNumberAndColor(index: number, diff: number) {
    let prevCoordinationNumber = this.getCoordinationNumber(index)
    this.setCoordinationNumber(index, prevCoordinationNumber + diff)
    this.setBallColor(index, this.connectionsToColor(prevCoordinationNumber + diff))
    this.compute.setBallsBuffer(index, this.balls.data.slice(q * index, q * index + q), false)
  }

  changeRodColor(index: number, color: Array<number>) {
    this.rods.data.set(color, index * q + 8)
    this.compute.setRodsBufferColor(index, this.rods.data.slice(q * index, q * index + q))
  }

  vertexCount(halfEdges: U32Arr) {
    let count = 0
    for (let i = 0; i < halfEdges.length / 4; ++i) {
      const index = halfEdges[4 * i + 3]
      if (index > count) count = index
    }
    return count + 1
  }

  copyHalfEdge(source: number, destination: number) {
    const h = this.halfEdges
    if (source !== destination) {
      h.set(h.slice(4 * source, 4 * source + 4), 4 * destination)
      setPrev(h, next(h, destination), destination)
      setNext(h, prev(h, destination), destination)
      this.vertexHalfEdgeMap[vert(h, destination)] = destination
      this.faceHalfEdgeMap[face(h, destination)] = destination
    }
  }

  moveRod(source: number, destination: number) {
    if (source !== destination) {
      let i = 2 * source
      let j = 2 * destination
      for (let o = 0; o < 2; o++) {
        this.copyHalfEdge(i, j)
        i++
        j++
      }
    }
  }

  redirectVertex(source: number, destination: number) {
    const h = this.halfEdges
    let i = this.vertexHalfEdgeMap[source]
    this.vertexHalfEdgeMap[destination] = i
    const c = this.getCoordinationNumber(source)
    for (let o = 0; o < c; o++) {
      setVert(h, i, destination)
      // reset face vertices because of new vertex
      this.setFace(face(h, i), i)
      const next = prev(h, i)
      i = twin(next)
    }
  }

  setFace(triangleIndex: number, i: number) {
    const h = this.halfEdges
    const l = triangleIndex
    const j = prev(h, i)
    const k = prev(h, j)
    setFace(h, i, l)
    setFace(h, j, l)
    setFace(h, k, l)
    this.triangles.mesh.indices[3 * l] = vert(h, i)
    this.triangles.mesh.indices[3 * l + 1] = vert(h, j)
    this.triangles.mesh.indices[3 * l + 2] = vert(h, k)

    this.faceHalfEdgeMap[l] = i
  }

  faceInit() {
    let f = 0 // face count

    this.triangles.mesh.indices = new Uint32Array(3 * this.triangles.maxCount)

    for (let i = 0; i < this.halfEdges.length / 4; i++) {
      const j = this.halfEdges[4 * i + 2]
      const k = this.halfEdges[4 * j + 2]

      if (i < j && i < k) {
        this.setFace(f, i)
        f++
      }
    }
    this.triangles.count = f
  }

  addVertex(rodIndex: number) {
    const h = this.halfEdges

    let l
    const addedRodIndices = new Uint32Array(3)
    for (let o = 0; o < 3; o++) {
      l = this.rods.count
      addedRodIndices[o] = l
      this.createRod(l)
      this.compute.setRodsBuffer(l, this.rods.data.slice(q * l, q * l + q))
      this.rods.count++
    }

    const addedBallIndex = this.balls.count
    this.balls.count++

    const ac = 2 * rodIndex
    const bn = 2 * addedRodIndices[0]
    const cn = 2 * addedRodIndices[1]
    const dn = 2 * addedRodIndices[2]
    const ca = ac + 1
    const nb = bn + 1
    const nc = cn + 1
    const nd = dn + 1
    const ab = prev(h, ca)
    const bc = next(h, ca)
    const cd = prev(h, ac)
    const da = next(h, ac)
    // B
    setFace(h, bn, nb)
    setNext(h, bn, ab)
    setPrev(h, bn, ca)
    setVert(h, bn, addedBallIndex)
    setFace(h, nb, bn)
    setNext(h, nb, cn)
    setPrev(h, nb, bc)
    setVert(h, nb, vert(h, ab))
    // C
    setFace(h, cn, nc)
    setNext(h, cn, bc)
    setPrev(h, cn, nb)
    setVert(h, cn, addedBallIndex)
    setFace(h, nc, cn)
    setNext(h, nc, dn)
    setPrev(h, nc, cd)
    setVert(h, nc, vert(h, ac))
    // D
    setFace(h, dn, nd)
    setNext(h, dn, cd)
    setPrev(h, dn, nc)
    setVert(h, dn, addedBallIndex)
    setFace(h, nd, dn)
    setNext(h, nd, ac)
    setPrev(h, nd, da)
    setVert(h, nd, vert(h, cd))
    // surrounding edges
    setPrev(h, ab, bn)
    setNext(h, bc, nb)
    setPrev(h, bc, cn)
    setNext(h, cd, nc)
    setPrev(h, cd, dn)
    setNext(h, da, nd)
    // A
    setPrev(h, ac, nd)
    setVert(h, ac, addedBallIndex)
    setNext(h, ca, bn)

    this.vertexHalfEdgeMap[addedBallIndex] = ac

    l = vert(h, nb)
    this.changeCoordinationNumberAndColor(l, 1)
    const vertexB = l

    l = vert(h, nd)
    this.changeCoordinationNumberAndColor(l, 1)
    const vertexD = l

    l = addedBallIndex
    this.createBall(l)
    this.setCoordinationNumber(l, 4)
    this.setBallColor(l, this.connectionsToColor(4))
    this.compute.setBallsBuffer(l, this.balls.data.slice(q * l, q * l + q), false)

    // faces
    this.setFace(face(h, ab), ab) // old faces
    this.setFace(face(h, da), da)
    this.setFace(this.triangles.count, bc) // new faces
    this.triangles.count++
    this.setFace(this.triangles.count, cd)
    this.triangles.count++

    this.compute.setTriangleIndexBuffer(this.triangles.mesh.indices)
    this.compute.setHalfEdgeBuffer(h)
    this.compute.setCount(this.balls.count, this.rods.count, this.triangles.count)

    return [vertexB, vertexD]
  }

  flipEdge(rodIndex: number) {
    const h = this.halfEdges

    const ac = 2 * rodIndex
    const ca = ac + 1
    const ab = prev(h, ca)
    const bc = next(h, ca)
    const cd = prev(h, ac)
    const da = next(h, ac)

    const vertexA = vert(h, da)
    const vertexB = vert(h, ab)
    const vertexC = vert(h, bc)
    const vertexD = vert(h, cd)

    // check if a tetrahedron would be formed
    if (!this.allowTetrahedra) {
      if (this.getCoordinationNumber(vertexA) < 5 || this.getCoordinationNumber(vertexC) < 5)
        return 1
    } else if (this.getCoordinationNumber(vertexA) < 4 || this.getCoordinationNumber(vertexC) < 4)
      return 2

    setNext(h, ab, da)
    setPrev(h, ab, ac)
    setNext(h, bc, ca)
    setPrev(h, bc, cd)
    setNext(h, cd, bc)
    setPrev(h, cd, ca)
    setNext(h, da, ac)
    setPrev(h, da, ab)

    setNext(h, ac, ab)
    setPrev(h, ac, da)
    setNext(h, ca, cd)
    setPrev(h, ca, bc)

    // vertex pointer
    setVert(h, ca, vertexB)
    setVert(h, ac, vertexD)
    this.vertexHalfEdgeMap[vertexA] = da
    this.vertexHalfEdgeMap[vertexB] = ab
    this.vertexHalfEdgeMap[vertexC] = bc
    this.vertexHalfEdgeMap[vertexD] = cd
    this.changeCoordinationNumberAndColor(vertexA, -1)
    this.changeCoordinationNumberAndColor(vertexB, 1)
    this.changeCoordinationNumberAndColor(vertexC, -1)
    this.changeCoordinationNumberAndColor(vertexD, 1)

    // faces
    this.setFace(face(h, ab), ab)
    this.setFace(face(h, cd), cd)

    this.compute.setTriangleIndexBuffer(this.triangles.mesh.indices)
    this.compute.setHalfEdgeBuffer(h)

    return 0
  }

  async collapseEdge(rodIndex: number) {
    const h = this.halfEdges

    // octahedron is smallest possible shape
    if (!this.allowTetrahedra && this.triangles.count < 9) return 1
    if (this.triangles.count < 5) return 2

    const ac = 2 * rodIndex
    const ca = ac + 1
    const ab = prev(h, ca)
    const bc = next(h, ca)
    const cd = prev(h, ac)
    const da = next(h, ac)
    const ba = twin(ab)
    const cb = twin(bc)
    const dc = twin(cd)
    const ad = twin(da)

    // vertex
    let vertexA = vert(h, da)
    let vertexB = vert(h, ab)
    let vertexC = vert(h, ac)
    let vertexD = vert(h, ad)

    // check if a tetrahedron would be formed
    if (!this.allowTetrahedra)
      if (this.getCoordinationNumber(vertexB) < 5 || this.getCoordinationNumber(vertexD) < 5)
        return 1

    const faceABC = face(h, ab)
    const faceACD = face(h, da)

    // TOPOLOGY UPDATES _______________________________________________________
    // Perform all connectivity changes first

    // edges
    let vertexACoordinationNumberDifference = -1
    let i = dc
    setVert(h, i, vertexA)
    let nex = prev(h, i)
    const coordinationNumberVertexC = this.getCoordinationNumber(vertexC)
    const cToAEdgeList = []

    // Redirect all edges from C to A
    for (let o = 0; o < coordinationNumberVertexC - 3; o++) {
      i = twin(nex)
      cToAEdgeList.push(i)
      setVert(h, i, vertexA)
      vertexACoordinationNumberDifference++
      nex = prev(h, i)
    }

    // Stitch the hole by copying outer edge data to inner edges
    this.copyHalfEdge(dc, da)
    this.copyHalfEdge(cb, ab)

    this.vertexHalfEdgeMap[vertexA] = ba
    this.vertexHalfEdgeMap[vertexB] = ab
    this.vertexHalfEdgeMap[vertexD] = ad

    this.changeCoordinationNumberAndColor(vertexA, vertexACoordinationNumberDifference)
    this.changeCoordinationNumberAndColor(vertexB, -1)
    this.changeCoordinationNumberAndColor(vertexD, -1)

    // MEMORY RELOCATION ______________________________________________________
    // Compact arrays by moving last elements into gaps

    // 1. RODS (EDGES) RELOCATION
    const removableRodList = []
    for (const halfEdge of [dc, cb, ac]) removableRodList.push(halfEdge >> 1)
    removableRodList.sort((a, b) => a - b)

    for (let o = 0; o < 3; o++) {
      const x = removableRodList.pop() as number
      const last = this.rods.count - 1

      // Update tracking list if the 'last' rod is one we are tracking for face updates
      // (i.e. if last is in cToAEdgeList then replace it)
      for (let u = 0; u < 2; u++)
        if (cToAEdgeList.includes(2 * last + u))
          cToAEdgeList[cToAEdgeList.indexOf(2 * last + u)] = 2 * x + u

      this.moveRod(last, x)
      this.rods.count--
    }

    // 2. VERTICES RELOCATION (remove vertexC)
    let l = this.balls.count - 1
    if (l !== vertexC) {
      this.redirectVertex(l, vertexC)

      const p = (await this.compute.getBuffer('balls')).slice(q * l, q * l + 3)
      this.balls.data.set(p, q * l) // Update CPU buffer with latest position from GPU
      this.balls.data.set(this.balls.data.slice(q * l, q * l + q), q * vertexC)
      this.compute.setBallsBuffer(vertexC, this.balls.data.slice(q * l, q * l + q))

      // Update local variables if they refer to the vertex that was just moved
      if (l === vertexA) {
        vertexA = vertexC
        setVert(h, da, vertexA)
      }
      if (l === vertexB) vertexB = vertexC
      if (l === vertexD) vertexD = vertexC
    }
    this.balls.count--

    // 3. FACE UPDATES & RELOCATION
    // Finish topology updates for faces (using final edge indices)
    cToAEdgeList.push(da)
    for (let o = 0; o < coordinationNumberVertexC - 2; o++) {
      const e = cToAEdgeList.pop() as number
      this.setFace(face(h, e), e)
    }

    // faces memory relocation
    const removableFaceList = [faceABC, faceACD]
    removableFaceList.sort((a, b) => a - b)
    for (let o = 0; o < 2; o++) {
      let f = removableFaceList.pop() as number
      let lastFace = this.triangles.count - 1
      if (f !== lastFace) this.setFace(f, this.faceHalfEdgeMap[lastFace])
      this.triangles.count--
    }

    this.compute.setHalfEdgeBuffer(h)
    this.compute.setTriangleIndexBuffer(this.triangles.mesh.indices)
    this.compute.setCount(this.balls.count, this.rods.count, this.triangles.count)

    return 0
  }

  async saveData() {
    const intCount = this.rods.count * 8
    const floatCount = this.balls.count * 3

    // vertex positions
    const b = await this.compute.getBuffer('balls')
    const p = new Float32Array(floatCount)
    for (let i = 0; i < this.balls.count; i++) p.set(b.slice(q * i, q * i + 3), 3 * i)

    const buffy = new Uint32Array(1 + intCount + floatCount)
    const floatView = new Float32Array(buffy.buffer)

    buffy.set([intCount])
    buffy.set(this.halfEdges.slice(0, intCount), 1)
    floatView.set(p, 1 + intCount)

    saveBinary(buffy, 'new_deltahedra_data')

    console.log(this.rods.count + ' edges and ' + this.balls.count + ' vertices saved to file.')
  }

  async exportSTL() {
    const v = await this.compute.getBuffer('triangles')
    exportSTL(v.slice(0, 9 * this.triangles.count))
    console.log(this.triangles.count + ' triangles exported.')
  }

  showFaces = (show: boolean) => {
    this.triangles.visible = show
    this.compute.setTrianglesVisibility(show)
  }

  showRods = (show: boolean) => {
    this.rods.visible = show
    this.compute.setRodsVisibility(show)
  }

  showBalls = (show: boolean) => {
    this.balls.visible = show
    this.compute.setBallsVisibility(show)
  }

  showAllRods = () => {
    for (let i = 0; i < this.rods.count; i++) {
      const offset = i * q
      this.rods.data.set([1], offset + 3) // size
      this.compute.setRodsBuffer(i, this.rods.data.slice(q * i, q * i + q))
    }
  }

  showOnlyIsoRods = () => {
    for (let i = 0; i < this.rods.count; i++) {
      const ac = 2 * i
      const ca = ac + 1
      const vertexA = vert(this.halfEdges, ca)
      const vertexC = vert(this.halfEdges, ac)
      const offset = i * q
      if (this.getCoordinationNumber(vertexA) === this.getCoordinationNumber(vertexC))
        this.rods.data.set([1], offset + 3) // size
      else this.rods.data.set([0], offset + 3) // size
      this.compute.setRodsBuffer(i, this.rods.data.slice(q * i, q * i + q))
    }
  }

  getCoordinationNumberCount = () => {
    const count = new Uint32Array(16)
    for (let i = 0; i < this.balls.count; i++) {
      const c = this.getCoordinationNumber(i)
      count[c] += 1
    }
    return count
  }
}
