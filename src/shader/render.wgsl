struct Para {
  lookAtMatrix: mat4x4f,
  viewMatrix: mat4x4f,
  viewProjectionMatrix: mat4x4f,
  eye: vec3f,
  kira: f32,
  lightDirection: vec3f,
  lightIntensity: f32,
  pointLightPosition: vec3f,
  pointLightIntensity: f32,
}

struct Inter {
  @builtin(position) clipSpacePosition: vec4f,
  @location(0) color: vec4f,
  @location(1) normal: vec3f,
  @location(2) surfaceToLight: vec3f,
  @location(3) surfaceToEye: vec3f,
  @location(4) glossyness: f32,
  @location(5) useTexture: f32,
  @location(6) uv: vec2f,
}

@group(0) @binding(0) var<uniform> para: Para;
@group(0) @binding(1) var<storage, read> object: array<Object>;
@group(0) @binding(2) var sam: sampler;
@group(0) @binding(3) var cubeMapTexture: texture_cube<f32>;
@group(0) @binding(4) var irradianceTexture: texture_cube<f32>;
@group(0) @binding(5) var albedoTexture: texture_2d<f32>;
@group(0) @binding(6) var amocTexture: texture_2d<f32>;
@group(0) @binding(7) var normalTexture: texture_2d<f32>;

@vertex
fn vs(
  @location(0) vertexPosition: vec3f, // vertex buffer
  @location(1) normal: vec3f, // normal buffer
  @builtin(instance_index) instanceIndex: u32, // index buffer
  @builtin(vertex_index) vertexIndex: u32
) -> Inter {

  var out: Inter;
  let obj = object[instanceIndex];

  var scaledPosition = obj.size * vertexPosition;

  let rotatedPosition = rotateByQuarternion(scaledPosition, obj.quarternion);

  let worldPosition = vec4f(rotatedPosition + obj.position, 1);

  out.clipSpacePosition = para.viewProjectionMatrix * worldPosition;
  out.color = obj.color;
  out.glossyness = obj.glossyness;

  out.normal = rotateByQuarternion(normal, obj.quarternion);

  // point light
  // out.surfaceToLight = para.pointLightPosition - worldPosition.xyz;
  // locked to camera
  out.surfaceToLight = (para.lookAtMatrix * vec4f(para.pointLightPosition, 1)).xyz - worldPosition.xyz;

  out.surfaceToEye = para.eye - worldPosition.xyz;

  out.useTexture = obj.useTexture;
  out.uv = vec2f(0, 0);
  if vertexIndex%3 == 1 {out.uv = vec2f(1, 0);}
  else if vertexIndex%3 == 2 {out.uv = vec2f(0.5, sqrt(3.0)/2.0);}
  out.uv *= 0.5;

  return out;
}

@fragment
fn fs(in: Inter) -> @location(0) vec4f {

  var distortion = textureSample(normalTexture, sam, in.uv).xyz;
  if in.useTexture == 0.0 {
    distortion = vec3f(0);
  }
  else {
    distortion = 0.5 * (2 * distortion - 1);
  }

  let normal = normalize(in.normal + 0 * distortion); // interpolated so not a unit vector

  let surfaceToLightDirection = normalize(in.surfaceToLight);
  let surfaceToEyeDirection = normalize(in.surfaceToEye);
  let distanceSquared = dot(in.surfaceToLight, in.surfaceToLight);

  // directional light
  // var light = para.lightIntensity * dot(normal, - para.lightDirection);
  // locked to camera
  var light = para.lightIntensity * dot(normal, - (para.lookAtMatrix * vec4f(para.lightDirection, 0)).xyz);

  // point light
  light += para.pointLightIntensity * max(dot(normal, surfaceToLightDirection), 0) / distanceSquared;

  let halfVector = normalize(surfaceToLightDirection + surfaceToEyeDirection);
  let specular = max(dot(normal, halfVector), 0);

  var color = in.color.rgb;// * light + para.kira * pow(specular, 30) / distanceSquared;

  let albedo = textureSample(albedoTexture, sam, in.uv).rgb;
  let amoc = textureSample(amocTexture, sam, in.uv).rgb;
  // if in.useTexture != 0.0 {
  //   color = albedo;
  // }

  // environment texture
  let b = 2.0; // brightness
  let f0 = 0.03;
  let cosTheta = dot(normal, surfaceToEyeDirection);
  let kS = fresnel(f0, cosTheta);
  let kD = 1.0 - kS; 

  var direction = reflect(- surfaceToEyeDirection, normal);
  direction = (para.viewMatrix * vec4f(direction, 0)).xyz; // lock to camera
  direction *= vec3f(1, 1, -1); // mirror
  color *= b * kD * textureSample(irradianceTexture, sam, direction).xyz;
  color += in.glossyness * textureSample(cubeMapTexture, sam, direction).xyz;

  if in.useTexture != 0.0 {
    color *= amoc * amoc * amoc;
  }

  return vec4f(color, 1);

  // var mapped = color / (color + vec3f(1));
  // var mapped = vec3f(1.0) - exp(-color * 3);
  // // mapped = pow(mapped, vec3f(1.0 / 2.2));
  // return vec4f(mapped, 1);
}

fn rotateByQuarternion(v:vec3f, q:vec4f) -> vec3f {
  return v + 2 * cross(q.xyz, cross(q.xyz, v) + q.w * v);
}

fn fresnel(f0:f32, cosTheta:f32) -> f32 {
  return f0 + (1 - f0) * pow(clamp(1 - cosTheta, 0, 1), 5);
}