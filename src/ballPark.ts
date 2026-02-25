import { Compute, F32Arr, OUT, U32Arr } from './compute'
import { Render } from './render'
import {
  octahedronHalfEdges,
  octahedronVertexPositions,
  tetrahedronHalfEdges,
  tetrahedronVertexPositions,
  torusHalfEdges,
  torusVertexPositions,
} from './mesh'
import { Camera } from './camera'
import { GeometryStatus, Structure } from './structure'
import { loadFromPublic, readFile } from './io'
import {
  ActivityIndicator,
  createOverlay,
  Info,
  tooltip,
  vertexCountToSummationFormula,
} from './display'
import { vec3 } from './algebra'

const QUANTIZE_FACTOR = 2097152
const SMALL_QUANTIZE_FACTOR = 65536 // smaller to allow larger volumes
export const q = 24 // scalar quantities per object in buffer

export class BallPark {
  cubemap = 'cubemap/oceansky2hdr'
  tex = 'textures/scratched_plastic'
  // tex = 'textures/metal';

  ballRadius = 0.1
  cylinderRadius = 0.04
  cylinderLength = 1

  timeStep = 0.05

  action = false

  freeze = false
  rotate = false
  showOnlyIsoRods = false

  maxEdgeCount = 1e4
  maxVertexCount = 1e4
  maxFaceCount = 1e4

  deltahedron!: Structure

  compute = new Compute()
  render = new Render()

  add = false
  flip = false
  collapse = false
  subdivide = false

  error = 0
  volume = 0
  distance = 0
  dihedralAngle = 0
  alertText = ''

  errorInfo = new Info('error')
  volumeInfo = new Info('volume')
  distanceInfo = new Info('distance')
  dihedralAngleInfo = new Info('dihedralAngle')
  alertInfo = new Info('alertInfo')
  FEVCountInfo = new Info('FEVCount')
  formulaInfo = new Info('formula')

  activityIndicator = new ActivityIndicator()

  subdivideOverlay!: HTMLDivElement

  setMouseSignalOnRelease!: (onRelease: boolean) => void

  async initialize(subdivideOverlay: HTMLDivElement) {
    this.subdivideOverlay = subdivideOverlay

    const camera = new Camera({
      arcRotateCamera: false, // if false uses simple endless rotation
      angleResolution: 3,
      radiusResolution: 1,
      azimuth: 0,
      inclination: 90,
      radius: 15,
      target: new Float32Array(3),
      zNear: 0.1,
      zFar: 1000,
      fieldOfViewAngle: (27 * Math.PI) / 180, // (approximately vertical angle of 50 mm full frame)
    })

    this.deltahedron = new Structure(
      this.maxVertexCount,
      this.maxEdgeCount,
      this.maxFaceCount,
      this.ballRadius,
      this.cylinderRadius,
      this.cylinderLength,
      this.compute
    )

    const [balls, rods, triangles, halfEdges] = this.deltahedron.init(
      octahedronHalfEdges,
      octahedronVertexPositions
    )

    const gpuDevice = await this.compute.initialize([balls, rods, triangles], this.timeStep)

    this.compute.setHalfEdgeBuffer(halfEdges)
    this.compute.setCount(balls.count, rods.count, triangles.count)

    this.compute.setBallsVisibility(balls.visible)
    this.compute.setBallsVisibility(rods.visible)
    this.compute.setTrianglesVisibility(triangles.visible)

    await this.render.init(
      gpuDevice,
      'canvas',
      camera,
      [balls, rods, triangles],
      this.cubemap,
      this.tex
    )

    // interaction

    camera.mouseInteraction(this.render.getCanvas())
    this.setMouseSignalOnRelease = camera.getSetMouseSignalOnRelease()

    // display ____________________________________________

    this.alertInfo.set = () => this.alertText

    this.errorInfo.set = () => (100 * this.error).toFixed(3) + '%'
    tooltip(this.errorInfo.div, -20, -30, 170, 'maximum distance error')

    this.dihedralAngleInfo.set = () => this.dihedralAngle.toFixed(3) + '°'
    tooltip(this.dihedralAngleInfo.div, -10, -30, 130, 'dihedral angle of last edge hovered')
    this.dihedralAngleInfo.update()

    this.distanceInfo.set = () => this.distance.toFixed(4)
    tooltip(this.distanceInfo.div, 0, -30, 120, 'distance between the last two clicked vertices')
    this.distanceInfo.update()

    this.volumeInfo.set = () => this.volume.toFixed(4)
    tooltip(this.volumeInfo.div, 30, -30, 50, 'volume')

    this.FEVCountInfo.set = () => {
      let string = 'F&emsp14;' + triangles.count.toFixed()
      string = string.concat('&nbsp; E&emsp14;' + rods.count.toFixed())
      string = string.concat('&nbsp; V&emsp14;' + balls.count.toFixed())
      return string
    }
    tooltip(
      this.FEVCountInfo.div,
      -40,
      50,
      230,
      'Number of faces (F), edges (E), and vertices (V).'
    )
    this.FEVCountInfo.update()

    this.formulaInfo.set = () => vertexCountToSummationFormula(this.deltahedron.getValenceArray())

    tooltip(
      this.formulaInfo.div,
      -120,
      200,
      430,
      'The formula summarizing how many different vertices are present in the deltahedron. A vertex is characterized by its valence, which equals the number of edges connected to it. The initials of greek numerals for 4 T (Tetra), 5 P (Penta), 6 H (Hexa), and latin numerals for 7 S (Sept), 8 O (Oct), 9 N (Nonus), 10 D (Deca) are used to identify the valence (for numbers larger than 10 B ("Big" or "Beyond" is used). For 3 Y is used since T (which could also be Tri) is already taken and the letter Y is also made of three lines meeting at a point. The subscripts equal the number of vertices for each vertex type. The colors correspond to the colors of the spheres representing the vertices.'
    )
    this.formulaInfo.update()

    let i = 0
    // let time = Date.now();
    const frameIntegration = 30
    // let slowmo = false;
    // let endSlowmo = false;

    let j = 0
    const actionFrames = 5

    let checkSelection = false
    let hoveringRod = -1 // index of rod mouse is currently hovering
    let hoveringBall = -1 // index of ball mouse is currently hovering
    let hoveringBallColor = [0, 0, 0]
    let prevVertexPos: F32Arr

    let initEdgeCount: number
    let initVertexCount: number
    let s = 0
    const flipList: Array<number> = []

    let lastError = 1
    let converged = false

    document.body.addEventListener('pointerdown', () => (this.action = true))
    document.body.addEventListener('pointermove', () => (this.action = true))

    const loop = async () => {
      if (!this.subdivide) {
        if (camera.mouseCoords.haveChanged || camera.mouseSignal) {
          camera.mouseCoords.haveChanged = false
          checkSelection = true
          this.compute.selectRodScanBranch('depthTest')
          this.compute.setMouseRayAndEye(camera.getMouseRay(), camera.getEye())
          this.alertText = ''
          this.alertInfo.update()
        }
      }

      // main computation and rendering _______________________________________
      if (this.subdivide || checkSelection || !converged || this.action || this.rotate) {
        const encoder = gpuDevice.createCommandEncoder()

        // if (!slowmo)
        this.compute.integration(encoder, balls.count, rods.count, triangles.count)

        this.render.render(camera, encoder)

        gpuDevice.queue.submit([encoder.finish()])
      }
      //_______________________________________________________________________

      if (this.rotate) camera.raiseAzimuth()

      if (checkSelection) {
        await this.compute.workDone() // wait for min distance
        this.compute.rodAndBallScan(rods.count, balls.count)
        const out = await this.compute.getOutBuffer() // get edge index
        const newhoveringRod = out[OUT.closestRodIndex]
        const newHoveringBall = out[OUT.closestBallIndex]

        // rod highlighting
        if (newhoveringRod !== hoveringRod) {
          if (hoveringRod !== -1)
            this.deltahedron.changeRodColor(hoveringRod, this.deltahedron.rodBaseColor)

          hoveringRod = newhoveringRod

          if (hoveringRod === -1) document.body.style.cursor = 'default'
          else {
            this.deltahedron.changeRodColor(hoveringRod, this.deltahedron.rodHighlightColor)
            document.body.style.cursor = 'pointer'
          }
        }

        // ball highlighting
        if (newHoveringBall !== hoveringBall) {
          if (hoveringBall !== -1) {
            this.deltahedron.changeBallColor(hoveringBall, hoveringBallColor)
          }

          hoveringBall = newHoveringBall

          if (hoveringBall === -1) document.body.style.cursor = 'default'
          else {
            hoveringBallColor = [...balls.data.slice(hoveringBall * q + 8, hoveringBall * q + 11)]
            const highlight = hoveringBallColor.map((v) => v + 0.1)
            this.deltahedron.changeBallColor(hoveringBall, highlight)
            document.body.style.cursor = 'pointer'
          }
        }

        this.dihedralAngle = out[OUT.dihedralAngle] / QUANTIZE_FACTOR
        this.dihedralAngleInfo.update()

        // basic edge operations
        if (hoveringRod !== -1 && camera.mouseSignal) {
          // edge selected

          let status = GeometryStatus.Valid

          if (this.add) this.deltahedron.addVertex(hoveringRod)
          else if (this.flip) status = this.deltahedron.flipEdge(hoveringRod)
          else if (this.collapse) status = await this.deltahedron.collapseEdge(hoveringRod)

          if (status !== GeometryStatus.Valid) {
            if (status === GeometryStatus.Tetrahedron)
              this.alertText = 'Tetrahedral corners are not allowed<br>(see settings).'
            if (status === GeometryStatus.LooseTriangle)
              this.alertText = 'Loose triangles are not allowed.'
            this.alertInfo.update()
          }
          if (this.showOnlyIsoRods) this.deltahedron.showOnlyIsoRods()
          this.FEVCountInfo.update()
          this.formulaInfo.update()

          // this.compute.setTimeAndSubStep(0.001, 1);
          // slowmo = true;
          // setTimeout(() => {endSlowmo = true;}, 1000);
        }

        // plot coords
        if (hoveringBall !== -1 && camera.mouseSignal) {
          const b = await this.compute.getBuffer('balls')
          const p = new Float32Array(3)
          p.set(b.slice(q * hoveringBall, q * hoveringBall + 3))

          if (prevVertexPos !== undefined) {
            this.distance = vec3.length(vec3.subtract(p, prevVertexPos))
            this.distanceInfo.update()
            prevVertexPos.set(p)
          } else prevVertexPos = new Float32Array(p)
        }

        checkSelection = false
        camera.mouseSignal = false
        this.compute.makeMouseCoordsOldNews()
      }

      if (this.subdivide) {
        if (s === 0) {
          initEdgeCount = rods.count
          initVertexCount = balls.count
          this.compute.selectRodScanBranch('nextBall')
        }
        if (s < initEdgeCount) {
          this.compute.setNewBallRodIndex(s)
          this.compute.rodAndBallScan(rods.count, balls.count)
          const [vB, vD] = this.deltahedron.addVertex(s)

          // check if opposing vertices are old ones
          // (means triangles have not been modified before)
          if (vB < initVertexCount) flipList.push(rods.count - 3)
          if (vD < initVertexCount) flipList.push(rods.count - 1)

          this.FEVCountInfo.update()
          this.formulaInfo.update()
          s++
        }
        if (s === initEdgeCount) {
          this.deltahedron.flipEdge(flipList.pop() as number)
          if (flipList.length === 0) {
            this.subdivide = false
            this.subdivideOverlay.style.display = 'none'
            s = 0
          }
        }
        if (this.showOnlyIsoRods) this.deltahedron.showOnlyIsoRods()
        this.formulaInfo.update()
      }

      // if (slowmo && endSlowmo) {
      //   this.compute.setTimeAndSubStep(0.05, 1);
      //   slowmo = false;
      //   endSlowmo = false;
      // }

      // calculate fps every frameIntegration frames
      i++
      if (i >= frameIntegration && !this.subdivide) {
        i = 0
        // const fps = frameIntegration * 1e3 / (Date.now() - time);
        // time = Date.now();
        // divFps.innerHTML = fps.toFixed() + ' fps';

        this.compute.selectRodScanBranch('maxError')
        this.compute.rodAndBallScan(rods.count, balls.count)
        await this.compute.workDone()
        const out = await this.compute.getOutBuffer()

        this.error = out[OUT.maxError] / QUANTIZE_FACTOR
        this.errorInfo.update()

        const errorVariation = lastError != 0 ? Math.abs(this.error / lastError - 1) : 0
        converged = errorVariation < 1e-6
        if (converged) this.activityIndicator.stop()
        else this.activityIndicator.run()
        lastError = this.error

        this.volume = out[OUT.volume] / SMALL_QUANTIZE_FACTOR
        this.volumeInfo.update()

        // console.log(out[OUT.centroidX], out[OUT.centroidY], out[OUT.centroidZ])

        this.compute.resetError()
      }

      if (this.action) j++
      if (j >= actionFrames) {
        j = 0
        this.action = false
        converged = false
      }

      requestAnimationFrame(loop)
    }
    requestAnimationFrame(loop)
  }

  setRepulsion(g: number) {
    this.compute.setRepulsion(g)
  }
  setHold(h: boolean) {
    this.freeze = h
  }
  setRotation(r: boolean) {
    this.rotate = r
  }

  showFaces(s: boolean) {
    this.deltahedron.showFaces(s)
  }
  showRods(s: boolean) {
    this.deltahedron.showRods(s)
  }
  showBalls(s: boolean) {
    this.deltahedron.showBalls(s)
  }

  setAllowTetrahedra(s: boolean) {
    this.deltahedron.allowTetrahedra = s
  }

  loadTetrahedron() {
    this.setStructure(tetrahedronHalfEdges, tetrahedronVertexPositions)
  }

  loadOctahedron() {
    this.setStructure(octahedronHalfEdges, octahedronVertexPositions)
  }

  loadTorus() {
    this.setStructure(torusHalfEdges(), torusVertexPositions)
  }

  setShowOnlyIsoRods(show: boolean) {
    this.showOnlyIsoRods = show
    if (this.showOnlyIsoRods) this.deltahedron.showOnlyIsoRods()
    else this.deltahedron.showAllRods()
  }

  addVertex(add: boolean) {
    this.add = add
  }
  flipEdges(flip: boolean) {
    this.flip = flip
  }
  collapseEdges(collapse: boolean) {
    this.collapse = collapse
  }
  startSubdivide(sub: boolean) {
    this.subdivide = sub
    this.subdivideOverlay.style.display = 'flex'
  }

  async saveData() {
    await this.deltahedron.saveData()
  }
  async exportSTL() {
    await this.deltahedron.exportSTL()
  }

  loadData = async () => {
    await readFile((data: ArrayBuffer) => {
      const [he, pos] = this.halfEdgesAndVertPos(data)
      this.setStructure(he, pos)
    })
  }

  loadDataFile = async (fileName: string) => {
    const overlay = createOverlay('loading...')
    overlay.style.display = 'flex'

    // files from public/data/...
    const path = `/data/${fileName}`

    await loadFromPublic(path, (data) => {
      const [he, pos] = this.halfEdgesAndVertPos(data)
      this.setStructure(he, pos)
      console.log(`File loaded from ${fileName}`)
    })

    overlay.remove()
  }

  setStructure = (heData: U32Arr, posData?: F32Arr) => {
    const [balls, rods, triangles, halfEdges] = this.deltahedron.init(heData, posData)

    this.compute.setCompleteBallsAndRodsBuffer(balls.data, rods.data)
    this.compute.setTriangleIndexBuffer(triangles.mesh.indices)
    this.compute.setHalfEdgeBuffer(halfEdges)
    this.compute.setCount(balls.count, rods.count, triangles.count)

    if (this.showOnlyIsoRods) this.deltahedron.showOnlyIsoRods()
    this.FEVCountInfo.update()
    this.formulaInfo.update()
  }

  halfEdgesAndVertPos = (data: ArrayBuffer): [U32Arr, F32Arr] => {
    const he = new Uint32Array(data)
    const count = he[0]
    const pos = new Float32Array(data)

    return [he.slice(1, count + 1), pos.slice(count + 1)]
  }
}
