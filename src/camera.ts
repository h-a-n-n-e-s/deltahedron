import { mat4, vec3 } from './algebra';

type CameraParameters = {
  arcRotateCamera:boolean; // turntable like camera control
  angleResolution:number;
  radiusResolution:number;
  azimuth:number;
  inclination:number;
  radius:number;
  target:Float32Array;
  zNear:number;
  zFar:number;
  fieldOfViewAngle:number;
}

export class Camera {

  private dx = 0;
  private dy = 0;
  private tx = new Float32Array([1,0,0]);
  private ty = new Float32Array([0,1,0]);

  private para:CameraParameters;

  private lookAtMatrix!:Float32Array;
  private viewMatrix!:Float32Array;
  private viewProjectionMatrix!:Float32Array;
  private eye!:Float32Array;

  private projection = new Float32Array(16);
  private inverseProjection = new Float32Array(16);

  mouseCoords:{x:number, y:number, haveChanged:boolean} = {x:0, y:0, haveChanged:false};
  mouseWasPressed = false;

  private isNew = true;

  constructor(para:CameraParameters) {this.para = para;}

  shaderParameterMapping(shaderParameters:Float32Array) {
    this.lookAtMatrix = shaderParameters.subarray(0, 16);
    this.viewMatrix = shaderParameters.subarray(16, 32);
    this.viewProjectionMatrix = shaderParameters.subarray(32, 48);
    this.eye = shaderParameters.subarray(48, 51);
    this.sphericalToCartesian();
  }

  sphericalToCartesian() {
    const r = this.para.radius;
    const phi = - this.para.azimuth * Math.PI/180;
    const theta = this.para.inclination * Math.PI/180;
    this.eye.set([
      r * Math.sin(theta) * Math.sin(phi),
      r * Math.cos(theta), 
      r * Math.sin(theta) * Math.cos(phi)
    ]);
    // set tangent x vector (right)
    this.tx.set([Math.cos(phi), 0, -Math.sin(phi)]);
  }

  getCameraMatrix() {

    if (!this.isNew) return;
    
    if (this.para.arcRotateCamera)
      this.sphericalToCartesian();
    
    else {
      // simple endless rotation
      const speed = 0.01;
      if (this.dx !== 0 || this.dy !== 0) {
        const axis = new Float32Array(3);
        for (let o=0; o<3; o++) axis[o] = this.tx[o] * this.dy + this.ty[o] * this.dx;
        const angle = speed * Math.sqrt(this.dx*this.dx + this.dy*this.dy);
        const R = vec3.rotationMatrix(axis, angle);
        vec3.applyRotation(R, this.eye);
        vec3.applyRotation(R, this.tx);
        vec3.applyRotation(R, this.ty);
      }
      const l = vec3.length(this.eye);
      for (let o=0; o<3; o++)
        this.eye[o] *= this.para.radius / l;
    }

    mat4.lookAtAndViewMatrix(this.eye, this.para.target, this.tx, this.lookAtMatrix, this.viewMatrix);
    
    mat4.multiply(this.projection, this.viewMatrix, this.viewProjectionMatrix);

    this.isNew = false;
  }

  setPerspective(aspect:number) {

    const f = Math.tan(Math.PI * 0.5 - 0.5 * this.para.fieldOfViewAngle);
    const rangeInv = 1 / (this.para.zNear - this.para.zFar);

    this.projection[0] = f / aspect;
    this.projection[5] = f;
    this.projection[10] = this.para.zFar * rangeInv;
    this.projection[11] = -1;
    this.projection[14] = this.para.zNear * this.para.zFar * rangeInv;

    this.inverseProjection[0] = aspect / f;
    this.inverseProjection[5] = 1 / f;
    this.inverseProjection[11] = 1 / this.projection[14];
    this.inverseProjection[14] = -1;
    this.inverseProjection[15] = this.projection[10] / this.projection[14];

    this.isNew = true;
  }

  mouseInteraction(canvas:HTMLCanvasElement) {

    canvas.addEventListener('pointermove', (e) => {

      this.mouseCoords.x = - 1 + 2 * e.clientX/canvas.clientWidth;
      this.mouseCoords.y = 1 - 2 * e.clientY/canvas.clientHeight;

      this.mouseCoords.haveChanged = true;

      const mouseDown = e.pointerType == 'mouse' ? (e.buttons & 1) !== 0 : true;
      if (mouseDown) {
        this.para.azimuth += 0.1 * this.para.angleResolution * e.movementX;
        this.para.inclination -= 0.1 * this.para.angleResolution * e.movementY;
        this.para.inclination = Math.min( Math.max(this.para.inclination, 0),180)

        this.dx = - e.movementX;
        this.dy = - e.movementY;

        this.isNew = true;
      }
    });

    canvas.addEventListener('wheel', (e) => {
      // let s = 0.1; // zoom sensitivity
      // if (e.deltaY > 5) s = 0.01; // track pad detection patch (bad)
      this.para.radius += 0.01 * this.para.radiusResolution * e.deltaY;
      this.para.radius = Math.max(this.para.radius, this.para.zNear);
      this.para.radius = Math.min(this.para.radius, 200);
      this.dx = 0;
      this.dy = 0;
      this.isNew = true;
    });

    canvas.addEventListener('pointerdown', () => this.mouseWasPressed = true);
  }

  getMouseRay() {

    // thanks to https://antongerdelan.net/opengl/raycasting.html

    const cameraCoords = mat4.multiplyVector(this.inverseProjection, new Float32Array([this.mouseCoords.x, this.mouseCoords.y, -1, 0]));
    
    cameraCoords[2] = -1;
    cameraCoords[3] = 0;

    const mouseRay = mat4.multiplyVector(this.lookAtMatrix, cameraCoords);

    mouseRay[3] = 0;
    vec3.normalize(mouseRay);

    return mouseRay.slice(0,3);
  }

  getEye() {
    return this.eye;
  }

  raiseAzimuth() {
    this.para.azimuth = (this.para.azimuth - 0.1*this.para.angleResolution)%360;
    this.isNew = true;
  }

  keyboardInteraction(canvas:HTMLCanvasElement) {
    
    // TODO: doesn't react anymore...
    canvas.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') {
        this.para.azimuth -= this.para.angleResolution;
        if (this.para.azimuth === -this.para.angleResolution) this.para.azimuth = 360 - this.para.angleResolution;
      }
      else if (e.key === 'ArrowRight') {
        this.para.azimuth += this.para.angleResolution;
        if (this.para.azimuth === 360) this.para.azimuth = 0;
      }
      else if (e.key === 'ArrowDown'  && this.para.inclination > 0) this.para.inclination -= this.para.angleResolution;
      else if (e.key === 'ArrowUp'  && this.para.inclination < 180) this.para.inclination += this.para.angleResolution;
      else if (e.key === 'f') this.para.radius += 1;
      else if (e.key === 'd' && this.para.radius > 1) this.para.radius -= 1;

      this.isNew = true;
    });
  }
}