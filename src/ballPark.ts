import { Compute } from './compute';
import { Render } from './render';
import { octahedronHalfEdges, octahedronVertexPositions, torusHalfEdges, torusVertexPositions } from './mesh';
import { Camera } from './camera';
import { Structure } from './structure';
import { readFile } from './io';
import { Info } from './ui';

export const q = 24; // scalar quantities per object in buffer

const color = {
  blue: [.2, 0, .8],
  cyan: [0, .6, .6],
  white: [.9, .9, .9],
  red: [.9, 0, 0],
  yellow: [1, .9, 0],
  green: [0, .7, 0],
  magenta: [.8, 0, .8],
  coal: [.3, .3, .3],
};
export const colorArray = Object.values(color).map((c) => c);
const colorU8Array = Object.values(color).map((c) => c.map((v) => Math.floor(255*v)));

export class BallPark {

  cubemap = 'cubemap/oceansky2hdr';
  tex = 'textures/scratched_plastic';
  // tex = 'textures/metal';

  ballRadius = 0.1;
  cylinderRadius = 0.04;
  cylinderLength = 1;

  timeStep = 0.05; // 0.05
  subSteps = 1; // 5

  freeze = false;
  rotate = false;
  showOnlyIsoRods = false;

  maxEdgeCount = 1e4;
  maxVertexCount = 1e4;
  maxFaceCount = 1e4;

  deltahedron!: Structure;

  compute = new Compute();
  render = new Render();

  add = false;
  flip = false;
  collapse = false;
  subdivide = false;

  error = 0;
  volume = 0;
  dihedralAngle = 0;
  alertText = '';

  errorInfo = new Info('error');
  volumeInfo = new Info('volume');
  dihedralAngleInfo = new Info('dihedralAngle');
  alertInfo = new Info('alertInfo');
  FEVCountInfo = new Info('FEVCount');
  formulaInfo = new Info('formula');

  async initialize() {

    const camera = new Camera({
      arcRotateCamera: false, // if false uses simple endless rotation
      angleResolution: 3,
      radiusResolution: 6,
      azimuth: 0,
      inclination: 90,
      radius: 15,
      target: new Float32Array(3),
      zNear: 0.1,
      zFar: 1000,
      fieldOfViewAngle: 27 * Math.PI/180, // (approximately vertical angle of 50 mm full frame)
    });
    
    this.deltahedron = new Structure(this.maxVertexCount, this.maxEdgeCount, this.maxFaceCount, this.ballRadius, this.cylinderRadius, this.cylinderLength, this.compute );

    const [balls, rods, triangles, halfEdges] = this.deltahedron.init(torusHalfEdges(), torusVertexPositions);
    // this.deltahedron.init(tetrahedronHalfEdges);

    const gpuDevice = await this.compute.initialize([balls, rods, triangles], this.timeStep, this.subSteps);

    this.compute.setHalfEdgeBuffer(halfEdges);
    this.compute.setCount(balls.count, rods.count, triangles.count);

    this.compute.setBallsVisibility(balls.visible);
    this.compute.setBallsVisibility(rods.visible);
    this.compute.setTrianglesVisibility(triangles.visible);

    await this.render.init(gpuDevice, 'canvas', camera, [balls, rods, triangles], this.cubemap, this.tex);

    // interaction

    camera.mouseInteraction(this.render.getCanvas());

    // display ____________________________________________

    this.alertInfo.set = () => this.alertText;

    this.errorInfo.set = () => this.error.toFixed(3) + '%';
    this.errorInfo.createTooltip('22px', '0', '160px',
      'maximum distance error'
    );

    this.volumeInfo.set = () => this.volume.toFixed(4);
    this.volumeInfo.createTooltip('22px', '0', '50px',
      'volume'
    );

    this.dihedralAngleInfo.set = () => this.dihedralAngle.toFixed(3) + '°';
    this.dihedralAngleInfo.createTooltip('22px', '0', '110px',
      'dihedral angle'
    );

    this.FEVCountInfo.set = () => {
      let string = 'F&emsp14;'+triangles.count.toFixed();
      string = string.concat('&nbsp; E&emsp14;'+rods.count.toFixed());
      string = string.concat('&nbsp; V&emsp14;'+balls.count.toFixed());
      return string;
    }
    this.FEVCountInfo.createTooltip('-42px', '0', '200px',
      'Number of faces (F), edges (E), and vertices (V).');
    this.FEVCountInfo.update();

    this.formulaInfo.set = () => {
      const count = this.deltahedron.getCoordinationNumberCount();
      const element = ['T','P','H','S','O','N','D'];
      let bigCount = 0;
      let string = '';
      for (let i=4; i < 12; i++) {
        const c = colorU8Array[i-4];
        if (i > 10 && count[i] > 0) bigCount += count[i];
        else if (count[i] > 0) {
          
          string = string.concat(
            '<span style="color:rgb('+c[0]+','+c[1]+','+c[2]+')">'+
            element[i-4]+'<sub>'+count[i]+'</sub>&emsp14;</span>'
          );
        }
        if (i == 11 && bigCount > 0) string = string.concat(
          '<span style="color:rgb('+c[0]+','+c[1]+','+c[2]+')">'+
          'B'+'<sub>'+bigCount+'</sub>&emsp14;</span>'
        );
      }
      return string;
    }
    this.formulaInfo.createTooltip('-144px', '-120px', '420px',
      'The formula summarizing how many different vertices are present in the deltahedron. A vertex is characterized by its coordination number, which equals the number of edges connected to it. The initials of greek numerals for 4 T (Tetra), 5 P (Penta), 6 H (Hexa), and latin numerals for 7 S (Sept), 8 O (Oct), 9 N (Nonus), 10 D (Deca) are used to identify the coordination number (for numbers larger than 10 B ("Big" or "Beyond" is used). The subscripts equal the number of vertices for each vertex type.');
    this.formulaInfo.update();

    let i = 0
    // let time = Date.now();
    const frameIntegration = 30;
    // let slowmo = false;
    // let endSlowmo = false;

    let checkSelection = false;
    let hoveringEdgeIndex = -1;

    let initEdgeCount:number;
    let initVertexCount:number;
    let s = 0;
    const flipList:Array<number> = [];

    const loop = async () => {

      if (!this.subdivide) {
        if (camera.mouseCoords.haveChanged || camera.mouseWasPressed) {
          camera.mouseCoords.haveChanged = false;
          checkSelection = true;
          this.compute.selectRodScanBranch('depthTest');
          this.compute.setMouseRayAndEye(camera.getMouseRay(), camera.getEye());
          this.alertText = '';
          this.alertInfo.update();
        }
      }

      //_______________________________________________________________________
      const commandEncoder = gpuDevice.createCommandEncoder();

      // if (!slowmo)
      this.compute.integration(commandEncoder, balls.count, rods.count, triangles.count);

      this.render.render(camera, commandEncoder);

      gpuDevice.queue.submit([commandEncoder.finish()]);
      //_______________________________________________________________________
      
      if (this.rotate) camera.raiseAzimuth();

      if (checkSelection) {
        
        await this.compute.workDone(); // wait for min distance
        this.compute.rodScan(rods.count);
        const out = await this.compute.getOutBuffer(); // get edge index
        const newHoveringEdgeIndex = out[1];

        if (newHoveringEdgeIndex !== hoveringEdgeIndex) {
          if (hoveringEdgeIndex !== -1)
            this.deltahedron.changeRodColor(hoveringEdgeIndex, this.deltahedron.rodBaseColor);
          
          hoveringEdgeIndex = newHoveringEdgeIndex;

          if (hoveringEdgeIndex === -1)
            document.body.style.cursor = 'default';
          else {
            this.deltahedron.changeRodColor(hoveringEdgeIndex, this.deltahedron.rodHighlightColor);
            document.body.style.cursor = 'pointer';
          }
        }

        this.dihedralAngle = out[3] / 2097152;
        this.dihedralAngleInfo.update();
        
        if (hoveringEdgeIndex !== -1 && camera.mouseWasPressed) { // edge selected

          let status;
          
          if (this.add)
            this.deltahedron.addVertex(hoveringEdgeIndex);
          else if (this.flip)
            status = this.deltahedron.flipEdge(hoveringEdgeIndex);
          else if (this.collapse)
            status = await this.deltahedron.collapseEdge(hoveringEdgeIndex);
          
          if (status === 1) {
            this.alertText = 'Tetrahedral corners are not allowed.';
            this.alertInfo.update();
          }
          if (this.showOnlyIsoRods) this.deltahedron.showOnlyIsoRods();
          this.FEVCountInfo.update();
          this.formulaInfo.update();
          

          // this.compute.setTimeAndSubStep(0.001, 1);
          // slowmo = true;
          // setTimeout(() => {endSlowmo = true;}, 1000);
        }
        checkSelection = false;
        camera.mouseWasPressed = false;
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

          this.FEVCountInfo.update();
          this.formulaInfo.update();
          s++;
        }
        if (s === initEdgeCount) {
          this.deltahedron.flipEdge(flipList.pop() as number);
          if (flipList.length === 0) {
            this.subdivide = false;
            s = 0;
          }
        }
        if (this.showOnlyIsoRods) this.deltahedron.showOnlyIsoRods();
        this.formulaInfo.update();
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

        this.error = 100 * out[2] / 2097152;
        this.errorInfo.update();

        this.volume = out[7] / 2097152;
        this.volumeInfo.update();

        this.compute.resetError();
      }

      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);

  }

  setGravity(g:number) {this.compute.setGravity(g);}
  setHold(h:boolean) {this.freeze = h;}
  setRotation(r:boolean) {this.rotate = r;}
  
  showFaces(s:boolean) {this.deltahedron.showFaces(s);}
  showRods(s:boolean) {this.deltahedron.showRods(s);}
  showBalls(s:boolean) {this.deltahedron.showBalls(s);}

  loadOctahedron() {this.setData(octahedronHalfEdges, octahedronVertexPositions);}

  setShowOnlyIsoRods(show:boolean) {
    this.showOnlyIsoRods = show;
    if (this.showOnlyIsoRods) this.deltahedron.showOnlyIsoRods();
    else this.deltahedron.showAllRods()
  }

  addVertex(add:boolean) {this.add = add;}
  flipEdges(flip:boolean) {this.flip = flip;}
  collapseEdges(collapse:boolean) {this.collapse = collapse;}
  startSubdivide(sub:boolean) {this.subdivide = sub;}

  async saveData() {await this.deltahedron.saveData();}
  async exportSTL() {await this.deltahedron.exportSTL();}

  // bam() {this.deltahedron.bam();}

  setData = (heData:Uint32Array, posData?:Float32Array) => {
    const [balls, rods, triangles, halfEdges] = 
      this.deltahedron.init(heData, posData);

    this.compute.setCompleteBallsAndRodsBuffer(balls.data, rods.data);
    this.compute.setTriangleIndexBuffer(triangles.mesh.indices);
    this.compute.setHalfEdgeBuffer(halfEdges);
    this.compute.setCount(balls.count, rods.count, triangles.count);

    if (this.showOnlyIsoRods) this.deltahedron.showOnlyIsoRods();
    this.FEVCountInfo.update();
    this.formulaInfo.update();
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