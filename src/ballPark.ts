import { Compute } from './compute';
import { Render } from './render';
import { tetrahedronHalfEdges, tetrahedronVertexPositions, torusHalfEdges, torusVertexPositions } from './mesh';
import { Camera } from './camera';
import { Structure } from './structure';
import { readFile } from './io';

export const q = 24; // scalar quantities per object in buffer

export class BallPark {

  timeStep = 0.05; // 0.05
  subSteps = 1; // 5

  freeze = false;
  rotate = false;

  maxEdgeCount = 1e4;
  maxVertexCount = 1e4;
  maxFaceCount = 1e4;

  deltahedron!: Structure;

  compute = new Compute();

  add = false;
  flip = false;
  collapse = false;
  remove = false;
  subdivide = false;

  updateTriangleCountDisplay!: () => void;

  async initialize() {

    const camera = new Camera({
      angleResolution: 3,
      radiusResolution: 1,
      azimuth: 0,
      inclination: 90,
      radius: 13,
      target: new Float32Array(3),
      zNear: 0.1,
      zFar: 1000,
      fieldOfViewAngle: 27 * Math.PI/180, // (approximately vertical angle of 50 mm full frame)
    });
    
    const ballRadius = 0.1;
    const cylinderRadius = 0.04;
    const cylinderLength = 0.8;

    this.deltahedron = new Structure(this.maxVertexCount, this.maxEdgeCount, this.maxFaceCount, ballRadius, cylinderRadius, cylinderLength, this.compute );

    const [balls, rods, triangles, halfEdges] = this.deltahedron.init(torusHalfEdges(), torusVertexPositions);
    // this.deltahedron.init(tetrahedronHalfEdges);

    const gpuDevice = await this.compute.initialize([balls, rods, triangles], this.timeStep, this.subSteps);

    this.compute.setHalfEdgeBuffer(halfEdges);
    this.compute.setCount(balls.count, rods.count, triangles.count);
    this.compute.setNextBallInPool(balls.count);

    this.compute.setBallsAndRodsVisibility(balls.visible, rods.visible);
    this.compute.setTrianglesVisibility(true);

    const render = new Render(gpuDevice, 'canvas', camera, [balls, rods, triangles]);

    // interaction

    camera.mouseInteraction(render.getCanvas());
    
    // display

    const divFps = document.createElement('div');
    divFps.id = 'fps';
    document.body.appendChild(divFps);

    const divTriangleCount = document.createElement('div');
    divTriangleCount.id = 'triangleCount';
    document.body.appendChild(divTriangleCount);
    this.updateTriangleCountDisplay = () => divTriangleCount.innerHTML = triangles.count.toFixed() + ' triangles';
    this.updateTriangleCountDisplay();

    let i = 0
    // let time = Date.now();
    const frameIntegration = 30;
    // let slowmo = false;
    // let endSlowmo = false;

    let checkSelection = false;

    let initEdgeCount:number;
    let initVertexCount:number;
    let s = 0;
    const flipList:Array<number> = [];

    const loop = async () => {

      if (camera.mouseCoords.haveChanged) {
        camera.mouseCoords.haveChanged = false;
        checkSelection = true;
        this.compute.selectRodScanBranch('depthTest');
        this.compute.setMouseRayAndEye(camera.getMouseRay(), camera.getEye())
      }
      
      /////////////////////////////////////////////////////////////
      const commandEncoder = gpuDevice.createCommandEncoder();

      // if (!slowmo)
      this.compute.integration(commandEncoder, balls.count, rods.count, triangles.count);

      render.render(camera, commandEncoder);

      gpuDevice.queue.submit([commandEncoder.finish()]);
      /////////////////////////////////////////////////////////////
      
      if (this.rotate) camera.raiseAzimuth();

      if (checkSelection) {
        
        await this.compute.workDone(); // wait for min distance
        this.compute.rodScan(rods.count);
        const out = await this.compute.getOutBuffer(); // get edge index
        const selectedEdgeIndex = out[1];

        if (selectedEdgeIndex !== -1) { // edge selected
          // console.log('e', selectedEdgeIndex);
          
          if (this.add)
            this.deltahedron.addVertex(selectedEdgeIndex);
          else if (this.flip)
            this.deltahedron.flipEdge(selectedEdgeIndex);
          else if (this.collapse)
            this.deltahedron.collapseEdge(selectedEdgeIndex);
          // else if (this.remove)
          //   this.deltahedron.removeEdge(selectedEdgeIndex);
          
          this.updateTriangleCountDisplay();

          // this.compute.setTimeAndSubStep(0.001, 1);
          // slowmo = true;
          // setTimeout(() => {endSlowmo = true;}, 1000);
        }
        checkSelection = false;
        this.compute.makeMouseCoordsOldNews();
      }
      
      if (this.subdivide) {
        if (s === 0) {
          initEdgeCount = rods.count;
          initVertexCount = balls.count;
          this.compute.selectRodScanBranch('nextBall');
        }
        if (s < initEdgeCount) {
          this.compute.setNewBallRodIndex(s);
          this.compute.rodScan(rods.count);
          const [vB, vD] = this.deltahedron.addVertex(s);
          // check if opposing vertices are old ones
          // (means triangles have not been modified before)
          if (vB < initVertexCount) flipList.push(rods.count-3);
          if (vD < initVertexCount) flipList.push(rods.count-1);
          s++;
          this.updateTriangleCountDisplay();
        }
        if (s === initEdgeCount) {
          this.deltahedron.flipEdge(flipList.pop() as number);
          if (flipList.length === 0) {
            this.subdivide = false;
            s = 0;
          }
        }
      }

      // if (slowmo && endSlowmo) {
      //   this.compute.setTimeAndSubStep(0.05, 1);
      //   slowmo = false;
      //   endSlowmo = false;
      // }

      // calculate fps every frameIntegration frames
      i++;
      if (i >= frameIntegration && !this.subdivide) {
        i = 0;
        // const fps = frameIntegration * 1e3 / (Date.now() - time);
        // time = Date.now();
        // divFps.innerHTML = fps.toFixed() + ' fps';

        this.compute.selectRodScanBranch('maxError');
        this.compute.rodScan(rods.count);
        await this.compute.workDone();
        const out = await this.compute.getOutBuffer();
        const error = 100 * out[2] / 2097152;
        divFps.innerHTML = error.toFixed(3) + '%';
        this.compute.resetError();
      }

      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);

  }

  setGravity(g:number) {this.compute.setGravity(g);}
  setHold(h:boolean) {this.freeze = h;}
  setRotation(r:boolean) {this.rotate = r;}
  hideFaces(h:boolean) {this.deltahedron.hideFaces(h);}
  hideBallsAndRods(h:boolean) {this.deltahedron.hideBallsAndRods(h);}
  loadTetrahedron() {this.setData(tetrahedronHalfEdges, tetrahedronVertexPositions);}

  addVertex(add:boolean) {this.add = add;}
  flipEdges(flip:boolean) {this.flip = flip;}
  collapseEdges(collapse:boolean) {this.collapse = collapse;}
  removeEdges(remove:boolean) {this.remove = remove;}
  startSubdivide(sub:boolean) {this.subdivide = sub;}

  async saveData() {await this.deltahedron.saveData();}
  async exportSTL() {await this.deltahedron.exportSTL();}

  setData = (heData:Uint32Array, posData?:Float32Array) => {
    const [balls, rods, triangles, halfEdges] = 
      this.deltahedron.init(heData, posData);

    this.compute.setCompleteBallsAndRodsBuffer(balls.data, rods.data);
    this.compute.setTriangleIndexBuffer(triangles.mesh.indices);
    this.compute.setHalfEdgeBuffer(halfEdges);
    this.compute.setCount(balls.count, rods.count, triangles.count);
    this.compute.setNextBallInPool(balls.count);
    this.updateTriangleCountDisplay();
  }

  loadData = async () => {
    await readFile((data:ArrayBuffer) => {
      const he = new Uint32Array(data);
      const count = he[0];
      const pos = new Float32Array(data);

      this.setData(he.slice(1,count+1), pos.slice(count+1));
    });
  }
}