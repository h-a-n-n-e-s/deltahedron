// adapted from
// https://github.com/martinlaxenaire/gpu-curtains/blob/main/src/extras/gltf/utils.ts

struct Para {
  faceSize: u32,
  maxMipLevel: u32,
  sampleCount: u32
}

const PI = 3.1415926535897;

@group(0) @binding(0) var<uniform> params: Para;
@group(0) @binding(1) var sam: sampler;
@group(0) @binding(2) var specularTexture: texture_cube<f32>;
@group(0) @binding(3) var irradianceTexture: texture_storage_2d_array<rgba32float, write>;

@compute @workgroup_size(8, 8, 1) fn main(
  @builtin(global_invocation_id) GlobalInvocationID: vec3u,
) {
  let faceSize: u32 = params.faceSize;
  let sampleCount: u32 = params.sampleCount;
  
  let face: u32 = GlobalInvocationID.z;
  let x: u32 = GlobalInvocationID.x;
  let y: u32 = GlobalInvocationID.y;

  if (x >= faceSize || y >= faceSize) {
      return;
  }

  let texelSize: f32 = 1.0 / f32(faceSize);
  let halfTexel: f32 = texelSize * 0.5;
  
  var uv: vec2f = vec2(
    (f32(x) + halfTexel) * texelSize,
    (f32(y) + halfTexel) * texelSize
  );
  
  uv = uv * 2.0 - 1.0;

  let normal: vec3<f32> = transformDirection(face, uv);
  
  var irradiance: vec3f = vec3f(0.0, 0.0, 0.0);

  for (var i: u32 = 0; i < sampleCount; i++) {
    // generate a quasi monte carlo point in the unit square [0.1)^2
    let xi: vec2f = hammersley2d(i, sampleCount);
    
    let cosTheta: f32 = sqrt(1.0 - xi.y);
    let sinTheta: f32 = sqrt(1.0 - cosTheta * cosTheta);
    let phi: f32 = 2.0 * PI * xi.x;
    let pdf: f32 = cosTheta / PI; // evaluation for solid angle, therefore drop the sinTheta

    let sampleVec: vec3f = vec3f(
        sinTheta * cos(phi),
        sinTheta * sin(phi),
        cosTheta
    );
    
    let TBN: mat3x3f = generateTBN(normalize(normal));
    
    var direction: vec3f = TBN * sampleVec;
    
    // invert along Y axis
    direction.y *= -1.0;
    
    let lod: f32 = computeLod(pdf);

    // Convert sampleVec to texture coordinates of the specular env map
    irradiance += textureSampleLevel(
      specularTexture,
      sam,
      direction,
      min(lod, f32(params.maxMipLevel))
    ).rgb;
  }

  irradiance /= f32(sampleCount);

  textureStore(irradianceTexture, vec2(x, y), face, vec4f(irradiance, 1.0));
}



// hammersley2d describes a sequence of points in the 2d unit square [0,1)^2
// that can be used for quasi Monte Carlo integration
fn hammersley2d(i: u32, N: u32) -> vec2f {
    return vec2(f32(i) / f32(N), radicalInverse_VdC(i));
}

fn radicalInverse_VdC(inputBits: u32) -> f32 {
    var bits: u32 = inputBits;
    bits = (bits << 16u) | (bits >> 16u);
    bits = ((bits & 0x55555555u) << 1u) | ((bits & 0xAAAAAAAAu) >> 1u);
    bits = ((bits & 0x33333333u) << 2u) | ((bits & 0xCCCCCCCCu) >> 2u);
    bits = ((bits & 0x0F0F0F0Fu) << 4u) | ((bits & 0xF0F0F0F0u) >> 4u);
    bits = ((bits & 0x00FF00FFu) << 8u) | ((bits & 0xFF00FF00u) >> 8u);
    return f32(bits) * 2.3283064365386963e-10; // / 0x100000000
}

// TBN generates a tangent bitangent normal coordinate frame from the normal
// (the normal must be normalized)
fn generateTBN(normal: vec3f) -> mat3x3f {
  var bitangent: vec3f = vec3(0.0, 1.0, 0.0);

  let NdotUp: f32 = dot(normal, vec3(0.0, 1.0, 0.0));
  let epsilon: f32 = 0.0000001;
  
  if 1.0 - abs(NdotUp) <= epsilon {
    // Sampling +Y or -Y, so we need a more robust bitangent.
    if NdotUp > 0.0 {
      bitangent = vec3(0.0, 0.0, 1.0);
    }
    else {
      bitangent = vec3(0.0, 0.0, -1.0);
    }
  }

  let tangent: vec3f = normalize(cross(bitangent, normal));
  bitangent = cross(normal, tangent);

  return mat3x3f(tangent, bitangent, normal);
}


fn computeLod(pdf: f32) -> f32 {

  return 0.5 * log2( 6.0 * f32(params.faceSize) * f32(params.faceSize) / (f32(params.sampleCount) * pdf));
}

fn transformDirection(face: u32, uv: vec2f) -> vec3f {
  // Transform the direction based on the cubemap face
  switch (face) {
    case 0u {return vec3f(  1.0, uv.y, -uv.x);} // +X  
    case 1u {return vec3f( -1.0, uv.y,  uv.x);} // -X
    case 2u {return vec3f( uv.x, -1.0,  uv.y);} // +Y
    case 3u {return vec3f( uv.x,  1.0, -uv.y);} // -Y
    case 4u {return vec3f( uv.x, uv.y,   1.0);} // +Z
    case 5u {return vec3f(-uv.x, uv.y,  -1.0);} // -Z
    default {return vec3f(  0.0,  0.0,   0.0);}
  }
}