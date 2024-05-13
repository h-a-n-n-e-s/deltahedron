import { Mesh, MeshBuffers, getMeshBuffers } from './mesh';
import { Camera } from './camera';
import { q } from './ballPark';
import header from './shader/header.wgsl?raw';
import shader from './shader/render.wgsl?raw';


export type Object = {
  instanceData: Float32Array;
  mesh: Mesh;
  count: number;
  maxCount: number;
}

export type ObjectGPUData = {
  meshbuffers: MeshBuffers;
  bindGroup: GPUBindGroup;
  count: number;
}

export class Render {

  private device!: GPUDevice;

  private canvas!: HTMLCanvasElement;
  private context!: GPUCanvasContext;

  private depthTexture!: GPUTexture;
  private multisampleTexture!: GPUTexture;

  private parameters!:Float32Array;

  private pipeline!:GPURenderPipeline;
  private renderPassDescriptor!:GPURenderPassDescriptor;

  private parameterBuffer!:GPUBuffer;
  
  private objectGPUDataList: Array<ObjectGPUData> = [];

  async initialize(canvasId:string, camera:Camera, objects:Array<Object>) {

    if (navigator.gpu === undefined) alert('WebGPU is not supported');

    const adapter = await navigator.gpu!.requestAdapter();
    // ({powerPreference: 'high-performance'});
    // console.log(adapter!.limits);

    this.device = await adapter!.requestDevice({
      // requiredFeatures: ["timestamp-query"]
    });

    this.canvas = document.createElement('canvas');
    this.canvas.id = canvasId;
    document.body.appendChild(this.canvas);

    this.context = this.canvas.getContext('webgpu') as GPUCanvasContext;
    const presentationFormat = navigator.gpu!.getPreferredCanvasFormat();
    this.context.configure({
      device: this.device,
      format: presentationFormat,
      alphaMode: 'premultiplied',
    });

    /////////////////////////////////////////////////////////

    const module = this.device.createShaderModule({
      label: 'ball shader',
      code: header + shader
    })

    this.pipeline = this.device.createRenderPipeline({
      label: 'pope',
      layout: 'auto',
      vertex: {
        module,
        entryPoint: 'vs',
        buffers: [
          {
            arrayStride: 12,
            attributes: [
              {shaderLocation: 0, offset:  0, format: 'float32x3'},  // position
            ],
          },
          {
            arrayStride: 12,
            attributes: [
              {shaderLocation: 1, offset: 0, format: 'float32x3'},  // normal
            ],
          }
        ],
      },
      fragment: {
        module,
        entryPoint: 'fs',
        targets: [{ format: presentationFormat }]
      },
      primitive: {
        topology: 'triangle-list',
        cullMode: 'back'
      },
      depthStencil: {
        depthWriteEnabled: true,
        depthCompare: 'less',
        format: 'depth24plus'
      },
      multisample: {
        count: 4
      }
    });

    this.renderPassDescriptor = {
      label: 'main renderPass',
      // @ts-ignore
      colorAttachments: [
        {
          view: {},
          resolveTarget: {},
          clearValue: [0, 0, 0, 1],
          loadOp: 'clear',
          storeOp: 'store',
        },
      ],
      depthStencilAttachment: {
        // @ts-ignore
        view: {},
        depthClearValue: 1.0,
        depthLoadOp: 'clear',
        depthStoreOp: 'store',
      },
    };

    // buffers //////////////////////////////////////////////

    // parameters

    this.parameters = new Float32Array(60);
    
    this.parameterBuffer = this.device.createBuffer({
      label: 'parameter',
      size: this.parameters.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    // directional light
    this.parameters.set([0, 0, -1, 1], 52); // direction and intensity
    // point light
    this.parameters.set([0, 0, 0, 0], 56); // position and intensity (0,0,-10,1)
    // kira
    this.parameters.set([0.15], 51);

    // map camera position and relevant matrices to parameter array
    camera.shaderParameterMapping(this.parameters);

    // object

    const objectBufferList = [];

    for (const obj of objects) {

      const objBuffer = this.device.createBuffer({
        label: 'object',
        size: obj.maxCount * q * 4,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      });
      objectBufferList.push(objBuffer);
      this.device.queue.writeBuffer(objBuffer, 0, obj.instanceData);

      const bindGroup = this.device.createBindGroup({
        layout: this.pipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: this.parameterBuffer }},
          { binding: 1, resource: { buffer: objBuffer }},
        ],
      });
      
      this.objectGPUDataList.push({
        meshbuffers: getMeshBuffers(this.device, obj.mesh),
        bindGroup: bindGroup,
        count: obj.count
      });
    }

    /////////////////////////////////////////////////////////

    this.resize(camera);

    return [this.device, objectBufferList] as [GPUDevice, Array<GPUBuffer>];
  }


  render(camera:Camera, commandEncoder?:GPUCommandEncoder) {

    const canvasTexture = this.context.getCurrentTexture();

    if (!this.depthTexture ||
      this.depthTexture.width !== canvasTexture.width ||
      this.depthTexture.height !== canvasTexture.height) {
      if (this.depthTexture) {
        this.depthTexture.destroy();
        this.multisampleTexture.destroy();
      }
      this.depthTexture = this.device.createTexture({
        size: [canvasTexture.width, canvasTexture.height],
        format: 'depth24plus',
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
        sampleCount: 4,
      });
      this.multisampleTexture = this.device.createTexture({
        size: [canvasTexture.width, canvasTexture.height],
        format: canvasTexture.format,
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
        sampleCount: 4,
      });
    }
    this.renderPassDescriptor.depthStencilAttachment!.view = this.depthTexture.createView();
    // @ts-ignore
    this.renderPassDescriptor.colorAttachments[0].view = this.multisampleTexture.createView();
    // @ts-ignore
    this.renderPassDescriptor.colorAttachments[0].resolveTarget = canvasTexture.createView(); // only in last render pass


    camera.getCameraMatrix();
    this.device.queue.writeBuffer(this.parameterBuffer, 0, this.parameters);

    const encoder = commandEncoder!==undefined ? commandEncoder : this.device.createCommandEncoder();

    
    const pass = encoder.beginRenderPass(this.renderPassDescriptor);
    pass.setPipeline(this.pipeline);

    for (const o of this.objectGPUDataList) {
      pass.setVertexBuffer(0, o.meshbuffers.vertexBuffer);
      pass.setVertexBuffer(1, o.meshbuffers.normalBuffer);
      pass.setIndexBuffer(o.meshbuffers.indexBuffer, 'uint32');
      pass.setBindGroup(0, o.bindGroup);
      pass.drawIndexed(o.meshbuffers.indexBuffer.size/4, o.count);
    }

    pass.end();

    if (commandEncoder===undefined) this.device.queue.submit([encoder.finish()]);
  }

  resize(camera:Camera) {

    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        const width = entry.devicePixelContentBoxSize?.[0].inlineSize ||
                      entry.contentBoxSize[0].inlineSize * devicePixelRatio;
        const height = entry.devicePixelContentBoxSize?.[0].blockSize ||
                      entry.contentBoxSize[0].blockSize * devicePixelRatio;
        const canvas = entry.target as HTMLCanvasElement;
        canvas.width = Math.max(1, Math.min(width, this.device.limits.maxTextureDimension2D));
        canvas.height = Math.max(1, Math.min(height, this.device.limits.maxTextureDimension2D));

        const aspect = canvas.clientWidth / canvas.clientHeight;
        
        camera.setPerspective(aspect);

      }
    });
    try {
      observer.observe(this.canvas, { box: 'device-pixel-content-box' });
    } catch {
      observer.observe(this.canvas, { box: 'content-box' });
    }
  }

  getCanvas = () => this.canvas;
}