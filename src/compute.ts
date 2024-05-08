
import header from './header.wgsl?raw';
import boundary from './boundary.wgsl?raw';
import intersection from './intersection.wgsl?raw';
import integrationShader from './integration.wgsl?raw';
import rodsShader from './rods.wgsl?raw';

export class Compute {

  private device!: GPUDevice;
  private integrationPipeline!: GPUComputePipeline;
  private rodsPipeline!: GPUComputePipeline;
  private bindGroup!: GPUBindGroup;

  private ballBufferSize!: number;

  private subSteps!: number;

  private globalParameterBuffer!: GPUBuffer;

  private ballsBuffer!: GPUBuffer;
  private rodsBuffer!: GPUBuffer;
  private edgeBuffer!: GPUBuffer;
  private connectionBuffer!: GPUBuffer;
  private stagingBallBuffer!: GPUBuffer;
  
  private numberOfBalls!: number;
  private numberOfRods!: number;

  initialize = (device:GPUDevice, count:number[], balls:Float32Array, bound:Array<number>, dissipation:number, wallDissipation:number, timeStep:number, subSteps:number, objectBufferList:Array<GPUBuffer>) => {

    this.device = device;
    this.numberOfBalls = count[0];
    this.numberOfRods = count[1];
    this.ballBufferSize = balls.byteLength;
    this.subSteps = subSteps;

    // buffers ////////////////////////////////////////////

    this.globalParameterBuffer = this.device.createBuffer({
      size: 4*16,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });
    this.device.queue.writeBuffer(this.globalParameterBuffer, 0, new Float32Array([
      bound[0],
      bound[1],
      bound[2],
      wallDissipation,
      dissipation,
      timeStep/subSteps
    ]));

    [this.ballsBuffer, this.rodsBuffer] = objectBufferList;
    this.device.queue.writeBuffer(this.ballsBuffer, 0, balls)

    this.connectionBuffer = this.device.createBuffer({
      size: this.numberOfBalls * 16 * 4,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
    });
    
    this.edgeBuffer = this.device.createBuffer({
      size: this.numberOfRods * 2 * 4,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
    });

    this.stagingBallBuffer = this.device.createBuffer({
      size: this.ballBufferSize,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
    });

    // pipelines //////////////////////////////////////////

    // integration

    const bindGroupLayout = this.device.createBindGroupLayout({
      entries: [
        {binding:0, visibility:GPUShaderStage.COMPUTE, buffer:{type:'uniform'}}, // global parameters
        {binding:1, visibility:GPUShaderStage.COMPUTE, buffer:{type:'read-only-storage'}}, // connectionList
        {binding:2, visibility:GPUShaderStage.COMPUTE, buffer:{type:'read-only-storage'}}, // edges
        {binding:3, visibility:GPUShaderStage.COMPUTE, buffer:{type:'storage'}}, // balls
        {binding:4, visibility:GPUShaderStage.COMPUTE, buffer:{type:'storage'}}, // rods
      ]
    });

    const pipelineLayout = this.device.createPipelineLayout({bindGroupLayouts: [bindGroupLayout]});

    this.integrationPipeline = this.createCompPipe(pipelineLayout, header+boundary+intersection+integrationShader);
    this.rodsPipeline = this.createCompPipe(pipelineLayout, header+rodsShader);

    this.bindGroup = this.device.createBindGroup({
      label: 'integrationBindGroup',
      layout: bindGroupLayout,
      entries: [
        {binding: 0, resource: {buffer: this.globalParameterBuffer}},
        {binding: 1, resource: {buffer: this.connectionBuffer}},
        {binding: 2, resource: {buffer: this.edgeBuffer}},
        {binding: 3, resource: {buffer: this.ballsBuffer}},
        {binding: 4, resource: {buffer: this.rodsBuffer}},
      ]
    });
  }

  // integration = () => {

  //   const commandEncoder = this.device.createCommandEncoder();

  //   commandEncoder.copyBufferToBuffer(this.newBallsBuffer, 0, this.ballsBuffer, 0, this.ballBufferSize);

  //   for (let s=0; s<this.subSteps; s++) {
  //     commandEncoder.copyBufferToBuffer(this.newBallsBuffer, 0, this.ballsBuffer, 0, this.ballBufferSize);
  //     this.computePass(commandEncoder, this.integrationPipeline, this.integrationBindGroup, this.numberOfBalls);
  //     commandEncoder.copyBufferToBuffer(this.newBallsBuffer, 0, this.stagingBallBuffer, 0, this.ballBufferSize);
  //   }

  //   this.stagingBallBuffer.unmap();
    
  //   this.device.queue.submit([commandEncoder.finish()]);
  // }

  pureIntegration = (encoder:GPUCommandEncoder) => {
    for (let s=0; s<this.subSteps; s++)
      this.computePass(encoder, this.integrationPipeline, this.bindGroup, this.numberOfBalls);

    this.computePass(encoder, this.rodsPipeline, this.bindGroup, this.numberOfRods);
  }

  result = async () => {

    await this.stagingBallBuffer.mapAsync(GPUMapMode.READ);
    return new Float32Array(this.stagingBallBuffer.getMappedRange());

    // await this.device.queue.onSubmittedWorkDone();
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

  setGravity = (g:number) =>
    this.device.queue.writeBuffer(this.globalParameterBuffer, 24, new Float32Array([g]));

  setBound = (w:number, h:number) =>
    this.device.queue.writeBuffer(this.globalParameterBuffer, 0, new Float32Array([w, h]));

  setConnectionBuffer = (connection:Int32Array) =>
    this.device.queue.writeBuffer(this.connectionBuffer, 0, connection);

  setEdgeBuffer = (edges:Uint32Array) =>
    this.device.queue.writeBuffer(this.edgeBuffer, 0, edges);

  setRodsBuffer = (index:number, rod:Float32Array) =>
    this.device.queue.writeBuffer(this.rodsBuffer, index*4, rod);

  setMouseRayAndEye = (ray:Float32Array, eye:Float32Array) => {
    this.device.queue.writeBuffer(this.globalParameterBuffer, 32, ray);
    this.device.queue.writeBuffer(this.globalParameterBuffer, 44, new Float32Array([1]));
    this.device.queue.writeBuffer(this.globalParameterBuffer, 48, eye);
  }

  makeMouseCoordsOldNews = () =>
    this.device.queue.writeBuffer(this.globalParameterBuffer, 44, new Float32Array([-1]));
}