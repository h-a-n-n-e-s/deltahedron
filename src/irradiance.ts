import irradianceShader from './shader/irradiance.wgsl?raw'

export function duplicateTexture(device: GPUDevice, texture: GPUTexture) {
  return device.createTexture({
    format: 'rgba32float',
    mipLevelCount: 1,
    size: [texture.width, texture.height, 6],
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
  })
}

export async function irradianceMap(
  device: GPUDevice,
  texture: GPUTexture,
  irradianceTexture: GPUTexture
) {
  const diffuseStorageTexture = device.createTexture({
    format: 'rgba32float',
    mipLevelCount: 1,
    size: [irradianceTexture.width, irradianceTexture.height, 6],
    usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.STORAGE_BINDING,
  })

  const sampler = device.createSampler({
    label: 'Compute diffuse sampler',
    addressModeU: 'clamp-to-edge',
    addressModeV: 'clamp-to-edge',
    minFilter: 'linear',
    magFilter: 'linear',
  })

  const pipeline = device.createComputePipeline({
    layout: 'auto',
    compute: {
      module: device.createShaderModule({ code: irradianceShader }),
      entryPoint: 'main',
    },
  })

  const paramsBuffer = device.createBuffer({
    size: 4 * 4,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
  })
  device.queue.writeBuffer(
    paramsBuffer,
    0,
    new Uint32Array([irradianceTexture.width, texture.mipLevelCount, 512, 0])
  )

  const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: paramsBuffer } },
      { binding: 1, resource: sampler },
      { binding: 2, resource: texture.createView({ dimension: 'cube' }) },
      { binding: 3, resource: diffuseStorageTexture.createView() },
    ],
  })

  const commandEncoder = device.createCommandEncoder()

  const passEncoder = commandEncoder.beginComputePass()
  passEncoder.setPipeline(pipeline)
  passEncoder.setBindGroup(0, bindGroup)
  passEncoder.dispatchWorkgroups(
    Math.ceil(irradianceTexture.width / 8),
    Math.ceil(irradianceTexture.height / 8),
    6
  )
  passEncoder.end()

  commandEncoder.copyTextureToTexture(
    { texture: diffuseStorageTexture },
    { texture: irradianceTexture },
    [irradianceTexture.width, irradianceTexture.height, 6]
  )

  device.queue.submit([commandEncoder.finish()])

  await device.queue.onSubmittedWorkDone()
}
