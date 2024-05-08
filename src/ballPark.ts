import { Compute } from './compute';
import { Render } from './render';
import { cylinderMesh, icoSphereMesh, icosahedronEdges } from './mesh';
import { Camera } from './camera';
import { Structure } from './structure';

export const q = 16; // scalar quantities per object in buffer

export class BallPark {

  boxSize = 100;

  // 1000, 0.4, 1.7
  // 300, 0.5, 2
  // 100, 0.5, 3
  // 20, 0.5, 6

  N!:number; // TODO: fix even numbers bug
  maxRadius!:number;

  minRadius = 0.3;

  audibleCount = 10;

  dissipation = 0;
  wallDissipation = 0.9;

  bigBrotherCount = 0;
  bigBrotherRadius = 5;

  timeStep = 0.05; // 0.05
  subSteps = 1; // 5

  freeze = false;
  rotate = false;

  balls!: Float32Array;
  radius!: Float32Array; // separate radius array necessary for sound connection

  compute = new Compute();

  async initialize(N:number, maxRadius:number) {

    this.N = N;
    this.maxRadius = maxRadius;// Math.max(maxRadius, this.bigBrotherRadius);

    this.balls = new Float32Array(q*this.N);
    const color = new Float32Array(4*this.N);
    // const colorCopy = new Float32Array(4*this.N);
    // const excitation = new Float32Array(this.N);
    this.radius = new Float32Array(this.N);
    
    for (let i=0; i<this.N; i++) {

      this.radius[i] = this.minRadius + ( this.maxRadius - this.minRadius) * i/(this.N-1);
      
      if (i<this.bigBrotherCount) this.radius[i] = this.bigBrotherRadius; // big brother
      
      this.balls[q*i+3] = this.radius[i];
      this.balls[q*i+7] = 4/3*Math.PI*this.radius[i]**3; // mass
      this.balls[q*i+12] = this.radius[i]; // scale
      
      for (let j=0; j<3; j++) {
        this.balls[q*i+j] = (- 1 + 2*Math.random())*(this.boxSize/2 - 1.1 * this.radius[i]); // position
        // balls[q*i+j+4] = - 0.5 + 1.0*Math.random(); // velocity

        color[4*i+j] = Math.random();
        if (i == 0) color[4*i+j] = 1.5; // first ball white

        this.balls[q*i+8+j] = Math.random();

        // colorCopy[4*i+j] = color[4*i+j];

      }
      color[4*i+3] = 1; // alpha?
      // colorCopy[4*i+3] = 1;
      this.balls[q*i+8+3] = 1;

      // rigid rotation
      const f = 0.005;
      const r = Math.sqrt(this.balls[q*i]**2 + this.balls[q*i+2]**2);
      this.balls[q*i+4] =   f * r * this.balls[q*i+2];
      this.balls[q*i+6] = - f * r * this.balls[q*i];
      // / balls[q*i+7]

    }

    // this.cylinderBoundary = new CylinderBoundingBox(2*this.boxSize, this.boxSize, 0);
    // this.cylinderBoundary.hide();

    const bound = [this.boxSize, this.boxSize/2, 0];

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
    
    const render = new Render;

    // static ball cube
    // const ballCount = 1000;
    // const cubeBalls = {
    //   instanceData: createRandomCube(ballCount, 0.2),
    //   mesh: icoSphereMesh(4),
    //   count: ballCount
    // }
    // const cylinderCount = 1000;
    // const cubeCylinders = {
    //   instanceData: createRandomCube(cylinderCount, 0.1),
    //   mesh: cylinderMesh(32, 0.2, 2),
    //   count: cylinderCount,
    // }

    // const [gpuDevice, objectBuffer] = await
    //   render.initialize('canvas', camera, [cubeBalls, cubeCylinders]);

    // this.compute.initialize(gpuDevice, [cubeBalls.count, cubeCylinders.count], cubeBalls.instanceData, bound, this.dissipation, this.wallDissipation, this.timeStep, this.subSteps, objectBuffer);

    // deltahedron test

    const edges = icosahedronEdges;
    const count = Math.max(...edges) + 1; // = maxval(edges)+1


    const deltahedron = new Structure;

    const [ballData, rodData, connection] = deltahedron.polyhedron(count, edges);
    const balls = {
      instanceData: ballData,
      mesh: icoSphereMesh(4),
      count: count
    }
    const rods = {
      instanceData: rodData,
      mesh: cylinderMesh(32, 0.2, 2, true),
      count: rodData.length/q,
    }
    
    const [gpuDevice, objectBuffer] = await render.initialize('canvas', camera, [balls, rods]);

    this.compute.initialize(gpuDevice, [balls.count, rods.count], balls.instanceData, bound, this.dissipation, this.wallDissipation, this.timeStep, this.subSteps, objectBuffer);

    this.compute.setConnectionBuffer(connection);
    this.compute.setEdgeBuffer(edges);

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

    // let init = true;
    
    const loop = async () => {

      if (!this.freeze) {

        const mouseCoords = camera.getMouseCoords();
        if (mouseCoords.haveChanged)
          this.compute.setMouseRayAndEye(camera.getMouseRay(), camera.getEye())

        /////////////////////////////////////////////////////////////
        const commandEncoder = gpuDevice.createCommandEncoder();

        // if (init)
        this.compute.pureIntegration(commandEncoder);

        render.render(camera, commandEncoder);

        gpuDevice.queue.submit([commandEncoder.finish()]);
        /////////////////////////////////////////////////////////////
        
        if (this.rotate) camera.raiseAzimuth();

        this.compute.makeMouseCoordsOldNews();
        
      }

      // calculate fps every frameIntegration frames

      i++;

      if ( i == frameIntegration) {
        i = 0;

        const fps = frameIntegration * 1e3 / (Date.now() - time);
        time = Date.now();
        divFps.innerHTML = fps.toFixed() + ' fps';

        // if (init) init = false;
        // this.compute.setRodsBuffer(deltahedron.assidx*q, deltahedron.addRod(0, 5));
        // this.compute.setConnectionBuffer(deltahedron.connection);
        // this.compute.setEdgeBuffer(deltahedron.edge);
      }

      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);

  }

  kineticEnergy = () => {
    let energy = 0;
    for (let i=0; i<this.N; i++) {
      const velocitySquare = this.balls[q*i+4]**2 + this.balls[q*i+5]**2 + this.balls[q*i+6]**2;
      energy += this.balls[q*i+7] * velocitySquare; // multiplied with mass
    }
    return energy;
  }

  verticalAngularMomentum = () => {
    let momentum = 0;
    for (let i=0; i<this.N; i++) {
      const cross = this.balls[q*i+2]*this.balls[q*i+4] - this.balls[q*i]*this.balls[q*i+6];
      momentum += this.balls[q*i+7] * cross; // multiplied with mass
    }
    return momentum;
  }

  verticalAngularMomentumShader = () => {
    let momentum = 0;
    for (let i=0; i<this.N; i++) momentum += this.balls[q*i+13];
    return momentum;
  }

  setGravity(g:number) {this.compute.setGravity(g);}

  setHold(h:boolean) {this.freeze = h;}
  setRotation(r:boolean) {this.rotate = r;}

}