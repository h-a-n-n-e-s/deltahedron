// textures.ts

// ------------------------------------------------------------------
// 1. THE SAVER (Matches your hdrloader.ts exactly)
// ------------------------------------------------------------------
export async function saveCubemapAsF16(
  device: GPUDevice,
  srcTexture: GPUTexture,
  filename: string,
  targetSize: number
) {
  const byteSize = targetSize * targetSize * 6 * 8
  const storageBuffer = device.createBuffer({
    size: byteSize,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
  })
  const stagingBuffer = device.createBuffer({
    size: byteSize,
    usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
  })

  const module = device.createShaderModule({
    code: `
      @group(0) @binding(0) var src: texture_cube<f32>;
      @group(0) @binding(1) var<storage, read_write> outBuf: array<vec2u>;
      @group(0) @binding(2) var sam: sampler;

      @compute @workgroup_size(8, 8, 1)
      fn main(@builtin(global_invocation_id) id: vec3u) {
        let size = ${targetSize}u;
        if (id.x >= size || id.y >= size) { return; }

        let a = (2.0 * (f32(id.x) + 0.5)) / f32(size) - 1.0;
        let b = (2.0 * (f32(id.y) + 0.5)) / f32(size) - 1.0;

        var dir: vec3f;
        // This MUST match hdrloader.ts face order: px, nx, py, ny, pz, nz
        switch (id.z) {
          case 0u: { dir = vec3f( a, -1.0, -b); } // posX
          case 1u: { dir = vec3f(-a,  1.0, -b); } // negX
          case 2u: { dir = vec3f(-b, -a,   1.0); } // posY
          case 3u: { dir = vec3f( b, -a,  -1.0); } // negY
          case 4u: { dir = vec3f(-1.0, -a, -b); } // posZ
          default: { dir = vec3f( 1.0,  a, -b); } // negZ
        }

        let color = textureSampleLevel(src, sam, normalize(dir), 0.0);
        let index = (id.z * size * size) + (id.y * size) + id.x;
        outBuf[index] = vec2u(pack2x16float(color.rg), pack2x16float(color.ba));
      }
    `,
  })

  const pipeline = device.createComputePipeline({
    layout: 'auto',
    compute: { module, entryPoint: 'main' },
  })

  const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: srcTexture.createView({ dimension: 'cube' }) },
      { binding: 1, resource: { buffer: storageBuffer } },
      { binding: 2, resource: device.createSampler({ minFilter: 'linear' }) },
    ],
  })

  const encoder = device.createCommandEncoder()
  const pass = encoder.beginComputePass()
  pass.setPipeline(pipeline)
  pass.setBindGroup(0, bindGroup)
  pass.dispatchWorkgroups(Math.ceil(targetSize / 8), Math.ceil(targetSize / 8), 6)
  pass.end()

  encoder.copyBufferToBuffer(storageBuffer, 0, stagingBuffer, 0, byteSize)
  device.queue.submit([encoder.finish()])

  await stagingBuffer.mapAsync(GPUMapMode.READ)
  const data = new Uint16Array(stagingBuffer.getMappedRange())
  const blob = new Blob([data], { type: 'application/octet-stream' })
  const aElement = document.createElement('a')
  aElement.href = URL.createObjectURL(blob)
  aElement.download = filename
  aElement.click()
  stagingBuffer.unmap()
}

// ------------------------------------------------------------------
// 2. THE LOADER
// ------------------------------------------------------------------
export async function loadCubemap(
  device: GPUDevice,
  url: string,
  size: number,
  mips: boolean = false
) {
  const res = await fetch(url)
  const buf = await res.arrayBuffer()
  const data = new Uint16Array(buf)

  const mipCount = mips ? Math.floor(Math.log2(size)) + 1 : 1

  const texture = device.createTexture({
    size: [size, size, 6],
    format: 'rgba16float',
    mipLevelCount: mipCount,
    usage:
      GPUTextureUsage.TEXTURE_BINDING |
      GPUTextureUsage.COPY_DST |
      GPUTextureUsage.RENDER_ATTACHMENT,
  })

  device.queue.writeTexture(
    { texture, mipLevel: 0 },
    data,
    { bytesPerRow: size * 8, rowsPerImage: size },
    [size, size, 6]
  )

  if (mips) {
    generateCubemapMips(device, texture)
  }

  return texture
}

// ------------------------------------------------------------------
// 3. MIP GENERATOR (Ensures reflections look correct at all roughnesses)
// ------------------------------------------------------------------
function generateCubemapMips(device: GPUDevice, texture: GPUTexture) {
  const sampler = device.createSampler({ minFilter: 'linear', magFilter: 'linear' })
  const pipeline = device.createRenderPipeline({
    layout: 'auto',
    vertex: {
      module: device.createShaderModule({
        code: `@vertex fn main(@builtin(vertex_index) i: u32) -> @builtin(position) vec4f {
          var pos = array<vec2f, 3>(vec2f(-1,-1), vec2f(3,-1), vec2f(-1,3));
          return vec4f(pos[i], 0.0, 1.0);
        }`,
      }),
      entryPoint: 'main',
    },
    fragment: {
      module: device.createShaderModule({
        code: `
          @group(0) @binding(0) var tex: texture_cube<f32>;
          @group(0) @binding(1) var sam: sampler;
          @group(0) @binding(2) var<uniform> face: u32;

          @fragment fn main(@builtin(position) pos: vec4f) -> @location(0) vec4f {
            let size = f32(textureDimensions(tex).x);
            let uv = pos.xy / size;
            let a = uv.x * 2.0 - 1.0;
            let b = uv.y * 2.0 - 1.0;
            var dir: vec3f;
            switch (face) {
              case 0u: { dir = vec3f( a, -1.0, -b); }
              case 1u: { dir = vec3f(-a,  1.0, -b); }
              case 2u: { dir = vec3f(-b, -a,   1.0); }
              case 3u: { dir = vec3f( b, -a,  -1.0); }
              case 4u: { dir = vec3f(-1.0, -a, -b); }
              default: { dir = vec3f( 1.0,  a, -b); }
            }
            return textureSampleLevel(tex, sam, normalize(dir), 0.0);
          }
        `,
      }),
      entryPoint: 'main',
      targets: [{ format: 'rgba16float' }],
    },
  })

  const encoder = device.createCommandEncoder()
  for (let level = 1; level < texture.mipLevelCount; level++) {
    for (let f = 0; f < 6; f++) {
      const faceBuf = device.createBuffer({
        size: 4,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      })
      device.queue.writeBuffer(faceBuf, 0, new Uint32Array([f]))

      const pass = encoder.beginRenderPass({
        colorAttachments: [
          {
            view: texture.createView({
              baseMipLevel: level,
              mipLevelCount: 1,
              baseArrayLayer: f,
              arrayLayerCount: 1,
            }),
            loadOp: 'clear',
            storeOp: 'store',
          },
        ],
      })
      pass.setPipeline(pipeline)
      pass.setBindGroup(
        0,
        device.createBindGroup({
          layout: pipeline.getBindGroupLayout(0),
          entries: [
            {
              binding: 0,
              resource: texture.createView({
                dimension: 'cube',
                baseMipLevel: level - 1,
                mipLevelCount: 1,
              }),
            },
            { binding: 1, resource: sampler },
            { binding: 2, resource: { buffer: faceBuf } },
          ],
        })
      )
      pass.draw(3)
      pass.end()
    }
  }
  device.queue.submit([encoder.finish()])
}
