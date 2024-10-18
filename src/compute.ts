
import { q } from './ballPark';
import header from './shader/header.wgsl?raw';
import intersection from './shader/intersection.wgsl?raw';
import ballsShader from './shader/balls.wgsl?raw';
import rodsShader from './shader/rods.wgsl?raw';
import trianglesShader from './shader/triangles.wgsl?raw';
import rodScan from './shader/rodScan.wgsl?raw';
import { Object } from './structure';

export class Compute {

  private device!: GPUDevice;
  private bindGroup!: GPUBindGroup;
  private triangleBindGroup!: GPUBindGroup;

  private ballsPipeline!: GPUComputePipeline;
  private rodsPipeline!: GPUComputePipeline;
  private trianglesPipeline!: GPUComputePipeline;
  private rodScanPipeline!: GPUComputePipeline;

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
  private triangleTangentBuffer!: GPUBuffer;
  private triangleIndexBuffer!: GPUBuffer;
  private stagingOutBuffer!: GPUBuffer;
  private stagingBuffer!: GPUBuffer;

  initialize = async (objects:Array<Object>, timeStep:number, subSteps:number) => {

    if (navigator.gpu === undefined) alert('WebGPU is not supported');

    const adapter = await navigator.gpu!.requestAdapter();
    // ({powerPreference: 'high-performance'});
    // console.log(adapter!.limits);

    this.device = await adapter!.requestDevice({
      // requiredFeatures: ['timestamp-query']
      requiredFeatures: ['float32-filterable'] // for hdr 
    });

    this.subSteps = subSteps;

    // buffers ////////////////////////////////////////////

    this.globalParameterBuffer = this.device.createBuffer({
      size: 4*20,
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
      size: 32,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST
    });

    this.stagingOutBuffer = this.device.createBuffer({
      size: this.outBuffer.size,
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
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_SRC
    });

    this.triangleNormalBuffer = this.device.createBuffer({
      size: triangles.maxCount*9 * 4,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.VERTEX
    });

    this.triangleTangentBuffer = this.device.createBuffer({
      size: triangles.maxCount*9 * 4,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.VERTEX
    });

    this.triangleIndexBuffer = this.device.createBuffer({
      size: triangles.maxCount*3 * 4,
      usage:  GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
    });
    this.device.queue.writeBuffer(this.triangleIndexBuffer, 0, triangles.mesh.indices);

    const indexBuffer = this.device.createBuffer({
      size: triangles.maxCount*3 * 4,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.INDEX
    });
    const ind = new Uint32Array(triangles.maxCount*3);
    for (let i=0; i<triangles.maxCount*3; i++) ind[i] = i;
    this.device.queue.writeBuffer(indexBuffer, 0, ind);

    triangles.meshBuffers = {vertexBuffer:this.triangleVertexBuffer, normalBuffer:this.triangleNormalBuffer, indexBuffer:indexBuffer, tangentBuffer:this.triangleTangentBuffer};

    // general staging buffer
    this.stagingBuffer = this.device.createBuffer({
      size: Math.max(this.ballsBuffer.size, this.triangleVertexBuffer.size),
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
    });

    // bindgroups and pipelines _______________________________________________

    const ssc = GPUShaderStage.COMPUTE;

    const bindGroupLayout = this.device.createBindGroupLayout({
      entries: [
        {binding:0, visibility:ssc, buffer:{type:'uniform'}}, // global parameters
        {binding:1, visibility:ssc, buffer:{type:'read-only-storage'}}, // halfEdges
        {binding:2, visibility:ssc, buffer:{type:'storage'}}, // velocityUpdate
        {binding:3, visibility:ssc, buffer:{type:'storage'}}, // balls
        {binding:4, visibility:ssc, buffer:{type:'storage'}}, // rods
        {binding:5, visibility:ssc, buffer:{type:'storage'}}, // out
      ]
    });

    // necessary to separate the triangle stage cuz total storage buffer count > 8
    const triangleBindGroupLayout = this.device.createBindGroupLayout({
      entries: [
        {binding:0, visibility:ssc, buffer:{type:'uniform'}}, // global parameters
        {binding:1, visibility:ssc, buffer:{type:'storage'}}, // velocityUpdate
        {binding:2, visibility:ssc, buffer:{type:'storage'}}, // balls
        {binding:3, visibility:ssc, buffer:{type:'storage'}}, // out
        {binding:4, visibility:ssc, buffer:{type:'storage'}}, // triangleVertex
        {binding:5, visibility:ssc, buffer:{type:'storage'}}, // triangleNormal
        {binding:6, visibility:ssc, buffer:{type:'storage'}}, // triangleTangent
        {binding:7, visibility:ssc, buffer:{type:'read-only-storage'}}, // triangleIndex
      ]
    });

    const pipelineLayout = this.device.createPipelineLayout({bindGroupLayouts: [bindGroupLayout]});
    const trianglePipelineLayout = this.device.createPipelineLayout({bindGroupLayouts: [triangleBindGroupLayout]});

    this.ballsPipeline = this.createCompPipe(pipelineLayout,
      header+intersection+ballsShader);
    this.rodsPipeline = this.createCompPipe(pipelineLayout,
      header+intersection+rodsShader);
    this.trianglesPipeline = this.createCompPipe(trianglePipelineLayout,
      header+intersection+trianglesShader);
    this.rodScanPipeline = this.createCompPipe(pipelineLayout,
      header+rodScan);

    this.bindGroup = this.device.createBindGroup({
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

    this.triangleBindGroup = this.device.createBindGroup({
      layout: triangleBindGroupLayout,
      entries: [
        {binding: 0, resource: {buffer: this.globalParameterBuffer}},
        {binding: 1, resource: {buffer: this.velocityUpdateBuffer}},
        {binding: 2, resource: {buffer: this.ballsBuffer}},
        {binding: 3, resource: {buffer: this.outBuffer}},
        {binding: 4, resource: {buffer: this.triangleVertexBuffer}},
        {binding: 5, resource: {buffer: this.triangleNormalBuffer}},
        {binding: 6, resource: {buffer: this.triangleTangentBuffer}},
        {binding: 7, resource: {buffer: this.triangleIndexBuffer}},
      ]
    });

    return this.device;
  }

  integration = (encoder:GPUCommandEncoder, ballCount:number, rodCount:number, triangleCount:number) => {

    this.computePass(encoder, this.rodsPipeline, this.bindGroup, rodCount);

    this.resetCentroidAndVolume();

    for (let s=0; s<this.subSteps; s++)
      this.computePass(encoder, this.ballsPipeline, this.bindGroup, ballCount);

    this.computePass(encoder, this.trianglesPipeline, this.triangleBindGroup, triangleCount);
  }

  rodScan = (rodCount:number) => {

    const encoder = this.device.createCommandEncoder();

    this.computePass(encoder, this.rodScanPipeline, this.bindGroup, rodCount);

    encoder.copyBufferToBuffer(this.outBuffer, 0, this.stagingOutBuffer, 0, this.outBuffer.size);

    this.device.queue.submit([encoder.finish()]);
  }

  selectRodScanBranch = (branch:string) => {
    let branchIndex = 0;
    
    if (branch === 'depthTest') branchIndex = 1;
    else if (branch === 'nextBall') branchIndex = 2;
    else if (branch === 'maxError') branchIndex = 3;
    
    this.device.queue.writeBuffer(this.globalParameterBuffer, 72, new Uint32Array([branchIndex]));
  };

  workDone = async () => await this.device.queue.onSubmittedWorkDone();

  getOutBuffer = async () => {
    
    await this.stagingOutBuffer.mapAsync(GPUMapMode.READ);
    
    return new Int32Array(this.stagingOutBuffer.getMappedRange());  
  }

  resetOutBuffer = () => {
    this.stagingOutBuffer.unmap();
    this.device.queue.writeBuffer(this.outBuffer, 0, new Int32Array([2147483647, -1]));
  }

  resetCentroidAndVolume = () => {
    this.stagingOutBuffer.unmap();
    this.device.queue.writeBuffer(this.outBuffer, 16, new Int32Array([0,0,0,0]));
  }

  resetError = () => {
    this.stagingOutBuffer.unmap();
    this.device.queue.writeBuffer(this.outBuffer, 8, new Int32Array([0]));
  }

  getBuffer = async (bufferName:string) => {
    
    let buffer;
    if (bufferName === 'balls') buffer = this.ballsBuffer;
    else if (bufferName === 'triangles') buffer = this.triangleVertexBuffer;
    else throw new Error('no buffer');
    
    this.stagingBuffer.unmap();

    const encoder = this.device.createCommandEncoder();
    encoder.copyBufferToBuffer(buffer, 0, this.stagingBuffer, 0, buffer.size);
    this.device.queue.submit([encoder.finish()]);

    await this.stagingBuffer.mapAsync(GPUMapMode.READ);
    
    return new Float32Array(this.stagingBuffer.getMappedRange());
  }

  getGlobalParameterBuffer = () => this.globalParameterBuffer;
  
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
    this.device.queue.writeBuffer(this.globalParameterBuffer, 12, new Float32Array([
      dt/sub
    ]));
  };
  
  setNewBallRodIndex = (newBallRodIndex:number) => {
    this.device.queue.writeBuffer(this.globalParameterBuffer, 68, new Uint32Array([newBallRodIndex]));
  };

  setGravity = (g:number) =>
    this.device.queue.writeBuffer(this.globalParameterBuffer, 44, new Float32Array([g]));

  setCount = (ballCount:number, rodCount:number, triangleCount:number) =>
    this.device.queue.writeBuffer(this.globalParameterBuffer, 0, new Uint32Array([ballCount, rodCount, triangleCount]));

  setHalfEdgeBuffer = (halfEdges:Uint32Array) =>
    this.device.queue.writeBuffer(this.halfEdgeBuffer, 0, halfEdges);

  setBallsBuffer = (index:number, ball:Float32Array, complete=true) => {
    if (complete)
      this.device.queue.writeBuffer(this.ballsBuffer, index*q*4, ball);
    else { // exclude postion and velocity
      this.device.queue.writeBuffer(this.ballsBuffer, (index*q+3)*4, ball.slice(3,12));
      this.device.queue.writeBuffer(this.ballsBuffer, (index*q+15)*4, ball.slice(15,q));
    }
  }
  
  setRodsBuffer = (index:number, rod:Float32Array) =>
    this.device.queue.writeBuffer(this.rodsBuffer, index*q*4, rod);

  setRodsBufferColor = (index:number, rod:Float32Array) =>
    this.device.queue.writeBuffer(this.rodsBuffer, (index*q+8)*4, rod.slice(8,12));

  setCompleteBallsAndRodsBuffer = (balls:Float32Array, rods:Float32Array) => {
    this.device.queue.writeBuffer(this.ballsBuffer, 0, balls);
    this.device.queue.writeBuffer(this.rodsBuffer, 0, rods);
  }

  setTriangleIndexBuffer = (indexArray:Uint32Array) => {
    // const zero = new Float32Array(this.triangleVertexBuffer.size/4);
    this.device.queue.writeBuffer(this.triangleIndexBuffer, 0, indexArray)
  }

  setTrianglesVisibility = (visible:boolean) =>
    this.device.queue.writeBuffer(this.globalParameterBuffer, 60, new Uint32Array([visible ? 1 : 0]));
  
  setRodsVisibility = (rodsVisible:boolean) =>
    this.device.queue.writeBuffer(this.globalParameterBuffer, 56, new Uint32Array([rodsVisible ? 1 : 0]));

  setBallsVisibility = (ballsVisible:boolean) =>
    this.device.queue.writeBuffer(this.globalParameterBuffer, 52, new Uint32Array([ballsVisible ? 1 : 0]));

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