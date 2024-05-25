
import { q } from './ballPark';
import header from './shader/header.wgsl?raw';
import intersection from './shader/intersection.wgsl?raw';
import ballsShader from './shader/balls.wgsl?raw';
import rodsShader from './shader/rods.wgsl?raw';
import selectionDepth from './shader/selectionDepth.wgsl?raw';
import { Object } from './structure';

export class Compute {

  private device!: GPUDevice;
  private bindGroup!: GPUBindGroup;

  private ballsPipeline!: GPUComputePipeline;
  private rodsPipeline!: GPUComputePipeline;
  private selectionDepthPipeline!: GPUComputePipeline;

  private subSteps!: number;

  private globalParameterBuffer!: GPUBuffer;
  private ballsBuffer!: GPUBuffer;
  private rodsBuffer!: GPUBuffer;
  private halfEdgeBuffer!: GPUBuffer;
  private velocityUpdateBuffer!: GPUBuffer;
  private outBuffer!: GPUBuffer;
  private triangleBuffer!: GPUBuffer;
  private triangleVertexBuffer!: GPUBuffer;
  private triangleNormalBuffer!: GPUBuffer;
  private stagingOutBuffer!: GPUBuffer;
  private stagingBallsBuffer!: GPUBuffer;

  initialize = async (objects:Array<Object>, timeStep:number, subSteps:number) => {

    if (navigator.gpu === undefined) alert('WebGPU is not supported');

    const adapter = await navigator.gpu!.requestAdapter();
    // ({powerPreference: 'high-performance'});
    // console.log(adapter!.limits);

    this.device = await adapter!.requestDevice({
      // requiredFeatures: ["timestamp-query"]
    });

    this.subSteps = subSteps;

    // buffers ////////////////////////////////////////////

    this.globalParameterBuffer = this.device.createBuffer({
      size: 4*12,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
    });
    this.setTimeAndSubStep(timeStep, subSteps);

    const [balls, rods, triangles] = objects;

    this.ballsBuffer = this.device.createBuffer({
      size: balls.maxCount * q * 4,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
    });
    this.device.queue.writeBuffer(this.ballsBuffer, 0, balls.data);
    balls.buffer = this.ballsBuffer;

    this.rodsBuffer = this.device.createBuffer({
      size: rods.maxCount * q * 4,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    this.device.queue.writeBuffer(this.rodsBuffer, 0, rods.data);
    rods.buffer = this.rodsBuffer;

    this.velocityUpdateBuffer = this.device.createBuffer({
      size: this.ballsBuffer.size / q * 3, // padding unnecessary
      usage: GPUBufferUsage.STORAGE
    });
    
    this.halfEdgeBuffer = this.device.createBuffer({
      size: this.rodsBuffer.size / q * 8,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
    });

    this.outBuffer = this.device.createBuffer({
      size: 16,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST
    });

    this.stagingOutBuffer = this.device.createBuffer({
      size: this.outBuffer.size,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
    });

    this.stagingBallsBuffer = this.device.createBuffer({
      size: this.ballsBuffer.size,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
    });

    this.resetOutBuffer();

    // triangle buffers

    this.triangleBuffer = this.device.createBuffer({
      size: q * 4,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
    });
    this.device.queue.writeBuffer(this.triangleBuffer, 0, triangles.data);
    triangles.buffer = this.triangleBuffer;

    this.triangleVertexBuffer = this.device.createBuffer({
      size: triangles.maxCount*9 * 4,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
    });

    this.triangleNormalBuffer = this.device.createBuffer({
      size: triangles.maxCount*9 * 4,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.VERTEX
    });

    const triangleIndexBuffer = this.device.createBuffer({
      size: triangles.maxCount*3 * 4,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.INDEX
    });
    this.device.queue.writeBuffer(triangleIndexBuffer, 0, triangles.mesh.indices);

    triangles.meshBuffers = {vertexBuffer:this.triangleVertexBuffer, normalBuffer:this.triangleNormalBuffer, indexBuffer:triangleIndexBuffer};

    // bindgroups and pipelines

    const bindGroupLayout = this.device.createBindGroupLayout({
      entries: [
        {binding:0, visibility:GPUShaderStage.COMPUTE, buffer:{type:'uniform'}}, // global parameters
        {binding:1, visibility:GPUShaderStage.COMPUTE, buffer:{type:'read-only-storage'}}, // halfEdges
        {binding:2, visibility:GPUShaderStage.COMPUTE, buffer:{type:'storage'}}, // velocityUpdate
        {binding:3, visibility:GPUShaderStage.COMPUTE, buffer:{type:'storage'}}, // balls
        {binding:4, visibility:GPUShaderStage.COMPUTE, buffer:{type:'storage'}}, // rods
        {binding:5, visibility:GPUShaderStage.COMPUTE, buffer:{type:'storage'}}, // out
        {binding:6, visibility:GPUShaderStage.COMPUTE, buffer:{type:'storage'}}, // triangleVertex
        {binding:7, visibility:GPUShaderStage.COMPUTE, buffer:{type:'storage'}}, // triangleNormal
      ]
    });

    const pipelineLayout = this.device.createPipelineLayout({bindGroupLayouts: [bindGroupLayout]});

    this.ballsPipeline = this.createCompPipe(pipelineLayout, header+intersection+ballsShader);
    this.rodsPipeline = this.createCompPipe(pipelineLayout, header+intersection+rodsShader);
    this.selectionDepthPipeline = this.createCompPipe(pipelineLayout, header+intersection+selectionDepth);

    this.bindGroup = this.device.createBindGroup({
      layout: bindGroupLayout,
      entries: [
        {binding: 0, resource: {buffer: this.globalParameterBuffer}},
        {binding: 1, resource: {buffer: this.halfEdgeBuffer}},
        {binding: 2, resource: {buffer: this.velocityUpdateBuffer}},
        {binding: 3, resource: {buffer: this.ballsBuffer}},
        {binding: 4, resource: {buffer: this.rodsBuffer}},
        {binding: 5, resource: {buffer: this.outBuffer}},
        {binding: 6, resource: {buffer: this.triangleVertexBuffer}},
        {binding: 7, resource: {buffer: this.triangleNormalBuffer}},
      ]
    });

    return this.device;
  }

  integration = (encoder:GPUCommandEncoder, ballCount:number, rodCount:number) => {

    this.computePass(encoder, this.rodsPipeline, this.bindGroup, rodCount);

    for (let s=0; s<this.subSteps; s++)
      this.computePass(encoder, this.ballsPipeline, this.bindGroup, ballCount);

  }

  depthTest = (rodCount:number) => {
    const encoder = this.device.createCommandEncoder();
    this.computePass(encoder, this.selectionDepthPipeline, this.bindGroup, rodCount);
    encoder.copyBufferToBuffer(this.outBuffer, 0, this.stagingOutBuffer, 0, this.outBuffer.size);
    this.device.queue.submit([encoder.finish()]);
  }

  workDone = async () => await this.device.queue.onSubmittedWorkDone();

  getOutBuffer = async () => {
    
    await this.stagingOutBuffer.mapAsync(GPUMapMode.READ);
    
    return new Int32Array(this.stagingOutBuffer.getMappedRange());  
  }

  resetOutBuffer = () => {
    this.stagingOutBuffer.unmap();
    this.device.queue.writeBuffer(this.outBuffer, 0, new Int32Array([2147483647, -1]));
  }

  getBallsBuffer = async () => {
    this.stagingBallsBuffer.unmap();

    const encoder = this.device.createCommandEncoder();
    encoder.copyBufferToBuffer(this.ballsBuffer, 0, this.stagingBallsBuffer, 0, this.ballsBuffer.size);
    this.device.queue.submit([encoder.finish()]);

    await this.stagingBallsBuffer.mapAsync(GPUMapMode.READ);
    
    return new Float32Array(this.stagingBallsBuffer.getMappedRange());  
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

  // hideFaces = (areHidden:boolean) => {
  //   this.device.queue.writeBuffer(this.triangleBuffer, 3*4, new Float32Array([areHidden?0:1]));
  // }

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

  setCompleteBallsAndRodsBuffer = (balls:Float32Array, rods:Float32Array) => {
    this.device.queue.writeBuffer(this.ballsBuffer, 0, balls);
    this.device.queue.writeBuffer(this.rodsBuffer, 0, rods);
  }

  resetTriangleVertexBuffer = () => {
    const zero = new Float32Array(this.triangleVertexBuffer.size/4);
    this.device.queue.writeBuffer(this.triangleVertexBuffer,0,zero)
  }

  setMouseRayAndEye = (ray:Float32Array, eye:Float32Array) => {
    this.device.queue.writeBuffer(this.globalParameterBuffer, 16, ray);
    this.device.queue.writeBuffer(this.globalParameterBuffer, 28, new Float32Array([1]));
    this.device.queue.writeBuffer(this.globalParameterBuffer, 32, eye);
  }

  makeMouseCoordsOldNews = () => {
    this.device.queue.writeBuffer(this.globalParameterBuffer, 28, new Float32Array([-1]));
    this.resetOutBuffer();
  }
}