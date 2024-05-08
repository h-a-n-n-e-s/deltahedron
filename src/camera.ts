import { mat4 } from "./algebra";

const degToRad = Math.PI/180;

type ArcRotateCameraParameters = {
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

  private para:ArcRotateCameraParameters;

  private lookAtMatrix!:Float32Array;
  private viewMatrix!:Float32Array;
  private viewProjectionMatrix!:Float32Array;
  private eye!:Float32Array;

  private projection = new Float32Array(16);

  constructor(para:ArcRotateCameraParameters) {this.para = para;}

  shaderParameterMapping(shaderParameters:Float32Array) {
    this.eye = shaderParameters.subarray(48, 51);
    this.lookAtMatrix = shaderParameters.subarray(0, 16);
    this.viewMatrix = shaderParameters.subarray(16, 32);
    this.viewProjectionMatrix = shaderParameters.subarray(32, 48);
  }

  getCameraMatrix() {

    // cartesian coordinates of the camera (from spherical coordinates)
    const t = this.para.inclination * degToRad;
    const p = - this.para.azimuth * degToRad;
    const r = this.para.radius * this.para.radiusResolution;
    this.eye.set([
      r * Math.sin(t) * Math.sin(p),
      r * Math.cos(t), 
      r * Math.sin(t) * Math.cos(p)
    ]);

    mat4.lookAtAndViewMatrix(this.eye, this.para.target, p, this.lookAtMatrix, this.viewMatrix);
    
    mat4.multiply(this.projection, this.viewMatrix, this.viewProjectionMatrix);

  }

  setPerspective(aspect:number) {

    const f = Math.tan(Math.PI * 0.5 - 0.5 * this.para.fieldOfViewAngle);
    const rangeInv = 1 / (this.para.zNear - this.para.zFar);

    this.projection[0] = f / aspect;
    this.projection[5] = f;
    this.projection[10] = this.para.zFar * rangeInv;
    this.projection[11] = -1;
    this.projection[14] = this.para.zNear * this.para.zFar * rangeInv;
  }

  raiseAzimuth() {
    this.para.azimuth = (this.para.azimuth - 0.1*this.para.angleResolution)%360;
  }

  keyboardInteraction() {
    document.addEventListener('keydown', (e) => {
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
    });
  }

  mouseInteraction(canvas:HTMLCanvasElement) {

    canvas.addEventListener('pointermove', (e) => {
      const mouseDown = e.pointerType == 'mouse' ? (e.buttons & 1) !== 0 : true;
      if (mouseDown) {
        this.para.azimuth += 0.1 * this.para.angleResolution * e.movementX;
        this.para.inclination -= 0.1 * this.para.angleResolution * e.movementY;
      }
    });

    canvas.addEventListener('wheel', (e) => {
      this.para.radius += 0.1 * this.para.radiusResolution * Math.sign(e.deltaY);
    });
  }
}