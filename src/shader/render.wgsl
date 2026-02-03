struct Para {
  lookAtMatrix: mat4x4f,
  viewMatrix: mat4x4f,
  viewProjectionMatrix: mat4x4f,
  eye: vec3f,
  textureScale: f32,
  lts: f32, // linear texture steps
  tdx: f32, // texture dx
  tdy: f32, // texture dy
  tth: f32, // texture triangle height
}

struct Inter {
  @builtin(position) clipSpacePosition: vec4f,
  @location(0) color: vec4f,
  @location(1) normal: vec3f,
  @location(2) surfaceToEye: vec3f,
  // Removed skyDirection (calculated per-pixel now)
  @location(3) glossyness: f32,
  @location(4) uv: vec2f,
  @location(5) tangent: vec3f, // Added tangent
}

@group(0) @binding(0) var<uniform> para: Para;
@group(0) @binding(1) var<storage, read> object: array<Object>;
@group(0) @binding(2) var sam: sampler;
@group(0) @binding(3) var cubeMapTexture: texture_cube<f32>;
@group(0) @binding(4) var irradianceTexture: texture_cube<f32>;
@group(0) @binding(5) var albedoTexture: texture_2d<f32>;
@group(0) @binding(6) var amocTexture: texture_2d<f32>;
@group(0) @binding(7) var normalTexture: texture_2d<f32>;
@group(0) @binding(8) var roughTexture: texture_2d<f32>;

//_____________________________________________________________________________

@vertex
fn vs_instance(
  @location(0) position: vec3f, // position buffer
  @location(1) normal: vec3f, // normal buffer
  @builtin(instance_index) instanceIndex: u32, // index buffer
) -> Inter {

  var out: Inter;
  let obj = object[instanceIndex];

  var scaledPosition = obj.size * position;
  let rotatedPosition = rotate_by_quarternion(scaledPosition, obj.quarternion);
  let worldPosition = vec4f(rotatedPosition + obj.position, 1);

  out.clipSpacePosition = para.viewProjectionMatrix * worldPosition;
  out.color = obj.color;
  out.glossyness = obj.glossyness;

  out.normal = rotate_by_quarternion(normal, obj.quarternion);
  out.surfaceToEye = para.eye - worldPosition.xyz;

  // Instance meshes don't have tangents in this setup, pass 0
  out.tangent = vec3f(0.0);

  return out;
}

@vertex
fn vs_triangle(
  @location(0) position: vec3f, // position buffer
  @location(1) normal: vec3f, // normal buffer
  @location(2) tangent: vec3f, // tangent buffer
  @builtin(vertex_index) vertexIndex: u32
) -> Inter {

  var out: Inter;

  out.clipSpacePosition = para.viewProjectionMatrix * vec4f(position, 1);
  out.surfaceToEye = para.eye - position; // Keep in World Space
  out.normal = normal;
  out.tangent = tangent; // Pass World Space Tangent to FS
  out.color = object[0].color;
  out.glossyness = object[0].glossyness;

  // Texture coords generation
  let current = vertexIndex / 3;
  let ltsInt = u32(para.lts);
  let offset = vec2f(f32(current%ltsInt) * para.tdx, f32(current/ltsInt) * para.tdy);
  if vertexIndex%3 == 0 {out.uv = vec2f(0, 0);}
  else if vertexIndex%3 == 1 {out.uv = vec2f(1, 0);}
  else {out.uv = vec2f(0.5, para.tth);}
  out.uv *= para.textureScale;
  out.uv += offset;

  return out;
}

//_____________________________________________________________________________

@fragment
fn fs(in: Inter) -> @location(0) vec4f {
  let albedo = in.color.rgb;
  let amoc = vec3f(1);
  return colorize(in, albedo, amoc, in.normal, true);
}

// used for triangles
@fragment
fn fs_texture(in: Inter) -> @location(0) vec4f {

  // this would be the actual color of the texture (reddish)
  let albedo = textureSample(albedoTexture, sam, in.uv).rgb;
  // or use our custom color
  // let albedo = in.color.rgb;

  // ambient occlusion color
  let amoc = textureSample(amocTexture, sam, in.uv).rgb;

  // roughness map_______________________________
  // We only need one channel (.r) since it is a grayscale image.
  let roughness = textureSample(roughTexture, sam, in.uv).r;
  var out = in;
  out.glossyness = (1.0 - roughness) * in.glossyness;

  // normal______________________________________
  // 1. Sample Normal Map (Tangent Space)
  let rawNormal = textureSample(normalTexture, sam, in.uv).xyz;
  let mapNormal = rawNormal * 2.0 - 1.0;

  // 2. Reconstruct TBN Matrix (Tangent -> World)
  let t = normalize(in.tangent);
  let n = normalize(in.normal);
  // Gram-Schmidt orthogonalization to ensure T and N are perpendicular
  let t_ortho = normalize(t - dot(t, n) * n);
  let b = cross(t_ortho, n);
  let tbn = mat3x3f(t_ortho, b, n);

  // 3. Transform Tangent Normal to World Normal
  let worldNormal = normalize(tbn * mapNormal);

  return colorize(out, albedo, amoc, worldNormal, true);
}

//_____________________________________________________________________________

fn colorize(in: Inter, albedo: vec3f, amoc: vec3f, norm: vec3f, doFres: bool) -> vec4f {

  // normalize interpolated values
  let normal = normalize(norm);
  let surfaceToEye = normalize(in.surfaceToEye);

  // Calculate reflection vector per-pixel using the Detailed Normal
  let skyDirection = sky_direction(surfaceToEye, normal);

  var color = albedo;

  // environment texture
  let b = 2.0; // brightness
  var kD = 1.0;

  if doFres {
    let cosTheta = dot(normal, surfaceToEye);
    let kS = fresnel(0.03, cosTheta);
    kD = 1.0 - kS;
  }

  // Use calculated skyDirection
  color *= b * kD * textureSample(irradianceTexture, sam, skyDirection).xyz;

  // glossy specular
  // instead of sharp reflections always, we use mipmaps based on roughness.
  let roughness = 1.0 - in.glossyness;
  let maxMip = f32(textureNumLevels(cubeMapTexture));
  let lod = roughness * (maxMip - 1.0);

  // Sample environment map with Level of Detail (LOD)
  let specular = textureSampleLevel(cubeMapTexture, sam, skyDirection, lod).xyz;
  color += in.glossyness * specular;

  // rim glow
  // adds a subtle highlight at grazing angles (edges of the object)
  let NdotV = max(dot(normal, surfaceToEye), 0.0);
  let rimPower = 3.0;
  let rimIntensity = pow(1.0 - NdotV, rimPower);
  let rimColor = vec3f(1.0); // White rim
  color += rimColor * rimIntensity * 0.2;

  color *= amoc;

  return vec4f(color, 1);
}

fn sky_direction(surfaceToEye: vec3f, normal: vec3f) -> vec3f {
  var direction = reflect(- surfaceToEye, normal);
  direction = (para.viewMatrix * vec4f(direction, 0)).xyz; // lock to camera
  direction *= vec3f(1, 1, -1); // mirror
  return direction;
}

fn rotate_by_quarternion(v: vec3f, q: vec4f) -> vec3f {
  return v + 2 * cross(q.xyz, cross(q.xyz, v) + q.w * v);
}

fn fresnel(f0: f32, cosTheta: f32) -> f32 {
  return f0 + (1 - f0) * pow(clamp(1 - cosTheta, 0, 1), 5);
}
