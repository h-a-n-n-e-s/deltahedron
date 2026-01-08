import { HDRImageData, HDRLoader } from './hdrloader'

// translated to TypeScript and modified for hdr format from
// https://webgpufundamentals.org/webgpu/lessons/webgpu-environment-maps.html

// creating HDR cube maps for environment lighting
export async function createHDRCubeMapTexture(device: GPUDevice, path: string) {
  return await textureFromHDRImages(device, [
    path + '/px.hdr',
    path + '/nx.hdr',
    path + '/py.hdr',
    path + '/ny.hdr',
    path + '/pz.hdr',
    path + '/nz.hdr',
  ])
}

export function createHDRCubeMapSampler(device: GPUDevice) {
  return device.createSampler({
    minFilter: 'linear',
    magFilter: 'linear',
    mipmapFilter: 'linear',
  })
}

export async function createTextureFromImage(device: GPUDevice, url: RequestInfo) {
  const res = await fetch(url)
  const blob = await res.blob()
  const source = await createImageBitmap(blob, { colorSpaceConversion: 'none' })
  const texture = device.createTexture({
    format: 'rgba8unorm',
    mipLevelCount: numMipLevels(source.width, source.height),
    size: [source.width, source.height],
    usage:
      GPUTextureUsage.TEXTURE_BINDING |
      GPUTextureUsage.COPY_DST |
      GPUTextureUsage.RENDER_ATTACHMENT,
  })
  device.queue.copyExternalImageToTexture(
    { source },
    { texture },
    { width: source.width, height: source.height }
  )
  if (texture.mipLevelCount > 1) generateMips(device, texture)
  return texture
}

// HDR helper functions _______________________________________________________

async function textureFromHDRImages(device: GPUDevice, urls: Array<string>) {
  const hdrLoader = new HDRLoader()
  const images = await Promise.all(urls.map(hdrLoader.loadFromUrl, hdrLoader))
  return textureFromHDRSources(device, images)
}

function textureFromHDRSources(device: GPUDevice, sources: Array<HDRImageData>) {
  // Assume all sources to be the same size so just use the first one for width and height
  const source = sources[0]
  const texture = device.createTexture({
    format: 'rgba32float',
    mipLevelCount: numMipLevels(source.width, source.height),
    size: [source.width, source.height, sources.length],
    usage:
      GPUTextureUsage.TEXTURE_BINDING |
      GPUTextureUsage.COPY_DST |
      GPUTextureUsage.RENDER_ATTACHMENT,
  })
  copyHDRSourcesToTexture(device, texture, sources)
  return texture
}

function copyHDRSourcesToTexture(
  device: GPUDevice,
  texture: GPUTexture,
  sources: Array<HDRImageData>
) {
  sources.forEach((source, layer) => {
    device.queue.writeTexture(
      { texture: texture, origin: [0, 0, layer] },
      source.data as GPUAllowSharedBufferSource,
      {
        bytesPerRow: source.width * source.data.BYTES_PER_ELEMENT * 4,
        rowsPerImage: source.height,
      },
      [source.width, source.height]
    )
  })
  if (texture.mipLevelCount > 1) generateMips(device, texture)
}

// mips _______________________________________________________________________

const numMipLevels = (width: number, height: number) => {
  const maxSize = Math.max(width, height)
  return (1 + Math.log2(maxSize)) | 0
}

function generateMips(device: GPUDevice, texture: GPUTexture) {
  const module = device.createShaderModule({
    label: 'textured quad shaders for mip level generation',
    code: `
      struct VSOutput {
        @builtin(position) position: vec4f,
        @location(0) texcoord: vec2f,
      };

      @vertex fn vs(
        @builtin(vertex_index) vertexIndex : u32
      ) -> VSOutput {
        let pos = array(

          vec2f( 0.0,  0.0),  // center
          vec2f( 1.0,  0.0),  // right, center
          vec2f( 0.0,  1.0),  // center, top

          // 2st triangle
          vec2f( 0.0,  1.0),  // center, top
          vec2f( 1.0,  0.0),  // right, center
          vec2f( 1.0,  1.0),  // right, top
        );

        var vsOutput: VSOutput;
        let xy = pos[vertexIndex];
        vsOutput.position = vec4f(xy * 2.0 - 1.0, 0.0, 1.0);
        vsOutput.texcoord = vec2f(xy.x, 1.0 - xy.y);
        return vsOutput;
      }

      @group(0) @binding(0) var ourSampler: sampler;
      @group(0) @binding(1) var ourTexture: texture_2d<f32>;

      @fragment fn fs(fsInput: VSOutput) -> @location(0) vec4f {
        return textureSample(ourTexture, ourSampler, fsInput.texcoord);
      }
    `,
  })

  const sampler = device.createSampler({
    minFilter: 'linear',
    magFilter: 'linear',
  })

  const pipeline = device.createRenderPipeline({
    label: 'mip level generator pipeline',
    layout: 'auto',
    vertex: {
      module,
    },
    fragment: {
      module,
      targets: [{ format: texture.format }],
    },
  })

  const encoder = device.createCommandEncoder({
    label: 'mip gen encoder',
  })

  let width = texture.width
  let height = texture.height
  let baseMipLevel = 0
  while (width > 1 || height > 1) {
    width = Math.max(1, (width / 2) | 0)
    height = Math.max(1, (height / 2) | 0)

    for (let layer = 0; layer < texture.depthOrArrayLayers; ++layer) {
      const bindGroup = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: sampler },
          {
            binding: 1,
            resource: texture.createView({
              dimension: '2d',
              baseMipLevel,
              mipLevelCount: 1,
              baseArrayLayer: layer,
              arrayLayerCount: 1,
            }),
          },
        ],
      })

      const renderPassDescriptor = {
        label: 'our basic canvas renderPass',
        colorAttachments: [
          {
            view: texture.createView({
              dimension: '2d',
              baseMipLevel: baseMipLevel + 1,
              mipLevelCount: 1,
              baseArrayLayer: layer,
              arrayLayerCount: 1,
            }),
            loadOp: 'clear',
            storeOp: 'store',
          },
        ],
      } as GPURenderPassDescriptor

      const pass = encoder.beginRenderPass(renderPassDescriptor)
      pass.setPipeline(pipeline)
      pass.setBindGroup(0, bindGroup)
      pass.draw(6) // call our vertex shader 6 times
      pass.end()
    }
    ++baseMipLevel
  }

  const commandBuffer = encoder.finish()
  device.queue.submit([commandBuffer])
}
