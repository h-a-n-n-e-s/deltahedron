import { Compute } from './compute';
import { Render } from './render';
import { tetrahedronHalfEdges } from './mesh';
import { Camera } from './camera';
import { Structure } from './structure';

export const q = 20; // scalar quantities per object in buffer

export class BallPark {

  timeStep = 0.05; // 0.05
  subSteps = 1; // 5

  freeze = false;
  rotate = false;

  maxEdgeCount = 100;
  maxVertexCount = 100;
  
  compute = new Compute();

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

    const deltahedron = new Structure;

    const [balls, rods, halfEdges] = deltahedron.init(this.maxVertexCount, this.maxEdgeCount, tetrahedronHalfEdges, ballRadius, cylinderRadius, cylinderLength);

    const render = new Render;

    const [gpuDevice, objectBuffer] = await render.initialize('canvas', camera, [balls, rods]);

    this.compute.initialize(gpuDevice, balls.data, this.timeStep, this.subSteps, objectBuffer);

    this.compute.setHalfEdgeBuffer(halfEdges);

    this.compute.setCount(balls.count, rods.count);

    // interaction ////////////////////////////////////////

    camera.mouseInteraction(render.getCanvas());
    
    // info output

    // const initKineticEnergy = this.kineticEnergy();
    // let initVerticalAngularMomentum:number;// = this.verticalAngularMomentum();

    // const infoDiv = document.createElement('div');
    // infoDiv.id = 'info';
    // document.body.appendChild(infoDiv);

    // frames per second counter
    const divFps = document.createElement('div');
    divFps.id = 'fps';
    document.body.appendChild(divFps);

    let i = 0
    let time = Date.now();
    const frameIntegration = 60;
    let slowmo = false;
    let endSlowmo = false;

    const loop = async () => {

      if (!this.freeze) {

        if (camera.mouseCoords.haveChanged)
          this.compute.setMouseRayAndEye(camera.getMouseRay(), camera.getEye())

        /////////////////////////////////////////////////////////////
        const commandEncoder = gpuDevice.createCommandEncoder();

        this.compute.pureIntegration(commandEncoder, balls.count, rods.count);

        if (camera.mouseCoords.haveChanged)
          this.compute.copyOutBuffer(commandEncoder);

        render.render(camera, commandEncoder);

        gpuDevice.queue.submit([commandEncoder.finish()]);
        /////////////////////////////////////////////////////////////
        
        if (this.rotate) camera.raiseAzimuth();

        if (camera.mouseCoords.haveChanged) {

          const out = await this.compute.getOutBuffer();
          const selectedEdgeIndex = out[0];
          if (selectedEdgeIndex !== -1) { // edge selected
            console.log('e', selectedEdgeIndex, 'o', out[1]);
            
            deltahedron.insertVertex(selectedEdgeIndex, this.compute);
            
            this.compute.setTimeAndSubStep(0.001, 1);
            slowmo = true;
            setTimeout(() => {endSlowmo = true;}, 1000);
          }

          this.compute.makeMouseCoordsOldNews(camera);
          this.compute.resetOutBuffer();
        }
        
        if (slowmo && endSlowmo) {
          this.compute.setTimeAndSubStep(0.05, 1);
          slowmo = false;
          endSlowmo = false;
        }
      }

      // calculate fps every frameIntegration frames
      i++;
      if ( i == frameIntegration) {
        i = 0;
        const fps = frameIntegration * 1e3 / (Date.now() - time);
        time = Date.now();
        divFps.innerHTML = fps.toFixed() + ' fps';

        // const origin = balls.data.slice(0,3);
        // console.log(vec3.triple(
        //   vec3.subtract(balls.data.slice(  q,  q+3), origin),
        //   vec3.subtract(balls.data.slice(2*q,2*q+3), origin),
        //   vec3.subtract(balls.data.slice(3*q,3*q+3), origin)
        // ));
      }

      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);

  }

  setGravity(g:number) {this.compute.setGravity(g);}

  setHold(h:boolean) {this.freeze = h;}
  setRotation(r:boolean) {this.rotate = r;}

}