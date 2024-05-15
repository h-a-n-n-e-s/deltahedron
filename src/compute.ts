
import { q } from './ballPark';
import header from './shader/header.wgsl?raw';
import intersection from './shader/intersection.wgsl?raw';
import ballsShader from './shader/balls.wgsl?raw';
import rodsShader from './shader/rods.wgsl?raw';
import { Camera } from './camera';


export class Compute {

  private device!: GPUDevice;
  private integrationPipeline!: GPUComputePipeline;
  private rodsPipeline!: GPUComputePipeline;
  private bindGroup!: GPUBindGroup;

  private subSteps!: number;

  private globalParameterBuffer!: GPUBuffer;
  private outBuffer!: GPUBuffer;
  private stagingOutBuffer!: GPUBuffer;

  private ballsBuffer!: GPUBuffer;
  private rodsBuffer!: GPUBuffer;
  private halfEdgeBuffer!: GPUBuffer;
  private velocityUpdateBuffer!: GPUBuffer;

  initialize = (device:GPUDevice, balls:Float32Array, timeStep:number, subSteps:number, objectBufferList:Array<GPUBuffer>) => {

    this.device = device;
    this.subSteps = subSteps;

    // buffers ////////////////////////////////////////////

    this.globalParameterBuffer = this.device.createBuffer({
      size: 4*12,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
    });
    this.setTimeAndSubStep(timeStep, subSteps);

    this.outBuffer = this.device.createBuffer({
      size: 16,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST
    });

    this.stagingOutBuffer = this.device.createBuffer({
      size: this.outBuffer.size,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
    });

    this.resetOutBuffer();

    [this.ballsBuffer, this.rodsBuffer] = objectBufferList;
    this.device.queue.writeBuffer(this.ballsBuffer, 0, balls);

    this.velocityUpdateBuffer = this.device.createBuffer({
      size: this.ballsBuffer.size / q * 3, // padding unnecessary
      usage: GPUBufferUsage.STORAGE
    });
    
    this.halfEdgeBuffer = this.device.createBuffer({
      size: this.rodsBuffer.size / q * 8,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
    });

    // pipelines //////////////////////////////////////////

    // integration

    const bindGroupLayout = this.device.createBindGroupLayout({
      entries: [
        {binding:0, visibility:GPUShaderStage.COMPUTE, buffer:{type:'uniform'}}, // global parameters
        {binding:1, visibility:GPUShaderStage.COMPUTE, buffer:{type:'read-only-storage'}}, // halfEdges
        {binding:2, visibility:GPUShaderStage.COMPUTE, buffer:{type:'storage'}}, // velocityUpdate
        {binding:3, visibility:GPUShaderStage.COMPUTE, buffer:{type:'storage'}}, // balls
        {binding:4, visibility:GPUShaderStage.COMPUTE, buffer:{type:'storage'}}, // rods
        {binding:5, visibility:GPUShaderStage.COMPUTE, buffer:{type:'storage'}}, // out
      ]
    });

    const pipelineLayout = this.device.createPipelineLayout({bindGroupLayouts: [bindGroupLayout]});

    this.integrationPipeline = this.createCompPipe(pipelineLayout, header+intersection+ballsShader);
    this.rodsPipeline = this.createCompPipe(pipelineLayout, header+intersection+rodsShader);

    this.bindGroup = this.device.createBindGroup({
      label: 'integrationBindGroup',
      layout: bindGroupLayout,
      entries: [
        {binding: 0, resource: {buffer: this.globalParameterBuffer}},
        {binding: 1, resource: {buffer: this.halfEdgeBuffer}},
        {binding: 2, resource: {buffer: this.velocityUpdateBuffer}},
        {binding: 3, resource: {buffer: this.ballsBuffer}},
        {binding: 4, resource: {buffer: this.rodsBuffer}},
        {binding: 5, resource: {buffer: this.outBuffer}},
      ]
    });
  }

  pureIntegration = (encoder:GPUCommandEncoder, ballCount:number, rodCount:number) => {

    this.computePass(encoder, this.rodsPipeline, this.bindGroup, rodCount);

    for (let s=0; s<this.subSteps; s++)
      this.computePass(encoder, this.integrationPipeline, this.bindGroup, ballCount);

  }

  copyOutBuffer = (encoder:GPUCommandEncoder) =>
    encoder.copyBufferToBuffer(this.outBuffer, 0, this.stagingOutBuffer, 0, this.outBuffer.size);

  getOutBuffer = async () => {
    
    await this.stagingOutBuffer.mapAsync(GPUMapMode.READ);
    
    return new Int32Array(this.stagingOutBuffer.getMappedRange());  
  }

  resetOutBuffer = () => {
    this.stagingOutBuffer.unmap();
    this.device.queue.writeBuffer(this.outBuffer, 0, new Int32Array([-1]));
  }

  createCompPipe = (layout:GPUPipelineLayout, code:string, constants={}, entry='main') => {
    return this.device.createComputePipeline({
      layout: layout,
      compute: {
        module: this.device.createShaderModule({code: code}),
        entryPoint: entry,
        constants: constants
      }
    });
  }

  computePass = (commandEncoder:GPUCommandEncoder, pipeline:GPUComputePipeline, bindGroup:GPUBindGroup, count:number) => {
    const passEncoder = commandEncoder.beginComputePass();
    passEncoder.setPipeline(pipeline);
    passEncoder.setBindGroup(0, bindGroup);
    passEncoder.dispatchWorkgroups(Math.ceil(count/64));
    passEncoder.end();
  }

  setTimeAndSubStep = (dt:number, sub:number) => {
    this.device.queue.writeBuffer(this.globalParameterBuffer, 8, new Float32Array([
      dt/sub
    ]));
  };
  
  setGravity = (g:number) =>
    this.device.queue.writeBuffer(this.globalParameterBuffer, 12, new Float32Array([g]));

  setCount = (ballCount:number, rodCount:number) =>
    this.device.queue.writeBuffer(this.globalParameterBuffer, 0, new Uint32Array([ballCount, rodCount]));

  setHalfEdgeBuffer = (halfEdges:Uint32Array) =>
    this.device.queue.writeBuffer(this.halfEdgeBuffer, 0, halfEdges);

  setBallsBuffer = (index:number, ball:Float32Array) => {
    // exclude postion and velocity
    this.device.queue.writeBuffer(this.ballsBuffer, (index*q+3)*4, ball.slice(3,12));
    this.device.queue.writeBuffer(this.ballsBuffer, (index*q+15)*4, ball.slice(15,q));
  }
  
  setRodsBuffer = (index:number, rod:Float32Array) =>
    this.device.queue.writeBuffer(this.rodsBuffer, index*q*4, rod);

  setMouseRayAndEye = (ray:Float32Array, eye:Float32Array) => {
    this.device.queue.writeBuffer(this.globalParameterBuffer, 16, ray);
    this.device.queue.writeBuffer(this.globalParameterBuffer, 28, new Float32Array([1]));
    this.device.queue.writeBuffer(this.globalParameterBuffer, 32, eye);
  }

  makeMouseCoordsOldNews = (camera:Camera) => {
    this.device.queue.writeBuffer(this.globalParameterBuffer, 28, new Float32Array([-1]));
    camera.mouseCoords.haveChanged = false;
    }
}