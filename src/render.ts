import { Mesh, MeshBuffers, getMeshBuffers } from './mesh'
import { Camera } from './camera'
import header from './shader/header.wgsl?raw'
import shader from './shader/render.wgsl?raw'
import { Object } from './structure'
import { duplicateTexture, irradianceMap } from './irradiance'
import {
  createHDRCubeMapTexture,
  createHDRCubeMapSampler,
  createTextureFromImage,
  // downloadTextureAsBinary,
} from './textures'
import { F32Arr } from './compute'

export interface ObjectGPUData {
  meshbuffers: MeshBuffers
  bindGroup: GPUBindGroup
  object: Object
}

export class Render {
  private device!: GPUDevice

  private canvas!: HTMLCanvasElement
  private context!: GPUCanvasContext

  private canvasTexture!: GPUTexture
  private depthTexture!: GPUTexture
  private multisampleTexture!: GPUTexture

  private parameters!: F32Arr

  private pipeline!: GPURenderPipeline
  private trianglePipeline!: GPURenderPipeline
  private renderPassDescriptor!: GPURenderPassDescriptor

  private parameterBuffer!: GPUBuffer

  private objectGPUDataList: Array<ObjectGPUData> = []

  private cubeMapTexture!: GPUTexture
  private cubeMapSampler!: GPUSampler
  private irradianceTexture!: GPUTexture

  // private albedoTexture!: GPUTexture // we use custom color
  private amocTexture!: GPUTexture
  private normalTexture!: GPUTexture

  async init(
    device: GPUDevice,
    canvasId: string,
    camera: Camera,
    objects: Array<Object>,
    cubemap: string,
    tex: string
  ) {
    this.device = device

    this.canvas = document.createElement('canvas')
    this.canvas.id = canvasId
    document.body.appendChild(this.canvas)

    this.context = this.canvas.getContext('webgpu') as GPUCanvasContext

    const presentationFormat = navigator.gpu!.getPreferredCanvasFormat()
    // const presentationFormat = 'rgba32float'

    this.context.configure({
      device: this.device,
      format: presentationFormat,
      toneMapping: { mode: 'extended' },
      alphaMode: 'premultiplied',
    })

    // cube map ___________________________________________

    this.cubeMapSampler = createHDRCubeMapSampler(device)

    // this is slow, only do once and download
    this.cubeMapTexture = await createHDRCubeMapTexture(device, cubemap)

    // this is very expensive, only do once and download
    this.irradianceTexture = duplicateTexture(device, this.cubeMapTexture)
    await irradianceMap(device, this.cubeMapTexture, this.irradianceTexture)

    // do below once
    // download cubeMapTexture and irradianceTexture as binaries
    // downloadTextureAsBinary(this.device, this.cubeMapTexture, 'env_cubemap.bin')
    // downloadTextureAsBinary(this.device, this.irradianceTexture, 'irradiance.bin')

    // this.albedoTexture = await createTextureFromImage(device, tex + '/alb.jpg')
    this.amocTexture = await createTextureFromImage(device, tex + '/ao.jpg')
    this.normalTexture = await createTextureFromImage(device, tex + '/norm.jpg')

    // parameter buffer /////////////////////////

    this.parameters = new Float32Array(60)

    this.parameterBuffer = this.device.createBuffer({
      label: 'parameter',
      size: this.parameters.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    })

    // map camera position and relevant matrices to parameter array
    camera.shaderParameterMapping(this.parameters)

    if (camera.getEye() === undefined) throw new Error('camera eye not initialized')

    // ____________________________________________________

    const module = this.device.createShaderModule({
      code: header + shader,
    })

    const vertexBufferParas = (location: number) => {
      return {
        arrayStride: 12,
        attributes: [{ shaderLocation: location, offset: 0, format: 'float32x3' }],
      } as GPUVertexBufferLayout
    }

    const createPipeline = (
      vertexShader: string,
      fragmentShader: string,
      layout: GPUPipelineLayout
    ) =>
      this.device.createRenderPipeline({
        label: 'pope',
        layout: layout,
        vertex: {
          module,
          entryPoint: vertexShader,
          buffers: [
            vertexBufferParas(0), // position
            vertexBufferParas(1), // normal
            vertexBufferParas(2), // tangent (only used for triangles)
          ],
        },
        fragment: {
          module,
          entryPoint: fragmentShader,
          targets: [{ format: presentationFormat }],
        },
        primitive: {
          topology: 'triangle-list',
          cullMode: 'back',
        },
        depthStencil: {
          depthWriteEnabled: true,
          depthCompare: 'less',
          format: 'depth24plus',
        },
        multisample: {
          count: 4,
        },
      })

    this.renderPassDescriptor = {
      label: 'main renderPass',
      // @ts-ignore
      colorAttachments: [
        {
          view: {},
          resolveTarget: {},
          clearValue: [0, 0, 0, 0],
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
    }

    const ssV = GPUShaderStage.VERTEX
    const ssF = GPUShaderStage.FRAGMENT

    const bindGroupLayout = this.device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: ssV | ssF, buffer: { type: 'uniform' } },
        { binding: 1, visibility: ssV, buffer: { type: 'read-only-storage' } },
        { binding: 2, visibility: ssF, sampler: {} },
        { binding: 3, visibility: ssF, texture: { viewDimension: 'cube' } },
        { binding: 4, visibility: ssF, texture: { viewDimension: 'cube' } },
        // { binding: 5, visibility: ssF, texture: {} },
        { binding: 5, visibility: ssF, texture: {} },
        { binding: 6, visibility: ssF, texture: {} },
      ],
    })

    const pipelineLayout = this.device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] })

    this.pipeline = createPipeline('vs_instance', 'fs', pipelineLayout)
    this.trianglePipeline = createPipeline('vs_triangle', 'fs_texture', pipelineLayout)

    // objects

    for (const obj of objects) {
      let meshBuff: MeshBuffers

      if (obj.isInstancedMesh)
        // normal object
        meshBuff = getMeshBuffers(this.device, obj.mesh as Mesh)
      else if (obj.meshBuffers !== undefined) meshBuff = obj.meshBuffers
      else throw new Error('no mesh buffer')

      const bindGroup = this.device.createBindGroup({
        layout: bindGroupLayout,
        entries: [
          { binding: 0, resource: { buffer: this.parameterBuffer } },
          { binding: 1, resource: { buffer: obj.buffer as GPUBuffer } },
          { binding: 2, resource: this.cubeMapSampler },
          { binding: 3, resource: this.cubeMapTexture.createView({ dimension: 'cube' }) },
          { binding: 4, resource: this.irradianceTexture.createView({ dimension: 'cube' }) },
          // { binding: 5, resource: this.albedoTexture.createView() },
          { binding: 5, resource: this.amocTexture.createView() },
          { binding: 6, resource: this.normalTexture.createView() },
        ],
      })

      this.objectGPUDataList.push({
        meshbuffers: meshBuff!,
        bindGroup: bindGroup,
        object: obj,
      })
    }

    this.resize(camera)
  }

  render(camera: Camera, commandEncoder?: GPUCommandEncoder) {
    this.getCanvasDepthMultisampleTextures()

    camera.getCameraMatrix()
    this.updateTextureScan(0.3)
    this.device.queue.writeBuffer(this.parameterBuffer, 0, this.parameters as BufferSource)

    const encoder =
      commandEncoder !== undefined ? commandEncoder : this.device.createCommandEncoder()

    const pass = encoder.beginRenderPass(this.renderPassDescriptor)

    for (const o of this.objectGPUDataList) {
      if (!o.object.visible) continue

      pass.setVertexBuffer(0, o.meshbuffers.vertexBuffer)
      pass.setVertexBuffer(1, o.meshbuffers.normalBuffer)
      pass.setIndexBuffer(o.meshbuffers.indexBuffer, 'uint32')
      pass.setBindGroup(0, o.bindGroup)
      if (o.object.isInstancedMesh) {
        pass.setPipeline(this.pipeline)
        pass.setVertexBuffer(2, o.meshbuffers.normalBuffer) // dummy but needs to be set
        pass.drawIndexed(o.meshbuffers.indexBuffer.size / 4, o.object.count)
      } else {
        pass.setPipeline(this.trianglePipeline)
        if (o.meshbuffers.tangentBuffer !== undefined)
          pass.setVertexBuffer(2, o.meshbuffers.tangentBuffer)
        pass.drawIndexed(3 * o.object.count, 1)
      }
    }

    pass.end()

    if (commandEncoder === undefined) this.device.queue.submit([encoder.finish()])
  }

  updateTextureScan(scale: number) {
    let height = Math.sqrt(3) / 2
    let total = this.objectGPUDataList[2].object.count // triangleCount
    let linearTextureSteps = Math.ceil(Math.sqrt(total))
    let dx = (1 - scale) / (linearTextureSteps - 1)
    let dy = (1 - scale * height) / (linearTextureSteps - 1)
    this.parameters.set([scale, linearTextureSteps, dx, dy, height], 51)
  }

  resize(camera: Camera) {
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const width =
          entry.devicePixelContentBoxSize?.[0].inlineSize ||
          entry.contentBoxSize[0].inlineSize * devicePixelRatio
        const height =
          entry.devicePixelContentBoxSize?.[0].blockSize ||
          entry.contentBoxSize[0].blockSize * devicePixelRatio
        const canvas = entry.target as HTMLCanvasElement
        canvas.width = Math.max(1, Math.min(width, this.device.limits.maxTextureDimension2D))
        canvas.height = Math.max(1, Math.min(height, this.device.limits.maxTextureDimension2D))

        const aspect = canvas.clientWidth / canvas.clientHeight

        camera.setPerspective(aspect)
      }
    })
    try {
      observer.observe(this.canvas, { box: 'device-pixel-content-box' })
    } catch {
      observer.observe(this.canvas, { box: 'content-box' })
    }
  }

  getCanvasDepthMultisampleTextures() {
    this.canvasTexture = this.context.getCurrentTexture()

    if (
      !this.depthTexture ||
      this.depthTexture.width !== this.canvasTexture.width ||
      this.depthTexture.height !== this.canvasTexture.height
    ) {
      if (this.depthTexture) {
        this.depthTexture.destroy()
        this.multisampleTexture.destroy()
      }
      this.depthTexture = this.device.createTexture({
        size: [this.canvasTexture.width, this.canvasTexture.height],
        format: 'depth24plus',
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
        sampleCount: 4,
      })
      this.multisampleTexture = this.device.createTexture({
        size: [this.canvasTexture.width, this.canvasTexture.height],
        format: this.canvasTexture.format,
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
        sampleCount: 4,
      })
    }
    this.renderPassDescriptor.depthStencilAttachment!.view = this.depthTexture.createView()
    // @ts-ignore
    this.renderPassDescriptor.colorAttachments[0].view = this.multisampleTexture.createView()
    // @ts-ignore
    this.renderPassDescriptor.colorAttachments[0].resolveTarget = this.canvasTexture.createView() // only in last render pass
  }

  getCanvas = () => this.canvas
}
