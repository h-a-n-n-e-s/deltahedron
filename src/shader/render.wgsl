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

struct VertexOutput {
  @builtin(position) clipSpacePosition: vec4f,
  @location(0) color: vec4f,
  @location(1) normal: vec3f,
  @location(2) surfaceToLight: vec3f,
  @location(3) surfaceToEye: vec3f,
}

@group(0) @binding(0) var<uniform> para: Para;
@group(0) @binding(1) var<storage, read> object: array<Object>;

@vertex
fn vs(
  @location(0) vertexPosition: vec4f, // vertex buffer
  @location(1) normal: vec3f, // normal buffer
  @builtin(instance_index) instanceIndex: u32 // index buffer
) -> VertexOutput {

  var vsOut: VertexOutput;
  let obj = object[instanceIndex];

  var scaledPosition = obj.size * vertexPosition.xyz;

  let rotatedPosition = rotateByQuarternion(scaledPosition, obj.quarternion);

  let worldPosition = vec4f(rotatedPosition + obj.position, 1);

  vsOut.clipSpacePosition = para.viewProjectionMatrix * worldPosition;
  vsOut.color = obj.color;

  vsOut.normal = rotateByQuarternion(normal, obj.quarternion);

  // point light
  // vsOut.surfaceToLight = para.pointLightPosition - worldPosition.xyz;
  // locked to camera
  vsOut.surfaceToLight = (para.lookAtMatrix * vec4f(para.pointLightPosition, 1)).xyz - worldPosition.xyz;

  vsOut.surfaceToEye = para.eye - worldPosition.xyz;

  return vsOut;
}

@fragment
fn fs(fsInput: VertexOutput) -> @location(0) vec4f {

  let normal = normalize(fsInput.normal); // interpolated so not a unit vector
  let surfaceToLightDirection = normalize(fsInput.surfaceToLight);
  let surfaceToEyeDirection = normalize(fsInput.surfaceToEye);
  let distanceSquared = dot(fsInput.surfaceToLight, fsInput.surfaceToLight);

  // directional light
  // var light = para.lightIntensity * dot(normal, - para.lightDirection);
  // locked to camera
  var light = para.lightIntensity * dot(normal, - (para.lookAtMatrix * vec4f(para.lightDirection, 0)).xyz);

  // point light
  light += para.pointLightIntensity * max(dot(normal, surfaceToLightDirection), 0) / distanceSquared;

  let halfVector = normalize(surfaceToLightDirection + surfaceToEyeDirection);
  let specular = max(dot(normal, halfVector), 0);

  let color = fsInput.color.rgb * light + para.kira * pow(specular, 30) / distanceSquared;
  
  return vec4f(color, 1);
}

fn rotateByQuarternion(v:vec3f, q:vec4f) -> vec3f {
  return v + 2 * cross(q.xyz, cross(q.xyz, v) + q.w * v);
}