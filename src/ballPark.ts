import { Compute, F32Arr, U32Arr } from './compute'
import { Render } from './render'
import {
  octahedronHalfEdges,
  octahedronVertexPositions,
  torusHalfEdges,
  torusVertexPositions,
} from './mesh'
import { Camera } from './camera'
import { Structure } from './structure'
import { loadFromPublic, readFile } from './io'
import { ActivityIndicator, Info, vertexCountToSummationFormula } from './display'

const QUANTIZE_FACTOR = 2097152
export const q = 24 // scalar quantities per object in buffer

export class BallPark {
  cubemap = 'cubemap/oceansky2hdr'
  tex = 'textures/scratched_plastic'
  // tex = 'textures/metal';

  ballRadius = 0.1
  cylinderRadius = 0.04
  cylinderLength = 1

  timeStep = 0.05 // 0.05
  subSteps = 1 // 5

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
  dihedralAngle = 0
  alertText = ''

  errorInfo = new Info('error')
  // volumeInfo = new Info('volume')
  dihedralAngleInfo = new Info('dihedralAngle')
  alertInfo = new Info('alertInfo')
  FEVCountInfo = new Info('FEVCount')
  formulaInfo = new Info('formula')

  activityIndicator = new ActivityIndicator()

  async initialize() {
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

    const gpuDevice = await this.compute.initialize(
      [balls, rods, triangles],
      this.timeStep,
      this.subSteps
    )

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

    // display ____________________________________________

    this.alertInfo.set = () => this.alertText

    this.errorInfo.set = () => (100 * this.error).toFixed(3) + '%'
    this.errorInfo.createTooltip('30px', '-80px', '160px', 'maximum distance error')

    this.dihedralAngleInfo.set = () => this.dihedralAngle.toFixed(3) + '°'
    this.dihedralAngleInfo.createTooltip('30px', '-30px', '110px', 'dihedral angle')

    // this.volumeInfo.set = () => this.volume.toFixed(4)
    // this.volumeInfo.createTooltip('30px', '-30px', '50px', 'volume')

    this.FEVCountInfo.set = () => {
      let string = 'F&emsp14;' + triangles.count.toFixed()
      string = string.concat('&nbsp; E&emsp14;' + rods.count.toFixed())
      string = string.concat('&nbsp; V&emsp14;' + balls.count.toFixed())
      return string
    }
    this.FEVCountInfo.createTooltip(
      '-42px',
      '0',
      '200px',
      'Number of faces (F), edges (E), and vertices (V).'
    )
    this.FEVCountInfo.update()

    this.formulaInfo.set = () =>
      vertexCountToSummationFormula(this.deltahedron.getCoordinationNumberCount())

    this.formulaInfo.createTooltip(
      '-144px',
      '-120px',
      '420px',
      'The formula summarizing how many different vertices are present in the deltahedron. A vertex is characterized by its coordination number, which equals the number of edges connected to it. The initials of greek numerals for 4 T (Tetra), 5 P (Penta), 6 H (Hexa), and latin numerals for 7 S (Sept), 8 O (Oct), 9 N (Nonus), 10 D (Deca) are used to identify the coordination number (for numbers larger than 10 B ("Big" or "Beyond" is used). The subscripts equal the number of vertices for each vertex type.'
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
    let hoveringEdgeIndex = -1

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
        if (camera.mouseCoords.haveChanged || camera.mouseWasPressed) {
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
        const commandEncoder = gpuDevice.createCommandEncoder()

        // if (!slowmo)
        this.compute.integration(commandEncoder, balls.count, rods.count, triangles.count)

        this.render.render(camera, commandEncoder)

        gpuDevice.queue.submit([commandEncoder.finish()])
      }
      //_______________________________________________________________________

      if (this.rotate) camera.raiseAzimuth()

      if (checkSelection) {
        await this.compute.workDone() // wait for min distance
        this.compute.rodScan(rods.count)
        const out = await this.compute.getOutBuffer() // get edge index
        const newHoveringEdgeIndex = out[1]

        if (newHoveringEdgeIndex !== hoveringEdgeIndex) {
          if (hoveringEdgeIndex !== -1)
            this.deltahedron.changeRodColor(hoveringEdgeIndex, this.deltahedron.rodBaseColor)

          hoveringEdgeIndex = newHoveringEdgeIndex

          if (hoveringEdgeIndex === -1) document.body.style.cursor = 'default'
          else {
            this.deltahedron.changeRodColor(hoveringEdgeIndex, this.deltahedron.rodHighlightColor)
            document.body.style.cursor = 'pointer'
          }
        }

        this.dihedralAngle = out[3] / QUANTIZE_FACTOR
        this.dihedralAngleInfo.update()

        if (hoveringEdgeIndex !== -1 && camera.mouseWasPressed) {
          // edge selected

          let status = 0

          if (this.add) this.deltahedron.addVertex(hoveringEdgeIndex)
          else if (this.flip) status = this.deltahedron.flipEdge(hoveringEdgeIndex)
          else if (this.collapse) status = await this.deltahedron.collapseEdge(hoveringEdgeIndex)

          if (status > 0) {
            if (status === 1) this.alertText = 'Tetrahedral corners are not allowed.'
            if (status === 2) this.alertText = 'Loose triangles are not allowed.'
            this.alertInfo.update()
          }
          if (this.showOnlyIsoRods) this.deltahedron.showOnlyIsoRods()
          this.FEVCountInfo.update()
          this.formulaInfo.update()

          // this.compute.setTimeAndSubStep(0.001, 1);
          // slowmo = true;
          // setTimeout(() => {endSlowmo = true;}, 1000);
        }
        checkSelection = false
        camera.mouseWasPressed = false
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
          this.compute.rodScan(rods.count)
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
        this.compute.rodScan(rods.count)
        await this.compute.workDone()
        const out = await this.compute.getOutBuffer()

        this.error = out[2] / QUANTIZE_FACTOR
        this.errorInfo.update()

        const errorVariation = lastError != 0 ? Math.abs(this.error / lastError - 1) : 0
        converged = errorVariation < 1e-6
        if (converged) this.activityIndicator.stop()
        else this.activityIndicator.run()
        lastError = this.error

        this.volume = out[7] / QUANTIZE_FACTOR
        // this.volumeInfo.update()

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
    console.log(s ? 'tetrahedra allowed' : 'tetrahedra not allowed')
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
    // files from public/data/...
    const path = `/data/${fileName}`

    await loadFromPublic(path, (data) => {
      const [he, pos] = this.halfEdgesAndVertPos(data)
      this.setStructure(he, pos)
      console.log(`File loaded from ${fileName}`)
    })
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
